/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, MediaRef, Workout } from '../engine'

/**
 * Which stored blobs are still referenced, and which are orphaned.
 *
 * Content-addressed storage means a blob can be shared by several routines, so
 * deleting a routine must not delete an image another one still points at. This
 * is pure set arithmetic over the whole library, the only safe way to decide.
 */
export function liveHashes(
  workouts: readonly Workout[],
  /**
   * Hashes held OUTSIDE any routine: the exercises page's own pictures.
   *
   * A second root, and the sweep is wrong without it. That page's photos are
   * referenced by no step at all, so the walk below cannot see them, and the
   * first delete of any routine would have collected them. See
   * `storage/pictures.ts`.
   */
  alsoLive: readonly string[] = [],
): Set<string> {
  const live = new Set<string>(alsoLive)
  forEachMedia(workouts, (media) => {
    if (media.source === 'local') live.add(media.hash)
    // A pinned remote image also owns its blob.
    if (media.source === 'remote' && media.cachedHash) live.add(media.cachedHash)
  })
  return live
}

/** Every step's media across the routines. Any group kind: missing one would orphan live images. */
function forEachMedia(workouts: readonly Workout[], visit: (media: MediaRef) => void): void {
  const walk = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      if (block.kind !== 'segment') walk(block.children)
      else if (block.media) visit(block.media)
    }
  }
  for (const workout of workouts) walk(workout.blocks)
}

/**
 * The UPLOADED photos a set of routines uses, in a stable order.
 *
 * Narrower than `liveHashes` on purpose: that one also counts a pinned copy of a
 * linked image, because the sweep must not delete a cache something still points
 * at. An export wants only what nothing else has, meaning the illustrations that ship
 * with the app need no bytes in the file, and a pinned copy of a link is a cache
 * rather than the original.
 */
export function localHashes(workouts: readonly Workout[]): string[] {
  const found = new Set<string>()
  forEachMedia(workouts, (media) => {
    if (media.source === 'local') found.add(media.hash)
  })
  return [...found].sort()
}

/**
 * Stored hashes no routine references any more.
 *
 * `pinned` holds hashes owned by work in flight (an unsaved editor draft, an
 * import between blob write and routine save): live, just not persisted yet,
 * so the walk over stored workouts cannot see them. See `pin.ts`.
 */
export function orphanedHashes(
  stored: readonly string[],
  workouts: readonly Workout[],
  pinned: ReadonlySet<string> = new Set(),
  /** The exercises page's pictures, which no routine references. See `liveHashes`. */
  alsoLive: readonly string[] = [],
): string[] {
  const live = liveHashes(workouts, alsoLive)
  return stored.filter((hash) => !live.has(hash) && !pinned.has(hash))
}
