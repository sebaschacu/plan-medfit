// ═══════════════ PRUEBAS DE INTERFAZ ═══════════════
// Requiere: npm i -D playwright  ·  npm run build  ·  npx vite preview --port 4173
// Uso:      node test-ui.mjs
//
// Cubre lo que test-generador.mjs no puede ver: navegación, edición, persistencia,
// migración v2→v3, exportar/importar y el registro de series en la sesión.
import { chromium } from 'playwright';
import fs from 'fs';
import { generarMes } from './src/generador.js';
import { SESIONES, SESION_INFO as INFO_RUN, VARIANTES_DE } from './src/data.js';
// Lo que puede enseñar una celda de running: la genérica o cualquiera de sus variantes.
const ETIQUETAS_RUN = ['Running', ...VARIANTES_DE.running.map(k => INFO_RUN[k].label)];

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

// ─── Navegación del rediseño D ───
// Cuatro pestañas abajo (Hoy · Calendario · Progreso · Rutinas). Tocar un día
// del calendario abre ese DÍA (qué toca, sueño, segunda sesión); su sesión se
// abre desde ahí con el botón grande. La sesión no lleva barra inferior.
const pestana = (p, nombre) => p.locator('nav[aria-label="Secciones"] button', { hasText: nombre }).first();
const alCalendario = async (p) => {
  if (await p.locator('nav[aria-label="Secciones"]').count() === 0) {
    await p.locator('button[aria-label="Volver al día"]').click().catch(() => {});
    await p.waitForTimeout(300);
  }
  await pestana(p, 'Calendario').click().catch(() => {});
  await p.waitForTimeout(450);
};
const nuevaPagina = async (seed, opts = {}) => {
  const p = await b.newPage({ viewport: { width: 430, height: 1400 }, ...opts });
  p.on('pageerror', e => errores.push(e.message.split('\n')[0]));
  await p.addInitScript(([h]) => localStorage.setItem('plan-internado-hoy', h), [HOY]);
  if (seed) await p.addInitScript(([s]) => localStorage.setItem('plan-internado', JSON.stringify(s)), [seed]);
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1100);
  // La app arranca en HOY. Las pruebas parten del calendario, y navegan hasta
  // el mes del ancla para no depender de la fecha real.
  await pestana(p, 'Calendario').click().catch(() => {});
  await p.waitForTimeout(500);
  // Si la app revienta al pintar el calendario, el fallo tiene que verse AQUÍ,
  // no 30 s después como un timeout en un test que no tiene nada que ver.
  // El botón de ajustes de la cabecera solo existe en el calendario.
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
// Toca la celda del día (en modo edición abre su hoja de edición)
const abrirDia = async (p, fecha) => {
  await p.locator(`main button[data-dia="${Number(fecha.slice(8))}"]`).click();
  await p.waitForTimeout(600);
};
// Desde el día, el botón grande: «Empezar sesión», «Continuar», «Ver sesión»…
const entrarSesion = async (p) => {
  await p.locator('button', { hasText: /^(Empezar sesión|Empezar versión reducida|Continuar ·|Ver sesión)/ }).first().click();
  await p.waitForTimeout(600);
};
const abrirSesion = async (p, fecha) => { await abrirDia(p, fecha); await entrarSesion(p); };
// En la sesión hay un ejercicio abierto y el resto son filas: se abre por su nombre.
const abrirEjercicio = async (p, nombre) => {
  const abierto = await p.evaluate(nom => [...document.querySelectorAll('[data-abierto] h3')]
    .some(h => h.textContent.trim().startsWith(nom)), nombre);
  if (!abierto) {
    await p.locator('[data-ejercicio] button[data-fila]', { hasText: nombre }).first().click();
    await p.waitForTimeout(300);
  }
};
// «Hecha» de un toque sobre la serie n del ejercicio
const hecha = async (p, nombre, n, ms = 400) => {
  await abrirEjercicio(p, nombre);
  await p.locator(`button[aria-label^="Hecha la serie ${n} de ${nombre}"]`).first().click();
  await p.waitForTimeout(ms);
};
const saltarDescanso = (p) => p.locator('button', { hasText: /^Saltar$/ }).click().catch(() => {});
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
// Lo que enseña cada celda del mes, por número de día
const sesionPorDia = (p) => p.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('main button[data-dia]')].map(x => [Number(x.dataset.dia), x.dataset.etiqueta])));

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
// Vista semana: los siete días de la semana, con el nombre entero
await p.getByRole('tab', { name: 'Semana' }).click(); await p.waitForTimeout(300);
const filasSemana = await p.evaluate(() => [...document.querySelectorAll('main button')].filter(b => /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d/.test(b.textContent.trim())).length);
ok('La vista semana enseña los días de la semana en filas', filasSemana >= 1 && filasSemana <= 7, filasSemana + ' filas');
await p.getByRole('tab', { name: 'Mes' }).click(); await p.waitForTimeout(300);
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
ok('Se abre la hoja de editar día', await p.locator(`text=/Editar día ${diaEditable.dia}/`).count() > 0);
const enModal = async (texto) => p.evaluate(t => {
  const m = document.querySelector('.fixed.inset-0');
  [...m.querySelectorAll('button')].find(x => x.textContent.trim() === t || new RegExp(t, 'i').test(x.textContent))?.click();
}, texto);
await elegirSesionEnModal(p, 'Torso', 'Gym');
await enModal('Guardar'); await p.waitForTimeout(700);
const tras = await sesionPorDia(p);
ok(`El día ${diaEditable.dia} queda en Torso`, tras[diaEditable.dia] === 'Torso', 'quedó ' + tras[diaEditable.dia]);
ok('Y se marca como fijado a mano', await p.locator(`main button[data-dia="${diaEditable.dia}"][data-fijado-a-mano]`).count() === 1);
const GYMS_UI = ['Empuje', 'Tracción', 'Torso', 'Pierna fuerza', 'Pierna volumen'];
const sig = Object.keys(tras).map(Number).filter(d => d > diaEditable.dia && GYMS_UI.some(g => (tras[d] ?? '').startsWith(g))).sort((a, b) => a - b)[0];
// Tocaba A y se fijó D: con 'no-avanza' a secas, A caería justo después (banca dos
// veces seguidas). El guardarraíl la salta: el siguiente gym no es A ni solapa con D.
ok('El siguiente gym NO repite el patrón de lo fijado (guardarraíl de solapes)',
  tras[sig] && !tras[sig].startsWith(SESION_INFO_UI[antesDelCambio]?.label) && !tras[sig].startsWith('Torso'), `día ${sig} = ${tras[sig]}`);
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
ok('El día dice con qué se empieza', /Empiezas con\s*Press banca con barra/.test(await p.evaluate(() => document.body.innerText)));
await entrarSesion(p);
ok('La sesión abre el primer ejercicio, con su botón «Hecha»',
  await p.locator('button[aria-label^="Hecha la serie 1 de Press banca"]').count() === 1);
ok('El resto de ejercicios van plegados en filas',
  await p.locator('[data-ejercicio] button[data-fila]').count() >= 8);
await hecha(p, 'Press banca', 1, 450);
ok('Un toque en «Hecha» guarda la serie indexada por FECHA', !!(await ls(p)).prog[diaGym.fecha]?.['A-1']?.sets?.[0]);
ok('Arranca el temporizador de descanso', await p.locator('text=/Descansando/i').count() > 0);
// Corregir con la rueda: desde el temporizador, sobre la serie recién guardada
await p.getByRole('button', { name: 'Corregir' }).click(); await p.waitForTimeout(400);
ok('«Corregir» abre la rueda de la serie 1', await p.locator('[role=dialog]', { hasText: 'Serie 1' }).count() === 1);
ok('La rueda tiene kilos y repeticiones',
  await p.locator('[role=spinbutton][aria-label="Rueda de kilos"]').count() === 1 && await p.locator('[role=spinbutton][aria-label="Rueda de repeticiones"]').count() === 1);
await p.getByLabel('kg', { exact: true }).fill('52.5');
await p.getByLabel('rep', { exact: true }).fill('6');
await p.locator('[role=dialog] button', { hasText: 'Guardar' }).click(); await p.waitForTimeout(450);
ok('Guarda carga y reps', (await ls(p)).prog[diaGym.fecha]['A-1'].logs[0]?.kg === 52.5 && (await ls(p)).prog[diaGym.fecha]['A-1'].logs[0]?.reps === 6);
ok('Detecta el PR', (await ls(p)).prs['A-1']?.kg === 52.5);
ok('La serie 2 propone lo de la serie 1 (52.5 × 6)',
  /52\.5 × 6/.test(await p.locator('button[aria-label^="Hecha la serie 2 de Press banca"]').getAttribute('aria-label')));
await p.getByRole('button', { name: /reset/i }).first().click(); await p.waitForTimeout(500);
ok('Reset borra solo ese día', !(await ls(p)).prog[diaGym.fecha]);
ok('Y conserva el PR histórico', (await ls(p)).prs['A-1']?.kg === 52.5);
await alCalendario(p);
await abrirDia(p, diaP.fecha);
ok('El posturno pregunta el sueño (S4)', await p.locator('text=/Cuánto dormiste/i').count() > 0);
ok('Con dos botones: menos de 6 h y 6 h o más',
  await p.getByRole('button', { name: /Menos de 6 h/ }).count() === 1 && await p.getByRole('button', { name: /6 h o más/ }).count() === 1);
await entrarSesion(p);
ok('Sin series marcadas no hay botón Reset', await p.getByRole('button', { name: /reset/i }).count() === 0);
await p.locator('button[aria-label="Volver al día"]').click(); await p.waitForTimeout(400);
await p.getByRole('button', { name: /Menos de 6 h/ }).click(); await p.waitForTimeout(500);
ok('Menos de 6 h se guarda como horas (< 6) en el mismo campo', Number((await ls(p)).prog[diaP.fecha]?.__sueno) < 6, String((await ls(p)).prog[diaP.fecha]?.__sueno));
const txtS4 = await p.evaluate(() => document.body.innerText);
ok('Con menos de 6 h: sesión reducida, no descanso (S4 a dos tramos)', /sesión reducida/i.test(txtS4) && !/descanso completo/i.test(txtS4));
ok('El botón principal pasa a «Empezar versión reducida»', await p.locator('button', { hasText: 'Empezar versión reducida' }).count() === 1);
ok('Y no se ofrece segunda sesión', await p.locator('text=/Añadir segunda sesión/').count() === 0 && /Hoy sin segunda sesión/.test(txtS4));
await p.getByRole('button', { name: /6 h o más/ }).click(); await p.waitForTimeout(500);
ok('6 h o más: sesión normal', Number((await ls(p)).prog[diaP.fecha]?.__sueno) >= 6 && await p.locator('button', { hasText: /^Empezar sesión/ }).count() === 1);
await entrarSesion(p);
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
ok('Los pinta en el calendario', await p.locator('main button[data-festivo]').count() === 3);
await p.close();

// ══ 5 · EXPORTAR / IMPORTAR ══
// Viven en Ajustes (la rueda de la cabecera). Importar reemplaza todo, así que
// se confirma antes.
seccion('EXPORTAR / IMPORTAR');
const irAAjustes = async (p) => { await p.locator('header button[aria-label="Ajustes"]').first().click(); await p.waitForTimeout(500); };
const importar = async (p, ruta, ms = 800) => {
  await p.locator('input[type=file]').setInputFiles(ruta); await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Importar y reemplazar' }).click(); await p.waitForTimeout(ms);
};
const semilla = { v: 3, prog: { '2026-08-05': { 'A-1': { sets: [true], logs: [{ kg: 40, reps: 8 }] } } }, prs: { 'A-1': { kg: 40 } }, fijados: {}, festivos: ['2026-08-07'] };
p = await nuevaPagina(semilla, { acceptDownloads: true });
await irAAjustes(p);
ok('Se abre Ajustes', (await titulo(p)) === 'Ajustes', await titulo(p));
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
await irAAjustes(p);
await p.locator('input[type=file]').setInputFiles(ruta); await p.waitForTimeout(400);
ok('Antes de importar pide confirmación y avisa de que reemplaza todo',
  await p.locator('[role=dialog]', { hasText: /reemplaza todo/i }).count() === 1);
