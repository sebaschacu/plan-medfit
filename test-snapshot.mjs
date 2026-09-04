// ══ PUERTA 5 · CONTRATO DE localStorage ══
//
// Siembra un estado v3 conocido, deja que la app hidrate y vuelva a guardar, y
// compara lo reguardado contra una huella de referencia.
//
// POR QUÉ EXISTE: ninguna otra suite cubre esto. `test-ui.mjs` verifica la
// migración v2 → v3, pero no que la FORMA v3 sobreviva intacta a un refactor.
// Si al partir App.jsx se renombra una clave interna (`natB2`, `gymD`,
// `__sueno`, `separacionH`, `gymIdx`…), el localStorage de quien ya usa la app
// se rompe en silencio y ningún test se entera. Este sí.
//
// USO:
//   npm run build && npx vite preview --port 4173     (en otra terminal)
//   node test-snapshot.mjs --guardar   → escribe la huella de referencia
//   node test-snapshot.mjs             → compara contra ella (sale 1 si difiere)
//
// En Windows, CHROMIUM debe apuntar al headless shell: chrome.exe falla con
// `spawn UNKNOWN`. Ver BASELINE.md.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const URL = 'http://localhost:4173/';
// Ojo: la constante URL de arriba pisa el constructor global, así que la ruta
// se resuelve con path, no con `new URL(...)`.
const REFERENCIA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'baseline-snapshot.json');
const guardar = process.argv.includes('--guardar');

// Estado sembrado: toca los nueve campos del snapshot v3, incluidos los que
// solo aparecen al usar la app (variante fijada, complementos, sueño, PR).
const SEMILLA = {
  v: 3,
  ancla: { fecha: '2026-08-01', turno: 'L', gymIdx: 0 },
  festivos: ['2026-08-07', '2026-08-17'],
  fijados: {
    '2026-08-04': { turno: 'C', sesion: 'gymD' },
    '2026-08-11': { turno: 'C', sesion: 'natacion', variante: 'natB2' },
  },
  extras: {
    '2026-08-05': { complementos: ['movilidad'], sueno: 6 },
    '2026-08-12': { secundaria: 'natacion', separacionH: 6 },
  },
  css: 92,
  rutina: {},
  prog: {
    '2026-08-04': { 'D-1': { sets: [true, true, false], logs: [{ kg: 60, reps: 8 }, { kg: 60, reps: 7 }, null] } },
    '2026-08-12': { __sueno: 7 },
  },
  prs: { 'D-1': { kg: 60 } },
};

// Orden estable de claves: así un diff refleja un cambio real y no una
// reordenación que JSON.stringify produzca según el orden de inserción.
const canon = (x) => Array.isArray(x) ? x.map(canon)
  : (x && typeof x === 'object')
    ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])]))
    : x;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 430, height: 900 } });
const errores = [];
p.on('pageerror', e => errores.push('PAGE: ' + e.message.split('\n')[0]));
p.on('console', m => { if (m.type() === 'error') errores.push('CONSOLE: ' + m.text().slice(0, 120)); });

await p.addInitScript(([s]) => localStorage.setItem('plan-internado', JSON.stringify(s)), [SEMILLA]);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);   // deja correr el useEffect de guardado

const leido = await p.evaluate(() => JSON.parse(localStorage.getItem('plan-internado')));
await b.close();

const actual = JSON.stringify(canon(leido), null, 2) + '\n';

if (guardar) {
  fs.writeFileSync(REFERENCIA, actual);
  console.log(`\n══ Huella de referencia escrita ══`);
  console.log(`   claves v${leido.v}: ${Object.keys(leido).sort().join(' · ')}`);
  process.exit(0);
}

if (!fs.existsSync(REFERENCIA)) {
  console.log('\n❌ No hay huella de referencia. Créala con: node test-snapshot.mjs --guardar');
  process.exit(1);
}

const esperado = fs.readFileSync(REFERENCIA, 'utf8');
let fallos = 0;

if (actual === esperado) {
  console.log('\n  ✅ El snapshot de localStorage no ha cambiado');
} else {
  fallos++;
  const a = actual.split('\n'), e = esperado.split('\n');
  console.log('\n  ❌ EL SNAPSHOT HA CAMBIADO — se rompe el localStorage guardado\n');
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] !== e[i]) {
      console.log(`     linea ${i + 1}:`);
      console.log(`       esperado: ${e[i] ?? '(nada)'}`);
      console.log(`       actual:   ${a[i] ?? '(nada)'}`);
    }
  }
}

if (errores.length) { fallos++; console.log(`\n  ❌ Errores de página: ${errores.join(' | ')}`); }
else console.log('  ✅ Sin errores de página');

console.log(`\n══ SNAPSHOT: ${fallos ? 'FALLA' : '2/2 · contrato de localStorage intacto'} ══\n`);
process.exit(fallos ? 1 : 0);
