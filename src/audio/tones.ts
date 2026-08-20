import type { CueKind } from '../engine'

export type ToneSpec = {
  freq: number
  durationMs: number
  gain: number
  type: OscillatorType
  /** A second note, for a two-note figure. */
  then?: { freq: number; afterMs: number; durationMs: number }
}

/**
 * FALLBACK cues, synthesised with oscillators.
 *
 * The real cues are now the Tabata Timer samples in `samples.ts` — this covers
 * the window before they decode, and any case where a file is missing or a
 * browser will not decode mp3, so a cue is never silent.
 *
 * The three countdown blips rise (F#5, A♭5, B♭5) and the phase change resolves
 * above them (D#6), so an approaching transition is audible as shape.
 */
export function toneFor(kind: CueKind, value?: number): ToneSpec | null {
  switch (kind) {
    case 'countdown': {
      const pitch = value === 3 ? 740 : value === 2 ? 830 : 932
      return { freq: pitch, durationMs: 90, gain: 0.22, type: 'triangle' }
    }
    case 'phase-change':
      return { freq: 1245, durationMs: 200, gain: 0.3, type: 'triangle' }
    case 'workout-complete':
      return {
        freq: 880,
        durationMs: 220,
        gain: 0.3,
        type: 'triangle',
        then: { freq: 1319, afterMs: 200, durationMs: 420 },
      }
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
