import { describe, expect, it } from 'vitest'
import type { Block, Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { liveHashes, orphanedHashes } from '../gc'
import { sha256 } from '../hash'
import { resolvePlan } from '../resolve'

const routine = (name: string, blocks: Block[]): Workout => ({
  id: name,
  name,
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

const local = (hash: string): Block => ({
  kind: 'segment',
  id: `l-${hash}`,
  name: 'Own photo',
  durationMs: 20_000,
  role: 'work',
  media: { source: 'local', hash, mime: 'image/webp' },
})

const pinned = (url: string, cachedHash: string): Block => ({
  kind: 'segment',
  id: `p-${cachedHash}`,
  name: 'Pinned',
  durationMs: 20_000,
  role: 'work',
  media: { source: 'remote', url, cachedHash },
})

describe('sha256', () => {
  it('hashes identical content to the same value, whatever the file was called', async () => {
    const a = new Blob(['same bytes'], { type: 'image/webp' })
    const b = new Blob(['same bytes'], { type: 'image/png' })
    expect(await sha256(a)).toBe(await sha256(b))
  })

  it('hashes different content differently', async () => {
    expect(await sha256(new Blob(['a']))).not.toBe(await sha256(new Blob(['b'])))
  })

  it('returns 64 lowercase hex characters', async () => {
    expect(await sha256(new Blob(['x']))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches the known digest for a known input', async () => {
    // sha256("abc"), so a future refactor cannot silently change the algorithm.
    expect(await sha256(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('liveHashes', () => {
  it('finds local blobs and pinned remote copies', () => {
    const live = liveHashes([routine('R', [local('aaa'), pinned('https://x/y.png', 'bbb')])])
    expect([...live].sort()).toEqual(['aaa', 'bbb'])
  })

  it('looks inside repeat groups', () => {
    const nested: Block[] = [
      { kind: 'repeat', id: 'r', times: 2, children: [local('deep')] },
    ]
    expect(liveHashes([routine('R', nested)]).has('deep')).toBe(true)
  })

  it('ignores an unpinned remote image — it owns no blob', () => {
    const unpinned: Block = {
      kind: 'segment',
      id: 's',
      name: 'Link only',
      durationMs: 20_000,
      role: 'work',
      media: { source: 'remote', url: 'https://x/y.png' },
    }
    expect(liveHashes([routine('R', [unpinned])]).size).toBe(0)
  })

  it('is empty for a library with no images', () => {
    expect(liveHashes([]).size).toBe(0)
  })
})

describe('orphanedHashes', () => {
  it('keeps a blob another routine still uses', () => {
    // The whole reason this is set arithmetic over the WHOLE library: deleting
    // one routine must not delete an image a surviving one points at.
    const remaining = [routine('Keeper', [local('shared')])]
    expect(orphanedHashes(['shared'], remaining)).toEqual([])
  })

  it('reports a blob nothing references any more', () => {
    expect(orphanedHashes(['shared', 'gone'], [routine('Keeper', [local('shared')])])).toEqual([
      'gone',
    ])
  })

  it('reports everything when the library is empty', () => {
    expect(orphanedHashes(['a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('treats a pinned copy as owned, so unpinning frees it', () => {
    const withPin = [routine('R', [pinned('https://x/y.png', 'pin')])]
    expect(orphanedHashes(['pin'], withPin)).toEqual([])

    const withoutPin = [
      routine('R', [
        {
          kind: 'segment',
          id: 's',
          name: 'Unpinned',
          durationMs: 20_000,
          role: 'work',
          media: { source: 'remote', url: 'https://x/y.png' },
        },
      ]),
    ]
    expect(orphanedHashes(['pin'], withoutPin)).toEqual(['pin'])
  })
})

describe('resolvePlan', () => {
  const has = (...hashes: string[]) => (hash: string) => hashes.includes(hash)
  const BASE = '/exercise-timer/'

  it('resolves nothing for a step with no image', () => {
    expect(resolvePlan(undefined, has(), BASE)).toEqual({ kind: 'none' })
  })

  it('serves a remote image from its url when it is not pinned', () => {
    expect(resolvePlan({ source: 'remote', url: 'https://x/y.png' }, has(), BASE)).toEqual({
      kind: 'url',
      url: 'https://x/y.png',
    })
  })

  it('prefers the local copy of a pinned image — that is the point of pinning', () => {
    expect(
      resolvePlan({ source: 'remote', url: 'https://x/y.png', cachedHash: 'h' }, has('h'), BASE),
    ).toEqual({ kind: 'blob', hash: 'h' })
  })

  it('falls back to the network if a pinned blob has been evicted', () => {
    expect(
      resolvePlan({ source: 'remote', url: 'https://x/y.png', cachedHash: 'h' }, has(), BASE),
    ).toEqual({ kind: 'url', url: 'https://x/y.png' })
  })

  it('serves a local image from its blob, or nothing if it is gone', () => {
    const ref = { source: 'local' as const, hash: 'h', mime: 'image/webp' }
    expect(resolvePlan(ref, has('h'), BASE)).toEqual({ kind: 'blob', hash: 'h' })
    // No network fallback exists for a local image — better nothing than a
    // broken image icon.
    expect(resolvePlan(ref, has(), BASE)).toEqual({ kind: 'none' })
  })

  it('resolves a bundled image against the deploy base, not a hardcoded slash', () => {
    expect(resolvePlan({ source: 'bundled', path: 'exercises/x.webp' }, has(), BASE)).toEqual({
      kind: 'url',
      url: '/exercise-timer/exercises/x.webp',
    })
  })
})
