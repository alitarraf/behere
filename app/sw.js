// Offline-first: the shell is precached so a bell tap always opens,
// even when the phone can't reach the tailnet. Bump CACHE on deploys.
const CACHE = 'behere-v4';
const SHELL = ['/', '/seed.js', '/visual.js', '/manifest.webmanifest',
               '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname === '/vapid' || url.pathname === '/health') return; // always network
  e.respondWith((async () => {
    const cached = await caches.match(url.pathname === '/' ? '/' : e.request);
    // refresh the cache in the background when the network is there
    const refresh = fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(url.pathname === '/' ? '/' : e.request, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await refresh) || Response.error();
  })());
});

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
