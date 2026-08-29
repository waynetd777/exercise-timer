/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

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
/**
 * Hashes already looked up, misses included, so a blob is read at most once.
 * The value is the read itself while it is in flight: a second caller for the
 * same hash AWAITS it rather than finding the hash "known" and settling for
 * the miss it was about to become. The run screen resolves the current and the
 * next step in one render, and two sets sharing a photo left the next panel
 * blank for good.
 */
const known = new Map<string, Promise<void>>()

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

  if (hash && !objectUrls.has(hash)) {
    let read = known.get(hash)
    if (!read) {
      read = getBlob(hash).then((blob) => {
        if (blob) objectUrls.set(hash, URL.createObjectURL(blob))
      })
      known.set(hash, read)
    }
    try {
      await read
    } catch {
      /*
       * A read can FAIL rather than miss: `openDb` throws where site data is
       * blocked (a private window, a browser set to refuse storage) and a
       * connection can close under iOS. Not cached: a rejected promise left in
       * `known` replayed one transient error to every later resolve of that
       * hash until a reload. And not thrown: the caller gets the best answer
       * there is, which for a linked image is its URL and for an uploaded photo
       * is nothing, the same as a photo that is not on this device. Every
       * caller used to catch this itself, and one of them then replaced a good
       * URL with null.
       */
      known.delete(hash)
    }
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
