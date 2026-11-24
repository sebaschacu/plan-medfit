// ═══════════════ AVISO DE DESCANSO · service worker ═══════════════
// Lo carga el service worker de la app (vite.config.js → importScripts).
// Muestra la notificación que manda /api/descanso y, al tocarla, abre la app.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Descanso listo', {
    body: d.cuerpo || 'A por la siguiente serie',
    tag: 'descanso',            // uno nuevo sustituye al anterior
    renotify: true,
    vibrate: [300, 120, 300, 120, 300],
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    timestamp: d.fin || Date.now(),
    data: { url: '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = abiertas.find(c => new URL(c.url).origin === self.location.origin);
    if (app) return app.focus();
    return self.clients.openWindow('/');
  })());
});
