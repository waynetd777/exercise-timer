import { describe, expect, it } from 'vitest'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import {
  copyName,
  duplicate,
  filterWorkouts,
  markRun,
  rename,
  sortWorkouts,
  stamp,
  summary,
  toggleFavourite,
} from '../library'

function make(name: string, extra: Partial<Workout> = {}): Workout {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    blocks: [
      { kind: 'segment', id: 's1', name: 'Work', durationMs: 60_000, role: 'work' },
      { kind: 'segment', id: 's2', name: 'Rest', durationMs: 30_000, role: 'rest' },
    ],
    schemaVersion: SCHEMA_VERSION,
    createdAt: 1000,
    updatedAt: 1000,
    ...extra,
  }
}

describe('stamp / summary', () => {
  it('denormalises the total so the list needn’t compile every routine', () => {
    const stamped = stamp(make('Legs'), 5000)
    expect(stamped.estimatedTotalMs).toBe(90_000)
    expect(stamped.updatedAt).toBe(5000)
    expect(summary(stamped)).toEqual({ totalMs: 90_000, steps: 2 })
  })

  it('falls back to computing the total when it has not been stamped', () => {
    expect(summary(make('Legs')).totalMs).toBe(90_000)
  })
})

describe('filterWorkouts', () => {
  const all = [make('Leg day'), make('Upper body'), make('LEG BLASTER')]

  it('matches case-insensitively on a substring', () => {
    expect(filterWorkouts(all, 'leg').map((w) => w.name)).toEqual(['Leg day', 'LEG BLASTER'])
  })

  it('ignores surrounding whitespace and returns everything for a blank query', () => {
    expect(filterWorkouts(all, '  leg  ')).toHaveLength(2)
    expect(filterWorkouts(all, '   ')).toHaveLength(3)
  })
})

describe('sortWorkouts', () => {
  it('pins favourites above everything, whatever the mode', () => {
    const list = [
      make('Zebra', { lastRunAt: 9000 }),
      make('Apple', { favourite: true, lastRunAt: 10 }),
    ]
    for (const mode of ['recent', 'name', 'duration'] as const) {
      expect(sortWorkouts(list, mode)[0]!.name).toBe('Apple')
    }
  })

  it('orders by most recently run', () => {
    const list = [
      make('Old', { lastRunAt: 100 }),
      make('New', { lastRunAt: 900 }),
      make('Middle', { lastRunAt: 500 }),
    ]
    expect(sortWorkouts(list, 'recent').map((w) => w.name)).toEqual(['New', 'Middle', 'Old'])
  })

  it('sorts a never-run routine below one that has run, not above it', () => {
    // A missing lastRunAt must not read as 0 and then win on some other rule.
    const list = [make('Never'), make('Ran', { lastRunAt: 5 })]
    expect(sortWorkouts(list, 'recent').map((w) => w.name)).toEqual(['Ran', 'Never'])
  })

  it('falls back to most recently edited when neither has been run', () => {
    const list = [make('Older', { updatedAt: 100 }), make('Newer', { updatedAt: 900 })]
    expect(sortWorkouts(list, 'recent').map((w) => w.name)).toEqual(['Newer', 'Older'])
  })

  it('sorts by name ignoring case', () => {
    const list = [make('banana'), make('Apple'), make('cherry')]
    expect(sortWorkouts(list, 'name').map((w) => w.name)).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('sorts longest first by duration', () => {
    const short = make('Short')
    const long = stamp({ ...make('Long'), estimatedTotalMs: 0 }, 1)
    long.estimatedTotalMs = 600_000
    expect(sortWorkouts([short, long], 'duration')[0]!.name).toBe('Long')
  })

  it('does not mutate the input', () => {
    const list = [make('B'), make('A')]
    sortWorkouts(list, 'name')
    expect(list.map((w) => w.name)).toEqual(['B', 'A'])
  })
})

describe('copyName', () => {
  it('appends (copy)', () => {
    expect(copyName('Leg day', [])).toBe('Leg day (copy)')
  })

  it('numbers further copies rather than colliding', () => {
    expect(copyName('Leg day', ['Leg day (copy)'])).toBe('Leg day (copy 2)')
    expect(copyName('Leg day', ['Leg day (copy)', 'Leg day (copy 2)'])).toBe('Leg day (copy 3)')
  })

  it('does not stack suffixes when copying a copy', () => {
    // "Leg day (copy) (copy)" would get silly fast.
    expect(copyName('Leg day (copy)', ['Leg day (copy)'])).toBe('Leg day (copy 2)')
    expect(copyName('Leg day (copy 3)', ['Leg day (copy)'])).toBe('Leg day (copy 2)')
  })

  it('compares names case-insensitively', () => {
    expect(copyName('Leg day', ['LEG DAY (COPY)'])).toBe('Leg day (copy 2)')
  })
})

describe('duplicate', () => {
  const original = make('Leg day', { favourite: true, lastRunAt: 5000, createdAt: 1, updatedAt: 2 })
  const copy = duplicate(original, [original.name], 'new-id', 9000)

  it('takes a fresh id, name and timestamps', () => {
    expect(copy.id).toBe('new-id')
    expect(copy.name).toBe('Leg day (copy)')
    expect(copy.createdAt).toBe(9000)
    expect(copy.updatedAt).toBe(9000)
  })

  it('does not inherit favourite or run history', () => {
    expect(copy.favourite).toBe(false)
    expect(copy).not.toHaveProperty('lastRunAt')
  })

  it('leaves the original untouched', () => {
    expect(original.name).toBe('Leg day')
    expect(original.favourite).toBe(true)
    expect(original.lastRunAt).toBe(5000)
  })

  it('copies the blocks', () => {
    expect(copy.blocks).toEqual(original.blocks)
  })
})

describe('rename', () => {
  it('trims and re-stamps', () => {
    const renamed = rename(make('Old'), '  New name  ', 7000)
    expect(renamed.name).toBe('New name')
    expect(renamed.updatedAt).toBe(7000)
  })

  it('refuses a blank name rather than saving a nameless routine', () => {
    const original = make('Keep me')
    expect(rename(original, '   ', 7000)).toBe(original)
    expect(rename(original, '', 7000)).toBe(original)
  })
})

describe('markRun / toggleFavourite', () => {
  it('stamps the run time without touching updatedAt', () => {
    // Running a routine is not editing it — it must not jump up a "recently
    // edited" sort or change what is saved.
    const original = make('Legs', { updatedAt: 100 })
    const ran = markRun(original, 8000)
    expect(ran.lastRunAt).toBe(8000)
    expect(ran.updatedAt).toBe(100)
  })

  it('flips the favourite flag both ways', () => {
    const off = make('Legs')
    const on = toggleFavourite(off, 1)
    expect(on.favourite).toBe(true)
    expect(toggleFavourite(on, 2).favourite).toBe(false)
  })
})
