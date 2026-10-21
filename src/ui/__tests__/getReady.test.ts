// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

import { describe, expect, it } from 'vitest'
import { compile } from '../../engine'
import { seg, workout } from '../../engine/__tests__/fixtures'
import { SPOKEN } from '../../audio/speech'
import { spokenGetReady } from '../getReady'

/** The 1-based step of the nth step with this name. */
function stepOf(entries: readonly { name: string; step: number }[], name: string, nth = 1): number {
  return entries.filter((entry) => entry.name === name)[nth - 1]!.step
}

describe('spokenGetReady', () => {
  it('does not name the exercise again after the cardio it was announced over', () => {
    const { entries } = compile(
      workout('active', [
        seg('Get ready: Leg Press', 30, 'prepare'),
        seg('Cycling', 60, 'work'),
        seg('Get ready', 15, 'prepare'),
        seg('Leg Press', 40, 'work'),
      ]),
    )
    expect(spokenGetReady(entries, stepOf(entries, 'Get ready: Leg Press'))).toBe(
      SPOKEN.getReadyFor('Leg Press'),
    )
    expect(spokenGetReady(entries, stepOf(entries, 'Get ready'))).toBeNull()
  })

  it('names it again before a second round of the same exercise', () => {
    const { entries } = compile(
      workout('rounds', [
        seg('Get ready', 15, 'prepare'),
        seg('Squats', 40, 'work'),
        seg('Get ready', 15, 'prepare'),
        seg('Squats', 40, 'work'),
      ]),
    )
    expect(spokenGetReady(entries, stepOf(entries, 'Get ready', 2))).toBe(
      SPOKEN.getReadyFor('Squats'),
    )
  })

  it('names a different exercise after the cardio', () => {
    const { entries } = compile(
      workout('switch', [
        seg('Get ready: Leg Press', 30, 'prepare'),
        seg('Cycling', 60, 'work'),
        seg('Get ready', 15, 'prepare'),
        seg('Seated Row', 40, 'work'),
      ]),
    )
    expect(spokenGetReady(entries, stepOf(entries, 'Get ready'))).toBe(
      SPOKEN.getReadyFor('Seated Row'),
    )
  })
})
