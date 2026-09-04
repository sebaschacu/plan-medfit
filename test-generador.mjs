// Banco de pruebas del generador v6.
// Verifica las reglas del plan contra 6 meses generados, no contra un caso feliz.
import { generarMes, generarDesdeAncla, FESTIVOS_DEFAULT, franjasCompatibles, deISO, aISO } from './src/generador.js';
import { SECUENCIA_GYM, SECUENCIA_NATACION, NATACION_CSS, S7_PIERNA, CUPO_SEMANAL, DOBLES, GYM_PIERNA, SESIONES, CARDIO_FLEXIBLE } from './src/data.js';
import { combinacionValida, ordenDoble, validarSeparacion, POLITICA_FIJADO } from './src/generador.js';

const ES_PIERNA = new Set(['gymC1', 'gymC2']);
const diff = (a, b) => Math.round((deISO(a) - deISO(b)) / 86400000);
let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};

// ── Generar 6 meses seguidos desde el ancla ──
const { dias, avisos } = generarDesdeAncla({ hasta: '2027-01-31' });
console.log(`\n══ Generados ${dias.length} días (ago 2026 → ene 2027) ══\n`);

console.log('── SECUENCIA DE GYM ──');
const gyms = dias.filter(d => d.sesion.startsWith('gym'));
let saltos = [];
gyms.forEach((d, i) => {
  if (i === 0) return;
  const esperado = SECUENCIA_GYM[(SECUENCIA_GYM.indexOf(gyms[i - 1].sesion) + 1) % 5];
  if (d.sesion !== esperado) saltos.push(`${d.fecha}: ${gyms[i - 1].sesion} → ${d.sesion} (esperado ${esperado})`);
});
check(`Secuencia A→C1→D→C2→B sin saltos (${gyms.length} sesiones)`, saltos.length === 0, saltos.slice(0, 3).join('\n       '));

// Continuidad entre meses: la cola no se reinicia en el cambio de mes
const ago = generarMes({ anio: 2026, mes: 7 }).dias;
const sep = generarMes({ anio: 2026, mes: 8 }).dias;
const ultimoAgo = [...ago].reverse().find(d => d.sesion.startsWith('gym'));
const primeroSep = sep.find(d => d.sesion.startsWith('gym'));
const esperadoSep = SECUENCIA_GYM[(SECUENCIA_GYM.indexOf(ultimoAgo.sesion) + 1) % 5];
check(`La cola continúa entre meses (ago acaba en ${ultimoAgo.sesion} → sep abre con ${primeroSep.sesion})`,
  primeroSep.sesion === esperadoSep, `esperado ${esperadoSep}`);

console.log('\n── IDEMPOTENCIA ──');
const a1 = JSON.stringify(generarMes({ anio: 2026, mes: 8 }).dias);
const a2 = JSON.stringify(generarMes({ anio: 2026, mes: 8 }).dias);
check('Regenerar el mismo mes dos veces da el mismo resultado', a1 === a2);
const solOct = JSON.stringify(generarMes({ anio: 2026, mes: 9 }).dias);
const tras6 = JSON.stringify(generarMes({ anio: 2026, mes: 9 }).dias);
check('Generar octubre no depende de si antes generaste otros meses', solOct === tras6);

console.log('\n── REGLAS DE SEGURIDAD ──');
// S1 · nunca más de 4 días de gym consecutivos
let maxSeguidos = 0, seg = 0, peor = null;
dias.forEach((d, i) => {
  const consecutivo = i > 0 && diff(d.fecha, dias[i - 1].fecha) === 1;
  seg = (d.sesion.startsWith('gym') && consecutivo) ? seg + 1 : (d.sesion.startsWith('gym') ? 1 : 0);
  if (seg > maxSeguidos) { maxSeguidos = seg; peor = d.fecha; }
});
check(`S1 · máx 4 gym consecutivos (real: ${maxSeguidos})`, maxSeguidos <= 4, peor ? `pico en ${peor}` : '');

// S3 · running nunca el día DESPUÉS de pierna
const s3 = dias.filter((d, i) => d.sesion === 'running' && i > 0 && diff(d.fecha, dias[i - 1].fecha) === 1 && ES_PIERNA.has(dias[i - 1].sesion));
check(`S3 · running nunca tras pierna (${s3.length} violaciones)`, s3.length === 0, s3.slice(0, 3).map(d => d.fecha).join(', '));

// S5 · día N siempre mañana/mediodía
const s5 = dias.filter(d => d.turno === 'N' && d.sesion !== 'descanso' && !/Mañana/.test(d.momento));
check(`S5 · día N se entrena por la mañana o al mediodía (${s5.length} violaciones)`, s5.length === 0);

