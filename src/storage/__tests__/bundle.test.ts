/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Block, Workout } from '../../engine'
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
      label: 'Set',
      children: [{ kind: 'segment', id: 's2', name: 'Rest', durationMs: 10_000, role: 'rest' }],
    },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 2,
})

describe('round trip', () => {
  it('survives export and re-import unchanged in substance', () => {
    const back = fromBundle(toBundle([workout()], NOW), NOW).workouts
    expect(back).toHaveLength(1)
    expect(back[0]!.name).toBe('Leg day')
    expect(back[0]!.blocks).toEqual(workout().blocks)
    // The timeline is what actually matters. It must compile identically.
    expect(compile(back[0]!)).toEqual(compile(workout()))
  })

  it('round-trips every real routine', () => {
    const back = fromBundle(toBundle(SEED_ROUTINES, NOW), NOW).workouts
    expect(back).toHaveLength(SEED_ROUTINES.length)
    for (const [i, original] of SEED_ROUTINES.entries()) {
      expect(compile(back[i]!).totalMs).toBe(compile(original).totalMs)
      expect(back[i]!.name).toBe(original.name)
    }
  })

  it('survives an actual JSON serialise, not just an object copy', () => {
    const text = JSON.stringify(toBundle([workout()], NOW))
    const back = fromBundle(JSON.parse(text), NOW).workouts
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
    const back = fromBundle(JSON.parse(JSON.stringify(toBundle([withImage], NOW))), NOW).workouts
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
    const back = fromBundle(parsed, NOW).workouts
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
    const back = fromBundle(toBundle([workout()], NOW), 9_999).workouts
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
    ).workouts
    expect(back[0]).toMatchObject({ createdAt: NOW, updatedAt: NOW, schemaVersion: SCHEMA_VERSION })
  })

  it('keeps only the fields it knows, and brings a last run in the future back to now', () => {
    // A file is hand-editable. Unknown keys used to land in the store, and a
    // last-run of 2250 sat at the top of the library for good.
    const bundle = toBundle([workout('Legs')], 1000)
    const entry = bundle.workouts[0] as Record<string, unknown>
    bundle.workouts[0] = { ...entry, lastRunAt: 9e15, favourite: true, surprise: 'x' } as never
    const [back] = fromBundle(JSON.parse(JSON.stringify(bundle)), 2000).workouts
    expect(back).not.toHaveProperty('surprise')
    expect(back?.lastRunAt).toBe(2000)
    expect(back?.favourite).toBe(true)
  })

  it('gives a block with no id one, rather than refusing the file', () => {
    // Required by the run (a gate is keyed on it), so it is filled in on the
    // way in instead of turning a hand-written file away.
    const bundle = toBundle([workout('Legs')], 1000)
    const first = bundle.workouts[0]!.blocks[0] as Record<string, unknown>
    delete first['id']
    const { workouts, rejected } = fromBundle(JSON.parse(JSON.stringify(bundle)), 2000)
    expect(rejected).toEqual([])
    expect(typeof workouts[0]?.blocks[0]?.id).toBe('string')
  })

  it('rejects a routine that would expand past the step limit', () => {
    // `compile()` throws on more than MAX_TIMELINE_ENTRIES steps, in the run
    // screen's render. A file is the one way such a routine arrives without
    // the editor's guard seeing it.
    const nested = (times: number, child: Block): Block => ({ kind: 'repeat', id: `r${times}`, times, children: [child] })
    const huge = {
      kind: 'davshack-timer-bundle',
      version: 1,
      workouts: [
        {
          id: 'big',
          name: 'Too big',
          blocks: [nested(99, nested(99, nested(99, { kind: 'segment', id: 's', name: 'Squat', role: 'work', reps: { kind: 'fixed', count: 5 } })))],
        },
      ],
    }
    expect(fromBundle(huge, NOW).rejected).toEqual(['Too big'])
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

  it('names the routines it could not read, even when that is all of them', () => {
    // Throwing here lost the names it had just collected; the file is the
    // user's only copy, so which routines are gone is the one thing to say.
    const contents = fromBundle(
      { kind: 'davshack-timer-bundle', version: 1, workouts: [{ id: 1, name: 2 }] },
      NOW,
    )
    expect(contents.workouts).toEqual([])
    expect(contents.rejected).toEqual(['Unnamed routine'])
    // A file with no routines at all is still an error.
    expect(() =>
      fromBundle({ kind: 'davshack-timer-bundle', version: 1, workouts: [] }, NOW),
    ).toThrow(/no readable routines/)
  })

  it('drops individual bad routines but keeps the good ones, and says so', () => {
    // One corrupt entry should not lose the rest of the library, and it must
    // not vanish silently either: a restore that loses routines has to say so.
    const { workouts, rejected } = fromBundle(
      {
        kind: 'davshack-timer-bundle',
        version: 1,
        workouts: [{ nonsense: true }, { id: 'b', name: 'Broken', blocks: 7 }, workout('Keeper')],
      },
      NOW,
    )
    expect(workouts.map((w) => w.name)).toEqual(['Keeper'])
    expect(rejected).toEqual(['Unnamed routine', 'Broken'])
  })

  it('reports nothing rejected for a fully readable file', () => {
    expect(fromBundle(toBundle([workout()], NOW), NOW).rejected).toEqual([])
  })

  it('validates nested block trees, not just the top level', () => {
    const bad = {
      kind: 'davshack-timer-bundle',
      version: 1,
      workouts: [
        { id: 'x', name: 'Bad', blocks: [{ kind: 'repeat', id: 'r', times: 2, children: [42] }] },
      ],
    }
    expect(fromBundle(bad, NOW).rejected).toEqual(['Bad'])
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

describe('field validation', () => {
  /*
   * The trap these pin: `isBlock` used to accept `{kind: 'segment'}` with any
   * field contents at all, so a hand-edited or corrupted bundle imported,
   * persisted, and then threw in React every time the routine was opened.
   */
  const bundleWith = (blocks: unknown[]): unknown => ({
    kind: 'davshack-timer-bundle',
    version: 1,
    workouts: [{ id: 'x', name: 'Suspect', blocks }],
  })

  const rejects = (blocks: unknown[]): void => {
    const contents = fromBundle(bundleWith(blocks), NOW)
    expect(contents.workouts).toHaveLength(0)
    expect(contents.rejected).toEqual(['Suspect'])
  }
  const accepts = (blocks: unknown[]): void => {
    expect(fromBundle(bundleWith(blocks), NOW).workouts).toHaveLength(1)
  }

  it('rejects a segment whose name is not a string', () => {
    rejects([{ kind: 'segment', id: 's', name: { x: 1 }, role: 'work' }])
    rejects([{ kind: 'segment', id: 's', role: 'work' }])
  })

  it('rejects a durationMs that is not a finite non-negative number', () => {
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', durationMs: '60' }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', durationMs: -5 }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', durationMs: Infinity }])
    // Zero stays readable: compile() drops degenerate durations itself.
    accepts([{ kind: 'segment', id: 's', name: 'W', role: 'work', durationMs: 0 }])
    // Absent means self-paced, which is a real shape, not damage.
    accepts([{ kind: 'segment', id: 's', name: 'W', role: 'work' }])
  })

  it('rejects note, alternative and role that are not strings', () => {
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', note: 42 }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', alternative: {} }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: ['work'] }])
  })

  it('rejects a malformed reps shape and keeps the two real ones', () => {
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', reps: { kind: 'fixed', count: '10' } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', reps: { kind: 'fixed' } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', reps: { kind: 'rung', perSide: 'yes' } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', reps: 'ten' }])
    accepts([{ kind: 'segment', id: 's', name: 'W', role: 'work', reps: { kind: 'fixed', count: 10, perSide: true } }])
    accepts([{ kind: 'segment', id: 's', name: 'W', role: 'work', reps: { kind: 'rung' } }])
  })

  it('rejects media whose fields do not match its source', () => {
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', media: { source: 'local', hash: 'h' } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', media: { source: 'bundled', path: 9 } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', media: { source: 'remote', url: null } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', media: { source: 'dropbox', url: 'x' } }])
    rejects([{ kind: 'segment', id: 's', name: 'W', role: 'work', media: { source: 'bundled', path: 'p', w: '640' } }])
    accepts([{ kind: 'segment', id: 's', name: 'W', role: 'work', media: { source: 'local', hash: 'h', mime: 'image/webp' } }])
  })

  it('rejects a repeat whose times is not a finite number', () => {
    rejects([{ kind: 'repeat', id: 'r', times: '3', children: [] }])
    rejects([{ kind: 'repeat', id: 'r', times: 3, label: 7, children: [] }])
    accepts([{ kind: 'repeat', id: 'r', times: 3, label: 'Reps', children: [] }])
  })

  it('rejects a ladder whose counts are not all finite numbers', () => {
    rejects([{ kind: 'ladder', id: 'l', counts: [2, '4'], children: [] }])
    rejects([{ kind: 'ladder', id: 'l', counts: 'up', children: [] }])
    accepts([{ kind: 'ladder', id: 'l', counts: [2, 4, 6], children: [] }])
  })

  it('rejects a section without a real display mode', () => {
    rejects([{ kind: 'section', id: 'c', name: 'Warm-up', children: [] }])
    rejects([{ kind: 'section', id: 'c', name: 'Warm-up', display: 'grid', children: [] }])
    accepts([{ kind: 'section', id: 'c', name: 'Warm-up', display: 'list', children: [] }])
  })

  it('rejects an advance outside set and step, on any group', () => {
    rejects([{ kind: 'repeat', id: 'r', times: 2, advance: 'both', children: [] }])
    accepts([{ kind: 'repeat', id: 'r', times: 2, advance: 'step', children: [] }])
  })

  it('checks fields deep in the tree, not just at the top', () => {
    rejects([
      {
        kind: 'section',
        id: 'c',
        name: 'Main',
        display: 'list',
        children: [{ kind: 'segment', id: 's', name: 'W', role: 'work', durationMs: '60' }],
      },
    ])
  })

  it('rejects workout metadata of the wrong type when present', () => {
    const damaged = {
      kind: 'davshack-timer-bundle',
      version: 1,
      workouts: [{ id: 'x', name: 'Suspect', createdAt: 'yesterday', blocks: [] }],
    }
    expect(fromBundle(damaged, NOW).rejected).toEqual(['Suspect'])
  })
})

