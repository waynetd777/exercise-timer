/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * How long a rep of each exercise actually takes YOU.
 *
 * `estimate.ts` works a rep-based routine's length out from a rate the
 * instructor's own routines imply: she writes some exercises both ways, so a
 * "30-second Plank" beside a "20 x Plank" says one takes 1.5 seconds. That is a
 * population of one instructor and fourteen exercises.
 *
 * Every self-paced step already measures itself. The runtime parks the clock at
 * a gate and rebases when you tap Next, so the elapsed time is known exactly and
 * was being thrown away. Recorded, the estimate stops being her average and
 * becomes your pace, on your machine, at your rest.
 *
 * IN `localStorage`, deliberately. It is small, it is per-device, and losing it
 * costs nothing: the estimate falls back to the harvested rate. A new IndexedDB
 * store would need a version bump and a migration on every install for a display
 * nicety.
 *
 * WHAT A GATE MEASURES. A group whose `advance` is `'set'` is cleared by ONE
 * tap, so the elapsed covers every exercise in it and the rate is their average.
 * Attributing that average to each is imperfect and self-correcting: an exercise
 * that is genuinely slow appears in slow gates, and over sessions its own median
 * rises. It is not a claim about one rep of one movement on one day.
 */

import type { TimelineEntry } from '../engine/types'
import { foldName } from '../routines/foldName'

const KEY = 'davshack-timer-paces'
/** Samples kept per exercise. Enough to have a median, few enough to keep up. */
const KEEP = 8

/**
 * What a believable rate looks like.
 *
 * The corpus runs from one second a rep to six. Outside `MIN_RATE` and
 * `MAX_RATE` something happened that was not training.
 */
const MIN_RATE = 0.5
const MAX_RATE = 12

/**
 * The floor that throws away a DRY RUN.
 *
 * Tapping Next through a routine to see what is in it produces a gate every few
 * hundred milliseconds, and those samples would drag every rate towards zero and
 * tell you a twelve-rep set takes four seconds. A real set of anything takes
 * longer than this.
 */
const MIN_GATE_MS = 4_000

/** Above this you put the phone down and made tea. Not a rep rate. */
const MAX_GATE_MS = 8 * 60_000

type Paces = Record<string, number[]>

/**
 * The rate a gate implies, and who it belongs to.
 *
 * `null` where the gate says nothing usable: no counted steps in it, or a
 * duration that is not a person exercising. Timed steps inside the gate are
 * EXCLUDED from the reps but their duration is taken off the elapsed, because
 * their length is already known and counting it would slow the rate for the
 * counted ones beside them.
 */
export function sampleFrom(
  elapsedMs: number,
  cleared: readonly TimelineEntry[],
): { names: string[]; secondsPerRep: number } | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_GATE_MS || elapsedMs > MAX_GATE_MS) return null

  let reps = 0
  let timedMs = 0
  const names: string[] = []
  for (const entry of cleared) {
    if (entry.durationMs !== undefined) {
      timedMs += entry.durationMs
      continue
    }
    if (!entry.reps || entry.reps.count <= 0) continue
    reps += entry.reps.count * (entry.reps.perSide ? 2 : 1)
    const key = foldName(entry.name)
    if (key && !names.includes(key)) names.push(key)
  }
  if (reps === 0 || names.length === 0) return null

  const working = elapsedMs - timedMs
  if (working < MIN_GATE_MS) return null

  const secondsPerRep = working / 1000 / reps
  if (secondsPerRep < MIN_RATE || secondsPerRep > MAX_RATE) return null
  return { names, secondsPerRep: Number(secondsPerRep.toFixed(2)) }
}

/** The newest `KEEP` samples, so a rate follows you rather than averaging a year. */
export function withSample(paces: Paces, names: readonly string[], secondsPerRep: number): Paces {
  const next = { ...paces }
  for (const name of names) {
    next[name] = [...(next[name] ?? []), secondsPerRep].slice(-KEEP)
  }
  return next
}

/**
 * The rate to use, per exercise.
 *
 * A MEDIAN, and only once there are three samples: two readings of a movement
 * you have done twice is a mood, not a pace, and the harvested rate is the
 * better answer until then.
 */
export function ratesFrom(paces: Paces): Map<string, number> {
  const rates = new Map<string, number>()
  for (const [name, samples] of Object.entries(paces)) {
    if (samples.length < 3) continue
    const sorted = [...samples].sort((a, b) => a - b)
    rates.set(name, sorted[Math.floor((sorted.length - 1) / 2)]!)
  }
  return rates
}

/** Everything recorded, or nothing. Never throws: this is a nicety, not data. */
export function loadPaces(): Paces {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Paces = {}
    for (const [name, samples] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(samples)) {
        out[name] = samples.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      }
    }
    return out
  } catch {
    return {}
  }
}

export function savePaces(paces: Paces): void {
  cached = null
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(paces))
  } catch {
    // A private window, or storage the browser has turned off. The estimate
    // falls back to the harvested rate and nothing else notices.
  }
}

/** Records one gate, if it says anything. Returns whether it did. */
export function recordGate(elapsedMs: number, cleared: readonly TimelineEntry[]): boolean {
  const found = sampleFrom(elapsedMs, cleared)
  if (!found) return false
  savePaces(withSample(loadPaces(), found.names, found.secondsPerRep))
  return true
}

/**
 * The rates, parsed once.
 *
 * The library asks for these once per row, and re-reading and re-parsing
 * storage for each of twenty rows on every render is work for nothing: the
 * answer only changes when a gate is recorded, and `savePaces` drops the cache
 * when that happens.
 */
let cached: Map<string, number> | null = null

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

export function currentRates(): ReadonlyMap<string, number> {
  cached ??= ratesFrom(loadPaces())
  return cached
}
