/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Position, Timeline, TimelineEntry } from './types'

const COMPLETE_INDEX_OFFSET = 0

/**
 * Index of the last entry starting at or before `t`.
 * Assumes `entries` is ordered by `startMs`, which `compile()` guarantees.
 */
function lastIndexAtOrBefore(entries: TimelineEntry[], t: number): number {
  let lo = 0
  let hi = entries.length - 1
  let answer = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    // Safe: mid is always within [0, entries.length - 1].
    if (entries[mid]!.startMs <= t) {
      answer = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return answer
}

function completed(timeline: Timeline): Position {
  return {
    entry: null,
    nextEntry: null,
    index: timeline.entries.length + COMPLETE_INDEX_OFFSET,
    elapsedInEntryMs: 0,
    remainingMs: 0,
    totalElapsedMs: timeline.totalMs,
    totalRemainingMs: 0,
    isComplete: true,
  }
}

/**
 * Locates a moment in a compiled timeline. Pure: the caller owns the clock.
 *
 * Boundary semantics: each entry owns `[startMs, endMs)`, so at exactly
 * `entry.startMs` you are at the top of that entry with `remainingMs` equal to
 * its full duration, and at exactly `timeline.totalMs` the workout is complete.
 * Negative and non-finite input clamps to 0.
 */
export function position(timeline: Timeline, elapsedMs: number): Position {
  const { entries, totalMs } = timeline
  if (entries.length === 0) return completed(timeline)

  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  if (elapsed >= totalMs) return completed(timeline)

  const index = lastIndexAtOrBefore(entries, elapsed)
  // Safe: entries is non-empty and lastIndexAtOrBefore returns a valid index.
  const entry = entries[index]!

  return {
    entry,
    nextEntry: entries[index + 1] ?? null,
    index,
    elapsedInEntryMs: elapsed - entry.startMs,
    remainingMs: entry.endMs - elapsed,
    totalElapsedMs: elapsed,
    totalRemainingMs: totalMs - elapsed,
    isComplete: false,
  }
}

/**
 * Elapsed time at the top of a given step, clamped into range. Feed the result
 * back as the run's elapsed offset to seek.
 */
export function elapsedAtStepStart(timeline: Timeline, index: number): number {
  const { entries, totalMs } = timeline
  if (entries.length === 0) return 0
  if (index <= 0) return 0
  if (index >= entries.length) return totalMs
  return entries[index]!.startMs
}

/** Skip to the top of the next step, or to the end if already on the last one. */
export function skipForward(timeline: Timeline, elapsedMs: number): number {
  const current = position(timeline, elapsedMs)
  if (current.isComplete) return timeline.totalMs
  return elapsedAtStepStart(timeline, current.index + 1)
}

/**
 * Music-player convention: restart the current step, unless you are only just
 * into it, then go back to the previous step.
 */
export function skipBack(timeline: Timeline, elapsedMs: number, restartThresholdMs = 1500): number {
  const current = position(timeline, elapsedMs)
  if (current.isComplete) return elapsedAtStepStart(timeline, timeline.entries.length - 1)
  if (current.elapsedInEntryMs > restartThresholdMs) return elapsedAtStepStart(timeline, current.index)
  return elapsedAtStepStart(timeline, current.index - 1)
}
