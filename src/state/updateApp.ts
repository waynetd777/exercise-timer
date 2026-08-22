/**
 * Fetches the latest app from the host, then reloads onto it.
 *
 * No cache is ever deleted here. Workbox only writes the precache during a
 * service worker install and its name does not change between versions, so
 * deleting it never forces a newer copy: it destroys the offline shell (the
 * app's own HTML, JS, CSS and sounds) until some future deploy reinstalls it.
 * `registration.update()` plus the build's skipWaiting/clientsClaim config is
 * the whole mechanism: a new version installs its own entries and the old
 * worker's are cleaned up by Workbox on activation.
 *
 * KEPT, always:
 *   - IndexedDB, every routine and its edits. This must never be cleared; it
 *     is the only copy of anything authored in the editor.
 *   - the `exercise-images` runtime cache, so an update does not force every
 *     illustration to be downloaded again.
 */
export async function updateApp(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.update()
      // The waiting worker takes over immediately; the config sets skipWaiting,
      // but ask anyway in case a build ever changes that.
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      // Let a version that update() just found finish installing, so the
      // reload lands on it rather than the one being replaced.
      await settled(registration, 3_000)
    }
  } catch {
    // A failed update should still reload. The network may simply be down, and
    // reloading is what the user asked for.
  }

  location.reload()
}

/**
 * Resolves once the incoming worker is activated or given up on, with a
 * timeout because the reload must happen no matter what the worker does.
 */
function settled(registration: ServiceWorkerRegistration, timeoutMs: number): Promise<void> {
  const worker = registration.installing ?? registration.waiting
  if (!worker) return Promise.resolve()
  return settles(worker, timeoutMs)
}

function settles(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs)

    function finish() {
      clearTimeout(timer)
      worker.removeEventListener('statechange', onChange)
      resolve()
    }

    function onChange() {
      if (worker.state === 'activated' || worker.state === 'redundant') finish()
    }

    worker.addEventListener('statechange', onChange)
    onChange()
  })
}
