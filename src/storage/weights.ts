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
 * The starting numbers, nearly all of them Wayne's own.
 *
 * READ OUT OF HIS ROUTINES on 2026-08-28, plus the four he gave directly. His
 * routines are the best evidence there is: they are what he has been loading
 * the machine to, week after week.
 *
 * The looked-up numbers they replaced were BADLY wrong, which is the thing to
 * remember here. strengthlevel.com said 30kg for the shoulder press against a
 * real 10, and 35kg for the hamstring curl against a real 10. A Horizon home
 * stack is not the commercial machine that site measures, and its numbering is
 * not the same numbering. Where the two disagree the machine is right.
 *
 * ONE GUESS LEFT, marked below. Everything else here he has lifted.
 *
 * The other forty-nine are blank on purpose: a guessed weight is worse than an
 * empty field, because an empty field asks and a wrong number gets loaded on.
 */
export const SEED_WEIGHTS: Readonly<Record<string, string>> = {
  // Given directly, 2026-08-27.
  'Standing Shoulder Press': '10kg',
  'Seated Abdominal Crunch': '15kg',
  'Seated Leg Extension': '15kg',

  // Read out of routines 2 and 3.
  'Leg Press': '65kg',
  'Calf Press': '45kg',
  'Lat Pulldown': '30kg',
  'Seated Row': '30kg',
  'Bentover Row': '30kg',
  'Deadlift': '30kg',
  'Side Cable Bends': '30kg',
  'Incline Chest Press': '25kg',
  'Glute Kickback': '20kg',
  'Hip Abductor Leg Raise': '15kg',
  'Abdominal Oblique Crunch': '15kg',
  'Rear Cable Fly': '10kg',
  'Cable Converging Shoulder Press': '10kg',
  'Free-Standing Hamstring Curl': '10kg',
  'Shoulder Press': '10kg',

  /*
   * Inferred: routine 2 says "Chest Press 30kg", which is a name the table does
   * not have. The standard one is what that almost certainly means, and 30
   * matches the shape of every other correction — the looked-up 35 was high.
   */
  'Standard Chest Press': '30kg',

  /*
   * STILL A GUESS. strengthlevel, novice, ×0.70, rounded up to the nearest 5kg
   * because that is where the pin goes. No routine of Wayne's has ever loaded
   * it, so there is nothing better to say — and on this machine's record, it is
   * more likely high than low.
   *
   * The Cable Fly used to sit beside it at a looked-up 35kg and has been taken
   * out rather than corrected: Wayne's own Rear Cable Fly, on the same cable
   * stack, is 10kg. 35 was not a number worth keeping, and an empty field asks
   * the question instead of answering it wrongly.
   */
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
