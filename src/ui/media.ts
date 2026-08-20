import type { MediaRef } from '../engine'

/**
 * PHASE 2 STOPGAP. Resolves the two media sources that need no storage layer,
 * so the run screen can show real images now.
 *
 * Phase 4 replaces this with `src/media/resolveMedia`, which adds the local
 * blob store, the postimages URL normaliser, offline pinning and an objectURL
 * cache. `local` refs deliberately return null until then.
 */
export function resolveMediaPreview(ref: MediaRef | undefined): string | null {
  if (!ref) return null
  switch (ref.source) {
    case 'remote':
      return ref.url
    case 'bundled':
      return `${import.meta.env.BASE_URL}${ref.path}`
    case 'local':
      return null
  }
}
