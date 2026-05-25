/**
 * OG Scan — Service Worker
 * Provides offline caching, background sync, Web Push notifications, and PWA install support.
 */

const CACHE_NAME = "ogscan-v2";
const STATIC_ASSETS = [
  "/",
  "/app",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon.png",
];

// ─── Install — pre-cache core shell ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate — clean old caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Push — show native notification ───
self.addEventListener("push", (event) => {
  let data = { title: "OG Scan", body: "New notification", icon: "/icon-192x192.png", badge: "/favicon.png", url: "/app" };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/favicon.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/app" },
    actions: data.actions || [],
    tag: data.tag || `ogscan-${Date.now()}`,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Notification click — open/focus app ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      return clients.openWindow(url);
    })
  );
});

// ─── Fetch — network-first for navigation, cache-first for static assets ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages) — network first, fall back to cached /app shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match("/app").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts) — stale-while-revalidate
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/memes/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // API calls — network only (don't cache dynamic data)
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return;
  }

  // Everything else — network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
