// Service worker: makes MPG Logger installable and lets the app itself open without a connection.
// Fuel logs and accounts always come live from the API (never cached), so they need a connection.
//
// Bump VERSION to throw away everything cached by an older version.
const VERSION = 'v1'
const CACHE = `mpg-logger-${VERSION}`

// The app shell: enough to start the app offline. Vite's /assets/* files are cached as they load.
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API: always the network, so you never see stale or someone else's data.
  if (url.pathname.startsWith('/api/')) return

  // Pages (/, /home, /account...): the newest index.html when online, the cached one when offline.
  // Every path is the same single-page app, so they all share the "/" entry.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put('/', copy))
          }
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Vite's /assets/* names include a content hash, so a cached copy never goes stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  // Everything else (icons, manifest): the cached copy straight away, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached ?? refresh
    }),
  )
})