ok('Y mientras no se confirma no cambia nada', Object.keys((await ls(p)).prog || {}).length === 0);
await p.locator('button', { hasText: 'Importar y reemplazar' }).click(); await p.waitForTimeout(800);
ok('Confirma la importación', await p.locator('text=/Importado:/').count() > 0);
const imp = await ls(p);
ok('Round-trip sin pérdida', JSON.stringify(imp.prog) === JSON.stringify(exportado.prog));
fs.writeFileSync('/tmp/plan-basura.json', JSON.stringify({ hola: 'mundo' }));
await importar(p, '/tmp/plan-basura.json', 600);
ok('Rechaza un JSON ajeno', await p.locator('text=/no parece un respaldo/').count() > 0);
ok('Y no destruye lo que ya había', !!(await ls(p)).prog['2026-08-05']);
fs.writeFileSync('/tmp/plan-roto.json', '{ esto no es json');
await importar(p, '/tmp/plan-roto.json', 600);
ok('Rechaza un archivo corrupto', await p.locator('text=/corrupto|no es JSON/').count() > 0);
await p.close();

// ══ 6 · DÍA COMPLETADO Y ESTADÍSTICAS ══
// En la dirección D un día hecho DESTACA: el tinte de su sesión se refuerza
// (del 12 % al 26 %), se enmarca en ese color y lleva una marca de hecho. Un día
// sin hacer conserva la raya de su turno arriba.
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
  const b = document.querySelector(`main button[data-dia="${n}"]`);
  if (!b) return null;
  const cs = getComputedStyle(b);
  const raya = b.querySelector('span[aria-hidden="true"]');
  const check = b.querySelector('svg.lucide-check');
  return {
    fondo: cs.backgroundColor,
    marco: cs.boxShadow,
    raya: raya ? getComputedStyle(raya).backgroundColor : null,
    estado: b.dataset.estado,
    ancho: b.getBoundingClientRect().width,
    alto: b.getBoundingClientRect().height,
    colorCheck: check ? getComputedStyle(check).color : null,
  };
}, dia);

const eGymA = await estiloDe(diaGymA.dia);
ok('Un Empuje completado queda marcado como hecho', eGymA.estado === 'full', eGymA.estado);
ok('Y se tiñe con su propio verde, reforzado al 26 %', eGymA.fondo === 'rgba(34, 197, 94, 0.26)', eGymA.fondo);
ok('Enmarcado en ese mismo verde', /rgba\(34, 197, 94, 0\.7\)/.test(eGymA.marco), eGymA.marco);
ok('Con la marca de hecho en el color de la sesión', eGymA.colorCheck === 'rgb(34, 197, 94)', eGymA.colorCheck);

// La natación muestra la sesión concreta de la rotación, con SU color
const eNat = await estiloDe(diaNatC.dia);
const { SESION_INFO } = await import('./src/data.js');
const hexNat = SESION_INFO[diaNatC.variante ?? 'natacion'].color;
const rgbNat = (a) => { const v = parseInt(hexNat.slice(1), 16);
  return `rgb${a !== 1 ? 'a' : ''}(${(v>>16)&255}, ${(v>>8)&255}, ${v&255}${a !== 1 ? ', ' + a : ''})`; };
ok(`Una natación completada usa el color de SU sesión (${diaNatC.variante})`,
  eNat.fondo === rgbNat(0.26), `${eNat.fondo} · esperado ${rgbNat(0.26)}`);

// Un día sin completar conserva la raya del TURNO
const diaSin = ago.find(d => !prog[d.fecha] && SESIONES[d.sesion === 'natacion' ? (d.variante ?? 'natacion') : d.sesion]?.ejercicios.length);
const eSin = await estiloDe(diaSin.dia);
const colorTurno = { L: 'rgb(34, 197, 94)', C: 'rgb(245, 158, 11)', N: 'rgb(59, 130, 246)', P: 'rgb(100, 116, 139)' };
ok('Un día sin completar lleva arriba la raya de su turno',
  eSin.raya === colorTurno[diaSin.turno], `turno ${diaSin.turno} → ${eSin.raya}`);
ok('Y solo el tinte suave de su sesión, no el de hecho', /0\.12\)$/.test(eSin.fondo) && eSin.estado === 'none', eSin.fondo);
ok('La celda completada mide EXACTAMENTE igual que la no completada',
  Math.abs(eGymA.ancho - eSin.ancho) < 0.1 && Math.abs(eGymA.alto - eSin.alto) < 0.1,
  `${eGymA.ancho.toFixed(1)}×${eGymA.alto.toFixed(1)} vs ${eSin.ancho.toFixed(1)}×${eSin.alto.toFixed(1)}`);

// Progreso: las cifras del mes y el volumen por músculo
// Hoy: la racha y las cifras del mes
await pestana(p, 'Hoy').click(); await p.waitForTimeout(600);
const esteMes = await p.evaluate(() => {
  const s = [...document.querySelectorAll('section')].find(x => /Este mes/i.test(x.textContent));
  const m = s?.textContent.match(/Este mes\s*(\d+)\s*de\s*(\d+)/i);
  return m ? [+m[1], +m[2]] : null;
});
ok('Cuenta las sesiones hechas del mes', esteMes && esteMes[0] > 0 && esteMes[0] <= esteMes[1], JSON.stringify(esteMes));
ok('La racha está en Hoy, junto al mes', await p.locator('section[aria-label="Racha y mes"]', { hasText: /Racha\s*\d+/ }).count() === 1);
await pestana(p, 'Progreso').click(); await p.waitForTimeout(600);
ok('Se abre Progreso', (await titulo(p)) === 'Progreso', await titulo(p));
ok('Y la racha ya no se repite en Progreso', await p.locator('section[aria-label="Racha y mes"]').count() === 0);
ok('Responde a «¿Estás subiendo?»', await p.locator('text=/Estás subiendo/i').count() > 0);
ok('Enseña la semana del bloque de 8', /Semana\s*\d\s*de\s*8/.test(await p.evaluate(() => document.body.innerText)));
await p.locator('button', { hasText: 'Volumen por músculo' }).click(); await p.waitForTimeout(400);
// "Semana actual" solo en la semana que contiene HOY (1 de agosto, semana 0)
ok('El volumen abre en la semana de hoy y la etiqueta como actual', await p.locator('text=/semana actual/i').count() === 1);
// La primera semana del mes es sábado-domingo (natación + descanso): sin volumen
// muscular. Se avanza a una semana completa antes de comprobarlo.
await p.locator('button[aria-label="Semana siguiente"]').click(); await p.waitForTimeout(500);
ok('Las barras musculares muestran volumen hecho',
  (await p.evaluate(() => [...document.body.innerText.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*\d/g)].filter(m => +m[1] > 0).length)) > 3);
ok('Y en otra semana ya no dice "semana actual"', await p.locator('text=/semana actual/i').count() === 0);
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
  [...m.querySelectorAll('button')].find(x => /^Guardar/.test(x.textContent.trim()))?.click();
});
await p.waitForTimeout(700);
ok('Editar otro día NO mueve la sesión del día con registro',
  (await sesionPorDia(p))[diaConReg.dia] === sesionOriginal,
  `${(await sesionPorDia(p))[diaConReg.dia]} vs ${sesionOriginal}`);
await p.close();

// Registrar una serie fija el día automáticamente
p = await nuevaPagina();
const diaLimpio = ago.find(d => d.sesion === 'gymA');
await abrirSesion(p, diaLimpio.fecha);
await hecha(p, 'Press banca', 1, 500);
const trasRegistrar = await ls(p);
ok('Registrar una serie fija el día automáticamente',
  trasRegistrar.fijados[diaLimpio.fecha]?.auto === true, JSON.stringify(trasRegistrar.fijados));
ok('Y lo fija a la sesión que tenía', trasRegistrar.fijados[diaLimpio.fecha]?.sesion === diaLimpio.sesion);
await alCalendario(p);
const marcasAmbar = await p.locator('main button[data-fijado-a-mano]').count();
ok('El auto-fijado NO se marca como fijado a mano', marcasAmbar === 0, marcasAmbar + ' marcas');
ok('Y el día queda a medias en el calendario', (await p.locator(`main button[data-dia="${diaLimpio.dia}"]`).getAttribute('data-estado')) === 'partial');
await p.close();

// ══ 8 · YA NO QUEDA NINGÚN LILA FIJO ══
seccion('SIN COLOR AJENO');
p = await nuevaPagina({ v: 3, prog, prs: {}, fijados: {}, festivos: [] });
const restosLila = await p.evaluate(() => [...document.querySelectorAll('main button')]
  .filter(x => getComputedStyle(x).backgroundColor.includes('196, 181, 253')).length);
ok('Ninguna celda usa ya el lila #c4b5fd', restosLila === 0, restosLila + ' celdas');
const coloresFondo = await p.evaluate(() => [...new Set([...document.querySelectorAll('main button[data-dia]')]
  .map(x => getComputedStyle(x).backgroundColor).filter(c => c.includes('0.26')))]);
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
const ETIQUETAS = new Set(Object.values(SESION_INFO).map(v => v.label));
const opcionesSegunda = (p) => p.evaluate((labels) => [...document.querySelectorAll('main button')]
  .map(b => b.textContent.trim()).filter(t => labels.includes(t)), [...ETIQUETAS]);

p = await nuevaPagina();
ok('El generador asignó algún día doblado en agosto', !!diaDoble, diaDoble ? `${diaDoble.fecha}: ${diaDoble.sesion} + ${diaDoble.sesionSecundaria}` : 'ninguno');
if (diaDoble) {
  const celda = p.locator(`main button[data-dia="${diaDoble.dia}"]`);
  ok('El día doblado lleva la raya de su segunda sesión en el calendario', await celda.locator('[data-segunda]').count() === 1);
  ok('Y su nombre dice las dos', / \+ /.test(await celda.getAttribute('data-etiqueta') ?? ''), await celda.getAttribute('data-etiqueta'));
}

// Un día de gym de PIERNA no puede ofrecer running como segunda sesión
if (diaGymPierna) {
  await abrirDia(p, diaGymPierna.fecha);
  await p.locator('text=/Añadir segunda sesión/').first().click();
  await p.waitForTimeout(400);
  const ofrecidas = await opcionesSegunda(p);
  ok(`Gym de pierna NO ofrece running como segunda (${diaGymPierna.sesion})`,
    !ofrecidas.includes('Running'), 'ofrece: ' + ofrecidas.join(', '));
  ok('Sí ofrece natación', ofrecidas.includes('Natación'));
  ok('Explica por qué falta el running', await p.locator('text=/viola S3|pierna . carrera/i').count() > 0);
  await alCalendario(p);
}

// Un día de gym de TORSO sí ofrece running
if (diaGymL) {
  await abrirDia(p, diaGymL.fecha);
  await p.locator('text=/Añadir segunda sesión/').first().click();
  await p.waitForTimeout(400);
  const ofrecidas = await opcionesSegunda(p);
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
  // La segunda sesión se abre desde su tarjeta
  await p.locator('button', { hasText: 'Segunda sesión del día' }).click(); await p.waitForTimeout(500);
  ok('Tocar la segunda sesión abre su sesión', /Running/.test(await titulo(p)), await titulo(p));
  await alCalendario(p);
}

// Turno N no permite doblar
if (diaN) {
  await abrirDia(p, diaN.fecha);
  ok('En turno N no se ofrece doblar', await p.locator('text=/Añadir segunda sesión/').count() === 0);
  ok('Y explica el motivo', await p.locator('text=/guardia a las 18h/i').count() > 0);
  await alCalendario(p);
}

