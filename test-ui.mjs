// ═══════════════ PRUEBAS DE INTERFAZ ═══════════════
// Requiere: npm i -D playwright  ·  npm run build  ·  npx vite preview --port 4173
// Uso:      node test-ui.mjs
//
// Cubre lo que test-generador.mjs no puede ver: navegación, edición, persistencia,
// migración v2→v3, exportar/importar y el registro de series en la sesión.
import { chromium } from 'playwright';
import fs from 'fs';
import { generarMes } from './src/generador.js';
import { SESIONES } from './src/data.js';

const URL = 'http://localhost:4173/';
let fallos = 0, n = 0;
const errores = [];
const ok = (t, c, x = '') => { n++; if (!c) fallos++; console.log(`  ${c ? '✅' : '❌'} ${t}${x ? ' — ' + x : ''}`); };
const seccion = (t) => console.log(`\n── ${t} ──`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const nuevaPagina = async (seed, opts = {}) => {
  const p = await b.newPage({ viewport: { width: 430, height: 1400 }, ...opts });
  p.on('pageerror', e => errores.push(e.message.split('\n')[0]));
  if (seed) await p.addInitScript(([s]) => localStorage.setItem('plan-internado', JSON.stringify(s)), [seed]);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  return p;
};
const ls = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('plan-internado')));
const titulo = (p) => p.locator('header h1').first().textContent({ timeout: 1500 }).catch(() => '‹PANTALLA ROTA›');
const abrirDia = async (p, fecha) => {
  await p.evaluate(d => [...document.querySelectorAll('main button')]
    .find(x => x.textContent.trim().startsWith(d + ' ·'))?.click(), Number(fecha.slice(8)));
  await p.waitForTimeout(600);
};
const sesionPorDia = (p) => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('main button')].map(x => x.textContent.match(/^(\d+) · [LCNP](.+?)(Hoy)?$/))
    .filter(Boolean).map(m => [Number(m[1]), m[2].trim()])));

// ══ 1 · NAVEGACIÓN DE MES ══
seccion('NAVEGACIÓN DE MES');
let p = await nuevaPagina();
const prev = p.locator('button[aria-label="Mes anterior"]');
const next = p.locator('button[aria-label="Mes siguiente"]');
ok('Arranca en el mes de hoy', (await titulo(p)) === 'Agosto 2026', await titulo(p));
ok('No deja retroceder antes del ancla', await prev.isDisabled());
for (let i = 0; i < 5; i++) { await next.click(); await p.waitForTimeout(180); }
ok('Cruza fin de año hacia delante', (await titulo(p)) === 'Enero 2027', await titulo(p));
for (let i = 0; i < 5; i++) { await prev.click(); await p.waitForTimeout(180); }
ok('Y vuelve correctamente', (await titulo(p)) === 'Agosto 2026', await titulo(p));
ok('Agosto tiene 31 celdas', Object.keys(await sesionPorDia(p)).length === 31);
await p.close();

// ══ 2 · EDICIÓN: FIJAR Y RECALCULAR ══
seccion('EDICIÓN: FIJAR Y RECALCULAR');
p = await nuevaPagina();
const antes = await sesionPorDia(p);
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await abrirDia(p, '2026-08-10');
ok('Se abre el modal', await p.locator('text=/Editar día 10/').count() > 0);
const enModal = async (texto) => p.evaluate(t => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => x.textContent.trim() === t || new RegExp(t, 'i').test(x.textContent))?.click();
}, texto);
await enModal('Gym D'); await p.waitForTimeout(200); await enModal('Guardar'); await p.waitForTimeout(700);
const tras = await sesionPorDia(p);
ok('El día 10 queda en Gym D', tras[10] === 'Gym D', 'día 10 = ' + tras[10]);
const sig = Object.keys(tras).map(Number).filter(d => d > 10 && /^Gym/.test(tras[d])).sort((a, b) => a - b)[0];
ok('La cola resincroniza: el siguiente gym es Gym C2', tras[sig] === 'Gym C2', `día ${sig} = ${tras[sig]}`);
ok('Lo posterior se recalcula, no solo ese día',
  JSON.stringify(Object.entries(antes).filter(([d]) => +d > 10)) !== JSON.stringify(Object.entries(tras).filter(([d]) => +d > 10)));
await abrirDia(p, '2026-08-10');
await p.locator('text=/Soltar este día/').first().click(); await p.waitForTimeout(600);
ok('Soltarlo restaura el calendario original', JSON.stringify(await sesionPorDia(p)) === JSON.stringify(antes));
await p.close();

