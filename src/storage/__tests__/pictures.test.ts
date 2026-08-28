/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  chosenPicture,
  currentPictures,
  loadPictures,
  pictureFor,
  pictureHashes,
  picturesFor,
  savePictures,
  withPicture,
} from '../pictures'

const local = { source: 'local' as const, hash: 'abc', mime: 'image/webp' }
const drawing = { source: 'bundled' as const, path: 'exercises/Deadlift.jpg' }

beforeEach(() => {
  globalThis.localStorage?.clear()
  savePictures({})
})

describe('the pictures kept per exercise', () => {
  it('writes and reads one back, keyed by folded name', () => {
    // The same key the weights use, so "12 × Leg Press" and "Get ready: Leg
    // Press" reach the same entry.
    savePictures(withPicture({}, '12 × Leg Press', local))

    expect(loadPictures()).toEqual({ 'leg press': local })
    expect(chosenPicture(loadPictures(), 'Get ready: Leg Press')).toBeUndefined()
    expect(chosenPicture(loadPictures(), 'Leg Press')).toEqual(local)
  })

  it('removes an entry rather than storing an empty one', () => {
    const set = withPicture({}, 'Squats', drawing)
    expect(withPicture(set, 'Squats', null)).toEqual({})
  })

  it('starts from the guide, and lets the table override it', () => {
    /*
     * The illustrations that ship with the app are the floor under this table,
     * so it only ever has to hold what it ADDS. It also means a routine typed by
     * hand, which has never been near the picker, still shows the machine.
     */
    expect(pictureFor('Leg Press')).toEqual({ source: 'bundled', path: 'exercises/Leg-Press.jpg' })

    savePictures(withPicture({}, 'Leg Press', local))
    expect(pictureFor('Leg Press')).toEqual(local)
  })

  it('answers through the shorthand a routine is written in', () => {
    // `findFor`, the same lookup the weight uses: "Seated Ab Crunch" is what
    // gets typed and "Seated Abdominal Crunch" is what the guide calls it.
    expect(pictureFor('12 × Seated Ab Crunch')).toEqual({
      source: 'bundled',
      path: 'exercises/Seated-Abdominal-Crunch.jpg',
    })
  })

  it('says nothing for an exercise nobody has pictured', () => {
    // A press-up: the guide only draws the machine.
    expect(pictureFor('Squats')).toBeUndefined()
  })

  it('refuses a stored value that is not a media ref', () => {
    /*
     * Checked on the way OUT as well as in. What is here is rendered on every
     * step of every run, and a hand-edited entry would throw in React rather
     * than simply showing no picture.
     */
    globalThis.localStorage?.setItem(
      'davshack-timer-pictures',
      JSON.stringify({ 'leg press': { source: 'local' }, squat: drawing, plank: 'nonsense' }),
    )

    expect(loadPictures()).toEqual({ squat: drawing })
  })

  it('survives a store that is not JSON at all', () => {
    globalThis.localStorage?.setItem('davshack-timer-pictures', '{oh dear')
    expect(loadPictures()).toEqual({})
  })

  it('lists the blobs it holds, for the sweep and for an export', () => {
    /*
     * The sweep must count a pinned copy of a link as live; an export wants only
     * the bytes nothing else has. Same split as `gc.ts`.
     */
    const pictures = {
      a: local,
      b: drawing,
      c: { source: 'remote' as const, url: 'https://x/y.jpg', cachedHash: 'cached' },
    }

    expect(pictureHashes(pictures)).toEqual(['abc', 'cached'])
    expect(pictureHashes(pictures, true)).toEqual(['abc'])
  })

  it('drops its cache when the table is saved', () => {
    // Every step of every routine asks, so the map is cached; a picture chosen
    // must not be answered from the copy taken before it.
    expect(currentPictures().get('squat')).toBeUndefined()
    savePictures(withPicture({}, 'Squats', drawing))
    expect(currentPictures().get('squat')).toEqual(drawing)
  })
})

describe('what a single routine takes with it', () => {
  const photo = { source: 'local' as const, hash: 'abc', mime: 'image/webp' }
  const other = { source: 'local' as const, hash: 'def', mime: 'image/webp' }
  const table = { 'leg press': photo, squat: other }

  it('carries only what the routine can use', () => {
    /*
     * A whole-library backup is a restore and carries everything. One routine is
     * a thing you SEND, and sending it should not post every photo you own.
     */
    expect(picturesFor(['12 × Leg Press', 'Rest'], table)).toEqual({ 'leg press': photo })
  })

  it('finds the entry through the shorthand the routine is written in', () => {
    expect(picturesFor(['Get ready: Leg Pres'], table)).toEqual({ 'leg press': photo })
  })

  it('carries nothing where the routine names nothing the table holds', () => {
    expect(picturesFor(['Warm Up', 'Cycling'], table)).toEqual({})
  })
})
