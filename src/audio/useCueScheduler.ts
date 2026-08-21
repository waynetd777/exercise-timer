import { useEffect, useMemo, useRef } from 'react'
import { cues } from '../engine'
import type { Timeline } from '../engine'
import { cueKey, dueCues, REARM_MS } from './schedule'
import type { RunStatus } from '../state/useTimer'
import { audio } from './engine'
import { audioTimeFor, toneFor } from './tones'

type Options = {
  timeline: Timeline
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
 * Re-arms on a timer, on every clock mutation, and on return to visibility.
 * Each arm cancels what was pending first, so a pause or a skip cannot leave
 * orphaned beeps from a position the workout has left.
 */
export function useCueScheduler({
  timeline,
  status,
  muted,
  readElapsed,
  generation,
}: Options): void {
  const allCues = useMemo(() => cues(timeline), [timeline])

  /**
   * Cues already queued, so a re-arm adds only what is new.
   *
   * Necessary because cancellation spares a cue that has begun — or is about to
   * — and without deduplication that same cue would be scheduled again by the
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

    arm()
    const interval = window.setInterval(arm, REARM_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // iOS suspends the context while hidden — resume before re-arming, or
        // every cue is scheduled against a frozen clock.
        audio.resume()
        arm()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, muted, allCues, readElapsed])
}
