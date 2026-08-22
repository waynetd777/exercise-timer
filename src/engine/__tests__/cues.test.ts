import { describe, expect, it } from 'vitest'
import { compile } from '../compile'
import { cues, cuesBetween } from '../cues'
import { rep, seg, step, tabata, workout } from './fixtures'

const BOUNDARY = ['work-start', 'work-end'] as const
const isBoundary = (kind: string) => (BOUNDARY as readonly string[]).includes(kind)

describe('cues', () => {
  it('emits a boundary cue at every step start and one completion cue', () => {
    const timeline = compile(tabata())
    const all = cues(timeline)

    const boundaries = all.filter((c) => isBoundary(c.kind))
    expect(boundaries.map((c) => c.atMs)).toEqual(timeline.entries.map((e) => e.startMs))

    const complete = all.filter((c) => c.kind === 'workout-complete')
    expect(complete).toHaveLength(1)
    expect(complete[0]!.atMs).toBe(timeline.totalMs)
  })

  it('emits 3-2-1 countdown beeps before the end of a long step', () => {
    const timeline = compile(workout('Long', [seg('Work', 20)]))
    const countdown = cues(timeline).filter((c) => c.kind === 'countdown')

    expect(countdown).toEqual([
      { atMs: 17_000, kind: 'countdown', entryIndex: 0, value: 3 },
      { atMs: 18_000, kind: 'countdown', entryIndex: 0, value: 2 },
      { atMs: 19_000, kind: 'countdown', entryIndex: 0, value: 1 },
    ])
  })

  it('drops countdown beeps that would collide with the step start', () => {
    // A 3s step: the "3" beep would land exactly on its start, so only 2 and 1 fire.
    const short = cues(compile(workout('Short', [seg('Blip', 3)])))
    expect(short.filter((c) => c.kind === 'countdown').map((c) => c.value)).toEqual([2, 1])

    // A 1s step gets no countdown at all, just its phase change.
    const blink = cues(compile(workout('Blink', [seg('Blink', 1)])))
    expect(blink.filter((c) => c.kind === 'countdown')).toEqual([])
    expect(blink.map((c) => c.kind)).toEqual(['work-start', 'workout-complete'])
  })

  it('sorts by time, with the completion cue ahead of a coincident boundary', () => {
    const all = cues(compile(tabata()))
    for (let i = 1; i < all.length; i++) {
      expect(all[i]!.atMs).toBeGreaterThanOrEqual(all[i - 1]!.atMs)
    }
  })

  it('returns nothing for an empty timeline', () => {
    expect(cues(compile(workout('Empty', [])))).toEqual([])
  })

  it('attributes every cue to a real step', () => {
    const timeline = compile(workout('Rounds', [rep(3, [seg('Work', 10), seg('Rest', 5, 'rest')])]))
    for (const cue of cues(timeline)) {
      expect(timeline.entries[cue.entryIndex]).toBeDefined()
    }
  })

  it('refuses a routine with gates, whose entry times share no clock', () => {
    // A Routine satisfies Timeline structurally, so this call typechecks, but
    // once it has gates the times it would mix are run-local garbage. The
    // guard is at runtime rather than in the types because a FULLY TIMED
    // routine is legitimately cued whole; the audio scheduler tests do.
    const gated = compile(
      workout('Gated', [seg('Jog', 40), step('Push-ups', 12), seg('Rest', 20, 'rest')]),
    )
    expect(() => cues(gated)).toThrow(/runCues/)

    // One run, one clock: passing it whole stays fine.
    expect(() => cues(compile(tabata()))).not.toThrow()
  })
})

describe('cuesBetween', () => {
  const all = cues(compile(workout('Window', [seg('Work', 20), seg('Rest', 10, 'rest')])))

  it('is half-open, so consecutive windows neither drop nor duplicate a cue', () => {
    const first = cuesBetween(all, 0, 20_000)
    const second = cuesBetween(all, 20_000, 40_000)

    expect([...first, ...second]).toEqual(all)
    expect(first.some((c) => c.atMs === 20_000)).toBe(false)
    expect(second.some((c) => c.atMs === 20_000)).toBe(true)
  })

  it('includes the lower bound and excludes the upper', () => {
    expect(cuesBetween(all, 17_000, 19_000).map((c) => c.atMs)).toEqual([17_000, 18_000])
  })

  it('returns nothing for an empty or inverted window', () => {
    expect(cuesBetween(all, 5_000, 5_000)).toEqual([])
    expect(cuesBetween(all, 9_000, 1_000)).toEqual([])
  })
})

describe('which boundary cue is emitted', () => {
  it('is a whistle entering work and a bell entering anything else', () => {
    // Every boundary is both an end and a start, so what distinguishes them is
    // the step being entered: starting work means play begins.
    const timeline = compile(tabata())
    const boundaries = cues(timeline).filter((c) => isBoundary(c.kind))

    for (const cue of boundaries) {
      const entry = timeline.entries[cue.entryIndex]!
      expect(cue.kind).toBe(entry.role === 'work' ? 'work-start' : 'work-end')
    }
  })

  it('gives a Tabata one whistle per rep and a bell for every rest', () => {
    const all = cues(compile(tabata()))
    // 8 whistles, one into each work step. 8 bells: the prepare plus SEVEN rests,
    // because the eighth rep has no rest after it.
    expect(all.filter((c) => c.kind === 'work-start')).toHaveLength(8)
    expect(all.filter((c) => c.kind === 'work-end')).toHaveLength(8)
  })

  it('treats recover as the end of work, not the start of it', () => {
    const timeline = compile(workout('Recovery', [seg('Work', 20), seg('Breathe', 60, 'recover')]))
    const kinds = cues(timeline)
      .filter((c) => isBoundary(c.kind))
      .map((c) => c.kind)
    expect(kinds).toEqual(['work-start', 'work-end'])
  })
})
