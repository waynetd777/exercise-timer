/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useRef } from 'react'

/**
 * Holds a screen wake lock while `active`.
 *
 * Pulled forward from phase 7 because a timer whose screen sleeps mid-set is
 * unusable, and it is small. Feature-detected: unsupported browsers simply do
 * without. The lock is released by the browser whenever the page is hidden, so
 * it has to be re-acquired on the way back.
 */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let cancelled = false
    // Guards the await gap: rapid hidden/visible flaps can start a second
    // request before the first resolves, and both would pass the sentinel
    // check. The second lock would then orphan the first, which cleanup could
    // no longer release.
    let acquiring = false

    const acquire = async () => {
      if (cancelled || acquiring || sentinel.current) return
      acquiring = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel.current = lock
        lock.addEventListener('release', () => {
          // Only if it is still ours: a release from an earlier lock landing
          // after a newer one was stored would orphan the newer one.
          if (sentinel.current === lock) sentinel.current = null
        })
      } catch {
        // Denied or unavailable (often a non-visible page). Nothing to do:
        // the workout still runs, the screen just may dim.
      } finally {
        acquiring = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel.current?.release()
      sentinel.current = null
    }
  }, [active])
}
