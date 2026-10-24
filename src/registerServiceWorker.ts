/**
 * Registers public/sw.js, which makes the app installable (a PWA) and able to open offline.
 * Only in production builds: in `npm run dev` a service worker would serve stale files.
 */
export function registerServiceWorker(enabled = import.meta.env.PROD): void {
  if (!enabled || !('serviceWorker' in navigator)) return
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js').catch((e: unknown) => {
        // The app still works without it; it just can't be installed or opened offline.
        console.warn('Service worker registration failed', e)
      })
    },
    { once: true },
  )
}
