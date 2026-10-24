/**
 * Registers public/sw.js so the app can be installed to the home screen.
 * Only in production builds: in `npm run dev` a service worker would cache files
 * and hide your edits.
 */
export function registerServiceWorker(
  isProduction: boolean = import.meta.env.PROD,
  nav: Navigator = navigator,
): void {
  if (!isProduction || !('serviceWorker' in nav)) return
  // Installing is a nice-to-have; the app works the same without it.
  nav.serviceWorker.register('/sw.js').catch(() => {})
}
