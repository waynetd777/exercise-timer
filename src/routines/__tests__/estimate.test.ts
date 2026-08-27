/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Block } from '../../engine/types'
import { totalDurationMs } from '../../engine'
import { SCHEMA_VERSION } from '../../engine/types'
import { DEFAULT_SECONDS_PER_REP, estimate } from '../estimate'
import { generateRoutine, seeded } from '../generate'

const step = (over: Partial<Block & { name: string }> & { name: string }): Block =>
  ({ kind: 'segment', id: 's', role: 'work', ...over }) as Block

describe('estimate', () => {
  it('is exact for a timed routine, and says so', () => {
    const blocks = [step({ name: 'Plank', durationMs: 30_000 })]
    expect(estimate(blocks)).toEqual({ knownMs: 30_000, estimatedMs: 0, rough: false })
  })

  it('agrees with the engine wherever the engine has an answer', () => {
    /*
     * The check that matters: for anything fully timed, this and
     * `totalDurationMs` must not drift, or the library row and the preview would
     * disagree about the same routine.
     */
    const { workout } = generateRoutine(
      { totalMs: 45 * 60_000, areas: ['upper', 'torso', 'lower'], recovery: 'active', equipment: 'machine' },
      { rng: seeded(3), now: 0 },
    )
    expect(estimate(workout.blocks).knownMs).toBe(totalDurationMs(workout))
    expect(estimate(workout.blocks).rough).toBe(false)
  })

  it('estimates a self-paced step at the rate for that exercise', () => {
    // Mountain climbers are a second a rep in the corpus; the default is two.
    const climbers = estimate([step({ name: 'Mountain Climbers', reps: { kind: 'fixed', count: 30 } })])
    expect(climbers.estimatedMs).toBe(30_000)
    expect(climbers.rough).toBe(true)

    const unknown = estimate([step({ name: 'Not An Exercise', reps: { kind: 'fixed', count: 10 } })])
    expect(unknown.estimatedMs).toBe(10 * DEFAULT_SECONDS_PER_REP * 1000)
  })

  it('doubles a per-side count, which is the smaller number by design', () => {
    const one = estimate([step({ name: 'X', reps: { kind: 'fixed', count: 10 } })])
    const both = estimate([step({ name: 'X', reps: { kind: 'fixed', count: 10, perSide: true } })])
    expect(both.estimatedMs).toBe(one.estimatedMs * 2)
  })

  it('counts a group once per round, and drops its trailing rest', () => {
    // The same rule `compile()` has: a rest belongs BETWEEN reps.
    const blocks: Block[] = [
      {
        kind: 'repeat',
        id: 'r',
        times: 3,
        children: [
          step({ name: 'Squats', durationMs: 20_000 }),
          step({ name: 'Rest', role: 'rest', durationMs: 10_000 }),
        ],
      },
    ]
    expect(estimate(blocks).knownMs).toBe(3 * 30_000 - 10_000)
    expect(estimate(blocks).knownMs).toBe(totalDurationMs({
      id: 'w', name: 'W', blocks, schemaVersion: SCHEMA_VERSION, createdAt: 0, updatedAt: 0,
    }))
  })

  it('gives a ladder its rungs, not its rung count', () => {
    /*
     * The main lift does 2 then 4 then 6 reps, so a `rung` step is worth the sum
     * of the counts rather than three of anything.
     */
    const blocks: Block[] = [
      {
        kind: 'ladder',
        id: 'l',
        counts: [2, 4, 6],
        children: [step({ name: 'X', reps: { kind: 'rung' } })],
      },
    ]
    expect(estimate(blocks).estimatedMs).toBe((2 + 4 + 6) * DEFAULT_SECONDS_PER_REP * 1000)
  })

  it('answers for a rep-based routine, which the engine cannot', () => {
    const { workout } = generateRoutine(
      { totalMs: 0, areas: ['upper', 'torso', 'lower'], recovery: 'passive', equipment: 'none', style: 'sections' },
      { rng: seeded(5), now: 0 },
    )
    const found = estimate(workout.blocks)
    /*
     * The engine sees the warm-up and the rests between rounds and nothing else,
     * because every exercise in between is self-paced. The work is the half it
     * cannot count, and here it is the larger half.
     */
    expect(found.knownMs).toBe(totalDurationMs(workout))
    expect(found.estimatedMs).toBeGreaterThan(found.knownMs)
    expect(found.rough).toBe(true)
  })
})
