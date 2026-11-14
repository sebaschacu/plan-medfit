// ══ Banco de pruebas de la configuración del plan (Ajustes) ══
//
// Lo primero que se comprueba es lo más importante: con la config vacía, el
// calendario es EXACTAMENTE el de siempre. Después, que cada ajuste hace lo
// que dice y que las reglas de seguridad (S1, S3, S7, turnos) se siguen
// cumpliendo con cualquier config.
import { generarDesdeAncla, generarMes, combinacionValida, solapanGym, deISO } from './src/generador.js';
import { normalizarConfig, resolverConfig, conCampo, registrarDeportes, solapesDeRotacion, claveDeporte,
  cupoDelPlan, turnosDelPlan, CONFIG_PLAN } from './src/config.js';
import { PRIORIDAD_TURNO, VENTANA_PISCINA, DOBLES, SECUENCIA_GYM, SECUENCIA_NATACION, SESION_INFO, SESIONES } from './src/data.js';
import { previsualizar } from './src/utiles/previa.js';
import { nombrarClaves } from './src/utiles/nombres.js';

let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};
const seccion = (t) => console.log(`\n── ${t} ──`);
const HASTA = '2027-07-31';
const gen = (config) => {
  registrarDeportes(normalizarConfig(config).deportes);
  return generarDesdeAncla({ hasta: HASTA, config });
};
const diff = (a, b) => Math.round((deISO(a) - deISO(b)) / 864e5);
// Semanas completas lunes→domingo
const semanas = (dias) => {
  const w = {};
  for (const d of dias) { const k = Math.floor(diff(d.fecha, '2026-07-27') / 7); (w[k] ??= []).push(d); }
  return Object.values(w).filter(s => s.length === 7);
};
const claves = (d) => [d.sesion, d.sesionSecundaria].filter(Boolean);
const media = (dias, pred) => { const s = semanas(dias); return s.reduce((a, w) => a + w.flatMap(claves).filter(pred).length, 0) / s.length; };
const esGym = (k) => k.startsWith('gym');

// ═══ 1 · CONFIG VACÍA = EL PLAN DE SIEMPRE ═══
seccion('CONFIG VACÍA = EL PLAN DE SIEMPRE');
const base = generarDesdeAncla({ hasta: HASTA });
check('Sin config y con config vacía sale el mismo calendario, día por día',
  JSON.stringify(base) === JSON.stringify(generarDesdeAncla({ hasta: HASTA, config: {} })));
const r0 = resolverConfig({});
check('La config resuelta usa los objetos del plan tal cual (prioridad, piscina, dobles)',
  ['L', 'C', 'N', 'P'].every(t => r0.prioridad[t] === PRIORIDAD_TURNO[t] && r0.ventana[t] === VENTANA_PISCINA[t] && r0.dobles[t] === DOBLES.turnos[t]));
check('Y la rotación del plan', r0.secGym === SECUENCIA_GYM && r0.secNat === SECUENCIA_NATACION && !r0.personalizada);
check('Poner en Ajustes exactamente lo del plan no guarda nada',
  JSON.stringify(conCampo({}, 'cupo', cupoDelPlan())) === '{}' && JSON.stringify(conCampo({}, 'turnos', turnosDelPlan())) === '{}'
  && JSON.stringify(conCampo({}, 'rotacion', { gym: [...SECUENCIA_GYM], natacion: [...SECUENCIA_NATACION] })) === '{}');
check('Una config que repite los valores del plan genera lo mismo que la vacía',
  JSON.stringify(base) === JSON.stringify(generarDesdeAncla({ hasta: HASTA, config: { cupo: { gym: 3, natacion: 2, cardio: 1, flexible: 1 }, ciclo: { turnos: ['L', 'C', 'N', 'P'] } } })));

