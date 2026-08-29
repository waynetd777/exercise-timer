/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Re-keys a table written under an older `foldName`.
 *
 * The three per-device tables (weights, paces, pictures) are keyed by the folded
 * exercise name, and the fold changed once: "press" used to lose its last letter
 * as if it were a plural, so "Leg Press" was stored under `leg pres` and is now
 * looked up under `leg press`. Nothing rewrote the stored keys, so every weight
 * and every measured pace for a press exercise went dead, and the exercises page
 * showed the old weight only through the fuzzy match and could not clear it.
 *
 * The fold is not reversible in general, so this does not fold the key again
 * (folding `leg pres` would give `leg pre`). It asks a narrower question: is
 * this word one letter short of a double-s word the exercise table uses? `pres`
 * is, `abs` is not. Where the old key and the new key both exist the new one
 * wins, since the newer build wrote it.
 */

import { EXERCISES } from '../routines/exercises'
import { foldName } from '../routines/foldName'

let doubleS: Set<string> | null = null

/** Every folded word of the table that ends in a double s: "press", "cross". */
function doubleSWords(): Set<string> {
  if (doubleS) return doubleS
  doubleS = new Set()
  for (const exercise of EXERCISES) {
    for (const word of foldName(exercise.name).split(' ')) {
      if (word.endsWith('ss')) doubleS.add(word)
    }
  }
  return doubleS
}

/** The key as the current fold writes it, or the key itself where it already is. */
export function refoldKey(key: string): string {
  const words = doubleSWords()
  return key
    .split(' ')
    .map((word) => (!word.endsWith('ss') && words.has(`${word}s`) ? `${word}s` : word))
    .join(' ')
}

/**
 * The table with every stale key moved to its current spelling, and whether
 * anything moved, so the caller can write it back once.
 */
export function refoldKeys<T>(table: Record<string, T>): { table: Record<string, T>; changed: boolean } {
  const out: Record<string, T> = {}
  let changed = false
  // Current keys first, so an entry the new build has already written is never
  // covered by the stale one sitting beside it.
  for (const [key, value] of Object.entries(table)) {
    if (refoldKey(key) === key) out[key] = value
  }
  for (const [key, value] of Object.entries(table)) {
    const next = refoldKey(key)
    if (next === key) continue
    changed = true
    if (!(next in out)) out[next] = value
  }
  return { table: out, changed }
}
