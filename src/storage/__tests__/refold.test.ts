/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
// The tables are localStorage, so the tests need a browser's one.

import { beforeEach, describe, expect, it } from 'vitest'
import type { MediaRef } from '../../engine'
import { loadPaces, savePaces } from '../paces'
import { loadPictures, savePictures } from '../pictures'
import { refoldKey, refoldKeys } from '../refold'
import { loadWeights, saveWeights, weightFor, withWeight } from '../weights'

beforeEach(() => {
  globalThis.localStorage?.clear()
  // Each save also drops the module's cache, so a stale table written raw
  // below is what the next read sees.
  saveWeights({})
  savePaces({})
  savePictures({})
})

describe('refoldKey', () => {
  it('puts back the double s the old fold took off', () => {
    // "Leg Press" folded to `leg pres` before the fold learned that "press" is
    // not a plural.
    expect(refoldKey('leg pres')).toBe('leg press')
    expect(refoldKey('alternating cros punch')).toBe('alternating cross punch')
  })

  it('leaves every other key alone', () => {
    expect(refoldKey('leg press')).toBe('leg press')
    expect(refoldKey('seated row')).toBe('seated row')
    expect(refoldKey('abs')).toBe('abs')
  })
})

describe('refoldKeys', () => {
  it('moves a stale key, says so, and lets an entry the new build wrote win', () => {
    expect(refoldKeys({ 'leg pres': '60kg', 'seated row': '40kg' })).toEqual({
      table: { 'leg press': '60kg', 'seated row': '40kg' },
      changed: true,
    })
    expect(refoldKeys({ 'leg pres': '60kg', 'leg press': '65kg' }).table).toEqual({ 'leg press': '65kg' })
    expect(refoldKeys({ 'seated row': '40kg' }).changed).toBe(false)
  })
})

describe('the tables', () => {
  it('re-key a weight written under the old fold, so it answers and can be cleared', () => {
    /*
     * The bug this pins: the weight showed only through the fuzzy match, and
     * clearing it deleted a key that did not exist, so the old number snapped
     * back and could not be removed.
     */
    localStorage.setItem('davshack-timer-weights', JSON.stringify({ 'leg pres': '60kg' }))

    expect(weightFor('Leg Press')).toBe('60kg')
    expect(loadWeights()).toEqual({ 'leg press': '60kg' })
    // Written back once, so the next read has nothing to move.
    expect(JSON.parse(localStorage.getItem('davshack-timer-weights')!)).toEqual({ 'leg press': '60kg' })

    saveWeights(withWeight(loadWeights(), 'Leg Press', ''))
    expect(weightFor('Leg Press')).toBe('')
  })

  it('re-key the paces and the pictures the same way', () => {
    localStorage.setItem('davshack-timer-paces', JSON.stringify({ 'chest pres': [2, 2.5] }))
    expect(loadPaces()).toEqual({ 'chest press': [2, 2.5] })

    const ref: MediaRef = { source: 'local', hash: 'abc', mime: 'image/jpeg' }
    localStorage.setItem('davshack-timer-pictures', JSON.stringify({ 'leg pres': ref }))
    expect(loadPictures()).toEqual({ 'leg press': ref })
  })
})
