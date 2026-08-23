/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import type { Block, Section, Segment, Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { IMAGE_CATALOGUE } from '../../routines/imageCatalogue'
import { migrateWorkout, REHOSTED } from '../migrate'

const workout = (blocks: Block[]): Workout => ({
  id: 'w',
  name: 'W',
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

const step = (name: string, media?: Segment['media']): Segment => ({
  kind: 'segment',
  id: `id-${name}`,
  name,
  role: 'work',
  durationMs: 20_000,
  ...(media ? { media } : {}),
})

const section = (children: Block[]): Section => ({
  kind: 'section',
  id: 'sec',
  name: 'Upper body',
  display: 'list',
  children,
})

const steps = (workout: Workout): Segment[] => {
  const walk = (blocks: readonly Block[]): Segment[] =>
    blocks.flatMap((b) => (b.kind === 'segment' ? [b] : walk(b.children)))
  return walk(workout.blocks)
}

const CABLE_FLY = 'https://i.postimg.cc/KvY7cdKk/Cable-Fly.png'

describe('rehosted illustrations', () => {
  it('turns an old postimages link into the image that ships with the app', () => {
    const migrated = migrateWorkout(workout([step('Cable Fly', { source: 'remote', url: CABLE_FLY })]))
    expect(steps(migrated)[0]!.media).toEqual({
      source: 'bundled',
      path: 'exercises/Cable-Fly.jpg',
    })
  })

  it('drops a pinned copy with the link', () => {
    // Not a loss: a bundled image is precached, so it needs no pin to work in a
    // gym with no signal.
    const migrated = migrateWorkout(
      workout([step('Cable Fly', { source: 'remote', url: CABLE_FLY, cachedHash: 'abc' })]),
    )
    expect(steps(migrated)[0]!.media).toEqual({
      source: 'bundled',
      path: 'exercises/Cable-Fly.jpg',
    })
  })

  it('covers the duplicate uploads and the renamed files', () => {
    /*
     * The catalogue briefly listed two Tricep Presses and two Standing Arm Curls,
     * and four filenames changed when the set was regenerated from the guide. A
     * routine saved in either era has to come back with its picture.
     */
    const cases: [string, string][] = [
      ['https://i.postimg.cc/Gt7J6VXr/Tricep-Press.png', 'exercises/Triceps-Press.jpg'],
      ['https://i.postimg.cc/RFNCzVxN/Standing-Arm-Curl.png', 'exercises/Standing-Arm-Curl.jpg'],
      ['https://i.postimg.cc/Znb8dQVQ/Seated-Ab-Crunch.png', 'exercises/Seated-Abdominal-Crunch.jpg'],
      ['https://i.postimg.cc/rphybRbB/Cable-Row.png', 'exercises/Seated-Cable-Row.jpg'],
      ['https://i.postimg.cc/xCSy08Hn/Tricep-Dip.png', 'exercises/Tricep-Dips.jpg'],
    ]
    for (const [url, path] of cases) {
      const migrated = migrateWorkout(workout([step('X', { source: 'remote', url })]))
      expect(steps(migrated)[0]!.media, url).toEqual({ source: 'bundled', path })
    }
  })

  it('reaches a step nested inside a section', () => {
    /*
     * The case that matters most: every pasted routine is sections, and this used
     * to return a section untouched without looking inside it.
     */
    const migrated = migrateWorkout(
      workout([section([step('Cable Fly', { source: 'remote', url: CABLE_FLY })])]),
    )
    expect(steps(migrated)[0]!.media).toEqual({
      source: 'bundled',
      path: 'exercises/Cable-Fly.jpg',
    })
  })

  it('leaves a link it does not know, and an uploaded photo, alone', () => {
    const own = { source: 'remote' as const, url: 'https://example.com/mine.png' }
    const local = { source: 'local' as const, hash: 'abc', mime: 'image/webp' }
    const migrated = migrateWorkout(workout([step('A', own), step('B', local)]))
    expect(steps(migrated)[0]!.media).toEqual(own)
    expect(steps(migrated)[1]!.media).toEqual(local)
  })

  it('returns the same object when there is nothing to fix', () => {
    // Identity matters: a new object every read would re-render the library.
    const before = workout([section([step('Plain')])])
    expect(migrateWorkout(before)).toBe(before)
  })

  it('still renames a legacy Round label, including inside a section', () => {
    const migrated = migrateWorkout(
      workout([
        section([{ kind: 'repeat', id: 'r', label: 'Round', times: 3, children: [step('A')] }]),
      ]),
    )
    const group = (migrated.blocks[0] as Section).children[0]
    expect(group).toMatchObject({ kind: 'repeat', label: 'Reps' })
  })

  it('maps only onto images the app actually offers', () => {
    // A typo in a path would be a silently broken image on someone's phone.
    const offered = new Set(IMAGE_CATALOGUE)
    expect(Object.values(REHOSTED).filter((path) => !offered.has(path))).toEqual([])
  })
})
