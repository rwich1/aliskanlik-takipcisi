/* Offline support for the web (PWA) version. Electron and Android load files locally and do not use this. */
// CI replaces this with the commit id on every deploy, so each deploy installs a fresh cache.
const VERSION = "v1.0.0";
const CACHE = `aliskanlik-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "theme.js",
  "app.js",
  "storage.js",
  "firebase-config.js",
  "vendor/firebase.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-64.png",
  "fonts/bricolage-grotesque-latin-wght-normal.woff2",
  "fonts/bricolage-grotesque-latin-ext-wght-normal.woff2",
  "fonts/figtree-latin-400-normal.woff2",
  "fonts/figtree-latin-500-normal.woff2",
  "fonts/figtree-latin-600-normal.woff2",
  "fonts/figtree-latin-ext-400-normal.woff2",
  "fonts/figtree-latin-ext-500-normal.woff2",
  "fonts/figtree-latin-ext-600-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2",
  "fonts/ibm-plex-mono-latin-ext-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-ext-500-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("aliskanlik-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

// Same-origin GETs: network first, revalidated with the server (cache: "no-cache", so the browser's HTTP cache
// cannot hand out an old app.js after a deploy), falling back to the cached copy when offline, on a server error,
// or when the network takes longer than 4 s. Files are cached under their address without "?v=…", so a fresh copy
// always replaces the old one. After a page fell back to the cache, its other files come from the cache straight
// away for a short while, so a hung server costs one timeout instead of one per file.
// Firebase traffic (other origins) is never touched; Firestore has its own offline cache.
let degradedUntil = 0;
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const nav = req.mode === "navigate";
  const cacheKey = nav ? new URL("index.html", self.registration.scope).href : url.origin + url.pathname;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (!nav && Date.now() < degradedUntil) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }
    const ctl = new AbortController();
    // Navigations keep the browser's own request (redirects then work as usual); files are revalidated.
    const net = (nav ? fetch(req, { signal: ctl.signal }) : fetch(req, { cache: "no-cache", signal: ctl.signal })).then((res) => {
      if (res.ok && res.type === "basic") cache.put(cacheKey, res.clone());
      return res;
    });
    net.catch(() => {});
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    let res = null;
    try { res = await Promise.race([net, timeout]); } catch {}
    // A page that does not exist (404) is shown as it is; only network failures, timeouts and server errors use the cache.
    const usable = res && (res.ok || res.type === "opaqueredirect" || (nav && res.status < 500));
    if (usable) { if (nav && res.ok) degradedUntil = 0; return res; }
    const hit = await cache.match(cacheKey);
    if (hit) {
      if (nav) degradedUntil = Date.now() + 15000;
      if (!res) ctl.abort();
      return hit;
    }
    return res || net; // nothing cached: hand over whatever the network gives
  })());
});
