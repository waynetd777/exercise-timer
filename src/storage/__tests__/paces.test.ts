/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
// The store is localStorage, so the tests need a browser's one.

import { beforeEach, describe, expect, it } from 'vitest'
import type { TimelineEntry } from '../../engine/types'
import { estimate } from '../../routines/estimate'
import {
  currentRates,
  loadPaces,
  ratesFrom,
  recordGate,
  sampleFrom,
  savePaces,
  withSample,
} from '../paces'

/**
 * A timeline entry with the fields `sampleFrom` reads.
 *
 * The rest are the runtime's own bookkeeping and say nothing about a pace, so
 * they are filled in once here rather than in every case.
 */
function entry(over: Partial<TimelineEntry> & { name: string }): TimelineEntry {
  return {
    index: 0,
    step: 1,
    runIndex: null,
    segmentId: over.name,
    role: 'work',
    setIndex: 0,
    setCount: 1,
    groupId: null,
    sectionId: null,
    ...over,
  } as TimelineEntry
}

function counted(name: string, count: number, perSide = false): TimelineEntry {
  return entry({ name, reps: { count, perSide } })
}

function timed(name: string, durationMs: number): TimelineEntry {
  return entry({ name, role: 'rest', durationMs })
}

describe('sampleFrom', () => {
  it('reads a rate off one gate', () => {
    // 12 reps in 24 seconds is two seconds a rep.
    expect(sampleFrom(24_000, [counted('Squats', 12)])).toEqual({
      names: ['squat'],
      secondsPerRep: 2,
    })
  })

  it('doubles a per-side count, because that is the work done', () => {
    // "10 each side" is twenty reps, so the same minute is a faster rate.
    expect(sampleFrom(40_000, [counted('Lunges', 10, true)])?.secondsPerRep).toBe(2)
  })

  it('throws away a dry run', () => {
    /*
     * Tapping Next through a routine to see what is in it is the whole reason
     * for a floor. Without it, every rate collapses towards zero and the app
     * confidently says a twelve-rep set takes under a second.
     */
    expect(sampleFrom(300, [counted('Squats', 12)])).toBeNull()
    expect(sampleFrom(3_999, [counted('Squats', 12)])).toBeNull()
  })

  it('throws away a gate you walked away from', () => {
    expect(sampleFrom(20 * 60_000, [counted('Squats', 12)])).toBeNull()
  })

  it('rejects a rate outside anything a person does', () => {
    // 12 reps in 4.1 seconds clears the gate floor and is still not exercise.
    expect(sampleFrom(4_100, [counted('Squats', 12)])).toBeNull()
    // And the other end: three reps in five minutes is not a rep rate.
    expect(sampleFrom(300_000, [counted('Squats', 3)])).toBeNull()
  })

  it('takes the timed steps off the elapsed rather than counting them', () => {
    /*
     * A gate that clears a 30-second rest as well as the work would otherwise
     * charge that rest to the exercise beside it.
     */
    const found = sampleFrom(54_000, [counted('Squats', 12), timed('Rest', 30_000)])
    expect(found?.secondsPerRep).toBe(2)
  })

  it('says nothing when the gate cleared nothing counted', () => {
    expect(sampleFrom(30_000, [timed('Rest', 10_000)])).toBeNull()
    expect(sampleFrom(30_000, [])).toBeNull()
  })

  it('names every exercise the gate cleared, folded and once each', () => {
    const found = sampleFrom(60_000, [
      counted('Left Side Plank', 10),
      counted('Right Side Plank', 10),
      counted('Sit-ups', 10),
    ])
    expect(found?.names).toEqual(['side plank', 'sit ups'])
  })
})

describe('withSample / ratesFrom', () => {
  it('keeps the newest eight, so a rate follows you', () => {
    let paces = {}
    for (let i = 1; i <= 10; i += 1) paces = withSample(paces, ['squat'], i)
    expect(paces).toEqual({ squat: [3, 4, 5, 6, 7, 8, 9, 10] })
  })

  it('holds back until there are three, then takes the median', () => {
    expect(ratesFrom({ squat: [2, 9] }).has('squat')).toBe(false)
    // The 9 is an outlier and the median ignores it, which a mean would not.
    expect(ratesFrom({ squat: [2, 2.5, 9] }).get('squat')).toBe(2.5)
  })

  it('does not mutate what it was given', () => {
    const before = { squat: [1] }
    withSample(before, ['squat'], 2)
    expect(before).toEqual({ squat: [1] })
  })
})

describe('recordGate', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
  })

  it('records a real gate and refuses a dry-run tap', () => {
    expect(recordGate(24_000, [counted('Squats', 12)])).toBe(true)
    expect(recordGate(200, [counted('Squats', 12)])).toBe(false)
    expect(loadPaces()).toEqual({ squat: [2] })
  })

  it('survives rubbish in storage', () => {
    globalThis.localStorage?.setItem('davshack-timer-paces', 'not json')
    expect(loadPaces()).toEqual({})
    globalThis.localStorage?.setItem('davshack-timer-paces', '{"squat":["fast"]}')
    expect(loadPaces()).toEqual({ squat: [] })
  })

  it('round-trips', () => {
    savePaces({ squat: [1, 2, 3] })
    expect(loadPaces()).toEqual({ squat: [1, 2, 3] })
  })

  it('drops the cached rates when a gate is recorded', () => {
    // The library asks per row, so the rates are parsed once; a rate recorded
    // afterwards must still show up rather than being hidden by the cache.
    savePaces({ squat: [2, 2, 2] })
    expect(currentRates().get('squat')).toBe(2)
    savePaces({ squat: [4, 4, 4] })
    expect(currentRates().get('squat')).toBe(4)
  })
})

describe('estimate with measured rates', () => {
  it('prefers what was measured over what was harvested', () => {
    const blocks = [
      {
        kind: 'segment' as const,
        id: 's',
        name: 'Squats',
        role: 'work' as const,
        reps: { kind: 'fixed' as const, count: 10 },
      },
    ]
    const harvested = estimate(blocks).estimatedMs
    const measured = estimate(blocks, new Map([['squat', 5]])).estimatedMs
    expect(measured).toBe(50_000)
    expect(measured).not.toBe(harvested)
  })

  it('falls back per exercise, not all or nothing', () => {
    // Knowing your squat pace must not change what it thinks of your plank.
    const blocks = [
      {
        kind: 'segment' as const,
        id: 'p',
        name: 'Plank',
        role: 'work' as const,
        reps: { kind: 'fixed' as const, count: 10 },
      },
    ]
    expect(estimate(blocks, new Map([['squat', 5]])).estimatedMs).toBe(estimate(blocks).estimatedMs)
  })
})
