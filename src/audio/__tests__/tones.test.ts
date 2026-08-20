import { describe, expect, it } from 'vitest'
import { audioTimeFor, toneFor } from '../tones'

describe('toneFor', () => {
  it('rises across the three countdown blips', () => {
    const pitches = [3, 2, 1].map((v) => toneFor('countdown', v)!.freq)
    expect(pitches).toEqual([...pitches].sort((a, b) => a - b))
    expect(new Set(pitches).size).toBe(3)
  })

  it('resolves the phase change above every countdown blip', () => {
    const phase = toneFor('phase-change')!.freq
    for (const v of [3, 2, 1]) {
      expect(phase).toBeGreaterThan(toneFor('countdown', v)!.freq)
    }
  })

  it('gives the completion cue a second note', () => {
    const spec = toneFor('workout-complete')!
    expect(spec.then).toBeDefined()
    expect(spec.then!.freq).toBeGreaterThan(spec.freq)
  })

  it('keeps every tone short enough not to overlap a 1s countdown interval', () => {
    for (const v of [3, 2, 1]) {
      expect(toneFor('countdown', v)!.durationMs).toBeLessThan(1000)
    }
  })
})

describe('audioTimeFor', () => {
  it('maps a cue ahead of now onto the audio clock', () => {
    // 3s from now in run time is 3s from now on the audio clock.
    expect(audioTimeFor(20_000, 17_000, 100)).toBeCloseTo(103)
  })

  it('returns the present for a cue at the current moment', () => {
    expect(audioTimeFor(17_000, 17_000, 100)).toBe(100)
  })

  it('returns the past for a cue already gone, so it can be dropped', () => {
    expect(audioTimeFor(10_000, 17_000, 100)).toBeCloseTo(93)
  })

  it('is unaffected by the size of the audio clock offset', () => {
    const gap = audioTimeFor(20_000, 17_000, 5_000) - 5_000
    expect(gap).toBeCloseTo(3)
  })
})
