// ══ Banco de pruebas del plan v7 · Bogotá ══
//
// Desde el lunes 30 de noviembre de 2026 rige el plan de Bogotá: 4 gym + 2
// cardio (bici) por semana, rutina Torso / Pierna por defecto (las cinco de
// siempre guardadas como opción B), sin S3, sin descargas fijas y sin horario
// de piscina. Lo anterior al 30 no cambia.
import * as G from './src/generador.js';
import { SESIONES, SESION_INFO, PLAN_BOGOTA, SECUENCIA_TORSO_PIERNA, SECUENCIA_GYM, SECUENCIA_BICI, GYM_PIERNA,
  gymOfrecido, VARIANTES_DE, MUSCULOS } from './src/data.js';
import { SESIONES_V6 } from './src/planV6.js';
import { resolverConfig, conCampo, normalizarConfig } from './src/config.js';
import { resolverRutina, guardarVersion, planBase } from './src/rutina.js';
import { sugerirCarga, S4 } from './src/reglas.js';
import { verificarSesion } from './src/validador.js';
import { familiaDeEjercicio } from './src/alternativas.js';

let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};
const seccion = (t) => console.log(`\n── ${t} ──`);
const DESDE = PLAN_BOGOTA.desde;
const HASTA = '2027-05-30';
const { dias, avisos } = G.generarDesdeAncla({ hasta: HASTA });
const bog = dias.filter(d => d.fecha >= DESDE);
const claves = (d) => [d.sesion, d.sesionSecundaria].filter(Boolean);
const semanas = (ds) => {
  const w = {};
  for (const d of ds) { const k = Math.floor((Date.parse(d.fecha) - Date.parse(DESDE)) / 6048e5); (w[k] ??= []).push(d); }
  return Object.values(w).filter(s => s.length === 7);
};
const esGym = (k) => k.startsWith('gym');
const esCardio = (k) => k === 'ciclismo' || k === 'running';

// ═══ 1 · EL PASADO NO CAMBIA ═══
seccion('EL PASADO NO CAMBIA');
const soloV6 = G.generarDesdeAncla({ hasta: HASTA, planFijo: 'v6' }).dias;
const antes = (ds) => JSON.stringify(ds.filter(d => d.fecha < DESDE));
check('Todo lo anterior al 30 de noviembre es exactamente el plan v6', antes(dias) === antes(soloV6));
check('El plan de Bogotá empieza un lunes', new Date(DESDE + 'T12:00:00Z').getUTCDay() === 1);

// ═══ 2 · LA SEMANA DE BOGOTÁ ═══
seccion('LA SEMANA DE BOGOTÁ');
const ws = semanas(bog);
const por = (pred) => ws.map(w => w.flatMap(claves).filter(pred).length);
check(`4 gym en cada semana (${ws.length} semanas)`, por(esGym).every(n => n === 4), por(esGym).join(','));
check('2 cardios en cada semana', por(esCardio).every(n => n === 2), por(esCardio).join(','));
check('El cardio de Bogotá es bici', bog.flatMap(claves).filter(esCardio).every(k => k === 'ciclismo'));
check('Sin natación automática (es opcional)', !bog.some(d => claves(d).includes('natacion')));
check('La 5.ª (brazos y hombros) nunca entra sola', !bog.some(d => claves(d).includes('gymE')));
check('Sin semanas de descarga fijas (P4 quitada)', bog.every(d => !d.descarga));

const gyms = bog.flatMap(claves).filter(esGym);
check('La cola empieza por Torso A', gyms[0] === 'gymTA', gyms[0]);
check('Torso A → Pierna A → Torso B → Pierna B, sin saltos', gyms.every((g, i) => g === SECUENCIA_TORSO_PIERNA[i % 4]), gyms.slice(0, 10).join(' '));
check('Solo sesiones de la opción A', gyms.every(g => SECUENCIA_TORSO_PIERNA.includes(g)));