// Complemento de calistenia: bloqueado en gym, permitido en natación
if (diaGymL) {
  await abrirDia(p, diaGymL.fecha);
  ok('La calistenia está bloqueada en día de gym', await p.locator('text=/Calistenia bloqueada hoy/').count() > 0);
  ok('Y explica por qué', await p.locator('text=/Duplicaría patrones/i').count() > 0);
  await alCalendario(p);
}
if (diaNat) {
  await abrirDia(p, diaNat.fecha);
  ok('En día de natación sí se puede añadir calistenia', await p.locator('text=/Añadir calistenia/').count() > 0);
  await p.locator('text=/Añadir calistenia/').first().click();
  await p.waitForTimeout(600);
  const g2 = await ls(p);
  ok('El complemento se guarda', (g2.extras?.[diaNat.fecha]?.complementos ?? []).includes('calistenia'));
  ok('Y el botón pasa a «Calistenia añadida»', await p.locator('button[aria-pressed="true"]', { hasText: 'Calistenia añadida' }).count() === 1);
  await alCalendario(p);
  const punto = await p.evaluate(n => !!document.querySelector(`main button[data-dia="${n}"] span.rounded-full[style*="168, 85, 247"]`), diaNat.dia);
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
ok('El día del test se llama por su nombre, no por un código', (await p.locator('main h1').first().textContent()) === 'Test CSS');
await entrarSesion(p);
ok('El test de CSS abre su calculadora', await p.locator('text=/Test de CSS/').count() > 0);
ok('Sin CSS aún, lo dice claramente', await p.locator('text=/Aún no tienes CSS/').count() > 0);
await p.getByLabel('Tiempo de los 400 metros').fill('6:40');
await p.getByLabel('Tiempo de los 200 metros').fill('3:10');
await p.waitForTimeout(500);
ok('Calcula el CSS del ejemplo del plan (1:45)', await p.locator('text=/Guardar CSS 1:45/').count() > 0);
ok('Y enseña la fórmula con los dos tiempos', /\(6:40 − 3:10\) ÷ 2 = 1:45/.test(await p.evaluate(() => document.body.innerText)));
await p.locator('text=/Guardar CSS/').first().click();
await p.waitForTimeout(600);
ok('El CSS se guarda', (await ls(p)).css != null, String((await ls(p)).css));
const filasCSS = await p.evaluate(() => [...document.querySelectorAll('[role=table] [role=row]')].slice(1).map(r => r.textContent.trim()));
ok('Aparece la tabla con los cuatro ritmos', filasCSS.length === 4, filasCSS.join(' | '));
ok('Y el ritmo CSS sale a 1:45 por 100 m', filasCSS.some(f => f.startsWith('CSS0:531:45')), filasCSS[1]);
// Error: 400 más rápido que 200
await p.getByLabel('Tiempo de los 400 metros').fill('3:00');
await p.waitForTimeout(400);
ok('Rechaza tiempos imposibles', await p.locator('text=/tiene que ser mayor/').count() > 0);
await alCalendario(p);
await abrirSesion(p, diaNatX.fecha);
ok('La tabla de ritmos se ve en cualquier sesión de agua', await p.locator('text=/Tus ritmos/').count() > 0);
ok('Y ya no muestra encabezados de gimnasio',
  await p.locator('text=/COMPUESTO SECUNDARIO/i').count() === 0);
await p.close();

seccion('DÍA FLEXIBLE · TRES CONDICIONES');
const diaFlex = agoX.find(d => d.flexible);
p = await nuevaPagina();
ok('El día flexible se marca en su celda', / flex$/.test((await sesionPorDia(p))[diaFlex.dia] ?? ''), (await sesionPorDia(p))[diaFlex.dia]);
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
  await alCalendario(p);
  // El running resuelve a su variante (Rodaje suave, Tempo…): la celda dice cuál.
  ok('Y el calendario lo muestra', ETIQUETAS_RUN.includes((await sesionPorDia(p))[diaFlex.dia]),
    (await sesionPorDia(p))[diaFlex.dia]);
}
await p.close();

seccion('EDITOR DE RUTINA');
p = await nuevaPagina();
const diaGymE = agoX.find(d => d.sesion === 'gymA');
await abrirSesion(p, diaGymE.fecha);
await p.locator('text=/Editar esta rutina/').first().click();
await p.waitForTimeout(700);
ok('Abre el editor', await p.locator('text=/Editar Empuje/').count() > 0);
ok('El plan original pasa el verificador limpio', await p.locator('text=/Cumple todas las reglas/').count() > 0);
ok('Cada ejercicio es una fila plegada', await p.locator('main button[aria-expanded="false"]', { hasText: 'Face pull' }).count() === 1);
// El motivo es OPCIONAL (Tarea 2 · 2.4): el botón de guardar está activo desde el principio
ok('Deja guardar sin motivo: el botón está activo',
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Guardar/.test(b.textContent.trim())); return !!b && !b.disabled; }));
// Abrir una fila enseña lo que se puede cambiar
await p.locator('main button[aria-expanded="false"]', { hasText: 'Press banca con barra' }).click(); await p.waitForTimeout(300);
const panel = await p.evaluate(() => document.querySelector('main').innerText);
ok('El panel del ejercicio tiene series, reps, descanso y progresión',
  /Series/.test(panel) && /Reps/.test(panel) && /Descanso/.test(panel) && /Lineal \+2,5/.test(panel) && /Doble · RIR/.test(panel));
await p.getByRole('button', { name: 'Más series de Press banca con barra' }).click();
await p.getByLabel('Repeticiones de Press banca con barra').fill('4-6');
await p.waitForTimeout(300);
ok('Cambiar series y reps se ve en la fila', await p.locator('main', { hasText: '5 × 4-6' }).count() === 1);
// Cambiar el orden: flechas en cada fila, sin abrir nada
{
  const orden = () => p.evaluate(() => [...document.querySelectorAll('main button[aria-label^="Subir "]')].map(b => b.getAttribute('aria-label').slice(6)));
  await p.getByRole('tab', { name: 'Cambiar el orden' }).click(); await p.waitForTimeout(300);
  const o0 = await orden();
  ok('«Cambiar el orden» pone flechas en todas las filas', o0.length === 12 && o0[0] === 'Press banca con barra', o0.slice(0, 3).join(' · '));
  ok('El primero no puede subir más', await p.locator('button[aria-label="Subir Press banca con barra"]').isDisabled());
  await p.locator('button[aria-label="Bajar Press banca con barra"]').click(); await p.waitForTimeout(250);
  const o1 = await orden();
  ok('Bajar un ejercicio lo cambia de sitio con el siguiente', o1[0] === o0[1] && o1[1] === o0[0], o1.slice(0, 3).join(' · '));
  await p.locator('button[aria-label="Subir Press banca con barra"]').click(); await p.waitForTimeout(250);
  ok('Y subirlo lo devuelve', JSON.stringify(await orden()) === JSON.stringify(o0));
  // En el borde de su parte no salta a nadie: pasa a la parte de al lado
  const parteDe = (nom) => p.evaluate(n => { const f = [...document.querySelectorAll('main button[aria-label^="Subir "]')].find(b => b.getAttribute('aria-label') === 'Subir ' + n)?.closest('div.border-b');
    let h = null; for (let e = f; e && !h; e = e.previousElementSibling) h = e.querySelector('h2'); return h?.textContent ?? null; }, nom);
  const ultimoP1 = o0[1];
  const antesParte = await parteDe(ultimoP1);
  await p.locator(`button[aria-label="Bajar ${ultimoP1}"]`).click(); await p.waitForTimeout(250);
  ok('Bajar el último de una parte lo pasa a la parte siguiente, sin saltarse a nadie',
    JSON.stringify(await orden()) === JSON.stringify(o0) && (await parteDe(ultimoP1)) !== antesParte, `${antesParte} → ${await parteDe(ultimoP1)}`);
  await p.locator(`button[aria-label="Subir ${ultimoP1}"]`).click(); await p.waitForTimeout(250);
  ok('Y subirlo lo devuelve a la suya', (await parteDe(ultimoP1)) === antesParte);
  await p.getByRole('tab', { name: 'Editar' }).click(); await p.waitForTimeout(300);
}
// Romper una regla: quitar el face pull
await p.locator('main button[aria-expanded="false"]', { hasText: 'Face pull' }).click(); await p.waitForTimeout(300);
await p.locator('button[aria-label^="Quitar Face pull"]').click();
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
const banca = trasEditar.rutina.gymA[0].ejercicios.find(e => e.id === 'A-1');
ok('Y la banca guarda sus series y reps nuevas', banca?.series === 5 && banca?.reps === '4-6', JSON.stringify({ s: banca?.series, r: banca?.reps }));
await p.waitForTimeout(400);
ok('La sesión se marca como editada', await p.locator('text=/· editada/').count() > 0);
await p.close();

// ══ 10a · GUARDAR SIN MOTIVO ══
// El motivo es opcional. Si se deja vacío, el historial guarda "Sin motivo": no
// quedan huecos y se sigue sabiendo cuándo cambió cada cosa.
seccion('EDITOR · GUARDAR SIN MOTIVO');
p = await nuevaPagina();
await abrirSesion(p, diaGymE.fecha);
await p.locator('text=/Editar esta rutina/').first().click(); await p.waitForTimeout(600);
// Un cambio inocuo: marcar las aperturas como opcionales
await p.locator('main button[aria-expanded="false"]', { hasText: 'Aperturas en polea' }).click(); await p.waitForTimeout(300);
await p.locator('button', { hasText: /^Opcional \*$/ }).click();
await p.waitForTimeout(300);
ok('El campo de motivo dice que es opcional', /opcional/i.test(await p.getByLabel('Motivo del cambio').getAttribute('placeholder')));
await p.locator('button', { hasText: /^Guardar/ }).first().click(); await p.waitForTimeout(800);
const sinMotivo = await ls(p);
ok('Guarda sin escribir motivo', !!sinMotivo.rutina?.gymA?.[0], JSON.stringify(Object.keys(sinMotivo.rutina ?? {})));
ok('Y en el historial queda "Sin motivo", no un hueco', sinMotivo.rutina?.gymA?.[0]?.motivo === 'Sin motivo', sinMotivo.rutina?.gymA?.[0]?.motivo);
ok('El editor se cierra y la sesión queda editada', await p.locator('text=/· editada/').count() > 0);
await p.close();

// ══ 10b · AÑADIR EJERCICIO: AGRUPADO POR MÚSCULO ══
// La lista de candidatos se agrupa por el músculo primario, con cabecera
// desplegable como el menú de sesiones. Cerrados al abrir; al buscar se abren todos.
seccion('EDITOR · AÑADIR AGRUPADO POR MÚSCULO');
p = await nuevaPagina();
await abrirSesion(p, diaGymE.fecha);
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
ok('Y el ejercicio añadido queda abierto para ajustarlo', await p.locator('main button[aria-expanded="true"]', { hasText: 'Flexiones' }).count() === 1);
await p.close();

// ══ 10c · CREAR UN EJERCICIO DESDE CERO Y EDITARLO ENTERO ══
seccion('EDITOR · EJERCICIO NUEVO DESDE CERO');
p = await nuevaPagina();
await abrirSesion(p, diaGymE.fecha);
await p.locator('text=/Editar esta rutina/').first().click(); await p.waitForTimeout(600);
await p.locator('button', { hasText: 'Añadir ejercicio' }).click(); await p.waitForTimeout(300);
await p.locator('input[aria-label="Buscar ejercicio"]').fill('Remo en T'); await p.waitForTimeout(300);
await p.locator('button', { hasText: 'Crear un ejercicio que no está en la lista' }).click(); await p.waitForTimeout(300);
const btnCrear = p.locator('button', { hasText: /^Crear y añadir$/ });
ok('El formulario arranca con lo que se estaba buscando', (await p.getByLabel('Nombre del ejercicio nuevo').inputValue()) === 'Remo en T');
ok('Sin músculo principal no deja crear', await btnCrear.isDisabled());
await p.locator('button[aria-label="Dorsal: sin elegir"]').click(); await p.waitForTimeout(200);
await p.locator('button[aria-label="Bíceps: sin elegir"]').click(); await p.waitForTimeout(150);
await p.locator('button[aria-label="Bíceps: principal"]').click(); await p.waitForTimeout(200);
ok('Un toque lo hace principal y dos, secundario',
  await p.locator('button[aria-label="Dorsal: principal"]').count() === 1 && await p.locator('button[aria-label="Bíceps: secundario"]').count() === 1);
ok('Con nombre y músculo ya deja crear', !(await btnCrear.isDisabled()));
await p.getByLabel('Repeticiones del ejercicio nuevo').fill('10-12');
await btnCrear.click(); await p.waitForTimeout(400);
ok('El ejercicio nuevo entra en la lista, abierto para ajustarlo', await p.locator('main button[aria-expanded="true"]', { hasText: 'Remo en T' }).count() === 1);
// Todo el ejercicio se puede cambiar: nombre, cómo se registra…
await p.getByLabel('Nombre del ejercicio', { exact: true }).fill('Remo en T con apoyo');
await p.locator('button', { hasText: /^Guardar/ }).first().click(); await p.waitForTimeout(800);
const creado = (await ls(p)).rutina?.gymA?.[0]?.ejercicios.find(e => /Remo en T/.test(e.nombre));
ok('Se guarda con su nombre, músculos y reps',
  creado?.nombre === 'Remo en T con apoyo' && creado.reps === '10-12' && creado.musculos.primario[0] === 'dorsal' && creado.musculos.secundario[0] === 'biceps', JSON.stringify(creado));
