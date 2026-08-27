/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Workout } from '../engine'
import { stepCount, totalDurationMs } from '../engine'
import { estimate } from '../routines/estimate'

/**
 * Pure library operations: sorting, filtering, naming, stamping.
 *
 * Kept apart from IndexedDB for the same reason the run clock is kept apart
 * from React: this is where the fiddly rules live, and it should be testable
 * without a browser.
 */

export type SortMode = 'recent' | 'name' | 'duration'

/** Denormalised at save time so the list needn't compile every routine to draw a row. */
export function stamp(workout: Workout, now: number): Workout {
  return {
    ...workout,
    updatedAt: now,
    estimatedTotalMs: totalDurationMs(workout),
  }
}

/**
 * What a library row says about a routine.
 *
 * `totalMs` is the TIMED part, denormalised at save time. `estimatedMs` is the
 * self-paced part, which has no length and is worked out from a rate: see
 * `routines/estimate.ts`. A rep-based routine used to show only its rests,
 * which was truthful and useless.
 *
 * The estimate is not denormalised. It walks the tree, which the stored total
 * exists to avoid, but it is a walk of a few hundred nodes over a library of
 * tens and the alternative is a schema field for a display nicety.
 */
export function summary(workout: Workout): {
  totalMs: number
  estimatedMs: number
  rough: boolean
  steps: number
} {
  const guess = estimate(workout.blocks)
  return {
    totalMs: workout.estimatedTotalMs ?? guess.knownMs,
    estimatedMs: guess.estimatedMs,
    rough: guess.rough,
    steps: stepCount(workout),
  }
}

/** Case- and whitespace-insensitive match on the routine name. */
export function filterWorkouts(workouts: Workout[], query: string): Workout[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return workouts
  return workouts.filter((workout) => workout.name.toLowerCase().includes(needle))
}

/**
 * Favourites first, then the chosen order. A routine that has never been run
 * sorts after ones that have, rather than jumping to the top on a 0 timestamp.
 */
export function sortWorkouts(workouts: Workout[], mode: SortMode): Workout[] {
  const byMode = (a: Workout, b: Workout): number => {
    switch (mode) {
      case 'name':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      case 'duration':
        return summary(b).totalMs - summary(a).totalMs
      case 'recent': {
        const aRun = a.lastRunAt ?? 0
        const bRun = b.lastRunAt ?? 0
        if (aRun !== bRun) return bRun - aRun
        return b.updatedAt - a.updatedAt
      }
    }
  }

  return [...workouts].sort((a, b) => {
    const favourites = Number(b.favourite ?? false) - Number(a.favourite ?? false)
    return favourites !== 0 ? favourites : byMode(a, b)
  })
}

/**
 * "Leg day" -> "Leg day (copy)" -> "Leg day (copy 2)".
 * Takes the names already in use so it never collides.
 */
export function copyName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  const base = name.replace(/ \(copy(?: \d+)?\)$/, '')

  let candidate = `${base} (copy)`
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (copy ${n})`
    n += 1
  }
  return candidate
}

export function duplicate(
  workout: Workout,
  taken: readonly string[],
  id: string,
  now: number,
): Workout {
  const copy: Workout = {
    ...workout,
    id,
    name: copyName(workout.name, taken),
    createdAt: now,
    updatedAt: now,
    favourite: false,
  }
  delete copy.lastRunAt
  return stamp(copy, now)
}

export function markRun(workout: Workout, now: number): Workout {
  return { ...workout, lastRunAt: now }
}

export function toggleFavourite(workout: Workout, now: number): Workout {
  return stamp({ ...workout, favourite: !(workout.favourite ?? false) }, now)
}
