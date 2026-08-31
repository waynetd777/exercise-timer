/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { editDistance, sameExercise, similarExercises } from '../similar'
import { EXERCISES } from '../exercises'

const NAMES = EXERCISES.map((exercise) => exercise.name)

describe('the same exercise under another spelling', () => {
  it('recognises a name that folds onto one already listed', () => {
    // The three tables are keyed by folded name, so this is not a similarity: it
    // IS Leg Press, and a second row would fight the first over one weight.
    expect(sameExercise('leg presses', NAMES)).toBe('Leg Press')
    expect(sameExercise('12 × Leg Press (per leg)', NAMES)).toBe('Leg Press')
  })

  it('says nothing about a name of its own', () => {
    expect(sameExercise('Wall Ball Slams', NAMES)).toBeNull()
    expect(sameExercise('   ', NAMES)).toBeNull()
  })
})

describe('the warning before adding one', () => {
  it('catches a typo the name field cannot', () => {
    /*
     * The case this exists for. The instructor writes "Bugarian", and the
     * dropdown's own matcher is prefix and substring based, so one wrong letter
     * in the middle of a word defeats every rule it has: the button that offers
     * to add an exercise only appears where that matcher found nothing, so the
     * warning has to be looser than it or it could never fire at all.
     */
    const found = similarExercises('Bugarian Split Squat', ['Bulgarian Split Squat', 'Leg Press'])
    expect(found[0]).toEqual({ name: 'Bulgarian Split Squat', why: 'typo' })
  })

  it('catches a missing letter at the end, which is how a name gets typed short', () => {
    const found = similarExercises('Chest Pres', ['Standard Chest Press'])
    expect(found.map((entry) => entry.name)).toContain('Standard Chest Press')
  })

  it('lists the family: the movement you already have three of', () => {
    const found = similarExercises('Bulgarian Split Squat', ['King Squats', 'Plie Squats', 'Leg Press'])
    expect(found.map((entry) => entry.name)).toEqual(['King Squats', 'Plie Squats'])
    expect(found.every((entry) => entry.why === 'family')).toBe(true)
  })

  it('puts a typo above a family, because the first row is the one that gets read', () => {
    const found = similarExercises('Plei Squats', ['Plie Squats', 'King Squats'])
    expect(found[0]?.name).toBe('Plie Squats')
    expect(found[0]?.why).toBe('typo')
  })

  it('leaves out the exercise the name already is', () => {
    // That is `sameExercise`, and a different answer: the dialog refuses rather
    // than warns, since there is nothing to add.
    const found = similarExercises('Leg Press', ['Leg Press', 'Seated Leg Extension'])
    expect(found.map((entry) => entry.name)).not.toContain('Leg Press')
  })

  it('does not call two short names similar', () => {
    // "Row" and "Raw" are one edit apart and nothing to do with each other.
    // Under four letters, nothing is close enough to warn about.
    expect(similarExercises('Row', ['Raw'])).toEqual([])
  })

  it('does not warn on a modifier two exercises happen to share', () => {
    // "Seated" is in eleven names and says nothing about the movement. The
    // MOVEMENT is the last word, which is why one shared word is not enough.
    const found = similarExercises('Seated Calf Raise', ['Seated Chest Press'])
    expect(found).toEqual([])
  })

  it('holds to a handful, best first', () => {
    // Typing "Squats" against the real table finds every squat there is, and a
    // warning listing nine of them is noise rather than a warning.
    const found = similarExercises('Squats', NAMES)
    expect(found.length).toBeLessThanOrEqual(4)
  })

  it('says nothing about a name that folds to nothing', () => {
    // "12 ×" is a count, and `foldName` throws all of it away.
    expect(similarExercises('12 ×', NAMES)).toEqual([])
  })
})

describe('the distance itself', () => {
  it('counts an insertion, a deletion and a substitution alike', () => {
    expect(editDistance('press', 'press', 2)).toBe(0)
    expect(editDistance('press', 'pres', 2)).toBe(1)
    expect(editDistance('bugarian', 'bulgarian', 2)).toBe(1)
    expect(editDistance('crunch', 'crunches', 2)).toBe(2)
  })

  it('stops counting at the budget rather than working the whole matrix', () => {
    // Anything over the budget is reported as one more than it, which is all a
    // caller comparing against the budget needs.
    expect(editDistance('leg press', 'trampoline jog', 2)).toBe(3)
    expect(editDistance('a', 'abcdefghij', 2)).toBe(3)
  })
})
