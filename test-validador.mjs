// Banco de pruebas del verificador de rutina.
// La prueba de fuego: el plan v6 tal cual debe pasar SIN un solo hallazgo duro.
// Si el verificador se queja del plan que él mismo defiende, está mal calibrado.
import { verificarSesion, solapan, volumenSesion } from './src/validador.js';
import { SESIONES } from './src/data.js';

let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};
const clonar = (k) => JSON.parse(JSON.stringify(SESIONES[k].ejercicios));

console.log('\n── EL PLAN v6 PASA LIMPIO ──');
for (const k of ['gymA', 'gymC1', 'gymD', 'gymC2', 'gymB', 'calistenia']) {
  const r = verificarSesion(k, SESIONES[k].ejercicios);
  check(`${k} sin hallazgos duros (${r.resumen.series} series · ${r.resumen.biseries} bi-series)`,
    r.duras.length === 0,
    r.duras.map(d => `[${d.regla}] ${d.texto}`).join('\n       '));
}

console.log('\n── E8 · TABLA DE EMPAREJAMIENTOS DEL PLAN (sección 4.3) ──');
const todos = {};
for (const s of Object.values(SESIONES)) for (const e of s.ejercicios) todos[e.nombre] = e;
const buscar = (frag) => Object.values(todos).find(e => e.nombre.toLowerCase().includes(frag.toLowerCase()));
const pares = [
  ['Press inclinado', 'Face pull', true],
  ['Remo con apoyo', 'Rueda abdominal', true],
  ['Prensa', 'Gemelo sentado', true],
  ['Press militar', 'Pallof', true],
  ['Press inclinado', 'Extensión tríceps overhead', false],
  ['Remo con apoyo', 'Curl inclinado', false],
  ['Press inclinado', 'Elevación lateral en polea', false],
  ['Sentadilla trasera', 'Extensión de cuádriceps', false],
];
for (const [n1, n2, valido] of pares) {
  const a = buscar(n1), b = buscar(n2);
  const choque = solapan(a, b);
  check(`${valido ? '✅ válido  ' : '❌ inválido'} · ${n1} + ${n2}`,
    (choque.length === 0) === valido,
    choque.map(c => `${c.musculo} — ${c.motivo}`).join(' · '));
}

console.log('\n── CADA REGLA DETECTA SU VIOLACIÓN ──');
const tiene = (r, regla) => r.duras.some(d => d.regla === regla);

// E2 · mezclar torso y pierna
let ej = clonar('gymA');
ej.push({ ...clonar('gymC1')[0], id: 'X-1' });   // sentadilla como trabajo principal
check('E2 detecta mezclar pierna en una sesión de torso', tiene(verificarSesion('gymA', ej), 'E2'));
// …pero NO se aplica a la calistenia, que es full body por diseño
ej = clonar('calistenia');
check('E2 no se aplica a una plantilla que ya nace full body',
  !tiene(verificarSesion('calistenia', ej), 'E2'));
// La zona la define el trabajo principal: el finisher de carga real lleva pierna
// como primario y NO debe convertir Gym A en full body
check('Un finisher con pierna no desactiva E2 en una sesión de torso',
  !tiene(verificarSesion('gymA', clonar('gymA')), 'E2') &&
  tiene(verificarSesion('gymA', [...clonar('gymA'), { ...clonar('gymC1')[0], id: 'X-9' }]), 'E2'));

// E1 · compuesto de Parte 1 metido en bi-serie
ej = clonar('gymA');
ej[0].bs = 'BS1';
check('E1 detecta un compuesto de Parte 1 dentro de una bi-serie', tiene(verificarSesion('gymA', ej), 'E1'));

// E8 · emparejar dos que solapan
ej = clonar('gymA');
ej.find(e => e.id === 'A-4').bs = 'BS2';   // face pull junto a las aperturas... no solapa
ej.find(e => e.id === 'A-7').bs = 'BS2';   // extensión tríceps + aperturas: tampoco
ej.find(e => e.id === 'A-9').bs = 'BS2';   // segunda de tríceps → ahora sí solapa con A-7
check('E8 detecta dos ejercicios del mismo músculo en una bi-serie', tiene(verificarSesion('gymA', ej), 'E8'));

// E9 · dos acarreos
ej = clonar('gymB');
ej.push({ ...clonar('gymD').find(e => e.acarreo), id: 'X-2' });
check('E9 detecta dos acarreos en la misma sesión', tiene(verificarSesion('gymB', ej), 'E9'));

