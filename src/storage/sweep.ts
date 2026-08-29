/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Workout } from '../engine'
import { orphanedHashes } from '../media/gc'
import { draftPinnedHashes } from '../media/pin'
import { forgetBlob } from '../media/resolveMedia'
import { deleteBlob, storedHashes } from '../media/store'
import type { Pictures } from './pictures'
import { pictureHashes } from './pictures'
import { readWorkouts } from './workouts'

/**
 * Deletes every stored photo nothing refers to any more.
 *
 * Computed against the WHOLE library, because storage is content-addressed: the
 * routine just deleted may well share a photo with one that is staying. Three
 * roots besides the readable routines: a draft's pins, the exercises page's own
 * pictures (which no step references), and the photos of any record this build
 * cannot read, which is still in the store and must keep them.
 *
 * Run after a routine is deleted and after a picture is removed or replaced on
 * the exercises page. Before the second, a photo taken off that page sat in
 * IndexedDB until some unrelated delete happened to sweep it.
 */
export async function sweepOrphans(
  pictures: Pictures,
  /** The library as just read, where the caller has it; read here otherwise. */
  store?: { workouts: readonly Workout[]; heldHashes: readonly string[] },
): Promise<void> {
  const { workouts, heldHashes } = store ?? (await readWorkouts())
  const orphans = orphanedHashes(await storedHashes(), workouts, draftPinnedHashes(), [
    ...pictureHashes(pictures),
    ...heldHashes,
  ])
  for (const hash of orphans) {
    await deleteBlob(hash)
    forgetBlob(hash)
  }
}
