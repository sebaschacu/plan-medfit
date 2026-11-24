// ═══════════════ AVISO DE DESCANSO · lógica del servidor ═══════════════
// La app, al salir con un descanso en marcha, manda { accion: 'programar', sub,
// id, fin, nombre }. Esta función espera hasta `fin` y manda la notificación.
// Si antes llega { accion: 'cancelar' } o un descanso nuevo del mismo celular,
// no manda nada.
//
// Sin base de datos: lo vigente de cada celular se guarda en memoria. Las
// peticiones de una misma persona caen en la misma instancia mientras la
// primera sigue esperando (Fluid compute reparte así), que es justo cuando hace
// falta cancelar. Si alguna vez cayera en otra, el peor caso es un aviso de más.
//
// El archivo empieza por «_»: Vercel no lo publica como función propia.
import { createHash, randomUUID } from 'node:crypto';

export const MAX_ESPERA = 290_000;          // la función vive 300 s como mucho
const SERVICIOS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

export const dispositivo = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 24);

const valida = (sub) => {
  try {
    const u = new URL(sub?.endpoint);
    return u.protocol === 'https:' && SERVICIOS.some(r => r.test(u.hostname))
      && typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string';
  } catch { return false; }
};

const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// Devuelve { status, json, tarea }. `tarea` es la espera + el envío, para que el
// manejador la deje correr después de responder (waitUntil).
export function procesar(cuerpo, { ahora = Date.now(), enviar, esperar, vigentes }) {
  let b = cuerpo;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return { status: 400, json: { error: 'json' } }; } }
  if (!b || !valida(b.sub)) return { status: 400, json: { error: 'suscripcion' } };
  const id = texto(b.id, 40);
  if (!id) return { status: 400, json: { error: 'id' } };
  const disp = dispositivo(b.sub.endpoint);

  if (b.accion === 'cancelar') {
    if (vigentes.get(disp)?.id === id) vigentes.delete(disp);
    return { status: 200, json: { cancelado: true } };
  }
  if (b.accion !== 'programar') return { status: 400, json: { error: 'accion' } };

  const fin = Number(b.fin);
  const espera = fin - ahora;
  if (!Number.isFinite(fin) || espera > MAX_ESPERA || espera < -5000) return { status: 400, json: { error: 'fin' } };

  const token = randomUUID();
  vigentes.set(disp, { id, token });
  const tarea = (async () => {
    await esperar(Math.max(0, espera));
    if (vigentes.get(disp)?.token !== token) return 'cancelado';
    vigentes.delete(disp);
    const nombre = texto(b.nombre, 80);
    await enviar(b.sub, JSON.stringify({
      titulo: 'Descanso listo',
      cuerpo: nombre ? `${nombre} · a por la siguiente serie` : 'A por la siguiente serie',
      id, fin,
    }));
    return 'enviado';
  })();
  return { status: 202, json: { programado: true, en: Math.round(Math.max(0, espera) / 1000) }, tarea };
}
