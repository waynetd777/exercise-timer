import type { CuePoint, Timeline } from './types'

/** Seconds before the end of a step at which a countdown beep fires. */
export const COUNTDOWN_SECONDS = [3, 2, 1] as const

/** Ordering for cues that land on the same millisecond. */
const KIND_RANK = { 'workout-complete': 0, 'phase-change': 1, countdown: 2 } as const

/**
 * Every audio cue for a workout, as absolute offsets from its start.
 *
 * Precomputed so the audio layer can pre-schedule on the Web Audio clock —
 * beeps must not be fired from a JS tick, or a throttled tab cues late.
 *
 * A countdown beep is emitted only if it falls strictly after the step's start,
 * so a 2-second step gets "2, 1" rather than a beep colliding with its own
 * phase-change cue.
 */
export function cues(timeline: Timeline): CuePoint[] {
  const out: CuePoint[] = []

  for (const entry of timeline.entries) {
    out.push({ atMs: entry.startMs, kind: 'phase-change', entryIndex: entry.index })

    for (const seconds of COUNTDOWN_SECONDS) {
      const atMs = entry.endMs - seconds * 1000
      if (atMs > entry.startMs) {
        out.push({ atMs, kind: 'countdown', entryIndex: entry.index, value: seconds })
      }
    }
  }

  if (timeline.entries.length > 0) {
    out.push({
      atMs: timeline.totalMs,
      kind: 'workout-complete',
      entryIndex: timeline.entries.length - 1,
    })
  }

  out.sort((a, b) => a.atMs - b.atMs || KIND_RANK[a.kind] - KIND_RANK[b.kind])
  return out
}

/**
 * Cues in the half-open window `[fromMs, toMs)` — the rolling lookahead the
 * audio scheduler arms on each pass. Half-open so consecutive windows neither
 * drop nor double-fire a cue.
 */
export function cuesBetween(all: CuePoint[], fromMs: number, toMs: number): CuePoint[] {
  if (!(toMs > fromMs)) return []
  return all.filter((cue) => cue.atMs >= fromMs && cue.atMs < toMs)
}
