import { useEffect, useMemo, useRef } from 'react'
import { finishesOnTap, runCues } from '../engine'
import type { Routine } from '../engine'
import { cueKey, dueCues, REARM_MS, requeueable } from './schedule'
import type { RunStatus } from '../state/useTimer'
import { audio } from './engine'
import { audioTimeFor, toneFor } from './tones'

type Options = {
  routine: Routine
  /** Which run the clock is measuring. Cues are armed one run at a time. */
  runIndex: number
  status: RunStatus
  muted: boolean
  /** Reads current elapsed run time. Must be live, not a snapshot. */
  readElapsed: () => number
  /** Bumped by every clock mutation (start / pause / resume / seek / reset). */
  generation: number
}

/**
 * Keeps a rolling window of cues queued on the audio clock.
 *
 * Re-arms on a timer, on every clock mutation, on return to visibility, and when
 * a recording finishes decoding. Each arm cancels what was pending first, so a
 * pause or a skip cannot leave orphaned beeps from a position the workout has
 * left.
 */
export function useCueScheduler({
  routine,
  runIndex,
  status,
  muted,
  readElapsed,
  generation,
}: Options): void {
  const allCues = useMemo(() => runCues(routine, runIndex), [routine, runIndex])

  /**
   * Cues already queued, so a re-arm adds only what is new.
   *
   * Necessary because cancellation spares a cue that has begun, or is about to,
   * and without deduplication that same cue would be scheduled again by the
   * arm that follows, and play twice.
   */
  const scheduled = useRef(new Set<string>())

  // A clock jump abandons everything queued from the old position.
  useEffect(() => {
    audio.cancelPending()
    scheduled.current.clear()
  }, [generation])

  useEffect(() => {
    if (status !== 'running' || muted) {
      audio.cancelPending()
      scheduled.current.clear()
      return
    }

    const arm = () => {
      if (!audio.ready) return

      const elapsed = readElapsed()
      const audioNow = audio.now

      for (const cue of dueCues(allCues, elapsed, scheduled.current)) {
        const spec = toneFor(cue.kind)
        if (!spec) continue

        audio.scheduleTone(audioTimeFor(cue.atMs, elapsed, audioNow), spec)
        scheduled.current.add(cueKey(cue))
      }
    }

    /*
     * Queue again what the whistle recording has changed under us.
     *
     * A queued cue is already built, fallback tone and all (see
     * `onSampleDecoded`), and on a cold start the whole first window was queued
     * before the decode finished, including the whistle at the end of the
     * get-ready. Cancelling and re-arming rebuilds them with the recording.
     *
     * Only what cancellation actually dropped is forgotten: a cue already
     * sounding is spared, and forgetting it would queue it a second time.
     */
    const stopWaiting = audio.onSampleDecoded(() => {
      const elapsed = readElapsed()
      audio.cancelPending()
      for (const key of requeueable(allCues, elapsed, scheduled.current)) {
        scheduled.current.delete(key)
      }
      arm()
    })

    arm()
    const interval = window.setInterval(arm, REARM_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // iOS suspends the context while hidden. Resume before re-arming, or
        // every cue is scheduled against a frozen clock.
        audio.resume()
        arm()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopWaiting()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, muted, allCues, readElapsed])

  /*
   * The finish, when the routine ends on a self-paced step.
   *
   * There is no final duration to hang it on, because the routine ends when the
   * user taps, so it cannot be queued on the audio clock ahead of time the way every
   * other cue is. Fired here instead, which costs a few milliseconds of accuracy
   * on a figure that is an announcement rather than a beat.
   */
  const finished = useRef(false)
  useEffect(() => {
    if (status !== 'complete') {
      finished.current = false
      return
    }
    if (finished.current || muted || !finishesOnTap(routine)) return
    finished.current = true
    const spec = toneFor('workout-complete')
    if (spec) audio.scheduleTone(audio.now, spec)
  }, [status, muted, routine])
}
