// ═══════════════ AVISO AL ACABAR EL DESCANSO ═══════════════
// Cuando el descanso acaba y estás en otra app (música, chats), el celular avisa
// con una notificación que suena y vibra. Funciona igual en Android y en iPhone:
//
// - Ninguna app web puede contar en segundo plano en iPhone (iOS la congela al
//   salir), ni vibrar, ni flotar. Lo único que llega es una notificación push.
// - Así que, al SALIR de la app con un descanso en marcha, se le pide al
//   servidor (api/descanso.js) que mande el aviso a la hora de acabar. Si vuelves
//   antes, se cancela; si sales otra vez, se vuelve a pedir.
// - En iPhone solo funciona con la app añadida a la pantalla de inicio.
//
// La suscripción se guarda en memoria al abrir la app: al salir no da tiempo a
// pedirla al navegador (es asíncrona) y el aviso se tiene que mandar ya.

export const CLAVE_PUBLICA = 'BB0wptDzdIzhjOxYFKOt30jl4zeSuLoPHZ8MpiG3NOFc9i-wc7yVPArkfTwPXa5iez17cL-MDLQLS0xim9d1sc0';
const CLAVE = 'plan-internado-aviso';     // { activo, oculto } · aparte del estado del plan
const API = '/api/descanso';

let suscripcion = null;          // la de este dispositivo, ya en JSON
let servidorListo = null;        // ¿tiene el servidor su clave? (null = sin preguntar)
const pedidos = new Set();       // ids de descanso con aviso pedido y sin cancelar

const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) ?? {}; } catch { return {}; } };
const escribir = (v) => { try { localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), ...v })); } catch { /* sin almacenamiento: no pasa nada */ } };

export const soportaAviso = () => typeof window !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhone o iPad abriendo la app desde Safari, sin añadirla a la pantalla de inicio.
export const iPhoneSinInstalar = () => typeof navigator !== 'undefined'
  && /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone
  && !window.matchMedia?.('(display-mode: standalone)').matches;

const aBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

const registro = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, no) => setTimeout(() => no(new Error('sin service worker')), 8000)),
]);

// ¿Está montado el servidor? (en local o sin la clave puesta en Vercel, no)
export async function servidorDisponible() {
  if (servidorListo !== null) return servidorListo;
  try {
    const r = await fetch(API, { cache: 'no-store' });
    servidorListo = r.ok && (await r.json()).listo === true;
  } catch { servidorListo = false; }
  return servidorListo;
}

// 'activo' · 'apagado' · 'bloqueado' (el usuario dijo que no) · 'no-soportado'
export function estadoAviso() {
  if (!soportaAviso()) return 'no-soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  return Notification.permission === 'granted' && leer().activo ? 'activo' : 'apagado';
}
export const avisoOculto = () => !!leer().oculto;
export const ocultarAviso = () => escribir({ oculto: true });

// Al abrir la app: deja la suscripción en memoria para poder avisar al salir.
export async function prepararAviso() {
  if (estadoAviso() !== 'activo') return;
  try {
    const reg = await registro();
    const sub = await reg.pushManager.getSubscription();
    suscripcion = sub ? sub.toJSON() : null;
  } catch { suscripcion = null; }
}

// Tiene que llamarse desde un toque (iPhone no deja pedir permiso de otra forma).
export async function activarAviso() {
  if (!soportaAviso()) return 'no-soportado';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'apagado';
  try {
    const reg = await registro();
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) });
    suscripcion = sub.toJSON();
    escribir({ activo: true, oculto: false });
    return 'activo';
  } catch { return 'error'; }
}

export async function desactivarAviso() {
  escribir({ activo: false });
  try { const reg = await registro(); await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* ya no estaba */ }
  suscripcion = null;
}

// sendBeacon: llega aunque la app se esté cerrando. text/plain, para que ningún
// navegador lo rechace por el tipo.
const enviar = (cuerpo) => {
  try {
    const datos = new Blob([JSON.stringify(cuerpo)], { type: 'text/plain' });
    return navigator.sendBeacon?.(API, datos) ?? false;
  } catch { return false; }
};

// Al salir de la app con un descanso en marcha.
export function pedirAviso({ id, fin, nombre }) {
  if (!suscripcion || estadoAviso() !== 'activo' || fin <= Date.now()) return false;
  if (pedidos.has(id)) return true;
  if (!enviar({ accion: 'programar', sub: suscripcion, id, fin, nombre })) return false;
  pedidos.add(id);
  return true;
}

// Al volver antes de que acabe, al saltar el descanso o al empezar otro.
export function cancelarAviso(id) {
  if (!pedidos.has(id) || !suscripcion) return;
  pedidos.delete(id);
  enviar({ accion: 'cancelar', sub: suscripcion, id });
}
