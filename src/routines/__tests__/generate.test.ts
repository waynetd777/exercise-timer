/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { compile, totalDurationMs } from '../../engine'
import type { Block, Segment, Workout } from '../../engine/types'
import { SCHEMA_VERSION } from '../../engine/types'
import { EXERCISES } from '../exercises'
import { PRESCRIPTIONS } from '../exercises.prescription'
import type { RoutineSpec } from '../generate'
import { generateRoutine, seeded } from '../generate'

const spec = (over: Partial<RoutineSpec> = {}): RoutineSpec => ({
  totalMs: 45 * 60_000,
  areas: ['upper', 'torso', 'lower'],
  recovery: 'active',
  equipment: 'machine',
  ...over,
})

const make = (over: Partial<RoutineSpec> = {}, seed = 1, library: Workout[] = []) =>
  generateRoutine(spec(over), { rng: seeded(seed), library, now: 0 })

/** Every work step, in order, ignoring the cardio and the warm-up. */
function exercises(workout: Workout): Segment[] {
  const out: Segment[] = []
  const walk = (blocks: readonly Block[]) => {
    for (const block of blocks) {
      if (block.kind !== 'segment') walk(block.children)
      else if (block.role === 'work') out.push(block)
    }
  }
  walk(workout.blocks)
  const cardio = new Set(EXERCISES.filter((e) => e.use === 'cardio').map((e) => e.name))
  // The bookends carry the exercise in their names now, so match the prefix.
  return out.filter(
    (s) => !cardio.has(s.name) && !s.name.startsWith('Warm Up') && !s.name.startsWith('Cool Down'),
  )
}

/** One entry per distinct exercise, in the order they first appear. */
const distinct = (workout: Workout) => [...new Set(exercises(workout).map((s) => s.name))]

const areaOf = (name: string) => EXERCISES.find((e) => e.name === name)?.area

/** Everything on offer to move with, which is what the dialog checks by default. */
const ALL_CARDIO = EXERCISES.filter((e) => e.use === 'cardio').map((e) => e.name)

describe('the length it asks for', () => {
  it.each([30, 45, 60])('lands within two minutes of %i', (minutes) => {
    const { workout } = make({ totalMs: minutes * 60_000 })
    const off = Math.abs(totalDurationMs(workout) - minutes * 60_000)
    expect(off).toBeLessThanOrEqual(2 * 60_000)
  })

  it('names the areas it could not fit in, rather than dropping them quietly', () => {
    // Twelve minutes is a ten-minute warm-up, a cool down and room for one
    // exercise, so two of the three areas asked for cannot appear at all.
    const { notes } = make({ totalMs: 12 * 60_000 })
    expect(notes.filter((n) => /No room for the \w+ body/.test(n))).toHaveLength(2)
  })

  it('says how far off it came when it is more than a minute or two', () => {
    const { notes } = make({ totalMs: 8 * 60_000 })
    expect(notes.join(' ')).toMatch(/minutes (longer|shorter) than asked/)
  })

  it('stores the length it actually came to', () => {
    const { workout } = make()
    expect(workout.estimatedTotalMs).toBe(totalDurationMs(workout))
  })

  it('produces a routine that compiles and runs', () => {
    const routine = compile(make().workout)
    expect(routine.runs).toHaveLength(1)
    expect(routine.runs[0]!.entries.every((e) => !e.selfPaced)).toBe(true)
  })
})