ok('Con un id propio que no pisa ninguno del plan', !!creado && !SESIONES.gymA.ejercicios.some(e => e.id === creado.id), creado?.id);
ok('Y aparece en la sesión', await p.locator('main h3', { hasText: 'Remo en T con apoyo' }).count() === 1);
await hecha(p, 'Remo en T con apoyo', 1, 400);
ok('Se registra como cualquier otro', (await ls(p)).prog[diaGymE.fecha]?.[creado.id]?.sets?.[0] === true);
// Y queda disponible para las demás rutinas
await p.locator('button[aria-label="Volver al día"]').click(); await p.waitForTimeout(300);
await pestana(p, 'Rutinas').click(); await p.waitForTimeout(400);
await p.locator('main button', { hasText: /^Tracción/ }).first().click(); await p.waitForTimeout(500);
await p.locator('button', { hasText: 'Editar esta rutina' }).click(); await p.waitForTimeout(500);
await p.locator('button', { hasText: 'Añadir ejercicio' }).click(); await p.waitForTimeout(300);
await p.locator('input[aria-label="Buscar ejercicio"]').fill('remo en t'); await p.waitForTimeout(400);
ok('El ejercicio creado se puede añadir a otra rutina', await p.locator('button', { hasText: /Remo en T con apoyo.*Creado por ti/ }).count() === 1);
// Cambiar cómo se registra un ejercicio del plan
await p.locator('button', { hasText: /^Cancelar$/ }).first().click(); await p.waitForTimeout(200);
await p.locator('main button[aria-expanded="false"]', { hasText: 'Curl martillo' }).first().click(); await p.waitForTimeout(300);
await p.locator('button', { hasText: /^Segundos$/ }).click(); await p.waitForTimeout(200);
await p.locator('button', { hasText: /^Guardar/ }).first().click(); await p.waitForTimeout(800);
const curl = (await ls(p)).rutina?.gymB?.[0]?.ejercicios.find(e => /Curl martillo/.test(e.nombre));
ok('Cambiar el registro a segundos se guarda en el ejercicio', curl?.iso === true && curl.rir === '—', JSON.stringify({ iso: curl?.iso, rir: curl?.rir }));
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
await alCalendario(p);
ok('Y el calendario lo muestra', (await sesionPorDia(p))[flexB.dia] === 'Bici', (await sesionPorDia(p))[flexB.dia]);
await abrirDia(p, flexB.fecha);
ok('Y avisa de que el cuádriceps sí trabaja', await p.locator('text=/cuádriceps SÍ trabaja/i').count() > 0);
await entrarSesion(p);
ok('La sesión de bici tiene sus tres bloques Z2', await p.locator('text=/Z2 continuo/').count() > 0);
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

// ══ 11b · BICI POR DEFECTO EN EL FLEXIBLE ══
// Cuando el cardio de la semana no cupo en ningún otro día, el generador pone
// BICI en el flexible. Aquí no se pregunta nada: se explica y se deja cambiar
// a running o a descanso. El primer caso es 2026-09-23, un mes después del ancla.
seccion('FLEXIBLE · BICI POR DEFECTO');
const FECHA_BICI_DEF = '2026-09-23';
const sepD = generarMes({ anio: 2026, mes: 8 }).dias;
const biciDef = sepD.find(d => d.fecha === FECHA_BICI_DEF);
ok(`El generador pone bici por defecto el ${FECHA_BICI_DEF}`,
  biciDef?.cardioPorDefecto === true && biciDef.sesion === 'ciclismo', `${biciDef?.sesion} · porDefecto=${biciDef?.cardioPorDefecto}`);
if (biciDef?.cardioPorDefecto) {
  const irASeptiembre = async (pg) => {
    await pg.locator('button[aria-label="Mes siguiente"]').click();
    await pg.waitForTimeout(600);
  };
  p = await nuevaPagina();
  await irASeptiembre(p);
  // La celda lleva el marcador "flex": el día es bici, pero NO está fijado —
  // sigue siendo el día negociable de la semana.
  const celdaBici = (await sesionPorDia(p))[biciDef.dia];
  ok('El calendario de septiembre ya lo pinta como Bici', /^Bici/.test(celdaBici ?? ''), celdaBici);
  ok('Y sigue marcado como flexible: no está fijado', /flex$/.test(celdaBici ?? ''), celdaBici);
  await abrirDia(p, FECHA_BICI_DEF);
  const txtDef = await p.evaluate(() => document.body.innerText);
  ok('El panel dice que hoy toca bici por defecto', /bici por defecto/i.test(txtDef));
  ok('Y explica por qué: el cardio no cupo en ningún otro día', /no cupo en ningún otro día/i.test(txtDef));
  ok('No pregunta nada: ya está puesto, no hay sueño ni peso que decidir',
    await p.locator('text=/¿Dormiste bien esta semana\\?/').count() === 0
    && await p.locator('text=/¿El peso corporal va subiendo\\?/').count() === 0);
  ok('El día es de bici: el botón la abre', await p.locator('main h1', { hasText: 'Bici' }).count() === 1);
  const botones = await p.evaluate(() => [...document.querySelectorAll('button')].map(x => x.textContent.trim()));
  ok('Ofrece correr en su lugar', botones.includes('Correr en su lugar'), botones.filter(t => /Correr|descanso/i.test(t)).join(' · '));
  ok('Y ofrece descansar', botones.includes('Hoy descanso'));
  await p.locator('button[aria-label="Correr en su lugar"]').click();
  await p.waitForTimeout(700);
  ok('Pulsar correr fija el día a running', (await ls(p)).fijados?.[FECHA_BICI_DEF]?.sesion === 'running',
    JSON.stringify((await ls(p)).fijados?.[FECHA_BICI_DEF]));
  await alCalendario(p);
  ok('Y el calendario lo refleja', ETIQUETAS_RUN.includes((await sesionPorDia(p))[biciDef.dia]), (await sesionPorDia(p))[biciDef.dia]);
  await p.close();

  // La otra salida: no me apetece, hoy descanso
  p = await nuevaPagina();
  await irASeptiembre(p);
  await abrirDia(p, FECHA_BICI_DEF);
  await p.locator('button[aria-label="Hoy descanso"]').click();
  await p.waitForTimeout(700);
  ok('Pulsar descanso fija el día a descanso', (await ls(p)).fijados?.[FECHA_BICI_DEF]?.sesion === 'descanso',
    JSON.stringify((await ls(p)).fijados?.[FECHA_BICI_DEF]));
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
  .filter(b => /^(Sí|No)$/.test(b.textContent.trim()) && b.getAttribute('aria-pressed') === 'true').length);
ok('Y la respuesta queda marcada', marcados === 1, marcados + ' marcados');
await p.close();

seccion('SEMANA DE DESCARGA · AVISO EN EL DÍA');
const diaDesc = generarMes({ anio: 2026, mes: 8 }).dias.find(d => d.descarga && d.sesion.startsWith('gym'));
p = await nuevaPagina();
if (diaDesc) {
  await p.locator('button[aria-label="Mes siguiente"]').click(); await p.waitForTimeout(600);
  await abrirDia(p, diaDesc.fecha);
  ok('El día de descarga lo avisa explícitamente', /DESCARGA \(P4\)/.test(await p.evaluate(() => document.body.innerText)));
  // El detalle va plegado en una línea; se abre al tocar
  await p.locator('button[aria-expanded="false"]', { hasText: 'DESCARGA' }).click(); await p.waitForTimeout(300);
  const txtDesc = await p.evaluate(() => document.body.innerText);
  ok('Y dice qué hacer: mitad de series y RIR +2',
    txtDesc.includes('mitad de las series') && txtDesc.includes('RIR +2'));
  ok('Explica la política de dobles de esa semana: solo lo suave',
    /solo se dobla con lo suave/i.test(txtDesc) && /natación o bici/i.test(txtDesc));
  await entrarSesion(p);
  ok('Y la sesión lo recuerda arriba', /descarga: mitad de series, RIR \+2/i.test(await p.evaluate(() => document.body.innerText)));
} else {
  ok('Hay un día de descarga que comprobar', false, 'no se encontró');
}
await p.close();

// ══ 12 · «HECHA» PROPONE LA CARGA SUGERIDA ══
// Antes había un botón «Usar» que escribía la carga en todas las series. Ahora
// la carga sugerida es lo que propone «Hecha»: un toque registra la serie con
// ella, y las reps que se proponen son las de la misma serie la última vez.
seccion('«HECHA» CON LA CARGA SUGERIDA');
const mesU = generarMes(MES_TEST).dias;
const gymU = mesU.find(d => d.sesion === 'gymA' && d.fecha > '2026-08-03');
p = await nuevaPagina({
  v: 3, prs: {}, fijados: {}, extras: {},
  // Una sesión previa completa a 40 kg → la sugerencia debe ser 42.5
  prog: { '2026-08-03': { 'A-1': { sets: [true, true, true, true], logs: Array(4).fill({ kg: 40, reps: 8 }) } } },
});
await abrirDia(p, gymU.fecha);
ok('El día enseña ya la carga con la que se empieza', /Empiezas con\s*Press banca con barra\s*42\.5\s*kg/.test(await p.evaluate(() => document.body.innerText)));
await entrarSesion(p);
const txtU = await p.evaluate(() => document.body.innerText);
ok('La última vez es visible sin tocar nada', /última vez 40 × 8, 8, 8, 8/.test(txtU));
ok('Y dice que toca subir', /sube ·/.test(txtU));
const btnU = p.locator('button[aria-label^="Hecha la serie 1 de Press banca"]');
ok('«Hecha» propone 42.5 kg (+2.5 sobre 40) y las 8 reps de la última vez',
  /42\.5 × 8/.test((await btnU.getAttribute('aria-label')) ?? ''), await btnU.getAttribute('aria-label'));
await btnU.click(); await p.waitForTimeout(600);
const logsU = (await ls(p)).prog?.[gymU.fecha]?.['A-1'];
ok('Un toque registra la serie con esa carga y esas reps', logsU?.sets?.[0] === true && logsU.logs[0]?.kg === 42.5 && logsU.logs[0]?.reps === 8,
  JSON.stringify(logsU));
ok('Solo la serie hecha: las demás siguen sin anotar', logsU.logs.slice(1).every(l => l == null));
await p.close();

// ══ 13 · SELECTOR DE VARIANTE: SOLTAR Y PROTEGER EL REGISTRO ══
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
await abrirSelector(p); await pulsar(p, 'Ritmo variable');
ok('Elegir una variante la fija', !!(await ls(p)).fijados?.[natV.fecha]?.variante);
ok('Y el día pasa a llamarse como la elegida', (await p.locator('main h1').first().textContent()) === 'Ritmo variable');
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
await abrirSelector(p); await pulsar(p, 'Pierna fuerza');
ok('Cambiar de sesión con registro avisa antes',
  /ejercicio\(s\) registrados/i.test(await p.evaluate(() => document.body.innerText)));
ok('Y no cambia nada hasta confirmar', !(await ls(p)).fijados?.[gymV.fecha]);
await pulsar(p, 'Cancelar', 400);
ok('Cancelar conserva el registro', !!(await ls(p)).prog?.[gymV.fecha]?.['A-1']);
await pulsar(p, 'Pierna fuerza'); await pulsar(p, 'Cambiar y borrar');
const dV = await ls(p);
ok('Confirmar cambia la sesión', dV.fijados?.[gymV.fecha]?.sesion === 'gymC1');
ok('Y borra el registro que quedaría huérfano', !dV.prog?.[gymV.fecha]);
await p.close();

// ══ 13b · AVISO AL FIJAR UN GYM QUE SOLAPA (o rompe S7) ══
// Fijar a mano se salta las reglas del generador, que solo protege hacia
// delante. Caso del calendario: el día 8 de agosto viene de una Pierna fuerza
// el día 7, así que fijar pierna ahí solapa Y rompe S7.
seccion('AVISO AL FIJAR · SELECTOR');
const DIA_SOLAPE = '2026-08-08';      // gymD, con gymC1 justo el día antes
p = await nuevaPagina();
await abrirDia(p, DIA_SOLAPE);
await abrirSelector(p);
const insignias = await p.evaluate(() => [...document.querySelectorAll('[aria-label$="con aviso"]')]
  .map(b => b.getAttribute('aria-label')));
