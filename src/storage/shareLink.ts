/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { isWorkout } from './bundle'
import { migrateWorkout } from './migrate'

/**
 * A routine encoded into a URL.
 *
 * Gzipped and base64url'd, because the raw JSON of a real routine is tens of
 * kilobytes and would not survive being pasted into a message. Local image blobs
 * are dropped, since a link cannot carry them, but remote and bundled images are
 * already just strings inside the routine, so a routine built from postimages
 * links shares completely.
 */
const PARAM = 'r'

function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function gzip(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** Strips anything a link cannot carry, and reports what was left behind. */
export function shareable(workout: Workout): { workout: Workout; droppedImages: number } {
  let dropped = 0

  const strip = (blocks: readonly Block[]): Block[] =>
    blocks.map((block) => {
      if (block.kind !== 'segment') return { ...block, children: strip(block.children) }
      if (block.media?.source !== 'local') return block
      dropped += 1
      const next = { ...block }
      delete next.media
      return next
    })

  return { workout: { ...workout, blocks: strip(workout.blocks) }, droppedImages: dropped }
}

export async function encodeRoutine(workout: Workout): Promise<string> {
  const { workout: safe } = shareable(workout)
  // Metadata a recipient should not inherit: it is their routine now.
  const { id: _id, lastRunAt: _lastRunAt, favourite: _favourite, ...rest } = safe
  return toBase64Url(await gzip(JSON.stringify(rest)))
}

export async function decodeRoutine(param: string, now: number, id: string): Promise<Workout> {
  const parsed: unknown = JSON.parse(await gunzip(fromBase64Url(param)))
  if (typeof parsed !== 'object' || parsed === null) throw new Error('not a routine')

  const workout = parsed as Partial<Workout>
  // The same version gate the bundle path has: a link made by a newer app can
  // carry a block kind this one would misread, so refuse it rather than guess.
  if (typeof workout.schemaVersion === 'number' && workout.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`made by a newer version (${workout.schemaVersion})`)
  }
  // And the same field validation bundles get. A link is as hand-editable as a
  // file: a string durationMs would import silently and count down from NaN.
  // The whole routine, not just the blocks: this used to spread `...workout`
  // into the store unchecked, so a crafted link arrived pre-starred, with a
  // made-up last run, and carrying any key it liked.
  const candidate = { ...workout, id }
  if (!isWorkout(candidate)) throw new Error('not a routine')

  // Built from named fields, so only what a routine is made of comes through.
  // Migrated like the other two entry points. A link shared before a rename
  // should not arrive speaking the old vocabulary.
  return migrateWorkout({
    id,
    name: candidate.name,
    blocks: candidate.blocks,
    ...(candidate.colour !== undefined ? { colour: candidate.colour } : {}),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  })
}

export async function shareUrl(workout: Workout, base: string): Promise<string> {
  return `${base}#${PARAM}=${await encodeRoutine(workout)}`
}

/** Reads a share payload out of a URL fragment, or null if there is none. */
export function routineParam(hash: string): string | null {
  const match = new RegExp(`(?:^#?|&)${PARAM}=([A-Za-z0-9\\-_]+)`).exec(hash)
  return match?.[1] ?? null
}