// S1 y S7 siguen valiendo
let racha = 0, maxRacha = 0;
for (const d of dias) { racha = claves(d).some(esGym) ? racha + 1 : 0; maxRacha = Math.max(maxRacha, racha); }
check('S1 · nunca más de 4 días de gym seguidos', maxRacha <= 4, String(maxRacha));
const piernas = dias.filter(d => claves(d).some(k => GYM_PIERNA.includes(k))).map(d => d.fecha);
const huecos = piernas.slice(1).map((f, i) => (Date.parse(f) - Date.parse(piernas[i])) / 864e5);
check('S7 · entre dos días de pierna, al menos un día en medio', huecos.every(h => h >= 2), String(Math.min(...huecos)));

// Bici: zona 2 y 4×4 alternadas
const bicis = bog.flatMap(d => [d.sesion === 'ciclismo' ? d.variante : null, d.sesionSecundaria === 'ciclismo' ? d.varianteSecundaria : null]).filter(Boolean);
check('Cada bici lleva variante: zona 2 o 4×4', bicis.length > 0 && bicis.every(v => VARIANTES_DE.ciclismo.includes(v)));
check('Empieza por zona 2 (la altura, primero suave)', bicis[0] === 'biciZ2');
check('Y alternan sin saltos', bicis.every((v, i) => v === SECUENCIA_BICI[i % 2]));
const biciAntes = dias.filter(d => d.fecha < DESDE && claves(d).includes('ciclismo'));
check('Las bicis de antes del 30 conservan la sesión de siempre', biciAntes.every(d => !d.variante && !d.varianteSecundaria));

// Dobles: pierna + bici el mismo día ya vale
check('Pierna + bici el mismo día es válido en Bogotá', G.combinacionValida('gymPA', 'ciclismo', { s3: false }).ok);
check('En el plan v6 seguía prohibido (S3)', !G.combinacionValida('gymC1', 'ciclismo').ok);
const dobles = bog.filter(d => d.sesionSecundaria);
check('Los dobles respetan D1 (máximo 2 por semana)', ws.every(w => w.filter(d => d.sesionSecundaria).length <= 2));
check(`Lo que no cabe se dobla: gym + bici (${dobles.length} días)`, dobles.every(d => esGym(d.sesion) && d.sesionSecundaria === 'ciclismo'));
check('Ningún aviso de algo que se quede sin sitio', !avisos.some(a => a.fecha >= DESDE && /sin_hueco|limite_dobles/.test(a.tipo)), avisos.filter(a => a.fecha >= DESDE).map(a => a.tipo).join(','));

// Bici fijada a mano
const unaBici = bog.find(d => d.sesion === 'ciclismo' && !d.sesionSecundaria);
const otra = unaBici.variante === 'biciZ2' ? 'bici4x4' : 'biciZ2';
const conFij = G.generarDesdeAncla({ hasta: HASTA, fijados: { [unaBici.fecha]: { turno: unaBici.turno, sesion: 'ciclismo', variante: otra } } }).dias;
check('Una bici fijada con su variante se respeta', conFij.find(d => d.fecha === unaBici.fecha).variante === otra);

// Natación añadida a mano: sin horario de Barranquilla
const conNat = G.generarDesdeAncla({ hasta: HASTA, fijados: { [unaBici.fecha]: { turno: unaBici.turno, sesion: 'natacion' } } }).dias.find(d => d.fecha === unaBici.fecha);
check('Una natación en Bogotá no trae la hora de la piscina de Barranquilla', conNat.franja == null || conNat.franja.hora == null, JSON.stringify(conNat.franja));
check('Y sí su variante de la rotación', VARIANTES_DE.natacion.includes(conNat.variante));

