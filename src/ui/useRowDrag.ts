/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Reordering editor rows by dragging a grip.
 *
 * POINTER EVENTS, not HTML5 drag-and-drop, which does not fire at all in Safari
 * on iOS. A phone is where this routine gets edited between sets, so a feature
 * that only worked on the laptop would be the wrong half.
 *
 * IT MOVES ONE ROW AT A TIME, through `onStep`. The tree work is already written
 * and tested: `moveStep` walks a step into and out of rounds, ladders and
 * sections exactly as the Move up and Move down buttons do. So a drag is not a
 * second implementation of reordering, it is the same one called repeatedly, and
 * a drag can never put a step somewhere the buttons could not.
 *
 * The loop runs on `requestAnimationFrame` rather than on `pointermove`. Two
 * reasons, both load-bearing. A move applies through React, so the DOM is a
 * render behind, and a burst of pointer events would apply the same step several
 * times before any of it landed. And auto-scroll has to keep going while a
 * finger is held still at the edge of the list, when no pointer events arrive at
 * all.
 */

/** How close to the edge of the list a drag starts scrolling it. */
const EDGE = 64
/** Pixels per frame at the very edge, tapering to nothing at `EDGE` away. */
const SCROLL_RATE = 12

/** Rows carry this so the hook can find them without a ref through three components. */
export const ROW_ID = 'data-row-id'

type Options = {
  /** The scrolling list the rows live in. */
  list: { current: HTMLElement | null }
  /** Move the row one place. Called at most once a frame. */
  onStep: (id: string, delta: 1 | -1) => void
  /** The drag finished, whether it moved anything or not. */
  onEnd?: (id: string) => void
  /** Escape was pressed: put it back. */
  onCancel?: (id: string) => void
}

type RowDrag = {
  /** The row being dragged, for the styling that lifts it. */
  draggingId: string | null
  /** Spread onto a row's grip. */
  gripProps: (id: string) => {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  }
}

/** A row and, when it is a group, the rows nested under it that travel with it. */
function blockOf(list: HTMLElement, id: string): HTMLElement[] {
  const rows = [...list.querySelectorAll<HTMLElement>(`[${ROW_ID}]`)]
  const index = rows.findIndex((row) => row.getAttribute(ROW_ID) === id)
  if (index === -1) return []

  const head = rows[index]!
  const depth = Number(head.dataset['depth'] ?? 0)
  const held = [head]
  /*
   * A section dragged on its own would leave its children behind, since every
   * row is a sibling in the DOM and only the nesting is drawn. Everything deeper
   * that follows belongs to it and moves with it.
   */
  for (let i = index + 1; i < rows.length; i += 1) {
    if (Number(rows[i]!.dataset['depth'] ?? 0) <= depth) break
    held.push(rows[i]!)
  }
  return held
}

const centre = (element: HTMLElement): number => {
  const rect = element.getBoundingClientRect()
  return rect.top + rect.height / 2
}

export function useRowDrag({ list, onStep, onEnd, onCancel }: Options): RowDrag {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  /** Everything the loop reads, in refs: it must not restart on every frame. */
  const id = useRef<string | null>(null)
  const pointerY = useRef(0)
  /** The pointer position the current transform is measured from. */
  const baseY = useRef(0)
  const frame = useRef(0)
  /** Set for one tick after a move, while the DOM catches up with React. */
  const settling = useRef(false)
  const latest = useRef({ onStep, onEnd, onCancel })
  latest.current = { onStep, onEnd, onCancel }

  const shift = useCallback(
    (rows: HTMLElement[], by: number) => {
      for (const row of rows) row.style.transform = by === 0 ? '' : `translateY(${by}px)`
    },
    [],
  )

  const stop = useCallback(
    (cancelled: boolean) => {
      const held = id.current
      if (held === null) return
      cancelAnimationFrame(frame.current)
      if (list.current) shift(blockOf(list.current, held), 0)
      id.current = null
      setDraggingId(null)
      if (cancelled) latest.current.onCancel?.(held)
      else latest.current.onEnd?.(held)
    },
    [list, shift],
  )

  const tick = useCallback(() => {
    frame.current = requestAnimationFrame(tick)
    const held = id.current
    const container = list.current
    if (held === null || !container) return

    const rows = blockOf(container, held)
    if (rows.length === 0) return

    /*
     * One frame off after a move: React has re-rendered but the rows below have
     * only just been laid out, and measuring here would compare the new position
     * against a stale neighbour and move again immediately.
     */
    if (settling.current) {
      settling.current = false
      return
    }

    const y = pointerY.current

    // Auto-scroll, so a step can be dragged past the fold of an 81-step routine.
    const bounds = container.getBoundingClientRect()
    const above = y - bounds.top
    const below = bounds.bottom - y
    if (above < EDGE) container.scrollTop -= (SCROLL_RATE * (EDGE - above)) / EDGE
    else if (below < EDGE) container.scrollTop += (SCROLL_RATE * (EDGE - below)) / EDGE

    shift(rows, y - baseY.current)

    const all = [...container.querySelectorAll<HTMLElement>(`[${ROW_ID}]`)]
    const first = all.indexOf(rows[0]!)
    const last = all.indexOf(rows[rows.length - 1]!)
    const previous = all[first - 1]
    const next = all[last + 1]

    /*
     * The held block's own middle against its neighbours', so a tall group and a
     * single step are judged the same way: it has arrived when its middle passes
     * the middle of what it is passing.
     */
    const top = rows[0]!.getBoundingClientRect().top
    const bottom = rows[rows.length - 1]!.getBoundingClientRect().bottom
    const middle = (top + bottom) / 2

    const move = (delta: 1 | -1, over: HTMLElement) => {
      /*
       * Rebased by what it is stepping over rather than reset to zero. The layout
       * is about to move the row by that much, so cancelling the two keeps the
       * grip under the finger instead of snapping back for a frame.
       */
      baseY.current += delta * over.getBoundingClientRect().height
      settling.current = true
      latest.current.onStep(held, delta)
    }

    if (previous && middle < centre(previous)) return move(-1, previous)
    if (next && middle > centre(next)) return move(1, next)
  }, [list, shift])

  const gripProps = useCallback(
    (rowId: string) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        // Left button or touch only, and never while another drag is live.
        if (event.button !== 0 || id.current !== null) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)

        id.current = rowId
        pointerY.current = event.clientY
        baseY.current = event.clientY
        settling.current = false
        setDraggingId(rowId)
        cancelAnimationFrame(frame.current)
        frame.current = requestAnimationFrame(tick)
      },
    }),
    [tick],
  )

  useEffect(() => {
    if (draggingId === null) return

    const move = (event: PointerEvent) => {
      pointerY.current = event.clientY
      // The list scrolls itself while a drag is at its edge; the browser must not.
      event.preventDefault()
    }
    const up = () => stop(false)
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop(true)
    }

    // `passive: false`, or preventDefault is ignored and the page scrolls under
    // the drag on a phone.
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
    }
  }, [draggingId, stop])

  // A drag left running when the screen closes would hold a frame forever.
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return { draggingId, gripProps }
}
