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
