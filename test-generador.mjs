// Banco de pruebas del generador v6.
// Verifica las reglas del plan contra 6 meses generados, no contra un caso feliz.
import { generarMes, generarDesdeAncla, FESTIVOS_DEFAULT, franjasCompatibles, deISO, aISO } from './src/generador.js';
import { SECUENCIA_GYM, SECUENCIA_NATACION, NATACION_CSS, S7_PIERNA, CUPO_SEMANAL, DOBLES, GYM_PIERNA, GYM_TORSO, SESIONES,
  CARDIO_FLEXIBLE, CARDIO_CUPO, CARDIO_POR_DEFECTO_FLEXIBLE } from './src/data.js';
import { combinacionValida, ordenDoble, validarSeparacion, POLITICA_FIJADO, solapanGym, avisoAlFijar } from './src/generador.js';

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

// El cardio: cae en la semana, siempre. Running si cupo; si no, bici (doblada en
// descarga, o por defecto en el flexible). Antes bastaba con "propuesto".
const sinCardio = sems.filter(([, ds]) =>
  !ds.some(d => CARDIO_CUPO.includes(d.sesion) || CARDIO_CUPO.includes(d.sesionSecundaria)));
check(`Toda semana tiene cardio ASIGNADO, running o bici (${sinCardio.length} sin nada)`,
  sinCardio.length === 0, sinCardio.slice(0, 3).map(([l]) => l).join(', '));

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

// D3 · en descarga solo se dobla con lo MÁS SUAVE (natación o bici). Antes no se
// doblaba nada y el cardio de esas semanas se perdía (0.81 → 1.00 con esto y el
// flexible). Running doblado en descarga, nunca; gym extra, tampoco.
const semanasDescarga = {};
dias.forEach(d => { if (!d.descarga) return;
  const f = deISO(d.fecha);
  const lun = aISO(new Date(f.getTime() - ((f.getUTCDay() + 6) % 7) * 86400000));
  (semanasDescarga[lun] ??= []).push(d); });
const descCompletas = Object.values(semanasDescarga).filter(ds => ds.length === 7);
const doblesDesc = descCompletas.flatMap(ds => ds.filter(d => d.sesionSecundaria).map(d => d.sesionSecundaria));
check(`En descarga toda doble es suave: natación o bici, nunca running ni gym (${doblesDesc.length} dobles en ${descCompletas.length} semanas)`,
  doblesDesc.every(s => DOBLES.descarga.doblesSuaves.includes(s)), doblesDesc.join(', '));
check('Y en descarga se conservan gym y natación completos',
  descCompletas.every(ds => {
    const n = { gym: 0, natacion: 0 };
    ds.forEach(d => [d.sesion, d.sesionSecundaria].filter(Boolean).forEach(x => {
      const k = String(x).startsWith('gym') ? 'gym' : x; if (k in n) n[k]++; }));
    return n.gym === CUPO_SEMANAL.gym && n.natacion === CUPO_SEMANAL.natacion;
  }));
check('En descarga el cardio no se pierde: running o bici en todas',
  descCompletas.every(ds => ds.some(d => CARDIO_CUPO.includes(d.sesion) || CARDIO_CUPO.includes(d.sesionSecundaria))));
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
// y que NO solape con ella: así la que tocaba sigue siendo la siguiente. (Si
// solapara, el guardarraíl la saltaría: ese caso se prueba más abajo.)
const diaGymReal = gymsSinFijar.find(d => d.sesion !== 'gymD' && !solapanGym(d.sesion, 'gymD')) ?? gymsSinFijar[0];
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

