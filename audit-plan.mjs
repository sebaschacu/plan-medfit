// ══ AUDITORÍA DEL PLAN · cuánto de cada cosa genera el calendario ══
//
// Genera 18 meses desde el ancla y cuenta, por semana completa (lunes-domingo):
// gym, natación, running y bici —principales y dobladas—, días doblados, y los
// avisos por tipo. Son los números que se piden al cerrar cada bloque de trabajo
// sobre el generador. Sin navegador: solo lógica.
//
//   node audit-plan.mjs              → 18 meses desde el ancla
//   node audit-plan.mjs 2027-01-31   → hasta esa fecha

import { generarDesdeAncla, ANCLA_DEFAULT } from './src/generador.js';
import { CUPO_SEMANAL, CARDIO_CUPO } from './src/data.js';

const hasta = process.argv[2] ?? (() => {
  const [y, m] = ANCLA_DEFAULT.fecha.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + 18, 0));   // último día del mes 18
  return d.toISOString().slice(0, 10);
})();

const { dias, avisos } = generarDesdeAncla({ hasta });

// Semanas completas: se agrupa por lunes y se descartan las de menos de 7 días
// (los bordes del rango), que no son semanas reales del plan.
const semanas = new Map();
for (const d of dias) {
  const f = new Date(d.fecha + 'T12:00:00Z');
  const lunes = new Date(f); lunes.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  const k = lunes.toISOString().slice(0, 10);
  if (!semanas.has(k)) semanas.set(k, []);
  semanas.get(k).push(d);
}
const completas = [...semanas.values()].filter(s => s.length === 7);
const n = completas.length;

const cuenta = (pred) => completas.reduce((a, s) => a + s.filter(d => pred(d.sesion) || pred(d.sesionSecundaria)).length, 0);
const gym = cuenta(s => s?.startsWith('gym'));
const nat = cuenta(s => s === 'natacion');
const run = cuenta(s => s === 'running');
const bici = cuenta(s => s === 'ciclismo');
const dobles = completas.reduce((a, s) => a + s.filter(d => d.sesionSecundaria).length, 0);
const flexibles = completas.reduce((a, s) => a + s.filter(d => d.flexible).length, 0);
const flexBiciDef = completas.reduce((a, s) => a + s.filter(d => d.flexible && d.cardioPorDefecto).length, 0);
const flexSug = completas.reduce((a, s) => a + s.filter(d => d.flexible && d.sugerencia && !d.cardioPorDefecto).length, 0);
const flexTrasPierna = completas.reduce((a, s) => a + s.filter(d => d.flexible && d.trasPierna).length, 0);
// El cupo de running es de CARDIO (CARDIO_CUPO): running o bici cubren la semana.
const esCardio = (d) => CARDIO_CUPO.includes(d.sesion) || CARDIO_CUPO.includes(d.sesionSecundaria);
const semSinRun = completas.filter(s => !s.some(d => d.sesion === 'running' || d.sesionSecundaria === 'running')).length;
const semSinCardio = completas.filter(s => !s.some(esCardio)).length;

const porTipo = {};
for (const a of avisos) porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;
const runPerdidos = avisos.filter(a => a.tipo === 'sin_hueco_doblando' && /running/.test(a.texto)).length;

const f = (x) => (x / n).toFixed(2).padStart(5);
console.log(`\n══ AUDITORÍA DEL PLAN · ${dias.length} días · ${n} semanas completas · ${ANCLA_DEFAULT.fecha} → ${hasta} ══\n`);
console.log(`  gym       ${f(gym)} /sem   (cupo ${CUPO_SEMANAL.gym})`);
console.log(`  natación  ${f(nat)} /sem   (cupo ${CUPO_SEMANAL.natacion})`);
console.log(`  running   ${f(run)} /sem   semanas sin running: ${semSinRun}/${n}`);
console.log(`  bici      ${f(bici)} /sem   (de ellas ${flexBiciDef} por defecto en el flexible)`);
console.log(`  cardio    ${f(run + bici)} /sem   (running + bici · cupo ${CUPO_SEMANAL.running} · mínimo exigido 1.00)   semanas sin cardio: ${semSinCardio}/${n}`);
console.log(`  dobles    ${dobles} totales · ${f(dobles)} /sem`);
console.log(`  flexible  ${flexibles} días · bici por defecto en ${flexBiciDef} · solo propuesta (tras pierna o dos gym seguidos) en ${flexSug} · tras pierna: ${flexTrasPierna}`);
console.log(`\n  avisos por tipo (${avisos.length}):`);
for (const [t, c] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) console.log(`    ${t.padEnd(22)} ${c}`);
if (runPerdidos) console.log(`    · de los sin_hueco_doblando, ${runPerdidos} son de running`);
console.log();