ok('Las opciones problemáticas vienen marcadas antes de tocarlas', insignias.length === 2,
  insignias.join(' · ') || 'ninguna');
ok('Y las marcadas son las dos de pierna',
  insignias.length === 2 && insignias.every(t => /^Pierna/.test(t)), insignias.join(' · ') || 'ninguna');
await pulsar(p, 'Pierna fuerza');
const txtAviso = await p.evaluate(() => document.body.innerText);
ok('No fija nada todavía: primero avisa', !(await ls(p)).fijados?.[DIA_SOLAPE], JSON.stringify((await ls(p)).fijados));
ok('Dice que son dos problemas', /tiene 2 problemas/i.test(txtAviso), txtAviso.match(/tiene \d+ problemas?/i)?.[0]);
ok('Avisa del solape y nombra el gym anterior', /Solape ·/.test(txtAviso) && /El gym anterior \(día 7, ayer mismo\) es Pierna fuerza/.test(txtAviso));
ok('Y avisa de S7 con la separación que quedaría', /S7 ·/.test(txtAviso) && /un solo día antes/.test(txtAviso));
await p.locator('button[aria-label="Cancelar el cambio de sesión"]').click(); await p.waitForTimeout(400);
ok('"Mejor no" deja el día como estaba', !(await ls(p)).fijados?.[DIA_SOLAPE]);
await pulsar(p, 'Pierna fuerza');
await p.locator('button[aria-label="Fijar igual"]').click(); await p.waitForTimeout(700);
ok('Pero "Fijar igual" lo fija: el aviso informa, no bloquea',
  (await ls(p)).fijados?.[DIA_SOLAPE]?.sesion === 'gymC1', JSON.stringify((await ls(p)).fijados?.[DIA_SOLAPE]));
await p.close();

// Una opción que NO solapa se fija directa, sin pasar por el aviso
p = await nuevaPagina();
await abrirDia(p, DIA_SOLAPE);
await abrirSelector(p); await pulsar(p, 'Tracción');
ok('Una opción sin problema se fija directa, sin aviso de por medio',
  (await ls(p)).fijados?.[DIA_SOLAPE]?.sesion === 'gymB', JSON.stringify((await ls(p)).fijados?.[DIA_SOLAPE]));
await p.close();

// El mismo aviso en el modo edición del calendario. Día 13: viene de una Pierna
// fuerza el día 12.
seccion('AVISO AL FIJAR · MODO EDICIÓN');
const DIA_EDIT = '2026-08-13';
p = await nuevaPagina();
await p.locator('button[aria-label="Modo edición"]').click();
await p.waitForTimeout(400);
await abrirDia(p, DIA_EDIT);
const hayModal = await p.locator('text=/Editar día 13/').count() > 0;
ok('Se abre la hoja de edición del día 13', hayModal);
if (hayModal) {
  await elegirSesionEnModal(p, 'Pierna fuerza', 'Gym');
  await p.waitForTimeout(400);
  const txtEdit = await p.evaluate(() => document.body.innerText);
  ok('La hoja avisa del solape antes de guardar', /Solape ·/.test(txtEdit), txtEdit.match(/Solape ·[^\n]{0,60}/)?.[0]);
  ok('Y de S7', /S7 ·/.test(txtEdit));
  ok('Dice explícitamente que no se reescribe ningún otro día', /los días que no edites se quedan como están/i.test(txtEdit));
  ok('Guardar sigue habilitado: el aviso no bloquea',
    await p.evaluate(() => ![...document.querySelectorAll('button')].find(b => /^Guardar/.test(b.textContent.trim()))?.disabled));
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Guardar/.test(b.textContent.trim()))?.click());
  await p.waitForTimeout(800);
  ok('Y guarda el día que elegí', (await ls(p)).fijados?.[DIA_EDIT]?.sesion === 'gymC1',
    JSON.stringify((await ls(p)).fijados?.[DIA_EDIT]));
  const trasFijar = generarMes(MES_TEST).dias;
  const conFijado = generarMes({ ...MES_TEST, fijados: { [DIA_EDIT]: { turno: 'L', sesion: 'gymC1' } } }).dias;
  const antes13 = trasFijar.filter(d => d.fecha < DIA_EDIT).map(d => `${d.fecha}:${d.sesion}`).join('|');
  const antes13b = conFijado.filter(d => d.fecha < DIA_EDIT).map(d => `${d.fecha}:${d.sesion}`).join('|');
  ok('Fijar ese día no toca ni un día anterior', antes13 === antes13b);
}
await p.close();

// ══ 14 · IMPORTAR RESTAURA TODO LO QUE EXPORTA ══
// snapshot() guarda 7 campos; onImportar solo restauraba 5. Importar un respaldo
// borraba en silencio las rutinas editadas, el test CSS y los complementos.
seccion('EXPORTAR / IMPORTAR COMPLETO');
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
await irAAjustes(p);
await importar(p, '/tmp/respaldo-test.json', 1200);
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
await irAAjustes(p);
await importar(p, '/tmp/ajeno-test.json', 1000);
const dA = await ls(p);
ok('Un JSON ajeno se rechaza',
  /no parece un respaldo/i.test(await p.evaluate(() => document.body.innerText)));
ok('Y no borra ni la rutina ni el progreso', !!dA.rutina?.gymA && !!dA.prog?.[gymV.fecha]);
await p.close();

// ══ 15 · RUTINAS MUESTRA LA RUTINA VIGENTE ══
seccion('RUTINAS');
p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, css: null, prog: {},
  rutina: { gymA: [{ desde: '2020-01-01', motivo: 'prueba', ejercicios: [
    { id: 'A-1', parte: 1, nombre: 'MI PRESS PERSONALIZADO', series: 4, reps: '5-8', descanso: '3 min',
      musculos: { primario: ['pecho'], secundario: [] } }] }] } });
await pestana(p, 'Rutinas').click(); await p.waitForTimeout(600);
ok('Se abre Rutinas', (await titulo(p)) === 'Rutinas', await titulo(p));
const txtRut = await p.evaluate(() => document.body.innerText);
ok('El gym va en el orden de la rotación',
  ['Empuje', 'Pierna fuerza', 'Torso', 'Pierna volumen', 'Tracción'].map(n => txtRut.indexOf(n)).every((v, i, a) => v >= 0 && (i === 0 || v > a[i - 1])));
ok('Cada rutina dice cuándo vuelve a tocar', /(Hoy|Lun|Mar|Mié|Jue|Vie|Sáb|Dom) ?\d*/.test(txtRut));
ok('Y marca la que está editada', /editada/.test(txtRut));
await pulsar(p, 'Empuje');
ok('Enseña la rutina editada, no el plan base',
  /MI PRESS PERSONALIZADO/.test(await p.evaluate(() => document.body.innerText)));
ok('Es solo consulta, con «Editar esta rutina» a un toque', await p.locator('button', { hasText: 'Editar esta rutina' }).count() === 1);
await p.locator('button', { hasText: 'Editar esta rutina' }).click(); await p.waitForTimeout(500);
ok('Que abre el editor', await p.locator('text=/Editar Empuje/').count() > 0);
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

// ══ 15b · ANCHO MÁXIMO EN ESCRITORIO ══
// La app es de móvil. En pantalla ancha, cabecera, contenido y barra inferior
// son una columna de 768 px. En móvil, la pantalla entera.
seccion('ANCHO MÁXIMO EN ESCRITORIO');
const medidas = () => p.evaluate(() => {
  const r = (el) => { const b = el?.getBoundingClientRect(); return b ? { x: Math.round(b.left), w: Math.round(b.width), dcha: Math.round(b.right) } : null; };
  const header = document.querySelector('header');
  const barra = header?.querySelector(':scope > div');
  const ajustes = header?.querySelector('button[aria-label="Ajustes"]');
  const nav = document.querySelector('nav[aria-label="Secciones"] > div');
  return { pantalla: window.innerWidth, header: r(header), barra: r(barra), main: r(document.querySelector('main')), ajustes: r(ajustes), nav: r(nav) };
});
p = await nuevaPagina(undefined, { viewport: { width: 1280, height: 900 } });
const mPC = await medidas();
ok('En PC (1280) el fondo de la cabecera sigue a todo el ancho', mPC.header.w === 1280, `${mPC.header.w}px`);
ok('Pero su contenido es una columna de como mucho 768 px', mPC.barra.w <= 768 && mPC.barra.w >= 700, `${mPC.barra.w}px`);
ok('Centrada', Math.abs(mPC.barra.x - (1280 - mPC.barra.w) / 2) <= 1, `x=${mPC.barra.x}`);
ok('El contenido mide lo mismo que la cabecera', Math.abs(mPC.main.w - mPC.barra.w) <= 1, `main ${mPC.main.w} · cabecera ${mPC.barra.w}`);
ok('El botón de ajustes ya no está en el borde del monitor', mPC.ajustes.dcha <= mPC.barra.dcha && mPC.ajustes.dcha < 1280 - 200, `borde dcho a ${mPC.ajustes.dcha}px de 1280`);
ok('Y la barra inferior va en la misma columna', Math.abs(mPC.nav.w - mPC.barra.w) <= 1 && Math.abs(mPC.nav.x - mPC.barra.x) <= 1, `${mPC.nav.w} @ ${mPC.nav.x}`);
// La sesión también
await abrirSesion(p, ago.find(d => d.sesion === 'gymA').fecha);
const mSes = await medidas();
ok('La cabecera de la sesión también va en columna', mSes.barra.w <= 768 && Math.abs(mSes.barra.w - mSes.main.w) <= 1, `${mSes.barra.w} / ${mSes.main.w}`);
await p.close();
// Y en móvil, todo a pantalla completa como siempre
p = await nuevaPagina();
const mMov = await medidas();
ok('En móvil (430) la columna es la pantalla entera', mMov.barra.w === 430 && mMov.main.w === 430, `${mMov.barra.w} / ${mMov.main.w}`);
await p.close();

// ══ 16a · LOS MÚSCULOS DE CADA EJERCICIO, VISIBLES SIN TOCAR NADA ══
// Primarios delante y marcados, secundarios detrás y apagados: en el ejercicio
// abierto de la sesión y en la ficha de la rutina.
seccion('MÚSCULOS VISIBLES');
const gymM = ago.find(d => d.sesion === 'gymA');
p = await nuevaPagina();
await abrirSesion(p, gymM.fecha);
const musculosDe = (nombre) => p.evaluate((nom) => {
  const h3 = [...document.querySelectorAll('main h3')].find(h => h.textContent.trim().startsWith(nom));
  const el = h3?.parentElement.querySelector('[aria-label="Músculos que trabaja"]');
  if (!el) return null;
  const prim = [...el.querySelectorAll('[data-musculo="primario"]')].map(s => s.textContent.replace(/·/g, '').trim());
  const sec = el.querySelector('[data-musculo="secundario"]')?.textContent.replace(/·/g, '').trim() ?? '';
  return { texto: el.textContent.trim(), prim, sec };
}, nombre);
const mBanca = await musculosDe('Press banca');
ok('La banca enseña sus músculos bajo el nombre, sin tocar nada', !!mBanca, mBanca?.texto);
ok('Primarios delante y marcados: Pecho y Tríceps', mBanca?.prim.includes('Pecho') && mBanca?.prim.includes('Tríceps'), mBanca?.prim.join(', '));
ok('Secundario detrás y apagado: Deltoides ant.', /Deltoides ant\./.test(mBanca?.sec ?? ''), mBanca?.sec);
ok('En el orden primarios · secundarios', mBanca && mBanca.texto.indexOf('Pecho') < mBanca.texto.indexOf('Deltoides ant.'));
await abrirEjercicio(p, 'Face pull');
const mFacePull = await musculosDe('Face pull');
ok('El face pull también al abrirlo (Deltoides post. primario)', mFacePull?.prim.includes('Deltoides post.'), mFacePull?.texto);
await p.close();
// Un ejercicio con `musculos` malformado no enseña nada, pero tampoco revienta la tarjeta
p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, css: null, prog: {},
  rutina: { gymA: [{ desde: '2026-01-01', ejercicios: [
    { id: 'A-1', parte: 1, nombre: 'Press malformado', series: 4, reps: '5-8', descanso: '3 min', musculos: { pectoral: 1 } }] }] } });
