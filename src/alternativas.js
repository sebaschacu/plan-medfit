// ═══════════════ ALTERNATIVAS DE EJERCICIO ═══════════════
//
// Cada ejercicio de gym pertenece a una FAMILIA: mismo músculo y mismo patrón,
// con otro equipo (polea, mancuernas, máquina…). Cuando la estación está
// ocupada o el gimnasio no tiene esa máquina, se cambia por otra de su familia:
//   · solo hoy  → nota del día en el registro (`__cambios`), como E11;
//   · desde ahora → una versión nueva de la rutina (rutina.js).
//
// Los kilos de una versión NO valen para otra: cada alternativa lleva su propio
// id y, con él, su propio historial y su propia sugerencia de carga.

// La familia se reconoce por el nombre: primero por igualdad con una de sus
// opciones y, si no, por un patrón que también cubre los nombres de la v6.
// Todo se compara en minúsculas y sin tildes.
export const normalizar = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

const slug = (s) => normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const FAMILIAS = [
  // ─── Pecho ───
  { clave: 'banca', patron: /^press (de )?banca/,
    opciones: ['Press de banca con barra', 'Press de banca con mancuernas', 'Press de pecho en máquina', 'Press de banca en Smith'] },
  { clave: 'inclinado', patron: /press inclinado/,
    opciones: ['Press inclinado con mancuernas 30°', 'Press inclinado con barra', 'Press inclinado en Smith', 'Press inclinado en máquina'] },
  { clave: 'aperturas', patron: /aperturas|pec deck/,
    opciones: ['Aperturas en polea', 'Aperturas con mancuernas', 'Pec deck (máquina)'] },
  { clave: 'fondos', patron: /^fondos|press cerrado/,
    opciones: ['Fondos en paralelas', 'Press cerrado con barra', 'Fondos en máquina asistida'] },
  // ─── Espalda ───
  { clave: 'jalonNeutro', patron: /jalon (con )?agarre neutro|dominada con agarre neutro/,
    opciones: ['Jalón con agarre neutro', 'Dominada con agarre neutro', 'Jalón a una mano en polea'] },
  { clave: 'jalonSupino', patron: /palmas hacia ti|supino/,
    opciones: ['Jalón con palmas hacia ti', 'Dominada con palmas hacia ti'] },
  { clave: 'dominada', patron: /dominada|jalon pesado|jalon al pecho/,
    opciones: ['Dominada', 'Dominada asistida', 'Jalón al pecho en máquina'] },
  { clave: 'remoPecho', patron: /remo con apoyo|remo en t|remo con mancuernas en banco/,
    opciones: ['Remo con apoyo en pecho', 'Remo en T con apoyo', 'Remo con mancuernas en banco inclinado', 'Remo sentado en polea, codos abiertos'] },
  { clave: 'remoUnaMano', patron: /remo a una mano|agarre estrecho/,
    opciones: ['Remo a una mano con mancuerna', 'Remo a una mano en polea baja', 'Remo sentado en polea, agarre estrecho'] },
  { clave: 'pullover', patron: /pullover/,
    opciones: ['Pullover en polea alta', 'Pullover con mancuerna', 'Pullover en máquina'] },
  { clave: 'encogimiento', patron: /encogimiento/,
    opciones: ['Encogimientos con mancuernas', 'Encogimientos con barra', 'Encogimientos en Smith', 'Encogimientos con trap bar'] },
  { clave: 'lumbar', patron: /hiperextension|extension lumbar|buenos dias/,
    opciones: ['Hiperextensión 45°', 'Extensión lumbar en máquina', 'Buenos días con barra ligera'] },
  // ─── Hombro ───
  { clave: 'militar', patron: /press militar|press de hombro/,
    opciones: ['Press militar sentado con mancuernas', 'Press militar de pie con barra', 'Press de hombro en máquina', 'Press militar en Smith'] },
  { clave: 'lateral', patron: /elevacion lateral/,
    opciones: ['Elevación lateral en polea', 'Elevación lateral con mancuernas', 'Elevación lateral en máquina', 'Elevación lateral con banda'] },
  // El face pull no se quita nunca (E6): sus alternativas son face pull.
  { clave: 'facePull', patron: /face pull/,
    opciones: ['Face pull en polea', 'Face pull con banda'] },
  { clave: 'pajaro', patron: /pajaro/,
    opciones: ['Pájaro en máquina', 'Pájaro con mancuernas', 'Pájaro en polea', 'Pájaro con banda'] },
  { clave: 'rotacionExterna', patron: /rotacion externa/,
    opciones: ['Rotación externa en polea', 'Rotación externa con banda', 'Rotación externa con mancuerna, de lado'] },
  // ─── Brazos ───
  { clave: 'curlEstirado', patron: /curl inclinado|detras del cuerpo|bayesiano/,
    opciones: ['Curl inclinado con mancuernas', 'Curl en polea por detrás del cuerpo'] },
  { clave: 'predicador', patron: /predicador|curl arana/,
    opciones: ['Curl predicador con barra Z', 'Curl predicador con mancuerna', 'Curl predicador en máquina', 'Curl araña en banco inclinado'] },
  { clave: 'martillo', patron: /martillo|curl cruzado/,
    opciones: ['Curl martillo con mancuernas', 'Curl martillo con cuerda en polea', 'Curl cruzado por delante del cuerpo'] },
  { clave: 'curlInverso', patron: /curl inverso/,
    opciones: ['Curl inverso con barra Z', 'Curl inverso con mancuernas', 'Curl inverso en polea'] },
  { clave: 'muneca', patron: /curl de muneca|enrollador/,
    opciones: ['Curl de muñeca con barra', 'Curl de muñeca con mancuernas', 'Enrollador de muñeca'] },
  { clave: 'tricepsCabeza', patron: /sobre la cabeza|overhead|press frances/,
    opciones: ['Tríceps sobre la cabeza en polea', 'Tríceps sobre la cabeza con mancuerna', 'Press francés con barra Z en banco inclinado'] },
  { clave: 'tricepsPolea', patron: /triceps.*polea|fondos entre bancos/,
    opciones: ['Tríceps en polea con barra', 'Tríceps en polea con cuerda', 'Tríceps en polea a una mano', 'Fondos entre bancos'] },
  // ─── Pierna ───
  { clave: 'sentadilla', patron: /^sentadilla (trasera|con barra|hack|frontal|en smith)/,
    opciones: ['Sentadilla trasera con barra', 'Sentadilla hack (máquina)', 'Sentadilla en Smith', 'Sentadilla frontal'] },
  { clave: 'rumano', patron: /rumano/,
    opciones: ['Peso muerto rumano con barra', 'Peso muerto rumano con mancuernas', 'Peso muerto rumano con trap bar', 'Peso muerto rumano en Smith'] },
  { clave: 'prensa', patron: /prensa/,
    opciones: ['Prensa 45°', 'Prensa horizontal'] },
  { clave: 'extensionCuadriceps', patron: /extension de cuadriceps|sissy|tobilleras/,
    opciones: ['Extensión de cuádriceps', 'Sissy squat', 'Extensión con tobilleras en banco'] },
  { clave: 'curlFemoral', patron: /curl femoral|nordico/,
    opciones: ['Curl femoral sentado', 'Curl femoral tumbado', 'Nórdico con apoyo'] },
  { clave: 'hipThrust', patron: /hip thrust/,
    opciones: ['Hip thrust con barra', 'Hip thrust en máquina', 'Hip thrust en Smith', 'Hip thrust con mancuerna'] },
  { clave: 'unilateral', patron: /bulgara|zancada|step-up/,
    opciones: ['Búlgara con mancuernas', 'Zancada atrás con mancuernas', 'Step-up alto', 'Búlgara en Smith'] },
  { clave: 'gemeloPie', patron: /gemelo (de pie|en prensa|en smith|a una pierna)/,
    opciones: ['Gemelo de pie en máquina', 'Gemelo en prensa', 'Gemelo en Smith sobre escalón', 'Gemelo a una pierna con mancuerna'] },
  { clave: 'gemeloSentado', patron: /gemelo sentado/,
    opciones: ['Gemelo sentado en máquina', 'Gemelo sentado con disco sobre las rodillas'] },
  { clave: 'aductor', patron: /aductor|copenhague|sumo/,
    opciones: ['Aductor en máquina', 'Aductor en polea con tobillera', 'Plancha Copenhague', 'Sentadilla sumo'] },
  { clave: 'abductor', patron: /abductor/,
    opciones: ['Abductor en máquina', 'Abductor en polea con tobillera', 'Abductor con banda'] },
  { clave: 'tibial', patron: /tibial/,
    opciones: ['Tibial contra la pared', 'Tibial con banda', 'Tibial en máquina'] },
  // ─── Core ───
  { clave: 'antiExtension', patron: /rueda abdominal|crunch en polea|plancha con alcance/,
    opciones: ['Rueda abdominal', 'Crunch en polea', 'Plancha con alcance'] },
  { clave: 'pallof', patron: /pallof/,
    opciones: ['Pallof press en polea', 'Pallof press con banda'] },
  { clave: 'piernasColgado', patron: /elevacion de piernas|crunch inverso/,
    opciones: ['Elevación de piernas colgado', 'Elevación de piernas en paralelas', 'Crunch inverso en banco'] },
  { clave: 'cuello', patron: /cuello/,
    opciones: ['Cuello con banda', 'Cuello con disco, tumbado en banco'] },
  // ─── Agarre y carga ───
  { clave: 'suitcase', patron: /suitcase/,
    opciones: ['Suitcase carry con mancuerna', 'Suitcase carry con kettlebell', 'Suitcase carry con barra'] },
  { clave: 'farmer', patron: /farmer/,
    opciones: ["Farmer's walk con mancuernas", "Farmer's walk con trap bar", "Farmer's walk con kettlebells"] },
  { clave: 'deadHang', patron: /dead hang/,
    opciones: ['Dead hang', 'Dead hang con toalla', 'Dead hang a una mano'] },
  { clave: 'pinza', patron: /pinza/,
    opciones: ['Pinza de discos', 'Pinza con mancuerna hexagonal'] },
  { clave: 'cargaFrontal', patron: /carga frontal|carga real/,
    opciones: ['Carga frontal con saco de arena', 'Carga frontal con disco', 'Carga frontal con mancuerna', 'Carga frontal con kettlebell'] },
  { clave: 'bearHug', patron: /bear hug/,
    opciones: ['Complejo bear hug con saco de arena', 'Complejo bear hug con disco', 'Complejo bear hug con mancuerna'] },
  // ─── Bloque atlético ───
  { clave: 'saltoVertical', patron: /saltos? al cajon|saltos? vertical/,
    opciones: ['Saltos al cajón', 'Saltos verticales', 'Salto a un banco estable'] },
  { clave: 'saltoHorizontal', patron: /salto horizontal|saltos en cuclillas/,
    opciones: ['Salto horizontal', 'Saltos en cuclillas'] },
  { clave: 'lanzamientoPecho', patron: /balon (medicinal )?al pecho|flexiones explosivas/,
    opciones: ['Lanzamiento de balón al pecho', 'Flexiones explosivas'] },
  { clave: 'lanzamientoRotacional', patron: /rotacional|lenador/,
    opciones: ['Lanzamiento rotacional de balón', 'Leñador explosivo en polea'] },
  { clave: 'sprints', patron: /sprints?/,
    opciones: ['Sprints en bicicleta', 'Sprints en remo', 'Sprints en assault bike'] },
];

