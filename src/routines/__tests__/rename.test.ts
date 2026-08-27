/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Block, Workout } from '../../engine/types'
import { SCHEMA_VERSION } from '../../engine/types'
import { canonicalName, tidyLibrary, tidyNames } from '../rename'

describe('canonicalName', () => {
  it('leaves a name that is already the table’s', () => {
    expect(canonicalName('Leg Press')).toBeNull()
    expect(canonicalName('12 × Leg Press 65kg')).toBeNull()
  })

  it('fixes a spelling', () => {
    expect(canonicalName('Mountain climbers')).toBe('Mountain Climbers')
    expect(canonicalName('Free Standing Hamstring Curl')).toBe('Free-Standing Hamstring Curl')
    expect(canonicalName('Bent-over Rows')).toBe('Bent-Over Rows')
  })

  it('fixes an abbreviation', () => {
    expect(canonicalName('Seated Ab Crunch')).toBe('Seated Abdominal Crunch')
  })

  it('keeps the announcement, the count and the weight around it', () => {
    /*
     * A step is called far more than its exercise. Renaming has to put every
     * other part back exactly where it was.
     */
    expect(canonicalName('Get ready: Seated Ab Crunch 15kg')).toBe(
      'Get ready: Seated Abdominal Crunch 15kg',
    )
    expect(canonicalName('12 × Seated Ab Crunch 15kg')).toBe('12 × Seated Abdominal Crunch 15kg')
  })

  it('keeps a bracketed note, which is often the only record of something', () => {
    // "(knees or toes)" is the easier option; losing it would lose the option.
    expect(canonicalName('Push-ups (knees or toes)')).toBeNull()
    expect(canonicalName('Mountain climbers (per leg)')).toBe('Mountain Climbers (per leg)')
  })

  it('keeps the side, the limb and a trailing count', () => {
    /*
     * `foldName` throws all of these away to match, so the canonical name came
     * back without them: "side plank left" became "Side Plank", and the count
     * on "Quad stretch × 3" vanished.
     */
    expect(canonicalName('Mountain climbers left')).toBe('Mountain Climbers left')
    expect(canonicalName('Mountain climbers right leg')).toBe('Mountain Climbers right leg')
    expect(canonicalName('Mountain climbers per leg')).toBe('Mountain Climbers per leg')
    expect(canonicalName('Mountain climbers × 3 (left & right)')).toBe(
      'Mountain Climbers × 3 (left & right)',
    )
    expect(canonicalName('Mountain climbers– 5 each side')).toBe('Mountain Climbers– 5 each side')
  })

  it('leaves alone a name whose qualifier it does not recognise', () => {
    // Better unrenamed than shortened: the qualifier would be folded away.
    expect(canonicalName('Mountain climbers left-ish')).toBeNull()
    expect(canonicalName('Mountain climbers 3 times')).toBeNull()
  })

  it('reads a bare Chest Press as the standard one', () => {
    // The table has five and no plain one, so nothing can match it. On this
    // machine it can only mean the standard press, which Wayne confirmed.
    expect(canonicalName('Chest Press')).toBe('Standard Chest Press')
    expect(canonicalName('12 × Chest Press 30kg')).toBe('12 × Standard Chest Press 30kg')
  })

  it('leaves alone what it cannot name', () => {
    expect(canonicalName('Squat + Shoulder Press')).toBeNull()
    expect(canonicalName('Cable Tricep Pushdown')).toBeNull()
    expect(canonicalName('March → Jog on the spot')).toBeNull()
  })

  it('does not touch the steps that are not exercises', () => {
    for (const name of ['Get ready', 'Rest', 'Recover', 'Warm Up', 'Cool Down', 'Change Sides']) {
      expect(canonicalName(name)).toBeNull()
    }
  })
})

describe('tidyNames', () => {
  it('reaches inside groups and reports what it did', () => {
    const blocks: Block[] = [
      {
        kind: 'repeat',
        id: 'r',
        times: 3,
        children: [
          { kind: 'segment', id: 'a', name: '12 × Seated Ab Crunch', role: 'work', durationMs: 20_000 },
          { kind: 'segment', id: 'b', name: 'Rest', role: 'rest', durationMs: 10_000 },
        ],
      },
    ]
    const { blocks: next, renamed } = tidyNames(blocks)
    expect(renamed).toEqual([
      { from: '12 × Seated Ab Crunch', to: '12 × Seated Abdominal Crunch' },
    ])
    const children = (next[0] as { children: { name: string }[] }).children
    expect(children[0]!.name).toBe('12 × Seated Abdominal Crunch')
    expect(children[1]!.name).toBe('Rest')
  })

  it('returns what it was given when everything is already right', () => {
    const blocks: Block[] = [
      { kind: 'segment', id: 'a', name: 'Leg Press', role: 'work', durationMs: 20_000 },
    ]
    expect(tidyNames(blocks).blocks).toBe(blocks)
  })
})

describe('tidyLibrary', () => {
  const make = (name: string, step: string): Workout => ({
    id: name,
    name,
    blocks: [{ kind: 'segment', id: 's', name: step, role: 'work', durationMs: 20_000 }],
    schemaVersion: SCHEMA_VERSION,
    createdAt: 1,
    updatedAt: 1,
  })

  it('returns only the routines that changed', () => {
    // Saving a routine stamps it as edited, so one that needed nothing must not
    // be in the list at all.
    const { workouts, renamed } = tidyLibrary([
      make('Tidy', 'Leg Press'),
      make('Untidy', 'Seated Ab Crunch'),
    ])
    expect(workouts.map((w) => w.name)).toEqual(['Untidy'])
    expect(renamed).toHaveLength(1)
  })
})
