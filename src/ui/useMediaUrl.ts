import { useEffect, useState } from 'react'
import type { MediaRef } from '../engine'
import { resolveMedia, resolveMediaSync } from '../media/resolveMedia'

/**
 * The URL for a step's image, whatever kind it is.
 *
 * Resolves synchronously first so a remote image paints immediately, then
 * asynchronously in case the blob has to be read out of IndexedDB. Without the
 * synchronous first pass every image would flash blank on a step change.
 */
export function useMediaUrl(ref: MediaRef | undefined): string | null {
  const base = import.meta.env.BASE_URL
  const [url, setUrl] = useState(() => resolveMediaSync(ref, base))

  useEffect(() => {
    let cancelled = false
    setUrl(resolveMediaSync(ref, base))
    void resolveMedia(ref, base).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [ref, base])

  return url
}
