/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * What you lift, per exercise, in one place.
 *
 * The weight used to live in each routine: a step said `65kg` and so did the
 * six other routines naming the same lift, so moving up a plate meant editing
 * all seven. This is the one place it is written down, and a routine that does
 * not state a weight of its own takes it from here every time it is opened.
 *
 * A ROUTINE'S OWN LOAD STILL WINS. A step that says `30kg each side` is saying
 * something this table cannot: that this routine, deliberately, is not your
 * usual weight. Filling only the empty ones keeps that possible, and means
 * nothing already saved changes under you.
 *
 * FREE TEXT, like `Segment.load`, and for the same reason: a band has a colour
 * and a press-up has your own weight. `65kg` is the common case, not the only
 * one.
 *
 * IN `localStorage`, like `paces.ts`. It is small, it is yours, and a weight is
 * a property of your gym rather than of a routine, so it does not belong inside
 * one. It does ride along in a backup, since re-typing sixty-seven of them
 * would be nobody's idea of a restore.
 */

import { foldName } from '../routines/foldName'
import { findLoad } from '../routines/loads'

const KEY = 'davshack-timer-weights'

/*
 * NO SEEDS. Every install starts with every field blank.
 *
 * The table used to ship one person's numbers as a starting point, which made
 * every other install open on weights that were not its owner's. A weight is a
 * measurement of one gym and one body; a wrong one gets loaded onto a stack.
 * An empty field asks the question, and "Fill from my routines" answers it
 * from evidence the device actually holds.
 */

/** What is written down, keyed by folded exercise name. */
export type Weights = Record<string, string>

let cached: Map<string, string> | null = null

/*
 * Another tab saving drops this tab's cache. Without it two open tabs each kept
 * their own copy, and the second to save wrote stale values over the first's.
 * `storage` fires only in OTHER tabs, which is exactly the set that needs it.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) cached = null
  })
}

/** Only what has been typed. Never throws: a broken store means no weights. */
export function loadWeights(): Weights {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Weights = {}
    for (const [name, load] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof load === 'string') out[name] = load
    }
    return out
  } catch {
    return {}
  }
}

export function saveWeights(weights: Weights): void {
  cached = null
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(weights))
  } catch {
    // Storage turned off, or a private window. Routines fall back to whatever
    // weight they carry themselves, which is where they were before this.
  }
}

/**
 * The weights in force: what was typed, and nothing else.
 *
 * An empty value is skipped. Older stores recorded a cleared field as an empty
 * string, to override a seed that no longer exists; those entries are harmless
 * and mean the same thing as absence.
 *
 * Cached, and dropped on save: every step of every routine asks, and re-parsing
 * storage for each of them is work for nothing.
 */
export function currentWeights(): ReadonlyMap<string, string> {
  if (cached) return cached
  const out = new Map<string, string>()
  for (const [name, load] of Object.entries(loadWeights())) {
    if (load.trim()) out.set(name, load.trim())
  }
  cached = out
  return out
}

/**
 * One exercise's weight, by its written name. Empty string where there is none.
 *
 * Through `findLoad`, which is the same lookup a running routine uses: it sees
 * through an announcement's wording and through the shorthand a routine is
 * written in. Anything else and the editor's hint would promise a weight the
 * run does not use, or stay blank while the run finds one.
 */
export function weightFor(name: string): string {
  return findLoad(currentWeights(), name) ?? ''
}

/**
 * Writes one exercise's weight and returns the new store. An empty value
 * removes the key, so the store holds only what has a number.
 */
export function withWeight(weights: Weights, name: string, load: string): Weights {
  const key = foldName(name)
  const next = { ...weights }
  if (load.trim()) next[key] = load.trim()
  else delete next[key]
  return next
}
