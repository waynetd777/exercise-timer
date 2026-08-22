import { describe, expect, it } from 'vitest'
import general from './emails/2026-07-20-general.txt?raw'
import trampoline from './emails/2026-08-03-trampoline.txt?raw'
import bands from './emails/2026-08-17-bands.txt?raw'
import { compile, SCHEMA_VERSION } from '../../engine'
import type { Block, Ladder, Repeat, Section, Segment, Workout } from '../../engine'
import { parseItem, parseRoutine } from '../pasteFormat'

const EMAILS = { general, trampoline, bands }

function sections(blocks: Block[]): Section[] {
  return blocks.filter((block): block is Section => block.kind === 'section')
}

function find(blocks: Block[], name: string): Section {
  const found = sections(blocks).find((section) => section.name.toLowerCase().includes(name))
  if (!found) throw new Error(`no section matching "${name}"`)
  return found
}

function steps(blocks: Block[]): Segment[] {
  return blocks.flatMap((block) => (block.kind === 'segment' ? [block] : steps(block.children)))
}

function named(blocks: Block[], name: string): Segment {
  const found = steps(blocks).find((step) => step.name === name)
  if (!found) throw new Error(`no step named "${name}"`)
  return found
}

function asWorkout(blocks: Block[]): Workout {
  return {
    id: 'test',
    name: 'Test',
    blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('parseRoutine: the real emails', () => {
  /*
   * The bar for this parser: it understands every line of all three routines.
   * A line it cannot place is reported rather than dropped, so an empty
   * `skipped` is the whole promise, and this assertion is the one that fails
   * first when the instructor writes something new.
   */
  it.each(Object.entries(EMAILS))('understands every line of the %s routine', (_name, text) => {
    expect(parseRoutine(text).skipped).toEqual([])
  })

  it('opens with five seconds to get ready, which no email asks for', () => {
    /*
     * The one thing the parser adds. A person reading the email is already
     * standing there; someone using the app has to put the phone down first.
     */
    const blocks = parseRoutine(general).blocks
    expect(blocks[0]).toMatchObject({
      kind: 'segment',
      name: 'Get ready',
      role: 'prepare',
      durationMs: 5_000,
    })
  })

  it('does not add one when the routine already starts with a prepare step', () => {
    const own = parseRoutine('Warm-up\n30 sec each\n* Get set')
    const steps = own.blocks.flatMap((block) =>
      block.kind === 'segment' ? [block] : block.children,
    )
    expect(own.blocks.filter((block) => block.kind === 'segment')).toHaveLength(0)
    expect(steps).toHaveLength(1)
  })

  it('adds nothing to text with no routine in it', () => {
    expect(parseRoutine('shopping list\nmilk').blocks).toEqual([])
  })

  it('reads the sections in order', () => {
    expect(sections(parseRoutine(general).blocks).map((s) => s.name)).toEqual([
      'Warm-up',
      'General Body',
      'Arms & Shoulders',
      'Legs',
      'Core',
      'After Round 5',
      'Legs Finisher – Burnout Ladder',
      'Final Burnout',
    ])
  })

  it('shows an all-timed section as a timer and a rep-based one as a list', () => {
    const blocks = parseRoutine(general).blocks
    expect(find(blocks, 'warm-up').display).toBe('timer')
    expect(find(blocks, 'arms').display).toBe('list')
  })

  it('applies "40 sec each" to the list that follows, and "30 sec each" to the next', () => {
    const warmUp = find(parseRoutine(general).blocks, 'warm-up')
    const durations = steps([warmUp]).map((step) => step.durationMs)
    expect(durations).toEqual([40, 40, 40, 40, 40, 40, 30, 30, 30, 30].map((s) => s * 1000))
  })

  it('reads a ladder, with every uncounted exercise scaling to the rung', () => {
    const ladder = find(parseRoutine(general).blocks, 'general body').children[0] as Ladder

    expect(ladder.kind).toBe('ladder')
    expect(ladder.counts).toEqual([2, 4, 6, 8, 10, 8, 6, 4, 2])
    // Every exercise scales, and "Speed Skaters (each side)" scales PER SIDE.
    expect(ladder.children.map((child) => (child as Segment).reps)).toEqual([
      { kind: 'rung' },
      { kind: 'rung', perSide: true },
      { kind: 'rung' },
      { kind: 'rung' },
      { kind: 'rung' },
    ])
  })

  it('keeps a stated count fixed while the main lift scales: one rule, both shapes', () => {
    const ladder = find(parseRoutine(general).blocks, 'legs').children[0] as Ladder

    expect(ladder.counts).toEqual([15, 12, 9, 6, 3, 6, 9, 12, 15])
    expect(ladder.children.map((child) => (child as Segment).reps)).toEqual([
      { kind: 'rung' },
      { kind: 'fixed', count: 5, perSide: true },
      { kind: 'fixed', count: 10, perSide: true },
    ])
  })

  it('takes the main lift from a "Main Exercise:" line, not the instruction above it', () => {
    // "Complete the main exercise at each count." sits between the counts and
    // the exercise, and was read as the exercise until it became a note.
    const legs = find(parseRoutine(bands).blocks, 'legs')
    const ladder = legs.children[0] as Ladder

    expect((ladder.children[0] as Segment).name).toBe('Goblet Squats')
    expect(legs.note).toContain('Complete the main exercise at each count.')
  })

  it('reads rounds, and puts the stated rest inside the group', () => {
    const arms = find(parseRoutine(general).blocks, 'arms')
    const round = arms.children[0] as Repeat

    expect(round).toMatchObject({ kind: 'repeat', times: 4, label: 'Round' })
    expect(round.children.map((child) => (child as Segment).name)).toEqual([
      'Hammer Curls',
      'Shoulder Press',
      'Lateral Raises',
      'Bent-over Rows',
      'Front Punches',
      'Rest',
    ])
    expect((round.children.at(-1) as Segment).durationMs).toBe(45_000)
  })

  it('takes the upper bound of a rounds or rest range', () => {
    // "3-5 Rounds" and "Rest: 30-45 seconds". The runner can always end early.
    const core = find(parseRoutine(bands).blocks, 'core').children[0] as Repeat
    expect(core.times).toBe(5)
    expect(named(parseRoutine(trampoline).blocks, 'Rest').durationMs).toBe(45_000)
  })

  it('keeps the section instruction as a note rather than as a step', () => {
    expect(find(parseRoutine(general).blocks, 'arms').note).toBe(
      'No rest between exercises. Rest 45 seconds after each round.',
    )
  })

  it('reads a timed step sitting inside a rep list', () => {
    expect(named(parseRoutine(general).blocks, 'Plank')).toMatchObject({ durationMs: 30_000 })
    expect(named(parseRoutine(general).blocks, 'Wall Sit')).toMatchObject({ durationMs: 10_000 })
  })

  it('reads a heading with no marker of its own', () => {
    // "After Round 4" in one email, "🔥 After Round 5:" in another.
    expect(sections(parseRoutine(trampoline).blocks).map((s) => s.name)).toContain('After Round 4')
  })

  it('reads a bare timed line as a step', () => {
    expect(named(parseRoutine(trampoline).blocks, 'Sprint Finish – Fast feet')).toMatchObject({
      durationMs: 15_000,
    })
  })

  it('splits one line that states two counted exercises, and only then', () => {
    const blocks = parseRoutine(trampoline).blocks
    // "20 × Front Punches + 20 × Uppercuts" is two movements.
    expect(named(blocks, 'Front Punches').reps).toEqual({ kind: 'fixed', count: 20 })
    expect(named(blocks, 'Uppercuts').reps).toEqual({ kind: 'fixed', count: 20 })
    // "Squat + Shoulder Press" is one, and must survive intact.
    expect(named(parseRoutine(general).blocks, 'Squat + Shoulder Press')).toBeTruthy()
  })

  it('keeps a bulleted "30 seconds each side" line as a step, not a directive', () => {
    /*
     * The each-for directive used to eat this bullet whole: the step vanished
     * without even a `skipped` entry, and its 30 seconds retimed every
     * uncounted exercise after it.
     */
    const parsed = parseRoutine(
      '#4 Core\n* 15 × Russian Twists (each side)\n* Side Plank - 30 seconds each side\n* V-Ups',
    )
    expect(parsed.skipped).toEqual([])
    expect(named(parsed.blocks, 'Side Plank')).toMatchObject({ durationMs: 30_000 })
    expect(named(parsed.blocks, 'V-Ups').durationMs).toBeUndefined()
  })

  it('splits a joined pair even when the counts have no multiplier sign', () => {
    // "20 Front Punches + 20 Uppercuts" was one step named after both.
    const blocks = parseRoutine('#1 Boxing\n* 20 Front Punches + 20 Uppercuts').blocks
    expect(named(blocks, 'Front Punches').reps).toEqual({ kind: 'fixed', count: 20 })
    expect(named(blocks, 'Uppercuts').reps).toEqual({ kind: 'fixed', count: 20 })
  })

  it('reads an each-for directive stated in minutes', () => {
    const parsed = parseRoutine('Warm-up - 1 minute each\n* March\n* High Knees')
    expect(parsed.skipped).toEqual([])
    expect(named(parsed.blocks, 'March').durationMs).toBe(60_000)
    expect(named(parsed.blocks, 'High Knees').durationMs).toBe(60_000)
  })

  it('lets a step state minutes under a seconds directive', () => {
    // "* Plank - 1 minute" was silently made a 40-second step.
    const parsed = parseRoutine('Warm-up\n40 sec each\n* Jumping Jacks\n* Plank - 1 minute')
    expect(parsed.skipped).toEqual([])
    expect(named(parsed.blocks, 'Jumping Jacks').durationMs).toBe(40_000)
    expect(named(parsed.blocks, 'Plank').durationMs).toBe(60_000)
  })

  it('compiles what it produces into a runnable routine', () => {
    for (const text of Object.values(EMAILS)) {
      const routine = compile(asWorkout(parseRoutine(text).blocks))
      expect(routine.entries.length).toBeGreaterThan(100)
      expect(routine.hasGates).toBe(true)
      // Every self-paced step is its own run, so runs track the rep-based steps.
      expect(routine.runs.length).toBeGreaterThan(routine.runs.filter((r) => !r.selfPaced).length)
    }
  })
})

describe('parseItem', () => {
  it('reads a count', () => {
    expect(parseItem('12 × Hammer Curls')).toMatchObject({ name: 'Hammer Curls', count: 12 })
    expect(parseItem('20 Flutter Kicks')).toMatchObject({ name: 'Flutter Kicks', count: 20 })
  })

  it('reads a duration before it reads a count', () => {
    // "30-second Plank" starts with a number that is not a rep count.
    expect(parseItem('30-second Plank')).toMatchObject({ name: 'Plank', durationMs: 30_000 })
    expect(parseItem('Fast feet for 15 seconds')).toMatchObject({
      name: 'Fast feet',
      durationMs: 15_000,
    })
  })

  it('reads a duration stated at the end of the name', () => {
    expect(parseItem('Side Plank - 30 seconds each side')).toMatchObject({
      name: 'Side Plank',
      durationMs: 30_000,
      perSide: true,
    })
    expect(parseItem('Plank - 1 minute')).toMatchObject({ name: 'Plank', durationMs: 60_000 })
  })

  it('reads minutes wherever it reads seconds', () => {
    expect(parseItem('1-minute Wall Sit')).toMatchObject({ name: 'Wall Sit', durationMs: 60_000 })
    expect(parseItem('Jog for 2 min')).toMatchObject({ name: 'Jog', durationMs: 120_000 })
    expect(parseItem('Plank - 1.5 minutes')).toMatchObject({ durationMs: 90_000 })
  })

  it('takes the per-side count as the real one, in either notation', () => {
    // Ten lunges, five a side, not ten a side.
    expect(parseItem('10 × Walking Lunges (5 each leg)')).toMatchObject({ count: 5, perSide: true })
    expect(parseItem('10 × RB Lateral Walks – 5 each direction')).toMatchObject({
      count: 5,
      perSide: true,
    })
  })

  it('marks per-side without inventing a count', () => {
    expect(parseItem('15 × Russian Twists (each side)')).toMatchObject({ count: 15, perSide: true })
  })

  it('lifts an alternative out of the name', () => {
    expect(parseItem('10 × Jump Lunges (or Reverse Lunges for low impact)')).toMatchObject({
      name: 'Jump Lunges',
      alternative: 'Reverse Lunges for low impact',
    })
    expect(parseItem('Burpees – step-back option for low impact')).toMatchObject({
      name: 'Burpees',
      alternative: 'step-back option for low impact',
    })
  })

  it('drops a bracket left dangling by the alternative it qualified', () => {
    expect(
      parseItem('Bulgarian Split Squats (alternate legs each set, or perform half the reps per leg)'),
    ).toMatchObject({ name: 'Bulgarian Split Squats', alternative: 'perform half the reps per leg' })
  })

  it('lifts a long trailing instruction out of the name', () => {
    // 159 characters as one step name, which no amount of sizing renders
    // legibly across a gym. The instruction is kept, just not in the name.
    const item = parseItem(
      'Side-to-Side Squats with a Reach (start standing, step out to one side, sink your hips into a squat, and reach your arms across your body for an added stretch)',
    )
    expect(item.name).toBe('Side-to-Side Squats with a Reach')
    expect(item.note).toContain('start standing')
  })

  it('keeps a short trailing parenthetical, which is part of the name', () => {
    expect(parseItem('Easy Bounce (basic)').name).toBe('Easy Bounce (basic)')
    expect(parseItem('Jumping Jacks (floor or trampoline)').note).toBeUndefined()
  })

  it('keeps a parenthetical that glosses a term mid-name', () => {
    // Only a TRAILING one is a description.
    expect(parseItem('10 × RB (resistance band) Lateral Walks').name).toBe(
      'RB (resistance band) Lateral Walks',
    )
  })

  it('drops a bracketed per-side note, which the effort column already says', () => {
    // "12 × each side  Speed Skaters (each side)" would print it twice.
    expect(parseItem('12 × Speed Skaters (each side)')).toMatchObject({
      name: 'Speed Skaters',
      perSide: true,
    })
    // A dashed one reads as part of the name, and cutting it leaves a dangling dash.
    expect(parseItem('12 × Plank Shoulder Taps – each side').name).toBe(
      'Plank Shoulder Taps – each side',
    )
  })

  it('leaves no step name long enough to be unreadable', () => {
    // The guard on the whole pipeline: 159 characters was the worst case before
    // descriptions were lifted out, and it broke every box it was put in.
    for (const text of Object.values(EMAILS)) {
      const longest = Math.max(
        ...steps(parseRoutine(text).blocks).map((step) => step.name.length),
      )
      expect(longest).toBeLessThanOrEqual(60)
    }
  })

  it('leaves a compound exercise name alone', () => {
    expect(parseItem('Thrusters – squat + press').name).toBe('Thrusters – squat + press')
    expect(parseItem('Squat + Shoulder Press').name).toBe('Squat + Shoulder Press')
  })
})
