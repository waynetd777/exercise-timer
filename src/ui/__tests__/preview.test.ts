/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Block, Workout } from '../../engine'
import { compile, SCHEMA_VERSION } from '../../engine'
import { previewBlocks } from '../preview'

const workout = (blocks: Block[]): Workout => ({
  id: 'w',
  name: 'Routine',
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

const work = (id: string, name: string): Block => ({
  kind: 'segment',
  id,
  name,
  durationMs: 20_000,
  role: 'work',
})

/** The names in each block, which is what the screen prints. */
const names = (blocks: ReturnType<typeof previewBlocks>) =>
  blocks.map((block) => block.rows.map((row) => row.name))

/** The headings each block opens, in order. */
const headings = (blocks: ReturnType<typeof previewBlocks>) =>
  blocks.map((block) => block.path.slice(block.carried).map((step) => step.label))

describe('previewBlocks', () => {
  it('keeps consecutive steps in one place together', () => {
    const routine = compile(workout([work('a', 'One'), work('b', 'Two')]))
    expect(names(previewBlocks(routine.entries))).toEqual([['One', 'Two']])
  })

  it('is empty for an empty routine', () => {
    expect(previewBlocks([])).toEqual([])
  })

  it('reads a repeat expanded, one block per round', () => {
    const routine = compile(
      workout([
        {
          kind: 'repeat',
          id: 'r',
          label: 'Round',
          times: 3,
          children: [work('a', 'Squat')],
        },
      ]),
    )

    const blocks = previewBlocks(routine.entries)
    expect(names(blocks)).toEqual([['Squat'], ['Squat'], ['Squat']])
    // Every round opens its own heading: nothing above it is carried, since the
    // repeat is the only level there is.
    expect(blocks.map((block) => block.carried)).toEqual([0, 0, 0])
    expect(blocks.map((block) => block.path[0]?.iteration)).toEqual([1, 2, 3])
  })

  it('prints a section once and each round under it', () => {
    const routine = compile(
      workout([
        {
          kind: 'section',
          id: 'sec',
          name: 'Legs',
          display: 'timer',
          children: [
            {
              kind: 'repeat',
              id: 'r',
              label: 'Round',
              times: 2,
              children: [work('a', 'Squat')],
            },
          ],
        },
      ]),
    )

    // The section is carried into the second round rather than reprinted.
    expect(headings(previewBlocks(routine.entries))).toEqual([['Legs', 'Round'], ['Round']])
  })

  it('opens a new block when a step leaves a group, not only when it enters one', () => {
    const routine = compile(
      workout([
        {
          kind: 'section',
          id: 'sec',
          name: 'Warm-up',
          display: 'timer',
          children: [work('a', 'Jog')],
        },
        work('b', 'Plank'),
      ]),
    )

    const blocks = previewBlocks(routine.entries)
    // Two blocks, and the second has no heading of its own: it is simply no
    // longer inside the section. Appending it to the section's block would have
    // printed it under the section's name.
    expect(names(blocks)).toEqual([['Jog'], ['Plank']])
    expect(headings(blocks)).toEqual([['Warm-up'], []])
    expect(blocks[1]!.path).toEqual([])
  })

  it('separates two sections that follow each other', () => {
    const section = (id: string, name: string, step: Block): Block => ({
      kind: 'section',
      id,
      name,
      display: 'timer',
      children: [step],
    })

    const routine = compile(
      workout([
        section('s1', 'Warm-up', work('a', 'Jog')),
        section('s2', 'Main', work('b', 'Squat')),
      ]),
    )

    expect(headings(previewBlocks(routine.entries))).toEqual([['Warm-up'], ['Main']])
  })

  it('covers every step exactly once, in order', () => {
    const routine = compile(
      workout([
        {
          kind: 'ladder',
          id: 'l',
          label: 'Rung',
          counts: [5, 4, 3],
          children: [
            { kind: 'segment', id: 'a', name: 'Pull-up', reps: { kind: 'rung' }, role: 'work' },
            work('b', 'Rest'),
          ],
        },
      ]),
    )

    const blocks = previewBlocks(routine.entries)
    expect(blocks.flatMap((block) => block.rows)).toEqual(routine.entries)
    // A rung's own count rides on the heading, which is what makes an expanded
    // ladder readable: "Rung 2 of 3 · 4 reps".
    expect(blocks.map((block) => block.path[0]?.rung)).toEqual([5, 4, 3])
  })
})
