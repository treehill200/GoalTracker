/* Goal Tracker service worker (hand-written; see DECISIONS.md).
 * - Precaches the app shell so the app opens offline
 * - Network-first for pages (falls back to cache, then /offline)
 * - Cache-first for immutable build assets
 * - Web Push + notification clicks
 * Data itself lives in IndexedDB; offline logs are queued by the app (lib/data/outbox.ts).
 */
const VERSION = "gt-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const PRECACHE = ["/", "/goals", "/log", "/coach", "/rewards", "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(request)) || (await caches.match(request, { ignoreSearch: request.mode === "navigate" }));
    if (hit) return hit;
    if (request.mode === "navigate") return (await caches.match("/offline")) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(ASSETS)).put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  const net = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always live (AI, webhooks, auth)
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(req));
  if (req.mode === "navigate" || req.headers.get("RSC") === "1") return event.respondWith(networkFirst(req, PAGES));
  if (/\.(png|svg|ico|webp|woff2?|webmanifest)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") return event.respondWith(staleWhileRevalidate(req));
});

self.addEventListener("push", (event) => {
  let data = { title: "Goal Tracker", body: "", href: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: data.tag,
      data: { href: data.href || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.postMessage({ type: "navigate", href });
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
