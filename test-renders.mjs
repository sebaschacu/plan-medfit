// ══ PUERTA 6 · RENDERS AL MARCAR UNA SERIE ══
//
// Cuenta cuántas veces se renderiza cada componente instrumentado al marcar
// UNA serie en SessionView. Es la medida de si la separación de contextos del
// paso 7 hizo su trabajo: el estado de progreso cambia en cada toque, y lo que
// no depende de él no debería enterarse.
//
// Componentes instrumentados (src/utiles/medir.js):
//   App          el enrutador. Con el estado en el Provider, debería quedar en 0.
//   SessionView  la pantalla que se está tocando: 1 es lo esperado.
//   CalendarView nunca está montado a la vez que SessionView: debe ser 0.
//   PanelDia     hermano que NO depende del progreso. Sigue re-renderizando por
//                arrastre del padre: eso lo arregla React.memo en la Tarea 4,
//                no los contextos. Se mide para dejarlo visible.
//
// USO: build + preview en :4173 (ver BASELINE.md), y CHROMIUM en Windows.
//   node test-renders.mjs

import { chromium } from 'playwright';
import { generarMes } from './src/generador.js';

const URL = 'http://localhost:4173/';
const MES_TEST = { anio: 2026, mes: 7 };
const hoyReal = new Date();
const mesesDesdeHoy = (MES_TEST.anio * 12 + MES_TEST.mes) - (hoyReal.getFullYear() * 12 + hoyReal.getMonth());
const gymV = generarMes(MES_TEST).dias.find(d => d.sesion.startsWith('gym'));

let fallos = 0;
const ok = (t, c, x = '') => { if (!c) fallos++; console.log(`  ${c ? '✅' : '❌'} ${t}${x ? ' — ' + x : ''}`); };

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 430, height: 1400 } });
const errores = [];
p.on('pageerror', e => errores.push(e.message.split('\n')[0]));

// Sin semilla: día limpio, sin registro previo. El contador nace ANTES de que
// cargue la app, para que ningún render se quede sin contar.
await p.addInitScript(() => { window.__renders = {}; });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1100);

// Al calendario y hasta el mes del ancla, como hace test-ui.mjs
await p.locator('text=Calendario').first().click().catch(() => {});
await p.waitForTimeout(500);
if (await p.locator('header .lucide-settings').count() === 0) {
  throw new Error(`no se llegó al calendario${errores.length ? ' · ' + errores.at(-1) : ''}`);
}
const btn = mesesDesdeHoy < 0 ? 'Mes anterior' : 'Mes siguiente';
for (let i = 0; i < Math.abs(mesesDesdeHoy); i++) {
  await p.locator(`button[aria-label="${btn}"]`).click();
  await p.waitForTimeout(160);
}

// Abrir el primer gym del mes
await p.evaluate(n => [...document.querySelectorAll('main button')]
  .find(x => x.textContent.trim().startsWith(n + ' ·'))?.click(), gymV.dia);
await p.waitForTimeout(600);
ok('Se abre un día de gym', await p.locator('text=/ejercicios/i').count() > 0, gymV.fecha + ' ' + gymV.sesion);

// ── La medida ──
// Se resetea el contador justo antes del toque y se lee 300 ms después:
// bastante para que React haya hecho commit, y antes del primer tic del
// temporizador de descanso (1 s), que también re-renderiza.
//
// Se miden DOS series. La primera fija el día (fijarPorRegistro cambia
// `fijados`, el calendario se regenera) y es legítimo que el enrutador se
// entere. La segunda solo cambia el progreso: es la medida limpia de si el
// progreso llega a componentes que no lo necesitan.
const medir = async (n) => {
  await p.evaluate(() => { window.__renders = {}; });
  await p.locator('main button').filter({ hasText: new RegExp(`^${n}$`) }).first().click();
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ ...window.__renders }));
  // Saltar el temporizador para que la siguiente medida arranque limpia
  await p.locator('button', { hasText: 'SALTAR' }).click().catch(() => {});
  await p.waitForTimeout(200);
  return r;
};
const r1 = await medir(1);
const r2 = await medir(2);

const fila = (k) => `  ${k.padEnd(13)} ${String(r1[k] ?? 0).padStart(2)}   ${String(r2[k] ?? 0).padStart(2)}`;
console.log('\n── RENDERS AL MARCAR UNA SERIE ──');
console.log('                1ª   2ª');
for (const k of ['App', 'SessionView', 'CalendarView', 'PanelDia']) console.log(fila(k));
console.log();

ok('Las dos series quedaron marcadas', await p.locator('main button svg.lucide-check').count() >= 2);
ok('CalendarView no se renderiza (no está montado)', (r1.CalendarView ?? 0) === 0 && (r2.CalendarView ?? 0) === 0);
ok('SessionView se renderiza (es la pantalla activa)', (r1.SessionView ?? 0) >= 1 && (r2.SessionView ?? 0) >= 1);
// El objetivo del paso 7, medido en la 2ª serie. Se informa siempre; se exige a partir de 7e.
const objetivo = process.argv.includes('--exigir-app-0');
const appCero = (r2.App ?? 0) === 0;
if (objetivo) ok('App NO se renderiza al marcar la 2ª serie (objetivo del paso 7)', appCero, String(r2.App ?? 0));
else console.log(`  ${appCero ? '✅' : '·'} App en la 2ª serie = ${r2.App ?? 0}  (objetivo del paso 7: 0 · informativo hasta 7e)`);

if (errores.length) { fallos++; console.log(`\n  ❌ Errores de página: ${errores.join(' | ')}`); }
else ok('Sin errores de página', true);

await b.close();
const res = (r) => `App=${r.App ?? 0} SV=${r.SessionView ?? 0} Cal=${r.CalendarView ?? 0} PanelDia=${r.PanelDia ?? 0}`;
console.log(`\n══ RENDERS: ${fallos ? 'FALLA' : 'ok'} · 1ª[${res(r1)}] 2ª[${res(r2)}] ══\n`);
process.exit(fallos ? 1 : 0);
