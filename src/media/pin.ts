/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { MediaRef } from '../engine'
import { downscale } from './downscale'
import { sha256 } from './hash'
import { hasBlob, putBlob } from './store'

/**
 * Stores a file the user picked, ready to attach to a step.
 *
 * The only way an image enters storage now. `pinRemote` used to live here too,
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

/*
 * Session-scoped draft pins.
 *
 * The GC sweep counts references over PERSISTED workouts only, so a blob held
 * by an unsaved editor draft, or one just written during an import before its
 * routine lands, looks orphaned to it. A concurrent sweep (a delete in another
 * part of the UI, a second tab) would collect the bytes, and the routine saved
 * a moment later would reference an image that resolves to nothing.
 *
 * Pinning parks a hash until the draft is saved or discarded. Counted rather
 * than boolean, because storage is content-addressed and two open drafts can
 * hold the same image; the first one closing must not expose the other's.
 */
const draftPins = new Map<string, number>()

export function pinDraft(hash: string): void {
  draftPins.set(hash, (draftPins.get(hash) ?? 0) + 1)
}

export function unpinDraft(hash: string): void {
  const count = draftPins.get(hash)
  if (count === undefined) return
  if (count <= 1) draftPins.delete(hash)
  else draftPins.set(hash, count - 1)
}

/** Snapshot for the sweep, which must not delete what a draft still holds. */
export function draftPinnedHashes(): ReadonlySet<string> {
  return new Set(draftPins.keys())
}
