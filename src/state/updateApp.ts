/**
 * Fetches the latest app from the host, replacing the cached shell.
 *
 * What is dropped and what is kept matters:
 *   - DROPPED: the Workbox precache (the HTML, JS and CSS of the app itself).
 *   - KEPT:    IndexedDB — every routine and its edits. This must never be
 *              cleared; it is the only copy of anything authored in the editor.
 *   - KEPT:    the `exercise-images` runtime cache, so an update does not force
 *              every illustration to be downloaded again.
 */
export async function updateApp(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.update()
      // The waiting worker takes over immediately; the config sets skipWaiting,
      // but ask anyway in case a build ever changes that.
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    }

    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.includes('precache')).map((name) => caches.delete(name)),
      )
    }
  } catch {
    // A failed update should still reload — the network may simply be down, and
    // reloading is what the user asked for.
  }

  location.reload()
}
