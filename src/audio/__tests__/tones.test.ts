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

  it('builds the whistle as a chopped tone with breath, not a steady one', () => {
    // A whistle without the pea's chop reads as a synthesiser test tone.
    const note = toneFor('work-start')!.notes[0]!
    expect(note.freq).toBeGreaterThan(3000)
    expect(note.warble?.hz).toBeGreaterThan(15)
    expect(note.warble?.depthHz).toBeGreaterThan(50)
    expect(note.tremolo?.depth).toBeGreaterThan(0.1)
    expect(note.noise?.gain).toBeGreaterThan(0)
    // Blown, not struck — it holds rather than decaying away.
    expect(note.sustain).toBeGreaterThan(0.6)
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

  it('ends the routine with three dings, brighter and shorter than the bell', () => {
    const dings = toneFor('workout-complete')!.notes
    const bell = toneFor('work-end')!.notes[0]!

    expect(dings).toHaveLength(3)
    for (const ding of dings) {
      expect(ding.freq).toBeGreaterThan(bell.freq)
      expect(ding.durationMs).toBeLessThan(bell.durationMs)
    }
    // Struck in sequence, not at once.
    expect(dings.map((d) => d.atMs)).toEqual([...dings.map((d) => d.atMs)].sort((a, b) => a - b))
    expect(new Set(dings.map((d) => d.atMs)).size).toBe(3)
  })

  it('keeps the whistle and the bell clearly different sounds', () => {
    // They mean opposite things mid-effort, so they must not be confusable.
    const whistle = toneFor('work-start')!.notes[0]!
    const bell = toneFor('work-end')!.notes[0]!
    expect(Math.abs(whistle.freq - bell.freq)).toBeGreaterThan(600)
    expect(whistle.warble).toBeDefined()
    expect(bell.warble).toBeUndefined()
  })

  it('puts every boundary sound well above the countdown beep', () => {
    const beep = toneFor('countdown')!.notes[0]!.freq
    for (const kind of ['work-start', 'work-end', 'workout-complete'] as const) {
      for (const note of toneFor(kind)!.notes) {
        expect(note.freq, kind).toBeGreaterThan(beep * 3)
      }
    }
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
        expect(note.strikeMs).toBeLessThan(note.durationMs)
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
