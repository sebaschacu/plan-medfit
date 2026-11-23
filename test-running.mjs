// ══ Banco de pruebas del running ══
//
// El running dejó de ser una sola sesión: ahora rota entre Rodaje suave,
// Tempo, Fondo largo, Series de umbral, Cuestas y Series 4×4, con un test de
// 30 min cada ~12 carreras. La clave del día sigue siendo 'running' (de ella
// cuelgan el cupo de cardio y la regla S3); lo que cambia es la variante.
import * as G from './src/generador.js';
import { deISO, combinacionValida } from './src/generador.js';
// La rotación de running se estudia con el plan v6, que pone una carrera cada
// semana. En Bogotá el cardio es bici y la carrera es opcional (se añade a mano):
// la rotación y el sellado son los mismos.
const generarDesdeAncla = (o) => G.generarDesdeAncla({ planFijo: 'v6', ...o });
import { normalizarConfig, conCampo } from './src/config.js';
import { SESIONES, SESION_INFO, SECUENCIA_RUNNING, RUNNING_SESIONES, RUNNING_TEST, VARIANTES_DE, ZONAS_RUN, GYM_PIERNA,
  claveReal, clavePrincipal, claveSecundaria, familiaDe } from './src/data.js';
import { calcularUmbralRun, tablaZonasRun, mmss } from './src/reglas.js';
import { protegerRunningAntiguo } from './src/estado/persistencia.js';
import { nombrarClaves } from './src/utiles/nombres.js';

let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};
const seccion = (t) => console.log(`\n── ${t} ──`);
const HASTA = '2027-12-31';
const VARS = VARIANTES_DE.running;

// Carreras en orden: principal y segunda sesión, con su variante.
const carreras = (dias) => dias.flatMap(d => [
  d.sesion === 'running' ? { fecha: d.fecha, v: d.variante, d } : null,
  d.sesionSecundaria === 'running' ? { fecha: d.fecha, v: d.varianteSecundaria, d, sec: true } : null,
]).filter(Boolean);

// ═══ 1 · LAS SESIONES ═══
seccion('LAS SESIONES');
for (const k of VARS) {
  const s = SESIONES[k], i = SESION_INFO[k];
  check(`${k} existe, con nombre, chequeo y al menos 3 bloques`, !!s && !!i && !!s.chequeo && s.ejercicios.length >= 3, k);
}
check('Todas son del grupo Cardio y con icono de correr', VARS.every(k => SESION_INFO[k].grupo === 'cardio' && SESION_INFO[k].icon === 'run'));
check('Las seis sesiones traen versión recortada', RUNNING_SESIONES.every(k => SESIONES[k].recortada));
check('La rotación son las 4 indispensables: Rodaje suave → Tempo → Fondo largo → Series 4×4',
  SECUENCIA_RUNNING.map(k => SESION_INFO[k].label).join(' → ') === 'Rodaje suave → Tempo → Fondo largo → Series 4×4');
check('Series de umbral y Cuestas siguen disponibles para un día suelto', VARS.includes('runB2') && VARS.includes('runA3') && !!SESIONES.runB2 && !!SESIONES.runA3);
const ids = Object.values(SESIONES).flatMap(s => s.ejercicios.map(e => e.id));
check('Ningún ID de ejercicio se repite en todo el plan', new Set(ids).size === ids.length);
check('La genérica de siempre sigue existiendo con sus RUN-1..3 (historial antiguo)',
  ['RUN-1', 'RUN-2', 'RUN-3'].every(id => SESIONES.running.ejercicios.some(e => e.id === id)));
check('Calentamiento primero y vuelta a la calma al final en todas',
  VARS.every(k => /calentamiento/i.test(SESIONES[k].ejercicios[0].nombre) && /calma/i.test(SESIONES[k].ejercicios.at(-1).nombre)));
check('El 4×4 son 4 series de 4 min con 3 min de recuperación (Helgerud)',
  SESIONES.runB3.ejercicios.some(e => e.series === 4 && e.reps === '4 min' && /3 min/.test(e.descanso)));
