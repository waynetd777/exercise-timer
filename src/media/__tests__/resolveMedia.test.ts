/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaRef } from '../../engine'

/**
 * The store is mocked with a live listener registry, because the behavior
 * under test is the seam itself: a cached miss must stop being true the moment
 * a blob lands.
 */
const blobs = new Map<string, Blob>()
const listeners = new Set<(hash: string) => void>()
/** Hashes whose read FAILS, as it does where site data is blocked. */
const failing = new Set<string>()

vi.mock('../store', () => ({
  getBlob: (hash: string) =>
    failing.has(hash) ? Promise.reject(new Error('closed')) : Promise.resolve(blobs.get(hash)),
  onBlobStored: (listener: (hash: string) => void) => {
    listeners.add(listener)
  },
}))

function storeBlob(hash: string, blob: Blob) {
  blobs.set(hash, blob)
  for (const listener of listeners) listener(hash)
}

const local = (hash: string): MediaRef => ({ source: 'local', hash, mime: 'image/webp' })

describe('resolveMedia: the negative cache', () => {
  beforeEach(() => {
    blobs.clear()
    // Patched onto the real URL rather than replacing it: the constructor must
    // keep working for everything else in the process.
    let urls = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:fake-${++urls}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('picks up a blob stored after a cached miss, without a reload', async () => {
    const { resolveMedia } = await import('../resolveMedia')

    // First look: the blob is absent (its image was dropped from an earlier
    // bundle) and the miss is cached.
    expect(await resolveMedia(local('h-late'), '/')).toBeNull()

    // A later import supplies the same hash. The cached miss must be forgotten,
    // or the image stays invisible until the next full reload.
    storeBlob('h-late', new Blob(['pixels']))
    expect(await resolveMedia(local('h-late'), '/')).toMatch(/^blob:/)
  })

  it('answers with what it can when a read fails, and does not remember the failure', async () => {
    /*
     * Two bugs. The rejection was cached in `known`, so one transient IndexedDB
     * failure kept a picture missing until a reload; and every caller caught it
     * itself, one of them replacing a linked image's perfectly good URL with
     * nothing.
     */
    const { resolveMedia } = await import('../resolveMedia')
    failing.add('h-fail')

    const linked: MediaRef = { source: 'remote', url: 'https://x/y.jpg', cachedHash: 'h-fail' }
    expect(await resolveMedia(linked, '/')).toBe('https://x/y.jpg')
    expect(await resolveMedia(local('h-fail'), '/')).toBeNull()

    // Storage is back, and nothing told `resolveMedia` so: the next read must try.
    failing.delete('h-fail')
    blobs.set('h-fail', new Blob(['pixels']))
    expect(await resolveMedia(local('h-fail'), '/')).toMatch(/^blob:/)
  })

  it('reads a stored blob at most once', async () => {
    const { resolveMedia } = await import('../resolveMedia')
    storeBlob('h-once', new Blob(['pixels']))

    const first = await resolveMedia(local('h-once'), '/')
    const second = await resolveMedia(local('h-once'), '/')
    expect(second).toBe(first)
  })

  it('forgets a deleted blob entirely', async () => {
    const { forgetBlob, resolveMedia } = await import('../resolveMedia')
    storeBlob('h-gone', new Blob(['pixels']))
    expect(await resolveMedia(local('h-gone'), '/')).toMatch(/^blob:/)

    blobs.delete('h-gone')
    forgetBlob('h-gone')
    expect(await resolveMedia(local('h-gone'), '/')).toBeNull()
  })
})

describe('resolveMedia: two callers at once', () => {
  beforeEach(() => {
    blobs.clear()
    let urls = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:fake-${++urls}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('gives both the URL, rather than the second a cached miss', async () => {
    // The negative cache was written before the read resolved, so the second
    // caller skipped the read and found no object URL, for good.
    vi.resetModules()
    const { resolveMedia } = await import('../resolveMedia')
    blobs.set('shared', new Blob(['x']))
    const [a, b] = await Promise.all([resolveMedia(local('shared'), '/'), resolveMedia(local('shared'), '/')])
    expect(a).toMatch(/^blob:/)
    expect(b).toBe(a)
  })
})
