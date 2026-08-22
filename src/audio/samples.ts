import whistleUrl from './referee-whistle-cc0.wav?url'

/**
 * The app's only recorded sound.
 *
 * Everything else is synthesised, and for a long time the whistle was too. Five
 * attempts were rejected as not sounding like a whistle: as resonant noise, as a
 * measured carrier with a chop and an envelope, and finally as a pair of measured
 * contours driving one oscillator. The last got closest and has since been
 * deleted along with its generator. A pea whistle's character is the irregular
 * motion of the pea, and reproducing irregularity is what parameters cannot do.
 * If this file ever fails to decode, the cue falls back to a plain 2900Hz tone
 * from `WHISTLE`'s own fields rather than to a second synthesis engine.
 *
 * Synthesis was chosen for LICENSING, never for preference. The reference was the
 * Tabata Timer app's whistle, which cannot ship, since its audio was purged from this
 * repo's history before it went public.
 *
 * That turned out to be unnecessary. Measuring CC0 candidates against the Tabata
 * whistle found one matching on every figure (852ms sounding, 2902Hz peak, 98.4%
 * of energy in the fundamental, 9.9Hz rattle) with a waveform cross-correlation of
 * 0.992 at a 0.2ms lag confirmed it: the Tabata app is playing THIS recording. The
 * sound behind five failed synthesis attempts was public domain the whole time.
 *
 * PROVENANCE
 *   "Referee whistle blow, gymnasium.wav" by SpliceSound, freesound.org sound 218318
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

/**
 * The download, started at module load rather than at the first tap.
 *
 * The two halves of getting a recording ready are the fetch and the decode, and
 * only the decode needs an AudioContext, so only the decode has to wait for the
 * gesture that creates one. Waiting for both is what made the first whistle of a
 * cold start the fallback tone: `unlock()` started the fetch and the scheduler
 * armed its first window in the same tick, long before the bytes landed, and a
 * cue chooses recording or fallback when it is SCHEDULED.
 *
 * The decode is deliberately NOT also done eagerly, through an
 * OfflineAudioContext, though it could be. Either that context is built at the
 * file's own 22.05kHz, and the playback resampler makes up the difference on a
 * sound that took five attempts to get right, or the real AudioContext is created
 * outside a gesture to learn the hardware rate, and the gesture-to-audio path is
 * the one part of this app that cannot be checked from a desktop browser. A few
 * milliseconds of decode is not worth either.
 */
const BYTES = new Map<SampleName, Promise<ArrayBuffer | null>>()

/**
 * Never rejects: a dead network has to cost a worse whistle and nothing more, and
 * an unhandled rejection at boot is noise in the one place it is hard to read.
 *
 * A failure is forgotten rather than remembered, so the next attempt fetches
 * again. The alternative, one null kept for the life of the page, would mean a
 * page that happened to load without signal sounded a plain tone for the whole
 * session, which is the exact situation this app is built for.
 */
function download(name: SampleName): Promise<ArrayBuffer | null> {
  const bytes = fetch(SAMPLES[name])
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null)

  void bytes.then((got) => {
    if (!got && BYTES.get(name) === bytes) BYTES.delete(name)
  })

  return bytes
}

/** The bytes of a sample once downloaded, or null if the download failed. */
export function sampleBytes(name: SampleName): Promise<ArrayBuffer | null> {
  let bytes = BYTES.get(name)
  if (!bytes) {
    bytes = download(name)
    BYTES.set(name, bytes)
  }
  return bytes
}

// Now, not at the first tap: only the decode needs a gesture.
void sampleBytes('whistle')
