import { useEffect, useRef } from 'react'
import type { Position } from '../engine'
import { canSpeak, speak, SPOKEN } from './speech'
import { lastStrikeMs, toneFor } from './tones'

/** Steps shorter than this never announce — the countdown beeps cover them. */
const MIN_STEP_MS = 20_000

/** Announced when this many seconds remain. */
const ANNOUNCE_AT = 10

/**
 * Gap between the last ding being struck and the wrap-up line.
 *
 * Measured from the strike rather than from the end of its tail: the tail is long
 * and quiet, and waiting it out would leave an awkward silence before the voice.
 */
const AFTER_LAST_DING_MS = 450

/**
 * Gap between pressing start and the opening line.
 *
 * Not zero, because a routine's first step already fires a cue AT zero: a bell if
 * it opens on "get ready", the whistle if it opens straight into work. 900ms
 * clears the whistle, the longer of the two, and lands over the bell's tail the
 * same way the wrap-up lands over the dings.
 */
const AFTER_START_CUE_MS = 900

/**
 * The spoken cues: an opening line, "ten seconds left" during a long step, and a
 * wrap-up once the routine is done.
 *
 * These are a different mechanism from the beeps and bells. Speech cannot be
 * queued against the audio clock, so it is fired from the timer's tick and may
 * land a fraction late — fine for information, and not fine for a beat, which is
 * why it lives apart from the scheduled cues.
 */
export function useSpokenCues(
  at: Position,
  status: 'idle' | 'running' | 'paused' | 'complete',
  muted: boolean,
): void {
  const announced = useRef<number | null>(null)
  const greeted = useRef(false)

  /*
   * The opening line, once per run.
   *
   * Guarded by a ref rather than by the elapsed time, because "the run started"
   * is not the same as "the clock reads zero": resuming from a pause also puts
   * the status back to running, and that must not greet again. The ref is set
   * even when muted, so unmuting halfway through a routine cannot trigger a
   * greeting twenty minutes late, and cleared on idle or complete so the next run
   * gets its own.
   */
  useEffect(() => {
    if (status === 'idle' || status === 'complete') {
      greeted.current = false
      return
    }
    if (status !== 'running' || greeted.current) return
    greeted.current = true
    if (muted || !canSpeak()) return
    const timer = window.setTimeout(() => speak(SPOKEN.enjoy), AFTER_START_CUE_MS)
    return () => window.clearTimeout(timer)
  }, [status, muted])

  /*
   * The wrap-up, after the three dings have been struck. Timed off the figure
   * itself rather than a hardcoded delay, so retuning the dings keeps the voice
   * following them.
   */
  useEffect(() => {
    if (status !== 'complete' || muted || !canSpeak()) return
    const delay = lastStrikeMs(toneFor('workout-complete')!) + AFTER_LAST_DING_MS
    const timer = window.setTimeout(() => speak(SPOKEN.thatsAWrap), delay)
    return () => window.clearTimeout(timer)
  }, [status, muted])

  /*
   * "Ten seconds left", once per long step. Keyed on the step's index rather
   * than on time, so a pause, a seek or a re-render cannot repeat it within the
   * same step.
   */
  useEffect(() => {
    if (status !== 'running' || muted || !canSpeak()) return
    const entry = at.entry
    if (!entry || entry.durationMs === undefined || entry.durationMs < MIN_STEP_MS) return

    const secondsLeft = Math.ceil(at.remainingMs / 1000)
    if (secondsLeft !== ANNOUNCE_AT) return
    if (announced.current === entry.index) return

    announced.current = entry.index
    speak(SPOKEN.tenSecondsLeft)
  }, [at, status, muted])
}
