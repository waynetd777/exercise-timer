import type { CuePoint, Routine, Timeline } from './types'

/** Seconds before the end of a step at which a countdown beep fires. */
export const COUNTDOWN_SECONDS = [3, 2, 1] as const

/** Ordering for cues that land on the same millisecond. */
const KIND_RANK = {
  'workout-complete': 0,
  'work-start': 1,
  'work-end': 1,
  countdown: 2,
} as const

/**
 * Every audio cue for a workout, as absolute offsets from its start.
 *
 * Precomputed so the audio layer can pre-schedule on the Web Audio clock —
 * beeps must not be fired from a JS tick, or a throttled tab cues late.
 *
 * A countdown beep is emitted only if it falls strictly after the step's start,
 * so a 2-second step gets "2, 1" rather than a beep colliding with its own
 * boundary cue.
 */
export function cues(timeline: Timeline): CuePoint[] {
  const out: CuePoint[] = []

  for (const entry of timeline.entries) {
    // Keyed on the step being ENTERED: starting work is a whistle, and anything
    // else means work has just finished, which is a bell.
    out.push({
      atMs: entry.startMs,
      kind: entry.role === 'work' ? 'work-start' : 'work-end',
      entryIndex: entry.index,
    })

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

/**
 * The cues for ONE run, which is what the scheduler arms against.
 *
 * `cues()` describes a whole workout, and handing it a single run made it say
 * three wrong things: the finishing dings landed at the end of every run — after
 * the warm-up, after each 45-second rest — and a gate, whose steps all sit at
 * time zero, emitted one boundary cue per step stacked on the same millisecond.
 *
 * A gate gets ONE cue, at the moment it opens: a whistle to start the set, which
 * is the tap's answer. It has no end of its own to count down to, so there is
 * nothing else to say until the user says it.
 */
export function runCues(routine: Routine, runIndex: number): CuePoint[] {
  const run = routine.runs[runIndex]
  if (!run) return []

  if (run.selfPaced) {
    const first = run.entries[0]
    if (!first) return []
    return [{ atMs: 0, kind: first.role === 'work' ? 'work-start' : 'work-end', entryIndex: 0 }]
  }

  const all = cues(run)
  // The workout finishes once, at the end of the LAST run.
  if (runIndex === routine.runs.length - 1) return all
  return all.filter((cue) => cue.kind !== 'workout-complete')
}

/**
 * Whether the finishing figure has to be fired by hand rather than scheduled.
 *
 * A routine ending on a gate has no final duration to hang it on: it finishes
 * when the user taps, and a tap cannot be queued on the audio clock in advance.
 */
export function finishesOnTap(routine: Routine): boolean {
  return routine.runs.at(-1)?.selfPaced === true
}