// ═══ 2 · NORMALIZAR: UNA CONFIG ROTA NUNCA ROMPE NADA ═══
seccion('NORMALIZAR LO GUARDADO');
check('Basura → config vacía', ['x', 5, null, [], { cupo: 'mucho' }].every(c => JSON.stringify(normalizarConfig(c)) === '{}'));
check('Fuera de rango se descarta, dentro se conserva',
  JSON.stringify(normalizarConfig({ cupo: { gym: 99, natacion: 3, cardio: -1, flexible: 0 } })) === '{"cupo":{"natacion":3,"flexible":0}}');
check('Un ciclo con letras raras se queda con las válidas',
  JSON.stringify(normalizarConfig({ ciclo: { turnos: ['L', 'X', 'N', 7] } }).ciclo.turnos) === '["L","N"]');
check('Rotación: solo claves que existen y sin repetir',
  JSON.stringify(normalizarConfig({ rotacion: { gym: ['gymB', 'gymB', 'inventado', 'gymA'] } }).rotacion.gym) === '["gymB","gymA"]');
const depRaro = normalizarConfig({ deportes: [{ id: 'ok1', nombre: '  Escalada ', porSemana: 9, color: 'rojo', turnos: ['L', 'Z'] }, { id: 'MAL ID', nombre: 'x' }, { id: 'ok1', nombre: 'Duplicado' }] }).deportes;
check('Deportes: id válido, sin duplicados, valores fuera de rango a su defecto',
  depRaro.length === 1 && depRaro[0].nombre === 'Escalada' && depRaro[0].porSemana === 1 && depRaro[0].color === '#f472b6' && JSON.stringify(depRaro[0].turnos) === '["L"]',
  JSON.stringify(depRaro));
check('Una config rota no impide generar', gen({ cupo: { gym: 'x' }, ciclo: 5, turnos: { L: 'no' }, deportes: 'ninguno' }).dias.length === base.dias.length);

// ═══ 3 · TU SEMANA ═══
seccion('TU SEMANA · CUPO');
const g2 = gen({ cupo: { gym: 2 } }).dias;
check('Gym 2 → exactamente 2 gym por semana', semanas(g2).every(w => w.flatMap(claves).filter(esGym).length === 2));
const g4 = gen({ cupo: { gym: 4 } }).dias;
check('Gym 4 → más gym que el plan (lo que dejan los turnos)', media(g4, esGym) > 3.3, media(g4, esGym).toFixed(2));
const n3 = gen({ cupo: { natacion: 3 } }).dias;
check('Natación 3 → más natación que el plan', media(n3, k => k === 'natacion') > 2.5, media(n3, k => k === 'natacion').toFixed(2));
const c0 = gen({ cupo: { cardio: 0 } }).dias;
check('Running o bici 0 → ni running ni bici', c0.flatMap(claves).every(k => k !== 'running' && k !== 'ciclismo'));
const f0 = gen({ cupo: { flexible: 0 } }).dias;
check('Sin día flexible → ningún día flexible', f0.every(d => !d.flexible) && base.dias.some(d => d.flexible));

// ═══ 4 · TURNOS ═══
seccion('TURNOS · CICLO Y PERMISOS');
const llcnp = gen({ ciclo: { turnos: ['L', 'L', 'C', 'N', 'P'] } }).dias;
check('Un ciclo de 5 (L L C N P) se repite tal cual desde el ancla', llcnp.slice(0, 15).map(d => d.turno).join('') === 'LLCNPLLCNPLLCNP', llcnp.slice(0, 15).map(d => d.turno).join(''));
const hoyN = gen({ ciclo: { turnos: ['L', 'C', 'N', 'P'], hoy: { fecha: '2026-11-14', pos: 2 } } }).dias;
check('«Hoy es Noche» pone N el día de hoy y sigue el ciclo', hoyN.find(d => d.fecha === '2026-11-14').turno === 'N' && hoyN.find(d => d.fecha === '2026-11-15').turno === 'P');
const fijT = { '2026-11-15': { turno: 'L', sesion: 'gymA' } };
check('Un turno fijado a mano no se mueve al cambiar el ciclo',
  generarDesdeAncla({ hasta: '2026-11-30', fijados: fijT, config: { ciclo: { turnos: ['N', 'P'] } } }).dias.find(d => d.fecha === '2026-11-15').turno === 'L');