// ══ 3 · REGISTRO EN LA SESIÓN ══
seccion('REGISTRO EN LA SESIÓN');
const ago = generarMes({ anio: 2026, mes: 7 }).dias;
const diaGym = ago.find(d => d.sesion === 'gymA');
const diaP = ago.find(d => d.turno === 'P' && d.sesion.startsWith('gym'));
p = await nuevaPagina();
await abrirDia(p, diaGym.fecha);
await p.locator('button').filter({ hasText: /^1$/ }).first().click(); await p.waitForTimeout(450);
ok('La serie se guarda indexada por FECHA', !!(await ls(p)).prog[diaGym.fecha]?.['A-1']?.sets?.[0]);
const campos = p.locator('input[placeholder="kg"], input[placeholder="rep"]');
await campos.nth(0).fill('52.5'); await p.waitForTimeout(250);
await campos.nth(1).fill('6'); await p.waitForTimeout(450);
ok('Guarda carga y reps', (await ls(p)).prog[diaGym.fecha]['A-1'].logs[0]?.kg === 52.5);
ok('Detecta el PR', (await ls(p)).prs['A-1']?.kg === 52.5);
ok('Arranca el temporizador de descanso', await p.locator('text=/DESCANSO|0[0-3]:/').count() > 0);
await p.getByRole('button', { name: /reset/i }).first().click(); await p.waitForTimeout(500);
ok('Reset borra solo ese día', !(await ls(p)).prog[diaGym.fecha]);
ok('Y conserva el PR histórico', (await ls(p)).prs['A-1']?.kg === 52.5);
await p.locator('text=Calendario').first().click(); await p.waitForTimeout(450);
await abrirDia(p, diaP.fecha);
ok('El posturno pide horas de sueño (S4)', await p.locator('text=/CUÁNTO DORMISTE/i').count() > 0);
ok('Sin series marcadas no hay botón Reset', await p.getByRole('button', { name: /reset/i }).count() === 0);
await p.getByLabel('Horas de sueño').fill('4'); await p.waitForTimeout(500);
ok('Con 4h manda descanso completo', await p.locator('text=/DESCANSO COMPLETO/i').count() > 0);
ok('Anotar sueño no cuenta como progreso', await p.getByRole('button', { name: /reset/i }).count() === 0);
await p.close();

// ══ 4 · MIGRACIÓN v2 → v3 ══
seccion('MIGRACIÓN v2 → v3');
p = await nuevaPagina({
  v: 2,
  prog: { 5: { 'A-1': { sets: [true, true], logs: [{ kg: 40, reps: 8 }, { kg: 40, reps: 7 }] } } },
  prs: { 'A-1': { kg: 40 } },
  cal: [{ dia: 7, festivo: true }, { dia: 17, festivo: true }, { dia: 23, festivo: true }],
});
const mig = await ls(p);
ok('Sube a v3', mig.v === 3);
ok('Reindexa el progreso a fecha ISO', !!mig.prog['2026-08-05'], Object.keys(mig.prog).join(','));
ok('Conserva los PRs', mig.prs['A-1']?.kg === 40);
ok('Rescata los festivos del usuario', mig.festivos.includes('2026-08-23'), JSON.stringify(mig.festivos));
ok('Los pinta en el calendario', await p.locator('main span.bg-rose-500').count() === 3);
await p.close();

