/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

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
    /*
     * `catch`, because reading a blob can FAIL rather than merely miss: `openDb`
     * throws where site data is blocked, which is a private window or a browser
     * set to refuse storage. A step then shows no picture, which is the same
     * outcome as a photo that is not on this device, instead of an unhandled
     * rejection from every row at once.
     */
    void resolveMedia(ref, base)
      .catch(() => null)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
    return () => {
      cancelled = true
    }
  }, [ref, base])

  return url
}
