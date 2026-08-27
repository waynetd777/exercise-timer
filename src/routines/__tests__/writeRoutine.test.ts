/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { parseRoutine } from '../pasteFormat'
import { PASTE_TEMPLATE } from '../pasteTemplate'
import { textFilename, writeRoutine } from '../writeRoutine'
import type { Block, Segment, Workout } from '../../engine/types'
import { SCHEMA_VERSION } from '../../engine/types'

function workout(blocks: Block[], name = 'W'): Workout {
  return { id: 'w', name, blocks, schemaVersion: SCHEMA_VERSION, createdAt: 0, updatedAt: 0 }
}

/** Everything a block means, minus ids, which the parser regenerates. */
function shape(blocks: readonly Block[]): unknown {
  return blocks.map((block) => {
    if (block.kind === 'segment') {
      const { id: _id, ...rest } = block
      return rest
    }
    const { id: _id, children, ...rest } = block
    return { ...rest, children: shape(children) }
  })
}

/**
 * One write-and-read pass.
 *
 * The first pass NORMALISES rather than round-trips, and both normalisations are
 * the parser's, not the writer's: a routine that does not open on a get-ready
 * gains a five-second one, and loose top-level steps are gathered into a section
 * called "Routine". Neither is expressible, so neither can be written away.
 *
 * The property that does hold, and the one worth pinning, is that the SECOND
 * pass changes nothing. Text export is a fixed point after one pass, so a
 * routine that has been through it once can be sent, re-imported and sent again
 * without drifting.
 */
function pass(blocks: Block[]): Block[] {
  return parseRoutine(writeRoutine(workout(blocks)).text, 'W').blocks
}

function settles(blocks: Block[], passes = 1): void {
  let settled = blocks
  for (let i = 0; i < passes; i += 1) settled = pass(settled)
  expect(shape(pass(settled))).toEqual(shape(settled))
}

/** The first step anywhere in the tree whose name matches. */
function find(blocks: readonly Block[], name: string): Segment {
  for (const block of blocks) {
    if (block.kind === 'segment') {
      if (block.name === name) return block
    } else {
      const hit = findOrNull(block.children, name)
      if (hit) return hit
    }
  }
  throw new Error(`no step called ${name} in ${JSON.stringify(shape(blocks))}`)
}

function findOrNull(blocks: readonly Block[], name: string): Segment | null {
  for (const block of blocks) {
    if (block.kind === 'segment') {
      if (block.name === name) return block
    } else {
      const hit = findOrNull(block.children, name)
      if (hit) return hit
    }
  }
  return null
}

const step = (over: Partial<Segment> & { name: string }): Segment => ({
  kind: 'segment',
  id: 's',
  role: 'work',
  ...over,
})

describe('a step survives being written and read', () => {
  it('keeps a duration', () => {
    const back = find(pass([step({ name: 'Plank', durationMs: 30_000 })]), 'Plank')
    expect(back).toMatchObject({ durationMs: 30_000, role: 'work' })
  })

  it('keeps a count', () => {
    const back = find(
      pass([step({ name: 'Hammer Curls', reps: { kind: 'fixed', count: 12 } })]),
      'Hammer Curls',
    )
    expect(back.reps).toEqual({ kind: 'fixed', count: 12 })
  })

  it('keeps a per-side count, which needs the parser’s own doubled form', () => {
    const back = find(
      pass([step({ name: 'Walking Lunges', reps: { kind: 'fixed', count: 5, perSide: true } })]),
      'Walking Lunges',
    )
    expect(back.reps).toEqual({ kind: 'fixed', count: 5, perSide: true })
  })

  it('writes exact minutes as minutes, and reads them back the same', () => {
    const written = writeRoutine(workout([step({ name: 'Warm Up', durationMs: 600_000 })]))
    expect(written.text).toContain('10 minutes')
    expect(find(pass([step({ name: 'Warm Up', durationMs: 600_000 })]), 'Warm Up')).toMatchObject({
      durationMs: 600_000,
    })
  })

  it('keeps a note long enough to be one, alongside a duration', () => {
    const note = 'start standing, step out to one side and sink your hips'
    const back = find(pass([step({ name: 'Side Squats', durationMs: 30_000, note })]), 'Side Squats')
    expect(back).toMatchObject({ note, durationMs: 30_000 })
  })

  it('keeps an alternative', () => {
    const back = find(
      pass([
        step({ name: 'Push-ups', reps: { kind: 'fixed', count: 15 }, alternative: 'Knee Push-ups' }),
      ]),
      'Push-ups',
    )
    expect(back.alternative).toBe('Knee Push-ups')
  })

  it('keeps a name that contains a dash', () => {
    const back = find(pass([step({ name: 'Cable Fly - Standing', durationMs: 20_000 })]), 'Cable Fly - Standing')
    expect(back.durationMs).toBe(20_000)
  })

  it('keeps a count that lives in the name, which is how weights are written', () => {
    const back = find(
      pass([step({ name: '12 × Leg Press 65kg', durationMs: 20_000 })]),
      '12 × Leg Press 65kg',
    )
    expect(back).toMatchObject({ durationMs: 20_000, role: 'work' })
  })

  it('keeps a rest and a get-ready, by their names', () => {
    const back = pass([
      step({ name: 'Get ready', role: 'prepare', durationMs: 15_000 }),
      step({ name: 'Squats', durationMs: 20_000 }),
      step({ name: 'Rest', role: 'rest', durationMs: 10_000 }),
    ])
    expect(find(back, 'Get ready')).toMatchObject({ role: 'prepare', durationMs: 15_000 })
    expect(find(back, 'Rest')).toMatchObject({ role: 'rest', durationMs: 10_000 })
  })
})

