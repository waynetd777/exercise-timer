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
import { LADDER_COUNTS } from '../exercises.shapes'
import { foldName } from '../foldName'
import type { RoutineSpec } from '../generate'
import { describeRoutine, generateRoutine, seeded } from '../generate'
import { estimate } from '../estimate'
import { parseRoutine } from '../pasteFormat'
import { writeRoutine } from '../writeRoutine'

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
      const said = PRESCRIPTIONS.find((p) => p.name === foldName(step.name))
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
    expect(chosen.some((s) => PRESCRIPTIONS.some((p) => p.name === foldName(s.name)))).toBe(true)
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

describe('the instructor’s shape', () => {
  const sections = (over: Partial<RoutineSpec> = {}, seed = 5) =>
    generateRoutine(
      spec({ style: 'sections', equipment: 'none', recovery: 'passive', ...over }),
      { rng: seeded(seed), now: 0 },
    )
  /** The sections alone: everything after the get-ready the routine opens on. */
  const sectionsOf = (result: ReturnType<typeof sections>) => result.workout.blocks.slice(1)

  it('opens on the same five seconds to get ready a pasted routine gets', () => {
    // Loose and above the warm-up, and exactly the parser's step, so Send as
    // text leaves it out and Paste puts it back.
    const head = sections().workout.blocks[0]
    expect(head).toMatchObject({ kind: 'segment', role: 'prepare', name: 'Get ready', durationMs: 5_000 })
    expect(sectionsOf(sections()).every((b) => b.kind === 'section')).toBe(true)
  })

  const namesOf = (result: ReturnType<typeof sections>) =>
    sectionsOf(result).map((b) => (b.kind === 'section' ? b.name : ''))
  const sectionNamed = (result: ReturnType<typeof sections>, name: string) => {
    const found = sectionsOf(result).find((b) => b.kind === 'section' && b.name === name)
    if (found?.kind !== 'section') throw new Error(`no ${name} section`)
    return found
  }

  it('builds named sections in the order the routines use', () => {
    const names = namesOf(sections())
    expect(names[0]).toBe('Warm-up')
    expect(names.at(-1)).toBe('Finisher')
    // The body between keeps her order whatever was dropped: a subsequence, opening on General Body.
    const order = ['General Body', 'Arms & Shoulders', 'Legs', 'Core']
    const between = names.slice(1, -1)
    expect(between[0]).toBe('General Body')
    const positions = between.map((n) => order.indexOf(n))
    expect(positions).toEqual(positions.slice().sort((a, b) => a - b))
    expect(namesOf(sections({ sections: 6 }))).toEqual(['Warm-up', ...order, 'Finisher'])
  })

  it('rotates which themes get the room, and protects General Body', () => {
    /*
     * In her order, Core was the casualty of every short routine; dropping the
     * largest would have made it Legs every time. Her shorter routines differ in
     * which theme is missing, so over a run of seeds each one gets its turn, and
     * General Body, which opens thirteen of sixteen, is never the one dropped.
     */
    const seen = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      const names = namesOf(sections({ totalMs: 40 * 60_000 }, seed))
      expect(names[1]).toBe('General Body')
      for (const name of names) seen.add(name)
    }
    for (const theme of ['Arms & Shoulders', 'Legs', 'Core']) expect(seen).toContain(theme)
  })

  it('keeps the finisher last whatever the count', () => {
    // It used to fall off the end of a short routine, which is the one section
    // she closes fourteen of sixteen with.
    expect(namesOf(sections({ sections: 3 }))).toEqual(['Warm-up', 'General Body', 'Finisher'])
    expect(namesOf(sections({ sections: 4 }))).toEqual(['Warm-up', 'General Body', 'Arms & Shoulders', 'Finisher'])
  })

  it('fits whole sections to the minutes asked, by estimate', () => {
    /*
     * The same estimate the library row shows. Her template routines come to
     * 56 to 91 minutes by it, so a 45-minute routine is four sections or so.
     * Whole sections, so any one routine can be a section off; the average
     * over a run of seeds should sit on the target.
     */
    const mean = (minutes: number) => {
      let total = 0
      for (let seed = 1; seed <= 20; seed++) {
        const { workout } = sections({ totalMs: minutes * 60_000 }, seed)
        const guess = estimate(workout.blocks)
        total += (guess.knownMs + guess.estimatedMs) / 60_000
      }
      return total / 20
    }
    expect(Math.abs(mean(35) - 35)).toBeLessThan(6)
    expect(Math.abs(mean(50) - 50)).toBeLessThan(6)
    expect(mean(50)).toBeGreaterThan(mean(35))
  })

  it('names the sections that did not fit, rather than dropping them quietly', () => {
    expect(sections({ totalMs: 35 * 60_000 }).notes.join(' ')).toMatch(/No room for .* in 35 minutes/)
  })

  it('puts each shape where she puts it', () => {
    /*
     * A ladder every third section put the ladders on General Body and Core.
     * Since July the Finisher has been a ladder every time and Core rounds every
     * time, so the shape belongs to the theme.
     */
    const result = sections({ sections: 6 })
    expect(sectionNamed(result, 'Legs').children[0]?.kind).toBe('ladder')
    expect(sectionNamed(result, 'Finisher').children[0]?.kind).toBe('ladder')
    expect(sectionNamed(result, 'Arms & Shoulders').children[0]?.kind).toBe('repeat')
    expect(sectionNamed(result, 'Core').children[0]?.kind).toBe('repeat')

    // General Body: "Complete one exercise before moving to the next", so EVERY move climbs.
    const general = sectionNamed(result, 'General Body').children[0]
    if (general?.kind !== 'ladder') throw new Error('General Body is not a ladder')
    expect(general.children.length).toBeGreaterThanOrEqual(4)
    expect(general.children.every((c) => c.kind === 'segment' && c.reps?.kind === 'rung')).toBe(true)
  })

  it('carries a ladder on a lift that has carried one of her', () => {
    // `PRESCRIPTIONS[].rung` says which. Seated Leg Extension has never climbed a pyramid.
    for (let seed = 1; seed <= 20; seed++) {
      const walk = (blocks: readonly Block[]) => {
        for (const block of blocks) {
          if (block.kind === 'ladder') {
            const main = block.children[0]
            if (main?.kind !== 'segment') throw new Error('empty ladder')
            expect(PRESCRIPTIONS.find((p) => p.name === foldName(main.name))?.rung).toBe(true)
          }
          if (block.kind !== 'segment') walk(block.children)
        }
      }
      walk(sections({ sections: 6 }, seed).workout.blocks)
    }
  })

  it('closes each core round on a hold, then adds more after the rounds', () => {
    // "30-second Plank" ends every Core round since July, and "After Round N:" follows.
    const core = sectionNamed(sections({ sections: 6 }), 'Core')
    const rounds = core.children[0]
    if (rounds?.kind !== 'repeat') throw new Error('Core is not rounds')
    const work = rounds.children.filter((c): c is Segment => c.kind === 'segment' && c.role === 'work')
    expect(work.length).toBe(5)
    expect(work.at(-1)?.durationMs).toBeDefined()
    expect(work.slice(0, -1).every((c) => c.reps !== undefined)).toBe(true)
    expect(core.children.length).toBeGreaterThan(1)
    expect(core.children.slice(1).every((c) => c.kind === 'segment')).toBe(true)
  })

  it('finishes on a burnout after the finisher’s ladder', () => {
    // "Final Burnout (No Rest)": loose steps after the ladder, done once.
    const finisher = sectionNamed(sections({ sections: 6 }), 'Finisher')
    expect(finisher.children[0]?.kind).toBe('ladder')
    expect(finisher.children.slice(1).length).toBeGreaterThanOrEqual(3)
    expect(finisher.children.slice(1).every((c) => c.kind === 'segment')).toBe(true)
  })

  it('sizes Arms & Shoulders as she does', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rounds = sectionNamed(sections({ sections: 6 }, seed), 'Arms & Shoulders').children[0]
      if (rounds?.kind !== 'repeat') throw new Error('not rounds')
      expect(rounds.times).toBeGreaterThanOrEqual(4)
      expect(rounds.times).toBeLessThanOrEqual(5)
      const work = rounds.children.filter((c) => c.kind === 'segment' && c.role === 'work').length
      expect(work).toBeGreaterThanOrEqual(5)
      expect(work).toBeLessThanOrEqual(6)
    }
  })

  it('warms up with what she warms up with', () => {
    // The cardio pool also holds burpees and plank jacks, and no warm-up of her has either.
    const never = ['Burpees', 'Plank Jacks', 'Mountain Climbers', 'Cross-Body Mountain Climbers', 'Speed Skaters']
    for (let seed = 1; seed <= 30; seed++) {
      const warm = sectionNamed(sections({}, seed), 'Warm-up')
      for (const step of warm.children) {
        if (step.kind === 'segment') expect(never).not.toContain(step.name)
      }
    }
  })

  it('names a narrowed theme for what is left in it', () => {
    // "General Body" of nothing but legs is not general, and "Legs Finisher" is her own heading.
    expect(namesOf(sections({ areas: ['lower'], sections: 6 }))).toEqual(['Warm-up', 'Lower Body', 'Legs', 'Legs Finisher'])
    expect(namesOf(sections({ areas: ['torso'], sections: 6 }))).toEqual(['Warm-up', 'Abs', 'Core', 'Core Finisher'])
    expect(namesOf(sections({ areas: ['upper', 'torso'], sections: 6 }))).toContain('Upper Body & Abs')
  })

  it('names the routine for the sections it built, not the count asked', () => {
    // "Core, 6 sections" over a routine of four was a name that lied while a note told the truth.
    expect(sections({ areas: ['torso'], sections: 8 }).workout.name).toMatch(/Core, 4 sections$/)
  })

  it('says two sections when two is what it built, though two is fewer than can be asked for', () => {
    // The built count went through the same clamp as an asked one, so a
    // routine of two sections was named "3 sections".
    const { workout } = generateRoutine(
      { style: 'sections', totalMs: 10 * 60_000, areas: ['upper'], equipment: 'none', recovery: 'passive' },
      { rng: seeded(1), library: [], now: 0 },
    )
    const built = workout.blocks.filter((block) => block.kind === 'section').length
    expect(built).toBeLessThan(3)
    expect(workout.name).toMatch(new RegExp(`, ${built} sections$`))
  })

  it('pastes back in the shape it was written', () => {
    // Send as text, then Paste: the tails after a group are written with `Then:` and read back loose.
    const shape = (blocks: readonly Block[]): string =>
      blocks
        .map((b) => (b.kind === 'segment' ? (b.role === 'work' ? 's' : 'r') : `${b.kind[0]}(${shape(b.children)})`))
        .join('')
    for (let seed = 1; seed <= 5; seed++) {
      const { workout } = sections({ sections: 6 }, seed)
      const back = parseRoutine(writeRoutine(workout).text, workout.name)
      expect(back.skipped).toEqual([])
      expect(shape(back.blocks)).toBe(shape(workout.blocks))
    }
  })

  it('opens on a timed warm-up, which is the one part that is not self-paced', () => {
    const warm = sectionsOf(sections())[0]
    expect(warm?.kind === 'section' && warm.name).toBe('Warm-up')
    if (warm?.kind !== 'section') throw new Error('no warm-up')
    const durations = warm.children.map((c) => (c.kind === 'segment' ? c.durationMs : undefined))
    // Cardio first at forty seconds, then the stretches at thirty, never the other way round.
    expect(durations.every((d) => d === 40_000 || d === 30_000)).toBe(true)
    expect(durations[0]).toBe(40_000)
    expect(durations.slice(durations.indexOf(30_000)).every((d) => d === 30_000)).toBe(true)
  })

  it('warms up even on the multi-gym, which has nothing to warm up with', () => {
    /*
     * Nothing on the machine is a stretch or a jog, so the equipment filter left
     * the warm-up section empty and it was silently dropped. You warm up on the
     * floor or the bike whatever the session is made of.
     */
    const first = sectionsOf(sections({ equipment: 'machine' }))[0]
    expect(first?.kind === 'section' && first.name).toBe('Warm-up')
    if (first?.kind !== 'section') throw new Error('no warm-up')
    expect(first.children.length).toBeGreaterThan(3)
  })

  it('is mostly self-paced, which is the whole difference from a circuit', () => {
    const routine = compile(sections().workout)
    const steps = routine.runs.flatMap((r) => r.entries)
    expect(steps.filter((e) => e.selfPaced).length).toBeGreaterThan(steps.length / 2)
  })

  it('says it cannot know how long it will take', () => {
    // A self-paced step ends when you tap Next. Claiming a duration would be
    // the app pretending to a number.
    expect(sections().notes.join(' ')).toMatch(/no length/)
  })

  it('uses a ladder the instructor actually writes, never a generated one', () => {
    /*
     * "4-9-14-9-4" would be arithmetically fine and unlike anything she has been
     * given. Every ladder must be one of the nineteen in the corpus.
     */
    const known = new Set(LADDER_COUNTS.map((l) => l.counts.join('-')))
    let seen = 0
    const walk = (blocks: readonly Block[]) => {
      for (const block of blocks) {
        if (block.kind === 'ladder') {
          expect(known).toContain(block.counts.join('-'))
          seen += 1
        }
        if (block.kind !== 'segment') walk(block.children)
      }
    }
    walk(sections().workout.blocks)
    expect(seen).toBeGreaterThan(0)
  })

  it('scales the ladder’s main lift and leaves the accessories alone', () => {
    // "Main exercise:" then "After every set:", which is the shape her ladders
    // take: rung 2 is two of the lift and still twelve of the rest.
    // The Legs one: General Body's ladder scales EVERY exercise, by design.
    const { workout } = sections({ sections: 6 })
    const routine = compile({ ...workout, blocks: [sectionNamed(sections({ sections: 6 }), 'Legs')] })
    const rungs = routine.runs
      .flatMap((r) => r.entries)
      .filter((e) => e.path.some((p) => p.kind === 'ladder'))
    const first = rungs.filter((e) => e.path.at(-1)?.iteration === 1)
    const second = rungs.filter((e) => e.path.at(-1)?.iteration === 2)
    expect(first[0]!.reps!.count).not.toBe(second[0]!.reps!.count)
    expect(first[1]!.reps!.count).toBe(second[1]!.reps!.count)
  })

  it('works only what it was asked to work', () => {
    /*
     * The themes carry their own areas, and taking them as written ignored the
     * question: asking for Core alone still built an Arms & Shoulders section
     * and a Legs one. The circuit shape had always intersected; this one had
     * not.
     */
    const { workout } = sections({ areas: ['torso'] })
    const names = workout.blocks.map((b) => (b.kind === 'section' ? b.name : ''))
    expect(names).not.toContain('Arms & Shoulders')
    expect(names).not.toContain('Legs')
    expect(names).toContain('Core')

    // And nothing outside the torso is worked, bar the warm-up.
    const worked: string[] = []
    const walk = (blocks: readonly Block[], inWarmUp: boolean) => {
      for (const block of blocks) {
        if (block.kind === 'section') walk(block.children, block.name === 'Warm-up')
        else if (block.kind !== 'segment') walk(block.children, inWarmUp)
        else if (block.role === 'work' && !inWarmUp) worked.push(block.name)
      }
    }
    walk(workout.blocks, false)
    for (const name of worked) {
      expect(EXERCISES.find((e) => e.name === name)?.area).toBe('torso')
    }
  })

  it('still warms the whole of you up, whatever the session works', () => {
    // Exempt for the same reason it ignores the equipment.
    const warm = sectionsOf(sections({ areas: ['torso'] }))[0]
    expect(warm?.kind === 'section' && warm.name).toBe('Warm-up')
    if (warm?.kind !== 'section') throw new Error('no warm-up')
    expect(warm.children.length).toBeGreaterThan(3)
  })

  it('says when fewer sections suit the areas than were asked for', () => {
    expect(sections({ areas: ['torso'], sections: 8 }).notes.join(' ')).toMatch(
      /Only \d sections suit/,
    )
  })

  it('takes the number of sections it is given, within what the routines do', () => {
    expect(sectionsOf(sections({ sections: 5 }))).toHaveLength(5)
    expect(sectionsOf(sections({ sections: 3 }))).toHaveLength(3)
    /*
     * Clamped to three at the bottom, which is SHORTER than the instructor ever
     * writes: no routine of her has fewer than five. A shorter session is a
     * reasonable thing to want, and asking for one is not a claim about her.
     */
    expect(sectionsOf(sections({ sections: 1 })).length).toBeGreaterThanOrEqual(3)
    expect(sectionsOf(sections({ sections: 99 })).length).toBeLessThanOrEqual(8)
  })

  it('never repeats an exercise across the whole routine', () => {
    const names: string[] = []
    const walk = (blocks: readonly Block[]) => {
      for (const block of blocks) {
        if (block.kind === 'segment') {
          if (block.role === 'work') names.push(block.name)
        } else walk(block.children)
      }
    }
    walk(sections().workout.blocks)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('what an unnamed routine is called', () => {
  const named = (over: Partial<RoutineSpec>) => describeRoutine(spec(over))

  it('says what it works and how big it is', () => {
    // What a person scans a library for. "Generated - 2026-08-27" says neither,
    // and a second one the same day says less.
    expect(named({})).toBe('Full-Body Circuit, 45 min')
    expect(named({ totalMs: 35 * 60_000 })).toBe('Full-Body Circuit, 35 min')
  })

  it('names the areas when they are not all of them, in body order', () => {
    expect(named({ areas: ['torso'] })).toBe('Core Circuit, 45 min')
    expect(named({ areas: ['lower', 'upper'] })).toBe('Upper Body & Lower Body Circuit, 45 min')
  })

  it('names the section count it actually builds, at the bottom of the range', () => {
    // describeRoutine clamped at five while the builder clamped at three, so a
    // three-section routine was called "5 sections".
    expect(named({ style: 'sections', sections: 3 })).toBe('Full-Body, 3 sections')
  })

  it('counts sections rather than minutes for the shape that has no length', () => {
    expect(named({ style: 'sections', sections: 6 })).toBe('Full-Body, 6 sections')
  })

  it('names the equipment only when it is worth naming', () => {
    // Everything is on the multi-gym unless it says otherwise, so saying so on
    // most of them would push the useful half off the end of a narrow row.
    expect(named({ equipment: 'machine' })).toBe('Full-Body Circuit, 45 min')
    expect(named({ equipment: 'none' })).toBe('Bodyweight Full-Body Circuit, 45 min')
    expect(named({ equipment: 'mixed' })).toBe('Mixed Full-Body Circuit, 45 min')
  })

  it('is what an unnamed routine actually gets called', () => {
    const { workout } = generateRoutine(spec({ areas: ['lower'] }), { rng: seeded(1), now: 0 })
    expect(workout.name).toBe('Lower Body Circuit, 45 min')
  })

  it('leaves a name alone when there is one', () => {
    const { workout } = generateRoutine(spec({ name: '  Leg day  ' }), { rng: seeded(1), now: 0 })
    expect(workout.name).toBe('Leg day')
  })
})

describe('what the sections shape can reach', () => {
  const ladders = (blocks: readonly Block[]): string[] =>
    blocks.flatMap((b) =>
      b.kind === 'ladder' ? [b.counts.join('-')] : b.kind === 'segment' ? [] : ladders(b.children),
    )
  const steps = (blocks: readonly Block[]): string[] =>
    blocks.flatMap((b) => (b.kind === 'segment' ? [b.name] : steps(b.children)))

  it('draws from every ladder the instructor writes, not the first six', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) {
      const { workout } = generateRoutine(
        spec({ style: 'sections', equipment: 'none', recovery: 'passive', sections: 8 }),
        { rng: seeded(seed), now: 0 },
      )
      for (const shape of ladders(workout.blocks)) seen.add(shape)
    }
    expect(seen.size).toBeGreaterThan(6)
  })

  it('reaches every area in the warm-up, lower body included', () => {
    // Filling the quota area by area never got past upper and torso: no leg
    // stretch, jump or trampoline move could be generated at all.
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const { workout } = generateRoutine(
        spec({ style: 'sections', equipment: 'none', recovery: 'passive' }),
        { rng: seeded(seed), now: 0 },
      )
      const warm = workout.blocks.find((b) => b.kind === 'section')
      if (warm?.kind === 'section') for (const name of steps(warm.children)) seen.add(name)
    }
    const lower = EXERCISES.filter((e) => e.area === 'lower' && (e.use === 'mobility' || e.use === 'cardio'))
    expect(lower.some((e) => seen.has(e.name))).toBe(true)
  })

  it('can warm up with a torso stretch', () => {
    // The warm-up theme listed lower and upper only, so the two torso mobility
    // moves could never be drawn.
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const { workout } = generateRoutine(
        spec({ style: 'sections', equipment: 'none', recovery: 'passive' }),
        { rng: seeded(seed), now: 0 },
      )
      const warm = workout.blocks.find((b) => b.kind === 'section')
      if (warm?.kind === 'section') for (const name of steps(warm.children)) seen.add(name)
    }
    expect([...seen].some((name) => ['Torso Rotations', 'Inchworms'].includes(name))).toBe(true)
  })
})

describe('what it says when a chosen exercise is unknown', () => {
  it('notes a warm-up or cool-down it could not find, as it does for the recovery', () => {
    const { notes } = generateRoutine(
      spec({ recovery: 'active', warmUpExercise: 'Unicycling', coolDownExercise: 'Levitation' }),
      { rng: seeded(1), now: 0 },
    )
    expect(notes.join(' ')).toMatch(/"Unicycling" for the warm-up/)
    expect(notes.join(' ')).toMatch(/"Levitation" for the cool-down/)
  })
})
