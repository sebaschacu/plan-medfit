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
// Las pruebas trabajan sobre el MES DEL ANCLA (agosto 2026), y "hoy" se FIJA
// dentro de ese mes: la app lee `plan-internado-hoy` de localStorage al
// arrancar (ver hoyISO en src/utiles/formato.js). Sin esto, la suite cambiaba
// de resultado según la semana real en que se ejecutara, porque la app pinta
// la sesión y el calendario de hoy antes de que el test pueda navegar.
const MES_TEST = { anio: 2026, mes: 7 };
const HOY = '2026-08-01';   // sábado, día del ancla; cae en la semana 0 del mes
const NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const hoyReal = new Date(HOY + 'T12:00:00');
const mesesDesdeHoy = (MES_TEST.anio * 12 + MES_TEST.mes) - (hoyReal.getFullYear() * 12 + hoyReal.getMonth());
let fallos = 0, n = 0;
const errores = [];
const ok = (t, c, x = '') => { n++; if (!c) fallos++; console.log(`  ${c ? '✅' : '❌'} ${t}${x ? ' — ' + x : ''}`); };
const seccion = (t) => console.log(`\n── ${t} ──`);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const nuevaPagina = async (seed, opts = {}) => {
  const p = await b.newPage({ viewport: { width: 430, height: 1400 }, ...opts });
  p.on('pageerror', e => errores.push(e.message.split('\n')[0]));
  await p.addInitScript(([h]) => localStorage.setItem('plan-internado-hoy', h), [HOY]);
  if (seed) await p.addInitScript(([s]) => localStorage.setItem('plan-internado', JSON.stringify(s)), [seed]);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  // La app arranca en la sesión de HOY (v7). Las pruebas parten del calendario,
  // y navegan hasta el mes del ancla para no depender de la fecha real.
  await p.locator('text=Calendario').first().click().catch(() => {});
  await p.waitForTimeout(500);
  // Si la app revienta al pintar el calendario, el fallo tiene que verse AQUÍ,
  // no 30 s después como un timeout en un test que no tiene nada que ver.
  // El botón de ajustes solo existe en la cabecera del calendario.
  if (await p.locator('header .lucide-settings').count() === 0) {
    const causa = errores.length ? ` · error de página: ${errores.at(-1)}` : '';
    throw new Error(`nuevaPagina: no se llegó al calendario${causa}`);
  }
  const btn = mesesDesdeHoy < 0 ? 'Mes anterior' : 'Mes siguiente';
  for (let i = 0; i < Math.abs(mesesDesdeHoy); i++) {
    await p.locator(`button[aria-label="${btn}"]`).click().catch(() => {});
    await p.waitForTimeout(160);
  }
  return p;
};
const ls = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('plan-internado')));
const titulo = (p) => p.locator('header h1').first().textContent({ timeout: 1500 }).catch(() => '‹PANTALLA ROTA›');
const abrirDia = async (p, fecha) => {
  await p.evaluate(d => [...document.querySelectorAll('main button')]
    .find(x => x.textContent.trim().startsWith(d + ' ·'))?.click(), Number(fecha.slice(8)));
  await p.waitForTimeout(600);
};
// El menú de sesiones va agrupado por categoría: para pulsar una hay que
// desplegar su grupo primero.
const elegirSesionEnModal = async (p, etiqueta, grupo) => {
  // El grupo del día ya viene desplegado: solo se pulsa la cabecera si está plegado
  const cab = p.locator(`button[aria-label="Categoría ${grupo}"]`);
  if ((await cab.getAttribute('aria-expanded')) !== 'true') {
    await cab.click();
    await p.waitForTimeout(250);
  }
  await p.locator(`button[aria-label="Elegir ${etiqueta}"]`).click();
  await p.waitForTimeout(250);
};

const sesionPorDia = (p) => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('main button')].map(x => x.textContent.match(/^(\d+) · [LCNP](.+?)(Hoy)?$/))
    .filter(Boolean).map(m => [Number(m[1]), m[2].trim()])));