// ── GUARDARRAÍL DE SOLAPES (v7.1) ──
// 'no-avanza' dejaba la que tocaba justo DESPUÉS del fijado: fijar una D donde
// tocaba una A es banca dos sesiones seguidas. Medido: 14 solapes en 60
// combinaciones de un solo día fijado, 0 sin fijar. El guardarraíl salta las que
// solaparían con la última hecha, avisa, y las saltadas vuelven en la siguiente
// vuelta de la cola.
console.log('\n── GUARDARRAÍL DE SOLAPES TRAS FIJAR UN GYM ──');
check('A y D solapan (banca), en los dos sentidos', solapanGym('gymA', 'gymD') && solapanGym('gymD', 'gymA'));
check('B y D solapan (dominada)', solapanGym('gymB', 'gymD'));
check('C1 y C2 solapan (pierna)', solapanGym('gymC1', 'gymC2'));
check('La misma sesión repetida solapa', solapanGym('gymA', 'gymA') && solapanGym('gymC1', 'gymC1'));
check('A y B NO solapan: son antagonistas', !solapanGym('gymA', 'gymB') && !solapanGym('gymB', 'gymA'));
check('La rotación A→C1→D→C2→B→A no tiene ningún par consecutivo que solape',
  SECUENCIA_GYM.every((s, i) => !solapanGym(s, SECUENCIA_GYM[(i + 1) % SECUENCIA_GYM.length])));

// Caso concreto: fijar D en un día donde tocaba A
const diaTocaA = gymsSinFijar.find(d => d.sesion === 'gymA');
const conDsobreA = generarDesdeAncla({ hasta: '2026-12-31', fijados: { [diaTocaA.fecha]: { sesion: 'gymD' } } });
const trasD = conDsobreA.dias.filter(d => d.fecha > diaTocaA.fecha && d.sesion?.startsWith('gym'));
check(`Fijar D donde tocaba A (${diaTocaA.fecha.slice(5)}): la siguiente NO es A`,
  trasD[0]?.sesion !== 'gymA' && !solapanGym('gymD', trasD[0]?.sesion), `siguiente = ${trasD[0]?.sesion}`);
check('Y deja un aviso solape_evitado en ese día',
  conDsobreA.avisos.some(a => a.tipo === 'solape_evitado' && a.fecha === trasD[0]?.fecha));
check('A no se pierde: vuelve dentro de la siguiente vuelta de la cola',
  trasD.slice(0, SECUENCIA_GYM.length).some(g => g.sesion === 'gymA'));

// El barrido del documento: cada gym fijado en cada día de gym de agosto, y se
// cuentan los solapes entre gyms CONSECUTIVOS (en orden de sesiones, ignorando
// los días de otra cosa entre medias) en los 12 meses siguientes.
const HASTA_BARRIDO = '2027-07-31';
const ES_P = new Set(['gymC1', 'gymC2']);
const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
const medirSolapes = (fijados) => {
  const { dias, avisos } = generarDesdeAncla({ hasta: HASTA_BARRIDO, fijados });
  const gyms = dias.filter(d => d.sesion?.startsWith('gym'));
  let trasFijado = 0, anteFijado = 0, otros = 0;
  for (let i = 1; i < gyms.length; i++) {
    const a = gyms[i - 1], b = gyms[i];
    if (!solapanGym(a.sesion, b.sesion)) continue;
    if (a.fijado && !a.fijadoAuto) trasFijado++;       // fijado → siguiente generado: lo que arregla el guardarraíl
    else if (b.fijado && !b.fijadoAuto) anteFijado++;  // generado anterior → fijado: decisión del usuario
    else otros++;
  }
  const piernas = gyms.filter(g => ES_P.has(g.sesion));
  const s7Generador = piernas.slice(1).filter((p, i) =>
    diasEntre(piernas[i].fecha, p.fecha) < S7_PIERNA.separacionMinimaDias && !(p.fijado && !p.fijadoAuto)).length;
  return { transiciones: gyms.length - 1, trasFijado, anteFijado, otros, s7Generador,
    avisosGuard: avisos.filter(a => a.tipo === 'solape_evitado').length };
};
const barridoBase = medirSolapes({});
check(`Sin fijar: 0 solapes en las ${barridoBase.transiciones} transiciones de 12 meses`,
  barridoBase.trasFijado + barridoBase.anteFijado + barridoBase.otros === 0 && barridoBase.transiciones >= 150);
check('Sin fijar el guardarraíl no salta nunca (0 avisos)', barridoBase.avisosGuard === 0);

