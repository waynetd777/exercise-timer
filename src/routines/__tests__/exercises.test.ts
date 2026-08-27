/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../exercises'
import { MACHINE_EXERCISES } from '../exercises.machine'
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
