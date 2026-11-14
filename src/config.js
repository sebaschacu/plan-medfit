// ═══════════════ CONFIGURACIÓN DEL PLAN ═══════════════
//
// Lo que el usuario puede cambiar desde Ajustes sin tocar el código: el cupo
// de la semana, los turnos (el ciclo y qué admite cada uno), el orden de las
// rotaciones y sus deportes propios.
//
// PRINCIPIO: la config guardada solo contiene lo que el usuario CAMBIÓ. Un
// campo ausente significa «lo del plan», que sale de data.js. Por eso un
// usuario que nunca toca Ajustes no guarda nada nuevo, y su calendario es
// exactamente el mismo que antes de que existiera esta pantalla.
//
// Forma guardada (todo opcional):
//   cupo      { gym, natacion, cardio, flexible }        números; flexible 0/1
//   ciclo     { turnos: ['L','C','N','P'], hoy: { fecha, pos } }
//   turnos    { L: { gym, cardio, natacion, doblar }, … } booleanos
//   rotacion  { gym: ['gymA', …], natacion: ['natA1', …] }
//   deportes  [{ id, nombre, color, icono, modo, porSemana, turnos, piernas,
//               duracion, nota, archivado }]

import { CUPO_SEMANAL, PRIORIDAD_TURNO, VENTANA_PISCINA, DOBLES, SECUENCIA_GYM, SECUENCIA_NATACION,
  NATACION_CSS, SESION_INFO, SESIONES } from './data.js';

export const LETRAS_TURNO = ['L', 'C', 'N', 'P'];
export const CICLO_DEFAULT = ['L', 'C', 'N', 'P'];
// Ventana de piscina para un turno que el plan no dejaba nadar (C): por la
// tarde, al salir. Solo se usa si el usuario activa la natación en ese turno.
const VENTANA_EXTRA = { desde: 17, hasta: 21, prioridad: 4 };
export const LIMITES_CUPO = { gym: [0, 6], natacion: [0, 4], cardio: [0, 3] };

// ─── Lo que el plan trae de serie, en la forma de la pantalla ───
export const turnosDelPlan = () => Object.fromEntries(LETRAS_TURNO.map(t => [t, {
  gym: (PRIORIDAD_TURNO[t] ?? []).includes('gym'),
  cardio: (PRIORIDAD_TURNO[t] ?? []).includes('cardio'),
  natacion: !!VENTANA_PISCINA[t],
  doblar: !!DOBLES.turnos[t]?.permite,
}]));
export const cupoDelPlan = () => ({
  gym: CUPO_SEMANAL.gym, natacion: CUPO_SEMANAL.natacion, cardio: CUPO_SEMANAL.running, flexible: CUPO_SEMANAL.flexible,
});

// ─── Normalizar lo leído (localStorage o un respaldo) ───
// Todo lo que no tenga la forma esperada se descarta y vale lo del plan: una
// config rota nunca puede dejar la app en blanco.
const esObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const entero = (x, [min, max]) => (Number.isInteger(x) && x >= min && x <= max ? x : undefined);

export function normalizarConfig(c) {
  if (!esObj(c)) return {};
  const out = {};
  if (esObj(c.cupo)) {
    const cupo = {};
    for (const k of ['gym', 'natacion', 'cardio']) {
      const v = entero(c.cupo[k], LIMITES_CUPO[k]);
      if (v !== undefined) cupo[k] = v;
    }
    const f = entero(c.cupo.flexible, [0, 1]);
    if (f !== undefined) cupo.flexible = f;
    if (Object.keys(cupo).length) out.cupo = cupo;
  }
  if (esObj(c.ciclo) && Array.isArray(c.ciclo.turnos)) {
    const turnos = c.ciclo.turnos.filter(t => LETRAS_TURNO.includes(t)).slice(0, 14);
    if (turnos.length) {
      const ciclo = { turnos };
      const h = c.ciclo.hoy;
      if (esObj(h) && /^\d{4}-\d{2}-\d{2}$/.test(h.fecha) && Number.isInteger(h.pos) && h.pos >= 0 && h.pos < turnos.length) {
        ciclo.hoy = { fecha: h.fecha, pos: h.pos };
      }
      out.ciclo = ciclo;
    }
  }
  if (esObj(c.turnos)) {
    const turnos = {};
    for (const t of LETRAS_TURNO) {
      if (!esObj(c.turnos[t])) continue;
      const x = {};
      for (const k of ['gym', 'cardio', 'natacion', 'doblar']) if (typeof c.turnos[t][k] === 'boolean') x[k] = c.turnos[t][k];
      if (Object.keys(x).length) turnos[t] = x;
    }
    if (Object.keys(turnos).length) out.turnos = turnos;
  }
  if (esObj(c.rotacion)) {
    const rot = {};
    const limpia = (lista, validas) => (Array.isArray(lista) ? [...new Set(lista.filter(k => validas.includes(k)))] : []);
    const g = limpia(c.rotacion.gym, SECUENCIA_GYM);
    const n = limpia(c.rotacion.natacion, SECUENCIA_NATACION);
    if (g.length) rot.gym = g;
    if (n.length) rot.natacion = n;
    if (Object.keys(rot).length) out.rotacion = rot;
  }
  if (Array.isArray(c.deportes)) {
    const vistos = new Set();
    const deportes = c.deportes.filter(d => esObj(d) && /^[a-z0-9]{1,24}$/.test(d.id ?? '') && typeof d.nombre === 'string' && d.nombre.trim())
      .filter(d => !vistos.has(d.id) && vistos.add(d.id))
      .map(d => ({
        id: d.id,
        nombre: d.nombre.trim().slice(0, 40),
        color: /^#[0-9a-f]{6}$/i.test(d.color ?? '') ? d.color : '#f472b6',
        icono: ICONOS_DEPORTE.includes(d.icono) ? d.icono : 'activity',
        modo: d.modo === 'auto' ? 'auto' : 'manual',
        porSemana: entero(d.porSemana, [1, 5]) ?? 1,
        turnos: Array.isArray(d.turnos) ? LETRAS_TURNO.filter(t => d.turnos.includes(t)) : ['L', 'P'],
        piernas: !!d.piernas,
        duracion: typeof d.duracion === 'string' ? d.duracion.slice(0, 30) : '',
        nota: typeof d.nota === 'string' ? d.nota.slice(0, 400) : '',
        archivado: !!d.archivado,
      }));
    if (deportes.length) out.deportes = deportes;
  }
  return out;
}

