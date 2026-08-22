import { describe, expect, it } from 'vitest'
import type { Block, Section, Segment, Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { blobToDataUrl, dataUrlToBlob, MAX_IMAGE_BYTES } from '../../media/dataUrl'
import { sha256 } from '../../media/hash'
import { collectMedia, restoreMedia } from '../bundleMedia'

const photo = (bytes: number, fill = 7): Blob =>
  new Blob([new Uint8Array(bytes).fill(fill)], { type: 'image/webp' })

const step = (name: string, media?: Segment['media']): Segment => ({
  kind: 'segment',
  id: `id-${name}`,
  name,
  role: 'work',
  durationMs: 20_000,
  ...(media ? { media } : {}),
})

const workout = (blocks: Block[]): Workout => ({
  id: 'w',
  name: 'W',
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

const section = (children: Block[]): Section => ({
  kind: 'section',
  id: 'sec',
  name: 'Upper body',
  display: 'list',
  children,
})

describe('data URLs', () => {
  it('round-trips a blob, type included', async () => {
    const before = photo(1024)
    const after = dataUrlToBlob(await blobToDataUrl(before))!

    expect(after.type).toBe('image/webp')
    expect(after.size).toBe(before.size)
    expect(new Uint8Array(await after.arrayBuffer())).toEqual(
      new Uint8Array(await before.arrayBuffer()),
    )
  })

  it('survives a photo-sized blob', async () => {
    /*
     * The chunking exists for this: one `fromCharCode(...bytes)` over a hundred
     * thousand bytes overflows the call stack, and it does it at the size real
     * photos arrive in rather than in a small test.
     */
    const big = photo(300_000, 200)
    const back = dataUrlToBlob(await blobToDataUrl(big))!
    expect(back.size).toBe(300_000)
  })

  it('refuses anything that is not a base64 data URL', () => {
    expect(dataUrlToBlob('https://example.com/photo.jpg')).toBeNull()
    expect(dataUrlToBlob('data:image/webp,not-base64-at-all')).toBeNull()
    expect(dataUrlToBlob('')).toBeNull()
  })

  it('refuses one that decodes to more than the cap', async () => {
    const huge = await blobToDataUrl(photo(MAX_IMAGE_BYTES + 1_000))
    expect(dataUrlToBlob(huge)).toBeNull()
  })
})

describe('collectMedia: what an export carries', () => {
  it('takes uploaded photos and nothing else', async () => {
    const blob = photo(64)
    const hash = await sha256(blob)
    const routines = [
      workout([
        step('Curls', { source: 'local', hash, mime: 'image/webp' }),
        step('Press', { source: 'bundled', path: 'exercises/Cable-Fly.jpg' }),
        step('Rows', { source: 'remote', url: 'https://example.com/x.png' }),
        step('Plank'),
      ]),
    ]

    const media = await collectMedia(routines, async () => blob)
    // A bundled illustration is a path the other side already has, and a pinned
    // copy of a link is a cache rather than the original.
    expect(Object.keys(media)).toEqual([hash])
    expect(media[hash]).toMatch(/^data:image\/webp;base64,/)
  })

  it('reaches a photo nested inside a section', async () => {
    const blob = photo(32)
    const hash = await sha256(blob)
    const media = await collectMedia(
      [workout([section([step('Curls', { source: 'local', hash, mime: 'image/webp' })])])],
      async () => blob,
    )
    expect(Object.keys(media)).toEqual([hash])
  })

  it('carries one copy when two routines share a photo', async () => {
    const blob = photo(48)
    const hash = await sha256(blob)
    const one = workout([step('A', { source: 'local', hash, mime: 'image/webp' })])
    const two = { ...workout([step('B', { source: 'local', hash, mime: 'image/webp' })]), id: 'w2' }

    expect(Object.keys(await collectMedia([one, two], async () => blob))).toEqual([hash])
  })

  it('skips a photo whose bytes have gone, rather than failing the export', async () => {
    const media = await collectMedia(
      [workout([step('Curls', { source: 'local', hash: 'missing', mime: 'image/webp' })])],
      async () => undefined,
    )
    expect(media).toEqual({})
  })
})

describe('restoreMedia: what an import will trust', () => {
  it('accepts an entry whose contents match its key', async () => {
    const blob = photo(96)
    const hash = await sha256(blob)
    const report = await restoreMedia({ [hash]: await blobToDataUrl(blob) })

    expect(report.skipped).toEqual([])
    expect(report.entries).toHaveLength(1)
    expect(report.entries[0]!.hash).toBe(hash)
    expect(report.entries[0]!.blob.size).toBe(96)
  })

  it('refuses an entry filed under the wrong hash', async () => {
    /*
     * The invariant the whole media store rests on. Storage is content-addressed,
     * so a key that lies would poison every routine that shares the hash, and
     * re-hashing a file just read off disk costs a millisecond.
     */
    const report = await restoreMedia({ ['0'.repeat(64)]: await blobToDataUrl(photo(16)) })

    expect(report.entries).toEqual([])
    expect(report.skipped).toEqual([
      { hash: '0'.repeat(64), reason: 'contents do not match the hash' },
    ])
  })

  it('keeps the good entries when one is bad', async () => {
    const good = photo(24, 3)
    const hash = await sha256(good)
    const report = await restoreMedia({
      [hash]: await blobToDataUrl(good),
      bad: 'https://example.com/not-a-data-url.png',
      worse: 42,
    })

    expect(report.entries.map((e) => e.hash)).toEqual([hash])
    expect(report.skipped.map((s) => s.hash).sort()).toEqual(['bad', 'worse'])
  })

  it('is empty for a bundle with no media, whatever shape it is', async () => {
    for (const value of [undefined, null, {}, 'nope', 7]) {
      expect((await restoreMedia(value)).entries).toEqual([])
    }
  })
})
