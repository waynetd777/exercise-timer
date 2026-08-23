/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { IMAGE_CATALOGUE } from '../imageCatalogue'

/**
 * The catalogue came from a vault note, and the note itself held duplicates: it
 * listed the same Tricep Press and the same Standing Arm Curl twice, under
 * different postimages ids. Nothing about a URL revealed that, which is why two
 * duplicates sat in the picker until someone noticed them visually.
 *
 * The entries are paths that ship with the app now, so two of these guards can be
 * stronger than a duplicate check: every entry must name a file that exists, and
 * every file must be named by an entry.
 *
 * These guards catch a repeat on the next paste rather than on the next glance.
 */
describe('IMAGE_CATALOGUE', () => {
  it('offers no image twice', () => {
    expect(new Set(IMAGE_CATALOGUE).size).toBe(IMAGE_CATALOGUE.length)
  })

  it('offers no filename twice, since the label comes from the filename', () => {
    // Two entries with the same filename are indistinguishable in the picker,
    // whether or not the paths differ.
    const names = IMAGE_CATALOGUE.map((path) => path.slice(path.lastIndexOf('/') + 1))
    const seen = new Set<string>()
    const repeated = names.filter((name) => !seen.add(name))
    expect(repeated).toEqual([])
  })

  it('holds the 41 plates the guide illustrates, plus the two cardio photos', () => {
    expect(IMAGE_CATALOGUE).toHaveLength(43)
  })

  it('is all paths under public/, not links to somebody else', () => {
    // The rehosting: a link here would be a picture the app cannot promise.
    expect(IMAGE_CATALOGUE.every((entry) => entry.startsWith('exercises/'))).toBe(true)
  })

  /*
   * What is actually in `public/exercises`, resolved by Vite at transform time.
   *
   * `import.meta.glob` rather than `node:fs` because `src` is typechecked with
   * only `vite/client` types. Pulling Node's in so a test could read a directory
   * would let app code reach for `fs` by accident. The loaders are never called,
   * so nothing here ends up in a bundle.
   */
  const shipped = Object.keys(import.meta.glob('/public/exercises/*.jpg')).map(
    (path) => path.split('/').pop()!,
  )

  it('names a file that actually ships', () => {
    /*
     * The guard the old URL list could not have: an entry with a typo used to be
     * a broken image nobody noticed until the picker was scrolled. Now it is a
     * failing test, since the file has to be in `public/`.
     */
    const names = new Set(shipped)
    const missing = IMAGE_CATALOGUE.filter((path) => !names.has(path.split('/').pop()!))
    expect(missing).toEqual([])
  })

  it('ships nothing that is not offered', () => {
    // The other direction: a plate in public/ that no catalogue entry names is
    // 65KB of precache nobody can pick.
    const offered = new Set(IMAGE_CATALOGUE.map((path) => path.replace('exercises/', '')))
    expect(shipped.filter((file) => !offered.has(file))).toEqual([])
  })
})
