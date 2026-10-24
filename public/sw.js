// Service worker: lets the app be installed and open without a connection.
// - Pages: network first, so a new deploy shows up right away; the cached copy is used offline.
// - /assets/* (hashed by Vite, never change): cache first.
// - /api/*: never cached, fuel logs always come live from the backend.
// Bump CACHE when this file's caching rules change; old caches are deleted on activate.
const CACHE = 'mpg-logger-v1'
/** Cached on install, so the app can start offline. */
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

/** Install: cache the app shell, then take over right away instead of waiting for old tabs to close. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

/** Activate: delete caches from older versions and control the open tabs. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Asks the network and refreshes the cache; offline, answers from the cache instead.
 *
 * @param {Request} request the request to answer
 * @param {string} [fallbackUrl] used when this exact request isn't cached (pages fall back to "/")
 * @returns {Promise<Response>} the network response, or the cached one when offline
 */
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = (await cache.match(request)) ?? (fallbackUrl && (await cache.match(fallbackUrl)))
    if (cached) return cached
    throw error
  }
}

/**
 * Answers from the cache if possible, otherwise from the network (and caches the answer).
 * Only for files whose content never changes under the same name.
 *
 * @param {Request} request the request to answer
 * @returns {Promise<Response>} the cached or fetched response
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

/** Fetch: picks a strategy per request (see the top of this file); /api and other sites are left alone. */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return // let the browser handle it normally
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(networkFirst(request))
  }
})
