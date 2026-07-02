// UnQTools service worker — designed for Cloudflare Pages (static HTML per route).
//
// Strategy:
//   - Install: precache the app shell (homepage, manifest, icons, favicon).
//   - Activate: clean up old cache versions, claim clients immediately.
//   - Navigation fetch (HTML pages): network-first, fall back to cache, then
//     fall back to the cached homepage (offline shell). The cached shell is
//     used ONLY when both network and the per-route cache miss — so each
//     tool page is cached at its own URL, not aliased to "/".
//   - Static assets (_astro/* hashed JS/CSS, icons): stale-while-revalidate.
//     Hashed assets are immutable so the cache hit rate is effectively 100%
//     for return visits.
//
// Notes:
//   - No localhost hardcoded anywhere. The SW uses self.location.origin so it
//     works on any deployment origin (Cloudflare Pages, custom domain, etc.).
//   - The precache list is path-only (no origin), so the same SW works on
//     unqtools.pages.dev today and unqtools.com tomorrow without rebuild.
//   - skipWaiting + clients.claim means new SW versions take over as soon as
//     they install. Combined with the HTML `max-age=0, must-revalidate` header,
//     users see new deploys within one page reload.

const CACHE_VERSION = "unq-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Pre-cached app shell. These are the resources needed for the offline
// experience to feel "installed" — the homepage HTML + manifest + icons.
// Per-tool HTML pages are cached on first visit (runtime cache).
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {
            /* network failures during install are non-fatal — the SW still activates */
          }
        }),
      );
      // Take over from the previous SW as soon as possible so deploys are visible
      // without requiring the user to close all tabs.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous SW versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
      );
      // Claim all open clients so they get the new SW's fetch handler immediately.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs; let the browser handle POSTs, etc.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Don't intercept cross-origin requests (e.g. analytics, fonts from CDNs).
  if (url.origin !== self.location.origin) return;

  // Don't intercept the service worker itself.
  if (url.pathname === "/sw.js") return;

  // --- Navigation requests (HTML pages) -------------------------------------
  // Network-first: try the network so users see fresh content after deploys,
  // fall back to the per-URL cache when offline, then fall back to the cached
  // homepage as the "offline shell".
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          // Offline (or fetch failed). Try the per-URL cache first.
          const cached = await caches.match(req);
          if (cached) return cached;
          // Final fallback: the precached homepage (offline shell).
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response("Offline and this page is not cached.", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // --- Hashed assets (_astro/*.js, *.css) and other static assets -----------
  // Stale-while-revalidate: serve from cache immediately if present, refresh
  // in the background. Hashed filenames mean cached responses are always
  // correct for their filename.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })(),
  );
});
