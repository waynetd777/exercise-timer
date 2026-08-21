import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compile, position, skipBack, skipForward } from '../engine'
import type { Position, Run, Timeline, Workout } from '../engine'
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
  /** Reads live elapsed run time. The audio scheduler needs this, not a snapshot. */
  readElapsed: () => number
  /** Increments on every clock mutation, so the audio scheduler can re-arm. */
  generation: number
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
/** A routine with no steps at all still needs something for the runner to hold. */
const EMPTY_RUN: Run = { index: 0, entries: [], totalMs: 0, selfPaced: false }

export function useTimer(workout: Workout): Timer {
  /*
   * The FIRST run, not the whole routine.
   *
   * Everything the editor can currently author is fully timed, and a fully timed
   * routine compiles to exactly one run — so this is the whole thing, and the
   * runner behaves as it always has. Gated routines need a cursor that can cross
   * runs; `engine/navigate.ts` already has the pure moves for it, and wiring them
   * in here is the next piece of the strength-routine work.
   */
  const timeline = useMemo(() => compile(workout).runs[0] ?? EMPTY_RUN, [workout])

  const [status, setStatus] = useState<RunStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [generation, setGeneration] = useState(0)

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

  const bump = useCallback(() => setGeneration((g) => g + 1), [])

  const seekTo = useCallback(
    (to: number, freeze: boolean) => {
      clock.current = seeked(now(), to, freeze)
      setElapsedMs(to)
      bump()
    },
    [bump],
  )

  const start = useCallback(() => {
    clock.current = started(now())
    setElapsedMs(0)
    setStatus('running')
    bump()
  }, [bump])

  const pause = useCallback(() => {
    if (status !== 'running') return
    clock.current = paused(clock.current, now())
    setStatus('paused')
    bump()
  }, [status, bump])

  const resume = useCallback(() => {
    if (status !== 'paused') return
    clock.current = resumed(clock.current, now())
    setStatus('running')
    bump()
  }, [status, bump])

  const reset = useCallback(() => {
    clock.current = IDLE_CLOCK
    setElapsedMs(0)
    setStatus('idle')
    bump()
  }, [bump])

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
    readElapsed,
    generation,
    start,
    pause,
    resume,
    reset,
    next,
    previous,
  }
}
