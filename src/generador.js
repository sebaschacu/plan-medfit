// ═══════════════ GENERADOR DE CALENDARIO v6 ═══════════════
//
// Sustituye al array CALENDARIO_DEFAULT escrito a mano de la v5.
//
// PRINCIPIO DE DISEÑO: el calendario es una FUNCIÓN PURA del ancla.
//   calendario = generar(ancla, fijados, festivos)
// El contador de la secuencia de gym NO se guarda en ningún sitio: se deriva
// recorriendo los días desde el ancla. Por eso regenerar es idempotente y
// septiembre continúa exactamente donde acabó agosto, sin riesgo de que el
// contador avance dos veces por regenerar el mismo mes.
//
// ⚠️ NOTA SOBRE EL CUPO SEMANAL DEL PLAN v6
// La tabla 1.1 del plan lista: 3 gym + 1 running + 1 natación + 1 calistenia
// + 1 descanso + 1 día flexible = 8 asignaciones. Una semana tiene 7 días.
// El propio bloque de ejemplo de 15 días del plan reparte 7 gym / 2 running /
// 2 natación / 2 calistenia / 2 descanso = 15, o sea ≈ 3 gym + 1 de cada cosa
// por semana, SIN un octavo hueco. Así que aquí el "día flexible" no es un día
// extra: es la ETIQUETA del día de descanso, que puede ascender a gym extra o
// cardio si el turno y las reglas de seguridad lo permiten. Eso reconcilia las
// dos filas de la tabla y reproduce el ejemplo del plan.

import { SECUENCIA_GYM, SECUENCIA_NATACION, NATACION_CSS, PISCINA, VENTANA_PISCINA, CUPO_SEMANAL,
  PRIORIDAD_TURNO, S7_PIERNA, DOBLES, GYM_PIERNA, GYM_TORSO, GYM_SOLAPAN, ORDEN_DOBLE, CARDIO_FLEXIBLE,
  CARDIO_CUPO, CARDIO_POR_DEFECTO_FLEXIBLE } from './data.js';

// El cupo y las prioridades se LEEN de data.js: si se hardcodearan aquí, esas
// constantes volverían a ser decoración y cambiar el plan obligaría a tocar dos
// sitios que pueden discrepar en silencio.
const admite = (turno, tipo) => (PRIORIDAD_TURNO[turno] || []).includes(tipo);
const admiteGym = (turno) => admite(turno, 'gym');
const admiteCardio = (turno) => admite(turno, 'cardio');

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CICLO_TURNOS = ['L', 'C', 'N', 'P'];
const ES_PIERNA = new Set(['gymC1', 'gymC2']);

