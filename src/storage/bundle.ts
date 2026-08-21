import type { Block, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { migrateWorkout } from './migrate'

/**
 * The export format: a routine, or a whole library, as one JSON file.
 *
 * Versioned from the start so a future reader can tell what it is holding, and
 * the `media` map was declared before anything filled it — which is why adding
 * photos to an export needed no format change and no second migration.
 */
export const BUNDLE_VERSION = 1 as const

export type Bundle = {
  kind: 'davshack-timer-bundle'
  version: typeof BUNDLE_VERSION
  exportedAt: number
  workouts: Workout[]
  /**
   * Uploaded photos, keyed by content hash, as data URLs — see
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

/** Every group kind, so adding one cannot silently make routines unreadable. */
const GROUP_KINDS = new Set(['repeat', 'ladder', 'section'])

/**
 * Validation is a WHITELIST, which is the trap to remember here.
 *
 * When ladders and sections were added this still accepted only segments and
 * repeats, so `isWorkout` rejected every pasted routine and `fromBundle`
 * filtered it out — an export that wrote perfectly well and restored nothing.
 * A new block kind has to be added here at the same time.
 */
function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false
  const block = value as { kind?: unknown; children?: unknown }
  if (block.kind === 'segment') return true
  if (typeof block.kind !== 'string' || !GROUP_KINDS.has(block.kind)) return false
  return Array.isArray(block.children) && block.children.every(isBlock)
}

function isWorkout(value: unknown): value is Workout {
  if (typeof value !== 'object' || value === null) return false
  const w = value as Partial<Workout>
  return (
    typeof w.id === 'string' &&
    typeof w.name === 'string' &&
    Array.isArray(w.blocks) &&
    w.blocks.every(isBlock)
  )
}

/**
 * Validates and normalises a parsed export.
 *
 * Deliberately forgiving about missing metadata — a routine with no
 * `createdAt` is still a routine — and strict about the parts the app would
 * crash on: the id, the name, and the block tree.
 */
export function fromBundle(json: unknown, now: number): Workout[] {
  if (typeof json !== 'object' || json === null) throw new BundleError('not an object')

  const bundle = json as Partial<Bundle>
  if (bundle.kind !== 'davshack-timer-bundle') throw new BundleError('missing marker')
  if (typeof bundle.version !== 'number') throw new BundleError('missing version')
  if (bundle.version > BUNDLE_VERSION) {
    throw new BundleError(`made by a newer version (${bundle.version})`)
  }
  if (!Array.isArray(bundle.workouts)) throw new BundleError('no routines')

  const workouts = bundle.workouts.filter(isWorkout)
  if (workouts.length === 0) throw new BundleError('no readable routines')

  return workouts.map((workout) =>
    migrateWorkout({
      ...workout,
      schemaVersion: SCHEMA_VERSION,
      createdAt: workout.createdAt ?? now,
      updatedAt: now,
    }),
  )
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
