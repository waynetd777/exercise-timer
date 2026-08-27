/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
// The store is localStorage, so the tests need a browser's one.

import { beforeEach, describe, expect, it } from 'vitest'
import type { Block } from '../../engine/types'
import { exerciseKey, fillLoads, stripLoads } from '../../routines/loads'
import {
  currentWeights,
  loadWeights,
  SEED_WEIGHTS,
  saveWeights,
  weightFor,
  withWeight,
} from '../weights'

beforeEach(() => {
  globalThis.localStorage?.clear()
  saveWeights({})
})

describe('the store', () => {
  it('starts from the seeded numbers', () => {
    expect(weightFor('Leg Press')).toBe(SEED_WEIGHTS['Leg Press'])
    // Rounded up to a hole the pin actually goes in: 34.3 is not selectable.
    expect(weightFor('Lat Pulldown')).toBe('35kg')
  })

  it('has nothing to say about an exercise nobody looked up', () => {
    expect(weightFor('Glute Kickback')).toBe('')
  })

  it('matches an exercise however the step spells it', () => {
    // The same lift is named three ways in a routine, and all three want the
    // same weight.
    expect(weightFor('12 × Leg Press')).toBe('65kg')
    expect(weightFor('Leg press')).toBe('65kg')
  })

  it('takes what was typed over the seed', () => {
    saveWeights(withWeight(loadWeights(), 'Leg Press', '70kg'))
    expect(weightFor('Leg Press')).toBe('70kg')
  })

  it('lets a seeded weight be cleared, and does not put it back', () => {
    /*
     * The trap this exists for: if an empty field simply removed the key, the
     * seed would return on the next render and the field could never be
     * emptied. So an empty value is RECORDED.
     */
    saveWeights(withWeight(loadWeights(), 'Leg Press', ''))
    expect(weightFor('Leg Press')).toBe('')
    expect(currentWeights().has(exerciseKey('Leg Press'))).toBe(false)
  })

  it('keeps the store to what actually differs', () => {
    // Typing the seed back in is not a preference, so it is not written down.
    const stored = withWeight(loadWeights(), 'Leg Press', '65kg')
    expect(stored).toEqual({})
  })

  it('drops the cache when a weight changes', () => {
    expect(weightFor('Cable Fly')).toBe('35kg')
    saveWeights(withWeight(loadWeights(), 'Cable Fly', '40kg'))
    expect(weightFor('Cable Fly')).toBe('40kg')
  })

  it('survives rubbish in storage', () => {
    globalThis.localStorage?.setItem('davshack-timer-weights', 'not json')
    expect(loadWeights()).toEqual({})
    globalThis.localStorage?.setItem('davshack-timer-weights', '{"squat":12}')
    expect(loadWeights()).toEqual({})
  })
})

describe('exerciseKey', () => {
  it('sees through a count and the announcement wording', () => {
    const press = exerciseKey('Leg Press')
    expect(exerciseKey('12 × Leg Press')).toBe(press)
    expect(exerciseKey('Get ready: Leg Press')).toBe(press)
    expect(exerciseKey('get ready:  Leg Press')).toBe(press)
  })

  it('does not turn a plain get-ready into an exercise', () => {
    expect(exerciseKey('Get ready')).not.toBe(exerciseKey('Leg Press'))
  })
})

describe('fillLoads', () => {
  const weights = new Map([[exerciseKey('Leg Press'), '65kg']])

  const blocks: Block[] = [
    { kind: 'segment', id: 'a', name: 'Get ready: Leg Press', role: 'prepare', durationMs: 30_000 },
    { kind: 'segment', id: 'b', name: 'Leg Press', role: 'work', durationMs: 20_000 },
    { kind: 'segment', id: 'c', name: 'Rest', role: 'rest', durationMs: 10_000 },
  ]

  it('fills the work step and the announcement that names it', () => {
    const filled = fillLoads(blocks, weights) as Block[]
    expect((filled[0] as { load?: string }).load).toBe('65kg')
    expect((filled[1] as { load?: string }).load).toBe('65kg')
  })

  it('leaves alone anything that is not that exercise', () => {
    const filled = fillLoads(blocks, weights) as Block[]
    expect((filled[2] as { load?: string }).load).toBeUndefined()
  })

  it('never overrides a weight the routine states itself', () => {
    // The routine is saying something the table cannot: that today, deliberately,
    // it is not the usual weight.
    const stated: Block[] = [
      { kind: 'segment', id: 'b', name: 'Leg Press', role: 'work', durationMs: 20_000, load: '40kg' },
    ]
    expect((fillLoads(stated, weights)[0] as { load?: string }).load).toBe('40kg')
  })

  it('reaches inside a group', () => {
    const nested: Block[] = [
      { kind: 'repeat', id: 'r', times: 3, children: [blocks[1]!] },
    ]
    const filled = fillLoads(nested, weights)[0] as { children: { load?: string }[] }
    expect(filled.children[0]!.load).toBe('65kg')
  })

  it('returns what it was given when nothing changed', () => {
    // Identity matters: React re-renders on a new array, and most routines have
    // no weight to fill.
    const none: Block[] = [blocks[2]!]
    expect(fillLoads(none, weights)).toBe(none)
    expect(fillLoads(blocks, new Map())).toBe(blocks)
  })
})

describe('stripLoads', () => {
  const weights = new Map([[exerciseKey('Leg Press'), '65kg']])

  it('takes off a weight the page can answer for', () => {
    const blocks: Block[] = [
      { kind: 'segment', id: 'a', name: 'Leg Press', role: 'work', durationMs: 20_000, load: '40kg' },
    ]
    const { blocks: next, cleared } = stripLoads(blocks, weights)
    expect(cleared).toBe(1)
    expect((next[0] as { load?: string }).load).toBeUndefined()
    // Removed, not emptied: an empty string would read as a stated weight.
    expect('load' in (next[0] as object)).toBe(false)
  })

  it('leaves a weight nothing else records', () => {
    // The page says nothing about a band, so the routine is the only copy.
    const blocks: Block[] = [
      { kind: 'segment', id: 'a', name: 'Band Squats', role: 'work', durationMs: 20_000, load: 'red' },
    ]
    expect(stripLoads(blocks, weights).cleared).toBe(0)
  })

  it('counts every step, inside groups too', () => {
    const blocks: Block[] = [
      {
        kind: 'repeat',
        id: 'r',
        times: 3,
        children: [
          { kind: 'segment', id: 'a', name: '12 × Leg Press', role: 'work', durationMs: 20_000, load: '40kg' },
          { kind: 'segment', id: 'b', name: 'Get ready: Leg Press', role: 'prepare', durationMs: 15_000, load: '40kg' },
        ],
      },
    ]
    expect(stripLoads(blocks, weights).cleared).toBe(2)
  })

  it('returns what it was given when there is nothing to clear', () => {
    const blocks: Block[] = [
      { kind: 'segment', id: 'a', name: 'Leg Press', role: 'work', durationMs: 20_000 },
    ]
    expect(stripLoads(blocks, weights).blocks).toBe(blocks)
  })
})
