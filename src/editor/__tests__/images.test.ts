import { describe, expect, it } from 'vitest'
import type { Block, Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { SEED_ROUTINES } from '../../routines/samples'
import { IMPORTED_ROUTINES } from '../../routines/__tests__/fixtures'
import { IMAGE_CATALOGUE } from '../../routines/imageCatalogue'
import { collectImages, labelFromUrl, refFor } from '../images'

const seg = (name: string, url?: string): Block => ({
  kind: 'segment',
  id: `${name}-${url ?? 'none'}`,
  name,
  durationMs: 20_000,
  role: 'work',
  ...(url ? { media: { source: 'remote' as const, url } } : {}),
})

const routine = (name: string, blocks: Block[]): Workout => ({
  id: name,
  name,
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

/** A step carrying a bundled image, the kind the catalogue holds now. */
const bundled = (name: string, path: string): Block => ({
  kind: 'segment',
  id: `${name}-${path}`,
  name,
  durationMs: 20_000,
  role: 'work',
  media: { source: 'bundled', path },
})

const A = 'https://i.postimg.cc/aaa/Leg-Press.png'
const B = 'https://i.postimg.cc/bbb/Cycling.png'

describe('collectImages', () => {
  it('returns nothing for a library with no images', () => {
    expect(collectImages([])).toEqual([])
    expect(collectImages([routine('R', [seg('Squat')])])).toEqual([])
  })

  it('dedupes a url used many times and counts the uses', () => {
    const images = collectImages([
      routine('One', [seg('Leg Press', A), seg('Leg Press', A)]),
      routine('Two', [seg('Leg Press', A)]),
    ])
    expect(images).toEqual([
      { id: A, ref: { source: 'remote', url: A }, src: A, label: 'Leg Press', uses: 3 },
    ])
  })

  it('finds images inside repeat groups, at any depth', () => {
    const nested: Block[] = [
      {
        kind: 'repeat',
        id: 'r1',
        times: 3,
        children: [
          { kind: 'repeat', id: 'r2', times: 2, children: [seg('Cycling', B)] },
          seg('Leg Press', A),
        ],
      },
    ]
    expect(collectImages([routine('R', nested)]).map((i) => i.label)).toEqual([
      'Cycling',
      'Leg Press',
    ])
  })

  it('labels a url with the step name it appears under most often', () => {
    const images = collectImages([
      routine('R', [seg('Leg Press', A), seg('Leg Press', A), seg('Legs', A)]),
    ])
    expect(images[0]!.label).toBe('Leg Press')
  })

  it('breaks a label tie alphabetically, so the result is stable', () => {
    const images = collectImages([routine('R', [seg('Zebra', A), seg('Apple', A)])])
    expect(images[0]!.label).toBe('Apple')
  })

  it('sorts by label, ignoring case', () => {
    const images = collectImages([
      routine('R', [seg('cycling', B), seg('Bench', A), seg('Ab crunch', 'https://x/c.png')]),
    ])
    expect(images.map((i) => i.label)).toEqual(['Ab crunch', 'Bench', 'cycling'])
  })

  it('ignores media that is not a remote url', () => {
    const local: Block = {
      kind: 'segment',
      id: 's',
      name: 'Own photo',
      durationMs: 20_000,
      role: 'work',
      media: { source: 'local', hash: 'abc', mime: 'image/webp' },
    }
    expect(collectImages([routine('R', [local])])).toEqual([])
  })

  it('finds every image across real routines, counting shared uses', () => {
    // Run against the imported fixtures rather than the seed: three routines share
    // illustrations, which is what makes `uses > 1` meaningful. Only one routine
    // ships now, and each of its exercises appears once.
    const images = collectImages(IMPORTED_ROUTINES)
    expect(images.length).toBeGreaterThan(10)
    expect(images.every((i) => i.id.startsWith('https://i.postimg.cc/'))).toBe(true)
    expect(images.some((i) => i.uses > 1)).toBe(true)
    // Sorted and unique.
    expect(new Set(images.map((i) => i.id)).size).toBe(images.length)
  })

  it('reaches images nested inside a seeded routine\'s reps groups', () => {
    // The seed's exercises live inside Reps groups, so a collector that only
    // walked top-level blocks would find nothing at all here.
    const images = collectImages(SEED_ROUTINES)
    expect(images.length).toBeGreaterThan(5)
    // The seed ships bundled paths since the rehosting, not links.
    expect(images.every((i) => i.id.startsWith('exercises/'))).toBe(true)
  })
})

describe('labelFromUrl', () => {
  it('turns a filename into an exercise name', () => {
    expect(labelFromUrl('https://i.postimg.cc/abc/Cable-Fly.png')).toBe('Cable Fly')
    expect(labelFromUrl('https://i.postimg.cc/abc/Standard-Chest-Press.png')).toBe(
      'Standard Chest Press',
    )
  })

  it('handles other extensions and separators', () => {
    expect(labelFromUrl('https://i.postimg.cc/x/horizon-5-0-r-recumbent-bike.jpg')).toBe(
      'horizon 5 0 r recumbent bike',
    )
    expect(labelFromUrl('https://x/Seated_Row.webp')).toBe('Seated Row')
  })

  it('ignores a query string', () => {
    expect(labelFromUrl('https://x/Leg-Press.png?v=2')).toBe('Leg Press')
  })

  it('falls back rather than returning empty', () => {
    expect(labelFromUrl('https://x/')).toBe('Untitled')
    expect(labelFromUrl('')).toBe('Untitled')
  })
})

describe('collectImages with the catalogue', () => {
  it('offers every catalogue image, even ones no routine uses', () => {
    const images = collectImages([], IMAGE_CATALOGUE)
    expect(images).toHaveLength(IMAGE_CATALOGUE.length)
    expect(images.every((i) => i.uses === 0)).toBe(true)
  })

  it('keeps the catalogue label even when a routine uses it under another name', () => {
    // "Cycling" describes the picture better than the step name "Warm Up" does.
    const cycling = 'exercises/Cycling.jpg'
    const images = collectImages([routine('R', [bundled('Warm Up', cycling)])], IMAGE_CATALOGUE)
    expect(images.find((i) => i.id === cycling)).toEqual({
      id: cycling,
      ref: { source: 'bundled', path: cycling },
      src: `/${cycling}`,
      label: 'Cycling',
      uses: 1,
    })
  })

  it('still includes an image a routine uses that is not in the catalogue', () => {
    const odd = 'https://example.com/My-Own-Photo.png'
    const images = collectImages([routine('R', [seg('Squat', odd)])], IMAGE_CATALOGUE)
    expect(images).toHaveLength(IMAGE_CATALOGUE.length + 1)
    expect(images.find((i) => i.id === odd)).toMatchObject({ label: 'Squat', uses: 1 })
  })

  it('counts uses across the real routines against the catalogue', () => {
    const images = collectImages(SEED_ROUTINES, IMAGE_CATALOGUE)
    const used = images.filter((i) => i.uses > 0)
    expect(used.length).toBeGreaterThan(8)
    // No duplicates, and every entry has a label.
    expect(new Set(images.map((i) => i.id)).size).toBe(images.length)
    expect(images.every((i) => i.label.length > 0)).toBe(true)
  })

  it('orders duplicate labels stably by url', () => {
    /*
     * Fed synthetic duplicates rather than the catalogue. This used to rely on the
     * catalogue holding two Tricep Presses and two Standing Arm Curls, which were
     * re-uploads of the same photographs and have since been removed, so the
     * behaviour needs its own input, or it silently stops being tested. It still
     * matters: a routine of Wayne's can reference two ids with the same filename.
     */
    const same = [
      'https://i.postimg.cc/BBBBBBBB/Tricep-Press.png',
      'https://i.postimg.cc/AAAAAAAA/Tricep-Press.png',
    ]
    const images = collectImages([], same)
    expect(images.map((i) => i.id)).toEqual([
      'https://i.postimg.cc/AAAAAAAA/Tricep-Press.png',
      'https://i.postimg.cc/BBBBBBBB/Tricep-Press.png',
    ])
  })

  it('now has no duplicate labels in the catalogue itself', () => {
    const labels = collectImages([], IMAGE_CATALOGUE).map((i) => i.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    )
  })
})

describe('bundled images, since the catalogue ships with the app', () => {
  it('reads a path as bundled and a URL as remote', () => {
    expect(refFor('exercises/Cable-Fly.jpg')).toEqual({
      source: 'bundled',
      path: 'exercises/Cable-Fly.jpg',
    })
    expect(refFor('https://i.postimg.cc/x/Cable-Fly.png')).toEqual({
      source: 'remote',
      url: 'https://i.postimg.cc/x/Cable-Fly.png',
    })
  })

  it('stores a path but renders through the base, so a subpath host works', () => {
    /*
     * The distinction the picker depends on: `ref` is what a step keeps and `src`
     * is where the thumbnail loads from. Baking the base into the ref would pin
     * the routine to one host, which is the whole reason the catalogue holds
     * paths.
     */
    const [image] = collectImages([], ['exercises/Knee-Raise.jpg'], '/exercise-timer/')
    expect(image).toEqual({
      id: 'exercises/Knee-Raise.jpg',
      ref: { source: 'bundled', path: 'exercises/Knee-Raise.jpg' },
      src: '/exercise-timer/exercises/Knee-Raise.jpg',
      label: 'Knee Raise',
      uses: 0,
    })
  })

  it('counts a bundled image a routine uses against its catalogue entry', () => {
    // One entry, not two: the same picture found twice under different sources
    // would show up twice in the picker.
    const images = collectImages(
      [routine('R', [bundled('Squat', 'exercises/Leg-Press.jpg')])],
      ['exercises/Leg-Press.jpg'],
    )
    expect(images).toHaveLength(1)
    expect(images[0]!.uses).toBe(1)
  })

  it('labels every catalogue entry from its filename', () => {
    const images = collectImages([], IMAGE_CATALOGUE)
    expect(images).toHaveLength(IMAGE_CATALOGUE.length)
    expect(images.every((i) => i.ref.source === 'bundled')).toBe(true)
    expect(images.map((i) => i.label)).toContain('Seated Abdominal Crunch')
  })
})
