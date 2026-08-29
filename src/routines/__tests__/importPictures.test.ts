/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it, vi } from 'vitest'
import type { MediaRef } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { toBundle } from '../../storage/bundle'
import { savePictures } from '../../storage/pictures'
import { importRoutineFiles } from '../importFiles'

// No blob store here: every photo the file names is one that did not arrive.
vi.mock('../../media/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../media/store')>()),
  hasBlob: vi.fn(async () => false),
  putBlob: vi.fn(async () => {}),
}))

// The table is localStorage, which this environment does not have; what the
// import chose to write is the assertion.
vi.mock('../../storage/pictures', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../storage/pictures')>()),
  loadPictures: () => ({}),
  savePictures: vi.fn(),
}))

const routine = () => ({
  id: 'p1',
  name: 'Legs',
  blocks: [{ kind: 'segment' as const, id: 's1', name: 'Leg Press', role: 'work' as const, durationMs: 20_000 }],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

describe('importing the exercise pictures', () => {
  it('drops a ref whose photo did not arrive, rather than laying it over the guide', async () => {
    /*
     * The export writes the table as it stands while `collectMedia` skips a
     * blob that is missing or too large. A dangling ref in a step shows nothing;
     * one in the table sits OVER the guide's illustration, so the import used to
     * turn a picture that worked into no picture at all.
     */
    const pictures: Record<string, MediaRef> = {
      'leg press': { source: 'local', hash: 'missing', mime: 'image/jpeg' },
      'seated row': { source: 'remote', url: 'https://x/y.jpg' },
    }
    const bundle = toBundle([routine()], 1, {}, {}, pictures)

    const { imported, droppedImages } = await importRoutineFiles(
      [new File([JSON.stringify(bundle)], 'library.json', { type: 'application/json' })],
      1,
    )

    expect(imported).toHaveLength(1)
    expect(droppedImages).toBe(1)
    expect(savePictures).toHaveBeenCalledWith({ 'seated row': { source: 'remote', url: 'https://x/y.jpg' } })
  })
})
