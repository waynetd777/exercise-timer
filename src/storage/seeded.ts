/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

const KEY = 'exercise-timer:seeded'

/**
 * Ids of seed routines that have already been offered.
 *
 * Tracked separately from the routines themselves so that seeding is
 * "once, ever" rather than "whenever the library is empty": adding a new seed
 * reaches an existing install, and deleting a seeded routine makes it stay
 * deleted instead of reappearing on the next load.
 */
export function seededIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markSeeded(ids: readonly string[]): void {
  try {
    const all = seededIds()
    for (const id of ids) all.add(id)
    localStorage.setItem(KEY, JSON.stringify([...all]))
  } catch {
    // Blocked storage: seeds may be re-offered, which is harmless.
  }
}