describe('the weights a backup carries', () => {
  it('rides along, and comes back', () => {
    /*
     * Most routines state no weight of their own now: they read the settings
     * page. A restore without these would put back every routine with the
     * numbers missing from all of them.
     */
    const bundle = toBundle([workout('Legs')], 1000, {}, { 'leg pres': '65kg' })
    expect(bundle.weights).toEqual({ 'leg pres': '65kg' })
    expect(fromBundle(JSON.parse(JSON.stringify(bundle)), 2000).weights).toEqual({
      'leg pres': '65kg',
    })
  })

  it('says nothing when there is nothing to say', () => {
    // A file with no weights has to look exactly like one written before the
    // field existed, or an older reader would see a field it cannot check.
    expect(toBundle([workout('Legs')], 1000)).not.toHaveProperty('weights')
  })

  it('reads a file that predates the field', () => {
    const old = { ...toBundle([workout('Legs')], 1000) }
    expect(fromBundle(old, 2000).weights).toEqual({})
  })

  it('does not let a damaged weights map cost you the routines', () => {
    const damaged = { ...toBundle([workout('Legs')], 1000), weights: { 'leg pres': 65 } }
    const contents = fromBundle(damaged, 2000)
    expect(contents.workouts).toHaveLength(1)
    expect(contents.weights).toEqual({})
  })

  it('drops an empty weight, which an older export wrote for a cleared one', () => {
    // Merged over the local table on import, that '' emptied a real number.
    const bundle = toBundle([workout('Legs')], 1000, {}, { 'leg press': '', 'seated row': '40kg' })
    expect(fromBundle(JSON.parse(JSON.stringify(bundle)), 2000).weights).toEqual({ 'seated row': '40kg' })
  })
})

