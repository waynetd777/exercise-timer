import { describe, expect, it } from 'vitest'
import type { Workout } from '../../engine'
import { compile, SCHEMA_VERSION } from '../../engine'
import { SEED_ROUTINES } from '../../routines/samples'
import { BUNDLE_VERSION, BundleError, bundleFilename, fromBundle, toBundle } from '../bundle'

const NOW = 1_700_000_000_000

const workout = (name = 'Leg day'): Workout => ({
  id: 'w1',
  name,
  blocks: [
    { kind: 'segment', id: 's1', name: 'Work', durationMs: 20_000, role: 'work' },
    {
      kind: 'repeat',
      id: 'r1',
      times: 3,
      label: 'Reps',
      children: [{ kind: 'segment', id: 's2', name: 'Rest', durationMs: 10_000, role: 'rest' }],
    },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 2,
})

describe('round trip', () => {
  it('survives export and re-import unchanged in substance', () => {
    const back = fromBundle(toBundle([workout()], NOW), NOW)
    expect(back).toHaveLength(1)
    expect(back[0]!.name).toBe('Leg day')
    expect(back[0]!.blocks).toEqual(workout().blocks)
    // The timeline is what actually matters — it must compile identically.
    expect(compile(back[0]!)).toEqual(compile(workout()))
  })

  it('round-trips every real routine', () => {
    const back = fromBundle(toBundle(SEED_ROUTINES, NOW), NOW)
    expect(back).toHaveLength(SEED_ROUTINES.length)
    for (const [i, original] of SEED_ROUTINES.entries()) {
      expect(compile(back[i]!).totalMs).toBe(compile(original).totalMs)
      expect(back[i]!.name).toBe(original.name)
    }
  })

  it('survives an actual JSON serialise, not just an object copy', () => {
    const text = JSON.stringify(toBundle([workout()], NOW))
    const back = fromBundle(JSON.parse(text), NOW)
    expect(compile(back[0]!)).toEqual(compile(workout()))
  })

  it('keeps images, which are just strings inside the routine', () => {
    const withImage = workout()
    withImage.blocks[0] = {
      kind: 'segment',
      id: 's1',
      name: 'Cable fly',
      durationMs: 20_000,
      role: 'work',
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    }
    const back = fromBundle(JSON.parse(JSON.stringify(toBundle([withImage], NOW))), NOW)
    expect(back[0]!.blocks[0]).toMatchObject({
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    })
  })
})

describe('toBundle', () => {
  it('stamps the format, the version and the time', () => {
    const bundle = toBundle([workout()], NOW)
    expect(bundle.kind).toBe('davshack-timer-bundle')
    expect(bundle.version).toBe(BUNDLE_VERSION)
    expect(bundle.exportedAt).toBe(NOW)
    expect(bundle.media).toEqual({})
  })

  it('does not alias the routines it was given', () => {
    const original = workout()
    const bundle = toBundle([original], NOW)
    bundle.workouts[0]!.name = 'Changed'
    expect(original.name).toBe('Leg day')
  })
})

describe('fromBundle', () => {
  it('refreshes updatedAt but keeps createdAt', () => {
    const back = fromBundle(toBundle([workout()], NOW), 9_999)
    expect(back[0]!.createdAt).toBe(1)
    expect(back[0]!.updatedAt).toBe(9_999)
  })

  it('fills in metadata a hand-written file might omit', () => {
    const back = fromBundle(
      {
        kind: 'davshack-timer-bundle',
        version: 1,
        workouts: [{ id: 'x', name: 'Sparse', blocks: [] }],
      },
      NOW,
    )
    expect(back[0]).toMatchObject({ createdAt: NOW, updatedAt: NOW, schemaVersion: SCHEMA_VERSION })
  })

  it('rejects anything that is not one of our exports', () => {
    for (const input of [null, 42, 'text', {}, { kind: 'something-else', version: 1 }]) {
      expect(() => fromBundle(input, NOW)).toThrow(BundleError)
    }
  })

  it('refuses a file from a newer version rather than guessing', () => {
    expect(() =>
      fromBundle({ kind: 'davshack-timer-bundle', version: 99, workouts: [] }, NOW),
    ).toThrow(/newer version/)
  })

  it('rejects a bundle whose routines are all unreadable', () => {
    expect(() =>
      fromBundle(
        { kind: 'davshack-timer-bundle', version: 1, workouts: [{ id: 1, name: 2 }] },
        NOW,
      ),
    ).toThrow(/no readable routines/)
  })

  it('drops individual bad routines but keeps the good ones', () => {
    // One corrupt entry should not lose the rest of the library.
    const back = fromBundle(
      {
        kind: 'davshack-timer-bundle',
        version: 1,
        workouts: [{ nonsense: true }, workout('Keeper')],
      },
      NOW,
    )
    expect(back.map((w) => w.name)).toEqual(['Keeper'])
  })

  it('validates nested block trees, not just the top level', () => {
    const bad = {
      kind: 'davshack-timer-bundle',
      version: 1,
      workouts: [
        { id: 'x', name: 'Bad', blocks: [{ kind: 'repeat', id: 'r', times: 2, children: [42] }] },
      ],
    }
    expect(() => fromBundle(bad, NOW)).toThrow(/no readable routines/)
  })
})

describe('bundleFilename', () => {
  it('slugs the routine name and dates the file', () => {
    expect(bundleFilename('Beginner Mixed Cardio & Full-Body 2', new Date('2026-08-21'))).toBe(
      'beginner-mixed-cardio-full-body-2-2026-08-21.timer.json',
    )
  })

  it('names a whole-library export', () => {
    expect(bundleFilename(null, new Date('2026-08-21'))).toBe('library-2026-08-21.timer.json')
  })

  it('never produces an empty name', () => {
    expect(bundleFilename('***', new Date('2026-08-21'))).toBe('routine-2026-08-21.timer.json')
  })
})
