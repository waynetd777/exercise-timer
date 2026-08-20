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

export type Note = {
  /** Offset from the cue's moment, in ms. */
  atMs: number
  freq: number
  durationMs: number
  /** Peak level, 0-1. */
  gain: number
  /** Milliseconds to fall to a tenth of peak — the perceived decay. */
  decayMs: number
  type?: OscillatorType
  /** An inharmonic partial, as a multiple of `freq`. Gives metallic timbres. */
  partial?: { ratio: number; gain: number }
}

export type ToneSpec = { notes: Note[] }

const COUNTDOWN: ToneSpec = {
  notes: [{ atMs: 0, freq: 523, durationMs: 500, gain: 0.5, decayMs: 92, type: 'sine' }],
}

const PHASE_CHANGE: ToneSpec = {
  notes: [
    {
      atMs: 0,
      freq: 2658,
      durationMs: 900,
      gain: 0.32,
      decayMs: 306,
      type: 'sine',
      partial: { ratio: 2.578, gain: 0.12 },
    },
  ],
}

/** Transcribed from the measured onsets: G5 F5 C6, G5 F5, resolving on F6. */
const COMPLETE: ToneSpec = {
  notes: [
    { atMs: 0, freq: 788, durationMs: 480, gain: 0.4, decayMs: 260, type: 'triangle' },
    { atMs: 420, freq: 700, durationMs: 620, gain: 0.4, decayMs: 320, type: 'triangle' },
    { atMs: 1000, freq: 1052, durationMs: 620, gain: 0.38, decayMs: 340, type: 'triangle' },
    { atMs: 1650, freq: 788, durationMs: 300, gain: 0.36, decayMs: 180, type: 'triangle' },
    { atMs: 1900, freq: 700, durationMs: 300, gain: 0.36, decayMs: 180, type: 'triangle' },
    { atMs: 2150, freq: 1404, durationMs: 1100, gain: 0.4, decayMs: 620, type: 'triangle' },
    { atMs: 2150, freq: 702, durationMs: 1100, gain: 0.2, decayMs: 620, type: 'triangle' },
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
