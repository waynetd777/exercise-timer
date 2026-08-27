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
  return out.filter((s) => !cardio.has(s.name) && s.name !== 'Warm Up' && s.name !== 'Cool Down')
}

/** One entry per distinct exercise, in the order they first appear. */
const distinct = (workout: Workout) => [...new Set(exercises(workout).map((s) => s.name))]

const areaOf = (name: string) => EXERCISES.find((e) => e.name === name)?.area

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
    expect(names[1]).toBe('Warm Up')
    expect(names.at(-1)).toBe('Cool Down')
  })

  it('puts a minute of the chosen cardio before every exercise but the first', () => {
    const { workout } = make({ recoveryExercise: 'Jumping Jacks' })
    const spins = workout.blocks.filter(
      (b) => b.kind === 'segment' && b.name === 'Jumping Jacks' && b.durationMs === 60_000,
    )
    expect(spins).toHaveLength(distinct(workout).length - 1)
  })

  it('recovers rather than cycling, when asked for passive', () => {
    const { workout } = make({ recovery: 'passive' })
    const names = workout.blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names).toContain('Recover')
    expect(names).not.toContain('Warm Up')
  })

  it('announces the exercise and its weight before it', () => {
    const { workout } = make()
    const announced = workout.blocks.filter(
      (b) => b.kind === 'segment' && b.name.startsWith('Get ready: '),
    )
    expect(announced.length).toBeGreaterThan(0)
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
