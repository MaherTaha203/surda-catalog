// Bump this version whenever the caching strategy or precache list changes:
// `activate` purges every cache that doesn't match, and skipWaiting + claim make
// the new worker take over on the next load.
const CACHE_NAME = 'sarda-catalog-v7';
const PRECACHE_URLS = [
  '/',
  '/catalog',
  // Route-agnostic SPA shell (empty router outlet). It is what the server returns
  // for any non-prerendered client route (e.g. /product/:id); precaching it lets
  // deep links open cleanly even fully offline, without a hydration mismatch.
  '/_shell.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Product images live under /uploads/ and are effectively immutable: replacing a
// product image uploads a NEW file (new name) and the old URL is dropped. So an
// image URL that is already cached never needs to be re-fetched — cache-first,
// which also means the catalog's pictures are there instantly and offline.
function isImageRequest(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/uploads/');
}

// Is this a request to the dynamic data API? Those must be network-first so a
// mutation (new/edited product, changed setting) is reflected immediately and
// never served stale from the cache.
// [notifications-feature] `notifications-api` is EXPERIMENTAL — remove it here to
// delete the feature. It MUST be network-first (dynamic feed).
function isApiRequest(url) {
  if (url.origin !== self.location.origin) return true; // cross-origin API host
  return /^\/(products|upload|uploads|health|api|catalog-settings|notifications-api)(\/|$)/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // HTML navigations — see handleNavigation for the cache-first-per-route rule.
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Product images: cache-first, never re-downloaded once cached.
  if (isImageRequest(url)) {
    event.respondWith(cacheFirstImage(event));
    return;
  }

  // Dynamic API: network-first, fall back to cache only when offline.
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(event));
    return;
  }

  // Static assets (hashed JS/CSS/fonts): cache-first, revalidate in background.
  event.respondWith(staleWhileRevalidate(event));
});

// Navigations (HTML documents). This app PRERENDERS a distinct SSR document per
// route, so serving one route's HTML for a different route would cause a React
// hydration mismatch. Strategy:
//   • EXACT cached document → serve cache-first (precached '/' and '/catalog',
//     plus any route visited before, open instantly — even offline), revalidate.
//   • Not cached yet → fetch THIS route's real document from the network (for a
//     prerendered route that is its own document; for a dynamic route the server
//     returns the route-agnostic SPA shell) and cache it; fall back to the app
//     shell only when the network is unavailable (an unvisited route opened fully
//     offline — rare).
//
// The offline fallback is the SPA shell (`/_shell.html`) — a route-agnostic
// document with an empty router outlet, so it hydrates cleanly on ANY route. The
// prerendered `/` and `/catalog` are route-SPECIFIC (landing spinner / catalog),
// so using them as a generic fallback for a different route (e.g. /product/:id)
// would reintroduce a hydration mismatch; the shell does not.
async function handleNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.match(event.request);
  if (exact) {
    event.waitUntil(
      fetch(event.request)
        .then((r) => { if (r.ok) return cache.put(event.request, r.clone()); })
        .catch(() => {}),
    );
    return exact;
  }
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
    return response;
  } catch {
    return (
      (await cache.match('/_shell.html')) ||
      (await cache.match('/catalog')) ||
      (await cache.match('/')) ||
      Response.error()
    );
  }
}

async function cacheFirstImage(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  if (cached) return cached; // already have it — no network request at all
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(event) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(event.request);
    if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
    return response;
  } catch {
    return (await cache.match(event.request)) || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  const revalidate = fetch(event.request)
    .then((response) => {
      if (response.ok) return cache.put(event.request, response.clone()).then(() => response);
      return response;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(revalidate);
    return cached;
  }
  return (await revalidate) || Response.error();
}