// ══ 5 · EXPORTAR / IMPORTAR ══
seccion('EXPORTAR / IMPORTAR');
const semilla = { v: 3, prog: { '2026-08-05': { 'A-1': { sets: [true], logs: [{ kg: 40, reps: 8 }] } } }, prs: { 'A-1': { kg: 40 } }, fijados: {}, festivos: ['2026-08-07'] };
p = await nuevaPagina(semilla, { acceptDownloads: true });
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
const [dl] = await Promise.all([
  p.waitForEvent('download', { timeout: 8000 }),
  p.locator('button').filter({ hasText: 'Exportar' }).click(),
]);
const ruta = '/tmp/plan-export-test.json';
await dl.saveAs(ruta);
const exportado = JSON.parse(fs.readFileSync(ruta, 'utf8'));
ok('Descarga un JSON v3 con nombre fechado', exportado.v === 3 && /^plan-internado-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
await p.close();

p = await nuevaPagina();
ok('Dispositivo nuevo arranca vacío', Object.keys((await ls(p)).prog || {}).length === 0);
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await p.locator('input[type=file]').setInputFiles(ruta); await p.waitForTimeout(800);
ok('Confirma la importación', await p.locator('text=/Importado:/').count() > 0);
const imp = await ls(p);
ok('Round-trip sin pérdida', JSON.stringify(imp.prog) === JSON.stringify(exportado.prog));
fs.writeFileSync('/tmp/plan-basura.json', JSON.stringify({ hola: 'mundo' }));
await p.locator('input[type=file]').setInputFiles('/tmp/plan-basura.json'); await p.waitForTimeout(600);
ok('Rechaza un JSON ajeno', await p.locator('text=/no parece un respaldo/').count() > 0);
ok('Y no destruye lo que ya había', !!(await ls(p)).prog['2026-08-05']);
fs.writeFileSync('/tmp/plan-roto.json', '{ esto no es json');
await p.locator('input[type=file]').setInputFiles('/tmp/plan-roto.json'); await p.waitForTimeout(600);
ok('Rechaza un archivo corrupto', await p.locator('text=/corrupto|no es JSON/').count() > 0);
await p.close();

// ══ 6 · DÍA COMPLETADO Y ESTADÍSTICAS (regresión fase 1) ══
seccion('DÍA COMPLETADO Y ESTADÍSTICAS');
const prog = {};
const completar = (d) => {
  // La natación resuelve a su variante de la rotación: sembrar los ejercicios
  // genéricos dejaría el día como incompleto.
  const clave = d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion;
  const ses = SESIONES[clave]; if (!ses?.ejercicios.length) return;
  prog[d.fecha] = {};
  ses.ejercicios.forEach(ex => {
    const sc = typeof ex.series === 'number' ? ex.series : 1;
    prog[d.fecha][ex.id] = { sets: Array(sc).fill(true), logs: Array(sc).fill({ kg: 45, reps: 8 }) };
  });
};
ago.filter(d => d.dia >= 24 && d.dia <= 30).forEach(completar);
const diaNatC = ago.find(d => d.sesion === 'natacion'); if (diaNatC) completar(diaNatC);
const diaGymA = ago.find(d => d.sesion === 'gymA'); if (diaGymA) completar(diaGymA);
p = await nuevaPagina({ v: 3, prog, prs: {}, fijados: {}, festivos: ['2026-08-07', '2026-08-17'] });

// Lee el estilo aplicado a la celda de un día concreto
const estiloDe = (dia) => p.evaluate(n => {
  const b = [...document.querySelectorAll('main button')].find(x => x.textContent.trim().startsWith(n + ' ·'));
  if (!b) return null;
  const cs = getComputedStyle(b);
  const et = b.querySelector('div:last-of-type');
  const svg = b.querySelector('svg');
  return {
    fondo: cs.backgroundColor,
    bordeColor: cs.borderTopColor,
    bordeIzq: cs.borderLeftColor,
    anchoIzq: cs.borderLeftWidth,
    espIzq: b.style.borderWidth ? b.style.borderWidth.split(' ').pop() : null,
    anchoSup: cs.borderTopWidth,
    ancho: b.getBoundingClientRect().width,
    alto: b.getBoundingClientRect().height,
    colorEtiqueta: et ? getComputedStyle(et).color : null,
    colorIcono: svg ? getComputedStyle(svg).color : null,
  };
}, dia);

const eGymA = await estiloDe(diaGymA.dia);
ok('Un Gym A completado se rellena con su propio verde al 14%',
  eGymA.fondo === 'rgba(34, 197, 94, 0.14)', eGymA.fondo);
ok('Y se enmarca en ese mismo verde por los cuatro lados',
  eGymA.bordeIzq === 'rgb(34, 197, 94)' && eGymA.bordeColor === 'rgb(34, 197, 94)',
  `sup ${eGymA.bordeColor} · izq ${eGymA.bordeIzq}`);
// Se comprueba el valor ESPECIFICADO: Chromium redondea los bordes sub-píxel
// hacia abajo al calcular el layout, así que el "usado" sale 1px en cualquier densidad.
ok('Borde lateral especificado a 1.5px y superior a 3px',
  eGymA.espIzq === '1.5px' && eGymA.anchoSup === '3px', `especificado ${eGymA.espIzq} · usado ${eGymA.anchoIzq} · sup ${eGymA.anchoSup}`);
ok('El ícono y la etiqueta se quedan en el tono vivo, no en slate',
  eGymA.colorEtiqueta === 'rgb(34, 197, 94)' && eGymA.colorIcono === 'rgb(34, 197, 94)',
  `etiqueta ${eGymA.colorEtiqueta}`);

// La natación muestra la sesión concreta de la rotación, con SU color
const eNat = await estiloDe(diaNatC.dia);
const { SESION_INFO } = await import('./src/data.js');
const hexNat = SESION_INFO[diaNatC.variante ?? 'natacion'].color;
const rgbNat = (a) => { const v = parseInt(hexNat.slice(1), 16);
  return `rgb${a !== 1 ? 'a' : ''}(${(v>>16)&255}, ${(v>>8)&255}, ${v&255}${a !== 1 ? ', ' + a : ''})`; };
ok(`Una natación completada usa el color de SU sesión (${diaNatC.variante})`,
  eNat.fondo === rgbNat(0.14) && eNat.bordeIzq === rgbNat(1),
  `${eNat.fondo} · esperado ${rgbNat(0.14)}`);

// Un día sin completar conserva el borde superior del TURNO
const diaSin = ago.find(d => d.dia < 20 && !prog[d.fecha] && SESIONES[d.sesion]?.ejercicios.length);
const eSin = await estiloDe(diaSin.dia);
const colorTurno = { L: 'rgb(34, 197, 94)', C: 'rgb(245, 158, 11)', N: 'rgb(59, 130, 246)', P: 'rgb(100, 116, 139)' };
ok('Un día sin completar mantiene el borde superior del turno',
  eSin.bordeColor === colorTurno[diaSin.turno], `turno ${diaSin.turno} → ${eSin.bordeColor}`);
ok('Y no lleva relleno de sesión', !/0\.14/.test(eSin.fondo), eSin.fondo);

// El borde más grueso no debe cambiar el tamaño de la celda
ok('La celda completada mide EXACTAMENTE igual que la no completada',
  Math.abs(eGymA.ancho - eSin.ancho) < 0.1 && Math.abs(eGymA.alto - eSin.alto) < 0.1,
  `${eGymA.ancho.toFixed(1)}×${eGymA.alto.toFixed(1)} vs ${eSin.ancho.toFixed(1)}×${eSin.alto.toFixed(1)}`);

const pct = await p.evaluate(() => [...document.querySelectorAll('span')].find(s => /^\d+%$/.test(s.textContent.trim()))?.textContent);
ok('El anillo calcula un porcentaje > 0', pct && pct !== '0%', pct);
ok('Las barras musculares muestran volumen hecho',
  (await p.evaluate(() => [...document.body.innerText.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*\d/g)].filter(m => +m[1] > 0).length)) > 3);
