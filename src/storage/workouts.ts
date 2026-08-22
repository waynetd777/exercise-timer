import type { Workout } from '../engine'
import { run, STORE_WORKOUTS } from './db'
import { stamp } from './library'
import { migrateWorkout } from './migrate'

export async function listWorkouts(): Promise<Workout[]> {
  const stored = await run<Workout[]>(STORE_WORKOUTS, 'readonly', (store) => store.getAll())
  // Migrated on the way out, not rewritten in place: the fix reaches routines
  // that were never re-saved, and an old export gets it too via `fromBundle`.
  return stored.map(migrateWorkout)
}

export async function saveWorkout(workout: Workout, now: number): Promise<Workout> {
  const stamped = stamp(workout, now)
  await run(STORE_WORKOUTS, 'readwrite', (store) => store.put(stamped))
  return stamped
}

/**
 * Seeding only: writes with `add`, which refuses an id that already exists.
 *
 * The "already offered" marker lives in localStorage while the routines live in
 * IndexedDB, and the two evict independently. A lost marker makes the next
 * launch try to seed again, and a `put` there would lay the pristine seed over
 * the user's edited copy. Losing the marker may re-offer a deleted seed, which
 * is harmless; overwriting an edit is not.
 */
export async function addWorkoutIfMissing(workout: Workout, now: number): Promise<boolean> {
  try {
    await run(STORE_WORKOUTS, 'readwrite', (store) => store.add(stamp(workout, now)))
    return true
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'ConstraintError') return false
    throw cause
  }
}

/** For metadata-only writes (last run, favourite) that must not re-stamp updatedAt. */
export async function putWorkout(workout: Workout): Promise<Workout> {
  await run(STORE_WORKOUTS, 'readwrite', (store) => store.put(workout))
  return workout
}

export async function deleteWorkout(id: string): Promise<void> {
  await run(STORE_WORKOUTS, 'readwrite', (store) => store.delete(id))
}

export async function countWorkouts(): Promise<number> {
  return run<number>(STORE_WORKOUTS, 'readonly', (store) => store.count())
}
