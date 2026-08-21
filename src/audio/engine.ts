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
  /**
   * Scheduled oscillators, mapped to the time their CUE began — not their own
   * start time. A cue can be several notes spread over seconds, and once it has
   * started the whole figure has to be allowed to finish.
   */
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
   * Drops cues that have NOT begun. Used on pause, seek, and every re-arm of the
   * rolling window.
   *
   * Judged per CUE, not per note. A cue already sounding is left alone entirely,
   * including notes of it still to come — the completion figure is seven notes
   * over three seconds, and the moment it starts the workout also completes,
   * which re-runs the scheduler and cancelled every note but the first. Cutting
   * an oscillator mid-ring is an audible click, so the earlier per-note version
   * of this fixed the bell and left the fanfare broken in the same way.
   */
  cancelPending(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const [osc, cueStartedAt] of this.pending) {
      /*
       * A small grace, not zero. The completion cue fires at the same instant
       * the workout completes and the scheduler re-runs, and the timer's tick
       * and the audio clock can disagree by a few milliseconds — without slack
       * the fanfare is cancelled a hair before it starts. Double-playing is
       * prevented by the scheduler deduplicating instead.
       */
      if (cueStartedAt <= now + 0.15) continue
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

    // Every note of this cue is tagged with the CUE's moment, so cancelling
    // later cannot take the tail off a figure that has already begun.
    const cueAt = Math.max(at, ctx.currentTime)

    for (const note of spec.notes) {
      const noteAt = Math.max(at + note.atMs / 1000, ctx.currentTime)
      this.play(ctx, master, noteAt, cueAt, note, note.freq, note.gain, note.durationMs)
      if (note.partial) {
        this.play(
          ctx,
          master,
          noteAt,
          cueAt,
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
    cueAt: number,
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

    this.pending.set(osc, cueAt)
    osc.addEventListener('ended', () => {
      this.pending.delete(osc)
      env.disconnect()
    })
  }
}

export const audio = new AudioEngine()