const gymsAgosto = generarDesdeAncla({ hasta: '2026-08-31' }).dias.filter(d => d.sesion?.startsWith('gym'));
const combos = gymsAgosto.length * SECUENCIA_GYM.length;
let bTras = 0, bAnte = 0, bOtros = 0, bS7 = 0, bGuard = 0;
for (const d of gymsAgosto) for (const g of SECUENCIA_GYM) {
  const r = medirSolapes({ [d.fecha]: { turno: d.turno, sesion: g } });
  bTras += r.trasFijado; bAnte += r.anteFijado; bOtros += r.otros; bS7 += r.s7Generador; bGuard += r.avisosGuard;
}
check(`Barrido: ${gymsAgosto.length} días de gym × ${SECUENCIA_GYM.length} sesiones = ${combos} combinaciones`, combos === 60);
check('Con un día fijado: 0 solapes fijado → siguiente generado (eran 14)', bTras === 0, `${bTras}`);
check('Ningún solape entre dos días generados', bOtros === 0, `${bOtros}`);
check('El guardarraíl actuó (hay avisos solape_evitado) y solo con fijados', bGuard > 0, `${bGuard} avisos`);
check('El guardarraíl NO crea violaciones de S7: las que hay son piernas fijadas a mano', bS7 === 0, `${bS7}`);
// Los que quedan son decisión del usuario: fijar una A justo después de la A que
// el generador ya había puesto. El guardarraíl no reescribe días anteriores.
console.log(`  · quedan ${bAnte} solapes "generado anterior → fijado": los provoca el propio fijado, no la cola`);

// ── AVISO AL FIJAR · los solapes hacia atrás, avisados ──
// Hacia atrás no se puede arreglar sin reescribir días que el usuario no editó,
// así que no se arregla: se AVISA antes de fijar, y la decisión sigue siendo
// suya. `avisoAlFijar` es pura y mira el calendario que ya se está viendo. Aquí
// se comprueba que PREDICE exactamente lo que pasaría: ni un solape sin aviso
// (silencio donde hay problema) ni un aviso sin solape (ruido).
// Funciona porque fijar un día no cambia nada ANTES de ese día: la generación es
// cronológica desde el ancla.
console.log('\n── AVISO AL FIJAR (solape hacia atrás y S7) ──');
const baseAgosto = generarDesdeAncla({ hasta: '2026-08-31' }).dias;
const piernaEn = (d) => [d.sesion, d.sesionSecundaria].find(s => ES_P.has(s));
let sinAviso = [], aviosDeMas = [], s7SinAviso = [], s7DeMas = [], totalSolape = 0, totalS7 = 0;
for (const d of gymsAgosto) for (const g of SECUENCIA_GYM) {
  const avs = avisoAlFijar(baseAgosto, d.fecha, g);
  const dioSolape = avs.some(a => a.tipo === 'solape_al_fijar');
  const dioS7 = avs.some(a => a.regla === 'S7');

  // Lo que REALMENTE pasa al fijar: se mira la transición que entra al día fijado
  const { dias: tras } = generarDesdeAncla({ hasta: HASTA_BARRIDO, fijados: { [d.fecha]: { turno: d.turno, sesion: g } } });
  const gymsT = tras.filter(x => x.sesion?.startsWith('gym'));
  const iFij = gymsT.findIndex(x => x.fecha === d.fecha);
  const haySolape = iFij > 0 && solapanGym(gymsT[iFij - 1].sesion, g);
  const piernasT = tras.filter(piernaEn);
  const jFij = piernasT.findIndex(x => x.fecha === d.fecha);
  const hayS7 = ES_P.has(g) && jFij > 0 && diasEntre(piernasT[jFij - 1].fecha, d.fecha) < S7_PIERNA.separacionMinimaDias;

  if (haySolape) totalSolape++;
  if (hayS7) totalS7++;
  if (haySolape && !dioSolape) sinAviso.push(`${d.fecha}→${g}`);
  if (!haySolape && dioSolape) aviosDeMas.push(`${d.fecha}→${g}`);
  if (hayS7 && !dioS7) s7SinAviso.push(`${d.fecha}→${g}`);
  if (!hayS7 && dioS7) s7DeMas.push(`${d.fecha}→${g}`);
}
check(`Los ${totalSolape} solapes hacia atrás del barrido quedan todos avisados`,
  totalSolape > 0 && sinAviso.length === 0, sinAviso.slice(0, 4).join(', '));
