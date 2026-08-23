/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { CuePoint } from '../engine'
import { cuesBetween } from '../engine'

/** How far ahead cues are queued on the audio clock. */
export const LOOKAHEAD_MS = 30_000

/** Re-arm well inside the window so a throttled timer cannot open a gap. */
export const REARM_MS = LOOKAHEAD_MS / 3

/**
 * How close to sounding a cue has to be for cancellation to spare it.
 *
 * Shared with the engine, because cancelling and re-arming have to agree on the
 * same line: a cue the engine keeps must not be queued a second time, and a cue
 * the engine drops must not be forgotten by the arm that follows.
 */
export const CANCEL_GRACE_MS = 150

/**
 * Identifies a cue for deduplication. Kind plus moment is unique: two cues of
 * the same kind never share a millisecond.
 */
export function cueKey(cue: CuePoint): string {
  return `${cue.kind}@${cue.atMs}`
}

/**
 * The cues an arm should queue: everything inside the lookahead window that has
 * not been queued already.
 *
 * Extracted from the hook so the rolling window can be simulated end to end:
 * every cue of a real routine scheduled exactly once, none missed, none twice.
 */
export function dueCues(
  all: readonly CuePoint[],
  elapsedMs: number,
  scheduled: ReadonlySet<string>,
): CuePoint[] {
  return cuesBetween([...all], elapsedMs, elapsedMs + LOOKAHEAD_MS).filter(
    (cue) => !scheduled.has(cueKey(cue)),
  )
}

/**
 * The keys to forget after a cancellation, so the next arm queues those cues
 * again. Used when the SOUND of a queued cue has changed under it, which is what
 * happens when a recording finishes decoding mid-window.
 *
 * Not simply all of them: `cancelPending` spares a cue that has begun or is about
 * to, and forgetting a spared cue would play it twice.
 */
export function requeueable(
  all: readonly CuePoint[],
  elapsedMs: number,
  scheduled: ReadonlySet<string>,
): string[] {
  return all
    .filter((cue) => cue.atMs > elapsedMs + CANCEL_GRACE_MS)
    .map(cueKey)
    .filter((key) => scheduled.has(key))
}
