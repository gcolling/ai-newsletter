// Offline reading. Pages: network first, falling back to the last copy seen. Assets: cache first
// (their URLs change when their content does). Other sites are never touched.
// The build fills in the cache version and the list of files to keep offline.
const CACHE = "facet-__VERSION__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      // "no-cache" revalidates with the server every time (a cheap 304 when nothing changed), so a
      // new deploy shows on the next load instead of after the host's 10-minute cache.
      // A navigation request can't be re-issued with options, hence the URL.
      fetch(request.url, { cache: "no-cache", credentials: "same-origin" })
        .then((response) => {
          if (response.redirected) return Response.redirect(response.url, 302);
          // Only a real page is worth keeping as the offline copy, never an error.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit ?? caches.match(PRECACHE[0]))
            .then((hit) => hit ?? Response.error()),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