await abrirSesion(p, gymM.fecha);
ok('Con músculos malformados la tarjeta se pinta igual', await p.locator('main h3', { hasText: 'Press malformado' }).count() === 1);
ok('Y no enseña una línea de músculos vacía', (await musculosDe('Press malformado')) === null);
ok('Sin errores de página', errores.length === 0, errores.slice(-1).join(''));
await p.close();

// ══ 16b · EL TEMPORIZADOR SE REINICIA CON CADA SERIE ══
// Cada serie dada por hecha reinicia el descanso con el del ejercicio que se
// acaba de hacer — también en una bi-serie con descansos distintos.
seccion('TEMPORIZADOR · SE REINICIA CON CADA SERIE');
const gymT = ago.find(d => d.sesion === 'gymA');
p = await nuevaPagina();
await abrirSesion(p, gymT.fecha);
const segundosTimer = () => p.evaluate(() => {
  const t = [...document.querySelectorAll('[role=timer] div')].map(d => d.textContent.trim()).find(x => /^\d\d:\d\d$/.test(x));
  if (!t) return null; const [m, s] = t.split(':').map(Number); return m * 60 + s;
});
const nombreTimer = () => p.evaluate(() => document.querySelector('[role=timer]')?.innerText.replace(/\n+/g, ' | ') ?? null);

await hecha(p, 'Press banca', 1);
const t1 = await segundosTimer();
ok('Hecha la serie 1 de banca arranca 3 min', t1 != null && t1 >= 178 && t1 <= 180, `${t1}s`);
await p.waitForTimeout(2500);
const t2 = await segundosTimer();
ok('El temporizador va bajando', t2 != null && t2 < t1, `${t1}s → ${t2}s`);
await hecha(p, 'Press banca', 2);
const t3 = await segundosTimer();
ok('Hecha la serie 2 REINICIA a 3 min, no sigue la cuenta anterior', t3 != null && t3 > t2 && t3 >= 178, `${t2}s → ${t3}s`);
ok('El temporizador dice qué serie se guardó y con qué', /serie 2 guardada/.test(await nombreTimer() ?? ''), await nombreTimer());
// Bi-serie: el press inclinado descansa 60 s. Hacer su serie manda su descanso, no el de banca.
await hecha(p, 'Press inclinado', 1);
const t4 = await segundosTimer();
ok('Un ejercicio de 60 s pone el temporizador a 60 s (el del ejercicio recién hecho)',
  t4 != null && t4 >= 58 && t4 <= 60, `${t4}s`);
ok('Y el nombre del temporizador es el del ejercicio recién hecho', /Press inclinado/.test(await nombreTimer() ?? ''), await nombreTimer());
// Abrir una bi-serie abre sus dos ejercicios a la vez: se alterna entre ellos
ok('La bi-serie abre sus dos ejercicios juntos', await p.locator('[data-abierto][data-ejercicio="A-3"]').count() === 1 && await p.locator('[data-abierto][data-ejercicio="A-4"]').count() === 1);
// Desmarcar NO arranca nada nuevo
await saltarDescanso(p); await p.waitForTimeout(300);
ok('Saltar quita el temporizador', (await segundosTimer()) == null);
await p.locator('[data-ejercicio="A-3"] button[aria-label^="Serie 1 hecha"]').click(); await p.waitForTimeout(300);
await p.locator('button', { hasText: 'Desmarcar esta serie' }).click(); await p.waitForTimeout(400);
ok('Desmarcar una serie no arranca el temporizador', (await segundosTimer()) == null);
ok('Y la serie queda sin marcar', (await ls(p)).prog[gymT.fecha]['A-3'].sets[0] === false);
await p.close();

// ══ 16c · E11 · DESHACER UNA BI-SERIE SOBRE LA MARCHA ══
// Las dos estaciones no siempre están libres. Hoy se pueden hacer los dos
// ejercicios por separado sin que la sesión cuente como incompleta ni se pierda
// el registro. Es del día, no de la rutina: mañana la bi-serie vuelve.
seccion('E11 · BI-SERIE SUELTA SOLO POR HOY');
const gymE11 = ago.find(d => d.sesion === 'gymA');
p = await nuevaPagina();
await abrirSesion(p, gymE11.fecha);
await abrirEjercicio(p, 'Press inclinado');
const badgeDe = (id) => p.evaluate((i) => {
  const card = document.querySelector(`[data-abierto][data-ejercicio="${i}"]`);
  const badge = [...(card?.querySelectorAll('span') ?? [])].find(s => /^BS\d/.test(s.textContent.trim()));
  const boton = card?.querySelector('button[aria-pressed]');
  return { badge: badge?.textContent.trim(), boton: boton?.textContent.trim(), pulsado: boton?.getAttribute('aria-pressed') };
}, id);
const antes3 = await badgeDe('A-3'), antes4 = await badgeDe('A-4');
ok('La BS1 se ve emparejada en sus dos ejercicios', /BS1 · antagonistas/.test(antes3.badge) && /BS1 · antagonistas/.test(antes4.badge), `${antes3.badge} / ${antes4.badge}`);
ok('Y cada uno ofrece "Hoy por separado"', antes3.boton === 'Hoy por separado' && antes4.pulsado === 'false');
// Marcar una serie ANTES de soltar, para comprobar que el registro no se pierde
await hecha(p, 'Press inclinado', 1, 300);
await saltarDescanso(p);
await p.locator('[data-abierto][data-ejercicio="A-3"] button[aria-pressed]').click();
await p.waitForTimeout(400);
// Suelta, solo queda abierto el que se estaba usando: el otro se abre al tocarlo
await abrirEjercicio(p, 'Face pull');
const tras4 = await badgeDe('A-4');
await abrirEjercicio(p, 'Press inclinado');
const tras3 = await badgeDe('A-3');
ok('Soltar desde uno cambia el badge de LOS DOS a "hoy sueltos"', /hoy sueltos/.test(tras3.badge) && /hoy sueltos/.test(tras4.badge), `${tras3.badge} / ${tras4.badge}`);
ok('Y el botón pasa a "Emparejar" en los dos', tras3.boton === 'Emparejar' && tras4.pulsado === 'true');
const dE11 = await ls(p);
ok('Se guarda en el día bajo __bsSueltas', JSON.stringify(dE11.prog?.[gymE11.fecha]?.__bsSueltas) === '["BS1"]', JSON.stringify(dE11.prog?.[gymE11.fecha]?.__bsSueltas));
ok('El registro previo de la serie no se pierde', dE11.prog?.[gymE11.fecha]?.['A-3']?.sets?.[0] === true);
ok('Y no cuenta como ejercicio registrado (el Reset sigue mirando solo los ejercicios)',
  Object.keys(dE11.prog[gymE11.fecha]).filter(k => !k.startsWith('__')).length === 1);
// La sesión se completa igual: todas las series de la BS1 suelta
for (let i = 2; i <= 3; i++) { await hecha(p, 'Press inclinado', i, 150); }
for (let i = 1; i <= 3; i++) { await hecha(p, 'Face pull', i, 150); }
await saltarDescanso(p);
await p.waitForTimeout(300);
const hechos = await p.evaluate(() => ['A-3', 'A-4'].map(id => {
  const c = document.querySelector(`[data-ejercicio="${id}"]`); return /hecho/i.test(c?.textContent ?? '');
}));
ok('Los dos ejercicios sueltos se marcan como hechos igual que emparejados', hechos.every(Boolean), JSON.stringify(hechos));
// Al día siguiente (otro gymA), la bi-serie vuelve a estar emparejada
await alCalendario(p);
const gymE11b = ago.find(d => d.sesion === 'gymA' && d.fecha > gymE11.fecha);
await abrirSesion(p, gymE11b.fecha);
await abrirEjercicio(p, 'Press inclinado');
const otroDia = await badgeDe('A-3');
ok('En otro día la bi-serie sigue emparejada: era una decisión de hoy, no de la rutina', /BS1 · antagonistas/.test(otroDia.badge) && otroDia.pulsado === 'false', otroDia.badge);
// Volver a emparejar limpia la clave
await alCalendario(p);
await abrirSesion(p, gymE11.fecha);
await abrirEjercicio(p, 'Face pull');
await p.locator('[data-abierto][data-ejercicio="A-4"] button[aria-pressed]').click();
await p.waitForTimeout(400);
ok('Emparejar de nuevo quita la clave del día (sin basura)', (await ls(p)).prog?.[gymE11.fecha]?.__bsSueltas === undefined);
await p.close();

// ══ 16d · AL TERMINAR, LA SESIÓN DICE QUÉ TOCA LA PRÓXIMA VEZ ══
seccion('SESIÓN TERMINADA');
{
  const gymF = ago.find(d => d.sesion === 'gymA');
  const progF = { [gymF.fecha]: {} };
  SESIONES.gymA.ejercicios.forEach(ex => {
    const sc = typeof ex.series === 'number' ? ex.series : 1;
    progF[gymF.fecha][ex.id] = { sets: Array(sc).fill(true), logs: Array(sc).fill({ kg: 40, reps: 8 }) };
  });
  p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, prog: progF });
  await abrirDia(p, gymF.fecha);
  ok('El día hecho ofrece «Ver sesión»', await p.locator('button', { hasText: /^Ver sesión/ }).count() === 1);
  await entrarSesion(p);
  const txtF = await p.evaluate(() => document.body.innerText);
  ok('Dice «Sesión completada»', /Sesión completada/.test(txtF));
  ok('Y qué carga toca la próxima vez en los compuestos (40 → 42.5)', /La próxima vez/i.test(txtF) && /42\.5 kg\s*sube/.test(txtF));
  await p.locator('button', { hasText: /^Listo$/ }).click(); await p.waitForTimeout(400);
  ok('«Listo» vuelve al día', await p.locator('nav[aria-label="Secciones"]').count() === 1);
  await p.close();
}

// ══ 16e · AJUSTES DEL PLAN: SEMANA, TURNOS, ROTACIÓN Y DEPORTES ══
// Nada se aplica hasta pulsar Guardar en cada pantalla, lo que se guarda es
// solo lo que cambió, y volver al plan original lo deja todo como estaba.
seccion('AJUSTES · TU SEMANA');
const abrirAjuste = async (p, titulo) => { await p.locator('main button', { hasText: titulo }).first().click(); await p.waitForTimeout(400); };
const guardarAjuste = async (p) => { await p.locator('button', { hasText: /^(Guardar|Crear deporte)$/ }).last().click(); await p.waitForTimeout(600); };
p = await nuevaPagina();
const calAntes = await sesionPorDia(p);
await irAAjustes(p);
ok('Ajustes empieza por «Tu plan»', await p.locator('text=/Tu plan/i').count() > 0 && await p.locator('main button', { hasText: 'Tu semana' }).count() === 1);
ok('Quien no toca nada no guarda config', (await ls(p)).config === undefined);
await abrirAjuste(p, 'Tu semana');
ok('Abre con lo del plan: 3 gym', await p.locator('[aria-label="Gym: 3"]').count() === 1);
await p.locator('button[aria-label="Más Gym"]').click(); await p.waitForTimeout(500);
ok('La vista previa se recalcula antes de guardar', await p.locator('section[aria-label="Así quedaría"]', { hasText: /3\.5\s*Gym/ }).count() === 1);
ok('Y no guarda nada hasta pulsar Guardar', (await ls(p)).config === undefined);
await guardarAjuste(p);
ok('Guardar deja solo lo que cambió', JSON.stringify((await ls(p)).config) === '{"cupo":{"gym":4}}', JSON.stringify((await ls(p)).config));
ok('Y el apartado se marca como cambiado', await p.locator('main button', { hasText: /Tu semana\s*Cambiado/ }).count() === 1);
await pestana(p, 'Progreso').click(); await p.waitForTimeout(500);
ok('Progreso mide la semana contra el cupo nuevo', /Gym\s*\d\/4/.test(await p.evaluate(() => document.body.innerText)));
await alCalendario(p);
const calCambiado = await sesionPorDia(p);
ok('El calendario cambia con el cupo nuevo', JSON.stringify(calCambiado) !== JSON.stringify(calAntes));
await irAAjustes(p);
await p.locator('button', { hasText: 'Volver al plan original' }).click(); await p.waitForTimeout(300);
ok('Volver al plan original pide confirmación', await p.locator('text=/Vuelve todo a lo del plan/').count() === 1);
await p.locator('button', { hasText: /^Volver al plan$/ }).click(); await p.waitForTimeout(600);
ok('Y deja la config vacía', (await ls(p)).config === undefined);
await alCalendario(p);
ok('Con el calendario de siempre', JSON.stringify(await sesionPorDia(p)) === JSON.stringify(calAntes));
await p.close();

