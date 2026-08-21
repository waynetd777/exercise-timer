import { describe, expect, it } from 'vitest'
import type { CuePoint } from '../../engine'
import { compile, cues } from '../../engine'
import { IMPORTED_ROUTINES, MIXED_CARDIO_2 } from '../../routines/__tests__/fixtures'
import { cueKey, dueCues, LOOKAHEAD_MS, REARM_MS } from '../schedule'
import { toneFor } from '../tones'

/**
 * Replays a whole routine through the rolling window, exactly as the scheduler
 * does: arm at the start, then every REARM_MS of run time.
 */
function replay(all: CuePoint[], totalMs: number, step = REARM_MS): CuePoint[] {
  const scheduled = new Set<string>()
  const played: CuePoint[] = []

  for (let elapsed = 0; elapsed <= totalMs + step; elapsed += step) {
    for (const cue of dueCues(all, elapsed, scheduled)) {
      scheduled.add(cueKey(cue))
      played.push(cue)
    }
  }
  return played
}

describe('the rolling window covers a whole routine', () => {
  it.each(IMPORTED_ROUTINES.map((r) => [r.name, r] as const))(
    'schedules every cue of %s exactly once',
    (_name, routine) => {
      const timeline = compile(routine)
      const all = cues(timeline)
      const played = replay(all, timeline.totalMs)

      expect(played).toHaveLength(all.length)
      expect(new Set(played.map(cueKey)).size).toBe(all.length)
      // And in order, so nothing is queued against a stale offset.
      expect(played.map((c) => c.atMs)).toEqual(all.map((c) => c.atMs))
    },
  )

  it('misses nothing even if a re-arm is late — a throttled tab', () => {
    const timeline = compile(MIXED_CARDIO_2)
    const all = cues(timeline)
    // Arming at the very edge of the window is the worst legitimate case.
    const played = replay(all, timeline.totalMs, LOOKAHEAD_MS)
    expect(played).toHaveLength(all.length)
  })

  it('never double-schedules when armed far more often than needed', () => {
    const timeline = compile(MIXED_CARDIO_2)
    const all = cues(timeline)
    const played = replay(all, timeline.totalMs, 1_000)
    expect(played).toHaveLength(all.length)
  })

  it('has a tone for every cue a real routine produces', () => {
    // A cue with no tone would be silence where a sound belongs.
    for (const routine of IMPORTED_ROUTINES) {
      for (const cue of cues(compile(routine))) {
        expect(toneFor(cue.kind), `${cue.kind} has no tone`).not.toBeNull()
      }
    }
  })
})

describe('cue timing across a real routine', () => {
  const timeline = compile(MIXED_CARDIO_2)
  const all = cues(timeline)

  it('puts a boundary cue at every step boundary and nowhere else', () => {
    const boundaries = all
      .filter((c) => c.kind === 'work-start' || c.kind === 'work-end')
      .map((c) => c.atMs)
    expect(boundaries).toEqual(timeline.entries.map((e) => e.startMs))
  })

  it('ends with exactly one completion cue, at the end', () => {
    const complete = all.filter((c) => c.kind === 'workout-complete')
    expect(complete).toHaveLength(1)
    expect(complete[0]!.atMs).toBe(timeline.totalMs)
    expect(Math.max(...all.map((c) => c.atMs))).toBe(timeline.totalMs)
  })

  it('never places two cues on the same millisecond', () => {
    // The dedup key is kind plus moment, and the scheduler queues each once.
    expect(new Set(all.map(cueKey)).size).toBe(all.length)
  })

  it('leaves at least a second between a countdown beep and the next cue', () => {
    const sorted = [...all].sort((a, b) => a.atMs - b.atMs)
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.atMs - sorted[i - 1]!.atMs
      expect(gap, `${sorted[i - 1]!.kind} -> ${sorted[i]!.kind}`).toBeGreaterThanOrEqual(1000)
    }
  })

  it('gives every boundary sound room to finish before the next cue', () => {
    // The bell rings for 2050ms and the whistle for 620ms. On these routines the
    // shortest step is 10s, so either finishes well before the next countdown.
    const longest = Math.max(
      ...(['work-start', 'work-end'] as const).flatMap((kind) =>
        toneFor(kind)!.notes.map((note) => note.atMs + note.durationMs),
      ),
    )
    const shortest = Math.min(...timeline.entries.map((e) => e.durationMs ?? Infinity))
    expect(shortest).toBeGreaterThan(longest)
  })

  it('does not let the completion figure run past the end of the audio', () => {
    const figure = toneFor('workout-complete')!.notes
    const ends = Math.max(...figure.map((n) => n.atMs + n.durationMs))
    // Nothing follows it, so it only has to be a sane length.
    expect(ends).toBeLessThan(5000)
  })
})
