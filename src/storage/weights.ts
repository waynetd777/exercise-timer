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

/**
 * The starting numbers, from two sources, and the better one wins.
 *
 * WHAT WAYNE ACTUALLY LIFTS, where he has said. Four of these are his own
 * numbers off his own machine (2026-08-27), and they replace the looked-up ones
 * outright: the shoulder press estimate was 30kg against a real 10, which is
 * the size of error worth knowing about. A Horizon stack is not a commercial
 * machine and a home cable run is not a gym one, so where the two disagree the
 * machine is right and the table is wrong.
 *
 * THE REST from strengthlevel.com's standards for a 55-year-old man at 88kg,
 * taken at NOVICE and multiplied by 0.70 for a working weight at twelve reps
 * rather than a one-rep max, rounded UP to the nearest 5kg because that is what
 * a stack can do: the pin goes in a hole, and there is no 63kg.
 *
 * The other fifty-five are blank on purpose. 25 of the 41 multi-gym exercises
 * have no equivalent on that site at all, and a guessed weight is worse than an
 * empty field: an empty field asks, and a wrong number gets loaded on.
 */
export const SEED_WEIGHTS: Readonly<Record<string, string>> = {
  // Wayne's own, off the machine.
  'Standing Shoulder Press': '10kg',
  'Seated Abdominal Crunch': '20kg',
  'Seated Leg Extension': '15kg',
  'Hip Abductor Leg Raise': '20kg',

  // Looked up, and still to be checked against the machine.
  'Leg Press': '65kg',
  'Standard Chest Press': '35kg',
  'Lat Pulldown': '35kg',
  'Seated Row': '35kg',
  'Calf Press': '50kg',
  'Free-Standing Hamstring Curl': '35kg',
  'Cable Fly': '35kg',
  'Triceps Press': '20kg',
}

/** What is written down, keyed by folded exercise name. */
export type Weights = Record<string, string>

let cached: Map<string, string> | null = null

function seeded(): Map<string, string> {
  const out = new Map<string, string>()
  for (const [name, load] of Object.entries(SEED_WEIGHTS)) out.set(foldName(name), load)
  return out
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
 * The weights in force: what was typed, over the seeds.
 *
 * A key PRESENT AND EMPTY is a deletion, not a gap. Clearing the Leg Press
 * field has to mean "I do not want a weight on this", or the seed would come
 * straight back and the field could never be emptied.
 *
 * Cached, and dropped on save: every step of every routine asks, and re-parsing
 * storage for each of them is work for nothing.
 */
export function currentWeights(): ReadonlyMap<string, string> {
  if (cached) return cached
  const out = seeded()
  for (const [name, load] of Object.entries(loadWeights())) {
    if (load.trim()) out.set(name, load.trim())
    else out.delete(name)
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
 * Writes one exercise's weight and returns the new store.
 *
 * An empty value is RECORDED rather than removed, so it can override a seed.
 * Setting a value back to exactly the seed drops the key instead, which keeps
 * the store to what actually differs.
 */
export function withWeight(weights: Weights, name: string, load: string): Weights {
  const key = foldName(name)
  const next = { ...weights }
  const seed = seeded().get(key)
  if (load.trim() && load.trim() === seed) delete next[key]
  else next[key] = load.trim()
  return next
}