const cGym = gen({ turnos: { C: { gym: true } } }).dias;
check('Abrir el turno C al gym → hay gym en días C', cGym.some(d => d.turno === 'C' && esGym(d.sesion)) && !base.dias.some(d => d.turno === 'C' && esGym(d.sesion)));
check('Y el día flexible sigue existiendo en C', cGym.some(d => d.flexible && d.turno === 'C'));
const nSinNat = gen({ turnos: { N: { natacion: false } } }).dias;
check('Quitar la natación en N → ninguna natación en días N', !nSinNat.some(d => d.turno === 'N' && claves(d).includes('natacion')) && base.dias.some(d => d.turno === 'N' && d.sesion === 'natacion'));
const lSinDoble = gen({ turnos: { L: { doblar: false } } }).dias;
check('Sin dobles en L → ningún día L doblado', !lSinDoble.some(d => d.turno === 'L' && d.sesionSecundaria) && base.dias.some(d => d.turno === 'L' && d.sesionSecundaria));
const nDoble = gen({ turnos: { N: { doblar: true } } }).dias;
check('Permitir doblar en N → la app ya puede doblar en N', nDoble.some(d => d.turno === 'N' && d.sesionSecundaria));
const pNada = gen({ turnos: { P: { gym: false, cardio: false, natacion: false } } }).dias;
check('Un turno sin nada → sus días son descanso', pNada.filter(d => d.turno === 'P' && !d.fijado).every(d => d.sesion === 'descanso'));

// ═══ 5 · ORDEN DE ROTACIÓN ═══
seccion('ORDEN DE ROTACIÓN');
const rot = gen({ rotacion: { gym: ['gymB', 'gymC1', 'gymA', 'gymC2'] } }).dias;
const gymsRot = rot.flatMap(claves).filter(esGym);
check('Solo salen los gym de la rotación', gymsRot.every(k => ['gymB', 'gymC1', 'gymA', 'gymC2'].includes(k)) && !gymsRot.includes('gymD'));
check('En el orden elegido', gymsRot.slice(0, 8).join(',') === 'gymB,gymC1,gymA,gymC2,gymB,gymC1,gymA,gymC2', gymsRot.slice(0, 8).join(','));
check('Avisa de dos seguidas que trabajan lo mismo, también al dar la vuelta',
  JSON.stringify(solapesDeRotacion(['gymB', 'gymC1', 'gymA', 'gymC2', 'gymD'], solapanGym)) === '[["gymD","gymB"]]');
check('El orden del plan no tiene ninguna', solapesDeRotacion(SECUENCIA_GYM, solapanGym).length === 0);
const nat2 = gen({ rotacion: { natacion: ['natB2', 'natA1'] } }).dias;
const vars = nat2.flatMap(d => [d.variante, d.varianteSecundaria]).filter(Boolean);
check('Natación: solo las elegidas, más el test CSS', vars.every(v => ['natB2', 'natA1', 'natCSS'].includes(v)) && vars[0] === 'natCSS');
check('Y el test se repite aunque Umbral no esté en la rotación', vars.filter(v => v === 'natCSS').length >= 3, vars.filter(v => v === 'natCSS').length + ' tests');

// ═══ 6 · DEPORTES PROPIOS ═══
seccion('DEPORTES PROPIOS');
const esc = { id: 'esc', nombre: 'Escalada', modo: 'auto', porSemana: 1, turnos: ['L', 'P', 'N', 'C'], piernas: false };
registrarDeportes([esc]);
check('Registrar un deporte lo da de alta como sesión', SESION_INFO.dep_esc?.label === 'Escalada' && SESIONES.dep_esc?.ejercicios.length === 1 && SESION_INFO.dep_esc.grupo === 'deporte');
registrarDeportes([]);
check('Y quitarlo de la lista lo da de baja', !SESION_INFO.dep_esc && !SESIONES.dep_esc);
const dEsc = gen({ deportes: [esc] }).dias;
const cuentaEsc = media(dEsc, k => k === 'dep_esc');
check('Automático 1 vez por semana → sale casi todas las semanas', cuentaEsc >= 0.9, cuentaEsc.toFixed(2));
check('Sin quitarle nada al plan: mismo gym, natación y cardio',
  media(dEsc, esGym) === media(base.dias, esGym) && media(dEsc, k => k === 'natacion') === media(base.dias, k => k === 'natacion'));