ok('Etiqueta "semana actual" solo en el mes de hoy', await p.locator('text=/semana actual/i').count() === 1);
await p.locator('button[aria-label="Mes siguiente"]').click(); await p.waitForTimeout(600);
ok('Y desaparece al cambiar de mes', await p.locator('text=/semana actual/i').count() === 0);
await p.close();

// ══ 7 · PROTECCIÓN DE DÍAS CON REGISTRO ══
seccion('PROTECCIÓN DE DÍAS CON REGISTRO');
const diaConReg = ago.find(d => d.sesion === 'gymB');
const semillaReg = {
  v: 3, prs: {}, fijados: {}, festivos: ['2026-08-07', '2026-08-17'],
  prog: { [diaConReg.fecha]: { 'B-1': { sets: [true, true], logs: [{ kg: 50, reps: 6 }, { kg: 50, reps: 6 }] } } },
};
p = await nuevaPagina(semillaReg);
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await abrirDia(p, diaConReg.fecha);
ok('Sin cambiar la sesión no hay aviso', await p.locator('text=/ya tiene entrenamiento registrado/').count() === 0);
await p.evaluate(() => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => x.textContent.trim() === 'Descanso')?.click();
});
await p.waitForTimeout(350);
ok('Al cambiar de sesión avisa de que hay registro', await p.locator('text=/ya tiene entrenamiento registrado/').count() > 0);
const btnGuardar = () => p.evaluate(() => {
  const m = document.querySelector('.fixed.inset-0');
  const b = [...m.querySelectorAll('button')].find(x => /Cambiar y borrar|Guardar/.test(x.textContent));
  return { texto: b.textContent.trim(), deshabilitado: b.disabled };
});
let bg = await btnGuardar();
ok('El botón cambia a "Cambiar y borrar" y queda bloqueado', bg.texto === 'Cambiar y borrar' && bg.deshabilitado, JSON.stringify(bg));
await p.locator('input[type=checkbox]').check(); await p.waitForTimeout(250);
bg = await btnGuardar();
ok('Se desbloquea al confirmar la casilla', !bg.deshabilitado);
await p.evaluate(() => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => /Cambiar y borrar/.test(x.textContent))?.click();
});
await p.waitForTimeout(700);
const trasBorrar = await ls(p);
ok('Al confirmar, el registro huérfano se borra', !trasBorrar.prog[diaConReg.fecha], JSON.stringify(Object.keys(trasBorrar.prog)));
ok('Y el día queda en Descanso', (await sesionPorDia(p))[diaConReg.dia] === 'Descanso');
await p.close();

