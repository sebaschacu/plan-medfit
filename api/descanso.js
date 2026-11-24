// ═══════════════ /api/descanso · el aviso al acabar el descanso ═══════════════
// GET  → { listo }: si el servidor tiene su clave (sin ella, la app no ofrece el aviso).
// POST → programar o cancelar (ver _descanso.js). Responde enseguida y sigue
//        esperando en segundo plano hasta la hora de avisar.
//
// La clave privada va en Vercel → Settings → Environment Variables, con el
// nombre VAPID_PRIVATE_KEY. La pública es la de src/utiles/avisoDescanso.js.
import webpush from 'web-push';
import { waitUntil } from '@vercel/functions';
import { procesar } from './_descanso.js';

const PUBLICA = 'BB0wptDzdIzhjOxYFKOt30jl4zeSuLoPHZ8MpiG3NOFc9i-wc7yVPArkfTwPXa5iez17cL-MDLQLS0xim9d1sc0';
const vigentes = new Map();
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  const privada = process.env.VAPID_PRIVATE_KEY;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ listo: !!privada });
  if (req.method !== 'POST') return res.status(405).json({ error: 'metodo' });
  if (!privada) return res.status(503).json({ error: 'sin-clave' });

  webpush.setVapidDetails('https://plan-medfit.vercel.app', PUBLICA, privada);
  const enviar = (sub, datos) => webpush.sendNotification(sub, datos, { TTL: 120, urgency: 'high', topic: 'descanso' })
    .catch(e => console.error('aviso no enviado', e.statusCode ?? e.message));
  const r = procesar(req.body, { enviar, esperar: dormir, vigentes });
  if (r.tarea) waitUntil(r.tarea);
  return res.status(r.status).json(r.json);
}
