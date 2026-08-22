/**
 * The run clock, as pure data plus transitions.
 *
 * Elapsed time is always DERIVED from a monotonic timestamp and nothing
 * accumulates ticks, so a throttled, backgrounded or sleeping tab cannot cause
 * drift. Extracted from the React hook because this arithmetic is the most
 * bug-prone part of the app and deserves tests that need no DOM.
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
