/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
// The store is localStorage, so the tests need a browser's one.

import { beforeEach, describe, expect, it } from 'vitest'
import type { CustomExercise } from '../customExercises'
import {
  addCustom,
  currentCustomExercises,
  customList,
  isCustom,
  loadCustomExercises,
  readCustomExercises,
  removeCustom,
  saveCustomExercises,
  withCustom,
} from '../customExercises'
import { EXERCISES } from '../../routines/exercises'

const KEY = 'davshack-timer-exercises'

/*
 * A name the app really does not have. "Bulgarian Split Squat" was the obvious
 * fixture and is the wrong one: `exercises.other.ts` ships "Bulgarian Split
 * Squats", which folds to the same key, so the store drops it. That is correct,
 * and it has a test of its own below.
 */
const mine: CustomExercise = {
  name: 'Sandbag Lunge',
  area: 'lower',
  equipment: 'kettlebell',
  perSide: true,
}

beforeEach(() => {
  globalThis.localStorage?.clear()
  saveCustomExercises({})
})

describe('the store', () => {
  it('starts empty: the app ships a table and this device adds to it', () => {
    expect(loadCustomExercises()).toEqual({})
    expect(currentCustomExercises()).toEqual([])
    // Nothing added means the shipped table itself, not a copy of it.
    expect(withCustom([])).toBe(EXERCISES)
  })

  it('keeps one exercise, keyed by folded name, and finds it by any spelling', () => {
    saveCustomExercises(addCustom({}, mine))
    expect(isCustom(loadCustomExercises(), 'sandbag lunges')).toBe(true)
    expect(currentCustomExercises()).toEqual([mine])
  })

  it('adding the same exercise twice replaces it rather than listing it twice', () => {
    // The name field and the page both write through this, and a second add is
    // how an edit arrives.
    const once = addCustom({}, mine)
    const twice = addCustom(once, { ...mine, equipment: 'kettlebell' })
    expect(Object.keys(twice)).toHaveLength(1)
    expect(customList(twice)[0]?.equipment).toBe('kettlebell')
  })

  it('removes one by its written name', () => {
    const table = addCustom({}, mine)
    expect(removeCustom(table, 'Sandbag Lunge')).toEqual({})
    // The fold is what matches, so neither the case nor a plural has to: an
    // -s plural is one `foldName` drops. It does NOT drop a -y/-ies one, which
    // is why the fixture is a lunge and not a carry.
    expect(removeCustom(table, 'sandbag lunges')).toEqual({})
  })

  it('sorts yours by name, since the order they were added in means nothing', () => {
    // The shipped table's order says something: the multi-gym is in station
    // order. This one's says nothing.
    let table = addCustom({}, mine)
    table = addCustom(table, { name: 'Wall Ball', area: 'lower', equipment: 'kettlebell' })
    table = addCustom(table, { name: 'Ab Rollout', area: 'torso', equipment: 'bodyweight' })
    expect(customList(table).map((e) => e.name)).toEqual([
      'Ab Rollout',
      'Sandbag Lunge',
      'Wall Ball',
    ])
  })

  it('puts the shipped table first, so its record wins a name in both', () => {
    const merged = withCustom([{ name: 'Leg Press', area: 'lower', equipment: 'band' }])
    expect(merged.indexOf(EXERCISES[0]!)).toBe(0)
    expect(merged.at(-1)?.equipment).toBe('band')
  })
})

describe('reading what was stored', () => {
  it('drops an entry with an area or a kit outside the table', () => {
    /*
     * A hand-edited backup is a real way in, and a bad `area` is the one mistake
     * this table can make that shows up as a wrong ROUTINE rather than a missing
     * row: it would sit in no pool the generator builds and print as nothing.
     */
    expect(
      readCustomExercises({
        a: { name: 'Junk', area: 'legs', equipment: 'dumbbell' },
        b: { name: 'More Junk', area: 'lower', equipment: 'sledgehammer' },
        c: { name: '', area: 'lower', equipment: 'dumbbell' },
        d: { name: 'Kept', area: 'lower', equipment: 'dumbbell' },
      }),
    ).toEqual({ kept: { name: 'Kept', area: 'lower', equipment: 'dumbbell' } })
  })

  it('drops a pattern, use or per-side flag it does not recognise, with the record', () => {
    expect(readCustomExercises({ a: { ...mine, pattern: 'sideways' } })).toEqual({})
    expect(readCustomExercises({ a: { ...mine, use: 'vibes' } })).toEqual({})
    expect(readCustomExercises({ a: { ...mine, perSide: 'yes' } })).toEqual({})
  })

  it('re-keys from the name it holds rather than trusting the key', () => {
    // Which is also why this table needs no `refold` pass: the record carries
    // its own name, so a change to `foldName` costs it nothing.
    expect(readCustomExercises({ 'whatever was here': mine })).toEqual({
      'sandbag lunge': mine,
    })
  })

  it('drops one the app has since shipped under the same name', () => {
    /*
     * This happens without anyone doing anything wrong: a harvest adds "Sit Ups"
     * a month after you typed it. Two rows would fight over one weight and one
     * picture, since all three tables are keyed by folded name. The app's record
     * wins, and the weight and picture you set are untouched. They were never
     * keyed to this table.
     */
    const shipped = EXERCISES[0]!.name
    expect(readCustomExercises({ a: { ...mine, name: shipped } })).toEqual({})
  })

  it('survives a store that is not an object at all', () => {
    globalThis.localStorage?.setItem(KEY, '"nonsense"')
    expect(loadCustomExercises()).toEqual({})
    globalThis.localStorage?.setItem(KEY, 'not json')
    expect(loadCustomExercises()).toEqual({})
  })

  it('reads back what it wrote', () => {
    saveCustomExercises(addCustom({}, mine))
    expect(loadCustomExercises()).toEqual({ 'sandbag lunge': mine })
  })
})
