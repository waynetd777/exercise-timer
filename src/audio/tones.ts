/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { CueKind } from '../engine'
import type { SampleName } from './samples'

/**
 * Cue definitions. All synthesised except the whistle, which is a CC0 recording
 * with the synthesised version kept as its fallback. See `samples.ts` for why
 * that one gave up on synthesis and what licence lets it ship.
 *
 * The three-beep countdown always leads somewhere, and where it leads is what
 * changes:
 *
 *   work-start        beep beep beep WHISTLE   (a referee starting play)
 *   work-end          beep beep beep BELL      (the round is over)
 *   workout-complete  beep beep beep DING DING DING, then the wrap-up line
 *
 * The beep and the bell are built from measurements of the app Wayne trains to.
 * The whistle is a recording. See `samples.ts`.
 */

export type Note = {
  /** Offset from the cue's moment, in ms. */
  atMs: number
  freq: number
  /** Total ringing time, to near-silence. */
  durationMs: number
  /** Peak level, 0-1. */
  gain: number
  /** Fraction of `gain` the strike falls to. */
  sustain?: number
  /** Milliseconds for the strike to fall to `sustain`. */
  strikeMs?: number
  /**
   * Milliseconds to reach full level. Struck sounds want the default few ms; a
   * blown one takes far longer, because the pressure has to build.
   */
  attackMs?: number
  type?: OscillatorType
  /**
   * Play a recording instead of synthesising. Every other field on the note
   * still describes the synthesised FALLBACK, used until the sample is decoded
   * and if it never is.
   */
  sample?: SampleName
  /**
   * An inharmonic partial, as a multiple of `freq`. This is what makes a tone read as
   * metallic. `decayScale` shortens it, since a real bell's high partials die
   * before its body stops ringing.
   */
  partial?: { ratio: number; gain: number; decayScale?: number }
}

export type ToneSpec = { notes: Note[] }

/** Measured: ~523Hz, drops to 0.16 of peak by 60ms, gone by ~550ms. */
const BEEP: Note = {
  atMs: 0,
  freq: 523,
  durationMs: 550,
  gain: 0.5,
  sustain: 0.15,
  strikeMs: 45,
  type: 'sine',
}

/**
 * A referee's pea whistle: the CC0 recording, which IS the sound the app was
 * built to match. See `samples.ts` for provenance and for why five synthesis
 * attempts were abandoned.
 *
 * `gain` puts the recording's peak where the last synthesised version sat, which
 * nobody complained about: the file peaks at 0.92, and 0.92 x 0.46 lands on 0.42.
 *
 * The remaining fields are a LAST-RESORT fallback, used only if the recording
 * cannot be fetched or decoded. They make a plain 2900Hz tone: an audible cue in
 * the right register, and honestly not a whistle. Silence would be worse; a
 * second synthesis engine to avoid it would be worse still.
 */
const WHISTLE: Note = {
  atMs: 0,
  freq: 2900,
  durationMs: 700,
  gain: 0.46,
  type: 'sine',
  sample: 'whistle',
  attackMs: 25,
  sustain: 0.9,
  strikeMs: 40,
}


/**
 * Measured from the app: 2659Hz with an INHARMONIC partial at x2.578. The
 * inharmonicity is what makes it metallic rather than a plain tone, and dropping to
 * a third of peak within 25ms and still audible at 1.2s.
 */
const BELL: Note = {
  atMs: 0,
  freq: 2659,
  durationMs: 2050,
  gain: 0.32,
  sustain: 0.33,
  strikeMs: 22,
  type: 'sine',
  partial: { ratio: 2.578, gain: 0.14, decayScale: 0.45 },
}

/** A shorter, deeper bell than the round bell, struck three times. */
const ding = (atMs: number): Note => ({
  atMs,
  freq: 2350,
  durationMs: 780,
  gain: 0.3,
  sustain: 0.24,
  strikeMs: 10,
  type: 'sine',
  partial: { ratio: 2.74, gain: 0.11, decayScale: 0.5 },
})

/** The countdown, as its own cue: one beep, fired three times a second apart. */
const COUNTDOWN: ToneSpec = { notes: [BEEP] }
const WORK_START: ToneSpec = { notes: [WHISTLE] }
const WORK_END: ToneSpec = { notes: [BELL] }

/** Spaced at 430ms: slow enough to read as three deliberate strikes. */
const COMPLETE: ToneSpec = { notes: [ding(0), ding(430), ding(860)] }

export function toneFor(kind: CueKind): ToneSpec | null {
  switch (kind) {
    case 'countdown':
      return COUNTDOWN
    case 'work-start':
      return WORK_START
    case 'work-end':
      return WORK_END
    case 'workout-complete':
      return COMPLETE
    default:
      return null
  }
}

/**
 * The full figure a cue belongs to: three beeps a second apart, then the terminal
 * sound. Used by the sound bench, where hearing the whole sequence is the only
 * way to judge it.
 */
export function sequenceFor(kind: Exclude<CueKind, 'countdown'>): ToneSpec {
  return {
    notes: [
      { ...BEEP, atMs: 0 },
      { ...BEEP, atMs: 1000 },
      { ...BEEP, atMs: 2000 },
      ...toneFor(kind)!.notes.map((note) => ({ ...note, atMs: note.atMs + 3000 })),
    ],
  }
}

/** When the last note of a figure is struck, not when its tail dies away. */
export function lastStrikeMs(spec: ToneSpec): number {
  return Math.max(...spec.notes.map((note) => note.atMs))
}

/**
 * Maps a cue's position in workout time onto the audio clock.
 *
 * The one subtraction the whole scheduler rests on. Recomputed on every re-arm
 * rather than cached, because pause, resume and seek all invalidate it.
 */
export function audioTimeFor(cueAtMs: number, elapsedMs: number, audioNow: number): number {
  return audioNow + (cueAtMs - elapsedMs) / 1000
}
