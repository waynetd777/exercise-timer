// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

import { useCallback, useEffect, useState } from 'react'

/** Whether this browser lets a page go full screen at all. iPhone Safari does not. */
export function canFullscreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true
}

/**
 * Goes full screen, if it can and is not already.
 *
 * Has to be called INSIDE the tap that asks for it: a browser only grants full
 * screen to a user gesture, so an effect after the screen has mounted is
 * refused. Which is why opening a routine calls this from the library's own
 * click, not from the run screen.
 */
export function enterFullscreen(): void {
  if (!canFullscreen() || document.fullscreenElement) return
  document.documentElement.requestFullscreen().catch(() => {})
}

/** Leaves full screen, if it is on. Needs no gesture. */
export function exitFullscreen(): void {
  if (typeof document === 'undefined' || !document.fullscreenElement) return
  document.exitFullscreen().catch(() => {})
}

/**
 * Full screen for the whole page, and whether it is on.
 *
 * Read back from `fullscreenchange` rather than tracked locally, because Escape
 * and the browser's own controls leave full screen without asking us.
 */
export function useFullscreen(): [boolean, () => void] {
  const [on, setOn] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement,
  )

  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggle = useCallback(() => {
    if (!canFullscreen()) return
    // Rejected when not inside a user gesture, or refused by the browser.
    // Nothing to do either way: the state comes back through the event.
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen()
    request.catch(() => {})
  }, [])

  return [on, toggle]
}