// Familia de un ejercicio, o null si no tiene alternativas (natación, running,
// calistenia, un ejercicio creado a mano que no se parece a nada…).
export function familiaDeEjercicio(ex) {
  const n = normalizar(ex?.alt?.nombre0 ?? ex?.nombre);
  if (!n) return null;
  return FAMILIAS.find(f => f.opciones.some(o => normalizar(o) === n))
    ?? FAMILIAS.find(f => f.patron.test(n))
    ?? null;
}

// El ejercicio convertido en otra opción de su familia. Conserva series, reps,
// RIR, descanso, bi-serie y músculos; cambian el nombre y el id. Elegir el
// nombre del plan devuelve el ejercicio original con su id (y su historial).
export function alternativa(ex, nombre) {
  const raiz = ex.alt?.de ?? ex.id;
  const nombre0 = ex.alt?.nombre0 ?? ex.nombre;
  const nota0 = ex.alt ? ex.alt.nota0 : ex.nota;
  const { alt: _alt, cambioHoy: _hoy, ...resto } = ex;
  if (normalizar(nombre) === normalizar(nombre0)) {
    const original = { ...resto, id: raiz, nombre: nombre0 };
    if (nota0 !== undefined) original.nota = nota0; else delete original.nota;
    return original;
  }
  const nuevo = {
    ...resto,
    id: `${raiz}~${slug(nombre)}`,
    nombre,
    nota: `En lugar de ${nombre0}. Los kilos no se comparan: empieza con una carga que te deje en el RIR de siempre.`,
    alt: { de: raiz, nombre0, ...(nota0 !== undefined ? { nota0 } : {}) },
  };
  // El lastre y la banda de asistencia son de la dominada o los fondos.
  if (!/dominada|fondos/.test(normalizar(nombre))) { delete nuevo.lastre; delete nuevo.banda; }
  return nuevo;
}

