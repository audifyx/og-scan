const CACHE = 'ogbets-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // network-first for navigation, fall back to cache
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(req).then(r => r || caches.match('/'))));
    return;
  }
});
// Push-ready (server push can be added later with VAPID)
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  const title = data.title || 'OG BETS';
  const options = { body: data.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: data.url || '/app' };
  e.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data || '/app'));
});
