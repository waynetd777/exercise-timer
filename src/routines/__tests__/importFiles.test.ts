/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import general from './emails/2026-07-20-general.txt?raw'
import { compile, SCHEMA_VERSION } from '../../engine'
import { toBundle } from '../../storage/bundle'
import { importRoutineFiles, looksImportable } from '../importFiles'
import { parseRoutine } from '../pasteFormat'

const NOW = 1_700_000_000_000

function file(name: string, body: string, type = 'text/plain'): File {
  return new File([body], name, { type })
}

const pastedWorkout = () => ({
  id: 'p1',
  name: 'Pasted',
  blocks: parseRoutine(general).blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

describe('importing a plain-text routine', () => {
  it('reads one, and names it after the file', async () => {
    const { imported, failed } = await importRoutineFiles(
      [file('Strength training 2026-07-20.txt', general)],
      NOW,
    )

    expect(failed).toEqual([])
    expect(imported).toHaveLength(1)
    expect(imported[0]!.name).toBe('Strength training 2026-07-20')
    expect(compile(imported[0]!).entries.length).toBeGreaterThan(100)
  })

  it('offers text files to the picker', () => {
    expect(looksImportable(file('routine.txt', ''))).toBe(true)
    expect(looksImportable(file('routine.md', ''))).toBe(true)
    expect(looksImportable(file('photo.png', '', 'image/png'))).toBe(false)
  })

  it('reports a file with no routine in it rather than adding an empty one', async () => {
    const { imported, failed } = await importRoutineFiles(
      [file('notes.txt', 'shopping list\nmilk\nbread')],
      NOW,
    )

    expect(imported).toEqual([])
    expect(failed[0]?.name).toBe('notes.txt')
  })

  it('still loses nothing else in the drop when one file is unreadable', async () => {
    const { imported, failed } = await importRoutineFiles(
      [file('empty.txt', ''), file('real.txt', general)],
      NOW,
    )

    expect(imported).toHaveLength(1)
    expect(failed).toHaveLength(1)
  })
})

describe('exporting and re-importing a pasted routine', () => {
  it('round-trips it, sections and ladders intact', async () => {
    /*
     * The bug this pins: `isBlock` was a whitelist of segment and repeat, so a
     * pasted routine exported perfectly and was silently filtered out on the way
     * back in. A backup that restores nothing is worse than one that fails.
     */
    const bundle = toBundle([pastedWorkout()], NOW)
    const json = JSON.stringify(bundle)
    const { imported, failed } = await importRoutineFiles(
      [file('library.json', json, 'application/json')],
      NOW,
    )

    expect(failed).toEqual([])
    expect(imported).toHaveLength(1)

    const before = compile(pastedWorkout())
    const after = compile(imported[0]!)
    expect(after.entries.length).toBe(before.entries.length)
    expect(after.runs.length).toBe(before.runs.length)
    expect(imported[0]!.blocks.filter((block) => block.kind === 'section')).toHaveLength(8)
  })
})

describe('importing a .tabata file', () => {
  /*
   * The real ones, which is the point: all three carry their illustrations as
   * postimages URLs, and those are the pictures the app ships now. An import that
   * kept the links would go to the network for an image already on the device.
   */
  const FIXTURES = Object.entries(
    import.meta.glob('../*.tabata.json', { eager: true, import: 'default' }),
  ) as [string, unknown][]

  const mediaOf = (workout: { blocks: unknown[] }): { source: string }[] => {
    const walk = (blocks: any[]): { source: string }[] =>
      blocks.flatMap((b) => (b.kind === 'segment' ? (b.media ? [b.media] : []) : walk(b.children)))
    return walk(workout.blocks as any[])
  }

  it('has fixtures that actually carry images', () => {
    // Guards the guard: if the fixtures lose their urls, the test below passes
    // for the wrong reason.
    expect(FIXTURES.length).toBeGreaterThan(0)
    for (const [name, json] of FIXTURES) {
      const urls = (json as { workout: { intervals: { url?: string }[] } }).workout.intervals
        .map((i) => i.url)
        .filter(Boolean)
      expect(urls.length, name).toBeGreaterThan(5)
    }
  })

  it('rehosts every image on the way in', async () => {
    for (const [path, json] of FIXTURES) {
      const { imported, failed } = await importRoutineFiles(
        [file(path.split('/').pop()!, JSON.stringify(json), 'application/json')],
        NOW,
      )
      expect(failed, path).toEqual([])
      const media = mediaOf(imported[0]! as { blocks: unknown[] })
      expect(media.length, path).toBeGreaterThan(5)
      expect(
        media.filter((m) => m.source !== 'bundled'),
        `${path} still points somewhere else`,
      ).toEqual([])
    }
  })
})

describe('what a lossy import must say out loud', () => {
  it('reports the lines a text file lost, instead of a quietly smaller routine', async () => {
    const body = [
      'Warm-up:',
      '* Arm Circles - 30 seconds',
      'Breathe like a dragon between the moves',
      '* Toe Touches - 30 seconds',
    ].join('\n')

    const { imported, skippedLines } = await importRoutineFiles([file('bands.txt', body)], NOW)

    expect(imported).toHaveLength(1)
    expect(skippedLines).toHaveLength(1)
    expect(skippedLines[0]!.file).toBe('bands.txt')
    expect(skippedLines[0]!.lines.length).toBeGreaterThan(0)
  })

  it('reports nothing when every line parsed', async () => {
    const { skippedLines } = await importRoutineFiles(
      [file('Strength training.txt', general)],
      NOW,
    )
    expect(skippedLines).toEqual([])
  })
})
