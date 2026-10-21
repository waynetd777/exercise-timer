// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION } from '../../engine'
import { seg } from '../../engine/__tests__/fixtures'
import { toBundle } from '../../storage/bundle'
import { loadWeights } from '../../storage/weights'
import { importRoutineFiles } from '../importFiles'

const NOW = 1_700_000_000_000

const routine = {
  id: 'r1',
  name: 'Machines',
  blocks: [seg('Leg Press', 30)],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('importing a backup whose photos cannot be restored', () => {
  it('still restores its weights', async () => {
    // What a phone on a dev server's network address has: no `crypto.subtle`.
    vi.stubGlobal('crypto', {})
    const bundle = toBundle(
      [routine],
      NOW,
      { abc: 'data:image/png;base64,AAAA' },
      { 'leg press': '65kg' },
    )
    const file = new File([JSON.stringify(bundle)], 'library.timer.json', {
      type: 'application/json',
    })

    const { imported, failed } = await importRoutineFiles([file], NOW)

    // The file still reports its failure; the weights no longer go down with it.
    expect(failed).toHaveLength(1)
    expect(imported).toHaveLength(1)
    expect(loadWeights()).toEqual({ 'leg press': '65kg' })
  })
})
