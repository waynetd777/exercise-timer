import type { Note, ToneSpec } from './tones'
import { sampleBytes, type SampleName } from './samples'
import { CANCEL_GRACE_MS } from './schedule'

/**
 * Web Audio wrapper.
 *
 * Cues are scheduled AHEAD on the audio clock, never fired from a JS tick: the
 * audio thread keeps time even when the main thread is throttled, so a beep
 * lands on the beat after the tab has been backgrounded for ten minutes.
 *
 * Nearly everything is synthesised. The one exception is the whistle, a CC0
 * recording (see `samples.ts`), decoded once at unlock and played from a buffer.
 * If that decode fails the note's own fields still make a plain tone, so a
 * missing sample costs fidelity and never a silent cue.
 *
 * Because a cue is BUILT when it is scheduled, that choice between recording and
 * fallback is made up to thirty seconds before the cue sounds. A decode finishing
 * in between therefore changes nothing on its own — hence `onSampleDecoded`, so
 * whoever queued those cues can queue them again.
 *
 * A note is built as a small graph:
 *
 *   oscillators ─┐
 *                ├─ each with its own envelope ─→ tremolo ─→ master
 *   resonances  ─┘
 *
 * Envelopes are per source, because a bell's high partial has to die before its
 * body stops ringing. The tremolo is shared, because it is one physical thing —
 * the pea in a whistle chopping the airflow — and it must modulate the noise as
 * well as the tone. Modulating only the tone was why the first whistle sounded
 * like a synthesiser.
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private pending = new Map<AudioScheduledSourceNode, number>()
  /** A second of white noise, made once and reused by every resonance. */
  private noiseBuffer: AudioBuffer | null = null
  private samples = new Map<SampleName, AudioBuffer>()
  private decoding = new Set<SampleName>()
  private decodeListeners = new Set<() => void>()

  /**
   * Must be called synchronously from a user gesture — mobile browsers refuse
   * to start an AudioContext otherwise. Idempotent, so wiring it to every
   * control is fine.
   */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    // Decoding needs a context, and unlock is the first moment one exists. The
    // bytes are already downloading (`samples.ts`), so this is short — but not
    // short enough to beat the scheduler's first arm, which is why it announces
    // itself when it lands.
    void this.decode('whistle')
  }

  /**
   * Decodes a downloaded sample once. Failure is deliberately swallowed — every
   * sampled note carries a synthesised fallback, so the cost of a dead network is
   * a slightly worse whistle rather than a missing one.
   */
  private async decode(name: SampleName): Promise<void> {
    const ctx = this.ctx
    if (!ctx || this.samples.has(name) || this.decoding.has(name)) return
    this.decoding.add(name)
    try {
      const bytes = await sampleBytes(name)
      if (!bytes) return
      // A copy per attempt: decodeAudioData detaches what it is handed, and the
      // download is kept so a second attempt has something left to decode.
      this.samples.set(name, await ctx.decodeAudioData(bytes.slice(0)))
      for (const listener of this.decodeListeners) listener()
    } catch {
      // Fallback covers it.
    } finally {
      this.decoding.delete(name)
    }
  }

  /**
   * Subscribes to a recording becoming available, and returns the unsubscribe.
   *
   * Needed because a queued cue is already built. On a cold start the first
   * window is armed in the same tick as the decode begins, so every cue in it —
   * the whistle at the end of the get-ready among them — was built with the
   * fallback tone, and stays that way for the first half-minute of the workout
   * unless it is queued again.
   */
  onSampleDecoded(listener: () => void): () => void {
    this.decodeListeners.add(listener)
    return () => {
      this.decodeListeners.delete(listener)
    }
  }

  /** Whether a sampled cue will actually use its recording. For the bench. */
  sampleReady(name: SampleName): boolean {
    return this.samples.has(name)
  }

  /** iOS suspends the context when the page hides; call this on the way back. */
  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume()
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0
  }

  /**
   * Drops cues that have NOT begun. Used on pause, seek, and every re-arm of the
   * rolling window.
   *
   * Judged per CUE, not per note. A cue already sounding is left alone entirely,
   * including notes of it still to come — the completion figure is three dings
   * over a second, and the moment it starts the workout also completes, which
   * re-runs the scheduler.
   */
  cancelPending(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const [source, cueStartedAt] of this.pending) {
      /*
       * A small grace, not zero: the timer's tick and the audio clock can
       * disagree by a few milliseconds, and without slack a figure is cancelled
       * a hair before it starts. Double-playing is prevented by the scheduler
       * deduplicating instead.
       */
      if (cueStartedAt <= now + CANCEL_GRACE_MS / 1000) continue
      try {
        source.stop(now)
      } catch {
        // Already stopped; nothing to do.
      }
      this.pending.delete(source)
    }
  }

  /**
   * Plays a spec straight away. For the sound bench — the running timer always
   * schedules ahead instead.
   */
  preview(spec: ToneSpec): void {
    this.unlock()
    this.scheduleTone(this.now + 0.05, spec)
  }

  /** Queues every note of a cue at an exact moment on the audio clock. */
  scheduleTone(at: number, spec: ToneSpec): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return

    // A cue whose moment has already passed is dropped rather than played late.
    if (at < ctx.currentTime - 0.05) return

    // Every note of this cue is tagged with the CUE's moment, so cancelling
    // later cannot take the tail off a figure that has already begun.
    const cueAt = Math.max(at, ctx.currentTime)

    for (const note of spec.notes) {
      this.playNote(ctx, master, Math.max(at + note.atMs / 1000, ctx.currentTime), cueAt, note)
    }
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate)
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buffer
    }
    return this.noiseBuffer
  }

  private playNote(
    ctx: AudioContext,
    master: GainNode,
    at: number,
    cueAt: number,
    note: Note,
  ): void {
    const total = note.durationMs / 1000

    // ── Shared chop, if any ────────────────────────────────────────────────
    let bus: AudioNode = master
    if (note.tremolo) {
      const trem = ctx.createGain()
      const half = note.tremolo.depth / 2
      trem.gain.value = 1 - half

      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.type = note.tremolo.shape ?? 'sine'
      lfo.frequency.value = note.tremolo.hz
      depth.gain.value = half
      lfo.connect(depth).connect(trem.gain)
      lfo.start(at)
      lfo.stop(at + total + 0.02)
      lfo.addEventListener('ended', () => depth.disconnect())

      trem.connect(master)
      bus = trem
    }

    // ── Envelope shared in SHAPE, applied per source ───────────────────────
    const envelope = (level: number, seconds: number): GainNode => {
      const attack = (note.attackMs ?? 6) / 1000
      const strike = Math.min(
        (note.strikeMs ?? 45) / 1000,
        Math.max(0.005, seconds - attack - 0.01),
      )
      const env = ctx.createGain()
      // Exponential ramps cannot reach or start from zero.
      env.gain.setValueAtTime(0.0001, at)
      env.gain.exponentialRampToValueAtTime(level, at + attack)
      env.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, level * (note.sustain ?? 0.15)),
        at + attack + strike,
      )
      env.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
      env.connect(bus)
      return env
    }

    const track = (source: AudioScheduledSourceNode, cleanup: () => void) => {
      source.start(at)
      source.stop(at + total + 0.02)
      this.pending.set(source, cueAt)
      source.addEventListener('ended', () => {
        this.pending.delete(source)
        cleanup()
      })
    }

    /*
     * ── A recording ────────────────────────────────────────────────────────
     * Played flat: the recording already has the envelope and the pitch, and
     * imposing ours on top is what made the synthesised attempts sound wrong.
     * `playbackRate` is the one liberty, since it shifts pitch and length
     * together exactly as blowing harder does.
     */
    const buffer = note.sample ? this.samples.get(note.sample) : undefined
    if (buffer) {
      const source = ctx.createBufferSource()
      const level = ctx.createGain()
      const rate = note.playbackRate ?? 1

      source.buffer = buffer
      source.playbackRate.value = rate
      level.gain.value = note.gain
      source.connect(level)
      level.connect(bus)

      // Its own duration, not the note's: the note's is the fallback's length.
      source.start(at)
      source.stop(at + buffer.duration / rate + 0.02)
      this.pending.set(source, cueAt)
      source.addEventListener('ended', () => {
        this.pending.delete(source)
        level.disconnect()
      })
      return
    }

    // ── Tone ───────────────────────────────────────────────────────────────
    const tone = (freq: number, level: number, seconds: number) => {
      const osc = ctx.createOscillator()
      osc.type = note.type ?? 'sine'
      osc.frequency.setValueAtTime(freq, at)

      if (note.warble) {
        const lfo = ctx.createOscillator()
        const depth = ctx.createGain()
        lfo.frequency.value = note.warble.hz
        depth.gain.value = note.warble.depthHz
        lfo.connect(depth).connect(osc.frequency)
        lfo.start(at)
        lfo.stop(at + total + 0.02)
        lfo.addEventListener('ended', () => depth.disconnect())
      }

      const env = envelope(level, seconds)
      osc.connect(env)
      track(osc, () => env.disconnect())
    }

    if (note.gain > 0) tone(note.freq, note.gain, total)
    if (note.partial) {
      tone(
        note.freq * note.partial.ratio,
        note.partial.gain,
        total * (note.partial.decayScale ?? 1),
      )
    }

    // ── Resonances: noise through a high-Q filter ──────────────────────────
    /*
     * This is what makes a whistle a whistle. A pea whistle is an air-jet edge
     * tone — mostly turbulence, given its pitch by a sharp resonance rather than
     * by an oscillator. A tone with a little noise on top sounds synthetic; noise
     * through a Q of twenty sounds blown.
     */
    for (const resonance of note.resonances ?? []) {
      const source = ctx.createBufferSource()
      const band = ctx.createBiquadFilter()

      source.buffer = this.noise(ctx)
      source.loop = true
      band.type = 'bandpass'
      band.Q.value = resonance.q

      // A short upward sweep is the sound of air pressure building.
      if (resonance.sweepFromHz !== undefined) {
        band.frequency.setValueAtTime(resonance.sweepFromHz, at)
        band.frequency.exponentialRampToValueAtTime(resonance.centreHz, at + 0.03)
      } else {
        band.frequency.setValueAtTime(resonance.centreHz, at)
      }

      // The pea shifting the cavity resonance — the trill, as opposed to the
      // level chop. Added to whatever the sweep left the frequency at.
      if (resonance.wobbleHz !== undefined && resonance.wobbleDepthHz !== undefined) {
        const lfo = ctx.createOscillator()
        const depth = ctx.createGain()
        lfo.frequency.value = resonance.wobbleHz
        depth.gain.value = resonance.wobbleDepthHz
        lfo.connect(depth).connect(band.frequency)
        lfo.start(at)
        lfo.stop(at + total + 0.02)
        lfo.addEventListener('ended', () => depth.disconnect())
      }

      const env = envelope(resonance.gain, total)
      source.connect(band).connect(env)
      track(source, () => {
        env.disconnect()
        band.disconnect()
      })
    }
  }
}

export const audio = new AudioEngine()