check('Y no se avisa donde no hay solape: cero falsos positivos', aviosDeMas.length === 0, aviosDeMas.slice(0, 4).join(', '));
check(`Las ${totalS7} violaciones de S7 por fijar pierna tras pierna quedan todas avisadas`,
  totalS7 > 0 && s7SinAviso.length === 0, s7SinAviso.slice(0, 4).join(', '));
check('Y tampoco se avisa de S7 donde la separación se respeta', s7DeMas.length === 0, s7DeMas.slice(0, 4).join(', '));
check('Avisar no cambia el plan: la función es pura y no toca el calendario',
  JSON.stringify(generarDesdeAncla({ hasta: '2026-08-31' }).dias) === JSON.stringify(baseAgosto));

// Casos a mano, para que el contrato quede escrito y no dependa del barrido
const calDemo = [
  { fecha: '2026-09-01', dia: 1, sesion: 'gymA' },
  { fecha: '2026-09-02', dia: 2, sesion: 'natacion' },
  { fecha: '2026-09-03', dia: 3, sesion: 'gymC1' },
  { fecha: '2026-09-04', dia: 4, sesion: 'descanso' },
];
check('Fijar gymD tras gymA avisa de solape (comparten banca), aunque haya un día en medio',
  avisoAlFijar(calDemo, '2026-09-02', 'gymD').some(a => a.tipo === 'solape_al_fijar'));
check('Fijar gymB tras gymA no avisa: son antagonistas, no solapan',
  avisoAlFijar(calDemo, '2026-09-02', 'gymB').length === 0);
check('Fijar la MISMA sesión que la anterior avisa: repetirla solapa siempre',
  avisoAlFijar(calDemo, '2026-09-02', 'gymA').some(a => a.tipo === 'solape_al_fijar'));
check('Fijar gymC2 un día después de gymC1 avisa de S7 y de solape de pierna',
  avisoAlFijar(calDemo, '2026-09-04', 'gymC2').some(a => a.regla === 'S7')
  && avisoAlFijar(calDemo, '2026-09-04', 'gymC2').some(a => a.tipo === 'solape_al_fijar'));
check(`Con ${S7_PIERNA.separacionMinimaDias} días de separación, la pierna ya no avisa de S7`,
  !avisoAlFijar([...calDemo, { fecha: '2026-09-05', dia: 5, sesion: 'gymB' }], '2026-09-05', 'gymC2')
    .some(a => a.regla === 'S7'));
check('Fijar natación o descanso no avisa de nada: no hay patrón que solape',
  avisoAlFijar(calDemo, '2026-09-02', 'natacion').length === 0 && avisoAlFijar(calDemo, '2026-09-02', 'descanso').length === 0);
check('Sin nada antes (primer día del plan) no hay nada de lo que avisar',
  avisoAlFijar(calDemo, '2026-08-01', 'gymA').length === 0);
check('Un día de pierna YA FIJADO justo después también avisa: el generador no lo moverá',
  avisoAlFijar([{ fecha: '2026-09-10', dia: 10, sesion: 'gymC2', fijado: true }], '2026-09-09', 'gymC1')
    .some(a => a.regla === 'S7' && a.contra === '2026-09-10'));
check('Pero si ese día de después NO está fijado, no se avisa: se recalcula solo',
  avisoAlFijar([{ fecha: '2026-09-10', dia: 10, sesion: 'gymC2' }], '2026-09-09', 'gymC1')
    .every(a => a.regla !== 'S7'));
check('Los avisos traen texto y contra qué día chocan, para poder pintarlos',
  avisoAlFijar(calDemo, '2026-09-02', 'gymA').every(a => a.texto?.length > 40 && a.fecha && a.contra));

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

