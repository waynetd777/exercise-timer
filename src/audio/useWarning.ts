// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

import { useEffect, useState } from 'react'

/** How a long step says it has ten seconds left. */
export type Warning = 'none' | 'voice' | 'beeps'

export const WARNINGS: readonly { value: Warning; label: string }[] = [
  { value: 'voice', label: 'Say “ten seconds left”' },
  { value: 'beeps', label: 'Double beep' },
  { value: 'none', label: 'Nothing' },
]

const KEY = 'exercise-timer:warning'

function isWarning(value: string | null): value is Warning {
  return WARNINGS.some((warning) => warning.value === value)
}

/**
 * The ten-second warning, persisted the same way as mute.
 *
 * Its own setting rather than folded into mute: the voice carries across a gym
 * floor and bothers whoever is training beside you, while the countdown beeps
 * and the whistle are still wanted. Defaults to the voice, which is what the
 * app always did.
 */
export function useWarning(): [Warning, (warning: Warning) => void] {
  const [warning, setWarning] = useState<Warning>(() => {
    try {
      const stored = localStorage.getItem(KEY)
      return isWarning(stored) ? stored : 'voice'
    } catch {
      return 'voice'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, warning)
    } catch {
      // Private mode or blocked storage: the preference just will not persist.
    }
  }, [warning])

  return [warning, setWarning]
}
