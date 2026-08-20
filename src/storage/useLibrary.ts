import { useCallback, useEffect, useState } from 'react'
import type { Workout } from '../engine'
import { requestPersistence } from './db'
import { markSeeded, seededIds } from './seeded'
import * as lib from './library'
import { deleteWorkout, listWorkouts, putWorkout, saveWorkout } from './workouts'

const newId = () => crypto.randomUUID()
const now = () => Date.now()

export type Library = {
  workouts: Workout[]
  loading: boolean
  error: string | null
  add: (workout: Workout) => Promise<Workout>
  remove: (id: string) => Promise<void>
  duplicate: (workout: Workout) => Promise<void>
  rename: (workout: Workout, name: string) => Promise<void>
  toggleFavourite: (workout: Workout) => Promise<void>
  markRun: (workout: Workout) => Promise<void>
}

/**
 * The routine library, backed by IndexedDB.
 *
 * Seeds are offered ONCE EACH, tracked by id in `seeded.ts` — not "when the
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
          for (const workout of fresh) await saveWorkout(workout, now())
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
    setWorkouts((current) => current.filter((w) => w.id !== id))
    // Phase 4: once images are stored locally, orphaned blobs get swept here.
  }, [])

  const duplicate = useCallback(
    async (workout: Workout) => {
      const names = workouts.map((w) => w.name)
      const copy = lib.duplicate(workout, names, newId(), now())
      replace(await saveWorkout(copy, now()))
    },
    [workouts, replace],
  )

  const rename = useCallback(
    async (workout: Workout, name: string) => {
      const renamed = lib.rename(workout, name, now())
      if (renamed === workout) return
      replace(await saveWorkout(renamed, now()))
    },
    [replace],
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

  return { workouts, loading, error, add, remove, duplicate, rename, toggleFavourite, markRun }
}