// ═══ 3 · OPCIÓN B ═══
seccion('OPCIÓN B · LAS CINCO DE SIEMPRE');
const conB = G.generarDesdeAncla({ hasta: HASTA, config: { rutinaGym: 'B' } }).dias.filter(d => d.fecha >= DESDE);
const gymsB = conB.flatMap(claves).filter(esGym);
const sigue = (lista, sec) => lista.every((g, i) => i === 0 || sec.indexOf(g) === (sec.indexOf(lista[i - 1]) + 1) % sec.length);
check('Con la opción B, la cola de siempre (Empuje → Pierna fuerza → Torso → Pierna volumen → Tracción) sin saltos', gymsB.every(g => SECUENCIA_GYM.includes(g)) && sigue(gymsB, SECUENCIA_GYM), gymsB.slice(0, 6).join(' '));
const v6fin = dias.filter(d => d.fecha < DESDE).flatMap(claves).filter(esGym).at(-1);
check('Y sigue donde iba en noviembre: misma cola, no vuelve a empezar', SECUENCIA_GYM.indexOf(gymsB[0]) === (SECUENCIA_GYM.indexOf(v6fin) + 1) % 5, `${v6fin} → ${gymsB[0]}`);
check('También 4 gym por semana', semanas(conB).every(w => w.flatMap(claves).filter(esGym).length === 4));
check('Elegir A no guarda nada; elegir B sí', JSON.stringify(conCampo({}, 'rutinaGym', 'A')) === '{}' && JSON.stringify(conCampo({}, 'rutinaGym', 'B')) === '{"rutinaGym":"B"}');
check('Al cambiar de opción, un orden propio de la otra deja de valer',
  JSON.stringify(conCampo({ rutinaGym: 'B', rotacion: { gym: ['gymA', 'gymB'] } }, 'rutinaGym', 'A')) === '{}');
check('Una cola guardada no mezcla opciones', JSON.stringify(normalizarConfig({ rotacion: { gym: ['gymTA', 'gymA', 'gymPA'] } }).rotacion.gym) === '["gymTA","gymPA"]');
check('Los menús ofrecen la rutina activa y la 5.ª', gymOfrecido('gymTA', '2026-12-02') && gymOfrecido('gymE', '2026-12-02') && !gymOfrecido('gymA', '2026-12-02'));
check('Con la B, sus cinco', gymOfrecido('gymA', '2026-12-02', 'B') && !gymOfrecido('gymTA', '2026-12-02', 'B'));
check('Y un día de agosto, las del v6', gymOfrecido('gymA', '2026-08-10') && !gymOfrecido('gymTA', '2026-08-10'));
check('Ajustes guarda el cupo frente al plan de Bogotá', JSON.stringify(conCampo({}, 'cupo', { gym: 4, natacion: 0, cardio: 2, flexible: 1 })) === '{}');
check('Un cupo propio no toca las semanas del v6', resolverConfig({ cupo: { gym: 5 } }, { ...PLAN_BOGOTA, version: 'v6', cupo: { gym: 3, natacion: 2, running: 1, flexible: 1 } }).cupo.gym === 3);

// ═══ 4 · LAS SESIONES ═══
seccion('LAS SESIONES');
const A = ['gymTA', 'gymPA', 'gymTB', 'gymPB', 'gymE'];
const B = SECUENCIA_GYM;
check('Las cinco de la opción A existen con nombre y chequeo', A.every(k => SESIONES[k]?.ejercicios.length && SESION_INFO[k]?.label && SESIONES[k].chequeo));
check('Las diez pasan el verificador sin hallazgos duros', [...A, ...B].every(k => verificarSesion(k, SESIONES[k].ejercicios).duras.length === 0),
  [...A, ...B].flatMap(k => verificarSesion(k, SESIONES[k].ejercicios).duras.map(d => `${k}:${d.regla}`)).join(' '));