// E5 · acarreo de agarre fuera del final
ej = clonar('gymB');
const suitcase = ej.splice(ej.findIndex(e => /suitcase/i.test(e.nombre)), 1)[0];
suitcase.parte = 2;
ej.splice(2, 0, suitcase);
check('E5 detecta un acarreo de agarre colocado antes del final', tiene(verificarSesion('gymB', ej), 'E5'));

// E5 · acarreo de postura al final
ej = clonar('gymC2');
ej.find(e => /bear hug/i.test(e.nombre)).parte = 'finisher';
check('E5 detecta un acarreo de postura colocado al final', tiene(verificarSesion('gymC2', ej), 'E5'));

// E6 · quitar el face pull
ej = clonar('gymA').filter(e => !/face pull/i.test(e.nombre));
check('E6 detecta que se quitó el face pull', tiene(verificarSesion('gymA', ej), 'E6'));

// R2 · quitar un compuesto de Parte 1
ej = clonar('gymA').filter(e => e.id !== 'A-1');
check('R2 detecta que se quitó un compuesto de Parte 1', tiene(verificarSesion('gymA', ej), 'R2'));

// Metadata · ejercicio nuevo sin músculos
ej = clonar('gymA');
ej.push({ id: 'NUEVO-1', nombre: 'Ejercicio inventado', series: 3, reps: '10', rir: '1-2', parte: 3 });
check('Detecta un ejercicio nuevo sin músculos asignados', tiene(verificarSesion('gymA', ej), 'METADATA'));

// Metadata · IDs duplicados
ej = clonar('gymA');
ej.push({ ...ej[0] });
check('Detecta IDs duplicados', tiene(verificarSesion('gymA', ej), 'METADATA'));

console.log('\n── AVISOS BLANDOS (no bloquean) ──');
ej = clonar('gymA');
ej.forEach(e => { if (typeof e.series === 'number') e.series += 1; });
let r = verificarSesion('gymA', ej);
check(`Avisa al subir el volumen (${r.resumen.series} vs ${r.resumen.seriesPlan} series)`,
  r.blandas.some(b => b.regla === 'VOLUMEN') && r.duras.length === 0);

ej = clonar('gymA').filter(e => e.parte !== 3);
r = verificarSesion('gymA', ej);
check(`Avisa al recortar mucho volumen (${r.resumen.series} vs ${r.resumen.seriesPlan} series)`,
  r.blandas.some(b => b.regla === 'VOLUMEN'));

ej = clonar('gymA');
delete ej[0].lineal;
ej[0].rir = '2';
r = verificarSesion('gymA', ej);
check('Avisa de un compuesto de Parte 1 sin progresión lineal', r.blandas.some(b => b.regla === 'P1'));

console.log('\n── VOLUMEN POR SESIÓN ──');
const vol = volumenSesion(SESIONES.gymA.ejercicios);
check(`Gym A reparte volumen en ${Object.keys(vol).length} grupos musculares`, Object.keys(vol).length >= 6);
check('El tríceps sale como el más cargado de Gym A tras el pecho',
  (vol.triceps ?? 0) > 0 && (vol.pecho ?? 0) > 0,
  `tríceps ${vol.triceps} · pecho ${vol.pecho} · deltoides medio ${vol.deltoides_medio}`);


// ══════════ RUTINA VERSIONADA ══════════
const R = await import('./src/rutina.js');
console.log('\n── RUTINA VERSIONADA ──');

const base = SESIONES.gymA.ejercicios;
check('Sin versiones, resuelve el plan base',
  R.resolverRutina('gymA', '2026-09-01', {}).length === base.length);

// Una versión desde el 15 de septiembre
const v1 = base.filter(e => e.id !== 'A-9');
let rutina = R.guardarVersion({}, 'gymA', v1, '2026-09-15', 'quité la segunda de tríceps');
check('Antes de la fecha de la versión sigue el plan original',
  R.resolverRutina('gymA', '2026-09-14', rutina).length === base.length);
check('Desde la fecha de la versión se aplica la edición',
  R.resolverRutina('gymA', '2026-09-15', rutina).length === v1.length);
check('EL PASADO NO SE REESCRIBE: septiembre 1 conserva lo que entrenaste',
  R.resolverRutina('gymA', '2026-09-01', rutina).some(e => e.id === 'A-9'));

