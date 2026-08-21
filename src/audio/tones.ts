import type { CueKind } from '../engine'

/**
 * Synthesised cues. Nothing is sampled, so there is no third-party audio in the
 * repo, nothing to attribute, and nothing to fetch or lose offline.
 *
 * The three-beep countdown always leads somewhere, and where it leads is what
 * changes:
 *
 *   work-start        beep beep beep WHISTLE   — a referee starting play
 *   work-end          beep beep beep BELL      — the round is over
 *   workout-complete  beep beep beep DING DING DING
 *
 * The beeps are measured from the app Wayne trains to (523Hz, a near-pure C5
 * with a 92ms decay). The whistle and dings are built for the metaphor.
 */

export type Note = {
  /** Offset from the cue's moment, in ms. */
  atMs: number
  freq: number
  /** Total ringing time, to near-silence. */
  durationMs: number
  /** Peak level of the strike, 0-1. */
  gain: number
  /** Fraction of `gain` the strike falls to before the long tail begins. */
  sustain: number
  /** Milliseconds for the strike to fall to `sustain`. */
  strikeMs: number
  type?: OscillatorType
  /**
   * An inharmonic partial, as a multiple of `freq` — what makes a tone read as
   * metallic. `decayScale` shortens it, since a real bell's high partials die
   * before its body stops ringing.
   */
  partial?: { ratio: number; gain: number; decayScale?: number }
  /**
   * Frequency wobble. A referee's pea whistle is not a steady tone: the pea
   * chops the airflow, and without this it sounds like a test tone.
   */
  warble?: { hz: number; depthHz: number }
  /** Amplitude wobble, from the same pea. `depth` is 0-1 of the level. */
  tremolo?: { hz: number; depth: number }
  /** Band-passed noise mixed in — the breath in a whistle. */
  noise?: { gain: number; centreHz: number; q: number }
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
 * A pea whistle. Fundamental around 3.8kHz with a hard second harmonic, chopped
 * at ~26Hz in both pitch and level, over a little breath noise. It holds rather
 * than decays — a whistle is blown, not struck — so the sustain is high.
 */
const WHISTLE: Note = {
  atMs: 0,
  freq: 3800,
  durationMs: 620,
  gain: 0.3,
  sustain: 0.82,
  strikeMs: 30,
  type: 'triangle',
  partial: { ratio: 2, gain: 0.1 },
  warble: { hz: 26, depthHz: 170 },
  tremolo: { hz: 26, depth: 0.4 },
  noise: { gain: 0.05, centreHz: 3800, q: 1.6 },
}

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

/** A brighter, shorter bell, struck three times. */
const ding = (atMs: number): Note => ({
  atMs,
  freq: 3136,
  durationMs: 520,
  gain: 0.3,
  sustain: 0.22,
  strikeMs: 10,
  type: 'sine',
  partial: { ratio: 2.74, gain: 0.11, decayScale: 0.5 },
})

/** The countdown, as its own cue — one beep, fired three times a second apart. */
const COUNTDOWN: ToneSpec = { notes: [BEEP] }

const WORK_START: ToneSpec = { notes: [WHISTLE] }
const WORK_END: ToneSpec = { notes: [BELL] }
const COMPLETE: ToneSpec = { notes: [ding(0), ding(260), ding(520)] }

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
 * The full figure a cue kind belongs to: three beeps a second apart, then the
 * terminal sound. Used by the sound test panel, where hearing the whole
 * sequence is the only way to judge it.
 */
export function sequenceFor(kind: Exclude<CueKind, 'countdown'>): ToneSpec {
  const terminal = toneFor(kind)!
  return {
    notes: [
      { ...BEEP, atMs: 0 },
      { ...BEEP, atMs: 1000 },
      { ...BEEP, atMs: 2000 },
      ...terminal.notes.map((note) => ({ ...note, atMs: note.atMs + 3000 })),
    ],
  }
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
