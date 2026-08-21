import { describe, expect, it } from 'vitest'
import type { Block, Ladder, Repeat, Section, Segment } from '../../engine'
import { compile, SCHEMA_VERSION } from '../../engine'
import { GET_READY_MS, parseRoutine } from '../pasteFormat'
import { PASTE_TEMPLATE } from '../pasteTemplate'

/**
 * The template is shipped help: the app offers it as the example of what it can
 * read. So the grammar and the example are bound together here — a change to
 * either that leaves them disagreeing fails, rather than shipping an example the
 * app itself chokes on.
 */
const parsed = () => parseRoutine(PASTE_TEMPLATE, 'Template')

const steps = (blocks: readonly Block[]): Segment[] =>
  blocks.flatMap((block) => (block.kind === 'segment' ? [block] : steps(block.children)))

const named = (name: string) => steps(parsed().blocks).find((step) => step.name === name)

describe('the pasted-routine template', () => {
  it('is understood in full — every line lands somewhere', () => {
    // The one assertion that matters. Everything below says what it landed as.
    expect(parsed().skipped).toEqual([])
  })

  it('opens with the five seconds the parser adds, then five sections', () => {
    const blocks = parsed().blocks
    const first = blocks[0] as Segment

    expect(first.role).toBe('prepare')
    expect(first.durationMs).toBe(GET_READY_MS)
    expect(blocks.slice(1).map((block) => (block as Section).name)).toEqual([
      'Warm-up',
      'Full Body Ladder',
      'Upper Body',
      'Final Burnout',
      'Cool-down',
    ])
  })

  it('fills the warm-up from "40 sec each", and takes the alternative below it', () => {
    const warmUp = parsed().blocks[1] as Section
    const rows = warmUp.children as Segment[]

    expect(rows.map((step) => step.durationMs)).toEqual([40_000, 40_000, 40_000])
    // A section of nothing but timed steps counts itself down rather than listing.
    expect(warmUp.display).toBe('timer')
    expect(rows[2]!.name).toBe('Bodyweight Squats (basic)')
    expect(rows[2]!.alternative).toBe('March in Place')
  })

  it('scales the ladder’s main lift and fixes its accessories', () => {
    const ladder = (parsed().blocks[2] as Section).children[0] as Ladder

    expect(ladder.kind).toBe('ladder')
    expect(ladder.counts).toEqual([10, 8, 6, 4, 2])
    expect((ladder.children as Segment[]).map((step) => [step.name, step.reps])).toEqual([
      ['Goblet Squats', { kind: 'rung' }],
      ['Hammer Curls', { kind: 'fixed', count: 12 }],
      // The smaller, truer count: "10 × (5 each leg)" is five a side.
      ['Walking Lunges', { kind: 'fixed', count: 5, perSide: true }],
    ])
  })

  it('puts the bonus after the ladder rather than inside it', () => {
    const section = parsed().blocks[2] as Section
    const last = section.children[section.children.length - 1] as Segment

    expect(last.name).toBe('Fast Mountain Climbers')
    expect(last.durationMs).toBe(30_000)
  })

  it('rests between rounds, and notes what applies to the whole section', () => {
    const section = parsed().blocks[3] as Section
    const rounds = section.children[0] as Repeat

    expect(rounds.times).toBe(4)
    expect((rounds.children as Segment[]).map((step) => step.name)).toEqual([
      'Push-ups',
      'Bent-over Rows',
      'Plank',
      'Rest',
    ])
    expect(section.note).toContain('No rest between exercises')
  })

  it('reads the inline alternative and the long parenthetical', () => {
    expect(named('Push-ups')?.alternative).toBe('Knee Push-ups for low impact')
    expect(named('Side-to-Side Squats with a Reach')?.note).toBe(
      'start standing, step out to one side, sink your hips and reach across your body',
    )
  })

  it('compiles to something runnable, with gates where steps are counted', () => {
    const routine = compile({
      id: 'template',
      name: 'Template',
      blocks: parsed().blocks,
      schemaVersion: SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
    })

    expect(routine.entries.length).toBeGreaterThan(20)
    // Counted steps wait for Next, so the routine cannot be a pure countdown.
    expect(routine.hasGates).toBe(true)
  })
})