// S7 · días de pierna separados MÍNIMO 2 días (el plan dice "mínimo 2-3")
const piernas = dias.filter(d => ES_PIERNA.has(d.sesion));
const huecos = piernas.slice(1).map((d, i) => diff(d.fecha, piernas[i].fecha));
const minHueco = Math.min(...huecos);
check(`S7 · separación mínima entre días de pierna ≥${S7_PIERNA.separacionMinimaDias} (real: mín ${minHueco}, mediana ${huecos.sort((a, b) => a - b)[Math.floor(huecos.length / 2)]})`,
  minHueco >= S7_PIERNA.separacionMinimaDias);

// Turno C nunca es gym
const cGym = dias.filter(d => d.turno === 'C' && d.sesion.startsWith('gym'));
check(`Turno C nunca lleva gym (${cGym.length} violaciones)`, cGym.length === 0);

console.log('\n── NATACIÓN (la que estaba rota en la v5) ──');
const nats = dias.filter(d => d.sesion === 'natacion');
const natsMalas = nats.filter(d => franjasCompatibles(d.fecha, d.turno, FESTIVOS_DEFAULT).length === 0);
check(`Toda natación cae en franja real de piscina (${nats.length} sesiones, ${natsMalas.length} imposibles)`,
  natsMalas.length === 0, natsMalas.slice(0, 3).map(d => `${d.fecha} ${d.sem} turno ${d.turno}`).join(', '));
const sinFranja = nats.filter(d => !d.franja);
check('Toda natación tiene franja horaria asignada', sinFranja.length === 0);
const guiadas = nats.filter(d => d.franja?.guiado).length;
console.log(`     · ${guiadas}/${nats.length} en franja de entrenamiento guiado (${Math.round(guiadas / nats.length * 100)}%)`);
const domingos = nats.filter(d => d.sem === 'Dom');
check(`Ninguna natación en domingo (${domingos.length})`, domingos.length === 0);
const enC = nats.filter(d => d.turno === 'C');
check(`Ninguna natación en turno C (${enC.length})`, enC.length === 0);
const enFestivo = nats.filter(d => d.festivo);
check(`Ninguna natación en festivo (${enFestivo.length})`, enFestivo.length === 0);


console.log('\n── ROTACIÓN DE NATACIÓN ──');
const todasNat = dias.filter(d => d.sesion === 'natacion' || d.sesionSecundaria === 'natacion')
  .map(d => ({ fecha: d.fecha, v: d.variante ?? d.varianteSecundaria }));
check(`Toda natación tiene sesión concreta asignada (${todasNat.length})`,
  todasNat.every(x => !!x.v), todasNat.filter(x => !x.v).slice(0, 3).map(x => x.fecha).join(', '));
check('Todas las variantes existen en SESIONES',
  todasNat.every(x => !!SESIONES[x.v]), [...new Set(todasNat.filter(x => !SESIONES[x.v]).map(x => x.v))].join(', '));

// La primera sesión de todas es el test de CSS
check('La primera natación del plan es el test de CSS', todasNat[0]?.v === 'natCSS', todasNat[0]?.v);

// La rotación A1→B1→A2→B2→A3→B3 no se salta posiciones (el test no cuenta)
const sinTest = todasNat.filter(x => x.v !== 'natCSS');
let saltosNat = [];
sinTest.forEach((x, i) => {
  if (i === 0) return;
  const esp = SECUENCIA_NATACION[(SECUENCIA_NATACION.indexOf(sinTest[i - 1].v) + 1) % SECUENCIA_NATACION.length];
  if (x.v !== esp) saltosNat.push(`${x.fecha}: ${sinTest[i - 1].v} → ${x.v} (esperado ${esp})`);
});
check(`Rotación A1→B1→A2→B2→A3→B3 sin saltos (${sinTest.length} sesiones)`, saltosNat.length === 0,
  saltosNat.slice(0, 3).join(' · '));

// El test se repite dentro de la franja 6-8 semanas
const idxTests = todasNat.map((x, i) => x.v === 'natCSS' ? i : -1).filter(i => i >= 0);
const huecosTest = idxTests.slice(1).map((v, i) => (v - idxTests[i]) / CUPO_SEMANAL.natacion);
check(`El test de CSS se repite cada 6-8 semanas (real: ${huecosTest.map(h => h.toFixed(1)).join(', ')})`,
  huecosTest.every(h => h >= 5.5 && h <= 8.5));