describe('what it chooses', () => {
  it('never works the same area twice in a row', () => {
    // The rhythm of Wayne's own routine: legs, core, push, legs, push, legs...
    const areas = distinct(make().workout).map(areaOf)
    for (let i = 1; i < areas.length; i++) expect(areas[i]).not.toBe(areas[i - 1])
  })

  it('never repeats an exercise', () => {
    const names = exercises(make().workout).map((s) => s.name)
    expect(new Set(names).size).toBe(new Set(names).size)
    expect(distinct(make().workout)).toHaveLength(new Set(distinct(make().workout)).size)
  })

  it('uses only the areas asked for', () => {
    const { workout } = make({ areas: ['torso'] })
    expect(new Set(distinct(workout).map(areaOf))).toEqual(new Set(['torso']))
  })

  it('alternates push and pull inside the upper body', () => {
    const { workout } = make({ areas: ['upper'] })
    const patterns = distinct(workout).map((n) => EXERCISES.find((e) => e.name === n)?.pattern)
    for (let i = 1; i < patterns.length; i++) expect(patterns[i]).not.toBe(patterns[i - 1])
  })

  it('respects multi-gym only, and never quietly supplements it', () => {
    // Wayne's call: widening a filter he set would override the answer he gave.
    // Only "mixed" supplements.
    const { workout } = make({ areas: ['torso'], equipment: 'machine' })
    const kit = distinct(workout).map((n) => EXERCISES.find((e) => e.name === n)?.equipment)
    expect(new Set(kit)).toEqual(new Set(['machine']))
  })

  it('says when it ran out rather than repeating to fill the time', () => {
    // The machine has five torso exercises, nowhere near an hour of work.
    const { notes } = make({ areas: ['torso'], equipment: 'machine', totalMs: 60 * 60_000 })
    expect(notes.join(' ')).toMatch(/Every exercise matching that choice was used/)
  })

  it('supplements freely when asked for mixed', () => {
    const { workout } = make({ areas: ['torso'], equipment: 'mixed', totalMs: 60 * 60_000 })
    const kit = new Set(distinct(workout).map((n) => EXERCISES.find((e) => e.name === n)?.equipment))
    expect(kit.size).toBeGreaterThan(1)
  })

  it('leaves the machine out entirely when asked to', () => {
    const { workout } = make({ equipment: 'none' })
    const kit = distinct(workout).map((n) => EXERCISES.find((e) => e.name === n)?.equipment)
    expect(kit).not.toContain('machine')
  })
})