// ══ 1 · NAVEGACIÓN DE MES ══
seccion('NAVEGACIÓN DE MES');
let p = await nuevaPagina();
const prev = p.locator('button[aria-label="Mes anterior"]');
const next = p.locator('button[aria-label="Mes siguiente"]');
ok('Se sitúa en el mes del ancla', (await titulo(p)) === `${NOMBRES[MES_TEST.mes]} ${MES_TEST.anio}`, await titulo(p));
ok('No deja retroceder antes del ancla', await prev.isDisabled());
for (let i = 0; i < 5; i++) { await next.click(); await p.waitForTimeout(180); }
ok('Cruza fin de año hacia delante', (await titulo(p)) === 'Enero 2027', await titulo(p));
for (let i = 0; i < 5; i++) { await prev.click(); await p.waitForTimeout(180); }
ok('Y vuelve correctamente', (await titulo(p)) === `${NOMBRES[MES_TEST.mes]} ${MES_TEST.anio}`, await titulo(p));
ok('El mes del ancla tiene 31 celdas', Object.keys(await sesionPorDia(p)).length === 31);
await p.close();

// ══ 2 · EDICIÓN: FIJAR Y RECALCULAR ══
seccion('EDICIÓN: FIJAR Y RECALCULAR');
p = await nuevaPagina();
const antes = await sesionPorDia(p);
// Un día donde toca gymA: se le va a fijar gymD, que SOLAPA con A (banca). Así se
// prueba también el guardarraíl, que es lo que decide qué viene después.
const diaEditable = generarMes(MES_TEST).dias.find(d => d.sesion === 'gymA' && d.dia > 3 && d.dia < 25);
const antesDelCambio = diaEditable.sesion;
const SESION_INFO_UI = (await import('./src/data.js')).SESION_INFO;
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await abrirDia(p, diaEditable.fecha);
ok('Se abre el modal', await p.locator(`text=/Editar día ${diaEditable.dia}/`).count() > 0);
const enModal = async (texto) => p.evaluate(t => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => x.textContent.trim() === t || new RegExp(t, 'i').test(x.textContent))?.click();
}, texto);
await elegirSesionEnModal(p, 'Gym D', 'Gym');
await enModal('Guardar'); await p.waitForTimeout(700);
const tras = await sesionPorDia(p);
ok(`El día ${diaEditable.dia} queda en Gym D`, tras[diaEditable.dia] === 'Gym D', 'quedó ' + tras[diaEditable.dia]);
const sig = Object.keys(tras).map(Number).filter(d => d > diaEditable.dia && /^Gym/.test(tras[d])).sort((a, b) => a - b)[0];
// Tocaba A y se fijó D: con 'no-avanza' a secas, A caería justo después (banca dos
// veces seguidas). El guardarraíl la salta: el siguiente gym no es A ni solapa con D.
ok('El siguiente gym NO repite el patrón de lo fijado (guardarraíl de solapes)',
  tras[sig] && tras[sig] !== SESION_INFO_UI[antesDelCambio]?.label && tras[sig] !== 'Gym D', `día ${sig} = ${tras[sig]}`);
ok('Y el calendario enseña el aviso de por qué se saltó',
  await p.locator('text=/se repetiría el mismo patrón/i').count() > 0);
await abrirDia(p, diaEditable.fecha);
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
ago.filter(d => d.dia !== 18 && d.dia !== 19).forEach(completar);
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
const diaSin = ago.find(d => !prog[d.fecha] && SESIONES[d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion]?.ejercicios.length);
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
// La primera semana del mes es sábado-domingo (natación + descanso): sin volumen
// muscular. Se avanza a una semana completa antes de comprobarlo.
await p.locator('button[aria-label="Semana siguiente"]').click(); await p.waitForTimeout(500);
ok('Las barras musculares muestran volumen hecho',
  (await p.evaluate(() => [...document.body.innerText.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*\d/g)].filter(m => +m[1] > 0).length)) > 3);
// La etiqueta "semana actual" solo aparece en la semana que contiene HOY. Se
// sale al mes siguiente (no puede estar), y al volver el panel debe recolocarse
// en la semana de hoy y enseñarla.
await p.locator('button[aria-label="Mes siguiente"]').click(); await p.waitForTimeout(300);
ok('No etiqueta "semana actual" en un mes que no es el de hoy',
  await p.locator('text=/semana actual/i').count() === 0);