// El día con registro NO se mueve aunque se edite otro día
p = await nuevaPagina(semillaReg);
const sesionOriginal = (await sesionPorDia(p))[diaConReg.dia];
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await abrirDia(p, '2026-08-03');
await p.evaluate(() => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => x.textContent.trim() === 'Descanso')?.click();
});
await p.waitForTimeout(200);
await p.evaluate(() => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => /^Guardar$/.test(x.textContent.trim()))?.click();
});
await p.waitForTimeout(700);
ok('Editar otro día NO mueve la sesión del día con registro',
  (await sesionPorDia(p))[diaConReg.dia] === sesionOriginal,
  `${(await sesionPorDia(p))[diaConReg.dia]} vs ${sesionOriginal}`);
await p.close();

// Registrar una serie fija el día automáticamente
p = await nuevaPagina();
const diaLimpio = ago.find(d => d.sesion === 'gymA');
await abrirDia(p, diaLimpio.fecha);
await p.locator('button').filter({ hasText: /^1$/ }).first().click(); await p.waitForTimeout(500);
const trasRegistrar = await ls(p);
ok('Registrar una serie fija el día automáticamente',
  trasRegistrar.fijados[diaLimpio.fecha]?.auto === true, JSON.stringify(trasRegistrar.fijados));
ok('Y lo fija a la sesión que tenía', trasRegistrar.fijados[diaLimpio.fecha]?.sesion === diaLimpio.sesion);
await p.locator('text=Calendario').first().click(); await p.waitForTimeout(500);
const marcasAmbar = await p.evaluate(() => [...document.querySelectorAll('main button span.bg-amber-500')].length);
ok('El auto-fijado NO se marca con el icono ámbar de fijado a mano', marcasAmbar === 0, marcasAmbar + ' marcas');
await p.close();

// ══ 8 · YA NO QUEDA NINGÚN LILA FIJO ══
seccion('SIN COLOR AJENO');
p = await nuevaPagina({ v: 3, prog, prs: {}, fijados: {}, festivos: [] });
const restosLila = await p.evaluate(() => [...document.querySelectorAll('main button')]
  .filter(x => getComputedStyle(x).backgroundColor.includes('196, 181, 253')).length);
ok('Ninguna celda usa ya el lila #c4b5fd', restosLila === 0, restosLila + ' celdas');
const coloresFondo = await p.evaluate(() => [...new Set([...document.querySelectorAll('main button')]
  .map(x => getComputedStyle(x).backgroundColor).filter(c => c.includes('0.14')))]);
ok('Los rellenos de completado son varios colores distintos, uno por sesión',
  coloresFondo.length >= 3, coloresFondo.length + ' colores: ' + coloresFondo.join(' '));
await p.close();

// ══ 9 · SESIONES DOBLES Y COMPLEMENTOS ══
seccion('SESIONES DOBLES Y COMPLEMENTOS');
const agoD = generarMes({ anio: 2026, mes: 7 }).dias;
const diaDoble = agoD.find(d => d.sesionSecundaria);
const TORSO = ['gymA', 'gymB', 'gymD'];
const diaGymL = agoD.find(d => TORSO.includes(d.sesion) && ['L','P'].includes(d.turno) && !d.sesionSecundaria);
const diaGymPierna = agoD.find(d => ['gymC1', 'gymC2'].includes(d.sesion) && ['L', 'P'].includes(d.turno) && !d.sesionSecundaria);
const diaNat = agoD.find(d => d.sesion === 'natacion' && !d.sesionSecundaria);
const diaN = agoD.find(d => d.turno === 'N' && d.sesion.startsWith('gym'));

p = await nuevaPagina();
ok('El generador asignó algún día doblado en agosto', !!diaDoble, diaDoble ? `${diaDoble.fecha}: ${diaDoble.sesion} + ${diaDoble.sesionSecundaria}` : 'ninguno');
if (diaDoble) {
  const iconos = await p.evaluate(n => {
    const b = [...document.querySelectorAll('main button')].find(x => x.textContent.trim().startsWith(n + ' ·'));
    return b ? b.querySelectorAll('svg').length : 0;
  }, diaDoble.dia);
  ok('El día doblado muestra dos íconos en el calendario', iconos >= 2, iconos + ' svg');
}

// Un día de gym de PIERNA no puede ofrecer running como segunda sesión
if (diaGymPierna) {
  await abrirDia(p, diaGymPierna.fecha);
  await p.locator('text=/Añadir segunda sesión/').first().click();
  await p.waitForTimeout(400);
  const ofrecidas = await p.evaluate(() => [...document.querySelectorAll('main button')]
    .map(b => b.textContent.trim()).filter(t => /^(Running|Natación|Gym )/.test(t)));
  ok(`Gym de pierna NO ofrece running como segunda (${diaGymPierna.sesion})`,
    !ofrecidas.includes('Running'), 'ofrece: ' + ofrecidas.join(', '));
  ok('Sí ofrece natación', ofrecidas.includes('Natación'));
  ok('Explica por qué falta el running', await p.locator('text=/viola S3|pierna . carrera/i').count() > 0);
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(400);
}