describe('a group survives being written and read', () => {
  const repsGroup: Block = {
    kind: 'repeat',
    id: 'r',
    times: 3,
    label: 'Set',
    children: [
      step({ name: '12 × Leg Press 65kg', durationMs: 20_000 }),
      step({ name: 'Rest', role: 'rest', durationMs: 10_000 }),
    ],
  }

  it('keeps the round count and the rest between rounds', () => {
    const back = pass([step({ name: 'Get ready', role: 'prepare', durationMs: 15_000 }), repsGroup])
    const group = JSON.stringify(shape(back))
    expect(group).toContain('"times":3')
    expect(find(back, 'Rest')).toMatchObject({ durationMs: 10_000, role: 'rest' })
  })

  it('keeps a section name', () => {
    const back = pass([
      {
        kind: 'section',
        id: 'sec',
        name: 'Upper Body',
        display: 'list',
        children: [step({ name: 'Push-ups', reps: { kind: 'fixed', count: 15 } })],
      },
    ])
    expect(JSON.stringify(shape(back))).toContain('"name":"Upper Body"')
  })

  it('keeps a ladder’s counts, its main lift and its accessories', () => {
    const back = pass([
      {
        kind: 'ladder',
        id: 'l',
        counts: [10, 8, 6],
        children: [
          step({ name: 'Goblet Squats', reps: { kind: 'rung' } }),
          step({ name: 'Hammer Curls', reps: { kind: 'fixed', count: 12 } }),
        ],
      },
    ])
    expect(JSON.stringify(shape(back))).toContain('"counts":[10,8,6]')
    expect(find(back, 'Goblet Squats').reps).toEqual({ kind: 'rung' })
    expect(find(back, 'Hammer Curls').reps).toEqual({ kind: 'fixed', count: 12 })
  })

  it('closes a group before a loose step, or the step is read into it', () => {
    const blocks: Block[] = [
      { kind: 'repeat', id: 'r', times: 3, children: [step({ name: 'Squat', durationMs: 20_000 })] },
      step({ name: 'Cool Down', durationMs: 60_000 }),
    ]
    expect(writeRoutine(workout(blocks)).text).toContain('Then:')

    // The proof it worked: Cool Down is a SIBLING of the group, not a fourth
    // rep of it. Without the separator it would be inside, and run three times.
    const back = pass(blocks)
    const group = JSON.parse(JSON.stringify(shape(back))) as { children?: unknown[] }[]
    const section = group.find((block) => Array.isArray(block.children))!
    const kinds = (section.children as { kind: string; name?: string }[]).map(
      (child) => child.name ?? child.kind,
    )
    expect(kinds).toEqual(['repeat', 'Cool Down'])
  })
})