await p.locator('button[aria-label="Mes anterior"]').click(); await p.waitForTimeout(300);
ok('Y sí la etiqueta al volver al mes de hoy', await p.locator('text=/semana actual/i').count() === 1);
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
await elegirSesionEnModal(p, 'Descanso', 'Descanso');
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
await elegirSesionEnModal(p, 'Descanso', 'Descanso');
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

// ══ 10b · AÑADIR EJERCICIO: AGRUPADO POR MÚSCULO ══
// La lista de candidatos salía plana (y cortada a 40). Ahora se agrupa por el
// músculo primario, con cabecera desplegable como el menú de sesiones. Cerrados
// al abrir; al buscar se abren todos.
seccion('EDITOR · AÑADIR AGRUPADO POR MÚSCULO');
p = await nuevaPagina();
await abrirDia(p, diaGymE.fecha);
await p.locator('text=/Editar esta rutina/').first().click(); await p.waitForTimeout(600);
await p.locator('button', { hasText: 'Añadir ejercicio' }).click(); await p.waitForTimeout(400);
const grupos = () => p.evaluate(() => [...document.querySelectorAll('button[aria-label^="Músculo "]')]
  .map(b => ({ label: b.getAttribute('aria-label').replace('Músculo ', ''), abierto: b.getAttribute('aria-expanded') === 'true' })));
const g0 = await grupos();
ok('Los candidatos vienen agrupados por músculo (cabeceras)', g0.length >= 8, `${g0.length} grupos: ${g0.slice(0, 6).map(g => g.label).join(', ')}…`);
ok('Todos los grupos empiezan cerrados', g0.every(g => !g.abierto));
ok('Sin abrir nada no se ve ningún ejercicio', await p.locator('button:has-text("Jalón pesado")').count() === 0);
ok('Empuje antes que tracción (el orden de MUSCULOS)', g0.findIndex(g => g.label === 'Pecho') < g0.findIndex(g => g.label === 'Dorsal'));
await p.locator('button[aria-label="Músculo Dorsal"]').click(); await p.waitForTimeout(300);
ok('Abrir "Dorsal" enseña sus ejercicios', await p.locator('button:has-text("Jalón pesado")').count() > 0);
ok('Y solo los suyos: los de pecho siguen ocultos', await p.locator('button:has-text("Fondos en paralelas")').count() === 0);
await p.locator('input[aria-label="Buscar ejercicio"]').fill('flexiones'); await p.waitForTimeout(400);
const gBusca = await grupos();
ok('Al buscar, los grupos que quedan se abren solos', gBusca.length > 0 && gBusca.every(g => g.abierto), gBusca.map(g => g.label).join(', '));
ok('Y solo aparecen las coincidencias', await p.locator('button:has-text("Flexiones")').count() > 0 && await p.locator('button:has-text("Jalón pesado")').count() === 0);
await p.locator('button:has-text("Flexiones")').first().click(); await p.waitForTimeout(400);
ok('Añadir desde el grupo funciona', await p.locator('main').locator('text=/Flexiones/').count() > 0
  && await p.locator('input[aria-label="Buscar ejercicio"]').count() === 0);
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

// Un flexible que viene de pierna: S3 prohíbe correr al día siguiente, y fijar el
// flexible a running se saltaría la regla (los fijados no pasan por el generador).
// Se ofrece solo la bici, con su aviso.
const flexTrasPierna = agoB.find(d => d.flexible && d.trasPierna && d.flexibleCond3 !== false);
ok('Hay un flexible tras pierna en agosto para probarlo', !!flexTrasPierna, flexTrasPierna?.fecha);
if (flexTrasPierna) {
  p = await nuevaPagina();
  await abrirDia(p, flexTrasPierna.fecha);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Sí'); b[0]?.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Sí'); b[1]?.click(); });
  await p.waitForTimeout(500);
  const opcionesTP = await p.evaluate(() => [...document.querySelectorAll('button')]
    .map(b => b.textContent.trim()).filter(t => t === 'Running' || t === 'Bici'));
  ok('Tras pierna NO ofrece running (S3)', !opcionesTP.includes('Running'), opcionesTP.join(', ') || 'ninguna');
  ok('Pero sí la bici', opcionesTP.includes('Bici'));
  ok('Y explica que ayer fue pierna', await p.locator('text=/Ayer fue pierna/i').count() > 0);
  await p.close();
}

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