// Las opciones que se ofrecen para un ejercicio, sin repetidas: primero el del
// plan, luego el de la rutina si se cambió para siempre, luego la familia.
export function opcionesDe(ex) {
  const f = familiaDeEjercicio(ex);
  if (!f) return [];
  const plan = ex.alt?.nombre0 ?? ex.nombre;
  const vistos = new Set();
  return [plan, ex.nombre, ...f.opciones].filter(n => {
    const k = normalizar(n);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// ─── Cambios de un solo día ───
// Se guardan en el registro del día como { idEnLaRutina: nombreElegido }.
export const CLAVE_CAMBIOS = '__cambios';

export function aplicarCambios(ejercicios, progresoDia) {
  const cambios = progresoDia?.[CLAVE_CAMBIOS];
  if (!ejercicios || !cambios || typeof cambios !== 'object') return ejercicios;
  return ejercicios.map(ex => {
    const nombre = cambios[ex.id];
    // Solo vale un nombre de su familia: un registro importado o editado a mano
    // no puede convertir unas laterales en una sentadilla.
    if (typeof nombre !== 'string' || !opcionesDe(ex).some(o => normalizar(o) === normalizar(nombre))) return ex;
    const nuevo = alternativa(ex, nombre);
    return nuevo.id === ex.id ? ex : { ...nuevo, cambioHoy: ex.id };
  });
}
