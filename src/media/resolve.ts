/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { MediaRef } from '../engine'

/** A ref to an image that ships with the app, by its path under `public/`. */
export function bundled(path: string): MediaRef {
  return { source: 'bundled', path }
}

/**
 * What a media ref resolves to, decided without touching storage or the DOM so
 * it can be tested on its own.
 *
 * A pinned remote image prefers its LOCAL copy: that is the whole point of
 * pinning, so the routine keeps working when the gym wifi does not, and when
 * postimages eventually loses the file.
 */
type Plan =
  | { kind: 'url'; url: string }
  | { kind: 'blob'; hash: string }
  | { kind: 'none' }

export function resolvePlan(
  ref: MediaRef | undefined,
  hasBlob: (hash: string) => boolean,
  base: string,
): Plan {
  if (!ref) return { kind: 'none' }

  switch (ref.source) {
    case 'local':
      return hasBlob(ref.hash) ? { kind: 'blob', hash: ref.hash } : { kind: 'none' }

    case 'remote':
      if (ref.cachedHash && hasBlob(ref.cachedHash)) return { kind: 'blob', hash: ref.cachedHash }
      return { kind: 'url', url: ref.url }

    case 'bundled':
      return { kind: 'url', url: `${base}${ref.path}` }
  }
}
