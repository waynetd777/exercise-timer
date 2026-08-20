import type { CueKind } from '../engine'

/**
 * Synthesised cue tones, tuned to match the sounds of the Tabata Timer app that
 * Wayne already trains to.
 *
 * The pitches and envelopes below were MEASURED from that app's audio (FFT for
 * the partials, a smoothed amplitude envelope for attack and decay) and are
 * reproduced with oscillators. Nothing from it is bundled — this is a
 * transcription, so the repo carries no third-party audio, and there are no
 * files to ship, cache or lose offline.
 *
 * Measurements, for anyone retuning these:
 *   countdown  ~523 Hz (C5), near-pure tone, peak 35ms, 10% at 92ms, ~0.5s
 *   phase      2658 Hz plus an INHARMONIC partial at 6852 Hz (x2.58), which is
 *              what makes it read as metallic rather than as a plain tone;
 *              4ms attack, 10% at 306ms, ~0.9s
 *   complete   a 4s figure over G5 788 / F5 700 / C6 1052 / F6 1404
 */

/**
 * A struck note: a brief loud transient, then a much quieter tail that rings on.
 *
 * That two-part shape is the whole difference between a bell and a click. The
 * app's bell drops to a third of peak within 25ms and is still audible at 1.2s;
 * a single smooth exponential is loud in the middle and dead by 500ms, which is
 * what a click sounds like.
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
   * An inharmonic partial, as a multiple of `freq` — this is what makes a tone
   * read as metallic. `decayScale` shortens it, because in a real bell the high
   * partials die away well before the body stops ringing.
   */
  partial?: { ratio: number; gain: number; decayScale?: number }
}

export type ToneSpec = { notes: Note[] }

/** Measured: drops to ~0.16 of peak by 60ms, gone by ~550ms. */
const COUNTDOWN: ToneSpec = {
  notes: [
    {
      atMs: 0,
      freq: 523,
      durationMs: 550,
      gain: 0.5,
      sustain: 0.15,
      strikeMs: 45,
      type: 'sine',
    },
  ],
}

/**
 * Measured: 0.33 of peak by 25ms, 0.11 at 300ms, 0.02 at 1000ms, still audible
 * at 1200ms. The long quiet tail is what makes it a bell.
 */
const PHASE_CHANGE: ToneSpec = {
  notes: [
    {
      atMs: 0,
      freq: 2659,
      durationMs: 2050,
      gain: 0.32,
      sustain: 0.33,
      strikeMs: 22,
      type: 'sine',
      partial: { ratio: 2.578, gain: 0.14, decayScale: 0.45 },
    },
  ],
}

/** Transcribed from the measured onsets: G5 F5 C6, G5 F5, resolving on F6. */
const fanfare = (atMs: number, freq: number, durationMs: number, gain: number): Note => ({
  atMs,
  freq,
  durationMs,
  gain,
  // The app's figure holds its notes rather than plucking them, so these
  // sustain far higher than the struck cues do.
  sustain: 0.55,
  strikeMs: 60,
  type: 'triangle',
})

const COMPLETE: ToneSpec = {
  notes: [
    fanfare(0, 788, 520, 0.4),
    fanfare(420, 700, 660, 0.4),
    fanfare(1000, 1052, 700, 0.38),
    fanfare(1650, 788, 320, 0.36),
    fanfare(1900, 700, 320, 0.36),
    fanfare(2150, 1404, 1300, 0.4),
    fanfare(2150, 702, 1300, 0.2),
  ],
}

export function toneFor(kind: CueKind): ToneSpec | null {
  switch (kind) {
    case 'countdown':
      return COUNTDOWN
    case 'phase-change':
      return PHASE_CHANGE
    case 'workout-complete':
      return COMPLETE
    default:
      return null
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
