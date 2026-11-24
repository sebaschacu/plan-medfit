// ══ Banco de pruebas del aviso de descanso (servidor) ══
//
// api/_descanso.js decide si y cuándo mandar la notificación de «Descanso
// listo». Aquí se prueba con un reloj y un envío falsos: nada sale a la red.
import { procesar, dispositivo, MAX_ESPERA } from './api/_descanso.js';

let fallos = 0, pruebas = 0;
const check = (nombre, ok, detalle = '') => {
  pruebas++;
  if (!ok) { fallos++; console.log(`  ❌ ${nombre}${detalle ? '\n       ' + detalle : ''}`); }
  else console.log(`  ✅ ${nombre}`);
};
const seccion = (t) => console.log(`\n── ${t} ──`);

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
const SUB_IOS = { endpoint: 'https://web.push.apple.com/QWERTY', keys: { p256dh: 'p', auth: 'a' } };
const AHORA = 1_800_000_000_000;

// Un entorno con esperas que se sueltan a mano y un registro de envíos.
const entorno = () => {
  const esperas = [], enviados = [];
  return {
    esperas, enviados, vigentes: new Map(),
    esperar: (ms) => new Promise(r => esperas.push({ ms, r })),
    enviar: async (sub, datos) => { enviados.push({ sub, datos: JSON.parse(datos) }); },
    soltar() { esperas.splice(0).forEach(e => e.r()); },
  };
};
const pedir = (E, cuerpo, ahora = AHORA) => procesar(cuerpo, { ahora, enviar: E.enviar, esperar: E.esperar, vigentes: E.vigentes });
const prog = (extra = {}) => ({ accion: 'programar', sub: SUB, id: 'd1', fin: AHORA + 120_000, nombre: 'Press de banca', ...extra });

seccion('PETICIONES MAL FORMADAS');
let E = entorno();
check('Sin suscripción → 400', pedir(E, { accion: 'programar', id: 'x', fin: AHORA + 1000 }).status === 400);
check('Una dirección que no es de un servicio de notificaciones → 400',
  pedir(E, prog({ sub: { ...SUB, endpoint: 'https://ejemplo.com/push' } })).status === 400);
check('Por http, no → 400', pedir(E, prog({ sub: { ...SUB, endpoint: 'http://fcm.googleapis.com/x' } })).status === 400);
check('Sin claves de la suscripción → 400', pedir(E, prog({ sub: { endpoint: SUB.endpoint } })).status === 400);
check('Sin id → 400', pedir(E, prog({ id: '' })).status === 400);
check('Acción desconocida → 400', pedir(E, prog({ accion: 'borrar' })).status === 400);
check('JSON roto → 400', pedir(E, '{no es json').status === 400);
check(`Más de ${MAX_ESPERA / 1000} s de espera → 400 (la función no vive tanto)`, pedir(E, prog({ fin: AHORA + MAX_ESPERA + 1000 })).status === 400);
check('Un fin que ya pasó hace rato → 400', pedir(E, prog({ fin: AHORA - 10_000 })).status === 400);
check('Nada de eso deja esperas en marcha', E.esperas.length === 0 && E.vigentes.size === 0);

seccion('PROGRAMAR Y AVISAR');
E = entorno();
let r = pedir(E, prog());
check('Programar responde 202 al momento', r.status === 202 && r.json.programado && r.json.en === 120);
check('Y espera exactamente hasta el fin', E.esperas.length === 1 && E.esperas[0].ms === 120_000);
check('Nada se manda antes de tiempo', E.enviados.length === 0);
E.soltar();
check('Al acabar la espera manda el aviso', (await r.tarea) === 'enviado' && E.enviados.length === 1);
const d = E.enviados[0]?.datos ?? {};
check('«Descanso listo» con el ejercicio', d.titulo === 'Descanso listo' && /Press de banca/.test(d.cuerpo) && d.id === 'd1', JSON.stringify(d));
check('A la suscripción que lo pidió', E.enviados[0]?.sub.endpoint === SUB.endpoint);
check('Y no queda nada pendiente', E.vigentes.size === 0);
r = pedir(E, prog({ sub: SUB_IOS, id: 'i1' })); E.soltar();
check('iPhone (web.push.apple.com) vale igual', (await r.tarea) === 'enviado');
r = pedir(E, JSON.stringify(prog({ id: 't1' }))); E.soltar();
check('Llega como texto (sendBeacon) y se entiende', r.status === 202 && (await r.tarea) === 'enviado');
r = pedir(E, prog({ id: 'n1', nombre: 'x'.repeat(500) })); E.soltar(); await r.tarea;
check('Un nombre larguísimo se recorta', E.enviados.at(-1).datos.cuerpo.length < 120);
r = pedir(E, prog({ id: 'c1', fin: AHORA - 2000 }));
check('Un fin de hace 2 s (la red tardó) avisa ya', r.status === 202 && E.esperas.at(-1).ms === 0);
E.soltar(); await r.tarea;

seccion('CANCELAR');
E = entorno();
r = pedir(E, prog());
check('Cancelar responde 200', pedir(E, { accion: 'cancelar', sub: SUB, id: 'd1' }).status === 200);
E.soltar();
check('Y ya no se manda nada', (await r.tarea) === 'cancelado' && E.enviados.length === 0);
r = pedir(E, prog({ id: 'd2' }));
pedir(E, { accion: 'cancelar', sub: SUB, id: 'otro' });
E.soltar();
check('Cancelar OTRO descanso no toca este', (await r.tarea) === 'enviado');

seccion('UN DESCANSO NUEVO SUSTITUYE AL ANTERIOR');
E = entorno();
const viejo = pedir(E, prog({ id: 'a', fin: AHORA + 90_000 }));
const nuevo = pedir(E, prog({ id: 'b', fin: AHORA + 180_000 }));
E.soltar();
check('El viejo no avisa (habría sonado a mitad del descanso nuevo)', (await viejo.tarea) === 'cancelado');
check('El nuevo sí', (await nuevo.tarea) === 'enviado' && E.enviados.length === 1 && E.enviados[0].datos.id === 'b');
const otroCel = { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/otro' };
const a1 = pedir(E, prog({ id: 'x1' })), a2 = pedir(E, prog({ id: 'x2', sub: otroCel }));
E.soltar();
check('Dos celulares distintos no se pisan', (await a1.tarea) === 'enviado' && (await a2.tarea) === 'enviado');
check('Cada celular se reconoce sin guardar su dirección', dispositivo(SUB.endpoint).length === 24 && dispositivo(SUB.endpoint) !== dispositivo(otroCel.endpoint));

seccion('LA FUNCIÓN');
const { default: handler } = await import('./api/descanso.js');
const llamar = async (method, body) => {
  const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method, body }, res);
  return res;
};
const guardada = process.env.VAPID_PRIVATE_KEY;
delete process.env.VAPID_PRIVATE_KEY;
let res = await llamar('GET');
check('Sin la clave en Vercel, GET dice listo: false (la app no ofrece el aviso)', res.code === 200 && res.body.listo === false);
res = await llamar('POST', prog());
check('Y no programa nada (503)', res.code === 503);
res = await llamar('PUT');
check('Otros métodos → 405', res.code === 405);
check('Nunca se guarda en caché', res.headers['Cache-Control'] === 'no-store');
if (guardada) process.env.VAPID_PRIVATE_KEY = guardada;

console.log(`\n══ TOTAL AVISO: ${pruebas - fallos}/${pruebas} ══`);
if (fallos) process.exit(1);
