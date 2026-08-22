import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { advance, compile, locate, retreat, START } from '../engine'
import type { Cursor, Routine, RoutinePosition, Run, Workout } from '../engine'
import type { Clock } from './clock'
import { elapsed, IDLE_CLOCK, paused, resumed, seeked, started } from './clock'
import { tick } from './tick'
import { useWakeLock } from './useWakeLock'

export type RunStatus = 'idle' | 'running' | 'paused' | 'complete'

export type Timer = {
  routine: Routine
  /** The run the clock is currently measuring. The cue scheduler arms against it. */
  run: Run
  status: RunStatus
  /** Position at the current moment. Recomputed whenever the display changes. */
  at: RoutinePosition
  /** Whole seconds left on a timed step. 0 on a self-paced one, which has no end. */
  secondsLeft: number
  /** Whole seconds spent on the current step, which is what a self-paced step counts up. */
  secondsSpent: number
  /** 0..1 through the routine. By time when it is fully timed, by step when not. */
  progress: number
  /** Time left in the whole routine, or `null` when gates make that unknowable. */
  totalRemainingMs: number | null
  /**
   * Time on the whole WORKOUT so far: wall-clock since the start, less pauses,
   * stopped at the finish.
   *
   * A different axis from `totalRemainingMs`, which is a position in the routine
   * Skip four steps and the routine is four steps further on while this is
   * unmoved. That is the point: this is how long you have been training, and for
   * a gated routine it is the only time there is.
   */
  sessionMs: number
  /** Reads live elapsed time IN THE CURRENT RUN. The audio scheduler needs this. */
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

/** A routine with no steps still needs something for the runner to hold. */
const EMPTY_RUN: Run = { index: 0, entries: [], totalMs: 0, selfPaced: false }

/**
 * Owns run state as a cursor plus a clock, and DERIVES elapsed from the clock.
 * Nothing accumulates ticks, so a throttled or backgrounded tab cannot drift.
 * coming back after ten minutes simply shows the truth.
 *
 * The clock measures ONE RUN, not the whole routine, and is re-anchored every
 * time the cursor crosses into another. That is what lets a routine wait for a
 * tap without giving up the property that makes the timer trustworthy: inside a
 * run, elapsed is still a subtraction against a monotonic timestamp.
 *
 * Rather than a 60fps animation frame loop, this schedules one timeout for the
 * exact instant the displayed value next changes (the next whole second, or the
 * end of the step, whichever comes first). About one callback per second instead
 * of sixty, with no loss of precision.
 */
export function useTimer(workout: Workout): Timer {
  const routine = useMemo(() => compile(workout), [workout])

  const [status, setStatus] = useState<RunStatus>('idle')
  const [cursor, setCursor] = useState<Cursor>(START)
  const [generation, setGeneration] = useState(0)

  const clock = useRef<Clock>(IDLE_CLOCK)
  const readElapsed = useCallback(() => elapsed(clock.current, now()), [])

  /**
   * The whole workout, on the same data and transitions, minus the seeking.
   *
   * The run clock is re-anchored at every gate and every skip, which is what
   * makes it trustworthy for the step you are on and useless for the session:
   * it cannot say how long you have been training, and in a gated routine
   * nothing else can either. A skip changes where you are, not how long you have
   * been at it, so `moveTo` deliberately does not touch this.
   */
  const session = useRef<Clock>(IDLE_CLOCK)

  /** Stops the session clock. The finish reports a time, not a stopwatch. */
  const stopSession = useCallback(() => {
    session.current = paused(session.current, now())
  }, [])

  /** The tick reads the cursor without re-registering itself every second. */
  const cursorRef = useRef<Cursor>(cursor)
  cursorRef.current = cursor

  const at = useMemo(() => locate(routine, cursor), [routine, cursor])
  const run = routine.runs[cursor.runIndex] ?? EMPTY_RUN

  const bump = useCallback(() => setGeneration((g) => g + 1), [])

  /**
   * Moves to a cursor and re-anchors the clock to it.
   *
   * One path for every jump, whether tick, skip or seek, because the clock and the
   * cursor drifting apart is the bug class this whole module exists to avoid.
   * `freeze` must be true unless the run is actively going, or the clock keeps
   * advancing while the UI says paused and the next resume credits a bogus pause.
   */
  const moveTo = useCallback(
    (to: Cursor, freeze: boolean) => {
      clock.current = seeked(now(), to.elapsedInRunMs, freeze)
      setCursor(to)
      bump()
    },
    [bump],
  )

  // Schedule the next update for the moment the display actually changes.
  useEffect(() => {
    if (status !== 'running') return

    const onTick = () => {
      const next = tick(routine, cursorRef.current.runIndex, readElapsed())

      if (next.kind === 'complete') {
        stopSession()
        setCursor(next.cursor)
        setStatus('complete')
        return
      }
      // A new run needs the clock re-anchored to it; the same run does not.
      if (next.kind === 'move') {
        moveTo(next.cursor, false)
        return
      }

      setCursor(next.cursor)
      timeoutId = window.setTimeout(onTick, next.nextChangeInMs)
    }

    let timeoutId = window.setTimeout(onTick, 0)

    // Returning to a hidden tab: resync immediately rather than waiting for a
    // throttled timeout to fire.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timeoutId)
        onTick()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status, routine, readElapsed, moveTo, stopSession])

  useWakeLock(status === 'running')

  const start = useCallback(() => {
    const stamp = now()
    clock.current = started(stamp)
    session.current = started(stamp)
    setCursor(START)
    setStatus('running')
    bump()
  }, [bump])

  const pause = useCallback(() => {
    if (status !== 'running') return
    const stamp = now()
    clock.current = paused(clock.current, stamp)
    session.current = paused(session.current, stamp)
    setStatus('paused')
    bump()
  }, [status, bump])

  const resume = useCallback(() => {
    if (status !== 'paused') return
    const stamp = now()
    clock.current = resumed(clock.current, stamp)
    session.current = resumed(session.current, stamp)
    setStatus('running')
    bump()
  }, [status, bump])

  const reset = useCallback(() => {
    clock.current = IDLE_CLOCK
    session.current = IDLE_CLOCK
    setCursor(START)
    setStatus('idle')
    bump()
  }, [bump])

  const here = useCallback(
    (): Cursor => ({ runIndex: cursorRef.current.runIndex, elapsedInRunMs: readElapsed() }),
    [readElapsed],
  )

  const next = useCallback(() => {
    if (status === 'idle' || status === 'complete') return
    const target = advance(routine, here())
    moveTo(target, status !== 'running')
    if (locate(routine, target).isComplete) {
      stopSession()
      setStatus('complete')
    }
  }, [status, routine, here, moveTo, stopSession])

  const previous = useCallback(() => {
    if (status === 'idle') return
    moveTo(retreat(routine, here()), status !== 'running')
    if (status === 'complete') setStatus('paused')
  }, [status, routine, here, moveTo])

  /*
   * Progress by TIME while every step is timed. It is smooth, and it is what
   * the bar has always shown. Once a routine can wait for a tap there is no
   * honest time axis, so it counts steps instead.
   */
  const totalSteps = routine.entries.length
  const timedElapsedMs = at.isComplete
    ? routine.totalMs
    : (at.entry?.startMs ?? 0) + at.elapsedInEntryMs
  const progress = routine.hasGates
    ? totalSteps === 0
      ? 0
      : (at.step - 1) / totalSteps
    : routine.totalMs === 0
      ? 0
      : Math.min(1, timedElapsedMs / routine.totalMs)

  return {
    routine,
    run,
    status,
    at,
    secondsLeft: at.remainingMs === null ? 0 : Math.ceil(at.remainingMs / 1000),
    secondsSpent: Math.floor(at.elapsedInEntryMs / 1000),
    progress,
    totalRemainingMs: routine.hasGates ? null : Math.max(0, routine.totalMs - timedElapsedMs),
    /*
     * Read at render rather than held in state. A value derived from a monotonic
     * clock is only true at the moment it is read, the same reason nothing here
     * accumulates ticks, and the display already re-renders every second while
     * the workout runs, on a self-paced step as much as a timed one.
     */
    sessionMs: elapsed(session.current, now()),
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
