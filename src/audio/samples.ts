import whistleUrl from './referee-whistle-cc0.wav?url'

/**
 * The app's only recorded sound.
 *
 * Everything else is synthesised, and for a long time the whistle was too. Five
 * attempts were rejected as not sounding like a whistle: as resonant noise, as a
 * measured carrier with a chop and an envelope, and finally as a pair of measured
 * contours driving one oscillator. The last got closest and has since been
 * deleted along with its generator — a pea whistle's character is the irregular
 * motion of the pea, and reproducing irregularity is what parameters cannot do.
 * If this file ever fails to decode, the cue falls back to a plain 2900Hz tone
 * from `WHISTLE`'s own fields rather than to a second synthesis engine.
 *
 * Synthesis was chosen for LICENSING, never for preference. The reference was the
 * Tabata Timer app's whistle, which cannot ship — its audio was purged from this
 * repo's history before it went public.
 *
 * That turned out to be unnecessary. Measuring CC0 candidates against the Tabata
 * whistle found one matching on every figure — 852ms sounding, 2902Hz peak, 98.4%
 * of energy in the fundamental, 9.9Hz rattle — and a waveform cross-correlation of
 * 0.992 at a 0.2ms lag confirmed it: the Tabata app is playing THIS recording. The
 * sound behind five failed synthesis attempts was public domain the whole time.
 *
 * PROVENANCE
 *   "Referee whistle blow, gymnasium.wav" — SpliceSound, freesound.org sound 218318
 *   https://freesound.org/people/SpliceSound/sounds/218318/
 *   Licence: Creative Commons 0 1.0 (public domain dedication), confirmed against
 *   the licence link in the page markup, not a search summary.
 *
 * PREPARATION of the 3.329s original: trimmed to the blast plus its natural
 * gymnasium decay (899ms), peak-normalised, 3ms fades so the cut cannot click,
 * and downsampled to 22.05kHz mono. The fundamental is 2.9kHz, so 22.05kHz keeps
 * everything audible up to 11kHz and costs 44KB where the 24-bit original costs
 * 477KB. It stays a WAV because macOS ships no mp3 encoder and AAC decode support
 * is not universal; 44KB is not worth a codec gamble on a sound that has to work
 * in a gym with no signal.
 *
 * CC0 requires no attribution. This block is here so the next person can see at a
 * glance that the file is safe to ship, which an audio file cannot say for itself.
 */
export type SampleName = 'whistle'

export const SAMPLES: Record<SampleName, string> = { whistle: whistleUrl }
