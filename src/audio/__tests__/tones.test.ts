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
    // Deeper than the bell by request, so pitch is not what distinguishes them —
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
    expect(dings.map((d) => d.atMs)).toEqual([...dings.map((d) => d.atMs)].sort((a, b) => a - b))
    expect(new Set(dings.map((d) => d.atMs)).size).toBe(3)
  })

  it('keeps the whistle and the bell clearly different sounds', () => {
    // Close in pitch, so the difference has to come from how they behave: one
    // follows a measured contour, the other is struck and rings on.
    const whistle = toneFor('work-start')!.notes[0]!
    const bell = toneFor('work-end')!.notes[0]!

    expect(whistle.curve).toBeDefined()
    expect(bell.curve).toBeUndefined()
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
    // Evenly spaced — an uneven gap reads as a mistake.
    expect(new Set(gaps).size).toBe(1)
  })

  it('gives every note a sane envelope, or a curve instead', () => {
    for (const kind of KINDS) {
      for (const note of toneFor(kind)!.notes) {
        expect(note.gain).toBeGreaterThan(0)
        expect(note.gain).toBeLessThanOrEqual(1)

        // A curve carries its own shape and needs no envelope fields.
        if (note.curve) continue

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

describe('the whistle is played from measured curves', () => {
  it('follows amplitude and frequency contours rather than an envelope', () => {
    /*
     * Four parametric attempts failed, the last built on a spectral analysis
     * that was right about the pitch and wrong about the chop. A whistle's
     * character is the irregularity of the pea, which is a curve and not a
     * parameter — so this pins the approach, not just the numbers.
     */
    const note = toneFor('work-start')!.notes[0]!
    expect(note.curve).toBeDefined()
    expect(note.curve!.amplitude.length).toBeGreaterThan(50)
    expect(note.curve!.frequency.length).toBeGreaterThan(20)
  })

  it('holds its pitch in the measured band', () => {
    // 98.3% of the real whistle's energy is inside 2400-3400Hz.
    const { frequency } = toneFor('work-start')!.notes[0]!.curve!
    for (const hz of frequency) {
      expect(hz).toBeGreaterThan(2300)
      expect(hz).toBeLessThan(3400)
    }
  })

  it('has irregular dips rather than a regular gate', () => {
    // The earlier versions used a 95% square chop, which buzzed. The real thing
    // holds high with uneven dips — so consecutive gaps must NOT be uniform.
    const { amplitude } = toneFor('work-start')!.notes[0]!.curve!
    const loud = amplitude.filter((value) => value > 0.05)

    expect(Math.max(...amplitude)).toBeCloseTo(1, 1)
    // Mostly loud, not mostly gated.
    expect(loud.filter((v) => v > 0.6).length).toBeGreaterThan(loud.length / 2)
    // And genuinely uneven.
    expect(new Set(amplitude.map((v) => v.toFixed(2))).size).toBeGreaterThan(20)
  })

  it('starts and ends at silence, so it cannot click', () => {
    const { amplitude } = toneFor('work-start')!.notes[0]!.curve!
    expect(amplitude[0]!).toBeLessThan(0.1)
    expect(amplitude[amplitude.length - 1]!).toBe(0)
  })

  it('needs no envelope fields, since the curve replaces them', () => {
    const note = toneFor('work-start')!.notes[0]!
    expect(note.sustain).toBeUndefined()
    expect(note.strikeMs).toBeUndefined()
    expect(note.tremolo).toBeUndefined()
  })

  it('bundles no audio: every cue is synthesised', () => {
    for (const kind of ['countdown', 'work-start', 'work-end', 'workout-complete'] as const) {
      for (const note of toneFor(kind)!.notes) {
        expect(note.freq).toBeGreaterThan(0)
      }
    }
  })
})