describe('writing is a fixed point after one pass', () => {
  it('for the shipped template, which uses every part of the grammar', () => {
    /*
     * Two passes, not one, and the template is the only shape that needs the
     * second. Its AMRAP sits INSIDE a rounds group, where the AMRAP heading
     * cannot be written: it would go on collecting the group's remaining steps
     * as its round, and the only thing that closes it, `Then:`, ends the group
     * instead. So that one step is written as the plain six-minute countdown it
     * is, and its round goes. Once gone, nothing moves again.
     */
    const template = parseRoutine(PASTE_TEMPLATE, 'Template').blocks
    expect(writeRoutine(workout(template)).lost).toContain(
      'The note on "As many rounds as possible", which runs to several lines',
    )
    settles(template, 2)
  })

  it('writes an AMRAP as an AMRAP where a heading, or the end, follows it', () => {
    // Nothing but a section heading ends an AMRAP's round, so this is the shape
    // in which its round survives: last in the routine, or last before a heading.
    const amrap = step({
      name: 'As many rounds as possible',
      durationMs: 360_000,
      note: '10 × Heel Taps\n20 × Russian Twists',
    })
    const blocks: Block[] = [step({ name: 'Squat', durationMs: 20_000 }), amrap]

    const written = writeRoutine(workout(blocks))
    expect(written.text).toContain('6-minute AMRAP (as many rounds as possible)')
    expect(written.lost).not.toContain(
      'The note on "As many rounds as possible", which runs to several lines',
    )

    const back = find(pass(blocks), 'As many rounds as possible')
    expect(back).toMatchObject({
      durationMs: 360_000,
      note: '10 × Heel Taps\n20 × Russian Twists',
    })
    settles(blocks)
  })

  it('writes a plain countdown where the round could not follow it', () => {
    // A step after the AMRAP would be eaten by its round, so the round goes
    // instead of the step. The loss is reported rather than taken quietly.
    const blocks: Block[] = [
      step({
        name: 'As many rounds as possible',
        durationMs: 360_000,
        note: '10 × Heel Taps\n20 × Russian Twists',
      }),
      step({ name: 'Cool Down', durationMs: 60_000 }),
    ]
    const written = writeRoutine(workout(blocks))
    expect(written.text).not.toContain('AMRAP')
    expect(written.lost).toContain(
      'The note on "As many rounds as possible", which runs to several lines',
    )
    expect(find(pass(blocks), 'Cool Down').durationMs).toBe(60_000)
    settles(blocks)
  })
})

describe('writeRoutine says what it could not say', () => {
  const lostFor = (blocks: Block[]) => writeRoutine(workout(blocks)).lost

  it('names a dropped picture', () => {
    expect(
      lostFor([
        step({
          name: 'Leg Press',
          durationMs: 20_000,
          media: { source: 'bundled', path: 'exercises/Leg-Press.jpg' },
        }),
      ]),
    ).toContain('The picture on "Leg Press"')
  })

  it('warns when a role cannot be rebuilt from the name', () => {
    expect(lostFor([step({ name: 'Change Sides', role: 'prepare', durationMs: 15_000 })])).toContain(
      '"Change Sides" is a get-ready step and will come back as work',
    )
  })

  it('warns about a note too short to survive', () => {
    expect(lostFor([step({ name: 'Squats', durationMs: 20_000, note: 'basic' })])).toContain(
      'Note on "Squats" is too short to survive: "basic"',
    )
  })

  it('warns that a count on a timed step cannot be written', () => {
    expect(
      lostFor([step({ name: 'Bicep Curls', durationMs: 60_000, reps: { kind: 'fixed', count: 12 } })]),
    ).toContain('The count on "Bicep Curls" (12 ×), which is also timed')
  })

  it('warns about a name that will split on its plus', () => {
    expect(lostFor([step({ name: '12 × Raises + 10 Punches' })])).toContain(
      '"12 × Raises + 10 Punches" will split into two steps, because of the + between two counts',
    )
  })

  it('reports the colour, the favourite mark and the name', () => {
    const lost = writeRoutine({
      ...workout([step({ name: 'Squat', durationMs: 20_000 })], 'Leg day'),
      colour: 'blue',
      favourite: true,
    }).lost
    expect(lost).toContain("The routine's colour (blue)")
    expect(lost).toContain('The favourite mark')
    expect(lost).toContain('The routine\'s name ("Leg day"), which is typed in on the way back')
  })

  it('says nothing was lost when nothing was', () => {
    expect(
      lostFor([
        step({ name: 'Get ready', role: 'prepare', durationMs: 15_000 }),
        step({ name: 'Squat', durationMs: 20_000 }),
      ]),
    ).toEqual(["The routine's name (\"W\"), which is typed in on the way back"])
  })
})

describe('textFilename', () => {
  it('slugs the routine name and stamps the date', () => {
    expect(textFilename('Beginner Mixed Cardio 2', new Date('2026-08-27T10:00:00Z'))).toBe(
      'beginner-mixed-cardio-2-2026-08-27.txt',
    )
  })

  it('falls back rather than making a dotfile', () => {
    expect(textFilename('!!!', new Date('2026-08-27T10:00:00Z'))).toBe('routine-2026-08-27.txt')
  })
})
