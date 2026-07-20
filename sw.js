// Audio Lab - Service Worker
// Provides an installable, offline-capable app shell.

const CACHE_VERSION = "audio-lab-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigation requests: network-first, falling back to cached app shell (offline support)
// - Same-origin static assets (icons, manifest, css/js/fonts): cache-first, then network
// - Cross-origin requests (CDNs, external audio/image sources, form submissions): pass through to network
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return; // don't intercept POSTs (e.g. feedback form submission)
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("./index.html").then((cached) => cached || Response.error())
      )
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
  }
  // Cross-origin (fonts, font awesome, jsmediatags CDN, formsubmit.co, local audio files, etc.)
  // is left to the network as-is so nothing here breaks external functionality.
});
