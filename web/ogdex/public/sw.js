// OGDEX PWA service worker — scope: /OGDEX/. Separate from OG Scan root sw.js
// (which intentionally bypasses /OGDEX). Must never cache /api/ responses long.
const VERSION = "ogdex-v2";
const SHELL = "ogdex-shell-" + VERSION;
const RUNTIME = "ogdex-rt-" + VERSION;
const SHELL_URLS = ["/OGDEX/", "/OGDEX/index.html", "/OGDEX/manifest.webmanifest", "/OGDEX/ogdex-logo.png", "/OGDEX/pwa-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.endsWith(VERSION) === false && (k.startsWith("ogdex-shell-") || k.startsWith("ogdex-rt-"))).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // skip cross-origin (jup, gecko, dexscreener, wsrv)
  if (!url.pathname.startsWith("/OGDEX")) return;          // only manage OGDEX scope
  // API: network-first, short-lived fallback cache so the app still opens offline.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(RUNTIME).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req))
    );
    return;
  }
  // Navigations: network-first, fall back to cached app shell (SPA).
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/OGDEX/index.html")));
    return;
  }
  // Static assets: cache-first.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((r) => { const cp = r.clone(); caches.open(RUNTIME).then((c) => c.put(req, cp)); return r; }).catch(() => cached))
  );
});
