/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * The run clock, as pure data plus transitions.
 *
 * Elapsed time is always DERIVED from a monotonic timestamp and nothing
 * accumulates ticks, so a throttled, backgrounded or sleeping tab cannot cause
 * drift. Extracted from the React hook because this arithmetic is the most
 * bug-prone part of the app and deserves tests that need no DOM.
 *
 * One caveat the monotonic clock cannot see: iOS freezes the whole WebContent
 * process while the app is backgrounded, and performance.now() excludes the
 * frozen stretch. The wall clock does not, so `suspendedMs` compares the two
 * against an anchor taken while the page was last known awake, and `credited`
 * folds the missing time back in. The wall clock is only ever trusted for that
 * one-way top-up: setting it backwards or forwards by hand can never rewind a
 * running clock.
 */
export type Clock = {
  /** Monotonic timestamp the run is anchored to. */
  startedAt: number
  /** Time spent paused, excluded from elapsed. */
  pausedTotalMs: number
  /** Timestamp the clock froze at, or null while running. */
  pausedAt: number | null
}

export const IDLE_CLOCK: Clock = { startedAt: 0, pausedTotalMs: 0, pausedAt: 0 }

/** Elapsed run time at `now`. Frozen while paused. */
export function elapsed(clock: Clock, now: number): number {
  const at = clock.pausedAt ?? now
  return Math.max(0, at - clock.startedAt - clock.pausedTotalMs)
}

export function started(now: number): Clock {
  return { startedAt: now, pausedTotalMs: 0, pausedAt: null }
}

export function paused(clock: Clock, now: number): Clock {
  if (clock.pausedAt !== null) return clock
  return { ...clock, pausedAt: now }
}

export function resumed(clock: Clock, now: number): Clock {
  if (clock.pausedAt === null) return clock
  return {
    startedAt: clock.startedAt,
    pausedTotalMs: clock.pausedTotalMs + (now - clock.pausedAt),
    pausedAt: null,
  }
}

/** A wall-clock/monotonic pair captured at the same instant, while awake. */
export type Anchor = {
  wallMs: number
  monoMs: number
}

/**
 * How long the page was suspended since `anchor`: the stretch the wall clock
 * saw but the monotonic clock did not.
 *
 * The tolerance absorbs the ordinary jitter between the two readings and small
 * NTP slews, so only a real suspension is reported. Never negative: a wall
 * clock set backwards means the wall reading is untrustworthy, not that time
 * ran in reverse.
 */
export function suspendedMs(
  anchor: Anchor,
  wallNow: number,
  monoNow: number,
  toleranceMs: number,
): number {
  const missing = wallNow - anchor.wallMs - (monoNow - anchor.monoMs)
  return missing > toleranceMs ? missing : 0
}

/**
 * Credits time the monotonic clock never witnessed, by moving the anchor back.
 *
 * A paused clock is untouched: while paused, elapsed is frozen by design, so
 * suspension is indistinguishable from any other waiting and owes nothing.
 */
export function credited(clock: Clock, ms: number): Clock {
  if (ms <= 0 || clock.pausedAt !== null) return clock
  return { ...clock, startedAt: clock.startedAt - ms }
}

/**
 * Re-anchors the clock so `toElapsed` is the current position.
 *
 * `freeze` must be true unless the run is actively going, or the clock keeps
 * advancing while the UI says paused and the next resume credits a bogus pause.
 */
export function seeked(now: number, toElapsed: number, freeze: boolean): Clock {
  return {
    startedAt: now - toElapsed,
    pausedTotalMs: 0,
    pausedAt: freeze ? now : null,
  }
}