// Un día de gym de TORSO sí ofrece running
if (diaGymL) {
  await abrirDia(p, diaGymL.fecha);
  await p.locator('text=/Añadir segunda sesión/').first().click();
  await p.waitForTimeout(400);
  const ofrecidas = await p.evaluate(() => [...document.querySelectorAll('main button')]
    .map(b => b.textContent.trim()).filter(t => /^(Running|Natación)/.test(t)));
  ok(`Gym de torso SÍ ofrece running (${diaGymL.sesion})`, ofrecidas.includes('Running'), 'ofrece: ' + ofrecidas.join(', '));
  // Añadirla y comprobar que persiste
  await p.evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Running')?.click());
  await p.waitForTimeout(600);
  const guardado = await ls(p);
  ok('La segunda sesión se guarda en extras', guardado.extras?.[diaGymL.fecha]?.secundaria === 'running',
    JSON.stringify(guardado.extras));
  ok('Y aparece como segunda sesión del día', await p.locator('text=/Segunda sesión del día/').count() > 0);
  // Separación
  await p.getByLabel('Separación entre sesiones').fill('2');
  await p.waitForTimeout(500);
  ok('Avisa si la separación es menor de 3h', await p.locator('text=/solo funciona si la segunda es corta/i').count() > 0);
  await p.getByLabel('Separación entre sesiones').fill('7');
  await p.waitForTimeout(500);
  ok('Con 7h dice que el orden es libre', await p.locator('text=/el orden da igual/i').count() > 0);
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(400);
}

// Turno N no permite doblar
if (diaN) {
  await abrirDia(p, diaN.fecha);
  ok('En turno N no se ofrece doblar', await p.locator('text=/Añadir segunda sesión/').count() === 0);
  ok('Y explica el motivo', await p.locator('text=/guardia a las 18h/i').count() > 0);
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(400);
}

// Complemento de calistenia: bloqueado en gym, permitido en natación
if (diaGymL) {
  await abrirDia(p, diaGymL.fecha);
  ok('La calistenia está bloqueada en día de gym', await p.locator('text=/Calistenia bloqueada hoy/').count() > 0);
  ok('Y explica por qué', await p.locator('text=/Duplicaría patrones/i').count() > 0);
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(400);
}
if (diaNat) {
  await abrirDia(p, diaNat.fecha);
  ok('En día de natación sí se puede añadir calistenia', await p.locator('text=/Añadir calistenia/').count() > 0);
  await p.locator('text=/Añadir calistenia/').first().click();
  await p.waitForTimeout(600);
  const g2 = await ls(p);
  ok('El complemento se guarda', (g2.extras?.[diaNat.fecha]?.complementos ?? []).includes('calistenia'));
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(500);
  const punto = await p.evaluate(n => {
    const b = [...document.querySelectorAll('main button')].find(x => x.textContent.trim().startsWith(n + ' ·'));
    return !!b?.querySelector('span.rounded-full[style*="168, 85, 247"]');
  }, diaNat.dia);
  ok('El día con complemento se marca en el calendario', punto);
}
await p.close();

// ══ 10 · CSS, DÍA FLEXIBLE Y EDITOR ══
seccion('CSS · TEST Y TABLA DE RITMOS');
const agoX = generarMes({ anio: 2026, mes: 7 }).dias;
const diaCSS = agoX.find(d => d.variante === 'natCSS');
const diaNatX = agoX.find(d => d.variante && d.variante !== 'natCSS');
p = await nuevaPagina();
await abrirDia(p, diaCSS.fecha);
ok('El test de CSS abre su calculadora', await p.locator('text=/Test de CSS/').count() > 0);
ok('Sin CSS aún, lo dice claramente', await p.locator('text=/Aún no tienes CSS/').count() > 0);
await p.getByLabel('Tiempo de los 400 metros').fill('6:40');
await p.getByLabel('Tiempo de los 200 metros').fill('3:10');
await p.waitForTimeout(500);
ok('Calcula el CSS del ejemplo del plan (1:45)', await p.locator('text=/Guardar CSS 1:45/').count() > 0);
await p.locator('text=/Guardar CSS/').first().click();
await p.waitForTimeout(600);
ok('El CSS se guarda', (await ls(p)).css != null, String((await ls(p)).css));
const filasCSS = await p.evaluate(() => [...document.querySelectorAll('table tbody tr')].map(r => r.textContent.trim()));
ok('Aparece la tabla con los cuatro ritmos', filasCSS.length === 4, filasCSS.join(' | '));
ok('Y el ritmo CSS sale a 1:45 por 100 m', filasCSS.some(f => f.startsWith('CSS0:531:45')), filasCSS[1]);
// Error: 400 más rápido que 200
await p.getByLabel('Tiempo de los 400 metros').fill('3:00');
await p.waitForTimeout(400);
ok('Rechaza tiempos imposibles', await p.locator('text=/tiene que ser mayor/').count() > 0);
await p.locator('text=Calendario').first().click(); await p.waitForTimeout(400);
await abrirDia(p, diaNatX.fecha);
ok('La tabla de ritmos se ve en cualquier sesión de agua', await p.locator('text=/Tus ritmos/').count() > 0);
ok('Y ya no muestra encabezados de gimnasio',
  await p.locator('text=/COMPUESTO SECUNDARIO/i').count() === 0);
