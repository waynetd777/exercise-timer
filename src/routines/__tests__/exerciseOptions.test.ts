/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Exercise } from '../exercises'
import { EXERCISES } from '../exercises'
import type { MediaRef } from '../../engine'
import { collectExercises, exerciseRows, indexOfName, optionsOf } from '../exerciseOptions'

const ex = (name: string, extra: Partial<Exercise> = {}): Exercise => ({
  name,
  area: 'lower',
  equipment: 'machine',
  ...extra,
})

describe('the exercise table as the name field offers it', () => {
  it('groups by kit, multi-gym first', () => {
    const options = collectExercises([
      ex('Ski Jumps', { equipment: 'trampoline' }),
      ex('Leg Press'),
      ex('Bicep Curl', { equipment: 'dumbbell' }),
      ex('Cycling', { equipment: 'bike', use: 'cardio' }),
    ])

    expect(options.map((o) => o.name)).toEqual(['Leg Press', 'Cycling', 'Ski Jumps', 'Bicep Curl'])
    expect(options.map((o) => o.kit)).toEqual(['Multi-gym', 'Bike', 'Trampoline', 'Dumbbells'])
  })

  it('carries the picture in force: the exercises page over the guide, none where neither has one', () => {
    // The thumbnail must show what the step will: a photo chosen on the page
    // used to be invisible here, and the guide's drawing was stamped on the pick.
    const chosen: MediaRef = { source: 'local', hash: 'mine', mime: 'image/jpeg' }
    const options = collectExercises(
      [
        ex('Leg Press', { media: 'exercises/Leg-Press.jpg' }),
        ex('Squat', { equipment: 'bodyweight' }),
        ex('Bicep Curl', { media: 'exercises/Bicep-Curl.jpg', equipment: 'dumbbell' }),
      ],
      new Map([['leg press', chosen]]),
    )
    const by = (name: string) => options.find((o) => o.name === name)

    expect(by('Leg Press')?.picture).toEqual(chosen)
    expect(by('Bicep Curl')?.picture).toEqual({ source: 'bundled', path: 'exercises/Bicep-Curl.jpg' })
    expect(by('Squat') && 'picture' in by('Squat')!).toBe(false)
  })

  it('says the station, what the exercise is for, and whether it is per side', () => {
    // Looked up by name, not by position: the builder returns them in KIT
    // order, so the bike lands after both machines whatever order it is given in.
    const options = collectExercises([
      ex('Leg Press', { station: 3 }),
      ex('Cycling', { equipment: 'bike', use: 'cardio' }),
      ex('Glute Kickback', { station: 7, perSide: true }),
    ])
    const at = (name: string) => options.find((o) => o.name === name)
    const press = at('Leg Press')
    const cycling = at('Cycling')
    const kickback = at('Glute Kickback')

    expect(press?.hint).toBe('Station 3')
    expect(cycling?.hint).toBe('Cardio')
    expect(kickback?.hint).toBe('Station 7 · each side')
    expect(kickback?.perSide).toBe(true)
  })

  it('deduplicates by folded name, so the guide\'s spelling wins', () => {
    /*
     * The table is three files, one harvested from the routines, so the same
     * movement can arrive twice under two spellings. Two rows for one exercise
     * would also be two identical React keys.
     */
    const options = collectExercises([
      ex('Bentover Row', { media: 'exercises/Bentover-Row.jpg' }),
      ex('Bentover Rows', { equipment: 'dumbbell' }),
    ])

    expect(options.map((o) => o.name)).toEqual(['Bentover Row'])
  })

  it('offers every exercise the generator can choose from', () => {
    // One table, not two: the editor and the generator have to agree about what
    // exists, or a generated routine holds names the editor cannot offer.
    expect(collectExercises().length).toBe(EXERCISES.length)
  })

  it('includes the bike and the trampoline, which are kit like any other', () => {
    const names = collectExercises().map((o) => o.name)

    expect(names).toContain('Cycling')
    expect(names).toContain('Trampoline')
  })
})

