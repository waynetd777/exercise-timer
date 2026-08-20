import type { Note, ToneSpec } from './tones'

/**
 * Web Audio wrapper.
 *
 * Cues are scheduled AHEAD on the audio clock, never fired from a JS tick: the
 * audio thread keeps time even when the main thread is throttled, so a beep
 * lands on the beat after the tab has been backgrounded for ten minutes.
 *
 * Everything is synthesised — no samples to fetch, decode, cache or lose
 * offline, and no third-party audio in the repo.
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private pending = new Set<OscillatorNode>()

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

  /** Stops everything queued but not yet sounded. Used on pause, seek and reset. */
  cancelPending(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const osc of this.pending) {
      try {
        osc.stop(now)
      } catch {
        // Already stopped; nothing to do.
      }
    }
    this.pending.clear()
  }

  /** Queues every note of a cue at an exact moment on the audio clock. */
  scheduleTone(at: number, spec: ToneSpec): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return

    // A cue whose moment has already passed is dropped rather than played late.
    if (at < ctx.currentTime - 0.05) return

    for (const note of spec.notes) {
      const noteAt = Math.max(at + note.atMs / 1000, ctx.currentTime)
      this.play(ctx, master, noteAt, note, note.freq, note.gain)
      if (note.partial) {
        this.play(
          ctx,
          master,
          noteAt,
          note,
          note.freq * note.partial.ratio,
          note.partial.gain,
        )
      }
    }
  }

  /**
   * One oscillator with a two-stage exponential envelope: peak to a tenth over
   * the measured decay, then down to silence over the rest. That two-stage
   * shape is what makes a synthesised note read as struck rather than as a tone
   * being switched off.
   */
  private play(
    ctx: AudioContext,
    master: GainNode,
    at: number,
    note: Note,
    freq: number,
    gain: number,
  ): void {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    const attack = 0.008
    const total = note.durationMs / 1000
    // Keep the stages ordered even if a note is given a very short duration.
    const decay = Math.min(note.decayMs / 1000, Math.max(0.01, total - attack - 0.01))

    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, at)

    // Ramped rather than switched, or every note starts with a click.
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain, at + attack)
    env.gain.exponentialRampToValueAtTime(gain * 0.1, at + attack + decay)
    env.gain.exponentialRampToValueAtTime(0.0001, at + total)

    osc.connect(env).connect(master)
    osc.start(at)
    osc.stop(at + total + 0.02)

    this.pending.add(osc)
    osc.addEventListener('ended', () => {
      this.pending.delete(osc)
      env.disconnect()
    })
  }
}

export const audio = new AudioEngine()
