/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { EXERCISES, HARVESTED_EXERCISES, MACHINE_EXERCISES, OTHER_EXERCISES } from '../exercises'
import { foldName } from '../foldName'
import { IMAGE_CATALOGUE } from '../imageCatalogue'

describe('the machine table, generated from the Horizon guide', () => {
  it('has one row per exercise the guide illustrates', () => {
    // 41 exercise pages. The catalogue holds two more, the bike and the cycling
    // photo, which are not the manual's and are not exercises.
    expect(MACHINE_EXERCISES).toHaveLength(41)
  })

  it('points every row at a picture the app actually ships', () => {
    // A typo here is a silently broken image, and the generator picks the media
    // for a step from this field.
    const offered = new Set(IMAGE_CATALOGUE)
    expect(MACHINE_EXERCISES.filter((e) => !e.media || !offered.has(e.media))).toEqual([])
  })

  it('uses every picture the catalogue offers, bar the two cycling ones', () => {
    // The other direction: an exercise missing from the table can never be
    // generated, and nothing would say so.
    const used = new Set(MACHINE_EXERCISES.map((e) => e.media))
    // Sorted, so reordering the catalogue is not a failure. Which two are left
    // over is the claim; where they sit in the list is not.
    const unused = IMAGE_CATALOGUE.filter((path) => !used.has(path))
    expect([...unused].sort()).toEqual([
      'exercises/Cycling.jpg',
      'exercises/horizon-5-0-r-recumbent-bike.jpg',
    ])
  })

  it('reads the guide’s three-way muscle-group key', () => {
    const count = (area: string) => MACHINE_EXERCISES.filter((e) => e.area === area).length
    expect({ upper: count('upper'), torso: count('torso'), lower: count('lower') }).toEqual({
      upper: 25,
      torso: 5,
      lower: 11,
    })
  })

  it('puts every exercise on a station the machine has', () => {
    expect(MACHINE_EXERCISES.every((e) => e.station !== undefined)).toBe(true)
    expect(MACHINE_EXERCISES.filter((e) => (e.station ?? 0) < 1 || (e.station ?? 0) > 8)).toEqual([])
  })

  it('calls exactly the ankle-strap exercises ankle-strap', () => {
    /*
     * These are the five that get a 20s get-ready instead of 15s, and the rule
     * used to live in a memory file. Standing Leg Curl is the check: it is done
     * one leg at a time but hooks under a ROLLER PAD, so it is not on this list.
     */
    expect(MACHINE_EXERCISES.filter((e) => e.attachment === 'ankle').map((e) => e.name)).toEqual([
      'Hip Abductor Leg Raise',
      'Hip Adductor Leg Raise',
      'Free-Standing Hamstring Curl',
      'Glute Kickback',
      'Standing Leg Extension',
    ])
  })

  it('marks the per-side exercises the guide says to repeat on the opposite side', () => {
    const perSide = MACHINE_EXERCISES.filter((e) => e.perSide).map((e) => e.name)
    // Side Cable Bends is the one that proves the phrase matters rather than the
    // limb being named: Wayne's own routine runs it two sets a side.
    expect(perSide).toContain('Side Cable Bends')
    expect(perSide).toContain('Abdominal Oblique Crunch')
    expect(perSide).toHaveLength(11)
  })

  it('gives every upper-body exercise a push or a pull, and no other one', () => {
    const upper = MACHINE_EXERCISES.filter((e) => e.area === 'upper')
    expect(upper.every((e) => e.pattern === 'push' || e.pattern === 'pull')).toBe(true)
    expect(MACHINE_EXERCISES.filter((e) => e.area !== 'upper' && e.pattern !== undefined)).toEqual(
      [],
    )
  })

  it('does not put a rear fly in with the presses, which the naive rule would', () => {
    const pattern = (name: string) => MACHINE_EXERCISES.find((e) => e.name === name)?.pattern
    expect(pattern('Cable Fly')).toBe('push')
    expect(pattern('Rear Cable Fly')).toBe('pull')
    expect(pattern('Dynamic Cable Rear Delt Fly')).toBe('pull')
  })

  it('names every exercise once', () => {
    expect(new Set(EXERCISES.map((e) => e.name)).size).toBe(EXERCISES.length)
  })
})