check('El test pide anotar la distancia', SESIONES.runTest.ejercicios.some(e => /ANOTA LA DISTANCIA/.test(e.nota)));
check('Toda sesión dice cómo medir la intensidad sin reloj (habla o esfuerzo)',
  RUNNING_SESIONES.every(k => SESIONES[k].ejercicios.some(e => /hablar|hablas|palabras|frases|esfuerzo/i.test(e.nota))));

// ═══ 2 · EL GENERADOR ═══
seccion('EL GENERADOR');
const base = generarDesdeAncla({ hasta: HASTA });
const runs = carreras(base.dias);
check(`Hay carreras en el plan (${runs.length} hasta ${HASTA})`, runs.length > 40);
check('Toda carrera tiene una variante de running', runs.every(r => VARS.includes(r.v)), runs.filter(r => !VARS.includes(r.v)).map(r => r.fecha + ':' + r.v).join(', '));
check('La clave del día sigue siendo running, nunca la variante',
  base.dias.every(d => !familiaDe(d.sesion) && !familiaDe(d.sesionSecundaria ?? '')));
check('Ningún día que no es de running lleva variante de running',
  base.dias.every(d => (d.sesion === 'running' || !VARS.includes(d.variante)) && (d.sesionSecundaria === 'running' || !VARS.includes(d.varianteSecundaria))));
check('La primera carrera del plan es el test de 30 min', runs[0]?.v === RUNNING_TEST.clave, runs[0]?.v);

const sinTest = runs.filter(r => r.v !== RUNNING_TEST.clave).map(r => r.v);
const enOrden = sinTest.every((v, i) => v === SECUENCIA_RUNNING[i % SECUENCIA_RUNNING.length]);
check('Fuera de los tests, la rotación sigue su orden sin saltos', enOrden, sinTest.slice(0, 14).join(' '));

const idxTests = runs.map((r, i) => (r.v === RUNNING_TEST.clave ? i : -1)).filter(i => i >= 0);
const huecos = idxTests.slice(1).map((x, i) => x - idxTests[i]);
check(`El test se repite cada ~12 carreras (huecos: ${huecos.join(', ')})`, huecos.length >= 3 && huecos.every(h => h >= 12 && h <= 14));
check('Tras cada test (salvo el primero, que abre el plan) viene el Tempo: no se pierde', idxTests.slice(1).every(i => !runs[i + 1] || runs[i + 1].v === RUNNING_TEST.sustituye));

// Reglas de seguridad: ninguna variante se libra de S3.
const porFecha = Object.fromEntries(base.dias.map(d => [d.fecha, d]));
const ayer = (f) => porFecha[new Date(deISO(f).getTime() - 864e5).toISOString().slice(0, 10)];
const trasPierna = runs.filter(r => { const a = ayer(r.fecha); return a && [a.sesion, a.sesionSecundaria].some(s => GYM_PIERNA.includes(s)); });
check('S3: ninguna carrera el día después de pierna', trasPierna.length === 0, trasPierna.map(r => r.fecha + ' ' + r.v).join(', '));
const conPierna = runs.filter(r => [r.d.sesion, r.d.sesionSecundaria].some(s => GYM_PIERNA.includes(s)));
check('S3: ninguna carrera el mismo día que pierna', conPierna.length === 0);

// ═══ 3 · FIJAR A MANO ═══
seccion('FIJAR A MANO');
const r3 = runs.find((r, i) => i > 3 && !r.sec && r.v !== 'runB3' && r.v !== RUNNING_TEST.clave);
const fij = { [r3.fecha]: { turno: r3.d.turno, sesion: 'running', variante: 'runB3' } };
const conFij = carreras(generarDesdeAncla({ hasta: HASTA, fijados: fij }).dias);
const pos = conFij.findIndex(r => r.fecha === r3.fecha && !r.sec);
check(`Fijar Series 4×4 el ${r3.fecha} (tocaba ${SESION_INFO[r3.v].label}) se respeta`, conFij[pos]?.v === 'runB3');
check('Y la que tocaba no se pierde: va en la siguiente carrera', conFij[pos + 1]?.v === r3.v, `siguiente: ${conFij[pos + 1]?.v}`);
check('Fijarla marca la sugerida (la que tocaba) para la interfaz', conFij[pos]?.d.sugerida === r3.v);