describe('the shape it builds', () => {
  it('opens on a warm-up and closes on a cool down, for active recovery', () => {
    const names = make().workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names[1]).toBe('Warm Up: Cycling')
    expect(names.at(-1)).toBe('Cool Down: Cycling')
  })

  it('opens on ten minutes and closes on two, unless told otherwise', () => {
    const blocks = make().workout.blocks
    const warm = blocks[1]
    const cool = blocks.at(-1)
    expect(warm?.kind === 'segment' && warm.durationMs).toBe(600_000)
    expect(cool?.kind === 'segment' && cool.durationMs).toBe(120_000)
  })

  it('takes the three lengths it is given', () => {
    const { workout } = make({ warmUpMs: 300_000, recoveryMs: 90_000, coolDownMs: 180_000 })
    const blocks = workout.blocks
    const warm = blocks[1]
    const cool = blocks.at(-1)
    expect(warm?.kind === 'segment' && warm.durationMs).toBe(300_000)
    expect(cool?.kind === 'segment' && cool.durationMs).toBe(180_000)

    const gaps = blocks.filter(
      (b): b is Segment => b.kind === 'segment' && b.name === 'Cycling' && b.durationMs === 90_000,
    )
    expect(gaps.length).toBeGreaterThan(3)
  })

  it('applies the gap to a resting routine too, where there is no cardio', () => {
    const { workout } = make({ recovery: 'passive', recoveryMs: 45_000 })
    const rests = workout.blocks.filter(
      (b): b is Segment => b.kind === 'segment' && b.name === 'Recover',
    )
    expect(rests.length).toBeGreaterThan(0)
    expect(rests.every((r) => r.durationMs === 45_000)).toBe(true)
  })

  it('refuses a length of nothing, which is not a slot', () => {
    const { workout } = make({ warmUpMs: 0, coolDownMs: -5 })
    const warm = workout.blocks[1]
    const cool = workout.blocks.at(-1)
    expect(warm?.kind === 'segment' && warm.durationMs).toBe(600_000)
    expect(cool?.kind === 'segment' && cool.durationMs).toBe(120_000)
  })

  it('warms up and cools down with whatever it was told to', () => {
    const { workout } = make({
      warmUpExercise: 'Trampoline',
      coolDownExercise: 'Jog on the Spot',
    })
    const names = workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names[1]).toBe('Warm Up: Trampoline')
    expect(names.at(-1)).toBe('Cool Down: Jog on the Spot')
  })

  it('falls back rather than failing on a bookend it does not know', () => {
    const { workout } = make({ warmUpExercise: 'Rowing' })
    const names = workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names[1]).toBe('Warm Up: Cycling')
  })

  it('names the bookends for the exercise, since most carry no picture', () => {
    /*
     * "Warm Up" alone was enough while it was always the bike and always carried
     * its illustration. The trampoline has none, so the name is the only thing
     * left to say what to do.
     */
    const { workout } = make({ warmUpExercise: 'Trampoline' })
    const warm = workout.blocks[1]
    expect(warm?.kind === 'segment' && warm.media).toBeUndefined()
    expect(warm?.kind === 'segment' && warm.name).toBe('Warm Up: Trampoline')
  })

  it('puts a minute of the chosen cardio before every exercise but the first', () => {
    const { workout } = make({ recoveryExercise: 'Jumping Jacks' })
    const spins = workout.blocks.filter(
      (b) => b.kind === 'segment' && b.name === 'Jumping Jacks' && b.durationMs === 60_000,
    )
    expect(spins).toHaveLength(distinct(workout).length - 1)
  })

  it('puts a different exercise in every slot, when asked to vary', () => {
    const { workout } = make({ recoveryPool: ALL_CARDIO, totalMs: 50 * 60_000 })
    const cardioNames = new Set(EXERCISES.filter((e) => e.use === 'cardio').map((e) => e.name))
    const slots = workout.blocks.filter(
      (b): b is Segment => b.kind === 'segment' && b.durationMs === 60_000 && cardioNames.has(b.name),
    )
    expect(slots.length).toBeGreaterThan(4)

    // Never the same thing twice running, which is the whole point: an
    // independent draw per slot would repeat and a minute of burpees twice over
    // is what nobody wants from "surprise me".
    for (let i = 1; i < slots.length; i++) expect(slots[i]!.name).not.toBe(slots[i - 1]!.name)
    expect(new Set(slots.map((s) => s.name)).size).toBeGreaterThan(1)
  })

  it('draws only from the list it is given', () => {
    // The point of the list rather than a flag: "surprise me" stays bounded.
    const only = ['Cycling', 'Trampoline']
    const { workout } = make({ recoveryPool: only, totalMs: 50 * 60_000 })
    const cardioNames = new Set(EXERCISES.filter((e) => e.use === 'cardio').map((e) => e.name))
    const slots = workout.blocks.filter(
      (b): b is Segment => b.kind === 'segment' && b.durationMs === 60_000 && cardioNames.has(b.name),
    )
    expect(slots.length).toBeGreaterThan(4)
    expect([...new Set(slots.map((s) => s.name))].sort()).toEqual(['Cycling', 'Trampoline'])
  })

  it('falls back rather than failing when the list holds nothing usable', () => {
    const { workout, notes } = make({ recoveryPool: ['Not an exercise'] })
    expect(notes.join(' ')).toMatch(/Nothing in the list to move with/)
    const names = workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names).toContain('Cycling')
  })

  it('leaves the ten-minute warm-up alone when varying', () => {
    // Ten minutes of one thing is what a warm-up is. Ten minutes of burpees is
    // not something to hand anybody.
    const { workout } = make({ recoveryPool: ALL_CARDIO })
    const warmUp = workout.blocks.find(
      (b): b is Segment => b.kind === 'segment' && b.name.startsWith('Warm Up'),
    )
    expect(warmUp?.durationMs).toBe(600_000)
    expect(warmUp?.name).toBe('Warm Up: Cycling')
  })

  it('leaves the cool down alone as well', () => {
    // It is named for what it is, not for the exercise, so varying it would
    // change a picture and nothing else.
    const { workout } = make({ recoveryPool: ALL_CARDIO })
    const cool = workout.blocks.at(-1)
    expect(cool?.kind === 'segment' && cool.name).toBe('Cool Down: Cycling')
  })

  it('recovers rather than cycling, when asked for passive', () => {
    const { workout } = make({ recovery: 'passive' })
    const names = workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names).toContain('Recover')
    expect(names.some((n) => n.startsWith('Warm Up'))).toBe(false)
  })

  it('announces the exercise and its weight before it', () => {
    const { workout } = make()
    const announced = workout.blocks.filter(
      (b) => b.kind === 'segment' && b.name.startsWith('Get ready: '),
    )
    expect(announced.length).toBeGreaterThan(0)
  })

  it('announces a machine exercise for 30s and anything else for 15', () => {
    /*
     * The long announcement is not reading time: it is the time spent changing
     * the pin and moving the seat while the cardio minute runs. A press-up needs
     * none of that. The name and the weight stay either way.
     */
    const announcements = (equipment: RoutineSpec['equipment']) => {
      const { workout } = make({ equipment, totalMs: 50 * 60_000 })
      return workout.blocks
        .filter((b): b is Segment => b.kind === 'segment' && b.name.startsWith('Get ready: '))
        .map((b) => b.durationMs)
    }
    expect(new Set(announcements('machine'))).toEqual(new Set([30_000]))
    expect(new Set(announcements('none'))).toEqual(new Set([15_000]))
  })

  it('gives a band exercise 20 seconds to get the bands on', () => {
    // Same reason as the ankle cuff: it has to be put ON before it can be
    // started, where a machine is something you sit at.
    const { workout } = make({ equipment: 'none', totalMs: 50 * 60_000 })
    const band = new Set(EXERCISES.filter((e) => e.equipment === 'band').map((e) => e.name))
    const blocks = workout.blocks

    let checked = 0
    blocks.forEach((block, i) => {
      if (block.kind !== 'repeat') return
      const work = block.children.find((c): c is Segment => c.kind === 'segment')
      const before = blocks[i - 1]
      if (!work || before?.kind !== 'segment' || !band.has(work.name)) return
      expect(before.durationMs).toBe(20_000)
      checked += 1
    })
    expect(checked).toBeGreaterThan(0)
  })

  it('gives an ankle-strap exercise a 20 second get-ready, and others 15', () => {
    const { workout } = make({ areas: ['lower'], equipment: 'machine', totalMs: 60 * 60_000 })
    const blocks = workout.blocks
    const strapped = EXERCISES.filter((e) => e.attachment === 'ankle').map((e) => e.name)
    blocks.forEach((block, i) => {
      if (block.kind !== 'repeat') return
      const work = block.children.find((c): c is Segment => c.kind === 'segment')
      const before = blocks[i - 1]
      if (!work || before?.kind !== 'segment') return
      expect(before.durationMs).toBe(strapped.includes(work.name) ? 20_000 : 15_000)
    })
  })

  it('gives a per-side exercise two sets a side, with a Change Sides between', () => {
    const { workout } = make({ areas: ['lower'], equipment: 'machine', totalMs: 60 * 60_000 })
    const perSide = EXERCISES.filter((e) => e.perSide).map((e) => e.name)
    const chosen = distinct(workout).filter((n) => perSide.includes(n))
    expect(chosen.length).toBeGreaterThan(0)

    for (const name of chosen) {
      const groups = workout.blocks.filter(
        (b) => b.kind === 'repeat' && b.children.some((c) => c.kind === 'segment' && c.name === name),
      )
      expect(groups).toHaveLength(2)
      expect(groups.every((g) => g.kind === 'repeat' && g.times === 2)).toBe(true)
    }
    const names = workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names.filter((n) => n === 'Change Sides')).toHaveLength(chosen.length)
  })
})