// ══ 12 · USAR LA CARGA SUGERIDA ══
seccion('USAR LA CARGA SUGERIDA');
const mesU = generarMes(MES_TEST).dias;
const gymU = mesU.find(d => d.sesion === 'gymA') ?? mesU.find(d => d.sesion.startsWith('gym'));
p = await nuevaPagina({
  v: 3, prs: {}, fijados: {}, extras: {},
  // Una sesión previa completa a 40 kg → la sugerencia debe ser 42.5
  prog: { '2026-08-03': { 'A-1': { sets: [true, true, true, true], logs: Array(4).fill({ kg: 40, reps: 8 }) } } },
});
await abrirDia(p, gymU.fecha);
const txtU = await p.evaluate(() => document.body.innerText);
ok('El historial de la última vez es visible sin tocar nada', /Última vez/i.test(txtU));
ok('Y la sugerencia también', /Sugerido/i.test(txtU));
const btnU = p.locator('button[aria-label^="Usar "]');
ok('Hay botón para usar la carga sugerida', await btnU.count() > 0,
  await btnU.count() ? await btnU.first().getAttribute('aria-label') : 'ninguno');
ok('Sugiere +2.5 kg sobre los 40 de la última vez',
  /Usar 42\.5 kg/.test((await btnU.first().getAttribute('aria-label')) ?? ''));
await btnU.first().click(); await p.waitForTimeout(700);
const logsU = (await ls(p)).prog?.[gymU.fecha]?.['A-1']?.logs ?? [];
ok('Rellena la carga en todas las series', logsU.length === 4 && logsU.every(l => l?.kg === 42.5),
  JSON.stringify(logsU));
ok('Sin tocar las reps: la sugerencia es de carga, no de ejecución',
  logsU.every(l => l?.reps == null));
// Los campos de kg no se ven hasta marcar la serie: el botón tiene que confirmar por sí solo
ok('El botón pasa a "Puesto": se ve que ya está hecho',
  await p.locator('span[aria-label*="42.5 kg puestos en las 4 series"]').count() === 1 && await btnU.count() === 0);
// Y si no se entrena ese día, esos kg no son una sesión. Desde el SIGUIENTE gymA,
// la "Última vez" tiene que seguir siendo la real (3 de agosto), no el fantasma.
const gymU2 = mesU.find(d => d.sesion === 'gymA' && d.fecha > gymU.fecha);
ok('Hay otro gymA en agosto para comprobarlo', !!gymU2, gymU2?.fecha);
if (gymU2) {
  await p.locator('text=Calendario').first().click(); await p.waitForTimeout(400);
  await abrirDia(p, gymU2.fecha);
  const txtU2 = await p.evaluate(() => document.body.innerText);
  ok('Sin marcar ninguna serie, "Última vez" sigue siendo el 3 de agosto: no hay sesión fantasma',
    /Última vez \(03\/08\)/.test(txtU2), (txtU2.match(/Última vez \([^)]+\)/) ?? ['sin última vez'])[0]);
  ok('Y la sugerencia sigue siendo subir a 42.5, no "0 reps máx"',
    /Sugerido: 42\.5 kg/.test(txtU2) && !/0 reps máx/.test(txtU2));
}
await p.close();

// ══ 13 · SELECTOR DE VARIANTE: SOLTAR Y PROTEGER EL REGISTRO ══
// Dos fugas encontradas fuera de las suites:
//  · "volver a la sugerida" dejaba el día fijado a su sesión, fuera de la rotación
//  · cambiar de sesión desde el selector saltaba la protección de días con registro
seccion('SELECTOR DE VARIANTE');
const abrirSelector = async (p) => { await p.evaluate(() => [...document.querySelectorAll('button')]
  .find(b => /SESIÓN DE HOY/i.test(b.textContent))?.click()); await p.waitForTimeout(350); };
const pulsar = async (p, txt, ms = 600) => { await p.evaluate(x => [...document.querySelectorAll('button')]
  .find(b => b.textContent.trim().startsWith(x))?.click(), txt); await p.waitForTimeout(ms); };

