/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Workout } from '../../engine'
import { compile, SCHEMA_VERSION } from '../../engine'
import { IMPORTED_ROUTINES, MIXED_CARDIO_2 } from '../../routines/__tests__/fixtures'
import { decodeRoutine, encodeRoutine, routineParam, shareable, shareUrl } from '../shareLink'

const NOW = 1_700_000_000_000

const workout = (): Workout => ({
  id: 'w1',
  name: 'Leg day',
  blocks: [
    {
      kind: 'segment',
      id: 's1',
      name: 'Cable fly',
      durationMs: 20_000,
      role: 'work',
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    },
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
  favourite: true,
  lastRunAt: 5,
})

describe('share links', () => {
  it('round-trips a routine through a URL', async () => {
    const back = await decodeRoutine(await encodeRoutine(workout()), NOW, 'new-id')
    expect(back.name).toBe('Leg day')
    expect(compile(back)).toEqual(compile(workout()))
  })

  it('keeps remote images, since they are only strings', async () => {
    const back = await decodeRoutine(await encodeRoutine(workout()), NOW, 'new-id')
    expect(back.blocks[0]).toMatchObject({
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    })
  })

  it('gives the recipient a fresh identity, not the sender’s', async () => {
    // Their copy, their run history.
    const back = await decodeRoutine(await encodeRoutine(workout()), NOW, 'new-id')
    expect(back.id).toBe('new-id')
    expect(back.createdAt).toBe(NOW)
    expect(back).not.toHaveProperty('lastRunAt')
    expect(back.favourite).toBeUndefined()
  })

  it('compresses a real 86-step routine down to a pasteable size', async () => {
    const param = await encodeRoutine(MIXED_CARDIO_2)
    const raw = JSON.stringify(MIXED_CARDIO_2).length
    expect(param.length).toBeLessThan(raw / 4)
    // Comfortably inside any practical URL limit.
    expect(param.length).toBeLessThan(4000)
  })

  it('round-trips every real routine identically', async () => {
    for (const routine of IMPORTED_ROUTINES) {
      const back = await decodeRoutine(await encodeRoutine(routine), NOW, 'x')
      expect(compile(back).totalMs).toBe(compile(routine).totalMs)
      expect(compile(back).entries.length).toBe(compile(routine).entries.length)
    }
  })

  it('builds a url on the given base', async () => {
    const url = await shareUrl(workout(), 'https://example.com/timer/')
    expect(url.startsWith('https://example.com/timer/#r=')).toBe(true)
  })

  it('rejects a corrupt payload rather than importing nonsense', async () => {
    await expect(decodeRoutine('not-valid-gzip', NOW, 'x')).rejects.toThrow()
  })

  it('rejects a payload that decodes to something other than a routine', async () => {
    const notARoutine = await encodeRoutine({ ...workout(), name: 'x' })
    // Valid gzip, valid json, but the shape is checked too.
    const bad = notARoutine.slice(0, -4)
    await expect(decodeRoutine(bad, NOW, 'x')).rejects.toThrow()
  })
})

describe('shareable', () => {
  it('drops local images, which a link cannot carry, and counts them', () => {
    const withLocal: Workout = {
      ...workout(),
      blocks: [
        {
          kind: 'segment',
          id: 's1',
          name: 'Own photo',
          durationMs: 20_000,
          role: 'work',
          media: { source: 'local', hash: 'abc', mime: 'image/webp' },
        },
        {
          kind: 'repeat',
          id: 'r1',
          times: 2,
          children: [
            {
              kind: 'segment',
              id: 's2',
              name: 'Another',
              durationMs: 20_000,
              role: 'work',
              media: { source: 'local', hash: 'def', mime: 'image/webp' },
            },
          ],
        },
      ],
    }
    const { workout: safe, droppedImages } = shareable(withLocal)
    expect(droppedImages).toBe(2)
    expect(safe.blocks[0]).not.toHaveProperty('media')
    expect((safe.blocks[1] as { children: unknown[] }).children[0]).not.toHaveProperty('media')
  })

  it('reports nothing dropped when every image is a link', () => {
    expect(shareable(workout()).droppedImages).toBe(0)
  })

  it('does not mutate the routine it inspects', () => {
    const original = workout()
    shareable(original)
    expect(original.blocks[0]).toHaveProperty('media')
  })
})

describe('routineParam', () => {
  it('finds the payload in a fragment', () => {
    expect(routineParam('#r=abc123')).toBe('abc123')
    expect(routineParam('r=abc123')).toBe('abc123')
    expect(routineParam('#x=1&r=abc-_123')).toBe('abc-_123')
  })

  it('returns null when there is nothing to import', () => {
    for (const hash of ['', '#', '#other=1', '#rr=abc']) {
      expect(routineParam(hash)).toBeNull()
    }
  })
})

describe('decodeRoutine: what a hand-edited link cannot smuggle in', () => {
  /** Encodes anything, so the tests can craft links no honest app would make. */
  const encodeRaw = (value: unknown) => encodeRoutine(value as Workout)

  it('rejects a wrong-typed field instead of importing a NaN countdown', async () => {
    const tampered = {
      ...workout(),
      blocks: [{ kind: 'segment', id: 's1', name: 'Cable fly', durationMs: '20000' }],
    }
    await expect(decodeRoutine(await encodeRaw(tampered), NOW, 'new-id')).rejects.toThrow(
      'not a routine',
    )
  })

  it('rejects an unknown block kind instead of misreading it', async () => {
    const tampered = { ...workout(), blocks: [{ kind: 'mystery', id: 'x1', children: [] }] }
    await expect(decodeRoutine(await encodeRaw(tampered), NOW, 'new-id')).rejects.toThrow(
      'not a routine',
    )
  })

  it('refuses a link made by a newer app version rather than guessing', async () => {
    const future = { ...workout(), schemaVersion: SCHEMA_VERSION + 1 }
    await expect(decodeRoutine(await encodeRaw(future), NOW, 'new-id')).rejects.toThrow(
      'newer version',
    )
  })

  it('rejects garbage that is not a routine at all', async () => {
    await expect(decodeRoutine('!!not-base64!!', NOW, 'new-id')).rejects.toThrow()
  })
})
