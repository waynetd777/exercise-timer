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
  /** Scheduled oscillators, mapped to the audio time they start at. */
  private pending = new Map<OscillatorNode, number>()

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

  /**
   * Drops cues that are queued but have NOT started yet. Used on pause, seek,
   * and every re-arm of the rolling window.
   *
   * Notes already sounding are deliberately left to ring out: cutting an
   * oscillator mid-ring is itself an audible click, and since the window
   * re-arms every ten seconds, stopping everything meant any cue unlucky enough
   * to overlap a re-arm was truncated — which is exactly what turned the bell
   * into a click.
   */
  cancelPending(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const [osc, startAt] of this.pending) {
      if (startAt <= now + 0.01) continue
      try {
        osc.stop(now)
      } catch {
        // Already stopped; nothing to do.
      }
      this.pending.delete(osc)
    }
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
      this.play(ctx, master, noteAt, note, note.freq, note.gain, note.durationMs)
      if (note.partial) {
        this.play(
          ctx,
          master,
          noteAt,
          note,
          note.freq * note.partial.ratio,
          note.partial.gain,
          note.durationMs * (note.partial.decayScale ?? 1),
        )
      }
    }
  }

  /**
   * One oscillator with a strike-then-ring envelope: up over a few ms, down to
   * the sustain level over `strikeMs`, then a long exponential tail to silence.
   *
   * The tail is what makes it read as struck. A single exponential from peak
   * sounds like a tone being switched off.
   */
  private play(
    ctx: AudioContext,
    master: GainNode,
    at: number,
    note: Note,
    freq: number,
    gain: number,
    durationMs: number,
  ): void {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    const attack = 0.006
    const total = durationMs / 1000
    // Keep the stages strictly ordered even for a very short note.
    const strike = Math.min(note.strikeMs / 1000, Math.max(0.005, total - attack - 0.01))
    // Exponential ramps cannot reach or start from zero.
    const sustain = Math.max(0.0002, gain * note.sustain)

    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, at)

    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain, at + attack)
    env.gain.exponentialRampToValueAtTime(sustain, at + attack + strike)
    env.gain.exponentialRampToValueAtTime(0.0001, at + total)

    osc.connect(env).connect(master)
    osc.start(at)
    osc.stop(at + total + 0.02)

    this.pending.set(osc, at)
    osc.addEventListener('ended', () => {
      this.pending.delete(osc)
      env.disconnect()
    })
  }
}

export const audio = new AudioEngine()
