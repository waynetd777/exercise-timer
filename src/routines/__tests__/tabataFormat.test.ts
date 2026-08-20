import { describe, expect, it } from 'vitest'
import { compile, totalDurationMs } from '../../engine'
import raw from '../beginner-mixed-cardio.tabata.json'
import { importTabataFile, TabataImportError } from '../tabataFormat'

describe('importTabataFile', () => {
  const workout = importTabataFile(raw)

  it("keeps the routine's own title", () => {
    expect(workout.name).toBe('Beginner Mixed Cardio & Full-Body Workout Routine 2')
  })

  it('imports every interval as a flat step, 42 minutes in total', () => {
    expect(workout.blocks).toHaveLength(86)
    expect(totalDurationMs(workout)).toBe(2_529_000)
  })

  it('ignores `cycles` — the intervals are already expanded', () => {
    // The file says cycles: 3. Honouring it would produce a 126-minute workout.
    expect(totalDurationMs(workout)).toBeLessThan(60 * 60 * 1000)
  })

  it('maps interval types onto roles', () => {
    const timeline = compile(workout)
    expect(timeline.entries[0]).toMatchObject({ role: 'prepare', name: 'Get ready' })
    expect(timeline.entries[1]).toMatchObject({
      role: 'work',
      name: 'Warm Up',
      durationMs: 600_000,
    })
    expect(timeline.entries[4]).toMatchObject({ role: 'rest', name: 'Rest' })
  })

  it('turns interval urls into remote media refs', () => {
    const legPress = compile(workout).entries.find((e) => e.name === 'Leg Press')
    expect(legPress?.media).toEqual({
      source: 'remote',
      url: 'https://i.postimg.cc/TPg0hk3q/Leg-Press.png',
    })
  })

  it('leaves media absent for exercises that have no image', () => {
    const withoutImage = compile(workout).entries.filter(
      (e) => e.role === 'work' && e.media === undefined,
    )
    expect(withoutImage.length).toBeGreaterThan(0)
    expect(withoutImage.map((e) => e.name)).toContain('Low Pulley Squat')
  })

  it('names a transition by its description when it has one', () => {
    const named = compile(workout).entries.filter(
      (e) => e.role === 'prepare' && e.name !== 'Get ready',
    )
    expect(named.map((e) => e.name)).toContain('Change Sides')
  })

  it('produces a workout the engine compiles without dropping anything', () => {
    const timeline = compile(workout)
    expect(timeline.entries).toHaveLength(workout.blocks.length)
    expect(timeline.totalMs).toBe(totalDurationMs(workout))
  })

  it('rejects input that is not a tabata file', () => {
    expect(() => importTabataFile(null)).toThrow(TabataImportError)
    expect(() => importTabataFile({})).toThrow(/no workout/)
    expect(() => importTabataFile({ workout: {} })).toThrow(/no intervals/)
  })

  it('skips intervals with no duration', () => {
    const imported = importTabataFile({
      workout: { title: 'Edge', intervals: [{ type: 1, time: 0 }, { type: 1, time: 20 }] },
    })
    expect(imported.blocks).toHaveLength(1)
  })
})
