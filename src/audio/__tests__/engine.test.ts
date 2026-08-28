/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toneFor } from '../tones'

/**
 * A sliver of Web Audio: enough to see what the engine starts, when, and what
 * it stops. Node has no AudioContext, so nothing here has ever run in a test.
 */
class FakeParam {
  value = 0
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}
class FakeNode {
  connect<T>(node: T): T {
    return node
  }
  disconnect(): void {}
  addEventListener(): void {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam()
}
class FakeSource extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  playbackRate = new FakeParam()
  buffer: unknown = null
  started: number | null = null
  stopped: number | null = null
  start(at: number): void {
    this.started = at
  }
  stop(at: number): void {
    this.stopped = at
  }
}
class FakeContext {
  currentTime = 100
  state = 'running'
  sampleRate = 48_000
  destination = new FakeNode()
  sources: FakeSource[] = []
  constructor() {
    contexts.push(this)
  }
  createGain(): FakeGain {
    return new FakeGain()
  }
  createOscillator(): FakeSource {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }
  createBufferSource(): FakeSource {
    return this.createOscillator()
  }
  addEventListener(): void {}
  resume(): Promise<void> {
    return Promise.resolve()
  }
  decodeAudioData(): Promise<never> {
    return Promise.reject(new Error('no decoder here'))
  }
}
/** Every context built, newest last. */
const contexts: FakeContext[] = []
const made = () => contexts[contexts.length - 1]!

const beep = toneFor('countdown')!

async function freshEngine() {
  vi.resetModules()
  contexts.length = 0
  vi.stubGlobal('AudioContext', FakeContext)
  // The whistle download starts at module load; there is no network here.
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: false }))
  const { audio } = await import('../engine')
  audio.unlock()
  return audio
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('the audio engine', () => {
  it('drops a cue later than the grace, and plays one within it', async () => {
    const audio = await freshEngine()
    audio.scheduleTone(100 - 0.2, beep)
    expect(made().sources.filter((s) => s.started !== null)).toHaveLength(0)

    audio.scheduleTone(100 - 0.1, beep)
    const played = made().sources.filter((s) => s.started !== null)
    expect(played.length).toBeGreaterThan(0)
    // Never in the past: the audio clock cannot start a source before now.
    for (const source of played) expect(source.started).toBeGreaterThanOrEqual(100)
  })

  it('cancels what has not begun and spares what is about to', async () => {
    const audio = await freshEngine()
    audio.scheduleTone(101, beep)
    audio.scheduleTone(100.1, beep)
    const far = made().sources.filter((s) => s.started === 101)
    const near = made().sources.filter((s) => s.started === 100.1)
    expect(far.length).toBeGreaterThan(0)
    expect(near.length).toBeGreaterThan(0)

    audio.cancelPending()

    // Stopped NOW, not at its own end.
    for (const source of far) expect(source.stopped).toBe(100)
    // Within CANCEL_GRACE_MS: left to play, or the scheduler's dedup would
    // have it queued a second time on the arm that follows.
    for (const source of near) expect(source.stopped).toBeGreaterThan(100.1)
  })

  it('is silent, not broken, where there is no Web Audio', async () => {
    vi.resetModules()
    vi.stubGlobal('AudioContext', () => {
      throw new Error('not here')
    })
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false }))
    const { audio } = await import('../engine')
    expect(() => audio.unlock()).not.toThrow()
    expect(audio.ready).toBe(false)
    expect(() => audio.scheduleTone(1, beep)).not.toThrow()
  })
})