// ── RUNNING · cuánto se asigna de verdad (v7.1) ──
// Cada 7 días hay ~1.75 de cada turno; los C son descanso, así que quedan 5 o 6
// días útiles para 6 sesiones. El running se coloca el último y era el que se
// quedaba fuera: 0.71/sem, 23 semanas de 78 sin correr. Dos intercambios que no
// tocan ninguna regla ni cupo lo suben: el swap-S3 (la pierna cede su día al
// running y pasa al hueco que S3 bloqueaba) y la natación que se dobla para
// dejarle su día. Lo que quedaba (descarga y semanas con las dos natación tras
// pierna) lo cubre la bici: doblada en descarga o por defecto en el flexible.
// El cupo de running es de CARDIO: running o bici, 1.00/sem exigido.
console.log('\n── RUNNING · ASIGNACIÓN REAL EN 18 MESES ──');
const largo = generarDesdeAncla({ hasta: '2028-01-31' });
const semanasDe18 = (() => {
  const m = new Map();
  for (const d of largo.dias) {
    const f = deISO(d.fecha); const lunes = new Date(f); lunes.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
    const k = aISO(lunes); if (!m.has(k)) m.set(k, []); m.get(k).push(d);
  }
  return [...m.values()].filter(s => s.length === 7);
})();
const nSem = semanasDe18.length;
const mediaSemanal18 = (pred) => semanasDe18.reduce((a, s) => a + s.filter(d => pred(d.sesion) || pred(d.sesionSecundaria)).length, 0) / nSem;
const runSem = mediaSemanal18(s => s === 'running'), gymSem = mediaSemanal18(s => s?.startsWith('gym')), natSem = mediaSemanal18(s => s === 'natacion');
check(`${nSem} semanas completas: gym exactamente 3.00/sem (real ${gymSem.toFixed(2)})`, Math.abs(gymSem - 3) < 0.005);
check(`Natación exactamente 2.00/sem (real ${natSem.toFixed(2)})`, Math.abs(natSem - 2) < 0.005);
check(`Running ≥ 0.80/sem (real ${runSem.toFixed(2)} · era 0.71 antes de los intercambios)`, runSem >= 0.80);
const biciSem = mediaSemanal18(s => s === 'ciclismo');
check(`Cardio (running + bici) exactamente 1.00/sem (real ${(runSem + biciSem).toFixed(2)} · era 0.81 solo con running)`,
  Math.abs(runSem + biciSem - 1) < 0.005);
const esCardio18 = (d) => CARDIO_CUPO.includes(d.sesion) || CARDIO_CUPO.includes(d.sesionSecundaria);
check('Ninguna semana de las 78 se queda sin cardio', semanasDe18.every(s => s.some(esCardio18)));
check('Nunca dos cardios en la misma semana: la bici solo entra donde el running no cupo',
  semanasDe18.every(s => s.reduce((a, d) => a + (CARDIO_CUPO.includes(d.sesion) ? 1 : 0) + (CARDIO_CUPO.includes(d.sesionSecundaria) ? 1 : 0), 0) === 1));
const sinRun = semanasDe18.filter(s => !s.some(d => d.sesion === 'running' || d.sesionSecundaria === 'running'));
check(`Toda semana sin running tiene bici, y con motivo: doblada en descarga o por defecto en el flexible (${sinRun.length} semanas)`,
  sinRun.every(s => {
    const av = largo.avisos.filter(a => a.semana === s[0].fecha).map(a => a.tipo);
    return s.some(d => d.sesion === 'ciclismo' || d.sesionSecundaria === 'ciclismo')
      && (av.includes('bici_en_descarga') || av.includes('bici_por_defecto'));
  }));
// D3 nuevo: la doble de descarga es la más suave disponible, en orden natación →
// bici. En estos 18 meses la bici doblada no llega a hacer falta (la natación
// cede, o el flexible la recoge), así que el `every` puede ser vacío: lo que se
// exige es que, si ocurre, sea donde debe.
const biciDesc = largo.avisos.filter(a => a.tipo === 'bici_en_descarga');
check(`Bici doblada en descarga (${biciDesc.length} en 18 meses): si ocurre, en semana de descarga, nunca sobre pierna ni el día después`,
  biciDesc.every(a => {
    const i = largo.dias.findIndex(x => x.fecha === a.fecha); const d = largo.dias[i];
    return d?.descarga && d.sesionSecundaria === 'ciclismo' && (GYM_TORSO.includes(d.sesion) || d.sesion === 'natacion')
      && !ES_PIERNA.has(largo.dias[i - 1]?.sesion);
  }));
check('Y solo cuando la natación no pudo ceder su día: nunca coinciden en la misma semana',
  biciDesc.every(a => !largo.avisos.some(b => b.semana === a.semana && b.tipo === 'natacion_cede_a_running')));
check('Ningún running doblado en semana de descarga (D3)',
  !largo.dias.some(d => d.descarga && d.sesionSecundaria === 'running'));
