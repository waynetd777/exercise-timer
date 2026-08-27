/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
// The store is localStorage, so the tests need a browser's one.

import { beforeEach, describe, expect, it } from 'vitest'
import type { Block } from '../../engine/types'
import { exerciseKey, fillLoads, findLoad, stripLoads } from '../../routines/loads'
import { currentWeights, loadWeights, saveWeights, weightFor, withWeight } from '../weights'

beforeEach(() => {
  globalThis.localStorage?.clear()
  saveWeights({})
})

describe('the store', () => {
  it('starts empty: no seeds, every field blank', () => {
    // It used to ship one person's numbers to every install.
    expect(currentWeights().size).toBe(0)
    expect(weightFor('Leg Press')).toBe('')
  })

  it('has nothing to say about an exercise no routine has loaded', () => {
    expect(weightFor('Toe Raise')).toBe('')
  })

  it('matches an exercise however the step spells it', () => {
    // The same lift is named three ways in a routine, and all three want the
    // same weight.
    saveWeights(withWeight(loadWeights(), 'Leg Press', '65kg'))
    expect(weightFor('12 × Leg Press')).toBe('65kg')
    expect(weightFor('Leg press')).toBe('65kg')
  })

  it('clearing a weight removes it, and the store holds only what has a number', () => {
    saveWeights(withWeight(loadWeights(), 'Leg Press', '70kg'))
    expect(weightFor('Leg Press')).toBe('70kg')
    const cleared = withWeight(loadWeights(), 'Leg Press', '')
    expect(cleared).toEqual({})
    saveWeights(cleared)
    expect(currentWeights().has(exerciseKey('Leg Press'))).toBe(false)
  })

  it('reads an older store that recorded a cleared field as an empty string', () => {
    globalThis.localStorage?.setItem('davshack-timer-weights', '{"leg pres":"","lat pulldown":"30kg"}')
    saveWeights(loadWeights())
    expect(weightFor('Leg Press')).toBe('')
    expect(weightFor('Lat Pulldown')).toBe('30kg')
  })

  it('drops the cache when a weight changes', () => {
    saveWeights(withWeight(loadWeights(), 'Lat Pulldown', '30kg'))
    expect(weightFor('Lat Pulldown')).toBe('30kg')
    saveWeights(withWeight(loadWeights(), 'Lat Pulldown', '40kg'))
    expect(weightFor('Lat Pulldown')).toBe('40kg')
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

describe('the shorthand a routine is actually written in', () => {
  /*
   * The bug this exists for. Routine 2 calls the step "12 × Seated Ab Crunch";
   * the exercise table takes its names from the manufacturer's guide and calls
   * it "Seated Abdominal Crunch". Clearing that step's weight left it with no
   * hint in the editor and no weight on the run screen, because the two names
   * never met.
   */
  it('finds the weight through an abbreviation', () => {
    saveWeights(withWeight(loadWeights(), 'Seated Abdominal Crunch', '15kg'))
    expect(weightFor('Seated Ab Crunch')).toBe('15kg')
    expect(weightFor('12 × Seated Ab Crunch')).toBe('15kg')
    expect(weightFor('Get ready: Seated Ab Crunch')).toBe('15kg')
  })

  it('fills a step named that way, on the way into a run', () => {
    saveWeights(withWeight(loadWeights(), 'Seated Abdominal Crunch', '15kg'))
    const blocks: Block[] = [
      { kind: 'segment', id: 'a', name: 'Get ready: Seated Ab Crunch', role: 'prepare', durationMs: 15_000 },
      { kind: 'segment', id: 'b', name: '12 × Seated Ab Crunch', role: 'work', durationMs: 20_000 },
    ]
    const filled = fillLoads(blocks, currentWeights()) as Block[]
    expect((filled[0] as { load?: string }).load).toBe('15kg')
    expect((filled[1] as { load?: string }).load).toBe('15kg')
  })

  it('will not join two exercises that merely look alike', () => {
    // Neither "abductor" nor "adductor" starts the other, and they are
    // different machines. A wrong number here gets loaded onto a stack.
    const table = new Map([[exerciseKey('Hip Adductor Leg Raise'), '25kg']])
    expect(findLoad(table, 'Hip Abductor Leg Raise')).toBeUndefined()
  })

  it('refuses to choose between two matches', () => {
    const table = new Map([
      [exerciseKey('Standing Leg Curl'), '10kg'],
      [exerciseKey('Standing Leg Curtsy'), '20kg'],
    ])
    expect(findLoad(table, 'Standing Leg Cur')).toBeUndefined()
  })

  it('keeps a one-letter word from matching half the table', () => {
    const table = new Map([[exerciseKey('Seated Abdominal Crunch'), '15kg']])
    expect(findLoad(table, 'Seated A Crunch')).toBeUndefined()
  })
})