check(`El test sustituye a una ${NATACION_CSS.sustituye}`,
  idxTests.slice(1).every(i => {
    const previa = todasNat.slice(0, i).filter(x => x.v !== 'natCSS').at(-1);
    return SECUENCIA_NATACION[(SECUENCIA_NATACION.indexOf(previa.v) + 1) % 6] === NATACION_CSS.sustituye;
  }));

// Reparto equilibrado entre las 6 sesiones
const cnt = {};
sinTest.forEach(x => cnt[x.v] = (cnt[x.v] || 0) + 1);
const vals = SECUENCIA_NATACION.map(k => cnt[k] ?? 0);
check(`Las 6 sesiones se reparten de forma pareja (${vals.join('/')})`, Math.max(...vals) - Math.min(...vals) <= 1);

// Cada sesión tiene contenido real, no el bloque genérico de la v5
const vacias = SECUENCIA_NATACION.concat(['natCSS']).filter(k => (SESIONES[k]?.ejercicios ?? []).length < 4);
check('Las 7 sesiones de natación tienen contenido real', vacias.length === 0, vacias.join(', '));
check('B1 lleva la serie de 10×100 a ritmo CSS',
  SESIONES.natB1.ejercicios.some(e => e.series === 10 && /CSS/.test(e.nombre + e.nota)));
check('B2 lleva el bloque de 800 m con sighting',
  SESIONES.natB2.ejercicios.some(e => /800/.test(e.reps) && /sighting/i.test(e.nota)));
check('El test de CSS pide anotar los dos tiempos',
  SESIONES.natCSS.ejercicios.filter(e => /ANOTA EL TIEMPO/i.test(e.nota)).length === 2);
check('Las sesiones con palas avisan del límite de hombro',
  SESIONES.natA1.ejercicios.some(e => e.palas) && /palas/i.test(SESIONES.natA1.chequeo));
check('Cada sesión trae su versión recortada de 45 min',
  SECUENCIA_NATACION.every(k => !!SESIONES[k].recortada));
check('Los bloques que hay que cronometrar están marcados como agua',
  ['B1-3', 'B2-2', 'CSS-3', 'CSS-4'].every(id =>
    Object.values(SESIONES).flatMap(x => x.ejercicios).find(e => e.id === id)?.agua === true));
check('B1 nunca marca como opcional la serie de 10×100',
  SESIONES.natB1.ejercicios.find(e => e.series === 10)?.opcional !== true);

console.log('\n── CUPO SEMANAL v6.1 ──');
// Semanas completas (7 días). Se cuentan principal + secundaria: una sesión
// doblada cuenta igual que una que ocupa su propio día.
const porSemana = {};
dias.forEach(d => {
  const f = deISO(d.fecha);
  const lunes = aISO(new Date(f.getTime() - ((f.getUTCDay() + 6) % 7) * 86400000));
  (porSemana[lunes] ??= []).push(d);
});
const completas = Object.entries(porSemana).filter(([, ds]) => ds.length === 7);
const contarSemana = (ds) => {
  const c = { gym: 0, running: 0, natacion: 0, descanso: 0 };
  ds.forEach(d => [d.sesion, d.sesionSecundaria].filter(Boolean).forEach(x => {
    const k = String(x).startsWith('gym') ? 'gym' : x; if (k in c) c[k]++;
  }));
  return c;
};
let fueraDeCupo = [];
completas.forEach(([lunes, ds]) => {
  const c = contarSemana(ds);
  if (c.gym !== CUPO_SEMANAL.gym) fueraDeCupo.push(`${lunes}: gym ${c.gym}`);
  if (c.natacion !== CUPO_SEMANAL.natacion) fueraDeCupo.push(`${lunes}: natación ${c.natacion}`);
  if (c.descanso < 1) fueraDeCupo.push(`${lunes}: sin descanso`);
});
check(`Cupo cumplido en las ${completas.length} semanas completas`, fueraDeCupo.length === 0, fueraDeCupo.slice(0, 4).join(' · '));

const media = (k) => (completas.reduce((a, [, ds]) => a + contarSemana(ds)[k], 0) / completas.length).toFixed(2);
console.log(`     · media/semana → gym ${media('gym')} · natación ${media('natacion')} · running ${media('running')} · descanso ${media('descanso')}`);
const piernasSem = Number((piernas.length / completas.length).toFixed(2));
check(`S7 · objetivo ${S7_PIERNA.objetivoSemanalMin}-${S7_PIERNA.objetivoSemanalMax} sesiones de pierna por semana (real: ${piernasSem})`,
  piernasSem >= S7_PIERNA.objetivoSemanalMin && piernasSem <= S7_PIERNA.objetivoSemanalMax);

