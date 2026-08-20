import { describe, expect, it } from 'vitest'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import {
  clearMedia,
  moveBy,
  newRoutineBlocks,
  newSegment,
  removeAt,
  updateRepeat,
  updateSegment,
} from '../blocks'
import { isDirty } from '../dirty'

const workout = (): Workout => ({
  id: 'w1',
  name: 'Leg day',
  blocks: newRoutineBlocks(),
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

describe('isDirty', () => {
  it('is clean when nothing has been touched', () => {
    const w = workout()
    expect(isDirty(w, w.name, w.blocks)).toBe(false)
  })

  it('ignores whitespace around the name, since saving trims it', () => {
    const w = workout()
    expect(isDirty(w, '  Leg day  ', w.blocks)).toBe(false)
  })

  it('notices a renamed routine', () => {
    const w = workout()
    expect(isDirty(w, 'Leg day 2', w.blocks)).toBe(true)
  })

  it('notices every kind of block edit', () => {
    const w = workout()
    const cases: Record<string, ReturnType<typeof updateSegment>> = {
      'changed duration': updateSegment(w.blocks, [0], { durationMs: 45_000 }),
      'changed name': updateSegment(w.blocks, [0], { name: 'Set up' }),
      'changed role': updateSegment(w.blocks, [0], { role: 'rest' }),
      'changed round count': updateRepeat(w.blocks, [1], { times: 8 }),
      'changed round label': updateRepeat(w.blocks, [1], { label: 'Set' }),
      'removed a step': removeAt(w.blocks, [0]),
      'reordered steps': moveBy(w.blocks, [0], 1),
      'added an image': updateSegment(w.blocks, [1, 0], {
        media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
      }),
    }
    for (const [what, blocks] of Object.entries(cases)) {
      expect(isDirty(w, w.name, blocks), what).toBe(true)
    }
  })

  it('notices an image being cleared', () => {
    const withImage = updateSegment(newRoutineBlocks(), [0], {
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    })
    const w = { ...workout(), blocks: withImage }
    expect(isDirty(w, w.name, clearMedia(withImage, [0]))).toBe(true)
  })

  it('is clean again if an edit is reverted to the same values', () => {
    const w = workout()
    const there = updateSegment(w.blocks, [0], { durationMs: 45_000 })
    const back = updateSegment(there, [0], { durationMs: 30_000 })
    expect(isDirty(w, w.name, back)).toBe(false)
  })

  it('is not fooled by key order — a patched object is compared by field', () => {
    const w = workout()
    // Patching to the SAME value rewrites the object without changing content.
    const repatched = updateSegment(w.blocks, [0], { name: 'Get ready' })
    expect(isDirty(w, w.name, repatched)).toBe(false)
  })

  it('notices a step added or removed inside a round', () => {
    const w = workout()
    expect(isDirty(w, w.name, removeAt(w.blocks, [1, 1]))).toBe(true)
  })

  it('treats a different step id as a change, even with the same values', () => {
    // Replacing a step is a change even if it looks identical.
    const w = workout()
    const replaced = [...w.blocks]
    replaced[0] = newSegment('prepare')
    expect(isDirty(w, w.name, replaced)).toBe(true)
  })
})
