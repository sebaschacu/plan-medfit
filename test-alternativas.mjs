// ══ Banco de pruebas de las alternativas de ejercicio ══
//
// Cada ejercicio de gym se puede cambiar por otro de su familia (mismo músculo,
// otro equipo): solo hoy (nota del día en `__cambios`) o desde ahora (versión
// nueva de la rutina). Cada alternativa lleva su propio id → su propio historial.
import { SESIONES } from './src/data.js';
import { FAMILIAS, familiaDeEjercicio, alternativa, opcionesDe, aplicarCambios, normalizar, CLAVE_CAMBIOS } from './src/alternativas.js';
import { ejerciciosDelDia, guardarVersion, resolverRutina } from './src/rutina.js';
import { sugerirCarga, ultimaSesion } from './src/reglas.js';

let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};
const seccion = (t) => console.log(`\n── ${t} ──`);
const ej = (ses, re) => SESIONES[ses].ejercicios.find(e => re.test(e.nombre));

// ═══ 1 · EL CATÁLOGO ═══
seccion('EL CATÁLOGO');
check('Cada familia tiene al menos 2 opciones', FAMILIAS.every(f => f.opciones.length >= 2));
const todas = FAMILIAS.flatMap(f => f.opciones.map(normalizar));
check('Ninguna opción está repetida entre familias', new Set(todas).size === todas.length,
  todas.filter((x, i) => todas.indexOf(x) !== i).join(', '));
check('Cada opción se reconoce en su propia familia',
  FAMILIAS.every(f => f.opciones.every(o => familiaDeEjercicio({ nombre: o }) === f)));
const gym = Object.entries(SESIONES).filter(([k]) => k.startsWith('gym')).flatMap(([, s]) => s.ejercicios);
const sinFamilia = gym.filter(e => !familiaDeEjercicio(e)).map(e => e.nombre);
check('Todo ejercicio de gym tiene alternativas salvo Zercher y escaleras cargando',
  sinFamilia.every(n => /zercher|escaleras/i.test(n)), sinFamilia.join(', '));
check('El face pull solo se cambia por otro face pull (E6)',
  FAMILIAS.find(f => f.clave === 'facePull').opciones.every(o => /face pull/i.test(o)));
check('«Pájaro o face pull» cuenta como face pull', familiaDeEjercicio({ nombre: 'Pájaro o face pull' })?.clave === 'facePull');
check('Lo que no es de gym no tiene familia', !familiaDeEjercicio({ nombre: 'Rodaje suave' }) && !familiaDeEjercicio({ nombre: '' }));
check('Mayúsculas y tildes no importan', familiaDeEjercicio({ nombre: 'ELEVACION LATERAL CON MANCUERNAS' })?.clave === 'lateral');

// ═══ 2 · CAMBIAR UN EJERCICIO ═══
seccion('CAMBIAR UN EJERCICIO');
const lat = ej('gymA', /lateral en polea/i);
const latM = alternativa(lat, 'Elevación lateral con mancuernas');
check('La alternativa tiene otro nombre y otro id', latM.nombre === 'Elevación lateral con mancuernas' && latM.id === `${lat.id}~elevacion-lateral-con-mancuernas`);
check('Conserva series, reps, RIR, descanso, bi-serie y músculos',
  ['series', 'reps', 'rir', 'descanso', 'bs', 'parte'].every(k => latM[k] === lat[k]) && JSON.stringify(latM.musculos) === JSON.stringify(lat.musculos));
check('Su nota avisa de que los kilos no se comparan', /kilos no se comparan/.test(latM.nota));
check('Volver al del plan devuelve el ejercicio original, con su id y su nota',
  JSON.stringify(alternativa(latM, lat.nombre)) === JSON.stringify(lat));
const latMaq = alternativa(latM, 'Elevación lateral en máquina');
check('Cambiar una alternativa por otra no encadena ids', latMaq.id === `${lat.id}~elevacion-lateral-en-maquina` && latMaq.alt.de === lat.id);
check('Las opciones empiezan por la del plan y no se repiten', (() => {
  const o = opcionesDe(latM); return o[0] === lat.nombre && new Set(o.map(normalizar)).size === o.length;
})());