seccion('AJUSTES · TURNOS');
p = await nuevaPagina();
await irAAjustes(p);
await abrirAjuste(p, 'Turnos');
ok('Enseña el ciclo del plan: L C N P', await p.locator('ol li').count() === 4);
ok('Y marca el turno de hoy (1 de agosto, Libre)', (await p.locator('[role=radio][aria-checked="true"]').getAttribute('aria-label')) === 'Hoy es el 1: Libre');
await p.locator('button[role=switch][aria-label="Gym en Turno día"]').click();
await p.locator('button[aria-label="Añadir Libre"]').click();
await p.locator('[role=radio][aria-label="Hoy es el 3: Noche"]').click(); await p.waitForTimeout(300);
await guardarAjuste(p);
const cT = (await ls(p)).config;
ok('Guarda el permiso cambiado y el ciclo con el turno de hoy',
  cT?.turnos?.C?.gym === true && JSON.stringify(cT?.ciclo?.turnos) === '["L","C","N","P","L"]' && cT.ciclo.hoy?.pos === 2, JSON.stringify(cT));
await pestana(p, 'Hoy').click(); await p.waitForTimeout(500);
ok('Hoy pasa a ser Noche', await p.locator('header', { hasText: 'Noche' }).count() === 1);
await p.close();

seccion('AJUSTES · ORDEN DE ROTACIÓN');
p = await nuevaPagina();
await irAAjustes(p);
await abrirAjuste(p, 'Orden de rotación');
ok('Sin avisos con el orden del plan', await p.locator('text=/trabajan lo mismo/').count() === 0);
await p.locator('button[aria-label="Subir Tracción en el gym"]').click(); await p.waitForTimeout(300);
ok('Poner Tracción justo después de Torso avisa de que trabajan lo mismo', await p.locator('text=/Tracción\\s*va justo después de Torso/').count() === 1);
await p.locator('button[aria-label="Sacar Pierna volumen de el gym"]').click(); await p.waitForTimeout(300);
ok('Sacar una sesión la deja «fuera de la rotación»', await p.locator('button[aria-label="Volver a meter Pierna volumen en el gym"]').count() === 1);
await guardarAjuste(p);
ok('Guarda el orden nuevo', JSON.stringify((await ls(p)).config?.rotacion?.gym) === '["gymA","gymC1","gymD","gymB"]', JSON.stringify((await ls(p)).config));
await pestana(p, 'Rutinas').click(); await p.waitForTimeout(500);
const txtR = await p.evaluate(() => document.body.innerText);
ok('Rutinas sigue el orden nuevo, con lo que salió aparte', txtR.indexOf('Torso') < txtR.indexOf('Tracción') && txtR.indexOf('Fuera de la rotación') > 0
  && txtR.indexOf('Pierna volumen') > txtR.indexOf('Fuera de la rotación'));
await p.close();

seccion('AJUSTES · TUS DEPORTES');
p = await nuevaPagina();
await irAAjustes(p);
await abrirAjuste(p, 'Tus deportes');
await p.locator('button', { hasText: 'Crear un deporte' }).click(); await p.waitForTimeout(300);
const btnCrearDep = p.locator('button', { hasText: /^Crear deporte$/ });
ok('Sin nombre no deja crear', await btnCrearDep.isDisabled());
await p.getByLabel('Nombre del deporte').fill('Escalada');
await p.getByRole('tab', { name: 'Automático' }).click(); await p.waitForTimeout(300);
await p.locator('button[aria-pressed]', { hasText: 'Noche' }).click(); await p.waitForTimeout(400);
ok('En automático enseña cómo quedaría, con el deporte contado', await p.locator('section[aria-label="Así quedaría"]', { hasText: 'Escalada' }).count() === 1);
await btnCrearDep.click(); await p.waitForTimeout(600);
const dep = (await ls(p)).config?.deportes?.[0];
ok('Se guarda con su modo y sus turnos', dep?.nombre === 'Escalada' && dep.modo === 'auto' && dep.porSemana === 1 && JSON.stringify(dep.turnos) === '["L","N","P"]', JSON.stringify(dep));
ok('Y aparece en la lista', await p.locator('main button', { hasText: /Escalada\s*Automático/ }).count() === 1);
await alCalendario(p);
const conEscalada = Object.values(await sesionPorDia(p)).filter(e => /Escalada/.test(e)).length;
ok('La app lo reparte sola en el calendario', conEscalada >= 3, conEscalada + ' días');
// Uno a mano: solo sale donde lo pongas
await irAAjustes(p);
await abrirAjuste(p, 'Tus deportes');
await p.locator('button', { hasText: 'Crear un deporte' }).click(); await p.waitForTimeout(300);
await p.getByLabel('Nombre del deporte').fill('Yoga');
await p.locator('button[aria-label="Icono Montaña"]').click();
await btnCrearDep.click(); await p.waitForTimeout(600);
await alCalendario(p);
ok('Uno «a mano» no aparece solo en el calendario', !Object.values(await sesionPorDia(p)).some(e => /Yoga/.test(e)));
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await abrirDia(p, '2026-08-03');
await elegirSesionEnModal(p, 'Yoga', 'Tus deportes');
await p.evaluate(() => [...document.querySelector('.fixed.inset-0').querySelectorAll('button')].find(b => /^Guardar/.test(b.textContent.trim()))?.click());
await p.waitForTimeout(700);
const idYoga = (await ls(p)).config.deportes.find(d => d.nombre === 'Yoga').id;
ok('Pero se puede poner en un día desde el calendario', (await ls(p)).fijados?.['2026-08-03']?.sesion === `dep_${idYoga}` && (await sesionPorDia(p))[3] === 'Yoga');
await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
await abrirDia(p, '2026-08-03');
ok('El día se llama como el deporte', (await p.locator('main h1').first().textContent()) === 'Yoga');
await entrarSesion(p);
await p.locator('button[aria-label^="Hecha la serie 1 de Yoga"]').click(); await p.waitForTimeout(400);
ok('Y se registra como cualquier sesión', (await ls(p)).prog?.['2026-08-03']?.[`dep_${idYoga}-1`]?.sets?.[0] === true);
await p.locator('button[aria-label="Volver al día"]').click(); await p.waitForTimeout(300);
// Rutinas: sale en «Tus deportes», con su ficha y su editor
await pestana(p, 'Rutinas').click(); await p.waitForTimeout(400);
ok('Rutinas lista tus deportes', await p.locator('section', { hasText: 'Tus deportes' }).locator('button', { hasText: 'Escalada' }).count() === 1);
await p.locator('main button', { hasText: /^Escalada/ }).first().click(); await p.waitForTimeout(400);
await p.locator('button', { hasText: 'Editar esta rutina' }).click(); await p.waitForTimeout(400);
ok('Y sus ejercicios se editan como los de cualquier rutina', await p.locator('text=/Editar Escalada/').count() === 1);
await p.locator('button', { hasText: 'Salir sin guardar' }).click(); await p.waitForTimeout(300);
// Archivar
await irAAjustes(p).catch(async () => { await alCalendario(p); await irAAjustes(p); });
if (await p.locator('main button', { hasText: 'Tus deportes' }).count() === 0) { await alCalendario(p); await irAAjustes(p); }
await abrirAjuste(p, 'Tus deportes');
await p.locator('main button', { hasText: /Escalada\s*Automático/ }).click(); await p.waitForTimeout(300);
await p.locator('button', { hasText: 'Archivar este deporte' }).click(); await p.waitForTimeout(200);
await p.locator('button', { hasText: /^Archivar$/ }).click(); await p.waitForTimeout(600);
ok('Archivar lo pasa a «Archivados»', await p.locator('section', { hasText: 'Archivados' }).locator('text=Escalada').count() === 1);
await alCalendario(p);
ok('Y deja de salir en el calendario', !Object.values(await sesionPorDia(p)).some(e => /Escalada/.test(e)));
ok('Sin errores de página', errores.length === 0, errores.slice(-1).join(''));
await p.close();

seccion('AJUSTES · EN EL RESPALDO');
p = await nuevaPagina({ v: 3, prog: {}, prs: {}, fijados: {}, festivos: [], config: { cupo: { gym: 2 }, deportes: [{ id: 'esc', nombre: 'Escalada', modo: 'auto', porSemana: 1, turnos: ['L', 'P', 'N'] }] } }, { acceptDownloads: true });
ok('La config guardada se carga al abrir', await p.locator('main button[data-etiqueta*="Escalada"]').count() > 0);
await irAAjustes(p);
const [dlC] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.locator('button').filter({ hasText: 'Exportar' }).click()]);
await dlC.saveAs('/tmp/plan-config.json');
ok('Exportar la incluye', JSON.parse(fs.readFileSync('/tmp/plan-config.json', 'utf8')).config?.cupo?.gym === 2);
fs.writeFileSync('/tmp/plan-sin-config.json', JSON.stringify({ v: 3, prog: {}, prs: {}, fijados: {}, festivos: [] }));
await importar(p, '/tmp/plan-sin-config.json', 800);
ok('Importar un respaldo sin ajustes vuelve al plan', (await ls(p)).config === undefined);
await importar(p, '/tmp/plan-config.json', 800);
ok('E importar uno con ajustes los trae', (await ls(p)).config?.cupo?.gym === 2 && /con tus ajustes del plan/.test(await p.evaluate(() => document.body.innerText)));
await p.close();

// ══ 17 · UN RESPALDO CON EJERCICIOS MALFORMADOS NO DEJA LA APP EN BLANCO ══
// `musculos` es metadata que llegó en la v6. Un respaldo anterior, o uno editado
// a mano, puede traerlo con otra forma o sin `primario`. El volumen por músculo
// reventaba la pantalla entera en cuanto la semana visible contenía esa sesión.
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
ok('El calendario pinta con la rutina malformada cargada', await p.locator('header .lucide-settings').count() === 1);
await pestana(p, 'Progreso').click(); await p.waitForTimeout(500);
await p.locator('button', { hasText: 'Volumen por músculo' }).click(); await p.waitForTimeout(400);
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
await pestana(p, 'Calendario').click(); await p.waitForTimeout(400);
const btnMes = mesesDesdeHoy < 0 ? 'Mes anterior' : 'Mes siguiente';
for (let i = 0; i < Math.abs(mesesDesdeHoy); i++) { await p.locator(`button[aria-label="${btnMes}"]`).click().catch(() => {}); await p.waitForTimeout(160); }
ok('Un día de la semana rota se puede abrir', gymA4 && (await abrirDia(p, gymA4.fecha), await p.locator('text=/ejercicios/i').count() > 0));
await p.close();


