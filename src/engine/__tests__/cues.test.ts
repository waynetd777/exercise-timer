import { describe, expect, it } from 'vitest'
import { compile } from '../compile'
import { cues, cuesBetween } from '../cues'
import { rep, seg, tabata, workout } from './fixtures'

describe('cues', () => {
  it('emits a phase change at every step start and one completion cue', () => {
    const timeline = compile(tabata())
    const all = cues(timeline)

    const phaseChanges = all.filter((c) => c.kind === 'phase-change')
    expect(phaseChanges.map((c) => c.atMs)).toEqual(timeline.entries.map((e) => e.startMs))

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

    // A 1s step gets no countdown at all — just its phase change.
    const blink = cues(compile(workout('Blink', [seg('Blink', 1)])))
    expect(blink.filter((c) => c.kind === 'countdown')).toEqual([])
    expect(blink.map((c) => c.kind)).toEqual(['phase-change', 'workout-complete'])
  })

  it('sorts by time, with the completion cue ahead of a coincident phase change', () => {
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