describe('what the list shows for what has been typed', () => {
  const options = collectExercises([
    ex('Leg Press', { station: 3 }),
    ex('Seated Leg Extension', { station: 4 }),
    ex('Standard Chest Press', { station: 2 }),
    ex('Seated Abdominal Crunch', { station: 5 }),
    ex('Squat', { equipment: 'bodyweight' }),
  ])

  it('groups everything under its kit while nothing is typed', () => {
    const rows = exerciseRows(options, '')

    expect(rows.filter((r) => r.kind === 'group').map((r) => r.kind === 'group' && r.label)).toEqual(
      ['Multi-gym', 'Bodyweight'],
    )
    expect(optionsOf(rows).length).toBe(5)
  })

  it('filters flat, with no headings, once something is typed', () => {
    const rows = exerciseRows(options, 'leg')

    expect(rows.every((r) => r.kind === 'option')).toBe(true)
    expect(optionsOf(rows).map((o) => o.name)).toEqual(['Leg Press', 'Seated Leg Extension'])
  })

  it('puts the name that STARTS with what was typed first', () => {
    // Whatever is first is what Enter picks, so a name that begins with what you
    // typed has to beat one that merely contains it. Table order alone would
    // have offered Seated Leg Extension for "leg".
    expect(optionsOf(exerciseRows(options, 'leg')).map((o) => o.name)).toEqual([
      'Leg Press',
      'Seated Leg Extension',
    ])
    expect(optionsOf(exerciseRows(options, 'seated')).map((o) => o.name)).toEqual([
      'Seated Leg Extension',
      'Seated Abdominal Crunch',
    ])
    // Equally good matches keep table order rather than whatever `sort` leaves.
    expect(optionsOf(exerciseRows(options, 'press')).map((o) => o.name)).toEqual([
      'Leg Press',
      'Standard Chest Press',
    ])
  })

  it('searches on a half-typed limb, which `foldName` alone folds away', () => {
    /*
     * `foldName` drops a trailing limb, because "Fire Hydrant Left Leg" names a
     * side. Applied to a QUERY that rule made "leg" mean nothing, and the field
     * answered a search with all 147 exercises. "arm" and "side" did the same.
     */
    expect(optionsOf(exerciseRows(options, 'leg')).length).toBe(2)
    expect(exerciseRows(options, 'leg').some((r) => r.kind === 'group')).toBe(false)
  })

  it('folds both sides, so the instructor\'s own spellings find their exercise', () => {
    // `foldName` is why: she writes counts, plurals and brackets into a name,
    // and this field is where they get typed.
    expect(optionsOf(exerciseRows(options, 'ab crunch')).map((o) => o.name)).toEqual([
      'Seated Abdominal Crunch',
    ])
    expect(optionsOf(exerciseRows(options, '12 × Squats')).map((o) => o.name)).toEqual(['Squat'])
  })

  it('finds the exercise inside a line that says more than the exercise', () => {
    /*
     * The paste parser writes a course leg as "Walking lunge 5m A-B", and a name
     * read "12 × Leg Press 65kg" before the count and the weight became fields.
     * Both still name an exercise, with the routine's own words around it.
     */
    const table = collectExercises([
      ex('Walking Lunges', { equipment: 'bodyweight', perSide: true }),
      ex('Leg Press', { station: 3 }),
      ex('Squat', { equipment: 'bodyweight' }),
    ])

    expect(optionsOf(exerciseRows(table, 'Walking lunge 5m A-B')).map((o) => o.name)).toEqual([
      'Walking Lunges',
    ])
    expect(optionsOf(exerciseRows(table, '12 × Leg Press 65kg')).map((o) => o.name)).toEqual([
      'Leg Press',
    ])
  })

  it('will not let a one-word exercise claim a whole sentence', () => {
    // "squat" and "plank" appear inside plenty of prose. The rule above needs two
    // words, or a step called "As many rounds as possible" would name a movement.
    const table = collectExercises([ex('Squat', { equipment: 'bodyweight' })])

    expect(exerciseRows(table, 'Deep squat holds till the minute is over')).toEqual([])
  })

  it('matches several words in any order', () => {
    expect(optionsOf(exerciseRows(options, 'press chest')).map((o) => o.name)).toEqual([
      'Standard Chest Press',
    ])
  })

  it('returns nothing for a name of its own, which is a legitimate answer', () => {
    // "Warm Up" and "Cool Down" are in the library and in no table. The field
    // says so and lets the name stand; it does not correct it.
    expect(exerciseRows(options, 'Warm Up')).toEqual([])
  })
})

describe('where a written name sits in the list', () => {
  const options = collectExercises([
    ex('Leg Press', { station: 3 }),
    ex('Seated Abdominal Crunch', { station: 5 }),
    ex('Cycling', { equipment: 'bike', use: 'cardio' }),
  ])

  it('finds the exercise a step already names', () => {
    // What the field opens ON, so browsing lands on the exercise you have.
    expect(indexOfName(options, 'Cycling')).toBe(2)
  })

  it('reads through a count and the instructor\'s shorthand', () => {
    // Exact first, then `closestKey`: "ab" finds "abdominal", the same way the
    // weight lookup and the renamer read a written name.
    expect(indexOfName(options, '12 × Seated Ab Crunch')).toBe(1)
  })

  it('falls back to the ranked search for a name that carries more than the exercise', () => {
    // The third pass. Neither an exact fold nor `closestKey` can see Walking
    // Lunges inside "Walking lunge 5m A-B"; the search is built to.
    const table = collectExercises([
      ex('Leg Press', { station: 3 }),
      ex('Walking Lunges', { equipment: 'bodyweight', perSide: true }),
    ])

    expect(indexOfName(table, 'Walking lunge 5m A-B')).toBe(1)
    expect(indexOfName(table, 'Walking lunge 5m B-A')).toBe(1)
  })

  it('falls back to the top for a name no table holds, and for an empty one', () => {
    expect(indexOfName(options, 'Warm Up')).toBe(0)
    expect(indexOfName(options, '')).toBe(0)
  })
})
