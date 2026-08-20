import { describe, expect, it } from 'vitest'
import { audioTimeFor, toneFor } from '../tones'

const KINDS = ['countdown', 'phase-change', 'workout-complete'] as const

describe('toneFor', () => {
  it('has a tone for every cue kind', () => {
    for (const kind of KINDS) {
      expect(toneFor(kind)?.notes.length).toBeGreaterThan(0)
    }
  })

  it('matches the measured countdown: a single near-pure C5', () => {
    const notes = toneFor('countdown')!.notes
    expect(notes).toHaveLength(1)
    expect(notes[0]!.freq).toBeCloseTo(523, 0)
    expect(notes[0]!.type).toBe('sine')
  })

  it('keeps the countdown short enough not to run into the next one', () => {
    // Countdown cues are 1s apart.
    const note = toneFor('countdown')!.notes[0]!
    expect(note.durationMs).toBeLessThan(1000)
    expect(note.decayMs).toBeLessThan(note.durationMs)
  })

  it('gives the phase change an INHARMONIC partial, which is what sounds metallic', () => {
    const note = toneFor('phase-change')!.notes[0]!
    expect(note.freq).toBeCloseTo(2658, 0)
    expect(note.partial).toBeDefined()
    // Not a whole-number multiple — that is the difference between a bell and
    // a plain tone with a harmonic.
    const ratio = note.partial!.ratio
    expect(Math.abs(ratio - Math.round(ratio))).toBeGreaterThan(0.2)
    expect(note.partial!.gain).toBeLessThan(note.gain)
  })

  it('puts the phase change well above the countdown, so they never blur', () => {
    expect(toneFor('phase-change')!.notes[0]!.freq).toBeGreaterThan(
      toneFor('countdown')!.notes[0]!.freq * 4,
    )
  })

  it('plays the completion figure as a sequence, ending on its highest note', () => {
    const notes = toneFor('workout-complete')!.notes
    expect(notes.length).toBeGreaterThan(3)

    const onsets = notes.map((n) => n.atMs)
    expect(onsets).toEqual([...onsets].sort((a, b) => a - b))

    const last = notes[notes.length - 1]!
    expect(Math.max(...notes.map((n) => n.freq))).toBe(
      Math.max(last.freq, ...notes.filter((n) => n.atMs === last.atMs).map((n) => n.freq)),
    )
  })

  it('gives every note a sane envelope', () => {
    for (const kind of KINDS) {
      for (const note of toneFor(kind)!.notes) {
        expect(note.gain).toBeGreaterThan(0)
        expect(note.gain).toBeLessThanOrEqual(1)
        expect(note.decayMs).toBeGreaterThan(0)
        // Decay must fit inside the note, or the envelope stages cross over.
        expect(note.decayMs).toBeLessThan(note.durationMs)
      }
    }
  })

  it('keeps the whole completion figure under five seconds', () => {
    const notes = toneFor('workout-complete')!.notes
    const end = Math.max(...notes.map((n) => n.atMs + n.durationMs))
    expect(end).toBeLessThan(5000)
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