const dom = ej('gymB', /jal[oó]n pesado|dominada/i);
check('El lastre se queda si la alternativa es dominada', alternativa(dom, 'Dominada asistida').lastre === dom.lastre);
check('Y se quita si es un jalón en máquina', alternativa(dom, 'Jalón al pecho en máquina').lastre === undefined);
const martillo = ej('gymB', /martillo/i);
check('El isométrico final se conserva en la alternativa', !martillo.iso || alternativa(martillo, 'Curl martillo con cuerda en polea').iso === martillo.iso);

// ═══ 3 · SOLO HOY ═══
seccion('SOLO HOY');
const fecha = '2026-12-02';
const base = resolverRutina('gymA', fecha, {});
const dia = { [CLAVE_CAMBIOS]: { [lat.id]: 'Elevación lateral con mancuernas' } };
const hoy = ejerciciosDelDia('gymA', fecha, {}, dia);
const cambiado = hoy.find(e => e.cambioHoy === lat.id);
check('El cambio de hoy reemplaza al ejercicio en su sitio', hoy.length === base.length && hoy.indexOf(cambiado) === base.findIndex(e => e.id === lat.id));
check('Y marca de qué ejercicio de la rutina viene', cambiado?.nombre === 'Elevación lateral con mancuernas');
check('El resto de la sesión no cambia', hoy.filter(e => !e.cambioHoy).every(e => base.includes(e)));
check('Otro día sin cambios ve la rutina de siempre', ejerciciosDelDia('gymA', '2026-12-06', {}, {}) .every((e, i) => e === base[i]));
check('Un cambio a un nombre que no es de su familia se ignora sin romper nada', (() => {
  const r = aplicarCambios(base, { [CLAVE_CAMBIOS]: { [lat.id]: 'Sentadilla frontal' } });
  return r.length === base.length && r.every((e, i) => e === base[i]);
})());
check('Sin registro del día, la lista es la misma', aplicarCambios(base, undefined) === base);

// Historial propio: los kilos de la mancuerna no se mezclan con los de la polea.
const prog = {
  '2026-11-20': { [lat.id]: { sets: [true, true, true], logs: [{ kg: 10, reps: 15 }, { kg: 10, reps: 14 }, { kg: 10, reps: 12 }] } },
};
check('La alternativa empieza sin historial', ultimaSesion(prog, cambiado.id, fecha) == null);
check('Y su sugerencia no hereda los kilos de la polea', sugerirCarga(cambiado, prog, { hasta: fecha })?.kg == null);
check('El original conserva su historial', ultimaSesion(prog, lat.id, fecha) != null);

// ═══ 4 · DESDE AHORA ═══
seccion('DESDE AHORA');
const nueva = base.map(e => (e.id === lat.id ? alternativa(e, 'Elevación lateral con mancuernas') : e));
const rutina = guardarVersion({}, 'gymA', nueva, '2026-12-02', 'Cambio');
check('Desde ese día la rutina trae la alternativa', resolverRutina('gymA', '2026-12-10', rutina).some(e => e.nombre === 'Elevación lateral con mancuernas'));
check('Los días anteriores siguen con la de antes', resolverRutina('gymA', '2026-11-30', rutina).some(e => e.id === lat.id));
const enRut = resolverRutina('gymA', '2026-12-10', rutina).find(e => e.alt);
check('Desde la rutina cambiada se puede volver a la del plan', alternativa(enRut, lat.nombre).id === lat.id);
check('Y cambiarla solo hoy por una tercera', (() => {
  const d = ejerciciosDelDia('gymA', '2026-12-10', rutina, { [CLAVE_CAMBIOS]: { [enRut.id]: 'Elevación lateral en máquina' } });
  const x = d.find(e => e.cambioHoy === enRut.id);
  return x?.nombre === 'Elevación lateral en máquina' && x.alt.nombre0 === lat.nombre;
})());

console.log(`\n══ TOTAL ALTERNATIVAS: ${pruebas - fallos}/${pruebas} ══`);
if (fallos) process.exit(1);