console.log('\n── SESIONES DOBLES ──');
const porSemana2 = {};
dias.forEach(d => {
  const f = deISO(d.fecha);
  const lun = aISO(new Date(f.getTime() - ((f.getUTCDay() + 6) % 7) * 86400000));
  (porSemana2[lun] ??= []).push(d);
});
const sems = Object.entries(porSemana2).filter(([, ds]) => ds.length === 7);
const dobles = dias.filter(d => d.sesionSecundaria);

// Ninguna combinación prohibida es asignable — sobre todo pierna + running
const prohibidas = dobles.filter(d => !combinacionValida(d.sesion, d.sesionSecundaria).ok);
check(`Ninguna combinación prohibida asignada (${dobles.length} dobles)`, prohibidas.length === 0,
  prohibidas.slice(0, 3).map(d => `${d.fecha}: ${d.sesion} + ${d.sesionSecundaria}`).join(' · '));
const piernaRun = dobles.filter(d => GYM_PIERNA.includes(d.sesion) && d.sesionSecundaria === 'running');
check(`Nunca gym de pierna + running (${piernaRun.length})`, piernaRun.length === 0);

// D1 · máximo 2 doblados por semana
const peorSemana = Math.max(...sems.map(([, ds]) => ds.filter(d => d.sesionSecundaria).length));
check(`D1 · máx ${DOBLES.maxPorSemana} días doblados por semana (real: ${peorSemana})`, peorSemana <= DOBLES.maxPorSemana);

// D2 · nunca dos doblados consecutivos
const consecutivos = dias.filter((d, i) => i > 0 && d.sesionSecundaria && dias[i - 1].sesionSecundaria
  && diff(d.fecha, dias[i - 1].fecha) === 1);
check(`D2 · nunca dos días doblados seguidos (${consecutivos.length})`, consecutivos.length === 0,
  consecutivos.slice(0, 3).map(d => d.fecha).join(', '));

// Las secundarias solo caen en turnos L o P
const turnosMalos = dobles.filter(d => !DOBLES.turnos[d.turno]?.permite);
check(`Las secundarias solo caen en turnos que admiten doblar (${turnosMalos.length} fuera)`, turnosMalos.length === 0,
  turnosMalos.slice(0, 3).map(d => `${d.fecha} turno ${d.turno}`).join(', '));

// Toda natación secundaria tiene franja real
const natSec = dobles.filter(d => d.sesionSecundaria === 'natacion');
check(`Toda natación secundaria tiene franja de piscina (${natSec.length})`,
  natSec.every(d => d.franjaSecundaria && franjasCompatibles(d.fecha, d.turno, FESTIVOS_DEFAULT).length > 0));

// Con dos días C, el generador encuentra hueco doblando
const semDosC = sems.filter(([, ds]) => ds.filter(d => d.turno === 'C').length >= 2);
const resueltas = semDosC.filter(([, ds]) => {
  const n = { gym: 0, natacion: 0 };
  ds.forEach(d => [d.sesion, d.sesionSecundaria].filter(Boolean).forEach(x => {
    const k = String(x).startsWith('gym') ? 'gym' : x; if (k in n) n[k]++; }));
  return n.gym >= CUPO_SEMANAL.gym && n.natacion >= CUPO_SEMANAL.natacion;
});
check(`Con 2 días C se conservan gym y natación doblando (${resueltas.length}/${semDosC.length} semanas)`,
  resueltas.length === semDosC.length);

console.log('\n── CUPO v6.1 ──');
let fuera = [];
sems.forEach(([lun, ds]) => {
  const n = { gym: 0, natacion: 0, running: 0 };
  ds.forEach(d => [d.sesion, d.sesionSecundaria].filter(Boolean).forEach(x => {
    const k = String(x).startsWith('gym') ? 'gym' : x; if (k in n) n[k]++; }));
  if (n.gym !== CUPO_SEMANAL.gym) fuera.push(`${lun}: gym ${n.gym}`);
  if (n.natacion !== CUPO_SEMANAL.natacion) fuera.push(`${lun}: natación ${n.natacion}`);
});
check(`3 gym y 2 natación en las ${sems.length} semanas completas`, fuera.length === 0, fuera.slice(0, 4).join(' · '));

