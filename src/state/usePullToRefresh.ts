import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** How far the finger must travel before a release triggers a refresh. */
const THRESHOLD = 78

/** Cap, so the indicator cannot be dragged down the whole screen. */
const MAX = 120

/** Movement is damped, or the indicator outruns the finger and feels loose. */
const DAMPING = 0.55

export type PullState = {
  /** Current pull distance in px, 0 when idle. */
  distance: number
  /** True once far enough that releasing will refresh. */
  armed: boolean
  busy: boolean
}

/**
 * Pull down from the top of a scroller to reload the app.
 *
 * Listeners are attached natively with `{ passive: false }`: React registers
 * touchmove as passive, so `preventDefault` there would be ignored and the
 * browser would scroll underneath the gesture.
 *
 * Only starts when the scroller is already at the top, so it cannot hijack an
 * ordinary scroll back up through a long list.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: () => void | Promise<void>,
): PullState {
  const [distance, setDistance] = useState(0)
  const [busy, setBusy] = useState(false)
  const start = useRef<number | null>(null)
  const refresh = useRef(onRefresh)
  refresh.current = onRefresh

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const onStart = (event: TouchEvent) => {
      if (busy || element.scrollTop > 0 || event.touches.length !== 1) return
      start.current = event.touches[0]!.clientY
    }

    const onMove = (event: TouchEvent) => {
      if (start.current === null) return
      const delta = event.touches[0]!.clientY - start.current

      if (delta <= 0) {
        // Reversed into an upward scroll: hand the gesture back.
        start.current = null
        setDistance(0)
        return
      }

      event.preventDefault()
      setDistance(Math.min(delta * DAMPING, MAX))
    }

    const onEnd = () => {
      if (start.current === null) return
      const pulled = distance
      start.current = null
      setDistance(0)

      if (pulled >= THRESHOLD) {
        setBusy(true)
        void refresh.current()
      }
    }

    element.addEventListener('touchstart', onStart, { passive: true })
    element.addEventListener('touchmove', onMove, { passive: false })
    element.addEventListener('touchend', onEnd, { passive: true })
    element.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', onStart)
      element.removeEventListener('touchmove', onMove)
      element.removeEventListener('touchend', onEnd)
      element.removeEventListener('touchcancel', onEnd)
    }
  }, [ref, distance, busy])

  return { distance, armed: distance >= THRESHOLD, busy }
}
