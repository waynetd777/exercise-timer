/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import general from './emails/2026-07-20-general.txt?raw'
import trampoline from './emails/2026-08-03-trampoline.txt?raw'
import bands from './emails/2026-08-17-bands.txt?raw'
import emom from './emails/2026-08-25-emom.txt?raw'
import e20260416trampoline from './emails/2026-04-16-trampoline.txt?raw'
import e20260423trampoline from './emails/2026-04-23-trampoline.txt?raw'
import e20260504trampoline from './emails/2026-05-04-trampoline.txt?raw'
import e20260511tabata from './emails/2026-05-11-tabata.txt?raw'
import e20260518trampoline from './emails/2026-05-18-trampoline.txt?raw'
import e20260526trampoline from './emails/2026-05-26-trampoline.txt?raw'
import e20260601tabata from './emails/2026-06-01-tabata.txt?raw'
import e20260622trampoline from './emails/2026-06-22-trampoline.txt?raw'
import e20260629tabata from './emails/2026-06-29-tabata.txt?raw'
import e20260706tabata from './emails/2026-07-06-tabata.txt?raw'
import e20260713trampoline from './emails/2026-07-13-trampoline.txt?raw'
import e20260720general from './emails/2026-07-20-general.txt?raw'
import e20260727trampoline from './emails/2026-07-27-trampoline.txt?raw'
import e20260803trampoline from './emails/2026-08-03-trampoline.txt?raw'
import e20260817bands from './emails/2026-08-17-bands.txt?raw'
import e20260825emom from './emails/2026-08-25-emom.txt?raw'

/** Every routine we hold, for the bar the parser is held to. */
const ALL_EMAILS: Record<string, string> = {
  '2026-04-16-trampoline': e20260416trampoline,
  '2026-04-23-trampoline': e20260423trampoline,
  '2026-05-04-trampoline': e20260504trampoline,
  '2026-05-11-tabata': e20260511tabata,
  '2026-05-18-trampoline': e20260518trampoline,
  '2026-05-26-trampoline': e20260526trampoline,
  '2026-06-01-tabata': e20260601tabata,
  '2026-06-22-trampoline': e20260622trampoline,
  '2026-06-29-tabata': e20260629tabata,
  '2026-07-06-tabata': e20260706tabata,
  '2026-07-13-trampoline': e20260713trampoline,
  '2026-07-20-general': e20260720general,
  '2026-07-27-trampoline': e20260727trampoline,
  '2026-08-03-trampoline': e20260803trampoline,
  '2026-08-17-bands': e20260817bands,
  '2026-08-25-emom': e20260825emom,
}

import { compile, SCHEMA_VERSION } from '../../engine'
import type { Block, Ladder, Repeat, Section, Segment, Workout } from '../../engine'
import { parseItem, parseRoutine } from '../pasteFormat'

