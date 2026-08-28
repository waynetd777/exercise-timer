/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect } from 'react'

/**
 * Closes a transient overlay, such as a menu or a popover, on Escape or a press
 * outside
 * it.
 *
 * `pointerdown` rather than `click`, so it closes on the press instead of waiting
 * for the release; a menu that lingers under your finger reads as broken.
 *
 * `inside` is a predicate rather than a ref, because "outside" is not always one
 * element: `Menu` positions its list in viewport coordinates and finds it by id,
 * so both the trigger's wrapper and that list count as inside.
 *
 * Nothing is bound while `open` is false, so a list of sixty rows each holding one
 * of these costs nothing until one of them opens.
 */
export function useDismiss(open: boolean, close: () => void, inside: (target: Node) => boolean) {
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
    // `open` alone. Both callbacks are redefined every render, so depending on
    // them would rebind the listeners on every keystroke elsewhere in the screen;
    // neither closes over anything but a ref and a setter, so a stale one behaves
    // identically to a fresh one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