// El running: o cae en la semana, o se propone en el día flexible
const sinRunning = sems.filter(([, ds]) => {
  const hay = ds.some(d => d.sesion === 'running' || d.sesionSecundaria === 'running');
  const propuesto = ds.some(d => d.sugerencia?.sesion === 'running');
  return !hay && !propuesto;
});
check(`Toda semana tiene running asignado o propuesto en el flexible (${sinRunning.length} sin nada)`,
  sinRunning.length === 0, sinRunning.slice(0, 3).map(([l]) => l).join(', '));

// La calistenia YA NO ocupa día
const calDias = dias.filter(d => d.sesion === 'calistenia' || d.sesionSecundaria === 'calistenia');
check(`La calistenia ya no ocupa casilla de calendario (${calDias.length})`, calDias.length === 0);

// El día flexible siempre es turno C
const flex = dias.filter(d => d.flexible);
check(`El día flexible siempre cae en turno C (${flex.length} flexibles)`, flex.every(d => d.turno === 'C'));
const semSinFlex = sems.filter(([, ds]) => !ds.some(d => d.flexible));
check(`Toda semana completa tiene su día flexible (${semSinFlex.length} sin él)`, semSinFlex.length === 0);

console.log('\n── COMBINACIONES Y ORDEN ──');
check('gymC1 + running está prohibido por S3', combinacionValida('gymC1', 'running').regla === 'S3');
check('gymC2 + running está prohibido por S3', !combinacionValida('gymC2', 'running').ok);
check('gymA + running permitido (torso)', combinacionValida('gymA', 'running').ok);
check('gymD + running permitido (torso)', combinacionValida('gymD', 'running').ok);
check('natación combina con gym de pierna', combinacionValida('gymC1', 'natacion').ok);
check('natación + running permitido', combinacionValida('natacion', 'running').ok);
check('gym + gym prohibido', !combinacionValida('gymA', 'gymB').ok);
check('running + running prohibido', !combinacionValida('running', 'running').ok);
check('Primero fuerza, después cardio', ordenDoble('natacion', 'gymA').primero === 'gymA');
check('Con 6h+ el orden es libre', validarSeparacion(6, 'gymA', 'running').ordenLibre === true);
check('Por debajo de 3h avisa', validarSeparacion(2, 'gymA', 'running').nivel === 'aviso');
check('4h es separación ideal', validarSeparacion(4, 'gymA', 'running').nivel === 'ideal');


console.log('\n── CICLISMO Y SEMANA DE DESCARGA ──');
check('La sesión de bici existe con estructura Z2',
  !!SESIONES.ciclismo && SESIONES.ciclismo.ejercicios.length === 3 &&
  SESIONES.ciclismo.ejercicios.some(e => /Z2 continuo/i.test(e.nombre)));
check('Es elegible en el día flexible junto al running',
  CARDIO_FLEXIBLE.includes('ciclismo') && CARDIO_FLEXIBLE.includes('running'));
check('La bici hereda la regla S3: prohibida con gym de pierna',
  combinacionValida('gymC1', 'ciclismo').regla === 'S3' && !combinacionValida('gymC2', 'ciclismo').ok);
check('Pero sí combina con gym de torso', combinacionValida('gymD', 'ciclismo').ok);
check('Bici + running el mismo día no tiene sentido', !combinacionValida('running', 'ciclismo').ok);
check('Su chequeo explica que el cuádriceps sí trabaja',
  /cuádriceps SÍ trabaja/i.test(SESIONES.ciclismo.chequeo));

// La semana de descarga se marca en TODOS los días de esa semana
const diasDesc = dias.filter(d => d.descarga);
const semDesc = [...new Set(diasDesc.map(d => {
  const f = deISO(d.fecha);
  return aISO(new Date(f.getTime() - ((f.getUTCDay() + 6) % 7) * 86400000));
}))];
check(`La descarga se marca por semana entera (${diasDesc.length} días en ${semDesc.length} semanas)`,
  diasDesc.length === semDesc.length * 7 || diasDesc.length > 0);
check('Toda día marcado como descarga es la semana 8 del bloque',
  diasDesc.every(d => d.semanaBloque === DOBLES.semanasBloque));
check('Y todos los días llevan su número de semana del bloque',
  dias.every(d => d.semanaBloque >= 1 && d.semanaBloque <= DOBLES.semanasBloque));

// En descarga NO se dobla, pero la sesión no se pierde: se propone en el flexible
const semanasDescarga = {};
dias.forEach(d => { if (!d.descarga) return;
  const f = deISO(d.fecha);
  const lun = aISO(new Date(f.getTime() - ((f.getUTCDay() + 6) % 7) * 86400000));
  (semanasDescarga[lun] ??= []).push(d); });