export const configVacia = (c) => !c || Object.keys(c).length === 0;

// ─── Deportes propios ───
// Cada deporte es una sesión más: su clave interna es `dep_<id>` y, una vez
// creada, NO cambia (de ella cuelgan su rutina y su historial). Archivarlo lo
// quita de los menús y del calendario, pero sigue registrado para que los días
// que ya se entrenaron se sigan pintando.
export const ICONOS_DEPORTE = ['activity', 'bike', 'run', 'waves', 'dumbbell', 'mountain', 'trophy', 'footprints'];
export const COLORES_DEPORTE = ['#f472b6', '#fb923c', '#facc15', '#a3e635', '#2dd4bf', '#38bdf8', '#818cf8', '#e879f9'];
export const claveDeporte = (id) => `dep_${id}`;
export const esDeporte = (k) => String(k).startsWith('dep_');

let _registrados = [];
export function registrarDeportes(deportes = []) {
  for (const k of _registrados) { delete SESION_INFO[k]; delete SESIONES[k]; }
  _registrados = [];
  for (const d of deportes ?? []) {
    const k = claveDeporte(d.id);
    SESION_INFO[k] = {
      label: d.nombre, color: d.color, icon: d.icono, grupo: 'deporte', deporte: true,
      piernas: !!d.piernas, archivado: !!d.archivado,
      tipo: d.modo === 'auto' ? `${d.porSemana} ${d.porSemana === 1 ? 'vez' : 'veces'} por semana` : 'Lo pones tú en el calendario',
    };
    SESIONES[k] = {
      nombre: d.nombre, color: d.color,
      subtitulo: d.duracion || 'Deporte propio',
      duracion: d.duracion || '',
      chequeo: d.nota || 'Deporte creado por ti. Sus ejercicios se cambian desde Rutinas, como cualquier otra sesión.',
      ejercicios: [
        { id: `${k}-1`, parte: 1, nombre: d.nombre, series: 1, reps: d.duracion || 'Sesión', rir: '—', descanso: '—',
          nota: '', musculos: { primario: [], secundario: [] } },
      ],
    };
    _registrados.push(k);
  }
}

