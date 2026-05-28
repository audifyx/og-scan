/**
 * OG Scan — Service Worker
 * Provides offline caching, background sync, rich Web Push notifications, and PWA install support.
 */

const CACHE_NAME = "ogscan-v4";
const STATIC_ASSETS = [
  "/",
  "/app",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon.png",
];

function normalizeUrl(path) {
  try {
    return new URL(path || "/app", self.location.origin).toString();
  } catch {
    return new URL("/app", self.location.origin).toString();
  }
}

async function setBadgeCount(count) {
  try {
    if (self.navigator && typeof self.navigator.setAppBadge === "function") {
      if (count > 0) await self.navigator.setAppBadge(count);
      else if (typeof self.navigator.clearAppBadge === "function") await self.navigator.clearAppBadge();
      return;
    }

    if (self.registration && typeof self.registration.setAppBadge === "function") {
      if (count > 0) await self.registration.setAppBadge(count);
      else if (typeof self.registration.clearAppBadge === "function") await self.registration.clearAppBadge();
    }
  } catch (error) {
    console.warn("[sw] badge update failed", error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = {
    title: "OG Scan",
    body: "New notification",
    icon: "/icon-192x192.png",
    badge: "/favicon.png",
    image: undefined,
    url: "/app",
    tag: "group-system",
    group: "system",
    badgeCount: 0,
    requireInteraction: false,
    renotify: false,
    actions: [],
    data: {},
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload, data: { ...(payload?.data || {}) } };
    } catch {
      data.body = event.data.text();
    }
  }

  const actions = Array.isArray(data.actions) ? data.actions.slice(0, 2) : [];
  const actionUrls = actions.reduce((acc, action) => {
    if (action?.action && action?.url) acc[action.action] = action.url;
    return acc;
  }, {});

  const options = {
    body: data.body,
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/favicon.png",
    image: data.image,
    vibrate: [100, 50, 100],
    data: {
      ...(data.data || {}),
      url: normalizeUrl(data.url || data?.data?.url || "/app"),
      group: data.group || "system",
      badgeCount: Number(data.badgeCount || 0),
      actionUrls,
    },
    actions: actions.map((action) => ({ action: action.action, title: action.title })),
    tag: data.tag || `group-${data.group || "system"}`,
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.requireInteraction),
    timestamp: Date.now(),
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      setBadgeCount(Number(data.badgeCount || 0)),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const actionUrl = event.action && event.notification.data?.actionUrls
    ? event.notification.data.actionUrls[event.action]
    : null;
  const url = normalizeUrl(actionUrl || event.notification.data?.url || "/app");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        const sameOrigin = client.url.startsWith(self.location.origin);
        if (sameOrigin && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

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

  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
