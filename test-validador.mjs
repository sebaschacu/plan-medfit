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

console.log(`\n══ TOTAL VERIFICADOR + RUTINA: ${pruebas - fallos}/${pruebas} ══`);
process.exit(fallos ? 1 : 0);
