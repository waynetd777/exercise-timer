import type { MediaRef } from '../engine'
import { downscale } from './downscale'
import { sha256 } from './hash'
import { hasBlob, putBlob } from './store'

/**
 * Stores a file the user picked, ready to attach to a step.
 *
 * The only way an image enters storage now. `pinRemote` used to live here too —
 * it fetched a linked image and kept a local copy, which was the whole answer to
 * "what happens in a gym with no signal" while the illustrations were hosted
 * elsewhere. They ship with the app and are precached, so there is nothing left
 * to rescue: a step's image is either bundled or already on this device.
 *
 * `resolvePlan` still reads a pinned copy, since a routine saved before the move
 * may carry one, and `gc.ts` still counts it as live. Nothing creates one.
 */
export async function storeFile(file: Blob): Promise<MediaRef> {
  const stored = await downscale(file)
  const hash = await sha256(stored)
  if (!(await hasBlob(hash))) await putBlob(hash, stored)
  return { source: 'local', hash, mime: stored.type || 'image/webp' }
}