const mesV = generarMes(MES_TEST).dias;
const natV = mesV.find(d => d.sesion === 'natacion');
const gymV = mesV.find(d => d.sesion.startsWith('gym'));

p = await nuevaPagina();
await abrirDia(p, natV.fecha);
await abrirSelector(p); await pulsar(p, 'Swim B3');
ok('Elegir una variante la fija', !!(await ls(p)).fijados?.[natV.fecha]?.variante);
await abrirSelector(p);
await p.evaluate(() => [...document.querySelectorAll('button')]
  .find(b => /Volver a la que toca/i.test(b.textContent))?.click());
await p.waitForTimeout(600);
ok('Volver a la sugerida suelta el día entero, no solo la variante',
  Object.keys((await ls(p)).fijados ?? {}).length === 0, JSON.stringify((await ls(p)).fijados));
await p.close();

p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {},
  prog: { [gymV.fecha]: { 'A-1': { sets: [true, true], logs: Array(2).fill({ kg: 40, reps: 8 }) } } } });
await abrirDia(p, gymV.fecha);
await abrirSelector(p); await pulsar(p, 'Gym C1');
ok('Cambiar de sesión con registro avisa antes',
  /ejercicio\(s\) registrados/i.test(await p.evaluate(() => document.body.innerText)));
ok('Y no cambia nada hasta confirmar', !(await ls(p)).fijados?.[gymV.fecha]);
await pulsar(p, 'Cancelar', 400);
ok('Cancelar conserva el registro', !!(await ls(p)).prog?.[gymV.fecha]?.['A-1']);
await pulsar(p, 'Gym C1'); await pulsar(p, 'Cambiar y borrar');
const dV = await ls(p);
ok('Confirmar cambia la sesión', dV.fijados?.[gymV.fecha]?.sesion === 'gymC1');
ok('Y borra el registro que quedaría huérfano', !dV.prog?.[gymV.fecha]);
await p.close();

// ══ 14 · IMPORTAR RESTAURA TODO LO QUE EXPORTA ══
// snapshot() guarda 7 campos; onImportar solo restauraba 5. Importar un respaldo
// borraba en silencio las rutinas editadas, el test CSS y los complementos.
seccion('EXPORTAR / IMPORTAR COMPLETO');
const irAConfig = async (p) => {
  await p.evaluate(() => document.querySelector('header .lucide-settings')?.closest('button')?.click());
  await p.waitForTimeout(500);
};
const respaldo = {
  v: 3, festivos: [], fijados: {}, css: 92, prs: { 'A-1': { kg: 45 } },
  prog: { [gymV.fecha]: { 'A-1': { sets: [true], logs: [{ kg: 45, reps: 8 }] } } },
  extras: { [gymV.fecha]: { sueno: true } },
  rutina: { gymA: [{ desde: '2026-01-01', ejercicios: [
    { id: 'A-1', parte: 1, nombre: 'Press banca IMPORTADO', series: 4, reps: '5-8', descanso: '3 min',
      musculos: { primario: ['pecho'], secundario: [] } }] }] },
};
fs.writeFileSync('/tmp/respaldo-test.json', JSON.stringify(respaldo));
fs.writeFileSync('/tmp/ajeno-test.json', JSON.stringify({ hola: 'mundo' }));

p = await nuevaPagina();
await irAConfig(p);
await p.locator('input[type=file]').setInputFiles('/tmp/respaldo-test.json');
await p.waitForTimeout(1200);
const dI = await ls(p);
ok('Importar restaura el progreso', !!dI.prog?.[gymV.fecha]?.['A-1']);
ok('Importar restaura los PRs', dI.prs?.['A-1']?.kg === 45);
ok('Importar restaura las rutinas editadas', !!dI.rutina?.gymA, JSON.stringify(Object.keys(dI.rutina ?? {})));
ok('Importar restaura el test CSS', dI.css === 92, String(dI.css));
ok('Importar restaura los complementos y el sueño', dI.extras?.[gymV.fecha]?.sueno === true);
ok('El aviso dice cuántas rutinas vinieron',
  /rutina editada/i.test(await p.evaluate(() => document.body.innerText)));
await p.close();

