import { useEffect, useRef } from 'react'
import type { Position } from '../engine'
import { canSpeak, speak } from './speech'

/** Steps shorter than this never announce — the countdown beeps cover them. */
const MIN_STEP_MS = 20_000

/** Announced when this many seconds remain. */
const ANNOUNCE_AT = 10

/**
 * Says "ten seconds left" once per long step.
 *
 * Keyed on the step's index rather than on time, so a pause, a seek, or a
 * re-render cannot make it repeat within the same step.
 */
export function useSpokenCues(at: Position, running: boolean, muted: boolean): void {
  const announced = useRef<number | null>(null)

  useEffect(() => {
    if (!running || muted || !canSpeak()) return
    const entry = at.entry
    if (!entry || entry.durationMs < MIN_STEP_MS) return

    const secondsLeft = Math.ceil(at.remainingMs / 1000)
    if (secondsLeft !== ANNOUNCE_AT) return
    if (announced.current === entry.index) return

    announced.current = entry.index
    speak('Ten seconds left')
  }, [at, running, muted])
}