// Segunda versión posterior
const v2 = v1.filter(e => e.id !== 'A-8');
rutina = R.guardarVersion(rutina, 'gymA', v2, '2026-11-02', 'y la elevación lateral');
check('Con dos versiones, cada fecha resuelve la suya',
  R.resolverRutina('gymA', '2026-10-01', rutina).length === v1.length &&
  R.resolverRutina('gymA', '2026-11-10', rutina).length === v2.length);

// Editar dos veces el mismo día no crea dos versiones
const rr = R.guardarVersion(R.guardarVersion({}, 'gymA', v1, '2026-09-15', 'a'), 'gymA', v2, '2026-09-15', 'b');
check('Editar dos veces el mismo día sustituye la versión, no la duplica', rr.gymA.length === 1);
check('Y se queda con la última', rr.gymA[0].motivo === 'b');

// El motivo es opcional (v7.1): vacío, en blanco, null o undefined → "Sin motivo"
check('Sin motivo se guarda "Sin motivo", no un hueco',
  R.guardarVersion({}, 'gymA', v1, '2026-09-15').gymA[0].motivo === R.SIN_MOTIVO
  && R.guardarVersion({}, 'gymA', v1, '2026-09-15', '').gymA[0].motivo === R.SIN_MOTIVO
  && R.guardarVersion({}, 'gymA', v1, '2026-09-15', '   ').gymA[0].motivo === R.SIN_MOTIVO
  && R.guardarVersion({}, 'gymA', v1, '2026-09-15', null).gymA[0].motivo === R.SIN_MOTIVO);
check('Un motivo con espacios alrededor se guarda limpio',
  R.guardarVersion({}, 'gymA', v1, '2026-09-15', '  cambio de máquina  ').gymA[0].motivo === 'cambio de máquina');
check('Restaurar el plan conserva su motivo propio',
  R.restaurarPlan({}, 'gymA', '2026-09-15').gymA[0].motivo === 'Vuelta al plan original');

check('estaEditada detecta la diferencia con el plan',
  R.estaEditada('gymA', '2026-09-20', rutina) && !R.estaEditada('gymA', '2026-09-01', rutina));

// Restaurar
const restaurada = R.restaurarPlan(rutina, 'gymA', '2026-12-01');
check('Restaurar vuelve al plan original desde esa fecha',
  R.resolverRutina('gymA', '2026-12-05', restaurada).length === base.length);
check('Y no borra el historial anterior',
  R.resolverRutina('gymA', '2026-10-01', restaurada).length === v1.length);

// Huérfanos: lo registrado que ya no está en la rutina
const prog = { 'A-1': { sets: [true] }, 'A-9': { sets: [true] }, __sueno: 7 };
const huer = R.huerfanosDelDia(prog, v1);
check('Detecta el registro huérfano tras quitar un ejercicio',
  huer.length === 1 && huer[0] === 'A-9', huer.join(', '));
check('El sueño no cuenta como ejercicio huérfano', !huer.includes('__sueno'));

// Utilidades del editor
check('El catálogo reúne todos los ejercicios del plan',
  R.catalogoEjercicios().length === Object.values(SESIONES).reduce((a, s) => a + s.ejercicios.length, 0));
check('mover intercambia posiciones', R.mover(['a', 'b', 'c'], 0, 1).join('') === 'bac');
check('mover no se sale de los límites', R.mover(['a', 'b'], 0, -1).join('') === 'ab');
check('nuevoId no choca con los existentes', !base.some(e => e.id === R.nuevoId('gymA', base)));
check('gruposBS ofrece los existentes más uno nuevo',
  R.gruposBS(base).includes('BS1') && R.gruposBS(base).includes(null) && R.gruposBS(base).includes('BS5'));


// ══════════ HISTORIAL Y SUGERENCIA DE CARGA ══════════
const RG = await import('./src/reglas.js');
console.log('\n── HISTORIAL DEL EJERCICIO ──');
const banca = SESIONES.gymA.ejercicios.find(e => e.id === 'A-1');
const sent = SESIONES.gymC1.ejercicios.find(e => e.id === 'C1-1');
const aisl = SESIONES.gymA.ejercicios.find(e => e.id === 'A-6');

