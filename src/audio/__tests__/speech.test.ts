/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { canSpeak, speak, unlockSpeech } from '../speech'

/**
 * The synthesiser is a browser API, so these tests stand one in up. What is worth
 * asserting is the CONTRACT the iOS unlock depends on: primed once, from a
 * gesture, and never a thrown error when there is no voice at all.
 */
type Spoken = { text: string; volume: number }

function stubSpeech(): { spoken: Spoken[]; cancels: number } {
  const spoken: Spoken[] = []
  const state = { spoken, cancels: 0 }
  vi.stubGlobal('speechSynthesis', {
    speak: (u: Spoken) => spoken.push({ text: u.text, volume: u.volume }),
    cancel: () => {
      state.cancels += 1
    },
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      rate = 1
      volume = 1
      constructor(text: string) {
        this.text = text
      }
    },
  )
  vi.stubGlobal('window', { speechSynthesis: globalThis.speechSynthesis })
  return state
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('speech', () => {
  it('says nothing at all when there is no voice', () => {
    // No window, no speechSynthesis: every entry point has to be a no-op rather
    // than an exception, since a missing voice must not stop a workout.
    expect(canSpeak()).toBe(false)
    expect(() => unlockSpeech()).not.toThrow()
    expect(() => speak('anything')).not.toThrow()
  })

  it('primes with something inaudible, and only once', () => {
    const state = stubSpeech()

    unlockSpeech()
    unlockSpeech()
    unlockSpeech()

    // One utterance, silent, and enough to be the page's first, which is what iOS
    // drops when it does not come from a gesture.
    expect(state.spoken).toHaveLength(1)
    expect(state.spoken[0]!.volume).toBe(0)
    expect(state.spoken[0]!.text.trim()).toBe('')
    // And it leaves nothing queued for the first real line to cancel.
    expect(state.cancels).toBe(0)
  })
})