p = await nuevaPagina(respaldo);
await irAConfig(p);
await p.locator('input[type=file]').setInputFiles('/tmp/ajeno-test.json');
await p.waitForTimeout(1000);
const dA = await ls(p);
ok('Un JSON ajeno se rechaza',
  /no parece un respaldo/i.test(await p.evaluate(() => document.body.innerText)));
ok('Y no borra ni la rutina ni el progreso', !!dA.rutina?.gymA && !!dA.prog?.[gymV.fecha]);
await p.close();

// ══ 15 · LA BIBLIOTECA MUESTRA LA RUTINA VIGENTE ══
seccion('BIBLIOTECA');
p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, css: null, prog: {},
  rutina: { gymA: [{ desde: '2020-01-01', motivo: 'prueba', ejercicios: [
    { id: 'A-1', parte: 1, nombre: 'MI PRESS PERSONALIZADO', series: 4, reps: '5-8', descanso: '3 min',
      musculos: { primario: ['pecho'], secundario: [] } }] }] } });
await p.evaluate(() => document.querySelector('header button[aria-label="Biblioteca de rutinas"]')?.click());
await p.waitForTimeout(600);
ok('Se abre la biblioteca', /Biblioteca de rutinas/i.test(await p.evaluate(() => document.body.innerText)));
await pulsar(p, 'Gym A');
ok('Enseña la rutina editada, no el plan base',
  /MI PRESS PERSONALIZADO/.test(await p.evaluate(() => document.body.innerText)));
await p.close();

// ══ 16 · MIGRACIÓN DE UN RESPALDO v2 REAL ══
seccion('MIGRACIÓN v2 → v3');
p = await nuevaPagina({
  prog: { 12: { 'A-1': { sets: [true], logs: [{ kg: 42.5, reps: 8 }] } } },
  prs: { 'A-1': { kg: 42.5 } },
  cal: [{ dia: 12, turno: 'L', sesion: 'gymA' },
        { dia: 19, turno: 'C', sesion: 'descanso', festivo: true }],
});
const dM = await ls(p);
ok('Migra a v3', dM.v === 3, 'v=' + dM.v);
ok('Reindexa el progreso a fecha ISO',
  Object.keys(dM.prog ?? {}).every(k => /^\d{4}-\d{2}-\d{2}$/.test(k)), JSON.stringify(Object.keys(dM.prog ?? {})));
ok('Sin perder la carga registrada', JSON.stringify(dM.prog).includes('42.5'));
ok('Conserva el PR', dM.prs?.['A-1']?.kg === 42.5);
ok('El festivo del calendario v2 acaba en `festivos`, que es donde lo lee el generador',
  (dM.festivos ?? []).includes('2026-08-19') && !dM.fijados?.['2026-08-19'], JSON.stringify(dM.festivos));
ok('Y no pisa los festivos por defecto', (dM.festivos ?? []).includes('2026-08-07'));
ok('Descarta el calendario v2 escrito a mano', dM.cal === undefined);
ok('Los campos de v7 nacen con valor válido',
  typeof dM.rutina === 'object' && typeof dM.extras === 'object');
await p.close();