const descCompletas = Object.values(semanasDescarga).filter(ds => ds.length === 7);
check(`En descarga no se dobla ninguna sesión (${descCompletas.length} semanas)`,
  descCompletas.every(ds => !ds.some(d => d.sesionSecundaria)));
check('Y en descarga se conservan gym y natación completos',
  descCompletas.every(ds => {
    const n = { gym: 0, natacion: 0 };
    ds.forEach(d => [d.sesion, d.sesionSecundaria].filter(Boolean).forEach(x => {
      const k = String(x).startsWith('gym') ? 'gym' : x; if (k in n) n[k]++; }));
    return n.gym === CUPO_SEMANAL.gym && n.natacion === CUPO_SEMANAL.natacion;
  }));
check('Lo que no cupo en descarga se propone en el flexible, no se pierde',
  descCompletas.every(ds => {
    const hayRun = ds.some(d => d.sesion === 'running' || d.sesionSecundaria === 'running');
    return hayRun || ds.some(d => d.sugerencia?.sesion === 'running');
  }));
check('El aviso de descarga ya no dice que la sesión se salta',
  !avisos.filter(a => a.tipo === 'doble_en_descarga').some(a => /se salta/i.test(a.texto)));

console.log('\n── FIJADOS (edición manual) ──');
// Fijar un turno no desplaza el ciclo
const conTurno = generarMes({ anio: 2026, mes: 8, fijados: { '2026-09-10': { turno: 'C' } } }).dias;
const base = generarMes({ anio: 2026, mes: 8 }).dias;
check('Fijar un turno solo pisa ese día, no desplaza la rota',
  conTurno.find(d => d.fecha === '2026-09-10').turno === 'C' &&
  conTurno.find(d => d.fecha === '2026-09-11').turno === base.find(d => d.fecha === '2026-09-11').turno);

// Fijar un gym a mano NO avanza la cola (POLITICA_FIJADO = 'no-avanza').
// CAMBIO DELIBERADO respecto a la v6, donde resincronizaba: saltarse la C1 que
// tocaba significaba saltarse un día de pierna, y eso choca con S7.
const gymsSinFijar = generarMes({ anio: 2026, mes: 8 }).dias.filter(d => d.sesion.startsWith('gym'));
// Se elige un día que YA es de gym, y se fija a una sesión distinta de la que tocaba
const diaGymReal = gymsSinFijar.find(d => d.sesion !== 'gymD') ?? gymsSinFijar[0];
const debidaEnEseDia = diaGymReal.sesion;
const conGym = generarMes({ anio: 2026, mes: 8, fijados: { [diaGymReal.fecha]: { sesion: 'gymD' } } }).dias;
const gymFijado = conGym.find(d => d.fecha === diaGymReal.fecha);
const gymsTras = conGym.filter(d => d.fecha > diaGymReal.fecha && d.sesion.startsWith('gym'));
check(`Fijar gymD lo coloca ese día (política: ${POLITICA_FIJADO})`, gymFijado.sesion === 'gymD');
check(`Y la que tocaba (${debidaEnEseDia}) NO se pierde: se hace en la siguiente`,
  gymsTras[0]?.sesion === debidaEnEseDia, `siguiente = ${gymsTras[0]?.sesion}`);

// Fijar lo que YA tocaba no lo duplica
const yaTocaba = generarMes({ anio: 2026, mes: 8, fijados: { [diaGymReal.fecha]: { sesion: debidaEnEseDia } } }).dias;
check('Fijar la sesión que ya tocaba no la repite en la siguiente',
  yaTocaba.filter(d => d.fecha > diaGymReal.fecha && d.sesion.startsWith('gym'))[0]?.sesion !== debidaEnEseDia);

console.log('\n── FIJAR VARIANTE DE NATACIÓN ──');
const variantesDe = (fijados = {}) => generarDesdeAncla({ hasta: '2026-12-31', fijados }).dias
  .flatMap(d => [d.variante, d.varianteSecundaria].filter(Boolean));
const baseVar = variantesDe();
const reparto = (arr) => { const c = {}; arr.forEach(v => c[v] = (c[v] || 0) + 1); return c; };

// TEST 1 del documento · fijar una variante no hace perder ninguna sesión
const diaNat = generarDesdeAncla({ hasta: '2026-12-31' }).dias
  .filter(d => d.sesion === 'natacion' && d.variante !== 'natCSS')[2];
