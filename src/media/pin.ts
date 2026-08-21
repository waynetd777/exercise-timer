import type { MediaRef } from '../engine'
import { downscale } from './downscale'
import { sha256 } from './hash'
import { hasBlob, putBlob } from './store'

/**
 * Stores a copy of a remote image locally.
 *
 * Possible because `i.postimg.cc` sends `access-control-allow-origin: *`, so the
 * bytes can actually be read rather than only displayed. That is what makes a
 * routine survive both gym wifi and the host eventually losing the file.
 */
export async function pinRemote(ref: MediaRef): Promise<MediaRef> {
  if (ref.source !== 'remote') return ref
  if (ref.cachedHash && (await hasBlob(ref.cachedHash))) return ref

  const response = await fetch(ref.url, { mode: 'cors' })
  if (!response.ok) throw new Error(`${response.status} fetching the image`)

  const stored = await downscale(await response.blob())
  const hash = await sha256(stored)
  if (!(await hasBlob(hash))) await putBlob(hash, stored)

  return { ...ref, cachedHash: hash }
}

/** Stores a file the user picked, ready to attach to a step. */
export async function storeFile(file: Blob): Promise<MediaRef> {
  const stored = await downscale(file)
  const hash = await sha256(stored)
  if (!(await hasBlob(hash))) await putBlob(hash, stored)
  return { source: 'local', hash, mime: stored.type || 'image/webp' }
}