// ─── Fechas (UTC para que no dependa de la zona horaria del dispositivo) ───
export const aISO = (d) => d.toISOString().slice(0, 10);
export const deISO = (s) => {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
const sumarDias = (d, n) => new Date(d.getTime() + n * 86400000);
const diffDias = (a, b) => Math.round((a.getTime() - b.getTime()) / 86400000);

// Ancla por defecto: la rota real de agosto 2026 arrancaba en día L el 1 de agosto,
// con la secuencia de gym empezando por A.
export const ANCLA_DEFAULT = { fecha: '2026-08-01', turno: 'L', gymIdx: 0 };
export const FESTIVOS_DEFAULT = ['2026-08-07', '2026-08-17'];

// ─── Rota de turnos ───
// Un turno fijado a mano NO desplaza el ciclo: solo pisa ese día.
// (Es lo que hacía el calendario v5 real: el día 13 estaba pisado y el 14 seguía en su sitio.)
export function turnoDe(fechaISO, ancla, fijados = {}) {
  const fijado = fijados[fechaISO];
  if (fijado?.turno) return fijado.turno;
  const base = CICLO_TURNOS.indexOf(ancla.turno);
  const off = diffDias(deISO(fechaISO), deISO(ancla.fecha));
  return CICLO_TURNOS[(((base + off) % 4) + 4) % 4];
}

export const MOMENTO = {
  L: 'Cualquier hora',
  C: 'Tarde, al salir',
  N: 'Mañana o mediodía',  // S5 — nunca por la tarde antes de la guardia
  P: 'Tarde, tras dormir', // S4 — depende de las horas de sueño
};

// ─── Natación: franjas de piscina compatibles con el turno (N5) ───
// Devuelve las horas viables, o [] si ese día es imposible.
export function franjasCompatibles(fechaISO, turno, festivos = []) {
  if (festivos.includes(fechaISO)) return [];        // festivo → piscina cerrada
  const ventana = VENTANA_PISCINA[turno];
  if (!ventana) return [];                            // turno C → nunca (S/N5)
  const nombreDia = DIAS_ES[deISO(fechaISO).getUTCDay()];
  const dia = PISCINA[nombreDia];
  if (!dia || dia.franjas.length === 0) return [];    // domingo → cerrado
  return dia.franjas
    .filter(h => h >= ventana.desde && h <= ventana.hasta)
    .map(h => ({ hora: h, guiado: dia.guiado.includes(h) }));
}

// Mejor franja de un día: se prioriza SIEMPRE entrenamiento guiado (hay coach).
const mejorFranja = (franjas) => {
  if (!franjas.length) return null;
  const guiadas = franjas.filter(f => f.guiado);
  return (guiadas.length ? guiadas : franjas)[0];
};

// ─── Agrupar un rango de fechas en semanas lunes→domingo ───
function semanasDe(desde, hasta) {
  const out = [];
  let cur = [];
  for (let d = new Date(desde.getTime()); d <= hasta; d = sumarDias(d, 1)) {
    cur.push(new Date(d.getTime()));
    if (d.getUTCDay() === 0) { out.push(cur); cur = []; }   // domingo cierra semana
  }
  if (cur.length) out.push(cur);
  return out;
}


// ═══════════════ POLÍTICA DE FIJADO MANUAL ═══════════════
// Qué pasa con la cola (gym o natación) cuando se fija una sesión a mano.
//
//   'no-avanza'    → la que tocaba se hace en la SIGUIENTE. La rotación se
//                    retrasa, pero nunca se pierde una sesión.
//   'resincroniza' → la cola salta a la posición de la fijada. Lo que quedaba
//                    en medio se salta.
//
// Se usa 'no-avanza' en las dos colas. Para el gym esto CAMBIA el comportamiento
// anterior (resincronizaba): saltarse una C1 significaba saltarse un día de
// pierna, y eso choca con S7. Cambiar aquí revierte las dos a la vez.
export const POLITICA_FIJADO = 'no-avanza';

// ─── Guardarraíl de solapes ───
// 'no-avanza' tiene un efecto secundario: la que tocaba cae en el hueco JUSTO
// DESPUÉS del fijado. Si el usuario fija una D y tocaba una A, hace banca dos
// sesiones seguidas. Medido: 14 solapes en 60 combinaciones de un solo día
// fijado; 0 sin fijar. El guardarraíl salta las de la cola que solaparían con la
// última hecha y deja un aviso. Las saltadas vuelven en la siguiente vuelta.
export function solapanGym(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return GYM_SOLAPAN.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// ═══════════════ SESIONES DOBLES ═══════════════
// Sección 2 de la especificación. La natación combina con todo; el running solo
// con gym de TORSO. Gym de pierna + running está PROHIBIDO, no avisado: es donde
// se lesiona la gente y además viola S3.
export function combinacionValida(principal, secundaria) {
  if (!principal || !secundaria) return { ok: false, motivo: 'Falta una de las dos sesiones.' };
  if (principal === secundaria) return { ok: false, motivo: 'No tiene sentido repetir la misma sesión.' };

  const esGym = (x) => String(x).startsWith('gym');
  const pierna = (x) => GYM_PIERNA.includes(x);
  const torso = (x) => GYM_TORSO.includes(x);

  if (esGym(principal) && esGym(secundaria)) {
    return { ok: false, motivo: 'Dos sesiones de gimnasio el mismo día son volumen inasumible.' };
  }
  const esCardioPierna = (x) => x === 'running' || x === 'ciclismo';
  if (esCardioPierna(principal) && esCardioPierna(secundaria)) {
    return { ok: false, motivo: 'Dos cardios de pierna el mismo día no aportan nada.' };
  }
  // La natación combina con todo: impacto cero y patrón motor distinto
  if (principal === 'natacion' || secundaria === 'natacion') return { ok: true };

  // Running + gym: solo si el gym es de torso
  const gym = esGym(principal) ? principal : esGym(secundaria) ? secundaria : null;
  const otra = gym === principal ? secundaria : principal;
  if (gym && esCardioPierna(otra)) {
    if (pierna(gym)) {
      // La bici es de impacto cero, pero el cuádriceps trabaja igual: la regla
      // vale para las dos. Lo que la bici protege son pies, tibias y sóleo.
      return { ok: false, regla: 'S3',
        motivo: `Gym de pierna + ${otra === 'ciclismo' ? 'bici' : 'running'} el mismo día viola la regla S3. Es donde se lesiona la gente: mismos tejidos, dos estímulos seguidos.` };
    }
    if (torso(gym)) return { ok: true };
  }
  if (principal === 'descanso' || secundaria === 'descanso') {
    return { ok: false, motivo: 'Un día de descanso no lleva segunda sesión: para eso deja de ser descanso.' };
  }
  return { ok: false, motivo: 'Combinación no contemplada por el plan.' };
}

// Sección 3: primero fuerza, después cardio. Nunca al revés — salvo que haya
// 6h o más de separación, donde el orden da igual.
export function ordenDoble(principal, secundaria) {
  // El orden lo dicta ORDEN_DOBLE de data.js (fuerza 1, cardio 2), no un
  // hardcode aquí: si esa constante no gobernara, volvería a ser decoración.
  const rango = (x) => String(x).startsWith('gym') ? ORDEN_DOBLE.fuerza : ORDEN_DOBLE.cardio;
  return rango(principal) <= rango(secundaria)
    ? { primero: principal, despues: secundaria }
    : { primero: secundaria, despues: principal };
}

// Valida la separación declarada entre las dos sesiones de un día doblado.
export function validarSeparacion(horas, principal, secundaria) {
  if (horas == null || Number.isNaN(Number(horas))) return { nivel: 'sin_dato', texto: 'Indica cuántas horas separan las dos sesiones.' };
  const h = Number(horas);
  if (h >= DOBLES.separacionOrdenLibre) {
    return { nivel: 'perfecta', ordenLibre: true, texto: `${h}h de separación: perfecto, y con esta holgura el orden da igual.` };
  }
  if (h >= DOBLES.separacionMinima) {
    const o = ordenDoble(principal, secundaria);
    return { nivel: h >= DOBLES.separacionIdeal ? 'ideal' : 'aceptable', ordenLibre: false,
      texto: `${h}h de separación. Haz primero ${o.primero} y después ${o.despues}: el cardio antes del gimnasio te deja levantando menos peso.` };
  }
  return { nivel: 'aviso', ordenLibre: false,
    texto: `Solo ${h}h entre sesiones. Por debajo de ${DOBLES.separacionMinima}h esto solo funciona si la segunda es corta y muy suave.` };
}

// ═══════════════ EL GENERADOR ═══════════════
//
// Genera SIEMPRE desde el ancla hasta `hasta`, aunque solo quieras un mes:
// es lo que hace que el contador de gym sea continuo entre meses y que
// regenerar dé exactamente el mismo resultado.
export function generarDesdeAncla({ hasta, ancla = ANCLA_DEFAULT, fijados = {}, festivos = FESTIVOS_DEFAULT }) {
  const inicio = deISO(ancla.fecha);
  const fin = deISO(hasta);
  // Rango anterior al ancla: no hay nada que generar. Se devuelve la MISMA forma
  // que en el caso normal — devolver un array pelado aquí convertía un "sin datos"
  // en una pantalla en blanco al desestructurar { dias, avisos }.
  if (fin < inicio) return { dias: [], avisos: [], gymIdxFinal: ancla.gymIdx ?? 0 };

  const dias = [];                    // salida, en orden cronológico
  let gymIdx = ancla.gymIdx ?? 0;     // posición en A → C1 → D → C2 → B
  let natIdx = ancla.natIdx ?? 0;     // posición en A1 → B1 → A2 → B2 → A3 → B3
  let natHechas = 0;                  // sesiones de natación hechas
  let natUltimoTest = 0;              // cuándo se hizo el último test de CSS
  let natTestHecho = false;           // ¿se ha llegado a hacer el test alguna vez?
  let gymSeguidos = 0;                // S1 — nunca más de 4 gym consecutivos
  let ultimaPierna = null;            // S7 — separación mínima entre días de pierna
  let ultimoGym = null;               // clave del último gym colocado — guardarraíl de solapes
  const avisos = [];

  const nuevoDia = (fecha, turno) => ({
    fecha: aISO(fecha),
    dia: fecha.getUTCDate(),
    sem: DIAS_ES[fecha.getUTCDay()],
    turno,
    sesion: null,
    momento: MOMENTO[turno],
    festivo: festivos.includes(aISO(fecha)),
  });

  const enCola = (i) => SECUENCIA_GYM[((i % 5) + 5) % 5];
  const debidaGym = () => enCola(gymIdx);

  // La que toca de verdad: la debida, salvo que solape con el último gym hecho.
  // Entonces se avanza en la cola hasta la primera que no solape. Cada sesión
  // solapa como mucho con otras dos (D con A y B), así que siempre se encuentra
  // una en ≤3 saltos. Sin gyms fijados a mano esto no salta jamás: la rotación
  // A→C1→D→C2→B no tiene pares consecutivos que solapen.
  const proximaGym = () => {
    for (let k = 0; k < SECUENCIA_GYM.length; k++) {
      const cand = enCola(gymIdx + k);
      if (!solapanGym(ultimoGym, cand)) return { sesion: cand, saltadas: k };
    }
    return { sesion: debidaGym(), saltadas: 0 };
  };

  // Coloca en un día LIBRE la que toca y avanza la cola. Los días fijados no
  // pasan por aquí: los trata el recorrido directamente.
  const ponerGym = (d, semanaISO) => {
    const { sesion, saltadas } = proximaGym();
    d.sugeridaGym = sesion;                 // la que toca, para marcarla en la UI
    d.sesion = sesion;
    if (saltadas > 0) {
      const saltada = debidaGym();
      avisos.push({ semana: semanaISO, fecha: d.fecha, tipo: 'solape_evitado',
        texto: `Día ${d.dia}: tocaba ${saltada} pero venías de ${ultimoGym} y se repetiría el mismo patrón dos sesiones seguidas. Se hace ${sesion}; ${saltada} vuelve en la siguiente vuelta de la cola.` });
    }
    gymIdx += saltadas + 1;                 // las saltadas se pierden esta vuelta, no se pierden para siempre
    ultimoGym = sesion;
    if (ES_PIERNA.has(sesion)) ultimaPierna = deISO(d.fecha);
    return d;
  };

  // ¿Se puede poner gym en este día sin romper S1 ni el suelo de S7?
  const gymPermitido = (d, seguidosPrevios) => {
    if (!admiteGym(d.turno)) return false;              // PRIORIDAD_TURNO decide (C nunca)
    if (seguidosPrevios >= 4) return false;             // S1
    // S7 se comprueba sobre la que REALMENTE se pondría, guardarraíl incluido
    const siguiente = proximaGym().sesion;
    if (ES_PIERNA.has(siguiente) && ultimaPierna) {
      // S7: separación mínima entre días de pierna, leída de data.js
      if (diffDias(deISO(d.fecha), ultimaPierna) < S7_PIERNA.separacionMinimaDias) return false;
    }
    return true;
  };

  for (const semana of semanasDe(inicio, fin)) {
    const ds = semana.map(f => nuevoDia(f, turnoDe(aISO(f), ancla, fijados)));

    // Días ya decididos: fijados a mano por el usuario, o fijados AUTOMÁTICAMENTE
    // porque ya tienen entrenamiento registrado (el pasado no se recalcula: si se
    // moviera, el historial quedaría con IDs de ejercicios de otra sesión).
    const libres = [];
    for (const d of ds) {
      const fij = fijados[d.fecha];
      if (fij?.sesion) {
        d.sesion = fij.sesion;
        d.fijado = true;
        d.fijadoAuto = !!fij.auto;       // auto = fijado por tener registro, no a mano
        // Un día de natación fijado conserva su franja de piscina: se calcula aquí
        // porque el paso de asignación solo mira los días libres.
        if (d.sesion === 'natacion') {
          d.franja = mejorFranja(franjasCompatibles(d.fecha, d.turno, festivos));
          d.varianteFijada = fij.variante;
        }
      } else libres.push(d);
      // La variante fijada de la SECUNDARIA se lee siempre: el día puede tener
      // gym como principal y natación doblada, y entonces el bloque de arriba
      // (que solo mira la principal) nunca llegaría a leerla.
      if (fij?.varianteSecundaria) d.varianteFijadaSecundaria = fij.varianteSecundaria;
    }

    // Cupo restante de la semana, descontando lo ya fijado
    const yaHay = (pred) => ds.filter(d => d.sesion && pred(d.sesion)).length;
    const cupo = {
      gym: Math.max(0, CUPO_SEMANAL.gym - yaHay(s => s.startsWith('gym'))),
      natacion: Math.max(0, CUPO_SEMANAL.natacion - yaHay(s => s === 'natacion')),
      calistenia: Math.max(0, CUPO_SEMANAL.calistenia - yaHay(s => s === 'calistenia')),
      // El cupo de running es de CARDIO: una bici fijada (en el flexible o donde
      // sea) ya cubre la semana, y no se busca otro hueco para correr.
      running: Math.max(0, CUPO_SEMANAL.running - yaHay(s => CARDIO_CUPO.includes(s))),
    };

    // Consecutivos de gym hacia atrás desde un día dado (cruza semanas y meses)
    const gymSeguidosAntes = (d) => {
      const prev = [...dias, ...ds].filter(x => x.sesion && x.fecha < d.fecha)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      let n = 0;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (diffDias(deISO(d.fecha), deISO(prev[i].fecha)) !== n + 1) break;
        if (!prev[i].sesion?.startsWith('gym')) break;
        n++;
      }
      return n;
    };

    // ── 1. DÍA FLEXIBLE · anclado a turno C ──
    // Los días C rotan por el calendario, así que el flexible se mueve solo sin
    // necesidad de reglas de colocación. Y es el día que peor se presta a entrenar
    // fuerte: ya son 12h de pie. Por defecto DESCANSO; puede pasar a running si se
    // cumplen las tres condiciones (dos las pregunta la app, la tercera se calcula).
    const diasC = libres.filter(d => d.turno === 'C').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const flexible = diasC[0] ?? null;
    if (flexible) {
      flexible.sesion = 'descanso';
      flexible.flexible = true;
      // Condición 3: no venir de dos días de gym seguidos. Esta sí la sabe la app.
      flexible.flexibleCond3 = gymSeguidosAntes(flexible) < 2;
      libres.splice(libres.indexOf(flexible), 1);
    }
    // El resto de días C son descanso: no admiten gym ni natación
    diasC.slice(1).forEach(d => { d.sesion = 'descanso'; libres.splice(libres.indexOf(d), 1); });

    // ── 2. NATACIÓN ×2 · lo más restringido (franjas de piscina) ──
    // La sesión concreta sale de la rotación A1→B1→A2→B2→A3→B3, con contador
    // derivado del ancla igual que la cola de gym: nunca se reinicia.
    // Cada 8 semanas (~16 sesiones) una B1 se sustituye por el test de CSS.
    const varianteNatacion = () => {
      // "Sesión 0": el test va primero. La condición es "mientras NO se haya
      // hecho", no "en la sesión 0": si se fija otra variante el primer día, con
      // la condición vieja el test se perdía para siempre.
      if (!natTestHecho) return 'natCSS';
      const v = SECUENCIA_NATACION[((natIdx % SECUENCIA_NATACION.length) + SECUENCIA_NATACION.length) % SECUENCIA_NATACION.length];
      // Después se repite cada 6-8 semanas sustituyendo una B1: comparten sistema
      // energético y estructura, así que la rotación no se descuadra.
      const cadaN = NATACION_CSS.cadaSemanas * CUPO_SEMANAL.natacion;
      if (v === NATACION_CSS.sustituye && natHechas - natUltimoTest >= cadaN) return 'natCSS';
      return v;
    };
    const ponerNatacion = (d, franja) => { d.sesion = 'natacion'; d.franja = franja; };
    const candidatosPiscina = (pool) => pool
      .map(d => ({ d, franjas: franjasCompatibles(d.fecha, d.turno, festivos) }))
      .filter(x => x.franjas.length > 0)
      .map(x => ({ ...x, prio: VENTANA_PISCINA[x.d.turno].prioridad, franja: mejorFranja(x.franjas) }))
      .sort((a, b) => a.prio - b.prio || (b.franja.guiado - a.franja.guiado) || a.d.fecha.localeCompare(b.d.fecha));

    // Una semana parcial es un borde del rango generado, no una semana real:
    // no se le exige cupo ni se la hace doblar.
    const semanaCompleta = ds.length === 7;
    const pendientes = [];   // sesiones que no cupieron como principal
    let natPuestas = 0;
    for (let i = 0; i < cupo.natacion; i++) {
      const cands = candidatosPiscina(libres);
      if (!cands.length) { if (semanaCompleta) pendientes.push('natacion'); continue; }
      const { d, franja } = cands[0];
      ponerNatacion(d, franja);
      libres.splice(libres.indexOf(d), 1);
      natPuestas++;
    }

    // ── 3. GYM ×3 · solo L, P, N. Respeta S1 y el suelo de S7 ──
    // UN SOLO recorrido cronológico que incluye también los días FIJADOS a gym:
    // si un gym fijado no pasara por aquí, la cola se saltaría su posición.
    let puestos = 0;
    const recorrido = [...ds].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const d of recorrido) {
      if (d.fijado && d.sesion?.startsWith('gym')) {
        // Gym fijado a mano: la cola NO avanza salvo que coincida con la debida.
        const debida = debidaGym();
        if (d.sesion === debida) gymIdx++;
        else if (POLITICA_FIJADO === 'resincroniza') gymIdx = SECUENCIA_GYM.indexOf(d.sesion) + 1;
        ultimoGym = d.sesion;                 // el guardarraíl compara contra lo fijado
        if (ES_PIERNA.has(d.sesion)) ultimaPierna = deISO(d.fecha);
        continue;
      }
      if (d.sesion) continue;                 // ya tiene natación o calistenia
      if (puestos >= cupo.gym) continue;
      if (!admiteGym(d.turno)) continue;      // PRIORIDAD_TURNO decide (C nunca)
      if (!gymPermitido(d, gymSeguidosAntes(d))) continue;
      ponerGym(d, ds[0].fecha);
      libres.splice(libres.indexOf(d), 1);
      puestos++;
    }

    if (semanaCompleta) for (let i = puestos; i < cupo.gym; i++) pendientes.push('gym');

    // ── 4. RUNNING ·×1 · preferentemente día N (mañana). NUNCA tras pierna (S3) ──
    const esTrasPierna = (d) => {
      const ayer = aISO(sumarDias(deISO(d.fecha), -1));
      const dAyer = [...dias, ...ds].find(x => x.fecha === ayer);
      return dAyer && ES_PIERNA.has(dAyer.sesion);
    };
    // Cuando el ÚNICO hueco libre cae justo después de una pierna, S3 lo bloquea y
    // el running se pierde aunque la semana tenga sitio para las seis sesiones.
    // Se intercambian: la pierna pasa al hueco libre (sigue siendo el mismo gym,
    // en la misma posición de la cola) y el running ocupa el día de la pierna.
    // Solo si la pierna es de esta semana, no está fijada, y el cambio respeta
    // S1, S7 y los turnos de los dos días.
    const ultimaPiernaAntesDe = (fecha) => {
      const previas = [...dias, ...ds].filter(x => ES_PIERNA.has(x.sesion) && x.fecha < fecha)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      return previas[0] ? deISO(previas[0].fecha) : null;
    };
    const intentarSwapS3 = (libre) => {
      const ayerISO = aISO(sumarDias(deISO(libre.fecha), -1));
      const pierna = ds.find(x => x.fecha === ayerISO);
      if (!pierna || pierna.fijado || !ES_PIERNA.has(pierna.sesion) || pierna.sesionSecundaria) return false;
      if (!admiteGym(libre.turno) || !admiteCardio(pierna.turno)) return false;
      // El running iría al día de la pierna: no puede venir él también de otra pierna
      const anteayer = [...dias, ...ds].find(x => x.fecha === aISO(sumarDias(deISO(pierna.fecha), -1)));
      if (anteayer && ES_PIERNA.has(anteayer.sesion)) return false;
      // S7 para la pierna en su día nuevo, contra la pierna anterior a ella
      const previa = ultimaPiernaAntesDe(pierna.fecha);
      if (previa && diffDias(deISO(libre.fecha), previa) < S7_PIERNA.separacionMinimaDias) return false;
      // S1 no peligra: el running en el día de la pierna corta cualquier racha por
      // detrás, y por delante la racha no puede pasar de los gyms de esta semana
      // (cupo 3). La semana siguiente coloca los suyos mirando hacia atrás con
      // gymSeguidosAntes, que es quien hace cumplir S1 en la frontera.
      const sesionPierna = pierna.sesion;
      libre.sesion = sesionPierna;
      libre.sugeridaGym = pierna.sugeridaGym;
      pierna.sesion = 'running';
      delete pierna.sugeridaGym;
      ultimaPierna = deISO(libre.fecha);
      libres.splice(libres.indexOf(libre), 1);
      avisos.push({ semana: ds[0].fecha, fecha: pierna.fecha, tipo: 'running_por_swap_s3',
        texto: `Día ${pierna.dia}: el único hueco libre de la semana caía justo tras la pierna (S3). Se intercambian: ${sesionPierna} pasa al día ${libre.dia} y el running ocupa el ${pierna.dia}.` });
      return true;
    };

    let runPuestos = 0;
    for (let i = 0; i < cupo.running; i++) {
      const ok = libres.filter(d => !esTrasPierna(d) && admiteCardio(d.turno));
      if (!ok.length) {
        // Sin hueco válido. ¿Hay uno libre que solo bloquea S3? Entonces el swap.
        const bloqueados = libres.filter(d => esTrasPierna(d) && admiteCardio(d.turno))
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        if (bloqueados.some(intentarSwapS3)) { runPuestos++; continue; }
        if (semanaCompleta) pendientes.push('running');
        continue;
      }
      const orden = { N: 0, L: 1, P: 2, C: 3 };
      const elegido = [...ok].sort((a, b) => orden[a.turno] - orden[b.turno] || a.fecha.localeCompare(b.fecha))[0];
      elegido.sesion = 'running';
      libres.splice(libres.indexOf(elegido), 1);
      runPuestos++;
    }

    // El flexible ya sabe qué hubo el día anterior (las principales están puestas).
    // Si fue pierna, S3 prohíbe el running ahí y la bici tampoco conviene: la UI
    // lo lee para no ofrecer lo que rompería la regla.
    if (flexible) flexible.trasPierna = !!esTrasPierna(flexible);

    // ── 5. SESIONES DOBLES · cubrir lo que no cupo como principal ──
    // El déficit es de ~3 sesiones cada 28 días, no un problema semanal.
    // Se dobla en días aptos (L sin restricción, P condicional) respetando D1-D4.
    if (pendientes.length) {
      // D3 · en la semana de descarga solo se dobla con lo MÁS SUAVE (natación o
      // bici, nunca running). Antes no se doblaba nada y esas semanas perdían el
      // cardio: 5 huecos para 6 sesiones y la única salida cerrada.
      const semanaBloque = Math.floor(diffDias(deISO(ds[0].fecha), inicio) / 7) % DOBLES.semanasBloque + 1;
      const enDescarga = semanaBloque === DOBLES.semanasBloque;
      const esSuave = (s) => DOBLES.descarga.doblesSuaves.includes(s);

      // Orden de preferencia de qué se dobla (el running es el más flexible de horario)
      const rango = (x) => { const i = DOBLES.prioridad.indexOf(x); return i === -1 ? 99 : i; };
      const noResueltos = [];
      pendientes.sort((a, b) => rango(a) - rango(b));

      // ¿Puede una natación de esta semana pasar a doble y dejarle su día al running?
      // Candidata: natación principal, no fijada, cuyo día admite running (turno y
      // S3). Anfitrión para ella: otro día con principal que no sea natación, turno
      // que permite doblar, franja de piscina compatible, y sin romper D1 ni D2.
      // D2: sin días doblados pegados
      const sinVecinosDoblados = (d) => {
        if (!DOBLES.noConsecutivos) return true;
        const vecino = (n) => [...dias, ...ds].find(x => x.fecha === aISO(sumarDias(deISO(d.fecha), n)));
        return !vecino(-1)?.sesionSecundaria && !vecino(1)?.sesionSecundaria;
      };
      // Anfitriones posibles para doblar `sesion`: días con principal, turno que
      // admite doblar, combinación válida, no tras pierna si es cardio (S3 para
      // el running; para la bici es el mismo criterio que en el flexible: el
      // cuádriceps sí trabaja), y D2.
      // L antes que P: el P es condicional (ventana corta tras dormir).
      const anfitrionesPara = (sesion) => ds
        .filter(d => d.sesion && !d.sesionSecundaria && DOBLES.turnos[d.turno]?.permite)
        .filter(d => combinacionValida(d.sesion, sesion).ok)
        .filter(d => !(CARDIO_CUPO.includes(sesion) && esTrasPierna(d)))
        .filter(sinVecinosDoblados)
        .sort((a, b) => (DOBLES.turnos[a.turno].condicional - DOBLES.turnos[b.turno].condicional)
          || a.fecha.localeCompare(b.fecha));

      // Dobla `sesion` sobre su mejor anfitrión. Devuelve el anfitrión o null.
      const doblar = (sesion, host) => {
        host.sesionSecundaria = sesion;
        host.dobleOrden = ordenDoble(host.sesion, sesion);
        host.dobleCondicional = !!DOBLES.turnos[host.turno].condicional;
        if (host.dobleCondicional) {
          avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'doble_condicional',
            texto: `Día ${host.dia} (posturno): se dobló ${sesion} sobre ${host.sesion}. ${DOBLES.turnos.P.condicion}.` });
        }
        return host;
      };

      const natCedeDiaARunning = () => {
        const dobladosSemana = ds.filter(d => d.sesionSecundaria).length;
        if (dobladosSemana >= DOBLES.maxPorSemana) return false;                      // D1
        const candidatas = ds
          .filter(d => d.sesion === 'natacion' && !d.fijado && !d.sesionSecundaria)
          .filter(d => admiteCardio(d.turno) && !esTrasPierna(d))
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        for (const nat of candidatas) {
          const host = ds
            .filter(d => d !== nat && d.sesion && d.sesion !== 'natacion' && !d.sesionSecundaria)
            .filter(d => DOBLES.turnos[d.turno]?.permite && combinacionValida(d.sesion, 'natacion').ok)
            .filter(sinVecinosDoblados)
            .map(d => ({ d, franja: mejorFranja(franjasCompatibles(d.fecha, d.turno, festivos)) }))
            .filter(x => x.franja)
            .sort((a, b) => (DOBLES.turnos[a.d.turno].condicional - DOBLES.turnos[b.d.turno].condicional)
              || a.d.fecha.localeCompare(b.d.fecha))[0];
          if (!host) continue;
          // Aplicar: la natación se dobla sobre host; su día pasa a running
          host.d.sesionSecundaria = 'natacion';
          host.d.franjaSecundaria = host.franja;
          host.d.dobleOrden = ordenDoble(host.d.sesion, 'natacion');
          host.d.dobleCondicional = !!DOBLES.turnos[host.d.turno].condicional;
          const diaNat = nat.dia;
          nat.sesion = 'running';
          delete nat.franja;
          avisos.push({ semana: ds[0].fecha, fecha: nat.fecha, tipo: 'natacion_cede_a_running',
            texto: `Día ${diaNat}: el running no tenía dónde doblar. La natación pasa a segunda sesión del día ${host.d.dia} (${host.d.sesion}) y le deja el día.` });
          if (host.d.dobleCondicional) {
            avisos.push({ semana: ds[0].fecha, fecha: host.d.fecha, tipo: 'doble_condicional',
              texto: `Día ${host.d.dia} (posturno): se dobló natacion sobre ${host.d.sesion}. ${DOBLES.turnos.P.condicion}.` });
          }
          return true;
        }
        return false;
      };

      for (const queFalta of [...pendientes]) {
        const dobladosSemana = ds.filter(d => d.sesionSecundaria).length;
        if (dobladosSemana >= DOBLES.maxPorSemana) {   // D1
          noResueltos.push(queFalta);
          avisos.push({ semana: ds[0].fecha, fecha: ds[0].fecha, tipo: 'limite_dobles',
            texto: `Semana del ${ds[0].dia}: ${queFalta} no cabe. Ya hay ${dobladosSemana} días doblados y el máximo es ${DOBLES.maxPorSemana} (D1).` });
          continue;
        }

        // D3 · en descarga, lo que no es suave no se dobla. El gym se queda fuera
        // sin más. El running tiene dos salidas suaves, en este orden: que una
        // natación ceda su día (la doble es la natación) o que la bici lo
        // sustituya doblada sobre un gym de torso. Running doblado, nunca.
        if (enDescarga && !esSuave(queFalta)) {
          if (queFalta === 'running') {
            if (natCedeDiaARunning()) continue;
            const host = anfitrionesPara('ciclismo')[0];
            if (host) {
              doblar('ciclismo', host);
              avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'bici_en_descarga',
                texto: `Día ${host.dia}: semana de DESCARGA (D3). El running no se dobla; en su lugar, bici sobre ${host.sesion} —lo más suave que quedaba—. El cardio semanal no se pierde.` });
              continue;
            }
          }
          noResueltos.push(queFalta);
          avisos.push({ semana: ds[0].fecha, fecha: ds[0].fecha, tipo: 'doble_en_descarga',
            texto: `Semana del ${ds[0].dia}: es la semana ${semanaBloque} del bloque, la de DESCARGA (P4: mitad de series, RIR +2). Solo se dobla con natación o bici (D3), y ${queFalta} no cabe así${queFalta === 'running' ? ' — se propone en el día flexible' : ''}.` });
          continue;
        }

        // Un 'gym' pendiente se materializa en la sesión que toque de la cola:
        // guardar el token genérico dejaba días con sesionSecundaria: 'gym'.
        // Con guardarraíl: un gym doblado también es un gym consecutivo.
        const gymDoble = queFalta === 'gym' ? proximaGym() : null;
        const sesionPendiente = gymDoble ? gymDoble.sesion : queFalta;

        const anfitriones = anfitrionesPara(sesionPendiente);

        if (!anfitriones.length) {
          // El running solo dobla sobre gym de torso en L o P, y a menudo no queda
          // ninguno. La natación, en cambio, combina con todo: si una natación de
          // esta semana puede pasar a segunda sesión de otro día (con franja de
          // piscina) y su día admite running, se intercambian. El cupo de natación
          // no cambia: sigue siendo 2, una como principal y otra doblada.
          if (queFalta === 'running' && natCedeDiaARunning()) continue;
          noResueltos.push(queFalta);
          avisos.push({ semana: ds[0].fecha, fecha: ds[0].fecha, tipo: 'sin_hueco_doblando',
            texto: `Semana del ${ds[0].dia}: no hay ningún día donde doblar ${sesionPendiente}. Esa sesión se queda sin asignar.` });
          continue;
        }

        const host = anfitriones[0];
        if (queFalta === 'natacion') {
          const fr = mejorFranja(franjasCompatibles(host.fecha, host.turno, festivos));
          if (!fr) {
            noResueltos.push(queFalta);
            avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'sin_hueco_doblando',
              texto: `Día ${host.dia}: era el único sitio para doblar natación, pero no tiene franja de piscina compatible.` });
            continue;
          }
          host.franjaSecundaria = fr;

        }
        host.sesionSecundaria = sesionPendiente;
        if (gymDoble) {
          if (gymDoble.saltadas > 0) {
            avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'solape_evitado',
              texto: `Día ${host.dia}: al doblar tocaba ${debidaGym()} pero venías de ${ultimoGym} y se repetiría el patrón. Se dobla ${sesionPendiente}; ${debidaGym()} vuelve en la siguiente vuelta.` });
          }
          gymIdx += gymDoble.saltadas + 1;
          ultimoGym = sesionPendiente;
          if (ES_PIERNA.has(sesionPendiente)) ultimaPierna = deISO(host.fecha);
        }
        host.dobleOrden = ordenDoble(host.sesion, sesionPendiente);
        host.dobleCondicional = !!DOBLES.turnos[host.turno].condicional;
        if (host.dobleCondicional) {
          avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'doble_condicional',
            texto: `Día ${host.dia} (posturno): se dobló ${queFalta} sobre ${host.sesion}. ${DOBLES.turnos.P.condicion}.` });
        }
      }

      // Si el cardio no encontró sitio, el día flexible es su casa: para eso está.
      // Y ya no se propone: se PONE. Bici por defecto, porque el flexible cae en
      // turno C —12h de pie— y la bici da el mismo Z2 sin castigar pies ni tibias.
      // Lo importante es no saltarse el cardio de la semana; correr o pedalear es
      // lo de menos. La app ofrece cambiarlo a running o a descanso.
      // Solo cuando la app SABE que no toca (viene de pierna, o de dos gym
      // seguidos) se queda en descanso y se vuelve a proponer, como antes.
      if (noResueltos.includes('running') && flexible && !flexible.sesionSecundaria) {
        const puedePorDefecto = !flexible.trasPierna && flexible.flexibleCond3;
        if (puedePorDefecto) {
          flexible.sesion = CARDIO_POR_DEFECTO_FLEXIBLE;
          flexible.cardioPorDefecto = true;
          flexible.sugerencia = {
            sesion: CARDIO_POR_DEFECTO_FLEXIBLE,
            porDefecto: CARDIO_POR_DEFECTO_FLEXIBLE,
            opciones: [...CARDIO_FLEXIBLE],
            motivo: 'Esta semana el cardio no cupo en ningún otro día, así que hoy toca bici por defecto: mismo Z2 que correr, sin impacto tras 12h de pie. Si te apetece correr, cámbialo; si no dormiste o el peso no sube, descansa.',
            cond3Cumplida: true,
          };
          avisos.push({ semana: ds[0].fecha, fecha: flexible.fecha, tipo: 'bici_por_defecto',
            texto: `Día ${flexible.dia}: el cardio no cupo en ningún día no-C, así que el día flexible pasa a BICI por defecto. Puedes cambiarlo a running o a descanso desde la sesión.` });
        } else {
          flexible.sugerencia = {
            sesion: 'running',
            opciones: [...CARDIO_FLEXIBLE],
            motivo: flexible.trasPierna
              ? 'Esta semana el cardio no cupo en ningún otro día, pero ayer fue pierna: no se pone bici por defecto. Si dormiste bien y el peso va subiendo, bici suave; correr no (S3).'
              : 'Esta semana el cardio no cupo en ningún otro día, pero vienes de dos días de gym seguidos: no se pone bici por defecto. Si dormiste bien y el peso va subiendo, cardio suave.',
            cond3Cumplida: flexible.flexibleCond3,
          };
          avisos.push({ semana: ds[0].fecha, fecha: flexible.fecha, tipo: 'running_al_flexible',
            texto: `Día ${flexible.dia}: el cardio no cupo en ningún día no-C y el flexible ${flexible.trasPierna ? 'viene de pierna' : 'viene de dos gym seguidos'}, así que no se pone bici por defecto: se propone. La app te preguntará por el sueño y el peso.` });
        }
      }
    }

    // ── 5b. VARIANTE DE NATACIÓN · sellado CRONOLÓGICO ──
    // Las natación se COLOCAN por prioridad de turno (L antes que N antes que P),
    // no por fecha. Si la rotación avanzara en ese orden, A1→B1→A2… saldría
    // desordenada en el calendario. Se sella aquí, ya con la semana decidida.
    [...ds].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(d => {
      const sellar = (fijada) => {
        const debida = varianteNatacion();
        const v = fijada ?? debida;
        if (v === 'natCSS') { natUltimoTest = natHechas; natTestHecho = true; }
        // Fijar a mano NO avanza la rotación: la que tocaba se hace en la
        // siguiente. Si lo fijado ES lo que tocaba, avanza normal — si no, esa
        // variante se repetiría.
        else if (!fijada || fijada === debida || POLITICA_FIJADO === 'resincroniza') natIdx++;
        natHechas++;
        return v;
      };
      if (d.sesion === 'natacion' && !d.variante) {
        d.sugerida = varianteNatacion();      // la que tocaba, para marcarla en la UI
        d.variante = sellar(d.varianteFijada);
      }
      // La secundaria también admite variante fijada, igual que la principal.
      if (d.sesionSecundaria === 'natacion' && !d.varianteSecundaria) {
        d.sugeridaSecundaria = varianteNatacion();
        d.varianteSecundaria = sellar(d.varianteFijadaSecundaria);
      }
    });

    // ── 6. DESCANSO: lo que quede ──
    for (const d of libres) if (!d.sesion) d.sesion = 'descanso';

    // Consolidar la semana
    // Semana del bloque de 8: la 8ª es descarga (P4). Se marca en TODOS los días
    // para que la app pueda avisarlo el día que toca, no solo en el resumen semanal.
    const semanaDelBloque = Math.floor(diffDias(deISO(ds[0].fecha), inicio) / 7) % DOBLES.semanasBloque + 1;
    for (const d of ds.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (!d.sesion) d.sesion = 'descanso';
      d.semanaBloque = semanaDelBloque;
      d.descarga = semanaDelBloque === DOBLES.semanasBloque;
      if (d.sesion.startsWith('gym')) gymSeguidos++; else gymSeguidos = 0;
      dias.push(d);
    }
  }

  return { dias, avisos, gymIdxFinal: gymIdx };
}

