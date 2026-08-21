import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  HISTORY_LIMIT,
  initHistory,
  push,
  redo,
  undo,
} from '../history'

const chain = (...values: string[]) => values.reduce((h, v) => push(h, v), initHistory('a'))

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const h = initHistory('a')
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
    expect(h.present).toBe('a')
  })

  it('walks back and forward through pushed states', () => {
    let h = chain('b', 'c')
    expect(h.present).toBe('c')

    h = undo(h)
    expect(h.present).toBe('b')
    h = undo(h)
    expect(h.present).toBe('a')
    expect(canUndo(h)).toBe(false)

    h = redo(h)
    expect(h.present).toBe('b')
    h = redo(h)
    expect(h.present).toBe('c')
    expect(canRedo(h)).toBe(false)
  })

  it('is a no-op at either end rather than throwing', () => {
    const start = initHistory('a')
    expect(undo(start)).toBe(start)
    expect(redo(start)).toBe(start)
  })

  it('drops the redo stack once a new edit is made', () => {
    // Standard behaviour: branching away from an undone future discards it.
    let h = undo(chain('b', 'c'))
    expect(canRedo(h)).toBe(true)
    h = push(h, 'd')
    expect(canRedo(h)).toBe(false)
    expect(h.present).toBe('d')
    expect(undo(h).present).toBe('b')
  })

  it('collapses a run of keystrokes in ONE field into one undo step', () => {
    // Typing "Leg day" must not cost seven undos.
    let h = initHistory('')
    for (const value of ['L', 'Le', 'Leg']) h = push(h, value, 'name')
    expect(h.present).toBe('Leg')
    expect(h.past).toHaveLength(1)
    expect(undo(h).present).toBe('')
  })

  it('does NOT collapse typing in two different fields', () => {
    /*
     * The reason this takes a field rather than a flag. Renaming a step and then
     * renaming the next one are two edits, and one undo must not take both back
     * just because they were both typed.
     */
    let h = push(initHistory('a'), 'ab', 'step-1:name')
    h = push(h, 'abc', 'step-2:name')
    expect(h.past).toHaveLength(2)
    expect(undo(h).present).toBe('ab')
  })

  it('ends the run at a structural change, so each is its own step', () => {
    let h = push(push(initHistory('a'), 'ab', 'name'), 'abc', 'name')
    h = push(h, 'structural')
    h = push(h, 'x', 'name')
    expect(undo(h).present).toBe('structural')
    expect(undo(undo(h)).present).toBe('abc')
    expect(undo(undo(undo(h))).present).toBe('a')
  })

  it('starts a fresh step after an undo, rather than rewriting the restored state', () => {
    let h = push(push(initHistory('a'), 'ab', 'name'), 'abc', 'name')
    h = undo(h)
    expect(h.present).toBe('a')
    h = push(h, 'ax', 'name')
    // The undone state is still reachable, not overwritten by the new typing.
    expect(undo(h).present).toBe('a')
  })

  it('gives a discrete edit its own step even twice over', () => {
    // Choosing an image for two steps in a row: two edits, two undos. With a
    // shared flag these collapsed, and one press took both pictures back.
    let h = push(initHistory('a'), 'image-1')
    h = push(h, 'image-2')
    expect(h.past).toHaveLength(2)
    expect(undo(h).present).toBe('image-1')
  })

  it('caps the past so a long session cannot grow without bound', () => {
    let h = initHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 25; i++) h = push(h, i)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    // The oldest states fell off the back; the most recent are intact.
    expect(h.present).toBe(HISTORY_LIMIT + 25)
    expect(undo(h).present).toBe(HISTORY_LIMIT + 24)
  })

  it('never mutates the history it is given', () => {
    const h = chain('b')
    const before = { past: [...h.past], present: h.present, future: [...h.future] }
    undo(h)
    push(h, 'z')
    expect(h.past).toEqual(before.past)
    expect(h.present).toBe(before.present)
    expect(h.future).toEqual(before.future)
  })
})
