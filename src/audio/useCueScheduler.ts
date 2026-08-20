import { useEffect, useMemo } from 'react'
import { cues, cuesBetween } from '../engine'
import type { Timeline } from '../engine'
import type { RunStatus } from '../state/useTimer'
import { audio } from './engine'
import { audioTimeFor, toneFor } from './tones'

/** How far ahead cues are queued on the audio clock. */
const LOOKAHEAD_MS = 30_000

/** Re-arm well inside the window so a throttled timer cannot open a gap. */
const REARM_MS = LOOKAHEAD_MS / 3

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

  useEffect(() => {
    if (status !== 'running' || muted) {
      audio.cancelPending()
      return
    }

    const arm = () => {
      audio.cancelPending()
      if (!audio.ready) return

      const elapsed = readElapsed()
      const audioNow = audio.now

      for (const cue of cuesBetween(allCues, elapsed, elapsed + LOOKAHEAD_MS)) {
        const spec = toneFor(cue.kind)
        if (spec) audio.scheduleTone(audioTimeFor(cue.atMs, elapsed, audioNow), spec)
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
      audio.cancelPending()
    }
  }, [status, muted, allCues, readElapsed, generation])
}