const ids = Object.values(SESIONES).flatMap(s => s.ejercicios.map(e => e.id));
check('Ningún id de ejercicio se repite', new Set(ids).size === ids.length);
check('Ningún básico es lineal: doble progresión (P1)', [...A, ...B].every(k => SESIONES[k].ejercicios.every(e => !e.lineal)));
check('Los ejercicios que siguen conservan su id (el historial continúa)',
  ['A-1', 'A-2', 'A-3', 'A-4', 'C1-1', 'D-2', 'D-9', 'C2-2', 'B-1', 'B-8'].every(id => [...B].some(k => SESIONES[k].ejercicios.some(e => e.id === id))));
check('Todo ejercicio con equipo tiene alternativas', [...A, ...B].every(k => SESIONES[k].ejercicios.every(e => familiaDeEjercicio(e) || /escaleras/i.test(e.nombre))),
  [...A, ...B].flatMap(k => SESIONES[k].ejercicios.filter(e => !familiaDeEjercicio(e) && !/escaleras/i.test(e.nombre)).map(e => e.nombre)).join(', '));
check('Nada se llama «novia»: la carga es neutra', !JSON.stringify(SESIONES).match(/novia|pégala|ella colabora/i));
check('«Carga frontal» sustituye a la práctica de carga real', !JSON.stringify(SESIONES).includes('Práctica de carga real') && JSON.stringify(SESIONES).includes('Carga frontal'));
check('Gemelos: 5 series en cada día de pierna', SESIONES.gymPA.ejercicios.find(e => /gemelo de pie/i.test(e.nombre)).series === 5
  && SESIONES.gymPB.ejercicios.find(e => /gemelo sentado/i.test(e.nombre)).series === 5);
check('El dead hang sigue en Torso A', SESIONES.gymTA.ejercicios.some(e => /dead hang/i.test(e.nombre)));
check('El face pull está en Torso A, Empuje y Tracción (E6)', ['gymTA', 'gymA', 'gymB'].every(k => SESIONES[k].ejercicios.some(e => /face pull/i.test(e.nombre))));
check('Prensa, hip thrust y press inclinado siguen dentro', ['Prensa', 'Hip thrust', 'Press inclinado'].every(n => A.some(k => SESIONES[k].ejercicios.some(e => e.nombre.startsWith(n)))));
check('Un solo acarreo por sesión (E9)', [...A, ...B].every(k => SESIONES[k].ejercicios.filter(e => e.acarreo).length <= 1));

// Volumen semanal de la opción A (4 sesiones): series directas por músculo
const directas = (keys) => {
  const v = {};
  for (const k of keys) for (const e of SESIONES[k].ejercicios) for (const m of e.musculos.primario) v[m] = (v[m] ?? 0) + e.series;
  return v;
};
const v4 = directas(SECUENCIA_TORSO_PIERNA);
const objetivo = { pecho: 13, dorsal: 12, deltoides_medio: 11, deltoides_posterior: 9, biceps: 12, triceps: 12, cuadriceps: 16, isquios: 12, gluteo: 12, trapecio: 7, antebrazo: 8 };
for (const [m, min] of Object.entries(objetivo)) check(`${MUSCULOS[m].label}: ${v4[m] ?? 0} series directas por semana (≥ ${min})`, (v4[m] ?? 0) >= min);
check('Gemelo + sóleo: 10 series directas por semana', (v4.gemelo ?? 0) + (v4.soleo ?? 0) === 10, `${v4.gemelo}+${v4.soleo}`);
const todos = ['pecho', 'deltoides_anterior', 'deltoides_medio', 'deltoides_posterior', 'triceps', 'biceps', 'braquial', 'antebrazo', 'dorsal', 'espalda_media',
  'trapecio', 'manguito', 'cuadriceps', 'isquios', 'gluteo', 'gluteo_medio', 'aductores', 'gemelo', 'soleo', 'tibial', 'erectores',
  'core_antiextension', 'core_antirotacion', 'core_antilateral', 'cuello'];
