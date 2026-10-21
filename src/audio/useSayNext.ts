// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'exercise-timer:say-next'

/**
 * Whether a get-ready says the exercise it leads into, persisted the same way
 * as mute.
 *
 * Its own switch for the same reason the ten-second warning has one: the voice
 * carries across a gym floor, and someone who wants the beeps may not want a
 * name read out every minute. Defaults to on.
 */
export function useSayNext(): [boolean, () => void] {
  const [sayNext, setSayNext] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== '0'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, sayNext ? '1' : '0')
    } catch {
      // Private mode or blocked storage: the preference just will not persist.
    }
  }, [sayNext])

  return [sayNext, useCallback(() => setSayNext((on) => !on), [])]
}