await p.close();

seccion('DÍA FLEXIBLE · TRES CONDICIONES');
const diaFlex = agoX.find(d => d.flexible);
p = await nuevaPagina();
await abrirDia(p, diaFlex.fecha);
ok('El día flexible pregunta por el sueño', await p.locator('text=/Dormiste bien esta semana/').count() > 0);
ok('Y por el peso', await p.locator('text=/peso corporal va subiendo/').count() > 0);
ok('Muestra la condición 3 ya calculada', await p.locator('text=/dos días de gym seguidos/').count() > 0);
// Responder que no a una
await p.locator('button', { hasText: /^Sí$/ }).first().click(); await p.waitForTimeout(300);
await p.locator('button', { hasText: /^No$/ }).nth(1).click(); await p.waitForTimeout(500);
ok('Con una condición sin cumplir, manda descansar', await p.locator('text=/hoy .*descansas/i').count() > 0);
ok('Y explica cuál falla', await p.locator('text=/El peso no sube/').count() > 0);
// Ahora las dos que sí
await p.locator('button', { hasText: /^Sí$/ }).nth(1).click(); await p.waitForTimeout(500);
const puedeConvertir = await p.locator('text=/Las tres se cumplen/i').count() > 0;
ok('Con las tres cumplidas ofrece elegir cardio', puedeConvertir || diaFlex.flexibleCond3 === false,
  puedeConvertir ? 'ofrece' : 'cond3 no se cumplía ese día');
if (puedeConvertir) {
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Running')?.click());
  await p.waitForTimeout(800);
  ok('Al convertir, el día queda fijado a running',
    (await ls(p)).fijados?.[diaFlex.fecha]?.sesion === 'running',
    JSON.stringify((await ls(p)).fijados));
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(600);
  ok('Y el calendario lo muestra', (await sesionPorDia(p))[diaFlex.dia] === 'Running',
    (await sesionPorDia(p))[diaFlex.dia]);
}
await p.close();

seccion('EDITOR DE RUTINA');
p = await nuevaPagina();
const diaGymE = agoX.find(d => d.sesion === 'gymA');
await abrirDia(p, diaGymE.fecha);
await p.locator('text=/Editar esta rutina/').first().click();
await p.waitForTimeout(700);
ok('Abre el editor', await p.locator('text=/Editar Gym A/').count() > 0);
ok('El plan original pasa el verificador limpio', await p.locator('text=/Cumple todas las reglas/').count() > 0);
ok('No deja guardar sin motivo',
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Escribe el motivo/.test(b.textContent))?.disabled === true));
// Romper una regla: quitar el face pull
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button[aria-label^="Quitar Face pull"]')][0];
  b?.click();
});
await p.waitForTimeout(600);
ok('Al quitar el face pull avisa de E6', await p.locator('text=/E6/').count() > 0);
ok('Y explica que es el contrapeso obligatorio', await p.locator('text=/contrapeso obligatorio/i').count() > 0);
// Guardar con motivo
await p.getByLabel('Motivo del cambio').fill('probando el editor');
await p.waitForTimeout(400);
const txtBoton = await p.evaluate(() => [...document.querySelectorAll('button')]
  .map(b => b.textContent.trim()).find(t => t.startsWith('Guardar')));
ok('Con avisos, el botón dice cuántos hay', /^Guardar con \d+ aviso/.test(txtBoton ?? ''), txtBoton);
await p.locator('button', { hasText: /Guardar con/ }).first().click();
await p.waitForTimeout(800);
const trasEditar = await ls(p);
ok('La versión se guarda con su motivo',
  trasEditar.rutina?.gymA?.[0]?.motivo === 'probando el editor', JSON.stringify(Object.keys(trasEditar.rutina ?? {})));
