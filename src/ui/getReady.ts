// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

import type { TimelineEntry } from '../engine'
import { getReadyLine } from '../audio/speech'
import { nameWithLoad } from './format'

/** The exercise after a step, past any get-readys in between. */
function exerciseAfter(entries: readonly TimelineEntry[], step: number): TimelineEntry | null {
  let next = entries[step] ?? null
  while (next?.role === 'prepare') next = entries[next.step] ?? null
  return next
}

/** What the get-ready at this 1-based step would say, taken on its own. */
function lineAt(entries: readonly TimelineEntry[], step: number): string | null {
  const entry = entries[step - 1]
  if (!entry) return null
  const next = exerciseAfter(entries, step)
  return getReadyLine(nameWithLoad(entry), next ? nameWithLoad(next) : null)
}

/**
 * What the get-ready at this 1-based step says out loud, or null for nothing.
 *
 * Nothing when the get-ready before it has just said the same. Active recovery
 * runs "Get ready: Leg Press 65kg", a minute of cycling, then a bare "Get
 * ready" into the press, and the second one naming the press again told you
 * what you had heard a minute ago. The look back stops at the exercise itself,
 * so the get-ready before a second round of it still says it.
 */
export function spokenGetReady(entries: readonly TimelineEntry[], step: number): string | null {
  const line = lineAt(entries, step)
  if (!line) return null
  const exercise = exerciseAfter(entries, step)
  for (let back = step - 1; back >= 1; back--) {
    const earlier = entries[back - 1]!
    if (earlier.role === 'prepare') return lineAt(entries, back) === line ? null : line
    if (exercise && nameWithLoad(earlier) === nameWithLoad(exercise)) return line
  }
  return line
}
