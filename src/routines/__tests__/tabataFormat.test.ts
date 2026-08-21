import { describe, expect, it } from 'vitest'
import generalEmail from './emails/2026-07-20-general.txt?raw'
import { parseRoutine } from '../pasteFormat'
import type { Block } from '../../engine'
import { compile, totalDurationMs } from '../../engine'
import raw from '../beginner-mixed-cardio-2.tabata.json'
import rawFullBody from '../beginner-full-body.tabata.json'
import rawMixedCardio1 from '../beginner-mixed-cardio-1.tabata.json'
import { SEED_ROUTINES } from '../samples'
import { IMPORTED_ROUTINES } from './fixtures'
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

describe('the other seeded routines', () => {
  it('imports the full-body routine, including its type-3 recovery intervals', () => {
    // type 3 is 60s with no description and matches restBetweenTabatas: 60 —
    // the long recovery between exercises, mapped to the `recover` role.
    const workout = importTabataFile(rawFullBody)
    const timeline = compile(workout)

    expect(workout.name).toBe('Beginner Full-Body Workout Routine')
    expect(timeline.entries).toHaveLength(69)
    expect(totalDurationMs(workout)).toBe(1_490_000)

    const recover = timeline.entries.filter((e) => e.role === 'recover')
    expect(recover).toHaveLength(9)
    for (const entry of recover) expect(entry.durationMs).toBe(60_000)
  })

  it('imports mixed cardio 1', () => {
    const workout = importTabataFile(rawMixedCardio1)
    expect(workout.name).toBe('Beginner Mixed Cardio & Full-Body Workout Routine 1')
    expect(compile(workout).entries).toHaveLength(82)
    expect(totalDurationMs(workout)).toBe(2_449_000)
  })

  it('gives every seeded routine a stable, unique id', () => {
    // Seeding is keyed on these, so a collision would silently drop a routine
    // and an unstable one would re-add it on every load.
    const ids = SEED_ROUTINES.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^seed-/)
  })

  it('ships one routine of each kind: a timed one and a rep-based one', () => {
    // The two things the app does. An install that only ever saw a countdown
    // would never discover that a step can wait for you.
    expect(SEED_ROUTINES.map((seed) => seed.name)).toEqual([
      'Beginner Full-Body Workout Routine',
      'Strength Training',
    ])

    const [timed, strength] = SEED_ROUTINES
    expect(timed!.blocks.filter((b) => b.kind === 'repeat').length).toBeGreaterThan(5)
    expect(compile(timed!).hasGates).toBe(false)

    expect(strength!.blocks.every((b) => b.kind === 'section')).toBe(true)
    expect(compile(strength!).hasGates).toBe(true)
  })

  it('seeds a strength routine that still matches what the parser produces', () => {
    /*
     * It is committed JSON, generated by running the parser over the email in
     * `emails/2026-07-20-general.txt`. A parser change that silently stopped
     * agreeing with it would leave the app's own worked example wrong, which is
     * worse than having none.
     */
    const parsed = parseRoutine(generalEmail)
    const strip = (blocks: readonly Block[]): unknown =>
      blocks.map((block) =>
        block.kind === 'segment'
          ? { ...block, id: '' }
          : { ...block, id: '', children: strip(block.children) },
      )

    expect(strip(SEED_ROUTINES[1]!.blocks)).toEqual(strip(parsed.blocks))
  })

  it('never INFERS reps when importing, however repetitive the file', () => {
    /*
     * The seed has reps groups because it was authored that way, not because the
     * importer found them. This is the invariant that matters: the same exercise
     * three times in a row is not proof of intent, and guessing would silently
     * change someone's workout — a trailing rest is dropped inside a group.
     */
    for (const workout of IMPORTED_ROUTINES) {
      expect(workout.blocks.every((b) => b.kind === 'segment'), workout.name).toBe(true)
    }
  })
})
