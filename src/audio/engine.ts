import type { ToneSpec } from './tones'

/**
 * Web Audio wrapper.
 *
 * Cues are scheduled AHEAD on the audio clock, never fired from a JS tick: the
 * audio thread keeps time even when the main thread is throttled, so a beep
 * lands on the beat after the tab has been backgrounded for ten minutes.
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

  scheduleTone(at: number, spec: ToneSpec): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return

    // A cue whose moment has already passed is dropped rather than played late.
    const startAt = Math.max(at, ctx.currentTime)
    if (at < ctx.currentTime - 0.05) return

    this.blip(ctx, master, startAt, spec.freq, spec.durationMs, spec.gain, spec.type)
    if (spec.then) {
      this.blip(
        ctx,
        master,
        startAt + spec.then.afterMs / 1000,
        spec.then.freq,
        spec.then.durationMs,
        spec.gain,
        spec.type,
      )
    }
  }

  private blip(
    ctx: AudioContext,
    master: GainNode,
    at: number,
    freq: number,
    durationMs: number,
    gain: number,
    type: OscillatorType,
  ): void {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    const seconds = durationMs / 1000

    osc.type = type
    osc.frequency.setValueAtTime(freq, at)

    // Ramped rather than switched, or every beep starts with a click.
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain, at + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, at + seconds)

    osc.connect(env).connect(master)
    osc.start(at)
    osc.stop(at + seconds + 0.02)

    this.pending.add(osc)
    osc.addEventListener('ended', () => {
      this.pending.delete(osc)
      env.disconnect()
    })
  }
}

export const audio = new AudioEngine()
