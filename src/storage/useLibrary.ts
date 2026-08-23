/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Workout } from '../engine'
import { orphanedHashes } from '../media/gc'
import { draftPinnedHashes } from '../media/pin'
import { forgetBlob } from '../media/resolveMedia'
import { deleteBlob, storedHashes } from '../media/store'
import { requestPersistence } from './db'
import { markSeeded, seededIds } from './seeded'
import * as lib from './library'
import { addWorkoutIfMissing, deleteWorkout, listWorkouts, putWorkout, saveWorkout } from './workouts'
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

        const stored = await listWorkouts()
        if (!cancelled) setWorkouts(stored)
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

  const add = useCallback(
    async (workout: Workout) => {
      const saved = await saveWorkout(workout, now())
      replace(saved)
      return saved
    },
    [replace],
  )

  const remove = useCallback(async (id: string) => {
    await deleteWorkout(id)
    const remaining = await listWorkouts()
    setWorkouts(remaining)

    /*
     * Sweep blobs nothing references any more. Computed against the WHOLE
     * remaining library, because storage is content-addressed: the deleted
     * routine may well have shared images with one that is staying.
     */
    try {
      for (const hash of orphanedHashes(await storedHashes(), remaining, draftPinnedHashes())) {
        await deleteBlob(hash)
        forgetBlob(hash)
      }
    } catch {
      // A failed sweep leaves dead bytes behind, which is harmless, the same
      // sweep runs on the next delete.
    }
  }, [])

  const duplicate = useCallback(
    async (workout: Workout) => {
      const names = workouts.map((w) => w.name)
      const copy = lib.duplicate(workout, names, newId(), now())
      replace(await saveWorkout(copy, now()))
    },
    [workouts, replace],
  )

  const toggleFavourite = useCallback(
    async (workout: Workout) => {
      replace(await putWorkout(lib.toggleFavourite(workout, now())))
    },
    [replace],
  )

  const markRun = useCallback(
    async (workout: Workout) => {
      replace(await putWorkout(lib.markRun(workout, now())))
    },
    [replace],
  )

  return { workouts, loading, error, add, remove, duplicate, toggleFavourite, markRun }
}