const v5 = directas([...SECUENCIA_TORSO_PIERNA, 'gymE']);
const conSec = (keys) => { const s = new Set(); for (const k of keys) for (const e of SESIONES[k].ejercicios) [...e.musculos.primario, ...e.musculos.secundario].forEach(m => s.add(m)); return s; };
check('Ningún músculo queda sin trabajo en la semana (con la 5.ª, todos con series directas o de apoyo)',
  todos.every(m => conSec([...SECUENCIA_TORSO_PIERNA, 'gymE']).has(m)), todos.filter(m => !conSec([...SECUENCIA_TORSO_PIERNA, 'gymE']).has(m)).join(','));
check('Con la 5.ª, brazos y hombros suben', v5.biceps > v4.biceps && v5.triceps > v4.triceps && v5.deltoides_medio > v4.deltoides_medio && v5.deltoides_posterior > v4.deltoides_posterior);

// ═══ 5 · LA RUTINA POR FECHA ═══
seccion('LA RUTINA POR FECHA');
check('Un día de agosto enseña la sesión del v6', resolverRutina('gymA', '2026-08-10', {}) === SESIONES_V6.gymA.ejercicios);
check('Un día de diciembre, la del v7', resolverRutina('gymA', '2026-12-10', {}) === SESIONES.gymA.ejercicios);
check('Las sesiones nuevas no tienen versión v6', planBase('gymTA', '2026-08-10') === SESIONES.gymTA.ejercicios);
const editadaOct = guardarVersion({}, 'gymA', SESIONES_V6.gymA.ejercicios.slice(0, 5), '2026-10-01', 'test');
check('Una edición de octubre vale en noviembre', resolverRutina('gymA', '2026-11-20', editadaOct).length === 5);
check('Pero el plan de Bogotá la pisa desde el 30', resolverRutina('gymA', '2026-12-02', editadaOct) === SESIONES.gymA.ejercicios);
const editadaDic = guardarVersion(editadaOct, 'gymA', SESIONES.gymA.ejercicios.slice(0, 4), '2026-12-05', 'test');
check('Y una edición hecha en Bogotá vale desde su día', resolverRutina('gymA', '2026-12-06', editadaDic).length === 4 && resolverRutina('gymA', '2026-12-03', editadaDic) === SESIONES.gymA.ejercicios);

// ═══ 6 · PROGRESIÓN Y SUEÑO ═══
seccion('PROGRESIÓN Y SUEÑO');
const banca = SESIONES.gymTA.ejercicios[0];
const dia = (reps, kg = 60) => ({ sets: reps.map(() => true), logs: reps.map(r => ({ kg, reps: r })) });
check('Doble progresión: con una serie por debajo del tope, mismo peso', sugerirCarga(banca, { '2026-12-01': { [banca.id]: dia([8, 8, 6]) } }).tipo === 'mantener');
const sube = sugerirCarga(banca, { '2026-12-01': { [banca.id]: dia([8, 8, 8]) } });
check('Todas en el tope (8): sube 2,5 kg', sube.tipo === 'subir' && sube.kg === 62.5, JSON.stringify(sube));
const reset = sugerirCarga(banca, { '2026-12-01': { [banca.id]: dia([4, 4, 3]) }, '2026-12-05': { [banca.id]: dia([4, 3, 3]) } });
check('P6: dos sesiones por debajo del mínimo → baja el 10 %', reset.tipo === 'reset' && reset.kg === 54);
const lat = SESIONES.gymTA.ejercicios.find(e => /lateral/i.test(e.nombre));
check('Un accesorio en el tope sube al salto mínimo', sugerirCarga(lat, { '2026-12-01': { [lat.id]: dia([20, 20, 20, 20], 8) } }).tipo === 'subir');
check('Sueño < 6 h: una serie menos en los básicos, accesorios igual', /Una serie menos en cada básico/.test(S4(5).texto) && /accesorios, igual/.test(S4(5).texto));
check('6 h o más: normal', S4(6).nivel === 'normal');

console.log(`\n══ TOTAL BOGOTÁ: ${pruebas - fallos}/${pruebas} ══`);
if (fallos) process.exit(1);
