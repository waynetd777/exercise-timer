import type { Block, Workout } from '../engine'

/**
 * Which stored blobs are still referenced, and which are orphaned.
 *
 * Content-addressed storage means a blob can be shared by several routines, so
 * deleting a routine must not delete an image another one still points at. This
 * is pure set arithmetic over the whole library — the only safe way to decide.
 */
export function liveHashes(workouts: readonly Workout[]): Set<string> {
  const live = new Set<string>()

  const walk = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      // Any group, not just `repeat` — missing one would orphan live images.
      if (block.kind !== 'segment') {
        walk(block.children)
        continue
      }
      const media = block.media
      if (!media) continue
      if (media.source === 'local') live.add(media.hash)
      // A pinned remote image also owns its blob.
      if (media.source === 'remote' && media.cachedHash) live.add(media.cachedHash)
    }
  }

  for (const workout of workouts) walk(workout.blocks)
  return live
}

/**
 * The UPLOADED photos a set of routines uses, in a stable order.
 *
 * Narrower than `liveHashes` on purpose: that one also counts a pinned copy of a
 * linked image, because the sweep must not delete a cache something still points
 * at. An export wants only what nothing else has — the illustrations that ship
 * with the app need no bytes in the file, and a pinned copy of a link is a cache
 * rather than the original.
 */
export function localHashes(workouts: readonly Workout[]): string[] {
  const found = new Set<string>()

  const walk = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      if (block.kind !== 'segment') {
        walk(block.children)
        continue
      }
      if (block.media?.source === 'local') found.add(block.media.hash)
    }
  }

  for (const workout of workouts) walk(workout.blocks)
  return [...found].sort()
}

/** Stored hashes no routine references any more. */
export function orphanedHashes(
  stored: readonly string[],
  workouts: readonly Workout[],
): string[] {
  const live = liveHashes(workouts)
  return stored.filter((hash) => !live.has(hash))
}
