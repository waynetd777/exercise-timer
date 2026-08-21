/**
 * Spoken cues, using the browser's own voice.
 *
 * Deliberately NOT part of the pre-scheduled cue system: speech cannot be queued
 * against the audio clock, so it is fired from the timer's tick instead and may
 * land a fraction of a second late. That is fine for "ten seconds left", which is
 * information rather than a beat, and it is why it lives in its own module — so
 * nobody mistakes it for a scheduled cue.
 */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string): void {
  if (!canSpeak()) return
  try {
    // Drop anything still queued: a late cue is worse than a skipped one.
    speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.05
    utterance.volume = 0.9
    speechSynthesis.speak(utterance)
  } catch {
    // No voice available, or blocked. Silence is an acceptable outcome.
  }
}