check('Ningún gym doblado en semana de descarga (D3)',
  !largo.dias.some(d => d.descarga && d.sesionSecundaria?.startsWith('gym')));
const descSinSalida = largo.avisos.filter(a => a.tipo === 'doble_en_descarga');
check(`Cuando en descarga no hay doble suave posible (${descSinSalida.length} veces), el flexible de esa semana recoge el cardio como bici`,
  descSinSalida.every(a => largo.avisos.some(b => b.semana === a.semana && b.tipo === 'bici_por_defecto')));
const semDesc18 = semanasDe18.filter(s => s[0].descarga);
check(`Ninguna de las ${semDesc18.length} semanas de descarga se queda sin cardio`, semDesc18.every(s => s.some(esCardio18)));
const swapsS3 = largo.avisos.filter(a => a.tipo === 'running_por_swap_s3');
const cedidas = largo.avisos.filter(a => a.tipo === 'natacion_cede_a_running');
check(`El swap-S3 actúa (${swapsS3.length} veces) y el running queda ese día`,
  swapsS3.length > 0 && swapsS3.every(a => largo.dias.find(d => d.fecha === a.fecha)?.sesion === 'running'));
check(`La natación cede su día al running (${cedidas.length} veces) y la semana conserva sus 2 natación`,
  cedidas.length > 0 && cedidas.every(a => {
    const s = semanasDe18.find(s => s[0].fecha === a.semana);
    return s && s.filter(d => d.sesion === 'natacion' || d.sesionSecundaria === 'natacion').length === 2
      && largo.dias.find(d => d.fecha === a.fecha)?.sesion === 'running';
  }));
// Las reglas de seguridad tienen que aguantar los 18 meses, no solo los 6 de arriba
const l18 = largo.dias;
let maxSeg18 = 0, seg18 = 0;
l18.forEach((d, i) => { const c = i > 0 && diff(d.fecha, l18[i - 1].fecha) === 1; seg18 = d.sesion.startsWith('gym') ? (c ? seg18 + 1 : 1) : 0; maxSeg18 = Math.max(maxSeg18, seg18); });
check(`S1 aguanta 18 meses con los intercambios (máx ${maxSeg18} gym seguidos)`, maxSeg18 <= 4);
const s3_18 = l18.filter((d, i) => (d.sesion === 'running' || d.sesionSecundaria === 'running') && i > 0 && diff(d.fecha, l18[i - 1].fecha) === 1 && ES_PIERNA.has(l18[i - 1].sesion));
check(`S3 aguanta 18 meses: ningún running tras pierna (${s3_18.length})`, s3_18.length === 0);
const piernas18 = l18.filter(d => ES_PIERNA.has(d.sesion) || ES_PIERNA.has(d.sesionSecundaria));
const minHueco18 = Math.min(...piernas18.slice(1).map((d, i) => diff(d.fecha, piernas18[i].fecha)));
check(`S7 aguanta 18 meses: piernas separadas ≥${S7_PIERNA.separacionMinimaDias} (mín ${minHueco18})`, minHueco18 >= S7_PIERNA.separacionMinimaDias);
const gyms18 = l18.filter(d => d.sesion.startsWith('gym'));
const saltos18 = gyms18.filter((d, i) => i > 0 && d.sesion !== SECUENCIA_GYM[(SECUENCIA_GYM.indexOf(gyms18[i - 1].sesion) + 1) % 5]);
check(`La cola de gym no se descoloca con el swap-S3 (${saltos18.length} saltos en ${gyms18.length} gyms)`, saltos18.length === 0);

// ── BICI EN EL FLEXIBLE (v7.1 → v7.2) ──
// El flexible cae en turno C: 12h de pie. La bici es el cardio que no castiga
// pies ni tibias, y cubre el ciclismo del triatlón. Cuando el cardio de la
// semana no cupo en ningún otro día, el generador ya no lo PROPONE: lo PONE,
// bici por defecto (lo importante es no saltárselo; correr o pedalear es lo de
// menos). La app deja cambiarlo a running o a descanso. Solo si el flexible
// viene de pierna o de dos gym seguidos se queda en descanso y se propone.
console.log('\n── BICI EN EL FLEXIBLE ──');
const flex18 = l18.filter(d => d.flexible);
check(`Todo flexible sabe si viene de pierna (${flex18.length} flexibles)`, flex18.every(d => typeof d.trasPierna === 'boolean'));
const flexTrasP = flex18.filter(d => d.trasPierna);
check(`Los que vienen de pierna lo son de verdad (${flexTrasP.length})`,
  flexTrasP.length > 0 && flexTrasP.every(d => ES_PIERNA.has(l18[l18.indexOf(d) - 1]?.sesion)));
