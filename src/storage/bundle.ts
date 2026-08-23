/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { migrateWorkout } from './migrate'

/**
 * The export format: a routine, or a whole library, as one JSON file.
 *
 * Versioned from the start so a future reader can tell what it is holding, and
 * the `media` map was declared before anything filled it, which is why adding
 * photos to an export needed no format change and no second migration.
 */
export const BUNDLE_VERSION = 1 as const

export type Bundle = {
  kind: 'davshack-timer-bundle'
  version: typeof BUNDLE_VERSION
  exportedAt: number
  workouts: Workout[]
  /**
   * Uploaded photos, keyed by content hash, as data URLs. See
   * `bundleMedia.ts`. A bundled illustration needs nothing here, since it is a
   * short path and the app on the other side already has the picture; an
   * uploaded photo has to carry its bytes or it does not travel at all.
   */
  media: Record<string, string>
}

export class BundleError extends Error {
  constructor(detail: string) {
    super(`Not a readable timer export: ${detail}`)
    this.name = 'BundleError'
  }
}

export function toBundle(
  workouts: readonly Workout[],
  now: number,
  media: Record<string, string> = {},
): Bundle {
  return {
    kind: 'davshack-timer-bundle',
    version: BUNDLE_VERSION,
    exportedAt: now,
    workouts: workouts.map((workout) => ({ ...workout })),
    media,
  }
}

/**
 * Validation is a WHITELIST of block kinds, which is the trap to remember here.
 *
 * When ladders and sections were added this still accepted only segments and
 * repeats, so `isWorkout` rejected every pasted routine and `fromBundle`
 * filtered it out: an export that wrote perfectly well and restored nothing.
 * A new block kind has to be added here at the same time.
 *
 * Fields are checked for TYPE, not just presence, because whatever passes here
 * is persisted and then rendered on every open. A hand-edited bundle with
 * `name: {x: 1}` or `durationMs: "60"` used to import cleanly and then throw in
 * React each time the routine was opened, until it was deleted. Invalid
 * routines are rejected, not silently repaired: a guessed fix would hide that
 * the file is damaged.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isOptionalFinite(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value)
}

function isAdvance(value: unknown): boolean {
  return value === undefined || value === 'set' || value === 'step'
}

function isReps(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const reps = value as { kind?: unknown; count?: unknown; perSide?: unknown }
  if (reps.perSide !== undefined && typeof reps.perSide !== 'boolean') return false
  if (reps.kind === 'rung') return true
  return reps.kind === 'fixed' && isFiniteNumber(reps.count)
}

function isMedia(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const media = value as Record<string, unknown>
  if (!isOptionalFinite(media['w']) || !isOptionalFinite(media['h'])) return false
  switch (media['source']) {
    case 'remote':
      return typeof media['url'] === 'string' && isOptionalString(media['cachedHash'])
    case 'bundled':
      return typeof media['path'] === 'string'
    case 'local':
      return typeof media['hash'] === 'string' && typeof media['mime'] === 'string'
    default:
      return false
  }
}

function isSegment(block: Record<string, unknown>): boolean {
  return (
    typeof block['name'] === 'string' &&
    // Absent means self-paced; present must be a real, non-negative duration.
    // A `durationMs` of `"60"` would count down from NaN.
    (block['durationMs'] === undefined ||
      (isFiniteNumber(block['durationMs']) && block['durationMs'] >= 0)) &&
    (block['reps'] === undefined || isReps(block['reps'])) &&
    isOptionalString(block['alternative']) &&
    isOptionalString(block['role']) &&
    (block['media'] === undefined || isMedia(block['media'])) &&
    isOptionalString(block['note'])
  )
}

function isBlockArray(value: unknown): value is Block[] {
  return Array.isArray(value) && value.every(isBlock)
}

export function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false
  const block = value as Record<string, unknown>
  if (!isOptionalString(block['id'])) return false
  switch (block['kind']) {
    case 'segment':
      return isSegment(block)
    case 'repeat':
      return (
        isFiniteNumber(block['times']) &&
        isOptionalString(block['label']) &&
        isAdvance(block['advance']) &&
        isBlockArray(block['children'])
      )
    case 'ladder':
      return (
        Array.isArray(block['counts']) &&
        block['counts'].every(isFiniteNumber) &&
        isOptionalString(block['label']) &&
        isAdvance(block['advance']) &&
        isBlockArray(block['children'])
      )
    case 'section':
      return (
        typeof block['name'] === 'string' &&
        isOptionalString(block['note']) &&
        (block['display'] === 'timer' || block['display'] === 'list') &&
        isAdvance(block['advance']) &&
        isBlockArray(block['children'])
      )
    default:
      return false
  }
}

function isWorkout(value: unknown): value is Workout {
  if (typeof value !== 'object' || value === null) return false
  const w = value as Record<string, unknown>
  return (
    typeof w['id'] === 'string' &&
    typeof w['name'] === 'string' &&
    isOptionalString(w['colour']) &&
    isOptionalFinite(w['createdAt']) &&
    isOptionalFinite(w['updatedAt']) &&
    isOptionalFinite(w['lastRunAt']) &&
    isOptionalFinite(w['estimatedTotalMs']) &&
    (w['favourite'] === undefined || typeof w['favourite'] === 'boolean') &&
    isBlockArray(w['blocks'])
  )
}

export type BundleContents = {
  workouts: Workout[]
  /**
   * Names of routines the file carried but that were too damaged to read. Never
   * silently dropped: a restore that loses 3 of 10 must not look fully
   * successful, because the file is the user's only copy.
   */
  rejected: string[]
}

/**
 * Validates and normalises a parsed export.
 *
 * Deliberately forgiving about missing metadata, since a routine with no
 * `createdAt` is still a routine, and strict about the parts the app would
 * crash on: the id, the name, and the block tree.
 */
export function fromBundle(json: unknown, now: number): BundleContents {
  if (typeof json !== 'object' || json === null) throw new BundleError('not an object')

  const bundle = json as Partial<Bundle>
  if (bundle.kind !== 'davshack-timer-bundle') throw new BundleError('missing marker')
  if (typeof bundle.version !== 'number') throw new BundleError('missing version')
  if (bundle.version > BUNDLE_VERSION) {
    throw new BundleError(`made by a newer version (${bundle.version})`)
  }
  if (!Array.isArray(bundle.workouts)) throw new BundleError('no routines')

  const workouts: Workout[] = []
  const rejected: string[] = []
  for (const entry of bundle.workouts) {
    if (isWorkout(entry)) {
      workouts.push(entry)
      continue
    }
    const name = (entry as { name?: unknown } | null)?.name
    rejected.push(typeof name === 'string' && name.trim() !== '' ? name : 'Unnamed routine')
  }
  if (workouts.length === 0) throw new BundleError('no readable routines')

  return {
    workouts: workouts.map((workout) =>
      migrateWorkout({
        ...workout,
        schemaVersion: SCHEMA_VERSION,
        createdAt: workout.createdAt ?? now,
        updatedAt: now,
      }),
    ),
    rejected,
  }
}

/** A filesystem-safe filename for an export. */
export function bundleFilename(name: string | null, now: Date): string {
  const stamp = now.toISOString().slice(0, 10)
  const slug = (name ?? 'library')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'routine'}-${stamp}.timer.json`
}