// ─── API principal: el calendario de UN mes ───
// Devuelve el mismo shape que consumía la app (dia, sem, turno, sesion, festivo)
// más los campos nuevos (fecha, momento, franja, flexible, fijado).
export function generarMes({ anio, mes, ancla = ANCLA_DEFAULT, fijados = {}, festivos = FESTIVOS_DEFAULT }) {
  const ultimoDelMes = new Date(Date.UTC(anio, mes + 1, 0));
  // Se genera hasta el DOMINGO que cierra la semana del último día del mes.
  // Si se cortara en el día 31, la semana a caballo entre dos meses se generaría
  // distinta según qué mes pidieras (cupo a medias) y la cola de gym se saltaría
  // posiciones en cada cambio de mes.
  const finSemana = sumarDias(ultimoDelMes, (7 - ultimoDelMes.getUTCDay()) % 7);
  const { dias, avisos } = generarDesdeAncla({ hasta: aISO(finSemana), ancla, fijados, festivos });
  const delMes = dias.filter(d => {
    const f = deISO(d.fecha);
    return f.getUTCFullYear() === anio && f.getUTCMonth() === mes;
  });
  // Se filtra por la FECHA del día al que se refiere el aviso, no por su semana:
  // las semanas cruzan meses, y filtrar por semana hacía que septiembre mostrara
  // un aviso sobre el "Día 30" que en realidad era el 30 de AGOSTO.
  const avisosMes = avisos.filter(a => {
    const f = deISO(a.fecha ?? a.semana);
    return f.getUTCFullYear() === anio && f.getUTCMonth() === mes;
  });
  return { dias: delMes, avisos: avisosMes };
}

// Metadatos del mes para la cabecera y la cuadrícula del calendario.
export function infoMes(anio, mes) {
  const NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const primero = new Date(Date.UTC(anio, mes, 1));
  // 0 = lunes, porque la cuadrícula empieza en lunes
  const primerDiaSemana = (primero.getUTCDay() + 6) % 7;
  return { nombre: NOMBRES[mes], anio, mesIdx: mes, primerDiaSemana };
}