describe('the exercise pictures a backup carries', () => {
  const photo = { source: 'local' as const, hash: 'abc', mime: 'image/webp' }

  it('rides along, and comes back', () => {
    /*
     * The page's own photos belong to no step, so nothing else in the file
     * carries them, and a restore without them would put back a page of empty
     * frames. Their BYTES ride in `media` beside a step's, keyed by the same
     * content hash, so one used in both places travels once.
     */
    const bundle = toBundle([workout('Legs')], 1000, {}, {}, { squat: photo })
    expect(bundle.pictures).toEqual({ squat: photo })
    expect(fromBundle(JSON.parse(JSON.stringify(bundle)), 2000).pictures).toEqual({ squat: photo })
  })

  it('says nothing when there is nothing to say', () => {
    expect(toBundle([workout('Legs')], 1000)).not.toHaveProperty('pictures')
  })

  it('reads a file that predates the field', () => {
    expect(fromBundle({ ...toBundle([workout('Legs')], 1000) }, 2000).pictures).toEqual({})
  })

  it('drops an entry that is not a media ref, and keeps the routines', () => {
    // Same guard a step's own media gets: whatever passes here is stored and
    // then rendered on every run.
    const damaged = {
      ...toBundle([workout('Legs')], 1000),
      pictures: { squat: { source: 'local' }, plank: photo },
    }
    const contents = fromBundle(damaged, 2000)

    expect(contents.workouts).toHaveLength(1)
    expect(contents.pictures).toEqual({ plank: photo })
  })
})
