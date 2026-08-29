/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Workout } from '../engine'
import { orphanedHashes } from '../media/gc'
import { draftPinnedHashes } from '../media/pin'
import { loadPictures, pictureHashes } from './pictures'
import { forgetBlob } from '../media/resolveMedia'
import { deleteBlob, storedHashes } from '../media/store'
import { requestPersistence } from './db'
import { markSeeded, seededIds } from './seeded'
import * as lib from './library'
import { addWorkoutIfMissing, deleteWorkout, listWorkouts, putWorkout, readWorkouts, saveWorkout } from './workouts'
import { newId } from '../id'

const now = () => Date.now()

export type Library = {
  workouts: Workout[]
  loading: boolean
  error: string | null
  add: (workout: Workout) => Promise<Workout>
  remove: (id: string) => Promise<void>
  duplicate: (workout: Workout) => Promise<void>
  toggleFavourite: (workout: Workout) => Promise<void>
  markRun: (workout: Workout) => Promise<void>
}

/**
 * The routine library, backed by IndexedDB.
 *
 * Seeds are offered ONCE EACH, tracked by id in `seeded.ts`, not "when the
 * library is empty". That way a newly added seed reaches an existing install,
 * and a seeded routine that gets deleted stays deleted. The pure operations
 * live in `library.ts`; this only wires them to storage and React state.
 */
export function useLibrary(seed: readonly Workout[]): Library {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        void requestPersistence()

        const offered = seededIds()
        const fresh = seed.filter((workout) => !offered.has(workout.id))
        if (fresh.length > 0) {
          // Add-only: a lost marker must never put a pristine seed over an
          // edited copy that is still in the store. See `addWorkoutIfMissing`.
          for (const workout of fresh) await addWorkoutIfMissing(workout, now())
          markSeeded(fresh.map((workout) => workout.id))
        }

        const { workouts: stored, unreadable } = await readWorkouts()
        if (cancelled) return
        setWorkouts(stored)
        if (unreadable > 0) {
          setError(
            unreadable === 1
              ? 'One routine in storage could not be read. It was left in place, and the rest are shown.'
              : `${unreadable} routines in storage could not be read. They were left in place, and the rest are shown.`,
          )
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not open the routine library.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [seed])

  const replace = useCallback((workout: Workout) => {
    setWorkouts((current) => {
      const index = current.findIndex((w) => w.id === workout.id)
      if (index === -1) return [...current, workout]
      const next = [...current]
      next[index] = workout
      return next
    })
  }, [])

  /**
   * Every write goes through here, so a failure is SEEN.
   *
   * The callers fire and forget (`void library.add(...)`), and a rejected save
   * used to be an unhandled promise: the editor went back to the library, the
   * row did not change, and nothing said why. Now the failure lands in `error`,
   * which the library screen shows, and is rethrown with the same words so a
   * caller that does wait (the editor's Save) can keep the draft and say so.
   * A write that succeeds clears it, since the store is evidently working again.
   */
  const guarded = useCallback(<T,>(what: string, work: () => Promise<T>): Promise<T> => {
    return work().then(
      (result) => {
        setError(null)
        return result
      },
      (cause: unknown) => {
        const reason = cause instanceof Error ? cause.message : String(cause)
        const message = `Could not ${what}: ${reason}`
        setError(message)
        throw new Error(message, { cause })
      },
    )
  }, [])

  const add = useCallback(
    (workout: Workout) =>
      guarded(`save “${workout.name}”`, async () => {
        const saved = await saveWorkout(workout, now())
        replace(saved)
        return saved
      }),
    [guarded, replace],
  )

  const remove = useCallback(
    (id: string) =>
      guarded('delete the routine', async () => {
    await deleteWorkout(id)
    const { workouts: remaining, heldHashes } = await readWorkouts()
    setWorkouts(remaining)

    /*
     * Sweep blobs nothing references any more. Computed against the WHOLE
     * remaining library, because storage is content-addressed: the deleted
     * routine may well have shared images with one that is staying.
     */
    try {
      for (const hash of orphanedHashes(
        await storedHashes(),
        remaining,
        draftPinnedHashes(),
        // Two more roots the walk over `remaining` cannot see: the exercises
        // page holds photos no routine references, and a record this build
        // cannot read is still in the store with photos of its own. Without
        // either, the first delete swept them.
        [...pictureHashes(loadPictures()), ...heldHashes],
      )) {
        await deleteBlob(hash)
        forgetBlob(hash)
      }
    } catch {
      // A failed sweep leaves dead bytes behind, which is harmless, the same
      // sweep runs on the next delete.
    }
      }),
    [guarded],
  )

  const duplicate = useCallback(
    (workout: Workout) =>
      guarded(`copy “${workout.name}”`, async () => {
        // Names from the store, not from state: two quick taps both saw the
        // list before the first copy landed and both became "(copy)".
        const names = (await listWorkouts()).map((w) => w.name)
        const copy = lib.duplicate(workout, names, newId(), now())
        replace(await saveWorkout(copy, now()))
      }),
    [guarded, replace],
  )

  const toggleFavourite = useCallback(
    (workout: Workout) =>
      guarded(`mark “${workout.name}”`, async () => {
        replace(await putWorkout(lib.toggleFavourite(workout)))
      }),
    [guarded, replace],
  )

  const markRun = useCallback(
    (workout: Workout) =>
      guarded('record the run', async () => {
        replace(await putWorkout(lib.markRun(workout, now())))
      }),
    [guarded, replace],
  )

  return { workouts, loading, error, add, remove, duplicate, toggleFavourite, markRun }
}
