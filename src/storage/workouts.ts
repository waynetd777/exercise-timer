/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Workout } from '../engine'
import { run, STORE_WORKOUTS } from './db'
import { stamp } from './library'
import { migrateWorkout } from './migrate'

/**
 * Every routine the store holds that this build can read, and a count of the
 * ones it cannot.
 *
 * Checked and migrated ONE AT A TIME. A record with no block list, or a group
 * with no children (a development build's write, a newer shape after a
 * rollback, a corrupted row), used to throw out of the map and take the whole
 * library down with it; and since deleting needs the list, there was no way
 * back short of clearing site data. Such a record is now skipped, counted so
 * the library can say so, and left in place for a build that can read it.
 */
export async function readWorkouts(): Promise<{ workouts: Workout[]; unreadable: number }> {
  const stored = await run<unknown[]>(STORE_WORKOUTS, 'readonly', (store) => store.getAll())
  const workouts: Workout[] = []
  let unreadable = 0
  for (const record of stored) {
    const candidate = record as Partial<Workout> | null
    if (typeof candidate !== 'object' || candidate === null || !Array.isArray(candidate.blocks)) {
      unreadable += 1
      continue
    }
    try {
      // Migrated on the way out, not rewritten in place: the fix reaches
      // routines that were never re-saved, and an old export gets it too via
      // `fromBundle`.
      workouts.push(migrateWorkout(candidate as Workout))
    } catch {
      unreadable += 1
    }
  }
  return { workouts, unreadable }
}

export async function listWorkouts(): Promise<Workout[]> {
  return (await readWorkouts()).workouts
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

