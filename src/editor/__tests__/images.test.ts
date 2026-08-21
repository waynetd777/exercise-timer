import { describe, expect, it } from 'vitest'
import type { Block, Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { SEED_ROUTINES } from '../../routines/samples'
import { IMAGE_CATALOGUE } from '../../routines/imageCatalogue'
import { collectImages, labelFromUrl } from '../images'

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
    expect(images).toEqual([{ url: A, label: 'Leg Press', uses: 3 }])
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

  it('finds every image in the real seeded routines', () => {
    // The three imported routines share illustrations, so the distinct count is
    // well below the total number of steps that carry one.
    const images = collectImages(SEED_ROUTINES)
    expect(images.length).toBeGreaterThan(10)
    expect(images.every((i) => i.url.startsWith('https://i.postimg.cc/'))).toBe(true)
    expect(images.some((i) => i.uses > 1)).toBe(true)
    // Sorted and unique.
    expect(new Set(images.map((i) => i.url)).size).toBe(images.length)
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
    const cycling = 'https://i.postimg.cc/0yFGWd24/Cycling.png'
    const images = collectImages([routine('R', [seg('Warm Up', cycling)])], IMAGE_CATALOGUE)
    expect(images.find((i) => i.url === cycling)).toEqual({
      url: cycling,
      label: 'Cycling',
      uses: 1,
    })
  })

  it('still includes an image a routine uses that is not in the catalogue', () => {
    const odd = 'https://example.com/My-Own-Photo.png'
    const images = collectImages([routine('R', [seg('Squat', odd)])], IMAGE_CATALOGUE)
    expect(images).toHaveLength(IMAGE_CATALOGUE.length + 1)
    expect(images.find((i) => i.url === odd)).toMatchObject({ label: 'Squat', uses: 1 })
  })

  it('counts uses across the real routines against the catalogue', () => {
    const images = collectImages(SEED_ROUTINES, IMAGE_CATALOGUE)
    const used = images.filter((i) => i.uses > 0)
    expect(used.length).toBeGreaterThan(8)
    // No duplicates, and every entry has a label.
    expect(new Set(images.map((i) => i.url)).size).toBe(images.length)
    expect(images.every((i) => i.label.length > 0)).toBe(true)
  })

  it('orders duplicate labels stably by url', () => {
    // The catalogue holds two Tricep Press machines and two Standing Arm Curls.
    const images = collectImages([], IMAGE_CATALOGUE)
    const labels = images.map((i) => i.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })))
    expect(new Set(labels).size).toBeLessThan(labels.length)
  })
})
