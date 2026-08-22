import { describe, expect, it } from 'vitest'
import type { CuePoint } from '../../engine'
import { compile, cues, finishesOnTap, runCues } from '../../engine'
import { IMPORTED_ROUTINES, MIXED_CARDIO_2 } from '../../routines/__tests__/fixtures'
import { rep, seg, step, workout } from '../../engine/__tests__/fixtures'
import { CANCEL_GRACE_MS, cueKey, dueCues, LOOKAHEAD_MS, REARM_MS, requeueable } from '../schedule'
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

  it('misses nothing even if a re-arm is late: a throttled tab', () => {
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

describe('runCues: one run at a time', () => {
  /** Warm-up (2 timed), a rep gate, a rest, then a closing rep gate. */
  const mixed = () =>
    compile(
      workout('Mixed', [
        seg('Jog', 40),
        seg('Jacks', 40),
        rep(2, [step('Curls', 12), step('Press', 10), seg('Rest', 45, 'rest')], 'Round'),
      ]),
    )

  it('gives a gate ONE cue, not one per step stacked on the same millisecond', () => {
    const routine = mixed()
    const gate = routine.runs.findIndex((run) => run.selfPaced)

    expect(runCues(routine, gate)).toEqual([
      { atMs: 0, kind: 'work-start', entryIndex: 0 },
    ])
  })

  it('does not finish the workout at the end of every run', () => {
    const routine = mixed()
    const notLast = routine.runs.slice(0, -1)

    for (const run of notLast) {
      expect(runCues(routine, run.index).map((cue) => cue.kind)).not.toContain('workout-complete')
    }
  })

  it('finishes at the end of the last run when that run is timed', () => {
    const routine = compile(workout('Timed end', [step('Curls', 12), seg('Plank', 30)]))
    const last = routine.runs.length - 1

    expect(runCues(routine, last).map((cue) => cue.kind)).toContain('workout-complete')
    expect(finishesOnTap(routine)).toBe(false)
  })

  it('leaves the finish to be fired by hand when the routine ends on a tap', () => {
    const routine = mixed()
    const last = routine.runs.length - 1

    expect(routine.runs[last]!.selfPaced).toBe(true)
    expect(runCues(routine, last).map((cue) => cue.kind)).not.toContain('workout-complete')
    expect(finishesOnTap(routine)).toBe(true)
  })

  it('still counts a timed run down and rings its boundary', () => {
    const routine = mixed()
    const rest = routine.runs.find((run) => run.entries[0]?.name === 'Rest')!

    expect(runCues(routine, rest.index).map((cue) => `${cue.kind}@${cue.atMs}`)).toEqual([
      'work-end@0',
      'countdown@42000',
      'countdown@43000',
      'countdown@44000',
    ])
  })

  it('is empty for a run that does not exist', () => {
    expect(runCues(mixed(), 99)).toEqual([])
  })
})

describe('a recording that lands after its cue was queued', () => {
  /** What a pasted routine opens with: five seconds to get ready, then work. */
  const getReady = () =>
    compile(workout('Pasted', [seg('Get ready', 5, 'prepare'), seg('Jog', 40)]))

  const armed = (all: CuePoint[], elapsed = 0) =>
    new Set(dueCues(all, elapsed, new Set<string>()).map(cueKey))

  it('queues the first whistle before any decode could finish', () => {
    // The whole bug in one line: 5s is deep inside a 30s window armed at zero,
    // in the same tick as the fetch and decode start.
    expect([...armed(cues(getReady()))]).toContain('work-start@5000')
  })

  it('forgets it, so the arm that follows queues it again with the recording', () => {
    const all = cues(getReady())
    const scheduled = armed(all)

    const stale = requeueable(all, 200, scheduled)
    expect(stale).toContain('work-start@5000')

    for (const key of stale) scheduled.delete(key)
    expect(dueCues(all, 200, scheduled).map(cueKey)).toContain('work-start@5000')
  })

  it('spares a cue that is already sounding, which would otherwise play twice', () => {
    // Cancellation keeps anything within the grace, so the re-arm must not
    // forget it. The pair have to draw the line in the same place.
    const all = cues(getReady())
    const scheduled = armed(all)

    expect(requeueable(all, 5000, scheduled)).not.toContain('work-start@5000')
    expect(requeueable(all, 5000 - CANCEL_GRACE_MS, scheduled)).not.toContain('work-start@5000')
    expect(requeueable(all, 5000 - CANCEL_GRACE_MS - 1, scheduled)).toContain('work-start@5000')
  })

  it('never returns a cue that was not queued in the first place', () => {
    const all = cues(getReady())
    expect(requeueable(all, 0, new Set())).toEqual([])
  })

  it('still queues every cue of the routine, and only the requeued ones twice', () => {
    const timeline = getReady()
    const all = cues(timeline)
    const scheduled = new Set<string>()
    const queued: string[] = []

    const arm = (elapsed: number) => {
      for (const cue of dueCues(all, elapsed, scheduled)) {
        scheduled.add(cueKey(cue))
        queued.push(cueKey(cue))
      }
    }

    arm(0)
    // 200ms in, the whistle decodes: cancel, forget what was cancelled, re-arm.
    const requeued = requeueable(all, 200, scheduled)
    for (const key of requeued) scheduled.delete(key)
    arm(200)
    for (let elapsed = REARM_MS; elapsed <= timeline.totalMs + REARM_MS; elapsed += REARM_MS) {
      arm(elapsed)
    }

    expect(new Set(queued).size).toBe(all.length)
    expect(queued.filter((key, i) => queued.indexOf(key) !== i)).toEqual(requeued)
  })
})