const otra = { [r3.fecha]: { turno: r3.d.turno, sesion: 'running', variante: 'natB2' } };
const conOtra = carreras(generarDesdeAncla({ hasta: HASTA, fijados: otra }).dias).find(r => r.fecha === r3.fecha && !r.sec);
check('Una variante de otra familia colgada en el fijado no se usa', conOtra?.v === r3.v, conOtra?.v);

// Un día registrado antes de las variantes conserva la genérica y no gasta rotación.
const r0 = runs[0];
const legado = { [r0.fecha]: { turno: r0.d.turno, sesion: 'running', variante: 'running', auto: true } };
const conLegado = carreras(generarDesdeAncla({ hasta: HASTA, fijados: legado }).dias);
check('Día antiguo: se queda con la sesión genérica', conLegado[0]?.v === 'running', conLegado[0]?.v);
check('Y no cuenta en la rotación: la siguiente carrera es el test', conLegado[1]?.v === RUNNING_TEST.clave, conLegado[1]?.v);

// ═══ 4 · REGISTROS DE ANTES ═══
seccion('REGISTROS DE ANTES DE LAS VARIANTES');
const fijPrev = { '2026-08-09': { turno: 'L', sesion: 'running', auto: true }, '2026-08-16': { turno: 'L', sesion: 'gymD', auto: true },
  '2026-08-20': { turno: 'N', sesion: 'running', variante: 'runA2', auto: true }, '2026-08-21': { turno: 'P', sesion: 'gymA' } };
const progPrev = { '2026-08-09': { 'RUN-2': { sets: [true] } }, '2026-08-16': { 'D-1': { sets: [true] }, 'RUN-1': { sets: [true] } },
  '2026-08-20': { 'RA2-2': { sets: [true] } }, '2026-08-21': { 'A-1': { sets: [true] } } };
const prot = protegerRunningAntiguo(fijPrev, progPrev);
check('Running con RUN-* registrado → se fija a la genérica', prot['2026-08-09'].variante === 'running');
check('Running de segunda sesión con RUN-* → la segunda se fija a la genérica', prot['2026-08-16'].varianteSecundaria === 'running' && !prot['2026-08-16'].variante);
check('Un día ya con variante no se toca', prot['2026-08-20'].variante === 'runA2');
check('Un día sin RUN-* no se toca', prot['2026-08-21'] === fijPrev['2026-08-21']);
const sinNada = { '2026-08-04': { turno: 'C', sesion: 'gymD' } };
check('Sin registros de running antiguos devuelve el MISMO objeto (snapshot intacto)', protegerRunningAntiguo(sinNada, { '2026-08-04': { 'D-1': {} } }) === sinNada);
const g = generarDesdeAncla({ hasta: '2026-08-31', fijados: prot }).dias.find(d => d.fecha === '2026-08-09');
check('Y el generador lo respeta: ese día resuelve a la genérica', clavePrincipal(g) === 'running');

// ═══ 5 · CLAVES ═══
seccion('CLAVES');
check('claveReal resuelve la variante de su familia', claveReal('running', 'runB2') === 'runB2' && claveReal('natacion', 'natB1') === 'natB1');
check('claveReal ignora una variante de otra familia', claveReal('running', 'natB2') === 'running' && claveReal('natacion', 'runA1') === 'natacion');
check('clavePrincipal y claveSecundaria', clavePrincipal({ sesion: 'running', variante: 'runA3' }) === 'runA3'
  && claveSecundaria({ sesion: 'gymA', sesionSecundaria: 'running', varianteSecundaria: 'runA1' }) === 'runA1'
  && claveSecundaria({ sesion: 'gymA' }) === null);
