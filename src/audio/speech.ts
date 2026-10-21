// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

/**
 * Spoken cues, using the browser's own voice.
 *
 * Deliberately NOT part of the pre-scheduled cue system: speech cannot be queued
 * against the audio clock, so it is fired from the timer's tick instead and may
 * land a fraction of a second late. That is fine for "ten seconds left", which is
 * information rather than a beat, and it is why it lives in its own module, so
 * nobody mistakes it for a scheduled cue.
 */
/** Every phrase the app speaks, in one place so the bench and the timer agree. */
export const SPOKEN = {
  start: "Let's go!",
  tenSecondsLeft: 'Ten seconds left',
  thatsAWrap: "That's a wrap, well done!",
  getReadyFor: (name: string) => `Get ready for ${name}`,
} as const

/**
 * What a get-ready says: what its own pane shows, when that names the exercise.
 *
 * A routine generated with active recovery opens each exercise on "Get ready:
 * Leg Press 65kg", and the step after it is the cardio minute you change the pin
 * during, not the exercise. So a name that already says what it is for is the
 * one read out. A bare "Get ready" says nothing about what comes next, so it
 * names the exercise it leads into instead. Any other get-ready, "Change Sides"
 * being the one the generator writes, is an instruction in itself, and is said
 * as written.
 */
export function getReadyLine(name: string, upcoming: string | null): string | null {
  // Said as "Get ready for Leg Press 65kg": the colon reads on screen, not aloud.
  const named = /^get ready\s*:\s*(.+)$/i.exec(name)
  if (named) return SPOKEN.getReadyFor(named[1]!)
  if (!/^get ready$/i.test(name.trim())) return name
  return upcoming ? SPOKEN.getReadyFor(upcoming) : null
}

/** How it is spoken. Slightly quick, slightly under full volume. */
export const VOICE = { rate: 1.05, volume: 0.9 } as const

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Primes the synthesiser from a user gesture.
 *
 * iOS drops the FIRST utterance a page makes unless the call happens inside a
 * gesture, and the opening line does not: it fires from an effect and then a
 * timeout, a beat after the tap. So "Let's go!" was silent the first time a
 * routine was started after opening the app, and fine every time after, which is
 * exactly what a dropped first utterance looks like.
 *
 * The same problem the AudioContext has, and the same shape of answer: every
 * control calls this, synchronously, the way it calls `audio.unlock()`.
 *
 * A single space at zero volume is enough to be the first utterance: inaudible,
 * over immediately, and it leaves nothing queued for `speak()` to cancel.
 */
let primed = false

export function unlockSpeech(): void {
  if (primed || !canSpeak()) return
  primed = true
  try {
    const utterance = new SpeechSynthesisUtterance(' ')
    utterance.volume = 0
    speechSynthesis.speak(utterance)
  } catch {
    // Same as `speak`: silence is an acceptable outcome.
  }
}

export function speak(text: string): void {
  if (!canSpeak()) return
  try {
    // Drop anything still queued: a late cue is worse than a skipped one.
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = VOICE.rate
    utterance.volume = VOICE.volume
    speechSynthesis.speak(utterance)
  } catch {
    // No voice available, or blocked. Silence is an acceptable outcome.
  }
}