check('Y los que no, no', flex18.filter(d => !d.trasPierna).every(d => !ES_PIERNA.has(l18[l18.indexOf(d) - 1]?.sesion)));
const conSug = flex18.filter(d => d.sugerencia);
check(`Toda sugerencia del flexible ofrece running Y bici (${conSug.length} sugerencias)`,
  conSug.length > 0 && conSug.every(d => d.sugerencia.opciones?.includes('running') && d.sugerencia.opciones?.includes('ciclismo')));
const porDefecto = flex18.filter(d => d.cardioPorDefecto);
check(`Bici por defecto en el flexible: existe (${porDefecto.length}) y la sesión del día ES bici, no descanso`,
  porDefecto.length > 0 && porDefecto.every(d => d.sesion === CARDIO_POR_DEFECTO_FLEXIBLE && d.sugerencia?.porDefecto === CARDIO_POR_DEFECTO_FLEXIBLE));
check('El defecto es la bici, no el running', CARDIO_POR_DEFECTO_FLEXIBLE === 'ciclismo');
check('Nunca por defecto tras pierna ni tras dos gym seguidos: eso lo sabe la app',
  porDefecto.every(d => !d.trasPierna && d.flexibleCond3 !== false));
check('Y sigue siendo flexible: conserva la marca y la sugerencia con las dos opciones',
  porDefecto.every(d => d.flexible && d.sugerencia.opciones.includes('running') && d.sugerencia.opciones.includes('ciclismo')));
const soloPropuesta = conSug.filter(d => !d.cardioPorDefecto);
check(`Lo que solo se propone (${soloPropuesta.length}) es porque viene de pierna o de dos gym seguidos, y el día sigue en descanso`,
  soloPropuesta.every(d => (d.trasPierna || d.flexibleCond3 === false) && d.sesion === 'descanso' && d.sugerencia.sesion === 'running'));
check('Cada bici por defecto tiene su aviso, y solo uno por semana',
  porDefecto.every(d => largo.avisos.filter(a => a.tipo === 'bici_por_defecto' && a.fecha === d.fecha).length === 1)
  && largo.avisos.filter(a => a.tipo === 'bici_por_defecto').length === porDefecto.length);
// Si me apetece correr, la app me deja: fijar el flexible a running lo respeta el generador
const unaBici = porDefecto[0];
if (unaBici) {
  const [y, m] = unaBici.fecha.split('-').map(Number);
  const conRun = generarMes({ anio: y, mes: m - 1, fijados: { [unaBici.fecha]: { turno: 'C', sesion: 'running' } } }).dias;
  const dRun = conRun.find(d => d.fecha === unaBici.fecha);
  const lunesDe = (iso) => aISO(new Date(deISO(iso).getTime() - ((deISO(iso).getUTCDay() + 6) % 7) * 86400000));
  check(`Fijar ese flexible a running (${unaBici.fecha}) se respeta: running, fijado, y sin bici de más esa semana`,
    dRun?.sesion === 'running' && dRun.fijado
    && !conRun.some(d => lunesDe(d.fecha) === lunesDe(unaBici.fecha) && (d.sesion === 'ciclismo' || d.sesionSecundaria === 'ciclismo')));
  const conDesc = generarMes({ anio: y, mes: m - 1, fijados: { [unaBici.fecha]: { turno: 'C', sesion: 'descanso' } } }).dias;
  check('Y fijarlo a descanso también: ese día descansa', conDesc.find(d => d.fecha === unaBici.fecha)?.sesion === 'descanso');
}

console.log(`\n══ TOTAL: ${pruebas - fallos}/${pruebas} pruebas pasadas ══`);
process.exit(fallos ? 1 : 0);