check('familiaDe', familiaDe('runTest') === 'running' && familiaDe('natCSS') === 'natacion' && familiaDe('gymA') === null && familiaDe('running') === null);
check('Las variantes no entran como segunda sesión por su cuenta', !combinacionValida('gymA', 'runA1').ok);
check('nombrarClaves conoce las variantes de running', nombrarClaves('toca runB1 y luego runTest') === 'toca Tempo y luego Test 30 min');

// ═══ 6 · AJUSTES ═══
seccion('AJUSTES · ROTACIÓN DE RUNNING');
const solo = carreras(generarDesdeAncla({ hasta: HASTA, config: { rotacion: { running: ['runA2', 'runB3'] } } }).dias).map(r => r.v);
check('Con una rotación propia solo salen las elegidas, más el test', solo.every(v => ['runA2', 'runB3', RUNNING_TEST.clave].includes(v)) && solo[0] === RUNNING_TEST.clave, solo.slice(0, 8).join(' '));
check('Y el test se repite aunque Tempo no esté', solo.filter(v => v === RUNNING_TEST.clave).length >= 3);
check('Se puede volver a meter una que no está en la rotación del plan (Cuestas)',
  JSON.stringify(normalizarConfig({ rotacion: { running: [...SECUENCIA_RUNNING, 'runA3'] } }).rotacion?.running) === JSON.stringify([...SECUENCIA_RUNNING, 'runA3']));
check('normalizarConfig limpia claves que no son de running', JSON.stringify(normalizarConfig({ rotacion: { running: ['runB2', 'gymA', 'runB2', 'x'] } }).rotacion) === '{"running":["runB2"]}');
check('Guardar el orden del plan no deja nada en la config', !conCampo({}, 'rotacion', { running: [...SECUENCIA_RUNNING] }).rotacion);
check('Guardar otro orden sí', JSON.stringify(conCampo({}, 'rotacion', { running: ['runB1', 'runA1'] }).rotacion) === '{"running":["runB1","runA1"]}');

// ═══ 7 · RITMOS ═══
seccion('RITMO UMBRAL Y ZONAS');
const u = calcularUmbralRun('6.2');
check('6,2 km en 30 min → 4:50 / km', mmss(u.segPorKm) === '4:50' && !u.aviso, mmss(u?.segPorKm));
check('Acepta coma y metros', mmss(calcularUmbralRun('6,2').segPorKm) === '4:50' && mmss(calcularUmbralRun('6200').segPorKm) === '4:50');
check('Avisa si el ritmo no es creíble', !!calcularUmbralRun('15').aviso && !!calcularUmbralRun('2').aviso);
check('Vacío o basura → sin cálculo', calcularUmbralRun('') === null && calcularUmbralRun('abc') === null);
const z = tablaZonasRun(300, ZONAS_RUN);
check('Con umbral 5:00, Suave sale 5:45–6:30', z[0].rapido === '5:45' && z[0].lento === '6:30', `${z[0].rapido}–${z[0].lento}`);
check('Umbral 4:57–5:03 y VO2máx 4:30–4:42', z[2].rapido === '4:57' && z[2].lento === '5:03' && z[3].rapido === '4:30' && z[3].lento === '4:42');
check('Cada zona es más rápida que la anterior', ZONAS_RUN.every((x, i) => i === 0 || x.hasta < ZONAS_RUN[i - 1].desde));
check('Sin umbral no hay tabla de ritmos', tablaZonasRun(null, ZONAS_RUN).length === 0);
check('Toda zona dice cómo se siente al hablar y su esfuerzo', ZONAS_RUN.every(x => x.habla && x.rpe));

console.log(`\n══ TOTAL RUNNING: ${pruebas - fallos}/${pruebas} ══`);
if (fallos) process.exit(1);