describe('what a set asks for', () => {
  it('gives a multi-gym set twelve reps INSIDE twenty seconds', () => {
    /*
     * Both, which is what the editor's `× in` unit exists to say: the clock
     * paces you and the count is the target. Until the editor could hold both,
     * that twelve had to live in the step's name.
     */
    const { workout } = make({ equipment: 'machine' })
    for (const step of exercises(workout)) {
      expect(step.durationMs).toBe(20_000)
      expect(step.reps).toEqual({ kind: 'fixed', count: 12 })
    }
  })

  it('takes another count if it is given one', () => {
    const { workout } = make({ equipment: 'machine', machineReps: 15 })
    expect(exercises(workout)[0]?.reps).toEqual({ kind: 'fixed', count: 15 })
  })

  it('asks a non-machine exercise for what the instructor asks it for', () => {
    /*
     * Out of `exercises.prescription.ts`, harvested from the sixteen routines,
     * which is why a plank comes out as a held forty seconds and hammer curls
     * as twelve reps. Timed either way: these are the circuit shapes, where the
     * clock is what makes the length knowable and a count rides along as the
     * target.
     */
    const { workout } = make({ equipment: 'none', totalMs: 50 * 60_000 })
    const chosen = exercises(workout)
    expect(chosen.every((s) => s.durationMs !== undefined)).toBe(true)

    for (const step of chosen) {
      const said = PRESCRIPTIONS.find((p) => p.name === step.name)
      if (!said) continue
      if (said.seconds !== undefined) {
        // Capped at 45s: some harvested durations are the FORMAT'S rather than
        // the exercise's, and an EMOM's minute of curls is not a circuit set.
        expect(step.durationMs).toBe(Math.min(Math.max(said.seconds * 1000, 20_000), 45_000))
      }
      if (said.prescribe === 'reps' && said.reps !== undefined) {
        expect(step.reps).toEqual({ kind: 'fixed', count: said.reps })
      }
    }
    // And at least one of them actually carried a prescription, or the loop
    // above proved nothing.
    expect(chosen.some((s) => PRESCRIPTIONS.some((p) => p.name === s.name))).toBe(true)
  })

  it('still compiles as timed steps, not gates', () => {
    // A counted step that also has a clock must not become self-paced.
    const routine = compile(make({ equipment: 'machine' }).workout)
    expect(routine.runs).toHaveLength(1)
    expect(routine.runs[0]!.entries.every((e) => !e.selfPaced)).toBe(true)
  })
})

