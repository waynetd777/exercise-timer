/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useRef, type RefObject } from 'react'
import type { Block } from '../../engine'
import type { FlatBlock, Path } from '../../editor/blocks'
import { flatten, moveStep } from '../../editor/blocks'
import { discardRun, endRun, type History } from '../../editor/history'
import { useRowDrag } from '../useRowDrag'
import type { Draft } from './useDraftHistory'

/**
 * Dragging a row, which is `moveStep` called once per row crossed.
 *
 * `'drag'` is the coalescing key, the same mechanism a run of keystrokes uses:
 * every step of one drag replaces the last rather than stacking, so undo takes
 * the whole drag back in one press instead of one press per row passed. The
 * run ends with the finger, and Escape drops it, so two drags are two steps and
 * a cancelled one leaves nothing behind.
 */
export function useDraftDrag({
  history,
  rows,
  editBlocks,
  setHistory,
}: {
  history: History<Draft>
  rows: readonly FlatBlock[]
  editBlocks: (op: (blocks: Block[]) => Block[], typing?: string | null) => void
  setHistory: (next: (current: History<Draft>) => History<Draft>) => void
}): {
  list: RefObject<HTMLUListElement | null>
  drag: ReturnType<typeof useRowDrag>
  /** Whether a row travels with the one being dragged: a group takes its children. */
  held: (path: Path) => boolean
} {
  /*
   * The live draft, for the drag loop. The loop runs on animation frames and can
   * apply several moves before React re-renders, so a `blocks` captured in the
   * callback's closure would be stale by the second one and every step after the
   * first would be computed from the position the row started in.
   */
  const historyRef = useRef(history)
  historyRef.current = history

  const list = useRef<HTMLUListElement>(null)
  /** The tree as it was before the drag, for Escape to put back. */
  const beforeDrag = useRef<Block[] | null>(null)
  const drag = useRowDrag({
    list,
    onStep: (id, delta) => {
      const row = flatten(historyRef.current.present.blocks).find(
        ({ block }) => block.id === id,
      )
      if (!row) return
      if (beforeDrag.current === null) beforeDrag.current = historyRef.current.present.blocks
      editBlocks((current) => moveStep(current, row.path, delta), 'drag')
    },
    onEnd: () => {
      beforeDrag.current = null
      // The drag's run ends with the finger. Left open, the next drag's first
      // move coalesced into this one and a single Undo took both back.
      setHistory(endRun)
    },
    onCancel: () => {
      const original = beforeDrag.current
      beforeDrag.current = null
      // Drop the drag's step rather than pushing the original back under the
      // same key: that coalesced, and left an undo step that did nothing.
      if (original) setHistory(discardRun)
    },
  })

  const heldPath = drag.draggingId
    ? (rows.find(({ block }) => block.id === drag.draggingId)?.path ?? null)
    : null
  const held = (path: Path): boolean =>
    heldPath !== null && path.length >= heldPath.length && heldPath.every((at, i) => path[i] === at)

  return { list, drag, held }
}