const hist = {
  '2026-08-01': { 'A-1': { logs: [{ kg: 40, reps: 8 }, { kg: 40, reps: 8 }, { kg: 40, reps: 7 }, { kg: 40, reps: 6 }] } },
  '2026-08-12': { 'A-1': { logs: [{ kg: 42.5, reps: 8 }, { kg: 42.5, reps: 8 }, { kg: 42.5, reps: 7 }, { kg: 42.5, reps: 6 }] } },
};
const h = RG.historialEjercicio(hist, 'A-1');
check(`Encuentra las ${h.length} sesiones registradas del ejercicio`, h.length === 2);
check('Ordenadas de más antigua a más reciente', h[0].fecha < h[1].fecha);
check('Calcula carga máxima y volumen', h[1].kgMax === 42.5 && h[1].volumen === 42.5 * 29);
check('La última sesión es la correcta', RG.ultimaSesion(hist, 'A-1').fecha === '2026-08-12');
check('Sin registro devuelve null (primera vez)', RG.ultimaSesion(hist, 'A-99') === null);

// TEST 5 del documento · el histórico sigue al ejercicio aunque cambie de sesión
const movido = {
  '2026-08-01': { 'A-1': { logs: [{ kg: 40, reps: 8 }] } },   // estaba en Gym A
  '2026-09-01': { 'A-1': { logs: [{ kg: 45, reps: 8 }] } },   // ahora en Gym D
};
check('El histórico se encuentra aunque el ejercicio cambie de sesión (busca por ID)',
  RG.historialEjercicio(movido, 'A-1').length === 2);

console.log('\n── SUGERENCIA DE CARGA ──');
// TEST 3 del documento · +2.5 / +5 / −10%
const sSup = RG.sugerirCarga(banca, { '2026-08-01': { 'A-1': { logs: Array(4).fill({ kg: 40, reps: 8 }) } } });
check(`Tren superior completo → +2.5 kg (40 → ${sSup.kg})`, sSup.tipo === 'subir' && sSup.kg === 42.5);
const sInf = RG.sugerirCarga(sent, { '2026-08-01': { 'C1-1': { logs: Array(4).fill({ kg: 60, reps: 8 }) } } });
check(`Tren inferior completo → +5 kg (60 → ${sInf.kg})`, sInf.tipo === 'subir' && sInf.kg === 65);
const sReset = RG.sugerirCarga(banca, {
  '2026-08-01': { 'A-1': { logs: [{ kg: 50, reps: 4 }] } },
  '2026-08-05': { 'A-1': { logs: [{ kg: 50, reps: 4 }] } },
});
check(`Dos fallos seguidos → reset del 10% (50 → ${sReset.kg})`, sReset.tipo === 'reset' && sReset.kg === 45);
check('Y el motivo cita la regla P6', /P6/.test(sReset.motivo));

// No sube si no cerró el rango
const sMant = RG.sugerirCarga(banca, { '2026-08-01': { 'A-1': { logs: [{ kg: 40, reps: 8 }, { kg: 40, reps: 3 }] } } });
check('Si no completó el rango, mantiene carga', sMant.tipo === 'mantener' && sMant.kg === 40);

// TEST 4 del documento · en descarga no propone subir
const sDesc = RG.sugerirCarga(banca, { '2026-08-01': { 'A-1': { logs: Array(4).fill({ kg: 40, reps: 8 }) } } }, { descarga: true });
check('En semana de DESCARGA no sugiere subir', sDesc.tipo === 'mantener' && sDesc.kg === 40);
check('Y lo explica citando P4', /P4/.test(sDesc.motivo));

// Aislamientos: doble progresión, no lineal
const sAislTope = RG.sugerirCarga(aisl, { '2026-08-01': { 'A-6': { logs: [{ kg: 10, reps: 20 }] } } });
check('Aislamiento al tope del rango → sube', sAislTope.tipo === 'subir');
const sAislNo = RG.sugerirCarga(aisl, { '2026-08-01': { 'A-6': { logs: [{ kg: 10, reps: 13 }] } } });
check('Aislamiento sin llegar al tope → sube reps, no carga', sAislNo.tipo === 'mantener');

// Acarreos e isométricos tienen su propia regla
const acarreo = SESIONES.gymD.ejercicios.find(e => e.acarreo);
check('El acarreo progresa por postura (P2), no por rango de reps',
  /P2/.test(RG.sugerirCarga(acarreo, { '2026-08-01': { [acarreo.id]: { lastre: 20 } } }).motivo));
const iso = SESIONES.gymB.ejercicios.find(e => e.iso && !e.lineal);
check('El isométrico progresa en tiempo hasta 60s (P3)',
  RG.sugerirCarga(iso, {}).tipo === 'no-aplica');