// ══ RUNNING · SESIONES PROPIAS ══
seccion('RUNNING');
{
  const runDia = ago.find(d => d.sesion === 'running');          // la primera carrera: el test
  const runSec = ago.find(d => d.sesionSecundaria === 'running');
  p = await nuevaPagina();
  const celdas = await sesionPorDia(p);
  ok('La celda dice qué carrera es, no «Running»', celdas[runDia.dia]?.startsWith(INFO_RUN[runDia.variante].label), celdas[runDia.dia]);
  ok('También cuando la carrera va de segunda sesión', !!runSec && celdas[runSec.dia]?.includes(`+ ${INFO_RUN[runSec.varianteSecundaria].label}`), runSec && celdas[runSec.dia]);
  ok('La primera carrera del plan es el test de 30 min', runDia.variante === 'runTest');
  await abrirDia(p, runDia.fecha);
  ok('El día enseña la sesión de running', await p.locator('h1', { hasText: SESIONES.runTest.nombre }).count() === 1);
  await p.locator('button', { hasText: 'Cambiar la sesión de hoy' }).click(); await p.waitForTimeout(300);
  const txtSel = await p.evaluate(() => document.body.innerText);
  ok('El selector ofrece las 7 de running', VARIANTES_DE.running.every(k => txtSel.includes(INFO_RUN[k].label)));
  ok('Y marca la que toca', await p.locator('button', { hasText: 'Test 30 min' }).filter({ hasText: 'toca' }).count() === 1);
  await p.locator('button', { hasText: /^Series 4×4/ }).last().click(); await p.waitForTimeout(600);
  const fRun = (await ls(p)).fijados?.[runDia.fecha];
  ok('Elegir Series 4×4 fija la variante sin cambiar el tipo del día', fRun?.sesion === 'running' && fRun?.variante === 'runB3', JSON.stringify(fRun));
  ok('Y el día pasa a ser esa sesión', await p.locator('h1', { hasText: SESIONES.runB3.nombre }).count() === 1);
  await p.locator('button', { hasText: 'Cambiar la sesión de hoy' }).click(); await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Volver a la que toca por rotación' }).click(); await p.waitForTimeout(600);
  ok('«Volver a la que toca» suelta el día', !(await ls(p)).fijados?.[runDia.fecha]);
  await entrarSesion(p);
  ok('En una carrera sale el panel de zonas', await p.locator('[aria-label="Zonas de running"]').count() === 1);
  ok('Sin test, las zonas van por sensaciones', await p.locator('text=/Aún no tienes ritmo umbral/').count() === 1
    && await p.locator('[aria-label="Zonas de running"]', { hasText: 'RPE 3-4' }).count() === 1);
  ok('Sin las partes del gym: una carrera son bloques', await p.locator('text=/Parte 1 · Series rectas/').count() === 0);
  await p.getByLabel('Kilómetros en 30 minutos').fill('6.2'); await p.waitForTimeout(300);
  ok('Calcula el ritmo umbral (6,2 km → 4:50 / km)', await p.locator('button', { hasText: 'Guardar ritmo 4:50 / km' }).count() === 1);
  await p.locator('button', { hasText: 'Guardar ritmo 4:50 / km' }).click(); await p.waitForTimeout(600);
  ok('Se guarda en segundos por km', (await ls(p)).umbralRun === 290, String((await ls(p)).umbralRun));
  ok('Y las zonas pasan a ritmos por km (Suave 5:34–6:17)', await p.locator('[aria-label="Zonas de running"]', { hasText: '5:34–6:17' }).count() === 1);
  await p.getByLabel('Kilómetros en 30 minutos').fill('15'); await p.waitForTimeout(300);
  ok('Un ritmo imposible avisa y no deja guardarlo', await p.locator('text=/fuera de lo plausible/').count() === 1
    && await p.locator('button', { hasText: /^Guardar ritmo/ }).count() === 0);
  await p.close();

  // Editar el día: elegir una variante guarda el TIPO con esa variante
  p = await nuevaPagina();
  await p.locator('button[aria-label="Modo edición"]').click(); await p.waitForTimeout(300);
  await abrirDia(p, runDia.fecha);
  await elegirSesionEnModal(p, 'Tempo', 'Cardio');
  await p.evaluate(() => [...document.querySelector('.fixed.inset-0').querySelectorAll('button')].find(x => /^Guardar/.test(x.textContent.trim()))?.click());
  await p.waitForTimeout(700);
  const fT = (await ls(p)).fijados?.[runDia.fecha];
  ok('Elegir Tempo al editar el día lo guarda como running + Tempo', fT?.sesion === 'running' && fT?.variante === 'runB1', JSON.stringify(fT));
  ok('El calendario lo enseña', (await sesionPorDia(p))[runDia.dia]?.startsWith('Tempo'), (await sesionPorDia(p))[runDia.dia]);
  await p.close();

  // Rutinas y Ajustes
  p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, css: null, prog: {}, rutina: {}, umbralRun: 300 });
  ok('Un umbral guardado se lee al arrancar', (await ls(p)).umbralRun === 300);
  await pestana(p, 'Rutinas').click(); await p.waitForTimeout(500);
  const txtRut = await p.evaluate(() => document.body.innerText);
  const iRun = txtRut.search(/Running · rotación/i), iSuelto = txtRut.indexOf('Para un día suelto');
  ok('Rutinas enseña la rotación de running (4) y aparte las de un día suelto',
    iRun > 0 && iSuelto > iRun && ['Rodaje suave', 'Tempo', 'Fondo largo', 'Series 4×4'].every(t => txtRut.indexOf(t, iRun) < iSuelto)
    && ['Series de umbral', 'Cuestas'].every(t => txtRut.indexOf(t, iSuelto) > iSuelto) && txtRut.includes('Cada ~12 carreras'));
  await p.locator('button', { hasText: 'Series 4×4' }).first().click(); await p.waitForTimeout(500);
  ok('Abre la ficha de una carrera', await p.locator('h1', { hasText: SESIONES.runB3.nombre }).count() === 1
    && await p.locator('text=/Helgerud/').count() === 1);
  await p.close();
  p = await nuevaPagina();
  await irAAjustes(p);
  await abrirAjuste(p, 'Orden de rotación');
  ok('La rotación de running se puede ordenar', await p.locator('button[aria-label="Subir Tempo en el running"]').count() === 1);
  ok('Las que no están en la rotación se pueden volver a meter', await p.locator('button[aria-label="Volver a meter Cuestas en el running"]').count() === 1);
  await p.locator('button[aria-label="Volver a meter Cuestas en el running"]').click(); await p.waitForTimeout(300);
  await p.locator('button[aria-label="Sacar Fondo largo de el running"]').click(); await p.waitForTimeout(300);
  await guardarAjuste(p);
  ok('Y se guarda solo lo que cambió', JSON.stringify((await ls(p)).config?.rotacion) === '{"running":["runA1","runB1","runB3","runA3"]}', JSON.stringify((await ls(p)).config));
  await p.close();
}

// ══ ALTERNATIVAS DE EJERCICIO ══
seccion('ALTERNATIVAS');
{
  const diaA = ago.find(d => d.sesion === 'gymA' && !d.sesionSecundaria);
  const lat = SESIONES.gymA.ejercicios.find(e => e.nombre === 'Elevación lateral en polea');
  p = await nuevaPagina();
  await abrirSesion(p, diaA.fecha);
  await abrirEjercicio(p, lat.nombre);
  const btn = p.locator(`button[aria-label="Cambiar ${lat.nombre}"]`);
  ok('Un ejercicio de gym abierto tiene «Cambiar»', await btn.count() === 1);
  await btn.click(); await p.waitForTimeout(300);
  const hoja = p.locator('[role="dialog"]');
  ok('Se abre la hoja con las alternativas de su familia',
    await hoja.locator('[role="radio"]').count() === 4 && await hoja.locator('text=Tu plan').count() === 0
    && await hoja.locator('[role="radio"][aria-checked="true"]', { hasText: lat.nombre }).count() === 1);
  ok('Con la actual elegida, no se puede confirmar nada',
    await hoja.locator('button', { hasText: 'Solo hoy' }).isDisabled() && await hoja.locator('button', { hasText: 'Desde ahora' }).isDisabled());
  await hoja.locator('[role="radio"]', { hasText: 'Elevación lateral con mancuernas' }).click();
  await hoja.locator('button', { hasText: 'Solo hoy' }).click(); await p.waitForTimeout(500);
  const dia1 = (await ls(p)).prog?.[diaA.fecha];
  ok('«Solo hoy» se guarda como nota del día', dia1?.__cambios?.[lat.id] === 'Elevación lateral con mancuernas', JSON.stringify(dia1));
  ok('Y no fija el día en el calendario', !(await ls(p)).fijados?.[diaA.fecha]);
  ok('La tarjeta pasa a ser la alternativa, marcada «Solo hoy»',
    await p.locator('[data-abierto] h3', { hasText: 'Elevación lateral con mancuernas' }).count() === 1
    && await p.locator('[data-abierto]', { hasText: 'Solo hoy' }).count() >= 1);
  ok('Sigue en su bi-serie', await p.locator('[data-abierto]', { hasText: lat.bs }).count() >= 1);
  await hecha(p, 'Elevación lateral con mancuernas', 1, 500);
  await saltarDescanso(p);
  const dia2 = (await ls(p)).prog?.[diaA.fecha];
  const idAlt = `${lat.id}~elevacion-lateral-con-mancuernas`;
  ok('La serie se registra con el id de la alternativa (historial propio)', dia2?.[idAlt]?.sets?.[0] === true && !dia2?.[lat.id], Object.keys(dia2 ?? {}).join(','));
  await abrirEjercicio(p, 'Elevación lateral con mancuernas');
  ok('Con una serie hecha ya no se puede cambiar', await p.locator('button[aria-label="Cambiar Elevación lateral con mancuernas"]').count() === 0);
  ok('No aparece como ejercicio huérfano', await p.locator('text=/ya no están en tu rutina/').count() === 0);
  await p.close();

  // Otro día de la misma sesión: vuelve la de la rutina
  const otroA = ago.find(d => d.sesion === 'gymA' && d.fecha > diaA.fecha);
  p = await nuevaPagina({ v: 3, prs: {}, fijados: {}, extras: {}, css: null, rutina: {},
    prog: { [diaA.fecha]: { __cambios: { [lat.id]: 'Elevación lateral con mancuernas' } } } });
  await abrirSesion(p, otroA.fecha);
  await abrirEjercicio(p, lat.nombre);
  ok('Otro día vuelve el ejercicio de la rutina', await p.locator('[data-abierto] h3', { hasText: lat.nombre }).count() === 1);

  // Desde ahora
  await p.locator(`button[aria-label="Cambiar ${lat.nombre}"]`).click(); await p.waitForTimeout(300);
  await p.locator('[role="dialog"] [role="radio"]', { hasText: 'Elevación lateral en máquina' }).click();
  await p.locator('[role="dialog"] button', { hasText: 'Desde ahora' }).click(); await p.waitForTimeout(600);
  const rut = (await ls(p)).rutina?.gymA;
  const ult = rut?.at(-1);
  ok('«Desde ahora» guarda una versión nueva de la rutina, con motivo',
    ult?.ejercicios.some(e => e.nombre === 'Elevación lateral en máquina' && e.alt?.de === lat.id)
    && ult.motivo === `Cambio: ${lat.nombre} → Elevación lateral en máquina`, JSON.stringify(ult?.motivo));
  ok('Y la sesión la enseña sin la marca «Solo hoy»',
    await p.locator('[data-ejercicio] h3', { hasText: 'Elevación lateral en máquina' }).count() === 1
    && await p.locator('[data-abierto]', { hasText: 'Solo hoy' }).count() === 0);
  ok('El resto de la rutina queda igual', ult?.ejercicios.length === SESIONES.gymA.ejercicios.length
    && ult.ejercicios.filter(e => !e.alt).every(e => SESIONES.gymA.ejercicios.some(x => x.id === e.id)));
  await abrirEjercicio(p, 'Elevación lateral en máquina');
  await p.locator('button[aria-label="Cambiar Elevación lateral en máquina"]').click(); await p.waitForTimeout(300);
  ok('Desde la rutina cambiada, la del plan sale marcada «Tu plan»',
    await p.locator('[role="dialog"] [role="radio"]', { hasText: lat.nombre }).filter({ hasText: 'Tu plan' }).count() === 1);
  await p.locator('[role="dialog"] [role="radio"]', { hasText: lat.nombre }).click();
  await p.locator('[role="dialog"] button', { hasText: 'Desde ahora' }).click(); await p.waitForTimeout(600);
  ok('Y se puede volver a ella para siempre, con su id de siempre',
    (await ls(p)).rutina.gymA.at(-1).ejercicios.some(e => e.id === lat.id && e.nombre === lat.nombre && !e.alt));
  await p.close();

  // Lo que no es gym no ofrece alternativas
  const runDia = ago.find(d => d.sesion === 'running');
  p = await nuevaPagina();
  await abrirSesion(p, runDia.fecha);
  ok('Una carrera no tiene «Cambiar»', await p.locator('button[aria-label^="Cambiar "]').count() === 0);
  await p.close();
}

console.log('\n=== Errores de página: ' + (errores.length || 'ninguno') + ' ===');
if (errores.length) console.log(errores.slice(0, 5).join('\n'));
console.log(`\n══ ${n - fallos}/${n} pruebas de interfaz ══`);

// Sin esto el proceso queda vivo con el navegador abierto y la suite nunca termina.
await b.close();
process.exit(fallos || errores.length ? 1 : 0);