check('Solo en los turnos elegidos', gen({ deportes: [{ ...esc, turnos: ['L'] }] }).dias.filter(d => claves(d).includes('dep_esc')).every(d => d.turno === 'L'));
const fut = { id: 'fut', nombre: 'Fútbol', modo: 'auto', porSemana: 2, turnos: ['L', 'P', 'N', 'C'], piernas: true };
const dFut = gen({ deportes: [fut] }).dias;
const trasPierna = (d, dias) => { const ayer = dias.find(x => diff(d.fecha, x.fecha) === 1); return ayer && ['gymC1', 'gymC2'].includes(ayer.sesion); };
check('Un deporte de piernas nunca el día después de pierna', dFut.filter(d => d.sesion === 'dep_fut').every(d => !trasPierna(d, dFut)));
check('Ni junto a pierna, running o bici el mismo día',
  dFut.filter(d => claves(d).includes('dep_fut') && d.sesionSecundaria).every(d => !claves(d).some(k => ['gymC1', 'gymC2', 'running', 'ciclismo'].includes(k))));
check('Lo que no cabe se avisa', gen({ deportes: [{ ...fut, porSemana: 5, turnos: ['L'] }] }).avisos.some(a => a.tipo === 'deporte_sin_hueco'));
check('A mano → nunca lo pone la app', !gen({ deportes: [{ ...esc, modo: 'manual' }] }).dias.some(d => claves(d).some(k => k.startsWith('dep_'))));
check('Archivado → tampoco', !gen({ deportes: [{ ...esc, archivado: true }] }).dias.some(d => claves(d).some(k => k.startsWith('dep_'))));
registrarDeportes([esc, fut]);
check('Combinar: un deporte normal va con cualquier sesión', combinacionValida('gymC1', 'dep_esc').ok && combinacionValida('dep_esc', 'running').ok);
check('Uno de piernas no va con pierna ni con running (S3)', !combinacionValida('gymC1', 'dep_fut').ok && combinacionValida('gymC1', 'dep_fut').regla === 'S3' && !combinacionValida('dep_fut', 'running').ok);
check('Pero sí con torso o natación', combinacionValida('gymA', 'dep_fut').ok && combinacionValida('natacion', 'dep_fut').ok);
check('Y nada sobre un descanso', !combinacionValida('descanso', 'dep_esc').ok);
const fijDep = { '2026-11-20': { turno: 'L', sesion: 'dep_esc' } };
check('Un día fijado a un deporte se respeta', generarDesdeAncla({ hasta: '2026-11-30', fijados: fijDep, config: { deportes: [esc] } }).dias.find(d => d.fecha === '2026-11-20').sesion === 'dep_esc');
check('La clave de un deporte sale de su id, no del nombre', claveDeporte('esc') === 'dep_esc');
registrarDeportes([]);

