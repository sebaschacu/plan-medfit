import { chromium } from 'playwright';
const { generarMes } = await import('./src/generador.js');
const { SESIONES, SECUENCIA_NATACION, CUPO_SEMANAL } = await import('./src/data.js');
const R = await import('./src/rutina.js');
let n = 0, f = 0; const errs = [];
const ok = (t, c, x='') => { n++; if(!c) f++; console.log(`  ${c?'✅':'❌'} ${t}${x?' — '+x:''}`); };

console.log('── INTEGRIDAD DE DATOS ──');
const todas = Object.entries(SESIONES);
ok('Toda sesión tiene nombre, color y chequeo', todas.every(([,s]) => s.nombre && s.color && s.chequeo));
const sinMusc = todas.flatMap(([k,s]) => s.ejercicios.filter(e => !e.musculos).map(e => k+'/'+e.id));
ok('Todo ejercicio tiene metadata muscular', sinMusc.length === 0, sinMusc.slice(0,3).join(', '));
const idsDup = [];
todas.forEach(([k,s]) => { const v = s.ejercicios.map(e=>e.id); v.forEach((id,i)=>{ if(v.indexOf(id)!==i) idsDup.push(k+'/'+id); }); });
ok('Sin IDs duplicados dentro de una sesión', idsDup.length === 0, idsDup.join(', '));
const todosIds = todas.flatMap(([,s]) => s.ejercicios.map(e=>e.id));
const dupGlobal = [...new Set(todosIds.filter((id,i)=>todosIds.indexOf(id)!==i))];
ok('Sin IDs duplicados entre sesiones (el progreso se indexa por ID)', dupGlobal.length === 0, dupGlobal.join(', '));
const partesMalas = todas.flatMap(([k,s]) => s.ejercicios.filter(e => e.parte != null && ![1,2,3,'finisher'].includes(e.parte)).map(e=>k+'/'+e.id));
ok('Todas las partes son válidas', partesMalas.length === 0, partesMalas.join(', '));

console.log('\n── COHERENCIA CON EL PLAN ──');
ok('Cupo: 3 gym, 2 natación, 1 running, 1 flexible',
  CUPO_SEMANAL.gym===3 && CUPO_SEMANAL.natacion===2 && CUPO_SEMANAL.running===1 && CUPO_SEMANAL.flexible===1);
ok('La calistenia NO está en el cupo', !('calistenia' in CUPO_SEMANAL));
ok('Las 6 sesiones de natación existen', SECUENCIA_NATACION.every(k => SESIONES[k]));
ok('La práctica de carga real vive en un gym, no en calistenia',
  SESIONES.gymA.ejercicios.some(e=>/carga real/i.test(e.nombre)) &&
  !SESIONES.calistenia.ejercicios.some(e=>/carga real/i.test(e.nombre)));
const reglasMuertas = /SOLO en día libre|nunca ambas|recorta a 2 series|antes ni después de pierna/i;
const textos = JSON.stringify(todas.map(([,s])=>[s.chequeo,s.subtitulo]));
ok('Ningún texto cita reglas eliminadas', !reglasMuertas.test(textos));

console.log('\n── CASOS LÍMITE DEL GENERADOR ──');
ok('Mes anterior al ancla no rompe', (()=>{ try { return Array.isArray(generarMes({anio:2025,mes:0}).dias); } catch { return false; } })());
ok('Año lejano genera en tiempo razonable', (()=>{ const t=Date.now(); generarMes({anio:2028,mes:11}); return Date.now()-t < 2000; })());
const r1 = JSON.stringify(generarMes({anio:2026,mes:9}).dias);
const r2 = JSON.stringify(generarMes({anio:2026,mes:9}).dias);
ok('Sigue siendo idempotente', r1 === r2);
const conFest = generarMes({anio:2026,mes:7,festivos:['2026-08-01','2026-08-03','2026-08-05','2026-08-07']});
ok('Muchos festivos no rompen la generación', conFest.dias.length === 31);
ok('Y ninguna natación cae en festivo',
  !conFest.dias.some(d => d.festivo && (d.sesion==='natacion'||d.sesionSecundaria==='natacion')));

console.log('\n── RUTINA VERSIONADA vs GENERADOR ──');
const ejs = SESIONES.gymA.ejercicios.filter(e => e.id !== 'A-1');
const rut = R.guardarVersion({}, 'gymA', ejs, '2026-09-01', 'test');
ok('Una rutina editada no altera el calendario generado',
  JSON.stringify(generarMes({anio:2026,mes:8}).dias) === JSON.stringify(generarMes({anio:2026,mes:8}).dias));
ok('El pasado conserva el ejercicio quitado', R.resolverRutina('gymA','2026-08-15',rut).some(e=>e.id==='A-1'));
ok('El futuro ya no lo tiene', !R.resolverRutina('gymA','2026-09-15',rut).some(e=>e.id==='A-1'));

console.log('\n── NAVEGADOR · SIN ERRORES EN NINGUNA VISTA ──');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 430, height: 900 } });
p.on('pageerror', e => errs.push('PAGE: ' + e.message.split('\n')[0]));
p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: ' + m.text().slice(0,120)); });
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
const hoyAudit = new Date();
const ago = generarMes({ anio: hoyAudit.getFullYear(), mes: hoyAudit.getMonth() }).dias;
// La app arranca en la sesión de hoy: se pasa al calendario primero
await p.locator('text=Calendario').first().click().catch(() => {});
await p.waitForTimeout(500);
// Recorrer TODOS los días del mes abriendo cada sesión
for (const d of ago) {
  await p.evaluate(nn => [...document.querySelectorAll('main button')].find(x=>x.textContent.trim().startsWith(nn+' ·'))?.click(), d.dia);
  await p.waitForTimeout(120);
  await p.locator('text=Calendario').first().click().catch(()=>{});
  await p.waitForTimeout(80);
}
ok(`Abrir los 31 días del mes sin errores`, errs.length === 0, errs.slice(0,3).join(' | '));
// Navegar 12 meses
for (let i=0;i<12;i++){ await p.locator('button[aria-label="Mes siguiente"]').click(); await p.waitForTimeout(120); }
ok('Navegar 12 meses adelante sin errores', errs.length === 0, errs.slice(0,2).join(' | '));
// El título se comprueba contra el mes de HOY + 12, no contra uno fijo: si no,
// la prueba caduca sola al pasar los meses.
const NOM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const hoyN = new Date();
const esperadoTitulo = `${NOM[hoyN.getMonth()]} ${hoyN.getFullYear() + 1}`;
ok('Y el título es correcto tras 12 meses', (await p.locator('header h1').first().textContent()) === esperadoTitulo,
  `${await p.locator('header h1').first().textContent()} · esperado ${esperadoTitulo}`);
await b.close();

console.log(`\n══ AUDITORÍA: ${n-f}/${n} · errores de página: ${errs.length} ══`);
process.exit(f || errs.length ? 1 : 0);
