import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compile, position, skipBack, skipForward } from '../engine'
import type { Position, Timeline, Workout } from '../engine'
import type { Clock } from './clock'
import { elapsed, IDLE_CLOCK, paused, resumed, seeked, started } from './clock'
import { useWakeLock } from './useWakeLock'

export type RunStatus = 'idle' | 'running' | 'paused' | 'complete'

export type Timer = {
  timeline: Timeline
  status: RunStatus
  /** Position at the current moment. Recomputed whenever the display changes. */
  at: Position
  /** Whole seconds to show for the current step. */
  secondsLeft: number
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  next: () => void
  previous: () => void
}

/** Monotonic. Immune to the system clock being changed mid-workout. */
const now = () => performance.now()

/**
 * Owns run state as `{ startedAt, pausedTotalMs }` and DERIVES elapsed from the
 * clock. Nothing accumulates ticks, so a throttled or backgrounded tab cannot
 * drift — coming back after ten minutes simply shows the truth.
 *
 * Rather than a 60fps animation frame loop, this schedules one timeout for the
 * exact instant the displayed value next changes (the next whole second, or the
 * end of the step, whichever comes first). About one callback per second
 * instead of sixty, with no loss of precision.
 */
export function useTimer(workout: Workout): Timer {
  const timeline = useMemo(() => compile(workout), [workout])

  const [status, setStatus] = useState<RunStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)

  const clock = useRef<Clock>(IDLE_CLOCK)
  const readElapsed = useCallback(() => elapsed(clock.current, now()), [])

  const at = useMemo(() => position(timeline, elapsedMs), [timeline, elapsedMs])

  // Schedule the next update for the moment the display actually changes.
  useEffect(() => {
    if (status !== 'running') return

    const tick = () => {
      const elapsed = readElapsed()
      const current = position(timeline, elapsed)

      if (current.isComplete) {
        setElapsedMs(timeline.totalMs)
        setStatus('complete')
        return
      }

      setElapsedMs(elapsed)

      const secondsShown = Math.ceil(current.remainingMs / 1000)
      const nextChangeAt = current.entry!.endMs - (secondsShown - 1) * 1000
      timeoutId = window.setTimeout(tick, Math.max(16, nextChangeAt - elapsed))
    }

    let timeoutId = window.setTimeout(tick, 0)

    // Returning to a hidden tab: resync immediately rather than waiting for a
    // throttled timeout to fire.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timeoutId)
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, timeline, readElapsed])

  useWakeLock(status === 'running')

  const seekTo = useCallback((to: number, freeze: boolean) => {
    clock.current = seeked(now(), to, freeze)
    setElapsedMs(to)
  }, [])

  const start = useCallback(() => {
    clock.current = started(now())
    setElapsedMs(0)
    setStatus('running')
  }, [])

  const pause = useCallback(() => {
    if (status !== 'running') return
    clock.current = paused(clock.current, now())
    setStatus('paused')
  }, [status])

  const resume = useCallback(() => {
    if (status !== 'paused') return
    clock.current = resumed(clock.current, now())
    setStatus('running')
  }, [status])

  const reset = useCallback(() => {
    clock.current = IDLE_CLOCK
    setElapsedMs(0)
    setStatus('idle')
  }, [])

  const next = useCallback(() => {
    if (status === 'idle' || status === 'complete') return
    const target = skipForward(timeline, readElapsed())
    seekTo(target, status !== 'running')
    if (target >= timeline.totalMs) setStatus('complete')
  }, [status, timeline, readElapsed, seekTo])

  const previous = useCallback(() => {
    if (status === 'idle') return
    seekTo(skipBack(timeline, readElapsed()), status !== 'running')
    if (status === 'complete') setStatus('paused')
  }, [status, timeline, readElapsed, seekTo])

  return {
    timeline,
    status,
    at,
    secondsLeft: at.entry ? Math.ceil(at.remainingMs / 1000) : 0,
    start,
    pause,
    resume,
    reset,
    next,
    previous,
  }
}
