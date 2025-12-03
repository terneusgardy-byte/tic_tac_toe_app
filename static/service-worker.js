// ---------------------------------------------------
// Tic Tac Toe — PWA Service Worker (cache-first)
// ---------------------------------------------------

const CACHE_NAME = "ttt-cache-v2";  // bump version to force fresh cache

const ASSETS = [
  "/",
  "/static/style.css",
  "/static/script.js",
  "/static/manifest.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/vendor/canvas-confetti.min.js",
];

// INSTALL — cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => {
        console.error("SW install cache error:", err);
      })
  );
  self.skipWaiting();
});

// ACTIVATE — remove old caches
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

// FETCH — cache-first, with special handling for navigation
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // When opening the app (navigation) — serve cached "/" if offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/"))
    );
    return;
  }

  // For everything else (CSS, JS, icons): cache-first, ignore query strings
  event.respondWith(
    caches
      .match(req, { ignoreSearch: true })
      .then((cached) => cached || fetch(req))
  );
});