import { describe, expect, it } from 'vitest'
import type { Workout } from '../../engine'
import { compile, SCHEMA_VERSION } from '../../engine'
import { SEED_ROUTINES } from '../../routines/samples'
import { sha256 } from '../../media/hash'
import { BUNDLE_VERSION, BundleError, bundleFilename, fromBundle, toBundle } from '../bundle'
import { collectMedia, restoreMedia } from '../bundleMedia'

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
    // The timeline is what actually matters. It must compile identically.
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

describe('an uploaded photo travels in the file', () => {
  /*
   * The whole point of the media map. A bundled illustration is a path the app on
   * the other side already has; a photo taken on this device exists nowhere else,
   * so if it does not go in the file it does not go at all, and since the
   * image-link field was removed, this is the only route to another device.
   *
   * Tested at the FORMAT seam rather than through `importRoutineFiles`, because
   * the last step of an import is a write to IndexedDB and this project fakes no
   * browser storage. What is asserted here is everything the file has to carry.
   */
  it('survives export, a real JSON serialise, and re-import', async () => {
    const blob = new Blob([new Uint8Array(2048).fill(9)], { type: 'image/webp' })
    const hash = await sha256(blob)

    const routine = workout('Photo day')
    routine.blocks[0] = {
      kind: 'segment',
      id: 's1',
      name: 'My own lift',
      durationMs: 20_000,
      role: 'work',
      media: { source: 'local', hash, mime: 'image/webp' },
    }

    const media = await collectMedia([routine], async () => blob)
    const text = JSON.stringify(toBundle([routine], NOW, media))

    const parsed = JSON.parse(text) as { media: unknown }
    const back = fromBundle(parsed, NOW)
    expect(back[0]!.blocks[0]).toMatchObject({ media: { source: 'local', hash } })

    const restored = await restoreMedia(parsed.media)
    expect(restored.skipped).toEqual([])
    expect(restored.entries).toHaveLength(1)
    expect(restored.entries[0]!.hash).toBe(hash)
    // Byte for byte, and still an image rather than an octet stream.
    expect(restored.entries[0]!.blob.size).toBe(2048)
    expect(restored.entries[0]!.blob.type).toBe('image/webp')
    expect(await sha256(restored.entries[0]!.blob)).toBe(hash)
  })

  it('carries nothing for a routine that only uses the app\'s own illustrations', async () => {
    const routine = workout('Bundled only')
    routine.blocks[0] = {
      kind: 'segment',
      id: 's1',
      name: 'Cable fly',
      durationMs: 20_000,
      role: 'work',
      media: { source: 'bundled', path: 'exercises/Cable-Fly.jpg' },
    }

    const bundle = toBundle([routine], NOW, await collectMedia([routine], async () => undefined))
    expect(bundle.media).toEqual({})
    // And the export stays small: a path rather than a hundred kilobytes.
    expect(JSON.stringify(bundle).length).toBeLessThan(2000)
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