// ═══ 7 · LAS REGLAS DE SEGURIDAD AGUANTAN CUALQUIER CONFIG ═══
seccion('REGLAS CON CUALQUIER CONFIG');
const variantes = {
  'gym 5': { cupo: { gym: 5 } },
  'ciclo LLCNP': { ciclo: { turnos: ['L', 'L', 'C', 'N', 'P'] } },
  'C abierto': { turnos: { C: { gym: true, cardio: true, natacion: true, doblar: true } } },
  'rotación corta': { rotacion: { gym: ['gymC1', 'gymA', 'gymC2'] } },
  'deportes': { deportes: [esc, fut] },
  'todo junto': { cupo: { gym: 4, natacion: 3, cardio: 2 }, ciclo: { turnos: ['L', 'N', 'P', 'C', 'L'] }, rotacion: { gym: ['gymA', 'gymC1', 'gymB', 'gymC2'] }, deportes: [fut] },
};
for (const [nombre, cfg] of Object.entries(variantes)) {
  const { dias } = gen(cfg);
  const C = resolverConfig(cfg);
  let maxSeguidos = 0, run = 0;
  for (const d of dias) { run = esGym(d.sesion) ? run + 1 : 0; maxSeguidos = Math.max(maxSeguidos, run); }
  const s3 = dias.filter(d => claves(d).includes('running') && trasPierna(d, dias)).length;
  const piernas = dias.filter(d => claves(d).some(k => k === 'gymC1' || k === 'gymC2'));
  const s7 = piernas.slice(1).filter((d, i) => diff(d.fecha, piernas[i].fecha) < 2).length;
  const turnoMal = dias.filter(d => !d.fijado && esGym(d.sesion) && !C.prioridad[d.turno].includes('gym')).length;
  check(`${nombre}: S1, S3, S7 y turnos se cumplen; ningún día vacío`,
    maxSeguidos <= 4 && s3 === 0 && s7 === 0 && turnoMal === 0 && dias.every(d => d.sesion),
    `S1 ${maxSeguidos} · S3 ${s3} · S7 ${s7} · turno ${turnoMal}`);
}
registrarDeportes([]);

// ═══ 8 · GUARDAR UN APARTADO ═══
seccion('GUARDAR UN APARTADO');
const t1 = conCampo({}, 'turnos', { ...turnosDelPlan(), C: { ...turnosDelPlan().C, gym: true } });
check('De los turnos solo se guarda lo que cambia', JSON.stringify(t1) === '{"turnos":{"C":{"gym":true}}}', JSON.stringify(t1));
check('Volver un apartado a lo del plan lo borra y deja el resto',
  JSON.stringify(conCampo({ cupo: { gym: 4 }, rotacion: { gym: ['gymA'] } }, 'cupo', cupoDelPlan())) === '{"rotacion":{"gym":["gymA"]}}');
check('Sin deportes, el campo desaparece', JSON.stringify(conCampo({ deportes: [esc] }, 'deportes', [])) === '{}');
check('CONFIG_PLAN es la config vacía resuelta', JSON.stringify(CONFIG_PLAN) === JSON.stringify(resolverConfig({})));

// ═══ 9 · ASÍ QUEDARÍA ═══
seccion('VISTA PREVIA');
const prev = { ancla: { fecha: '2026-08-01', turno: 'L', gymIdx: 0 }, fijados: {}, festivos: ['2026-08-07', '2026-08-17'], desde: '2026-11-14' };
const p0 = previsualizar({ ...prev, config: {} });
check('Con el plan: 3 gym, 2 natación, 1 cardio por semana', p0.gym === 3 && p0.natacion === 2 && p0.cardio === 1, JSON.stringify(p0));
const pEsc = previsualizar({ ...prev, config: { deportes: [esc] } });
check('Un deporte sin guardar todavía ya sale con su nombre', pEsc.deportes.some(([n, v]) => n === 'Escalada' && v > 0), JSON.stringify(pEsc.deportes));
const p5 = previsualizar({ ...prev, config: { cupo: { gym: 5 } } });
check('Lo que no cabe sale explicado y con nombres, no con claves', p5.nProblemas > 0 && p5.problemas.every(t => !/\bgym[ABCD]\b|\bnatacion\b/.test(t)), p5.problemas.join(' | '));
check('nombrarClaves cambia claves por nombres', nombrarClaves('no hay donde doblar gymB ni natacion') === 'no hay donde doblar Tracción ni Natación');
check('generarMes acepta la config', generarMes({ anio: 2026, mes: 10, config: { cupo: { gym: 2 } } }).dias.filter(d => esGym(d.sesion)).length < generarMes({ anio: 2026, mes: 10 }).dias.filter(d => esGym(d.sesion)).length);

console.log(`\n══ TOTAL CONFIGURACIÓN: ${pruebas - fallos}/${pruebas} ══`);
if (fallos) process.exit(1);