// ══ 16a · LOS MÚSCULOS DE CADA EJERCICIO, VISIBLES SIN TOCAR NADA ══
// El dato ya estaba en data.js para las estadísticas; ahora se enseña bajo el
// nombre: primarios delante y marcados, secundarios detrás y apagados.
seccion('MÚSCULOS VISIBLES EN LA SESIÓN');
const gymM = ago.find(d => d.sesion === 'gymA');
p = await nuevaPagina();
await abrirDia(p, gymM.fecha);
const musculosDe = (nombre) => p.evaluate((nom) => {
  const h3 = [...document.querySelectorAll('main h3')].find(h => h.textContent.trim().startsWith(nom));
  const el = h3?.parentElement.querySelector('[aria-label="Músculos que trabaja"]');
  if (!el) return null;
  const prim = [...el.querySelectorAll('.text-slate-300')].map(s => s.textContent.replace(/·/g, '').trim());
  const sec = el.querySelector('.text-slate-500')?.textContent.replace(/·/g, '').trim() ?? '';
  return { texto: el.textContent.trim(), prim, sec };
}, nombre);
const mBanca = await musculosDe('Press banca');
ok('La banca enseña sus músculos bajo el nombre, sin tocar nada', !!mBanca, mBanca?.texto);
ok('Primarios delante y marcados: Pecho y Tríceps', mBanca?.prim.includes('Pecho') && mBanca?.prim.includes('Tríceps'), mBanca?.prim.join(', '));
ok('Secundario detrás y apagado: Deltoides ant.', /Deltoides ant\./.test(mBanca?.sec ?? ''), mBanca?.sec);
ok('En el orden primarios · secundarios', mBanca && mBanca.texto.indexOf('Pecho') < mBanca.texto.indexOf('Deltoides ant.'));
const mFacePull = await musculosDe('Face pull');
ok('El face pull también (Deltoides post. primario)', mFacePull?.prim.includes('Deltoides post.'), mFacePull?.texto);
await p.close();
// Un ejercicio con `musculos` malformado no enseña nada, pero tampoco revienta la tarjeta
p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, css: null, prog: {},
  rutina: { gymA: [{ desde: '2026-01-01', ejercicios: [
    { id: 'A-1', parte: 1, nombre: 'Press malformado', series: 4, reps: '5-8', descanso: '3 min', musculos: { pectoral: 1 } }] }] } });
await abrirDia(p, gymM.fecha);
ok('Con músculos malformados la tarjeta se pinta igual', await p.locator('main h3', { hasText: 'Press malformado' }).count() === 1);
ok('Y no enseña una línea de músculos vacía', (await musculosDe('Press malformado')) === null);
ok('Sin errores de página', errores.length === 0, errores.slice(-1).join(''));
await p.close();

// ══ 16b · EL TEMPORIZADOR SE REINICIA CON CADA SERIE ══
// Antes, si marcabas la siguiente serie antes de que sonara, el temporizador
// seguía con la cuenta anterior. Cada serie marcada debe reiniciarlo con el
// descanso del ejercicio que acabas de marcar — también en una bi-serie con
// descansos distintos.
seccion('TEMPORIZADOR · SE REINICIA CON CADA SERIE');
const gymT = ago.find(d => d.sesion === 'gymA');
p = await nuevaPagina();
await abrirDia(p, gymT.fecha);
// Botón "n" de la serie n dentro de la tarjeta cuyo título empieza por `nombre`
const marcarSerie = (nombre, n) => p.evaluate(([nom, num]) => {
  const h3 = [...document.querySelectorAll('main h3')].find(h => h.textContent.trim().startsWith(nom));
  const card = h3?.closest('.rounded-lg');
  [...(card?.querySelectorAll('button') ?? [])].find(b => b.textContent.trim() === String(num))?.click();
}, [nombre, n]);
const segundosTimer = () => p.evaluate(() => {
  const t = [...document.querySelectorAll('div')].map(d => d.textContent.trim()).find(x => /^\d\d:\d\d$/.test(x));
  if (!t) return null; const [m, s] = t.split(':').map(Number); return m * 60 + s;
});
const nombreTimer = () => p.evaluate(() => document.querySelector('.fixed.bottom-4')?.innerText.replace(/\n+/g, ' | ') ?? null);

await marcarSerie('Press banca', 1); await p.waitForTimeout(400);
const t1 = await segundosTimer();
ok('Marcar la serie 1 de banca arranca 3 min', t1 != null && t1 >= 178 && t1 <= 180, `${t1}s`);
await p.waitForTimeout(2500);
const t2 = await segundosTimer();
ok('El temporizador va bajando', t2 != null && t2 < t1, `${t1}s → ${t2}s`);
await marcarSerie('Press banca', 2); await p.waitForTimeout(400);
const t3 = await segundosTimer();
ok('Marcar la serie 2 REINICIA a 3 min, no sigue la cuenta anterior', t3 != null && t3 > t2 && t3 >= 178, `${t2}s → ${t3}s`);
// Bi-serie: el press inclinado descansa 60 s. Marcar su serie manda su descanso, no el de banca.
await marcarSerie('Press inclinado', 1); await p.waitForTimeout(400);
const t4 = await segundosTimer();
ok('Marcar un ejercicio de 60 s pone el temporizador a 60 s (el del ejercicio recién marcado)',
  t4 != null && t4 >= 58 && t4 <= 60, `${t4}s`);
