self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (_) {}
  const mode = p.mode || 'buzz';
  const opts = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [150, 80, 150],
    tag: 'bell',            // a new bell replaces any unmet old one
    renotify: true,         // …but must still buzz (same-tag updates are silent by default)
    data: { mode, ts: p.ts || Date.now() },
  };
  if (mode === 'line' || mode === 'visual') opts.body = p.text || '';
  event.waitUntil(self.registration.showNotification('BeHereNow', opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { mode, ts } = event.notification.data || {};
  if (mode !== 'visual') return;
  event.waitUntil(clients.openWindow('/?bell=' + (ts || '')));
});