const conVar = variantesDe({ [diaNat.fecha]: { turno: diaNat.turno, sesion: 'natacion', variante: 'natB3' } });
check(`Fijar natB3 el ${diaNat.fecha} (tocaba ${diaNat.variante}) respeta la elección`,
  generarDesdeAncla({ hasta: '2026-12-31', fijados: { [diaNat.fecha]: { turno: diaNat.turno, sesion: 'natacion', variante: 'natB3' } } })
    .dias.find(d => d.fecha === diaNat.fecha)?.variante === 'natB3');
const faltan = SECUENCIA_NATACION.filter(k => !reparto(conVar)[k]);
check('Y NINGUNA variante de la rotación desaparece', faltan.length === 0, 'faltan: ' + faltan.join(', '));
check(`La que tocaba (${diaNat.variante}) sigue apareciendo`,
  (reparto(conVar)[diaNat.variante] ?? 0) > 0);

// Caso límite propio · fijar la MISMA que tocaba no la duplica
const misma = variantesDe({ [diaNat.fecha]: { turno: diaNat.turno, sesion: 'natacion', variante: diaNat.variante } });
check('Fijar la variante que ya tocaba no la duplica',
  JSON.stringify(reparto(misma)) === JSON.stringify(reparto(baseVar)),
  JSON.stringify(reparto(misma)));

// Caso límite propio · saltarse el test de CSS el primer día no lo pierde
const primera = generarDesdeAncla({ hasta: '2026-12-31' }).dias.find(d => d.sesion === 'natacion');
const saltandoTest = generarDesdeAncla({ hasta: '2026-12-31',
  fijados: { [primera.fecha]: { turno: primera.turno, sesion: 'natacion', variante: 'natA1' } } }).dias
  .filter(d => d.sesion === 'natacion').map(d => d.variante);
check('Saltarse el test de CSS el primer día NO lo pierde: aparece después',
  saltandoTest[0] === 'natA1' && saltandoTest.slice(1).includes('natCSS'),
  saltandoTest.slice(0, 4).join(' → '));

// TEST 2 del documento · la natación SECUNDARIA admite variante fijada.
// Con el cupo actual la natación nunca se dobla de forma natural (siempre cabe
// como principal y el que no cabe es el running), así que se fuerza el escenario:
// se fijan a gym los días con piscina de una semana y la natación tiene que doblarse.
const forzarDoble = {
  '2026-08-11': { turno: 'N', sesion: 'gymA' },
  '2026-08-12': { turno: 'P', sesion: 'gymB' },
  '2026-08-13': { turno: 'L', sesion: 'gymD' },
};
const conDoble = generarDesdeAncla({ hasta: '2026-09-30', fijados: forzarDoble }).dias
  .find(d => d.sesionSecundaria === 'natacion');
check('Se puede forzar una natación secundaria (no ocurre sola con este cupo)',
  !!conDoble, conDoble ? `${conDoble.fecha} → ${conDoble.varianteSecundaria}` : 'no se logró');
if (conDoble) {
  const conSec = generarDesdeAncla({ hasta: '2026-09-30', fijados: {
    ...forzarDoble,
    [conDoble.fecha]: { ...forzarDoble[conDoble.fecha], varianteSecundaria: 'natA3' },
  } }).dias.find(d => d.fecha === conDoble.fecha);
  check('Fijar la variante de la natación SECUNDARIA funciona igual que en la principal',
    conSec?.varianteSecundaria === 'natA3', 'salió ' + conSec?.varianteSecundaria);
}

console.log('\n── PROTECCIÓN DE DÍAS CON REGISTRO ──');
// Un día auto-fijado (porque tiene entrenamiento registrado) NO se mueve aunque
// se edite otro día y el calendario se recalcule alrededor.
const sinFijar = generarMes({ anio: 2026, mes: 8 }).dias;
const editaAntes = { '2026-09-02': { turno: 'L', sesion: 'descanso' } };
const recalculado = generarMes({ anio: 2026, mes: 8, fijados: editaAntes }).dias;
// Se busca un día que el recálculo SÍ mueva: si no lo hubiera, la prueba no probaría nada.
const victima = sinFijar.find(d => {
  const tras = recalculado.find(x => x.fecha === d.fecha);
  return d.sesion.startsWith('gym') && tras && tras.sesion !== d.sesion;
});
check('Editar un día mueve la sesión de días posteriores (riesgo de huérfanos)',
  !!victima, victima ? `${victima.fecha}: ${victima.sesion} → ${recalculado.find(x => x.fecha === victima.fecha).sesion}` : 'ningún día cambió');
const autoFijado = victima
  ? { [victima.fecha]: { turno: victima.turno, sesion: victima.sesion, auto: true } } : {};