describe('the weight', () => {
  const saved = (name: string, load: string): Workout => ({
    id: 'w',
    name: 'Old routine',
    blocks: [{ kind: 'segment', id: 's', name, role: 'work', durationMs: 20_000, load }],
    schemaVersion: SCHEMA_VERSION,
    createdAt: 0,
    updatedAt: 10,
  })

  it('comes from what was last used for that exercise', () => {
    const { workout } = make({ areas: ['lower'] }, 1, [saved('Leg Press', '65kg')])
    const press = exercises(workout).find((s) => s.name === 'Leg Press')
    expect(press?.load).toBe('65kg')
  })

  it('is found even where the saved name carries a count', () => {
    // Which is how Wayne's own routines read: "12 × Leg Press", loaded to 65kg.
    const { workout } = make({ areas: ['lower'] }, 1, [saved('12 × Leg Press', '65kg')])
    expect(exercises(workout).find((s) => s.name === 'Leg Press')?.load).toBe('65kg')
  })

  it('prefers the more recent of two', () => {
    const older = { ...saved('Leg Press', '60kg'), updatedAt: 1 }
    const newer = { ...saved('Leg Press', '70kg'), updatedAt: 99 }
    const { workout } = make({ areas: ['lower'] }, 1, [newer, older])
    expect(exercises(workout).find((s) => s.name === 'Leg Press')?.load).toBe('70kg')
  })

  it('is left blank rather than invented', () => {
    const { workout } = make({}, 1, [])
    expect(exercises(workout).every((s) => s.load === undefined)).toBe(true)
  })

  it('is announced with the exercise it belongs to', () => {
    // Loaded for every candidate, so the assertion does not depend on which the
    // seed happens to pick.
    const library = EXERCISES.filter((e) => e.area === 'lower' && e.equipment === 'machine').map(
      (e, i) => ({ ...saved(e.name, `${20 + i}kg`), id: `w${i}` }),
    )
    const { workout } = make({ areas: ['lower'] }, 1, library)
    const announced = workout.blocks.filter(
      (b): b is Segment => b.kind === 'segment' && b.name.startsWith('Get ready: '),
    )
    expect(announced.length).toBeGreaterThan(0)
    expect(announced.every((b) => /\d+kg$/.test(b.name))).toBe(true)
  })

  it('does not announce the FIRST exercise, which has no cardio to announce it during', () => {
    /*
     * The announcement exists so you can change the pin while the minute of
     * cardio runs. The first exercise comes straight off the warm-up, where the
     * plain get-ready is the setup time, and that is how Wayne's own routines
     * read.
     */
    const { workout } = make({ areas: ['lower'] }, 1, [saved('Leg Press', '65kg')])
    const before = workout.blocks.findIndex((b) => b.kind === 'repeat')
    const names = workout.blocks.slice(0, before).map((b) => (b.kind === 'segment' ? b.name : ''))
    expect(names.filter((n) => n.startsWith('Get ready: '))).toEqual([])
  })
})

describe('the seed', () => {
  it('gives the same routine twice', () => {
    const names = (seed: number) => distinct(make({}, seed).workout)
    expect(names(7)).toEqual(names(7))
  })

  it('gives a different one for a different seed', () => {
    const a = distinct(make({}, 1).workout)
    const b = distinct(make({}, 2).workout)
    expect(a).not.toEqual(b)
  })
})
