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

import { NATACION_CSS, RUNNING_TEST, VARIANTES_DE, PISCINA, VENTANA_PISCINA, CUPO_SEMANAL, PLAN_V6, PLAN_BOGOTA, SECUENCIA_BICI,
  PRIORIDAD_TURNO, S7_PIERNA, DOBLES, GYM_PIERNA, GYM_TORSO, GYM_SOLAPAN, ORDEN_DOBLE, CARDIO_FLEXIBLE,
  CARDIO_CUPO, CARDIO_POR_DEFECTO_FLEXIBLE, SESION_INFO } from './data.js';
import { resolverConfig, CONFIG_PLAN } from './config.js';

// El cupo y las prioridades se LEEN de data.js: si se hardcodearan aquí, esas
// constantes volverían a ser decoración y cambiar el plan obligaría a tocar dos
// sitios que pueden discrepar en silencio.
// Desde Ajustes el usuario puede cambiarlos: el generador recibe la config ya
// resuelta (config.js), que con la config vacía es exactamente data.js.
const admite = (turno, tipo, prioridad = PRIORIDAD_TURNO) => (prioridad[turno] || []).includes(tipo);

const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ES_PIERNA = new Set(GYM_PIERNA);   // v6: C1 y C2 · v7: además Pierna A y Pierna B

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
// El ciclo es L → C → N → P salvo que el usuario lo cambie en Ajustes. Si dice
// además qué turno es HOY (`cicloHoy`), el ciclo se alinea con ese día; si no,
// arranca en el turno del ancla, como siempre.
export function turnoDe(fechaISO, ancla, fijados = {}, cfg = CONFIG_PLAN) {
  const fijado = fijados[fechaISO];
  if (fijado?.turno) return fijado.turno;
  const ciclo = cfg.ciclo;
  const n = ciclo.length;
  const base = cfg.cicloHoy
    ? cfg.cicloHoy.pos - diffDias(deISO(cfg.cicloHoy.fecha), deISO(ancla.fecha))
    : Math.max(0, ciclo.indexOf(ancla.turno));
  const off = diffDias(deISO(fechaISO), deISO(ancla.fecha));
  return ciclo[(((base + off) % n) + n) % n];
}

export const MOMENTO = {
  L: 'Cualquier hora',
  C: 'Tarde, al salir',
  N: 'Mañana o mediodía',  // S5 — nunca por la tarde antes de la guardia
  P: 'Tarde, tras dormir', // S4 — depende de las horas de sueño
};