// ─── La config efectiva, la que usa el generador ───
// Une lo guardado con lo del plan. Con config vacía devuelve exactamente las
// constantes de data.js: es lo que garantiza que nada cambie para quien no
// toque Ajustes.
export function resolverConfig(c = {}) {
  const cfg = normalizarConfig(c);
  const plan = turnosDelPlan();
  const turnos = Object.fromEntries(LETRAS_TURNO.map(t => [t, { ...plan[t], ...(cfg.turnos?.[t] ?? {}) }]));
  const cupoBase = cupoDelPlan();
  const cupo = { ...cupoBase, ...(cfg.cupo ?? {}) };

  // PRIORIDAD_TURNO, VENTANA_PISCINA y DOBLES.turnos se reconstruyen desde los
  // permisos. Si un turno conserva los del plan, se usa el objeto del plan tal
  // cual (mismo orden de prioridades, mismas ventanas y mismos textos).
  const igual = (t) => ['gym', 'cardio', 'natacion', 'doblar'].every(k => turnos[t][k] === plan[t][k]);
  const prioridad = {}; const ventana = {}; const dobles = {};
  for (const t of LETRAS_TURNO) {
    if (igual(t)) {
      prioridad[t] = PRIORIDAD_TURNO[t]; ventana[t] = VENTANA_PISCINA[t]; dobles[t] = DOBLES.turnos[t];
      continue;
    }
    prioridad[t] = [...(turnos[t].gym ? ['gym'] : []), ...(turnos[t].cardio ? ['cardio'] : []), 'descanso'];
    ventana[t] = turnos[t].natacion ? (VENTANA_PISCINA[t] ?? VENTANA_EXTRA) : null;
    dobles[t] = turnos[t].doblar
      ? { permite: true, condicional: !!DOBLES.turnos[t]?.condicional, ...(DOBLES.turnos[t]?.condicion ? { condicion: DOBLES.turnos[t].condicion } : {}) }
      : { permite: false, motivo: DOBLES.turnos[t]?.motivo ?? 'lo desactivaste en Ajustes' };
  }

  const ciclo = cfg.ciclo?.turnos ?? CICLO_DEFAULT;
  const secGym = cfg.rotacion?.gym ?? SECUENCIA_GYM;
  const secNat = cfg.rotacion?.natacion ?? SECUENCIA_NATACION;
  // El test de CSS sustituye a un Umbral; si el Umbral no está en la rotación,
  // a la primera de las que quedan.
  const cssSustituye = secNat.includes(NATACION_CSS.sustituye) ? NATACION_CSS.sustituye : secNat[0];
  const deportes = (cfg.deportes ?? []).filter(d => !d.archivado);

  return {
    personalizada: !configVacia(cfg),
    cupo: { gym: cupo.gym, natacion: cupo.natacion, running: cupo.cardio, flexible: cupo.flexible },
    turnos, prioridad, ventana, dobles,
    ciclo, cicloHoy: cfg.ciclo?.hoy ?? null,
    secGym, secNat, cssSustituye,
    // El día flexible vive en el turno que no admite nada (C en el plan). Si el
    // usuario abre ese turno a todo, el flexible sigue en C.
    turnoFlexible: 'C',
    deportesAuto: deportes.filter(d => d.modo === 'auto').map(d => ({ ...d, clave: claveDeporte(d.id) })),
  };
}

export const CONFIG_PLAN = resolverConfig({});

// ─── Avisos de la rotación de gym ───
// Dos sesiones seguidas que trabajan lo mismo no se ponen juntas: el generador
// salta la segunda. Con el orden del plan no pasa nunca; con otro orden sí,
// y conviene saberlo antes de guardar.
export function solapesDeRotacion(sec, solapan) {
  const out = [];
  if (sec.length < 2) return out;
  for (let i = 0; i < sec.length; i++) {
    const a = sec[i], b = sec[(i + 1) % sec.length];
    if (a === b) continue;
    if (solapan(a, b)) out.push([a, b]);
  }
  return out;
}

// ─── Guardar un apartado ───
// Devuelve la config con `campo` puesto a `valor`, o SIN ese campo si el valor
// es igual a lo del plan. Así «volver a lo del plan» en un apartado deja la
// config limpia y no se arrastran copias de los valores por defecto.
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function conCampo(config, campo, valor) {
  const out = { ...normalizarConfig(config) };
  let delPlan = false;
  if (campo === 'cupo') {
    const plan = cupoDelPlan();
    valor = Object.fromEntries(Object.entries(valor ?? {}).filter(([k, v]) => v !== plan[k]));
    delPlan = Object.keys(valor).length === 0;
  }
  else if (campo === 'turnos') {
    const plan = turnosDelPlan();
    const dif = {};
    for (const t of LETRAS_TURNO) {
      const x = {};
      for (const k of ['gym', 'cardio', 'natacion', 'doblar']) if (valor?.[t]?.[k] !== undefined && valor[t][k] !== plan[t][k]) x[k] = valor[t][k];
      if (Object.keys(x).length) dif[t] = x;
    }
    valor = dif;
    delPlan = Object.keys(dif).length === 0;
  } else if (campo === 'rotacion') {
    const r = {};
    if (valor?.gym && !mismo(valor.gym, SECUENCIA_GYM)) r.gym = valor.gym;
    if (valor?.natacion && !mismo(valor.natacion, SECUENCIA_NATACION)) r.natacion = valor.natacion;
    valor = r;
    delPlan = Object.keys(r).length === 0;
  } else if (campo === 'deportes') delPlan = !valor?.length;
  else if (campo === 'ciclo') delPlan = !valor;
  if (delPlan) delete out[campo]; else out[campo] = valor;
  return normalizarConfig(out);
}

// Un id para un deporte nuevo: corto, sin relación con el nombre (el nombre se
// puede cambiar; el id no, porque de él cuelgan su rutina y su historial).
export const nuevoIdDeporte = (existentes = []) => {
  let id;
  do { id = 'd' + Math.random().toString(36).slice(2, 9); } while (existentes.some(d => d.id === id));
  return id;
};