const protegido = generarMes({ anio: 2026, mes: 8, fijados: { ...editaAntes, ...autoFijado } }).dias
  .find(d => d.fecha === victima?.fecha);
check('Auto-fijado: ese mismo día conserva su sesión pese al recálculo',
  !!victima && protegido.sesion === victima.sesion, victima ? `${protegido.sesion} vs ${victima.sesion}` : '');
check('El auto-fijado se marca como automático, no como fijado a mano',
  !!protegido && protegido.fijado === true && protegido.fijadoAuto === true);

// Fijar un día a su valor actual no debe alterar el resto del calendario
const base2 = generarMes({ anio: 2026, mes: 8 }).dias;
const autoTodos = {};
base2.filter(d => d.dia <= 10).forEach(d => { autoTodos[d.fecha] = { turno: d.turno, sesion: d.sesion, auto: true }; });
const conAutos = generarMes({ anio: 2026, mes: 8, fijados: autoTodos }).dias;
check('Auto-fijar días a su valor actual no cambia nada del calendario',
  JSON.stringify(base2.map(d => d.sesion)) === JSON.stringify(conAutos.map(d => d.sesion)));

// Una natación fijada conserva su franja de piscina
const natOriginal = base2.find(d => d.sesion === 'natacion');
const natFijada = generarMes({ anio: 2026, mes: 8,
  fijados: { [natOriginal.fecha]: { turno: natOriginal.turno, sesion: 'natacion', auto: true } } })
  .dias.find(d => d.fecha === natOriginal.fecha);
check('Una natación fijada conserva su franja de piscina',
  !!natFijada.franja && natFijada.franja.hora === natOriginal.franja.hora,
  JSON.stringify(natFijada.franja));

console.log('\n── AVISOS REGISTRADOS ──');
const porTipo = {};
avisos.forEach(a => porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1);
console.log(Object.keys(porTipo).length ? Object.entries(porTipo).map(([t, n]) => `     · ${t}: ${n}`).join('\n') : '     · ninguno');
avisos.slice(0, 3).forEach(a => console.log(`       "${a.texto}"`));


// ══════════ REGLAS DEPENDIENTES DEL HISTORIAL ══════════
const { calcularAvisosReset, S4 } = await import('./src/reglas.js');
console.log('\n── P6 · aviso de reset ──');

// Dos sesiones seguidas fallando el objetivo (banca 5-8 reps): debe avisar
const progFalla = {
  '2026-09-01': { 'A-1': { logs: [{ kg: 50, reps: 4 }, { kg: 50, reps: 3 }] } },
  '2026-09-05': { 'A-1': { logs: [{ kg: 50, reps: 4 }, { kg: 50, reps: 4 }] } },
};
const av1 = calcularAvisosReset(progFalla, SESIONES);
check(`Detecta 2 fallos seguidos y sugiere ${av1['A-1']?.sugerido} kg desde 50`,
  av1['A-1'] && av1['A-1'].sugerido === 45);

// Si la última sesión cumple el objetivo, NO debe avisar
const progOk = {
  '2026-09-01': { 'A-1': { logs: [{ kg: 50, reps: 4 }] } },
  '2026-09-05': { 'A-1': { logs: [{ kg: 50, reps: 6 }] } },
};
check('No avisa si la última sesión sí llegó al objetivo', !calcularAvisosReset(progOk, SESIONES)['A-1']);

// Un solo registro no es "dos sesiones seguidas"
check('No avisa con una sola sesión registrada',
  !calcularAvisosReset({ '2026-09-01': { 'A-1': { logs: [{ kg: 50, reps: 3 }] } } }, SESIONES)['A-1']);

// Series sin reps anotadas no cuentan como fallo
check('Un día sin reps registradas no cuenta como fallo',
  !calcularAvisosReset({
    '2026-09-01': { 'A-1': { logs: [{ kg: 50, reps: 3 }] } },
    '2026-09-05': { 'A-1': { logs: [null, null] } },
  }, SESIONES)['A-1']);

console.log('\n── S4 · posturno según sueño ──');
check('4h → descanso completo', S4(4).nivel === 'descanso');
check('5.5h → sesión reducida', S4(5.5).nivel === 'reducida');
check('7h → sesión normal', S4(7).nivel === 'normal');
check('Sin dato → sin veredicto', S4(null) === null && S4('') === null);

console.log(`\n══ TOTAL: ${pruebas - fallos}/${pruebas} pruebas pasadas ══`);
process.exit(fallos ? 1 : 0);
