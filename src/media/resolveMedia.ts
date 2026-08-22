import type { MediaRef } from '../engine'
import { resolvePlan } from './resolve'
import { getBlob, onBlobStored } from './store'

/**
 * Turns a media ref into something an `<img src>` can use.
 *
 * Object URLs are cached per hash and never revoked while the app lives: a
 * routine shows the same image many times, and revoking on unmount would break
 * a step that is still on screen. The cache is bounded by the number of distinct
 * images in a routine, which is a handful.
 */
const objectUrls = new Map<string, string>()
/** Hashes already looked up, misses included, so a blob is read at most once. */
const known = new Set<string>()

// A cached miss is only true until the blob is stored. Forgetting it then lets
// the next resolve read the new blob instead of waiting for a reload.
onBlobStored((hash) => known.delete(hash))

/** Synchronous best guess, for the first paint before any blob is read. */
export function resolveMediaSync(ref: MediaRef | undefined, base: string): string | null {
  const plan = resolvePlan(ref, (hash) => objectUrls.has(hash), base)
  if (plan.kind === 'url') return plan.url
  if (plan.kind === 'blob') return objectUrls.get(plan.hash) ?? null
  return null
}

/** Reads the blob if it has not been seen yet, then resolves properly. */
export async function resolveMedia(
  ref: MediaRef | undefined,
  base: string,
): Promise<string | null> {
  if (!ref) return null

  const hash =
    ref.source === 'local' ? ref.hash : ref.source === 'remote' ? ref.cachedHash : undefined

  if (hash && !objectUrls.has(hash) && !known.has(hash)) {
    known.add(hash)
    const blob = await getBlob(hash)
    if (blob) objectUrls.set(hash, URL.createObjectURL(blob))
  }

  return resolveMediaSync(ref, base)
}

/** Called after a blob is deleted, so a stale object URL is not handed out. */
export function forgetBlob(hash: string): void {
  const url = objectUrls.get(hash)
  if (url) URL.revokeObjectURL(url)
  objectUrls.delete(hash)
  known.delete(hash)
}