const EMAILS = { general, trampoline, bands, emom }

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

  it('reads a trailing "Repeat 2 rounds" as closing the block above it', () => {
    // #5 states the round count LAST, after its six minutes. #2 states the same
    // thing first. Both have to mean two rounds of the whole block.
    const legs = find(parseRoutine(emom).blocks, 'full-leg burn')
    expect(legs.children).toHaveLength(1)
    const round = legs.children[0] as Repeat
    expect(round.kind).toBe('repeat')
    expect(round.times).toBe(2)
    expect(steps([round]).map((step) => step.name)).toContain('Sumo Squats')
  })

  it('does not let a rounds line swallow a block that already has structure', () => {
    // The guard on the rule above: a ladder is structure the routine stated, and
    // a later rounds line opens a group beside it rather than around it.
    const core = find(parseRoutine(emom).blocks, 'core')
    expect(core.children.map((child) => child.kind)).toEqual(['ladder', 'repeat'])
  })

  it('gives every minute of an EMOM the minute, reps and all', () => {
    const arms = find(parseRoutine(emom).blocks, 'arms')
    const round = arms.children[0] as Repeat
    expect(round.times).toBe(2)
    expect(round.children).toHaveLength(5)
    const curls = named([round], 'Bicep Curls')
    expect(curls.durationMs).toBe(60_000)
    expect(curls.reps).toEqual({ kind: 'fixed', count: 12 })
  })

  it('keeps a joined pair inside one minute rather than making it two', () => {
    // Split the way a bulleted line is split, "12 × Lateral Raises + 10 Cross
    // Punches" would run for two minutes instead of one.
    const arms = find(parseRoutine(emom).blocks, 'arms')
    const minutes = steps(arms.children)
    expect(minutes).toHaveLength(5)
    expect(minutes[4]!.name).toBe('12 × Lateral Raises + 10 Cross Punches')
    expect(minutes[4]!.durationMs).toBe(60_000)
  })

  it('rests out the balance of a minute the step does not use', () => {
    // "Minute 6: 30-sec Wall Sit" is thirty seconds of work in a fixed minute.
    const legs = find(parseRoutine(emom).blocks, 'full-leg burn')
    const round = legs.children[0] as Repeat
    const last = steps([round]).slice(-2)
    expect(last[0]).toMatchObject({ name: 'Wall Sit', durationMs: 30_000 })
    expect(last[1]).toMatchObject({ name: 'Rest', role: 'rest', durationMs: 30_000 })
  })

  it('reads a "Minute 4" heading over a bulleted step', () => {
    const legs = find(parseRoutine(emom).blocks, 'full-leg burn')
    expect(named(legs.children, 'RB Squats')).toMatchObject({
      durationMs: 60_000,
      reps: { kind: 'fixed', count: 12 },
    })
  })

  it('takes the exercise for a "30 sec WORK" line from the line below it', () => {
    // The 30/30 form names no exercise on the timed line, and reading it as one
    // produced five steps called "WORK" and lost all five exercises.
    const legs = find(parseRoutine(emom).blocks, '30/30')
    const round = legs.children[0] as Repeat
    expect(round.times).toBe(4)
    expect(steps([round]).map((step) => [step.name, step.durationMs])).toEqual([
      ['RB Lateral Walks', 30_000],
      ['RB Glute Kickbacks', 30_000],
      ['Glute Bridge + RB Abduction', 30_000],
      ['Bulgarian split squat', 30_000],
      ['Goblet Squats', 30_000],
      ['Rest', 30_000],
    ])
  })

  it('reads "3 × 30 seconds" as a round count and the time each step gets', () => {
    const core = find(parseRoutine(emom).blocks, 'core')
    const round = core.children[1] as Repeat
    expect(round.times).toBe(3)
    expect(named([round], 'Forearm Plank').durationMs).toBe(30_000)
  })

  it('spaces a list with the rest stated between its exercises, not after each', () => {
    // "15 sec rest between exercises" over three planks is two rests, not three:
    // the last one runs straight into the next round.
    const core = find(parseRoutine(emom).blocks, 'core')
    const round = core.children[1] as Repeat
    expect(steps([round]).map((step) => step.role)).toEqual([
      'work',
      'rest',
      'work',
      'rest',
      'work',
    ])
    expect(steps([round]).filter((step) => step.role === 'rest')[0]!.durationMs).toBe(15_000)
  })

  it('puts the step that closes every round at the end of the round', () => {
    const text = [
      '#1 Legs',
      'Repeat × 2 rounds',
      '30 sec WORK',
      'Goblet Squats',
      'Every time you finish a round:',
      '10 Mountain Climbers',
    ].join('\n')
    const round = find(parseRoutine(text).blocks, 'legs').children[0] as Repeat

    expect(round.times).toBe(2)
    expect(steps([round]).at(-1)).toMatchObject({
      name: 'Mountain Climbers',
      reps: { kind: 'fixed', count: 10 },
    })
  })

  it('builds an AMRAP as the clock it is, with the round as its note', () => {
    /*
     * The ten minutes is STATED, so it is read: an AMRAP becomes one timed step
     * of that length, and the countdown layout gives it the whole screen with
     * the round in the panel beside it. What the text does not say is how many
     * rounds, and nothing here invents one: that number is the person's to make,
     * live, against the clock.
     *
     * The earlier reading, exercises as steps and the cap as a note, was worse
     * than a skipped line. With no clock and one pass through the list, the app
     * quietly turned a ten-minute block into a single round and said nothing.
     */
    const body = find(parseRoutine(emom).blocks, 'general body')

    expect(body.children).toEqual([
      expect.objectContaining({ name: 'As many rounds as possible', durationMs: 600_000 }),
    ])
    // A section of one timed step counts down rather than listing.
    expect(body.display).toBe('timer')

    /*
     * The whole round is on screen for the whole ten minutes, as written and ONE
     * ITEM PER LINE. The line breaks are the contract: the panel draws a
     * multi-line note as bullets under one another, and a round run together
     * into a paragraph cannot be scanned mid-burpee.
     */
    const note = (body.children[0] as Segment).note!
    expect(note.split('\n')).toEqual([
      '10 × Squat + Shoulder Press',
      '8 × Bulgarian split squat – 4 each leg',
      '10 × Plank Shoulder Taps – 5 each side',
      '6 × Burpees',
      '12 × Russian Twists – 6 each side',
      // The step that closes each round.
      '10 Mountain Climbers',
    ])

    // The instruction itself still sits on the section.
    expect(body.note).toContain('10-MINUTE AMRAP')
  })

  it('leaves an AMRAP with no stated length as a note, having no clock to build', () => {
    const text = ['#1 Core', 'AMRAP', '* 10 × Heel Taps', '* 20 × Russian Twists'].join('\n')
    const core = find(parseRoutine(text).blocks, 'core')

    expect(core.note).toBe('AMRAP')
    expect(steps(core.children).map((step) => step.name)).toEqual(['Heel Taps', 'Russian Twists'])
  })

  it('reads a heading behind an optional marker', () => {
    // "(Optinal)" is the instructor's typo and stays in the name: whether a
    // block is optional is the reader's to know.
    const burnout = find(parseRoutine(emom).blocks, 'final burnout')
    expect(burnout.name).toBe('(Optinal) FINAL BURNOUT – 3-MINUTE CHALLENGE')
    expect(steps(burnout.children)).toHaveLength(7)
  })

  it('reads "LAST 20 SECONDS" as the time for the effort named below it', () => {
    const burnout = find(parseRoutine(emom).blocks, 'final burnout')
    const last = steps(burnout.children).at(-1)!
    expect(last).toMatchObject({ name: 'ALL OUT – Fast Feet!', durationMs: 20_000 })
  })

  it('reads a "Replace rest with …" line as both a step and the reason for it', () => {
    const final = find(parseRoutine(emom).blocks, 'final round')
    expect(final.note).toBe('Replace rest with 30-second Squat Hold')
    expect(steps(final.children)).toEqual([
      expect.objectContaining({ name: 'Squat Hold', durationMs: 30_000 }),
    ])
  })

  it('ends a block at "Then:" instead of carrying it into the ladder above', () => {
    const core = find(parseRoutine(emom).blocks, 'core')
    const ladder = core.children[0] as Ladder
    expect(ladder.counts).toEqual([10, 15, 20])
    expect(steps([ladder]).map((step) => step.name)).not.toContain('Forearm Plank')
  })

  it('compiles what it produces into a runnable routine', () => {
    for (const text of Object.values(EMAILS)) {
      const routine = compile(asWorkout(parseRoutine(text).blocks))
      expect(routine.entries.length).toBeGreaterThan(80)
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

describe('the earlier template, which the routines before July are written in', () => {
  /*
   * Ten routines from 16 April to 6 July are terser than anything the grammar
   * was built for. These are the forms it learned on 2026-08-27, each taken
   * verbatim from one of them.
   */
  const only = (text: string) => {
    const parsed = parseRoutine(text)
    expect(parsed.skipped).toEqual([])
    return parsed
  }

  it('reads a counted line with no bullet at all', () => {
    // "10 x Tricep dips" on its own line, which is how these are written.
    const step = only('#1 Arms\n10 x Tricep dips').blocks
    expect(JSON.stringify(step)).toContain('"name":"Tricep dips"')
    expect(JSON.stringify(step)).toContain('"count":10')
  })

  it('refuses a bare line whose count is followed by arithmetic', () => {
    /*
     * "1 + 2" is an accumulator written down the page. Read as a step it becomes
     * one called "+ 2", and a junk step that looks like a parse is worse than a
     * line reported as unread.
     */
    expect(parseRoutine('#1 Arms\n1 + 2').skipped).toHaveLength(1)
  })

  it('reads a ladder that names its lift on the same line', () => {
    const blocks = only('#1 Legs\n2-4-6-8-10-8-6-4-2 king squats').blocks
    expect(JSON.stringify(blocks)).toContain('"counts":[2,4,6,8,10,8,6,4,2]')
    expect(JSON.stringify(blocks)).toContain('"name":"king squats"')
  })

  it('reads a ladder whose counts come after the lift', () => {
    const blocks = only('#1 Abs\nsit ups 5-10-15-10-5').blocks
    expect(JSON.stringify(blocks)).toContain('"counts":[5,10,15,10,5]')
    expect(JSON.stringify(blocks)).toContain('"name":"sit ups"')
  })

  it('reads a ladder of DURATIONS as the run of timed steps it is', () => {
    /*
     * Not a `Ladder`, whose rungs are rep counts: five steps of cardio, of 20,
     * 30, 45, 30 and 20 seconds. And emphatically not a rep ladder whose main
     * lift is called "sec cardio", which is what it looked like before.
     */
    const parsed = parseRoutine('#1 Warm up\n20-30-45-30-20 sec cardio')
    expect(parsed.skipped).toEqual([])
    const json = JSON.stringify(parsed.blocks)
    expect(json).not.toContain('"kind":"ladder"')
    expect(json).toContain('"durationMs":20000')
    expect(json).toContain('"durationMs":45000')
    expect(json).toContain('"name":"cardio"')
  })

  it('reads one whose unit is repeated on every rung, name first', () => {
    const parsed = parseRoutine('#1 Core\nPlank 20sec-30sec-40sec-30sec-20sec')
    expect(parsed.skipped).toEqual([])
    const json = JSON.stringify(parsed.blocks)
    expect(json).toContain('"name":"Plank"')
    expect(json).toContain('"durationMs":40000')
  })

  it('reads a section marked only by its number, either way round', () => {
    for (const heading of ['#1', '2#', '#Warmup']) {
      const blocks = parseRoutine(`${heading}\n10 x Squats`).blocks
      expect(blocks.some((b) => b.kind === 'section')).toBe(true)
    }
  })

  it('reads a count written after the name', () => {
    const blocks = only('#1 Legs\nwide squats 15x').blocks
    expect(JSON.stringify(blocks)).toContain('"name":"wide squats"')
    expect(JSON.stringify(blocks)).toContain('"count":15')
  })

  it('reads m as minutes', () => {
    const blocks = only('#1 Warm up\n5m ham string stretch').blocks
    expect(JSON.stringify(blocks)).toContain('"durationMs":300000')
  })
})

describe('more of the earlier template', () => {
  const clean = (text: string) => {
    const parsed = parseRoutine(text)
    expect(parsed.skipped).toEqual([])
    return JSON.stringify(parsed.blocks)
  }

  it('reads a duration in a trailing parenthesis, and drops a marker after it', () => {
    // A whole warm-up is written this way: "Jogging (30 sec)". "(Tabata)" names
    // the timer the instructor had in mind, not the step.
    expect(clean('#1 Warm up\nJogging (30 sec)')).toContain('"durationMs":30000')
    const withMarker = clean('#1 Warm up\nKnee lifts (20 sec)(Tabata)')
    expect(withMarker).toContain('"name":"Knee lifts"')
    expect(withMarker).toContain('"durationMs":20000')
  })

  it('leaves a parenthesis that states no unit in the name', () => {
    expect(clean('#1 Legs\n10 x Walking Lunges (5 each leg)')).toContain('"perSide":true')
  })

  it('reads a numbered list written with a dash', () => {
    const blocks = clean('#1 Legs\n1 - 20 x Zulu war dance\n2 - 15 x Jump squats')
    expect(blocks).toContain('"name":"Zulu war dance"')
    expect(blocks).toContain('"name":"Jump squats"')
  })

  it('reads a heading in capitals, and one wrapped in asterisks', () => {
    for (const heading of ['LEGS', 'ABS', '*Warm up* (on trampoline)']) {
      const blocks = parseRoutine(`${heading}\n10 x Squats`).blocks
      expect(blocks.some((b) => b.kind === 'section')).toBe(true)
    }
  })

  it('does not read AMRAP as a shouted heading, since it is a clock', () => {
    // All capitals and short, so the shape rule would take it. It is a step.
    expect(JSON.stringify(parseRoutine('10-MINUTE AMRAP\n* 10 × Heel Taps').blocks)).toContain(
      'As many rounds as possible',
    )
  })

  it('reads a bullet with no space after it', () => {
    expect(clean('#1 Core\n•side plank left')).toContain('"name":"side plank left"')
  })

  it('takes the upper bound of a range, as it already does for rounds', () => {
    // "You can always stop early": a target you might beat beats one you have
    // already passed.
    expect(clean('#1 Arms\n10/12 x lateral raises')).toContain('"count":12')
    expect(clean('#1 Legs\n10-15 x Fire hydrant')).toContain('"count":15')
    expect(clean('#1 Warm up\n1-2mins Jumping jacks')).toContain('"durationMs":120000')
  })
})

describe('shapes the instructor writes that are not steps', () => {
  it('reads a countdown written with commas as a ladder', () => {
    const parsed = parseRoutine('#5 Finisher\n10,9,8,7,6,5,4,3,2,1\n10 Kettlebell Swings')
    expect(parsed.skipped).toEqual([])
    expect(JSON.stringify(parsed.blocks)).toContain('"counts":[10,9,8,7,6,5,4,3,2,1]')
  })

  it('keeps a rung offered in brackets', () => {
    // "(16)" is the instructor saying "if you have it in you". Still a rung.
    const parsed = parseRoutine('#1 Legs\nCounting: 12-8-4-8-12-(16)\nGoblet Squats')
    expect(parsed.skipped).toEqual([])
    expect(JSON.stringify(parsed.blocks)).toContain('"counts":[12,8,4,8,12,16]')
  })

  it('reads rounds written with an x rather than the word', () => {
    for (const line of ['Repeat 3-5x', 'Repeat 2x']) {
      const parsed = parseRoutine(`#1 Legs\n${line}\n* 10 × Squats`)
      expect(parsed.skipped).toEqual([])
      expect(JSON.stringify(parsed.blocks)).toContain('"kind":"repeat"')
    }
  })

  it('reads a count followed by a per-side tail', () => {
    const parsed = parseRoutine('#1 Legs\nCurtsy lunges: 10x per leg')
    expect(parsed.skipped).toEqual([])
    expect(JSON.stringify(parsed.blocks)).toContain('"count":10')
  })
})

describe('a pyramid circuit', () => {
  const PYRAMID = `#1 General body - Pyramid circuit
1 - 20 x Straight legs up overhead crunch
2 - 15 x Plie squats
3 - 10 x Around the world
4 - 5 x Rev lunge/forward lunge

1
1 + 2
1 + 2 + 3
1 + 2 + 3 + 4
1 + 2 + 3
1 + 2
1`

  it('spends the numbered lines rather than doing them once each', () => {
    /*
     * The numbered lines are a VOCABULARY: they say what 1, 2, 3 and 4 mean.
     * The rows below spend them, growing and then shrinking.
     */
    const parsed = parseRoutine(PYRAMID)
    expect(parsed.skipped).toEqual([])
    const section = parsed.blocks.find((b) => b.kind === 'section')!
    const rounds = section.children.filter((c) => c.kind === 'repeat')
    expect(rounds).toHaveLength(7)
    expect(rounds.map((r) => r.children.length)).toEqual([1, 2, 3, 4, 3, 2, 1])
    // And they are not left lying about as loose steps as well.
    expect(section.children.filter((c) => c.kind === 'segment')).toEqual([])
  })

  it('works with the vocabulary written AFTER the rows', () => {
    // One routine puts it each way round, which is why this happens at section
    // close rather than as it reads.
    const [heading, ...rest] = PYRAMID.split('\n')
    const rows = rest.filter((l) => /^\d+(\s*\+|$)/.test(l.trim()) && !l.includes('x'))
    const defs = rest.filter((l) => l.includes(' x '))
    const parsed = parseRoutine([heading, ...rows, '', ...defs].join('\n'))
    expect(parsed.skipped).toEqual([])
    expect(parsed.blocks.find((b) => b.kind === 'section')!.children).toHaveLength(7)
  })

  it('leaves a lone numbered line alone, since it bookends rather than defines', () => {
    // "1 - plank jacks x 10" on its own is an ordinary step. Wayne's reading:
    // in her routine it bookends the pyramid on both sides.
    const parsed = parseRoutine('#1 Legs\n1 - plank jacks x 10')
    expect(parsed.skipped).toEqual([])
    expect(JSON.stringify(parsed.blocks)).toContain('"name":"plank jacks"')
  })

  it('reports the rows rather than dropping them when nothing defines them', () => {
    const parsed = parseRoutine('#1 Legs\n1 + 2\n1 + 2 + 3')
    expect(parsed.skipped).toHaveLength(2)
  })
})

describe('the last of the earlier template', () => {
  const clean = (text: string) => {
    const parsed = parseRoutine(text)
    expect(parsed.skipped).toEqual([])
    return parsed
  }

  it('reads a course drawn in characters, and names its legs by the markers', () => {
    /*
     * The diagram is the shape of the room, not a step, so it becomes the
     * section's note and its distance measures the legs beneath it. The markers
     * are kept rather than turned into forwards and backwards: they are what
     * the diagram labelled, and it is still there to point at.
     */
    const parsed = clean('#1 General body\nA🔺-------5m———🔺B\nWalking lunge A-B\nWalking lunge B-A')
    const section = parsed.blocks.find((b) => b.kind === 'section')!
    expect(section.note).toContain('5m')
    expect(section.children.map((c) => (c.kind === 'segment' ? c.name : ''))).toEqual([
      'Walking lunge 5m A-B',
      'Walking lunge 5m B-A',
    ])
  })

  it('lets a step wait for Next where its length cannot be worked out', () => {
    // "Whatever is left of the minute" is not a number the app can know, and a
    // made-up thirty seconds would be it inventing one.
    const parsed = clean('#1 Finisher\nWall sit (time remaining after the 10 lunges per leg)')
    const step = parsed.blocks.find((b) => b.kind === 'section')!.children[0]!
    expect(step.kind === 'segment' && step.durationMs).toBeUndefined()
  })

  it('reads an interval pair as the two steps it is', () => {
    const parsed = clean('#1 Legs\nSquats 20sec - 10sec squat hold')
    const json = JSON.stringify(parsed.blocks)
    expect(json).toContain('"durationMs":20000')
    expect(json).toContain('"durationMs":10000')
    expect(json).toContain('squat hold')
  })

  it('reads a ladder written with arrows', () => {
    expect(JSON.stringify(clean('Push-Up wave:\n5 → 10 → 15 → 10 → 5\nPush-ups').blocks)).toContain(
      '"counts":[5,10,15,10,5]',
    )
  })

  it('reads a heading that ends in a colon, and one behind an emoji', () => {
    for (const heading of ['Exercises:', '💥 Bonus Challenge', 'Optional Burner (if you want to)']) {
      const blocks = clean(`${heading}\n10 x Squats`).blocks
      expect(blocks.some((b) => b.kind === 'section')).toBe(true)
    }
  })
})

describe('the whole corpus', () => {
  it('is understood, every line of all sixteen routines', () => {
    /*
     * The bar this parser is held to, and the assertion that fails first when
     * the instructor writes something new. It was 53% when the twelve older
     * routines were added on 2026-08-27.
     */
    for (const [name, text] of Object.entries(ALL_EMAILS)) {
      expect(parseRoutine(text).skipped.map((entry) => entry.text), name).toEqual(
        KNOWN_UNPLACED[name] ?? [],
      )
    }
  })
})

/**
 * The lines the parser cannot place and SAYS so. One: a closing "challenge" that
 * reads as a heading and has nothing under it. It was dropped silently until
 * empty headings at the end of the text were reported; the rule is that a line
 * lands somewhere or is reported, and this is the reporting.
 */
const KNOWN_UNPLACED: Record<string, string[]> = {
  '2026-07-13-trampoline': [
    '🔥 Challenge: Finish with a 60-second wall sit to empty the tank! 💪🏻 \u200e',
  ],
}

describe('a heading with nothing under it', () => {
  it('is reported rather than dropped', () => {
    // "Cool down walk for 2 minutes" as the last line matched the heading
    // vocabulary, opened a section, and vanished when the section closed empty.
    const parsed = parseRoutine('#1 Legs\n10 x Squats\nCool down walk for 2 minutes')
    expect(parsed.blocks.map((b) => (b.kind === 'section' ? b.name : b.kind))).toEqual([
      'segment',
      'Legs',
    ])
    expect(parsed.skipped).toEqual([{ line: 3, text: 'Cool down walk for 2 minutes' }])
  })
})

describe('a date is not a ladder', () => {
  it('leaves "2026-04-16" out of the routine rather than reading it as rungs', () => {
    const parsed = parseRoutine('2026-04-16\n10 x Squats')
    const kinds: string[] = []
    const walk = (blocks: readonly typeof parsed.blocks[number][]) => {
      for (const block of blocks) {
        kinds.push(block.kind)
        if (block.kind !== 'segment') walk(block.children)
      }
    }
    walk(parsed.blocks)
    expect(kinds).not.toContain('ladder')
    expect(parsed.skipped.map((entry) => entry.text)).toEqual(['2026-04-16'])
  })
})

describe('blocks that used to bleed into each other', () => {
  const names = (blocks: readonly Block[]): string[] =>
    blocks.flatMap((b) => (b.kind === 'segment' ? [b.name] : names(b.children)))

  it('does not wrap an AMRAP clock in the rounds written after it', () => {
    // Flushed, the AMRAP was one more loose segment, and "4 Rounds" swallowed
    // it: forty minutes of AMRAP.
    const parsed = parseRoutine('10-minute AMRAP\n* 10 squats\n* 5 burpees\n4 Rounds\n* 10 lunges')
    const section = parsed.blocks.find((b) => b.kind === 'section')
    if (section?.kind !== 'section') throw new Error('no section')
    const rounds = section.children.find((b) => b.kind === 'repeat')
    if (rounds?.kind !== 'repeat') throw new Error('no rounds')
    expect(names(rounds.children)).toEqual(['lunges'])
    expect(names(section.children)[0]).toBe('As many rounds as possible')
  })

  it('ends an AMRAP at "Then:"', () => {
    const parsed = parseRoutine('10-minute AMRAP\n* 10 squats\nThen:\n* 20 lunges')
    const section = parsed.blocks.find((b) => b.kind === 'section')
    if (section?.kind !== 'section') throw new Error('no section')
    const amrap = section.children[0]
    if (amrap?.kind !== 'segment') throw new Error('no amrap')
    expect(amrap.note).toBe('10 squats')
    expect(names(section.children)).toContain('lunges')
  })

  it('reads a bulleted ladder of durations as its rungs', () => {
    const parsed = parseRoutine('#1 Core\n- Plank 20sec-30sec-40sec')
    expect(names(parsed.blocks).filter((n) => n === 'Plank')).toHaveLength(3)
  })

  it('reads a bare "Rest 30 seconds" inside a section as a rest step', () => {
    const parsed = parseRoutine('#1 Legs\n10 x Squats\nRest 30 seconds\n10 x Lunges')
    const section = parsed.blocks.find((b) => b.kind === 'section')
    if (section?.kind !== 'section') throw new Error('no section')
    const rest = section.children.find((b) => b.kind === 'segment' && b.role === 'rest')
    expect(rest).toMatchObject({ durationMs: 30_000 })
    expect(section.note).toBeUndefined()
  })

  it('keeps a joined pair under a "Minute N" heading as one minute, like the one-line form', () => {
    const twoLine = parseRoutine('Minute 4\n* 12 × Lateral Raises + 10 Cross Punches')
    const oneLine = parseRoutine('Minute 4: 12 × Lateral Raises + 10 Cross Punches')
    expect(names(twoLine.blocks)).toEqual(names(oneLine.blocks))
    const segments = (blocks: readonly Block[]): Block[] =>
      blocks.flatMap((b) => (b.kind === 'segment' ? [b] : segments(b.children)))
    const step = segments(twoLine.blocks).find((b) => b.kind === 'segment' && b.role === 'work')
    expect(step?.kind === 'segment' && step.durationMs).toBe(60_000)
  })
})

describe('small refusals that used to be silent', () => {
  it('reports a pyramid row that names a rung nothing defined', () => {
    const parsed = parseRoutine('#1 Body\n1 - 20 x Squats\n2 - 15 x Lunges\n\n1\n1 + 2\n1 + 2 + 5')
    expect(parsed.skipped.map((entry) => entry.text)).toEqual(['1 + 2 + 5'])
  })

  it('does not read a shouted REST as a heading', () => {
    const parsed = parseRoutine('#1 Legs\n10 x Squats\nREST\n10 x Lunges')
    expect(parsed.blocks.filter((b) => b.kind === 'section').map((b) => b.name)).toEqual(['Legs'])
  })

  it('refuses "0 Rounds" rather than building a group that never runs', () => {
    const parsed = parseRoutine('0 Rounds\n10 x Squats')
    expect(parsed.skipped.map((entry) => entry.text)).toEqual(['0 Rounds'])
  })

  it('does not take the x off a word that starts with one', () => {
    expect(parseItem('10 xtreme pushups')).toMatchObject({ name: 'xtreme pushups', count: 10 })
    expect(parseItem('10x Squats')).toMatchObject({ name: 'Squats', count: 10 })
    expect(parseItem('10 x Squats')).toMatchObject({ name: 'Squats', count: 10 })
  })
})
