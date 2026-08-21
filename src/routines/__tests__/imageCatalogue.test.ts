import { describe, expect, it } from 'vitest'
import { IMAGE_CATALOGUE } from '../imageCatalogue'

/**
 * The catalogue is hand-maintained from a vault note, and the note itself holds
 * duplicates: it listed the same Tricep Press and the same Standing Arm Curl
 * twice, under different postimages ids. Nothing about a URL reveals that, which
 * is why two duplicates sat in the picker until someone noticed them visually.
 *
 * These guards catch a repeat on the next paste rather than on the next glance.
 */
describe('IMAGE_CATALOGUE', () => {
  it('offers no image twice', () => {
    expect(new Set(IMAGE_CATALOGUE).size).toBe(IMAGE_CATALOGUE.length)
  })

  it('offers no filename twice, since the label comes from the filename', () => {
    // Two entries with the same filename are indistinguishable in the picker,
    // whether or not the ids differ.
    const names = IMAGE_CATALOGUE.map((url) => url.slice(url.lastIndexOf('/') + 1))
    const seen = new Set<string>()
    const repeated = names.filter((name) => !seen.add(name))
    expect(repeated).toEqual([])
  })

  it('holds the 27 distinct images from the note', () => {
    expect(IMAGE_CATALOGUE).toHaveLength(27)
  })
})
