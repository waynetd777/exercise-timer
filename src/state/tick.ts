import { locate, runIsOver } from '../engine'
import type { Cursor, Routine } from '../engine'

/**
 * What one tick of the run clock should do.
 *
 * Pulled out of `useTimer` because this is the arithmetic that has to be right:
 * it decides when a run has expired, how far to jump when the tab has been
 * asleep, and when the display next changes. All three are pure functions of
 * (routine, cursor) and deserve tests that need no DOM — the same reason
 * `clock.ts` is not inside the hook either.
 */
export type Tick =
  /** Same run, same clock. Come back in `nextChangeInMs`. */
  | { kind: 'stay'; cursor: Cursor; nextChangeInMs: number }
  /** Crossed into another run. The caller must re-anchor the clock to it. */
  | { kind: 'move'; cursor: Cursor }
  | { kind: 'complete'; cursor: Cursor }

/** Never busier than 60fps, however the arithmetic lands. */
const MIN_DELAY_MS = 16

export function tick(routine: Routine, runIndex: number, elapsedInRunMs: number): Tick {
  let cursor: Cursor = { runIndex, elapsedInRunMs }

  /*
   * Crossing a gate is DERIVED, not walked.
   *
   * A tab that slept for ten minutes lands on the step after the run that
   * expired, rather than taking one step per tick until it catches up. The loop
   * is defensive: a timed run is always followed by a gate, and a gate never
   * expires on its own, so it can only ever run once.
   */
  if (runIsOver(routine, cursor)) {
    while (runIsOver(routine, cursor)) {
      cursor = { runIndex: cursor.runIndex + 1, elapsedInRunMs: 0 }
    }
    return locate(routine, cursor).isComplete ? { kind: 'complete', cursor } : { kind: 'move', cursor }
  }

  const at = locate(routine, cursor)
  if (at.isComplete) return { kind: 'complete', cursor }

  /*
   * Wake for the instant the DISPLAY changes, not on an interval. A timed step
   * changes when its next whole second is reached; a self-paced one counts up,
   * so it changes on the whole second too — but it has no end to stop at.
   */
  const nextChangeAt =
    at.remainingMs === null
      ? Math.floor(elapsedInRunMs / 1000) * 1000 + 1000
      : at.entry!.endMs - (Math.ceil(at.remainingMs / 1000) - 1) * 1000

  return {
    kind: 'stay',
    cursor,
    nextChangeInMs: Math.max(MIN_DELAY_MS, nextChangeAt - elapsedInRunMs),
  }
}