ok('Y el nombre del overlay es el del ejercicio recién marcado', /Press inclinado/.test(await nombreTimer() ?? ''), await nombreTimer());
// Desmarcar NO arranca nada nuevo
await p.locator('button', { hasText: 'SALTAR' }).click(); await p.waitForTimeout(300);
await marcarSerie('Press inclinado', 1); await p.waitForTimeout(400);
ok('Desmarcar una serie no arranca el temporizador', (await segundosTimer()) == null);
await p.close();

// ══ 17 · UN RESPALDO CON EJERCICIOS MALFORMADOS NO DEJA EL CALENDARIO EN BLANCO ══
// `musculos` es metadata que llegó en la v6. Un respaldo anterior, o uno editado
// a mano, puede traerlo con otra forma o sin `primario`. VolumenMuscular hacía
// `ex.musculos.primario.forEach` y reventaba la pantalla del calendario entera
// —sin mensaje— en cuanto la semana visible contenía esa sesión. Se probaron
// dos formas rotas distintas, más un ejercicio bien formado que sí debe contar.
seccion('RESPALDO CON EJERCICIOS MALFORMADOS');
const gymA4 = ago.find(d => d.fecha === '2026-08-04');   // gymA, semana 1 (lun 3 – dom 9)
p = await nuevaPagina({
  v: 3, prs: {}, fijados: {}, extras: {}, css: null,
  prog: { '2026-08-04': { 'A-1': { sets: [true, true], logs: [{ kg: 40, reps: 8 }, { kg: 40, reps: 8 }] } } },
  rutina: { gymA: [{ desde: '2026-01-01', motivo: 'prueba', ejercicios: [
    { id: 'A-1', parte: 1, nombre: 'Press bien formado', series: 4, reps: '5-8', descanso: '3 min',
      musculos: { primario: ['pecho'], secundario: ['triceps'] } },
    { id: 'A-2', parte: 1, nombre: 'Press forma v5', series: 3, reps: '6-8', descanso: '2 min',
      musculos: { pectoral: 1 } },                           // sin primario/secundario
    { id: 'A-3', parte: 2, nombre: 'Press primario string', series: 3, reps: '8-12', descanso: '60s',
      musculos: { primario: 'pecho', secundario: null } },   // string en vez de array
  ] }] },
});
// nuevaPagina ya lanza si no se llega al calendario. Hoy (1 ago) cae en la
// semana 0, sin gymA: el panel arranca ahí. Se pasa a la semana 1, que sí lo tiene.
ok('El calendario pinta con la rutina malformada cargada', await p.locator('header .lucide-settings').count() === 1);
await p.locator('button[aria-label="Semana siguiente"]').click(); await p.waitForTimeout(500);
ok('El panel de volumen sigue en pie en la semana del gym malformado',
  await p.locator('text=/Volumen por grupo muscular/i').count() === 1
  && /3 – 9 de Agosto/.test(await p.evaluate(() => document.body.innerText)));
// innerText separa etiqueta y cifra con un salto de línea: "Pecho\n2 / 11".
// Las 2 series hechas de A-1 son las que cuentan; A-2 y A-3 aportan 0.
const pecho = await p.evaluate(() => document.body.innerText.match(/Pecho\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/));
ok('El ejercicio bien formado sí cuenta (pecho hecho 2, planificado > 0)',
  pecho && +pecho[1] === 2 && +pecho[2] > 0, pecho ? `${pecho[1]} / ${pecho[2]}` : 'sin fila de pecho');
ok('Y los malformados no reventaron la página', errores.length === 0, errores.slice(-2).join(' | '));
ok('Un día de la semana rota se puede abrir', gymA4 && (await abrirDia(p, gymA4.fecha), await p.locator('text=/ejercicios/i').count() > 0));
await p.close();


console.log('\n=== Errores de página: ' + (errores.length || 'ninguno') + ' ===');
if (errores.length) console.log(errores.slice(0, 5).join('\n'));
console.log(`\n══ ${n - fallos}/${n} pruebas de interfaz ══`);

// Sin esto el proceso queda vivo con el navegador abierto y la suite nunca termina.
await b.close();
process.exit(fallos || errores.length ? 1 : 0);
