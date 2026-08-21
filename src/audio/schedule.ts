import type { CuePoint } from '../engine'
import { cuesBetween } from '../engine'

/** How far ahead cues are queued on the audio clock. */
export const LOOKAHEAD_MS = 30_000

/** Re-arm well inside the window so a throttled timer cannot open a gap. */
export const REARM_MS = LOOKAHEAD_MS / 3

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
 * Extracted from the hook so the rolling window can be simulated end to end —
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