describe('the authored half, harvested from the corpus', () => {
  const area = (a: string) => OTHER_EXERCISES.filter((e) => e.area === a)
  const use = (u: string) =>
    OTHER_EXERCISES.filter((e) => (e.use ?? 'strength') === u)

  it('never calls for kit that is not in the garage', () => {
    // A 6kg kettlebell, dumbbells to 5kg, bands, a trampoline, the bike and the
    // machine. Suggesting anything else is proposing work Wayne cannot do.
    const owned = new Set(['bodyweight', 'dumbbell', 'kettlebell', 'band', 'trampoline', 'bike'])
    expect(OTHER_EXERCISES.filter((e) => !owned.has(e.equipment))).toEqual([])
  })

  it('states no weight, because the generator seeds one from history instead', () => {
    expect(OTHER_EXERCISES.filter((e) => e.load !== undefined)).toEqual([])
  })

  it('carries no illustration, since the guide only draws the machine', () => {
    // Cycling is the exception: it is not the guide's, and it has a photo.
    expect(OTHER_EXERCISES.filter((e) => e.media).map((e) => e.name)).toEqual(['Cycling'])
  })

  it('covers the torso, which is the shortfall it exists to fill', () => {
    // The machine has five. Anything less than a good spread here and a
    // torso-focused routine still cannot be built.
    expect(area('torso').length).toBeGreaterThanOrEqual(15)
  })

  it('offers both activities Wayne named, as activities rather than drills', () => {
    // "A minute on the bike" and "a minute on the trampoline" are what the
    // recovery question is asking, so both are single entries. The specific
    // bounces are separate rows for anyone who wants to name one.
    const cardio = OTHER_EXERCISES.filter((e) => e.use === 'cardio').map((e) => e.name)
    expect(cardio).toContain('Cycling')
    expect(cardio).toContain('Trampoline')
  })

  it('offers cardio for a warm-up and for active recovery', () => {
    expect(use('cardio').length).toBeGreaterThanOrEqual(10)
    // Both of the recovery types Wayne named have somewhere to come from.
    expect(use('cardio').map((e) => e.equipment)).toContain('bike')
    expect(use('cardio').map((e) => e.equipment)).toContain('trampoline')
  })

  it('offers mobility, which is what the opening minutes are', () => {
    expect(use('mobility').length).toBeGreaterThanOrEqual(5)
  })

  it('gives every upper-body exercise a push or a pull, as the machine half does', () => {
    const upper = OTHER_EXERCISES.filter((e) => e.area === 'upper')
    expect(upper.every((e) => e.pattern === 'push' || e.pattern === 'pull')).toBe(true)
    expect(OTHER_EXERCISES.filter((e) => e.area !== 'upper' && e.pattern)).toEqual([])
  })

  it('can balance a session without the machine at all', () => {
    // The point of "no multi-gym": every area has enough to fill a rotation.
    for (const a of ['upper', 'torso', 'lower']) {
      expect(area(a).filter((e) => (e.use ?? 'strength') === 'strength').length).toBeGreaterThanOrEqual(6)
    }
  })

  it('has no name that still carries a count or a per-side qualifier', () => {
    // The corpus had "Bicycle Crunches – each side" and "Bulgarian split squat–
    // 5 each side" as if they were names. Those are fields, not names.
    const dirty = EXERCISES.filter((e) => /\d|each (side|leg|direction)|–|\+/i.test(e.name))
    expect(dirty.map((e) => e.name)).toEqual([])
  })
})

describe('the harvested half', () => {
  it('adds what the corpus knows and the authored tables do not', () => {
    expect(HARVESTED_EXERCISES.length).toBeGreaterThan(10)
    const authored = new Set([...MACHINE_EXERCISES, ...OTHER_EXERCISES].map((e) => foldName(e.name)))
    // Nothing here duplicates a name the authored tables already chose. That was
    // the whole failure mode of the first pass: "Curtsy Lunge" beside
    // "Alternating Curtsy Lunges", "Rb Squats" beside "Band Squats".
    expect(HARVESTED_EXERCISES.filter((e) => authored.has(foldName(e.name)))).toEqual([])
  })

  it('folds every spelling of a name onto one', () => {
    // The property the whole harvest rests on, and it was briefly wrong twice.
    expect(foldName('Bicycle Crunches')).toBe(foldName('10x Bicycle crunch (per leg)'))
    expect(foldName('Reverse Crunches')).toBe('reverse crunch')
    expect(foldName('Hand-release Push-ups')).toBe(foldName('Hand Release Push Ups'))
    expect(foldName('Fire Hydrant Left Leg')).toBe(foldName('Fire Hydrants'))
  })

  it('names every exercise in the whole table once', () => {
    const folded = EXERCISES.map((e) => foldName(e.name))
    expect(new Set(folded).size).toBe(folded.length)
  })
})
