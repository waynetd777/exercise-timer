/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

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
 * Re-arms on a timer, on every clock mutation, on return to visibility, when the
 * context changes state, and when a recording finishes decoding. Each of those
 * cancels what was pending first, so a pause, a skip, or a spell in the
 * background cannot leave orphaned beeps from a position the workout has left.
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
     * Cancel what no longer belongs, then queue the window afresh.
     *
     * For every path where the queue has gone stale under us: a clock jump, a
     * recording decoding mid-window (a queued cue is already built, fallback
     * tone and all, see `onSampleDecoded`), the context changing state, and
     * the page coming back to visibility.
     *
     * Only what cancellation actually dropped is forgotten: a cue already
     * sounding is spared, and forgetting it would queue it a second time.
     */
    const rearm = () => {
      const elapsed = readElapsed()
      audio.cancelPending()
      for (const key of requeueable(allCues, elapsed, scheduled.current)) {
        scheduled.current.delete(key)
      }
      arm()
    }

    // `generation` is in the deps below, so a clock jump lands here: the stale
    // queue is dropped and the new position armed at once, not up to REARM_MS
    // later, which used to silence a short step skipped into.
    rearm()
    const interval = window.setInterval(arm, REARM_MS)

    const stopWaiting = audio.onSampleDecoded(rearm)

    // Arming against a suspended context is a no-op and `resume()` lands
    // asynchronously, so the state actually reaching running must arm again.
    // A full rearm, because after an iOS interruption (a call, Siri, an alarm)
    // everything queued is aimed at moments measured on a clock that stood
    // still, and must be dropped rather than played late.
    const stopWatching = audio.onStateChange(rearm)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // iOS suspends the context while hidden: its clock froze while the run's
      // kept counting, so everything queued before hiding is aimed at moments
      // the run has left. Drop those BEFORE resuming, or the restarted clock
      // plays them all, late and meaningless. The arm inside rearm() bails
      // while still suspended; the statechange above arms once resume() lands.
      rearm()
      audio.resume()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopWaiting()
      stopWatching()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [generation, status, muted, allCues, readElapsed])

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
    if (finished.current) return
    // Latched even when muted: the finish happened either way, and unmuting
    // on the summary screen later must not replay it.
    finished.current = true
    if (muted || !finishesOnTap(routine)) return
    const spec = toneFor('workout-complete')
    if (spec) audio.scheduleTone(audio.now, spec)
  }, [status, muted, routine])
}