check('Primera vez lo dice en vez de dejar un hueco', RG.sugerirCarga(banca, {}).tipo === 'primera');

// ── Sesión fantasma · "usar sugerido" sin entrenar (v7.1) ──
// El botón escribe la carga en las series ANTES de hacerlas. Si ese día no se
// entrena, unos kg sin reps ni serie marcada no son una sesión: no cuentan en
// el historial ni cambian la sugerencia siguiente.
console.log('\n── SESIÓN FANTASMA ──');
const hecha = { 'A-1': { sets: [true, true, true, true], logs: Array(4).fill({ kg: 40, reps: 8 }) } };
const fantasma = { 'A-1': { sets: [], logs: Array(4).fill({ kg: 42.5 }) } };   // "usar" y no entrenar
const conFantasma = { '2026-08-01': hecha, '2026-08-04': fantasma };
check('Solo kg sin marcar ni reps NO cuenta como sesión',
  RG.historialEjercicio(conFantasma, 'A-1').length === 1);
check('La última sesión sigue siendo la real', RG.ultimaSesion(conFantasma, 'A-1')?.fecha === '2026-08-01');
const sTras = RG.sugerirCarga(banca, conFantasma);
check('Y la sugerencia sigue siendo subir a 42.5, no "0 reps máx"',
  sTras.tipo === 'subir' && sTras.kg === 42.5, `${sTras.tipo} ${sTras.kg}`);
// Lo que SÍ cuenta: serie marcada aunque no se anoten reps, y reps aunque no se marque
const marcadaSinReps = { '2026-08-01': { 'A-1': { sets: [true, true], logs: [{ kg: 40 }, { kg: 40 }] } } };
check('Serie marcada sin reps sí cuenta (hiciste la serie, olvidaste las reps)',
  RG.historialEjercicio(marcadaSinReps, 'A-1').length === 1 && RG.ultimaSesion(marcadaSinReps, 'A-1').kgMax === 40);
const repsSinMarcar = { '2026-08-01': { 'A-1': { sets: [], logs: [{ kg: 40, reps: 8 }] } } };
check('Reps anotadas sin marcar sí cuentan', RG.historialEjercicio(repsSinMarcar, 'A-1').length === 1);
check('Dos fantasmas seguidos no disparan un reset (P6)',
  RG.sugerirCarga(banca, { '2026-08-01': hecha, '2026-08-04': fantasma, '2026-08-08': fantasma }).tipo !== 'reset');

// ── parseRest · el descanso de cada ejercicio, en segundos (v7.1) ──
// Descartaba con `includes('0s')`, que se llevaba "60s", "90s", "30s", "20s" y
// "40s": 38 ejercicios sin temporizador nunca. Se prueba contra TODOS los
// formatos de descanso que hay en data.js, no contra una lista escrita aquí.
console.log('\n── parseRest · DESCANSOS DE data.js ──');
const { parseRest } = await import('./src/utiles/formato.js');
check('"60s" → 60 (era null)', parseRest('60s') === 60);
check('"90s" → 90 · "30s" → 30 · "20s" → 20 · "40s" → 40',
  parseRest('90s') === 90 && parseRest('30s') === 30 && parseRest('20s') === 20 && parseRest('40s') === 40);
check('"45s" → 45 · "3 min" → 180 · "2.5 min" → 150', parseRest('45s') === 45 && parseRest('3 min') === 180 && parseRest('2.5 min') === 150);
check('Un rango toma el tope: "2-3 min" → 180', parseRest('2-3 min') === 180);
check('Sin descanso: "—", "0s", vacío y null → null',
  parseRest('—') === null && parseRest('0s') === null && parseRest('') === null && parseRest(null) === null);
const descansosReales = [...new Set(Object.values(SESIONES).flatMap(s => (s.ejercicios ?? []).map(e => e.descanso)).filter(Boolean))];
const sinParsear = descansosReales.filter(d => d !== '—' && parseRest(d) === null);
check(`Todo descanso definido en data.js se convierte a segundos (${descansosReales.length} formatos distintos)`,
  sinParsear.length === 0, sinParsear.join(' · '));
check('Y ninguno da 0 o negativo', descansosReales.filter(d => d !== '—').every(d => parseRest(d) > 0));

console.log(`\n══ TOTAL VERIFICADOR + RUTINA + PROGRESIÓN: ${pruebas - fallos}/${pruebas} ══`);
process.exit(fallos ? 1 : 0);