ok('Y con fecha de hoy', /^\d{4}-\d{2}-\d{2}$/.test(trasEditar.rutina.gymA[0].desde));
ok('El face pull ya no está en la versión guardada',
  !trasEditar.rutina.gymA[0].ejercicios.some(e => /face pull/i.test(e.nombre)));
await p.waitForTimeout(400);
ok('La sesión se marca como editada', await p.locator('text=/· editada/').count() > 0);
await p.close();

// ══ 11 · BICI, BOTÓN ESTABLE Y DESCARGA ══
seccion('BICI EN EL DÍA FLEXIBLE');
const agoB = generarMes({ anio: 2026, mes: 7 }).dias;
const flexB = agoB.find(d => d.flexible && d.flexibleCond3 !== false);
p = await nuevaPagina();
await abrirDia(p, flexB.fecha);
// Responder que sí a las dos
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Sí'); b[0]?.click(); });
await p.waitForTimeout(250);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Sí'); b[1]?.click(); });
await p.waitForTimeout(500);
const opcionesCardio = await p.evaluate(() => [...document.querySelectorAll('button')]
  .map(b => b.textContent.trim()).filter(t => t === 'Running' || t === 'Bici'));
ok('Ofrece running Y bici', opcionesCardio.includes('Running') && opcionesCardio.includes('Bici'), opcionesCardio.join(', '));
ok('Explica por qué la bici en turno C', await p.locator('text=/sin castigar pies/i').count() > 0);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Bici')?.click());
await p.waitForTimeout(700);
ok('Elegir bici fija el día a ciclismo', (await ls(p)).fijados?.[flexB.fecha]?.sesion === 'ciclismo',
  JSON.stringify((await ls(p)).fijados));
await p.locator('text=Calendario').first().click(); await p.waitForTimeout(600);
ok('Y el calendario lo muestra', (await sesionPorDia(p))[flexB.dia] === 'Bici', (await sesionPorDia(p))[flexB.dia]);
await abrirDia(p, flexB.fecha);
ok('La sesión de bici tiene sus tres bloques Z2', await p.locator('text=/Z2 continuo/').count() > 0);
ok('Y avisa de que el cuádriceps sí trabaja', await p.locator('text=/cuádriceps SÍ trabaja/i').count() > 0);
await p.close();

seccion('BOTÓN SÍ/NO ESTABLE ENTRE RENDERS');
// Si el componente se recreara en cada render, el foco se perdería al pulsar
p = await nuevaPagina();
await abrirDia(p, flexB.fecha);
// Clic REAL (el programático no da foco). Si el componente se recreara en cada
// render, React remontaría el botón y el foco se perdería.
await p.getByRole('button', { name: 'Sí' }).first().click();
await p.waitForTimeout(400);
const focoTrasClic = await p.evaluate(() => document.activeElement?.textContent?.trim());
ok('El botón conserva el foco tras pulsarlo (no se remonta)', focoTrasClic === 'Sí', String(focoTrasClic));
const marcados = await p.evaluate(() => [...document.querySelectorAll('button')]
  .filter(b => /Sí|No/.test(b.textContent.trim()) && b.className.includes('emerald')).length);
ok('Y la respuesta queda marcada', marcados === 1, marcados + ' marcados');
await p.close();

seccion('SEMANA DE DESCARGA · AVISO EN EL DÍA');
const diaDesc = generarMes({ anio: 2026, mes: 8 }).dias.find(d => d.descarga && d.sesion.startsWith('gym'));
p = await nuevaPagina();
if (diaDesc) {
  // Navegar al mes de ese día
  await p.locator('button[aria-label="Mes siguiente"]').click(); await p.waitForTimeout(600);
  await abrirDia(p, diaDesc.fecha);
  // Se comprueba sobre el texto real de la página: los paréntesis y el + de
  // "DESCARGA (P4)" y "RIR +2" se pierden al escaparlos dentro de un string.
  const txtDesc = await p.evaluate(() => document.body.innerText);
  ok('El día de descarga lo avisa explícitamente', txtDesc.includes('DESCARGA (P4)'));
  ok('Y dice qué hacer: mitad de series y RIR +2',
    txtDesc.includes('mitad de las series') && txtDesc.includes('RIR +2'));
  ok('Explica que no se dobla esa semana', await p.locator('text=/No se doblan sesiones esta semana/i').count() > 0);
} else {
  ok('Hay un día de descarga que comprobar', false, 'no se encontró');
}
await p.close();

console.log('\n=== Errores de página: ' + (errores.length || 'ninguno') + ' ===');
if (errores.length) console.log(errores.slice(0, 5).join('\n'));
console.log(`\n══ ${n - fallos}/${n} pruebas de interfaz ══`);
