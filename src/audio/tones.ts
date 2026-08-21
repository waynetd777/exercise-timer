import type { CueKind } from '../engine'
import { WHISTLE_AMPLITUDE, WHISTLE_DURATION_MS, WHISTLE_FREQUENCY } from './whistleCurve'
import type { SampleName } from './samples'

/**
 * Cue definitions. All synthesised except the whistle, which is a CC0 recording
 * with the synthesised version kept as its fallback — see `samples.ts` for why
 * that one gave up on synthesis and what licence lets it ship.
 *
 * The three-beep countdown always leads somewhere, and where it leads is what
 * changes:
 *
 *   work-start        beep beep beep WHISTLE   — a referee starting play
 *   work-end          beep beep beep BELL      — the round is over
 *   workout-complete  beep beep beep DING DING DING, then the wrap-up line
 *
 * The beep and the bell are built from measurements of the app Wayne trains to.
 * The whistle is a recording; its fallback is built from measured CURVES, for
 * reasons in `whistleCurve.ts`.
 */

export type Note = {
  /** Offset from the cue's moment, in ms. */
  atMs: number
  freq: number
  /** Total ringing time, to near-silence. */
  durationMs: number
  /** Peak level, 0-1. */
  gain: number
  /** Fraction of `gain` the strike falls to. Unused by a curve note. */
  sustain?: number
  /** Milliseconds for the strike to fall to `sustain`. Unused by a curve note. */
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
  /** Sample only. Shifts pitch and length together, as blowing harder does. */
  playbackRate?: number
  /**
   * An inharmonic partial, as a multiple of `freq` — what makes a tone read as
   * metallic. `decayScale` shortens it, since a real bell's high partials die
   * before its body stops ringing.
   */
  partial?: { ratio: number; gain: number; decayScale?: number }
  /** Frequency wobble, applied to the tone only. */
  warble?: { hz: number; depthHz: number }
  /**
   * Amplitude chop, applied to everything in the note. A square shape chops
   * rather than swells.
   */
  tremolo?: { hz: number; depth: number; shape?: OscillatorType }
  /**
   * Noise through a band-pass filter. A high `q` turns noise into a pitched but
   * airy sound.
   */
  resonances?: {
    gain: number
    centreHz: number
    q: number
    sweepFromHz?: number
    wobbleHz?: number
    wobbleDepthHz?: number
  }[]
  /**
   * Measured amplitude and frequency contours, replacing the envelope entirely.
   *
   * For a sound whose character is its irregularity rather than any parameter,
   * following the measured curves is the only thing that works. Both are stepped
   * evenly across `durationMs`.
   */
  curve?: { amplitude: readonly number[]; frequency: readonly number[] }
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
 * A referee's pea whistle, played from its measured contours.
 *
 * Nearly a pure tone — spectral flatness 0.0014, with 98.3% of its energy inside
 * 2400-3400Hz — so one oscillator following the curves reproduces it closely.
 * Four parametric attempts failed first; see `whistleCurve.ts` for what they got
 * wrong.
 */
/** The synthesised whistle: the fallback, and still on the bench for comparison. */
const WHISTLE_CURVE_NOTE: Note = {
  atMs: 0,
  freq: 2900,
  durationMs: WHISTLE_DURATION_MS,
  gain: 0.42,
  type: 'sine',
  curve: { amplitude: WHISTLE_AMPLITUDE, frequency: WHISTLE_FREQUENCY },
}

/**
 * What actually plays: the recording, carrying the whole synthesised note as its
 * fallback.
 *
 * `gain` is set so the recording peaks where the synthesised whistle did, which
 * nobody complained about: the file peaks at 0.92, and 0.92 x 0.46 lands on the
 * 0.42 the contour reached. `playbackRate` is 1 — the recording is already the
 * length and pitch of the reference, since it IS the reference.
 */
const WHISTLE: Note = { ...WHISTLE_CURVE_NOTE, sample: 'whistle', gain: 0.46 }

/** Bench-only specs, so the two whistles can be heard back to back. */
export const WHISTLE_RECORDED: ToneSpec = { notes: [WHISTLE] }
export const WHISTLE_SYNTHESISED: ToneSpec = { notes: [WHISTLE_CURVE_NOTE] }

/**
 * Measured from the app: 2659Hz with an INHARMONIC partial at x2.578 — the
 * inharmonicity is what makes it metallic rather than a plain tone — dropping to
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

/** The countdown, as its own cue — one beep, fired three times a second apart. */
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

/** When the last note of a figure is struck — not when its tail dies away. */
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