// ─── Natación: franjas de piscina compatibles con el turno (N5) ───
// Devuelve las horas viables, o [] si ese día es imposible.
export function franjasCompatibles(fechaISO, turno, festivos = [], ventanas = VENTANA_PISCINA) {
  if (festivos.includes(fechaISO)) return [];        // festivo → piscina cerrada
  const ventana = ventanas[turno];
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

// ─── Avisos al fijar un gym a mano ───
// El guardarraíl de arriba solo protege HACIA DELANTE: lo que el generador pone
// después de un día fijado. Hacia atrás no puede hacer nada, porque el día
// anterior ya está en el calendario y reescribirlo sería mover días que el
// usuario no editó. Medido: de 38 solapes con un día fijado, 14 eran
// fijado→siguiente (los arregla el guardarraíl, hoy 0) y 24 anterior→fijado.
// Para esos 24 la respuesta no es tocar nada: es AVISAR antes de fijar, y que
// la decisión siga siendo del usuario. Se avisa de dos cosas:
//   · solape de patrón con el gym anterior (GYM_SOLAPAN)
//   · S7, la separación mínima entre días de pierna
// Función PURA: recibe el calendario que ya se está viendo y devuelve la lista
// de avisos. No muta nada, no fija nada, no decide nada.
export function avisoAlFijar(calendario, fecha, sesion) {
  const out = [];
  if (!sesion || !String(sesion).startsWith('gym') || !fecha) return out;
  const gymDe = (d) => [d.sesion, d.sesionSecundaria].find(s => String(s).startsWith('gym'));
  const piernaDe = (d) => [d.sesion, d.sesionSecundaria].find(s => GYM_PIERNA.includes(s));
  const dias = (calendario ?? []).filter(d => d?.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const previos = dias.filter(d => d.fecha < fecha);

  // 1. Solape de patrón con el gym anterior. No hace falta que sea el día de
  //    antes: lo que castiga la misma zona dos veces son dos SESIONES seguidas.
  const anterior = previos.filter(gymDe).at(-1);
  if (anterior && solapanGym(gymDe(anterior), sesion)) {
    const dist = diffDias(deISO(fecha), deISO(anterior.fecha));
    out.push({ tipo: 'solape_al_fijar', regla: 'guardarraíl', fecha, contra: anterior.fecha,
      texto: `El gym anterior (día ${anterior.dia}, ${dist === 1 ? 'ayer mismo' : `${dist} días antes`}) es ${SESION_INFO[gymDe(anterior)]?.label ?? gymDe(anterior)}, y comparte patrón principal con ${SESION_INFO[sesion]?.label ?? sesion}: harías la misma zona dos sesiones seguidas sin recuperar. El generador evita esto solo hacia delante; este día lo eliges tú.` });
  }

  // 2. S7 · separación mínima entre días de pierna, hacia atrás y hacia delante.
  //    Hacia delante solo se mira contra días ya FIJADOS: los demás los
  //    recalcula el generador respetando S7, así que avisar de ellos sería ruido.
  if (GYM_PIERNA.includes(sesion)) {
    const minimo = S7_PIERNA.separacionMinimaDias;
    const antes = previos.filter(piernaDe).at(-1);
    if (antes && diffDias(deISO(fecha), deISO(antes.fecha)) < minimo) {
      const dist = diffDias(deISO(fecha), deISO(antes.fecha));
      out.push({ tipo: 's7_al_fijar', regla: 'S7', fecha, contra: antes.fecha,
        texto: `El día de pierna anterior fue el ${antes.dia}, ${dist === 1 ? 'un solo día antes' : `${dist} días antes`}. S7 pide al menos ${minimo} días entre piernas y aquí quedarían ${dist}: el cuádriceps no llega a recuperar. Puedes fijarlo igual, pero sabiendo esto.` });
    }
    const despues = dias.find(d => d.fecha > fecha && d.fijado && piernaDe(d));
    if (despues && diffDias(deISO(despues.fecha), deISO(fecha)) < minimo) {
      const dist = diffDias(deISO(despues.fecha), deISO(fecha));
      out.push({ tipo: 's7_al_fijar', regla: 'S7', fecha, contra: despues.fecha,
        texto: `El día ${despues.dia} ya está fijado con pierna, ${dist === 1 ? 'un solo día después' : `${dist} días después`}. S7 pide al menos ${minimo} días: al estar fijado, el generador no lo va a mover para hacer sitio.` });
    }
  }
  return out;
}

// ═══════════════ SESIONES DOBLES ═══════════════
// Sección 2 de la especificación. La natación combina con todo; el running solo
// con gym de TORSO. Gym de pierna + running está PROHIBIDO, no avisado: es donde
// se lesiona la gente y además viola S3.
// `s3`: en el plan v7 (Bogotá) la regla S3 se quitó, y pierna + cardio el mismo
// día vale (pesas primero, cardio unas horas después). Por defecto, la del v6.
export function combinacionValida(principal, secundaria, { s3 = true } = {}) {
  if (!principal || !secundaria) return { ok: false, motivo: 'Falta una de las dos sesiones.' };
  if (principal === secundaria) return { ok: false, motivo: 'No tiene sentido repetir la misma sesión.' };

  // Deportes propios: combinan con todo, salvo los que cargan las piernas,
  // que siguen la misma lógica que S3 (nada de dos estímulos de pierna el mismo día).
  const deporte = (x) => SESION_INFO[x]?.deporte;
  if (deporte(principal) || deporte(secundaria)) {
    if (principal === 'descanso' || secundaria === 'descanso') {
      return { ok: false, motivo: 'Un día de descanso no lleva segunda sesión: para eso deja de ser descanso.' };
    }
    const dep = deporte(principal) ? principal : secundaria;
    const otra = dep === principal ? secundaria : principal;
    const cargaPierna = (x) => GYM_PIERNA.includes(x) || x === 'running' || x === 'ciclismo' || !!SESION_INFO[x]?.piernas;
    if (SESION_INFO[dep].piernas && cargaPierna(otra)) {
      return { ok: false, regla: 'S3',
        motivo: `${SESION_INFO[dep].label} carga las piernas: junto a ${SESION_INFO[otra]?.label ?? otra} el mismo día serían dos estímulos seguidos para los mismos tejidos.` };
    }
    return { ok: true };
  }

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
    if (pierna(gym) && !s3) return { ok: true };
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
// `planFijo` ('v6' | 'v7') fuerza un plan para todo el rango: sirve para estudiar
// un plan entero (las pruebas del v6 miden años con él). Por defecto, por fecha.
export function generarDesdeAncla({ hasta, ancla = ANCLA_DEFAULT, fijados = {}, festivos = FESTIVOS_DEFAULT, config = {}, planFijo = null }) {
  // Config de Ajustes, ya unida a la del plan. Vacía = data.js tal cual.
  // DOS planes: v6 (Barranquilla) hasta el 29 de noviembre de 2026 y v7 (Bogotá)
  // desde el lunes 30. Cada semana usa el suyo; el cambio no reescribe el pasado.
  const C6 = resolverConfig(config, PLAN_V6);
  const C7 = resolverConfig(config, PLAN_BOGOTA);
  let C = null;
  let SEC_GYM, SEC_NAT, SEC_RUN, DOBLES_TURNOS;
  const usarPlan = (c) => { C = c; SEC_GYM = c.secGym; SEC_NAT = c.secNat; SEC_RUN = c.secRun; DOBLES_TURNOS = c.dobles; };
  const admiteGym = (turno) => admite(turno, 'gym', C.prioridad);
  const admiteCardio = (turno) => admite(turno, 'cardio', C.prioridad);
  // En Bogotá no hay horario de piscina conocido (N5 se quitó): basta con que el
  // turno admita natación, y el día no lleva hora.
  const SIN_HORARIO = { hora: null, guiado: false };
  const franjas = (fecha, turno, fest) => (C.piscina
    ? franjasCompatibles(fecha, turno, fest, C.ventana)
    : (C.ventana[turno] ? [SIN_HORARIO] : []));
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
  let runIdx = ancla.runIdx ?? 0;     // posición en la rotación de running
  let runHechas = 0;                  // carreras hechas (las genéricas antiguas no cuentan)
  let runUltimoTest = 0;              // cuándo se hizo el último test de 30 min
  let runTestHecho = false;
  let biciIdx = 0;                    // v7 · posición en zona 2 → 4×4
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

  const enCola = (i) => SEC_GYM[((i % SEC_GYM.length) + SEC_GYM.length) % SEC_GYM.length];
  const debidaGym = () => enCola(gymIdx);

  // La que toca de verdad: la debida, salvo que solape con el último gym hecho.
  // Entonces se avanza en la cola hasta la primera que no solape. Cada sesión
  // solapa como mucho con otras dos (D con A y B), así que siempre se encuentra
  // una en ≤3 saltos. Sin gyms fijados a mano esto no salta jamás: la rotación
  // A→C1→D→C2→B no tiene pares consecutivos que solapen.
  const proximaGym = () => {
    for (let k = 0; k < SEC_GYM.length; k++) {
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
    const planSemana = planFijo === 'v6' ? C6 : planFijo === 'v7' ? C7 : (aISO(semana[0]) >= PLAN_BOGOTA.desde ? C7 : C6);
    if (planSemana !== C) {
      // Al pasar al plan de Bogotá con una cola NUEVA (Torso / Pierna), empieza
      // por la primera. Con la misma cola (opción B), sigue donde iba.
      // S1 y S7 siguen mirando hacia atrás, así que la frontera las respeta.
      if (C && JSON.stringify(C.secGym) !== JSON.stringify(planSemana.secGym)) gymIdx = 0;
      usarPlan(planSemana);
    }
    const ds = semana.map(f => nuevoDia(f, turnoDe(aISO(f), ancla, fijados, C)));

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
          d.franja = mejorFranja(franjas(d.fecha, d.turno, festivos));
          d.varianteFijada = fij.variante;
        }
        if (d.sesion === 'running' || d.sesion === 'ciclismo') d.varianteFijada = fij.variante;
      } else libres.push(d);
      // La variante fijada de la SECUNDARIA se lee siempre: el día puede tener
      // gym como principal y natación doblada, y entonces el bloque de arriba
      // (que solo mira la principal) nunca llegaría a leerla.
      if (fij?.varianteSecundaria) d.varianteFijadaSecundaria = fij.varianteSecundaria;
    }

    // Cupo restante de la semana, descontando lo ya fijado
    const yaHay = (pred) => ds.filter(d => d.sesion && pred(d.sesion)).length;
    const cupo = {
      gym: Math.max(0, C.cupo.gym - yaHay(s => s.startsWith('gym'))),
      natacion: Math.max(0, C.cupo.natacion - yaHay(s => s === 'natacion')),
      calistenia: Math.max(0, CUPO_SEMANAL.calistenia - yaHay(s => s === 'calistenia')),
      // El cupo de running es de CARDIO: una bici fijada (en el flexible o donde
      // sea) ya cubre la semana, y no se busca otro hueco para correr.
      running: Math.max(0, C.cupo.running - yaHay(s => CARDIO_CUPO.includes(s))),
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
    const diasC = libres.filter(d => d.turno === C.turnoFlexible).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const flexible = C.cupo.flexible ? (diasC[0] ?? null) : null;
    if (flexible) {
      flexible.sesion = 'descanso';
      flexible.flexible = true;
      // Condición 3: no venir de dos días de gym seguidos. Esta sí la sabe la app.
      flexible.flexibleCond3 = gymSeguidosAntes(flexible) < 2;
      libres.splice(libres.indexOf(flexible), 1);
    }
    // El resto de días de un turno que no admite nada son descanso. En el plan es
    // el turno C: ni gym, ni cardio, ni piscina. Si el usuario abre un turno en
    // Ajustes, sus días vuelven a estar libres para lo que admitan.
    const deportesEn = (t) => C.deportesAuto.some(dp => dp.turnos.includes(t));
    const soloDescanso = (t) => !admiteGym(t) && !admiteCardio(t) && !C.ventana[t] && !deportesEn(t);
    libres.filter(d => soloDescanso(d.turno)).forEach(d => { d.sesion = 'descanso'; libres.splice(libres.indexOf(d), 1); });

    // ── 2. NATACIÓN ×2 · lo más restringido (franjas de piscina) ──
    // La sesión concreta sale de la rotación A1→B1→A2→B2→A3→B3, con contador
    // derivado del ancla igual que la cola de gym: nunca se reinicia.
    // Cada 8 semanas (~16 sesiones) una B1 se sustituye por el test de CSS.
    const varianteNatacion = () => {
      // "Sesión 0": el test va primero. La condición es "mientras NO se haya
      // hecho", no "en la sesión 0": si se fija otra variante el primer día, con
      // la condición vieja el test se perdía para siempre.
      if (!natTestHecho) return 'natCSS';
      const v = SEC_NAT[((natIdx % SEC_NAT.length) + SEC_NAT.length) % SEC_NAT.length];
      // Después se repite cada 6-8 semanas sustituyendo una B1: comparten sistema
      // energético y estructura, así que la rotación no se descuadra.
      const cadaN = NATACION_CSS.cadaSemanas * Math.max(1, C.cupo.natacion);
      if (v === C.cssSustituye && natHechas - natUltimoTest >= cadaN) return 'natCSS';
      return v;
    };
    const ponerNatacion = (d, franja) => { d.sesion = 'natacion'; d.franja = franja; };
    const candidatosPiscina = (pool) => pool
      .map(d => ({ d, franjas: franjas(d.fecha, d.turno, festivos) }))
      .filter(x => x.franjas.length > 0)
      .map(x => ({ ...x, prio: C.ventana[x.d.turno].prioridad, franja: mejorFranja(x.franjas) }))
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
        else if (POLITICA_FIJADO === 'resincroniza') gymIdx = SEC_GYM.indexOf(d.sesion) + 1;
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
      const ok = libres.filter(d => !(C.s3 && esTrasPierna(d)) && admiteCardio(d.turno));
      if (!ok.length && C.s3) {
        // Sin hueco válido. ¿Hay uno libre que solo bloquea S3? Entonces el swap.
        const bloqueados = libres.filter(d => esTrasPierna(d) && admiteCardio(d.turno))
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        if (bloqueados.some(intentarSwapS3)) { runPuestos++; continue; }
        if (semanaCompleta) pendientes.push('running');
        continue;
      }
      const orden = { N: 0, L: 1, P: 2, C: 3 };
      if (!ok.length) { if (semanaCompleta) pendientes.push('running'); continue; }
      // Dos cardios en la semana: mejor separados que en días seguidos.
      const separado = (d) => !ds.some(x => CARDIO_CUPO.includes(x.sesion) && Math.abs(diffDias(deISO(x.fecha), deISO(d.fecha))) === 1);
      const preferir = (a, b) => (C.plan === 'v7' ? separado(b) - separado(a) : 0);
      const elegido = [...ok].sort((a, b) => preferir(a, b) || orden[a.turno] - orden[b.turno] || a.fecha.localeCompare(b.fecha))[0];
      elegido.sesion = C.cardio;   // v6: running · v7: bici
      libres.splice(libres.indexOf(elegido), 1);
      runPuestos++;
    }

    // ── 4b. DEPORTES PROPIOS EN AUTOMÁTICO ──
    // Los que el usuario creó en Ajustes con «automático». Van después del plan:
    // ocupan días que habrían quedado de descanso, nunca le quitan el sitio a
    // gym, natación o cardio. Solo en los turnos que el usuario eligió, y si el
    // deporte carga las piernas, no el día después de pierna (S3). Lo que no
    // quepa como sesión principal se intenta doblar más abajo, cuando el plan
    // ya haya doblado lo suyo.
    const deportesPendientes = [];
    for (const dp of C.deportesAuto) {
      const faltan = Math.max(0, dp.porSemana - yaHay(s => s === dp.clave));
      for (let i = 0; i < faltan; i++) {
        const ok = libres
          .filter(d => !d.sesion && dp.turnos.includes(d.turno))
          .filter(d => !(dp.piernas && esTrasPierna(d)))
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        if (!ok.length) { if (semanaCompleta) deportesPendientes.push(dp); continue; }
        // Repartidos: el primer hueco libre que no sea el día siguiente a otro igual
        const separado = ok.find(d => !ds.some(x => x.sesion === dp.clave && Math.abs(diffDias(deISO(x.fecha), deISO(d.fecha))) === 1));
        const elegido = separado ?? ok[0];
        elegido.sesion = dp.clave;
        elegido.deporteAuto = true;
        libres.splice(libres.indexOf(elegido), 1);
      }
    }

    // El flexible ya sabe qué hubo el día anterior (las principales están puestas).
    // Si fue pierna, S3 prohíbe el running ahí y la bici tampoco conviene: la UI
    // lo lee para no ofrecer lo que rompería la regla.
    if (flexible) flexible.trasPierna = C.s3 && !!esTrasPierna(flexible);

    // ── 5. SESIONES DOBLES · cubrir lo que no cupo como principal ──
    // El déficit es de ~3 sesiones cada 28 días, no un problema semanal.
    // Se dobla en días aptos (L sin restricción, P condicional) respetando D1-D4.
    if (pendientes.length) {
      // D3 · en la semana de descarga solo se dobla con lo MÁS SUAVE (natación o
      // bici, nunca running). Antes no se doblaba nada y esas semanas perdían el
      // cardio: 5 huecos para 6 sesiones y la única salida cerrada.
      const semanaBloque = Math.floor(diffDias(deISO(ds[0].fecha), inicio) / 7) % DOBLES.semanasBloque + 1;
      const enDescarga = C.descarga && semanaBloque === DOBLES.semanasBloque;
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
      // S7 también para un gym de pierna doblado: lejos de cualquier otro día de
      // pierna, principal o doblado. Con el cupo del plan no llega a pasar; con
      // más gym por semana (Ajustes) sí.
      const lejosDePierna = (d) => ![...dias, ...ds].some(x => x !== d
        && [x.sesion, x.sesionSecundaria].some(k => ES_PIERNA.has(k))
        && Math.abs(diffDias(deISO(x.fecha), deISO(d.fecha))) < S7_PIERNA.separacionMinimaDias);
      const anfitrionesPara = (sesion) => ds
        .filter(d => d.sesion && !d.sesionSecundaria && DOBLES_TURNOS[d.turno]?.permite)
        .filter(d => combinacionValida(d.sesion, sesion, { s3: C.s3 }).ok)
        .filter(d => !(C.s3 && CARDIO_CUPO.includes(sesion) && esTrasPierna(d)))
        .filter(d => !ES_PIERNA.has(sesion) || lejosDePierna(d))
        .filter(sinVecinosDoblados)
        .sort((a, b) => (DOBLES_TURNOS[a.turno].condicional - DOBLES_TURNOS[b.turno].condicional)
          || a.fecha.localeCompare(b.fecha));

      // Dobla `sesion` sobre su mejor anfitrión. Devuelve el anfitrión o null.
      const doblar = (sesion, host) => {
        host.sesionSecundaria = sesion;
        host.dobleOrden = ordenDoble(host.sesion, sesion);
        host.dobleCondicional = !!DOBLES_TURNOS[host.turno].condicional;
        if (host.dobleCondicional) {
          avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'doble_condicional',
            texto: `Día ${host.dia} (posturno): se dobló ${sesion} sobre ${host.sesion}. ${(DOBLES_TURNOS.P?.condicion ?? DOBLES_TURNOS.P.condicion)}.` });
        }
        return host;
      };

      const natCedeDiaARunning = () => {
        const dobladosSemana = ds.filter(d => d.sesionSecundaria).length;
        if (dobladosSemana >= DOBLES.maxPorSemana) return false;                      // D1
        const candidatas = ds
          .filter(d => d.sesion === 'natacion' && !d.fijado && !d.sesionSecundaria)
          .filter(d => admiteCardio(d.turno) && !(C.s3 && esTrasPierna(d)))
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        for (const nat of candidatas) {
          const host = ds
            .filter(d => d !== nat && d.sesion && d.sesion !== 'natacion' && !d.sesionSecundaria)
            .filter(d => DOBLES_TURNOS[d.turno]?.permite && combinacionValida(d.sesion, 'natacion').ok)
            .filter(sinVecinosDoblados)
            .map(d => ({ d, franja: mejorFranja(franjas(d.fecha, d.turno, festivos)) }))
            .filter(x => x.franja)
            .sort((a, b) => (DOBLES_TURNOS[a.d.turno].condicional - DOBLES_TURNOS[b.d.turno].condicional)
              || a.d.fecha.localeCompare(b.d.fecha))[0];
          if (!host) continue;
          // Aplicar: la natación se dobla sobre host; su día pasa a running
          host.d.sesionSecundaria = 'natacion';
          host.d.franjaSecundaria = host.franja;
          host.d.dobleOrden = ordenDoble(host.d.sesion, 'natacion');
          host.d.dobleCondicional = !!DOBLES_TURNOS[host.d.turno].condicional;
          const diaNat = nat.dia;
          nat.sesion = C.cardio;
          delete nat.franja;
          avisos.push({ semana: ds[0].fecha, fecha: nat.fecha, tipo: 'natacion_cede_a_running',
            texto: `Día ${diaNat}: el running no tenía dónde doblar. La natación pasa a segunda sesión del día ${host.d.dia} (${host.d.sesion}) y le deja el día.` });
          if (host.d.dobleCondicional) {
            avisos.push({ semana: ds[0].fecha, fecha: host.d.fecha, tipo: 'doble_condicional',
              texto: `Día ${host.d.dia} (posturno): se dobló natacion sobre ${host.d.sesion}. ${(DOBLES_TURNOS.P?.condicion ?? DOBLES_TURNOS.P.condicion)}.` });
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
        // El cupo de cardio se llama 'running' por dentro; lo que se pone es el
        // cardio del plan (v7: bici).
        const sesionPendiente = gymDoble ? gymDoble.sesion : (queFalta === 'running' ? C.cardio : queFalta);

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
          const fr = mejorFranja(franjas(host.fecha, host.turno, festivos));
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
        host.dobleCondicional = !!DOBLES_TURNOS[host.turno].condicional;
        if (host.dobleCondicional) {
          avisos.push({ semana: ds[0].fecha, fecha: host.fecha, tipo: 'doble_condicional',
            texto: `Día ${host.dia} (posturno): se dobló ${queFalta} sobre ${host.sesion}. ${(DOBLES_TURNOS.P?.condicion ?? DOBLES_TURNOS.P.condicion)}.` });
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

    // ── 5c. DEPORTES QUE NO CUPIERON · como segunda sesión ──
    // Mismas reglas que cualquier doble: turno que deja doblar, combinación
    // válida, máximo de dobles por semana (D1) y sin días doblados pegados (D2).
    // Con qué se puede juntar un deporte. Se decide con los datos del propio
    // deporte (no con SESION_INFO): así la vista previa de Ajustes acierta
    // también con un deporte que todavía no se ha guardado.
    const piernasDe = (k) => GYM_PIERNA.includes(k) || k === 'running' || k === 'ciclismo'
      || !!C.deportesAuto.find(x => x.clave === k)?.piernas || !!SESION_INFO[k]?.piernas;
    const deporteCombina = (host, dp) => host !== 'descanso' && host !== dp.clave && !(dp.piernas && piernasDe(host));
    for (const dp of deportesPendientes) {
      const vecinoDoblado = (d, n) => [...dias, ...ds].find(x => x.fecha === aISO(sumarDias(deISO(d.fecha), n)))?.sesionSecundaria;
      if (ds.filter(x => x.sesionSecundaria).length >= DOBLES.maxPorSemana) {   // D1
        avisos.push({ semana: ds[0].fecha, fecha: ds[0].fecha, tipo: 'deporte_sin_hueco',
          texto: `Semana del ${ds[0].dia}: ${dp.nombre} no cupo. No quedan días libres en los turnos que elegiste y ya hay ${DOBLES.maxPorSemana} días doblados (D1).` });
        continue;
      }
      const host = ds.filter(d => d.sesion && !d.sesionSecundaria && dp.turnos.includes(d.turno) && DOBLES_TURNOS[d.turno]?.permite)
        .filter(d => deporteCombina(d.sesion, dp))
        .filter(d => !(dp.piernas && esTrasPierna(d)))
        .filter(d => !DOBLES.noConsecutivos || (!vecinoDoblado(d, -1) && !vecinoDoblado(d, 1)))
        .sort((a, b) => (DOBLES_TURNOS[a.turno].condicional - DOBLES_TURNOS[b.turno].condicional) || a.fecha.localeCompare(b.fecha))[0];
      if (host) {
        host.sesionSecundaria = dp.clave;
        host.dobleOrden = ordenDoble(host.sesion, dp.clave);
        host.dobleCondicional = !!DOBLES_TURNOS[host.turno].condicional;
        continue;
      }
      avisos.push({ semana: ds[0].fecha, fecha: ds[0].fecha, tipo: 'deporte_sin_hueco',
        texto: `Semana del ${ds[0].dia}: ${dp.nombre} no cupo. No quedan días libres en los turnos que elegiste, ni un día donde doblarlo.` });
    }

    // ── 5b. VARIANTE DE NATACIÓN Y RUNNING · sellado CRONOLÓGICO ──
    // Las natación se COLOCAN por prioridad de turno (L antes que N antes que P),
    // no por fecha. Si la rotación avanzara en ese orden, A1→B1→A2… saldría
    // desordenada en el calendario. Se sella aquí, ya con la semana decidida.
    // El running igual: sus días salen de varios pasos (cupo, cambios por S3,
    // dobles, flexible), así que la variante se decide al final, por fecha.
    // Una variante fijada solo vale si es de esa familia: una segunda sesión
    // cambiada a mano puede dejar colgada la de otra.
    const deFamilia = (ses, v) => (v && VARIANTES_DE[ses]?.includes(v) ? v : undefined);
    const varianteRunning = () => {
      if (!runTestHecho) return RUNNING_TEST.clave;
      const v = SEC_RUN[((runIdx % SEC_RUN.length) + SEC_RUN.length) % SEC_RUN.length];
      if (v === C.runTestSustituye && runHechas - runUltimoTest >= RUNNING_TEST.cadaCarreras) return RUNNING_TEST.clave;
      return v;
    };
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
      const sellarRun = (fijada) => {
        // La genérica de antes de las variantes: un día ya registrado con ella
        // la conserva y no cuenta en la rotación.
        if (fijada === 'running') return 'running';
        const debida = varianteRunning();
        const v = fijada ?? debida;
        if (v === RUNNING_TEST.clave) { runUltimoTest = runHechas; runTestHecho = true; }
        else if (!fijada || fijada === debida || POLITICA_FIJADO === 'resincroniza') runIdx++;
        runHechas++;
        return v;
      };
      if (d.sesion === 'natacion' && !d.variante) {
        d.sugerida = varianteNatacion();      // la que tocaba, para marcarla en la UI
        d.variante = sellar(deFamilia('natacion', d.varianteFijada));
      }
      // v7 · la bici alterna zona 2 y 4×4. Solo desde el plan de Bogotá: antes la
      // bici era una sola sesión y sus días conservan esa.
      const v7 = d.fecha >= PLAN_BOGOTA.desde;
      const sellarBici = (fijada) => {
        if (fijada === 'ciclismo') return 'ciclismo';
        const debida = SECUENCIA_BICI[biciIdx % SECUENCIA_BICI.length];
        const v = fijada ?? debida;
        if (!fijada || fijada === debida || POLITICA_FIJADO === 'resincroniza') biciIdx++;
        return v;
      };
      const fijadaBici = (f) => (f === 'ciclismo' ? 'ciclismo' : deFamilia('ciclismo', f));
      if (v7 && d.sesion === 'ciclismo' && !d.variante) {
        d.sugerida = SECUENCIA_BICI[biciIdx % SECUENCIA_BICI.length];
        d.variante = sellarBici(fijadaBici(d.varianteFijada));
      }
      if (v7 && d.sesionSecundaria === 'ciclismo' && !d.varianteSecundaria) {
        d.sugeridaSecundaria = SECUENCIA_BICI[biciIdx % SECUENCIA_BICI.length];
        d.varianteSecundaria = sellarBici(fijadaBici(d.varianteFijadaSecundaria));
      }
      if (d.sesion === 'running' && !d.variante) {
        d.sugerida = varianteRunning();
        d.variante = sellarRun(d.varianteFijada === 'running' ? 'running' : deFamilia('running', d.varianteFijada));
      }
      // La secundaria también admite variante fijada, igual que la principal.
      if (d.sesionSecundaria === 'natacion' && !d.varianteSecundaria) {
        d.sugeridaSecundaria = varianteNatacion();
        d.varianteSecundaria = sellar(deFamilia('natacion', d.varianteFijadaSecundaria));
      }
      if (d.sesionSecundaria === 'running' && !d.varianteSecundaria) {
        d.sugeridaSecundaria = varianteRunning();
        const f = d.varianteFijadaSecundaria;
        d.varianteSecundaria = sellarRun(f === 'running' ? 'running' : deFamilia('running', f));
      }
    });

    // ── 6. DESCANSO: lo que quede ──
    for (const d of libres) if (!d.sesion) d.sesion = 'descanso';

    // Consolidar la semana
    // Semana del bloque de 8: la 8ª es descarga (P4). Se marca en TODOS los días
    // para que la app pueda avisarlo el día que toca, no solo en el resumen semanal.
    // En el plan de Bogotá no hay descargas fijas (P4 se quitó).
    const semanaDelBloque = Math.floor(diffDias(deISO(ds[0].fecha), inicio) / 7) % DOBLES.semanasBloque + 1;
    for (const d of ds.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (!d.sesion) d.sesion = 'descanso';
      if (C.descarga) {
        d.semanaBloque = semanaDelBloque;
        d.descarga = semanaDelBloque === DOBLES.semanasBloque;
      } else d.descarga = false;
      if (d.sesion.startsWith('gym')) gymSeguidos++; else gymSeguidos = 0;
      dias.push(d);
    }
  }

  return { dias, avisos, gymIdxFinal: gymIdx };
}

// ─── API principal: el calendario de UN mes ───
// Devuelve el mismo shape que consumía la app (dia, sem, turno, sesion, festivo)
// más los campos nuevos (fecha, momento, franja, flexible, fijado).
export function generarMes({ anio, mes, ancla = ANCLA_DEFAULT, fijados = {}, festivos = FESTIVOS_DEFAULT, config = {}, planFijo = null }) {
  const ultimoDelMes = new Date(Date.UTC(anio, mes + 1, 0));
  // Se genera hasta el DOMINGO que cierra la semana del último día del mes.
  // Si se cortara en el día 31, la semana a caballo entre dos meses se generaría
  // distinta según qué mes pidieras (cupo a medias) y la cola de gym se saltaría
  // posiciones en cada cambio de mes.
  const finSemana = sumarDias(ultimoDelMes, (7 - ultimoDelMes.getUTCDay()) % 7);
  const { dias, avisos } = generarDesdeAncla({ hasta: aISO(finSemana), ancla, fijados, festivos, config, planFijo });
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
