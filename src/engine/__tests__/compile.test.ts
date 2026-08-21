import { describe, expect, it } from 'vitest'
import { compile, MAX_TIMELINE_ENTRIES, stepCount, TimelineTooLargeError, totalDurationMs } from '../compile'
import { CABLE_FLY, circuit, nested, rep, seg, tabata, workout } from './fixtures'

describe('compile', () => {
  it('expands classic Tabata into 16 steps of the right shape', () => {
    const timeline = compile(tabata())

    // 8 works and 7 rests, plus the prepare: the eighth rep has no rest after it.
    expect(timeline.entries).toHaveLength(1 + 8 + 7)
    expect(timeline.totalMs).toBe((10 + 8 * 20 + 7 * 10) * 1000)

    expect(timeline.entries[0]).toMatchObject({
      name: 'Get ready',
      role: 'prepare',
      startMs: 0,
      endMs: 10_000,
      path: [],
    })
    expect(timeline.entries[1]).toMatchObject({ name: 'Work', startMs: 10_000, endMs: 30_000 })
    expect(timeline.entries[2]).toMatchObject({ name: 'Rest', startMs: 30_000, endMs: 40_000 })
  })

  it('produces contiguous, gap-free intervals with sequential indices', () => {
    const timeline = compile(circuit())

    let expectedStart = 0
    timeline.entries.forEach((entry, i) => {
      expect(entry.index).toBe(i)
      expect(entry.startMs).toBe(expectedStart)
      expect(entry.endMs).toBe(entry.startMs + entry.durationMs!)
      expectedStart = entry.endMs
    })
    expect(expectedStart).toBe(timeline.totalMs)
  })

  it('records the repeat path so the UI can render "Reps 3 of 8"', () => {
    const timeline = compile(tabata())

    // Third round's work step: index 1 + (3 - 1) * 2 = 5
    expect(timeline.entries[5]!.path).toEqual([
      { kind: 'repeat', id: expect.any(String), label: 'Reps', iteration: 3, of: 8 },
    ])
  })

  it('nests paths outermost-first', () => {
    const timeline = compile(nested())

    // Set 2 -> Reps 1 -> Work. Set 1 is 3 works + 2 rests + 30 = 55s, since the
    // third rep has no rest after it, so this starts at 55_000.
    const entry = timeline.entries.find((e) => e.startMs === 55_000)
    expect(entry).toMatchObject({ name: 'Work' })
    expect(entry!.path).toEqual([
      { kind: 'repeat', id: expect.any(String), label: 'Set', iteration: 2, of: 2 },
      { kind: 'repeat', id: expect.any(String), label: 'Reps', iteration: 1, of: 3 },
    ])

    // The recover step sits inside Set only, not inside Reps.
    const recover = timeline.entries.find((e) => e.role === 'recover')!
    expect(recover.path.map((p) => p.label)).toEqual(['Set'])
  })

  it('carries media refs through untouched', () => {
    const timeline = compile(circuit())
    const fly = timeline.entries.filter((e) => e.name === 'Cable fly')

    expect(fly).toHaveLength(3)
    for (const entry of fly) expect(entry.media).toEqual(CABLE_FLY)

    expect(timeline.entries.find((e) => e.name === 'Push-up')!.media).toEqual({
      source: 'bundled',
      path: 'exercises/push-up.webp',
    })
    // Rest steps have no image, and the key is absent rather than undefined.
    expect(timeline.entries.find((e) => e.name === 'Rest')).not.toHaveProperty('media')
  })

  it('drops segments with a non-positive or non-finite duration', () => {
    const timeline = compile(
      workout('Degenerate', [
        seg('Zero', 0),
        seg('Negative', -5),
        { ...seg('NaN', 10), durationMs: Number.NaN },
        { ...seg('Infinite', 10), durationMs: Number.POSITIVE_INFINITY },
        seg('Real', 20),
      ]),
    )

    expect(timeline.entries.map((e) => e.name)).toEqual(['Real'])
    expect(timeline.totalMs).toBe(20_000)
  })

  it('rounds fractional durations to whole milliseconds', () => {
    const timeline = compile(workout('Fractional', [{ ...seg('Odd', 1), durationMs: 1500.6 }]))
    expect(timeline.entries[0]).toMatchObject({ durationMs: 1501, startMs: 0, endMs: 1501 })
  })

  it('treats a repeat count below 1 as contributing nothing', () => {
    for (const times of [0, -3, 0.4, Number.NaN]) {
      const timeline = compile(workout('Skipped', [rep(times, [seg('Work', 20)]), seg('After', 5)]))
      expect(timeline.entries.map((e) => e.name)).toEqual(['After'])
    }
  })

  it('floors a fractional repeat count', () => {
    const timeline = compile(workout('Floored', [rep(2.9, [seg('Work', 10)])]))
    expect(timeline.entries).toHaveLength(2)
    expect(timeline.entries[0]!.path[0]).toMatchObject({ iteration: 1, of: 2 })
  })

  it('handles an empty workout and empty repeat bodies', () => {
    const empty = { entries: [], runs: [], totalMs: 0, hasGates: false }
    expect(compile(workout('Empty', []))).toEqual(empty)
    expect(compile(workout('Hollow', [rep(5, [])]))).toEqual(empty)
  })

  it('throws a clear error rather than expanding a pathological tree', () => {
    const bomb = workout('Bomb', [rep(200, [rep(200, [seg('Work', 1)])])])

    expect(() => compile(bomb)).toThrow(TimelineTooLargeError)
    expect(() => compile(bomb)).toThrow(String(MAX_TIMELINE_ENTRIES))
  })
})

describe('totalDurationMs / stepCount', () => {
  it.each([
    ['tabata', tabata()],
    ['circuit', circuit()],
    ['nested', nested()],
    ['empty', workout('Empty', [])],
  ])('agrees with compile() for %s', (_name, wk) => {
    const timeline = compile(wk)
    expect(totalDurationMs(wk)).toBe(timeline.totalMs)
    expect(stepCount(wk)).toBe(timeline.entries.length)
  })

  it('ignores dropped segments and skipped repeats', () => {
    const wk = workout('Mixed', [seg('Zero', 0), rep(0, [seg('Work', 60)]), seg('Real', 45)])
    expect(totalDurationMs(wk)).toBe(45_000)
    expect(stepCount(wk)).toBe(1)
  })
})
