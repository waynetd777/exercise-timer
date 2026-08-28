/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { audioTimeFor, sequenceFor, toneFor } from '../tones'

const KINDS = ['countdown', 'work-start', 'work-end', 'workout-complete'] as const

describe('toneFor', () => {
  it('has a tone for every cue kind', () => {
    for (const kind of KINDS) {
      expect(toneFor(kind)?.notes.length, kind).toBeGreaterThan(0)
    }
  })

  it('matches the measured countdown beep: a single near-pure C5', () => {
    const notes = toneFor('countdown')!.notes
    expect(notes).toHaveLength(1)
    expect(notes[0]!.freq).toBeCloseTo(523, 0)
    expect(notes[0]!.type).toBe('sine')
    // Countdown cues are a second apart, so it must not run into the next.
    expect(notes[0]!.durationMs).toBeLessThan(1000)
  })

  it('builds the bell with an INHARMONIC partial and a long tail', () => {
    const note = toneFor('work-end')!.notes[0]!
    expect(note.freq).toBeCloseTo(2659, 0)
    const ratio = note.partial!.ratio
    // Not a whole multiple: that is the difference between a bell and a tone.
    expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.2)
    expect(note.durationMs).toBeGreaterThan(1500)
    expect(note.sustain).toBeLessThan(0.5)
    expect(note.partial!.decayScale).toBeLessThan(1)
  })

  it('ends the routine with three shorter strikes, not one long ring', () => {
    // Deeper than the bell by request, so pitch is not what distinguishes them.
    // three shorter strikes against one long ring is.
    const dings = toneFor('workout-complete')!.notes
    const bell = toneFor('work-end')!.notes[0]!

    expect(dings).toHaveLength(3)
    for (const ding of dings) {
      expect(ding.durationMs).toBeLessThan(bell.durationMs)
      // Still clearly a different pitch from the bell, either way.
      expect(Math.abs(ding.freq - bell.freq)).toBeGreaterThan(200)
    }
    // Struck in sequence, not at once.
    const times = dings.map((d) => d.atMs)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(new Set(dings.map((d) => d.atMs)).size).toBe(3)
  })

  it('keeps the whistle and the bell clearly different sounds', () => {
    // Close in pitch, so the difference has to come from how they behave: one is
    // a blown recording, the other is struck and rings on.
    const whistle = toneFor('work-start')!.notes[0]!
    const bell = toneFor('work-end')!.notes[0]!

    expect(whistle.sample).toBe('whistle')
    expect(bell.sample).toBeUndefined()
    expect(bell.durationMs).toBeGreaterThan(whistle.durationMs)
    expect(bell.partial).toBeDefined()
  })

  it('puts every boundary sound well clear of the countdown beep', () => {
    // The beep is a 523Hz C5; nothing that follows it should be confusable.
    const beep = toneFor('countdown')!.notes[0]!.freq
    for (const kind of ['work-start', 'work-end', 'workout-complete'] as const) {
      for (const note of toneFor(kind)!.notes) {
        expect(note.freq, kind).toBeGreaterThan(beep * 4)
      }
    }
  })

  it('spaces the three dings slowly enough to hear as separate strikes', () => {
    const dings = toneFor('workout-complete')!.notes
    const gaps = dings.slice(1).map((d, i) => d.atMs - dings[i]!.atMs)
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(300)
    // Evenly spaced. An uneven gap reads as a mistake.
    expect(new Set(gaps).size).toBe(1)
  })

  it('gives every note a sane envelope', () => {
    for (const kind of KINDS) {
      for (const note of toneFor(kind)!.notes) {
        expect(note.gain).toBeGreaterThan(0)
        expect(note.gain).toBeLessThanOrEqual(1)

        expect(note.sustain).toBeGreaterThan(0)
        expect(note.sustain).toBeLessThanOrEqual(1)
        // The strike must fit inside the note, or the envelope stages cross.
        expect(note.strikeMs).toBeGreaterThan(0)
        expect(note.strikeMs!).toBeLessThan(note.durationMs)
      }
    }
  })
})

describe('sequenceFor', () => {
  it('is three beeps a second apart, then the terminal sound', () => {
    const notes = sequenceFor('work-end').notes
    const beep = toneFor('countdown')!.notes[0]!

    expect(notes.slice(0, 3).map((n) => n.atMs)).toEqual([0, 1000, 2000])
    for (const note of notes.slice(0, 3)) expect(note.freq).toBe(beep.freq)
    expect(notes[3]!.atMs).toBe(3000)
    expect(notes[3]!.freq).toBe(toneFor('work-end')!.notes[0]!.freq)
  })

  it('offsets a multi-note terminal correctly', () => {
    const notes = sequenceFor('workout-complete').notes
    const dings = toneFor('workout-complete')!.notes
    expect(notes).toHaveLength(3 + dings.length)
    expect(notes.slice(3).map((n) => n.atMs)).toEqual(dings.map((d) => d.atMs + 3000))
  })

  it('does not mutate the underlying specs', () => {
    sequenceFor('work-start')
    expect(toneFor('work-start')!.notes[0]!.atMs).toBe(0)
    expect(toneFor('countdown')!.notes[0]!.atMs).toBe(0)
  })
})

describe('audioTimeFor', () => {
  it('maps a cue ahead of now onto the audio clock', () => {
    expect(audioTimeFor(20_000, 17_000, 100)).toBeCloseTo(103)
  })

  it('returns the present for a cue at the current moment', () => {
    expect(audioTimeFor(17_000, 17_000, 100)).toBe(100)
  })

  it('returns the past for a cue already gone, so it can be dropped', () => {
    expect(audioTimeFor(10_000, 17_000, 100)).toBeCloseTo(93)
  })

  it('is unaffected by the size of the audio clock offset', () => {
    expect(audioTimeFor(20_000, 17_000, 5_000) - 5_000).toBeCloseTo(3)
  })
})
describe('the whistle is the recording', () => {
  it('plays the CC0 sample rather than anything synthesised', () => {
    // The synthesised whistle and its generator were deleted once the recording
    // was proved to BE the reference sound. This pins that decision: drop the
    // sample field and the cue quietly degrades to a plain tone.
    const note = toneFor('work-start')!.notes[0]!
    expect(note.sample).toBe('whistle')
  })

  it('keeps envelope fields as a fallback for a failed decode', () => {
    // Not decoration: without them a failed fetch would leave the boundary
    // silent instead of sounding a plain tone in the right register.
    const note = toneFor('work-start')!.notes[0]!
    expect(note.sustain).toBeGreaterThan(0)
    expect(note.strikeMs!).toBeLessThan(note.durationMs)
  })
})
