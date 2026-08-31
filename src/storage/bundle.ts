/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, MediaRef, SegmentRole, Workout } from '../engine'
import { MAX_TIMELINE_ENTRIES, ROUTINE_COLOURS, SCHEMA_VERSION, stepCount } from '../engine'
import type { CustomExercises } from './customExercises'
import { readCustomExercises } from './customExercises'
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
  /**
   * The weights kept in Settings, keyed by folded exercise name.
   *
   * OPTIONAL, and older files do not have it: a reader that finds none simply
   * keeps the weights it already has. It rides in the backup because most
   * routines now state no weight of their own and read this table instead, so a
   * restore without it would put back sixty-seven routines with the numbers
   * missing from all of them.
   */
  weights?: Record<string, string>
  /**
   * The pictures kept on the exercises page, keyed by folded exercise name.
   *
   * OPTIONAL, exactly like `weights`, and for the same reason: a file written
   * before the field existed simply leaves what is here alone. The BYTES of an
   * uploaded one ride in `media` beside a step's own photos, keyed by the same
   * content hash, so a photo used both by the page and by a step travels once.
   */
  pictures?: Record<string, MediaRef>
  /**
   * The exercises you added yourself, keyed by folded exercise name.
   *
   * OPTIONAL like the two above. It rides along for a sharper reason than
   * either: the weights and the pictures are keyed by exercise name, so a
   * restore that brought them WITHOUT the exercises they belong to would put
   * back a weight for a row that no longer exists on the page. The exercise
   * would have to be typed in again from memory, its area and its push-or-pull
   * included, before the number reappeared.
   */
  exercises?: CustomExercises
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
  weights: Record<string, string> = {},
  pictures: Record<string, MediaRef> = {},
  exercises: CustomExercises = {},
): Bundle {
  return {
    kind: 'davshack-timer-bundle',
    version: BUNDLE_VERSION,
    exportedAt: now,
    workouts: workouts.map((workout) => ({ ...workout })),
    media,
    // Omitted entirely when there is nothing to say, so a file that carries no
    // weights looks exactly like one written before the field existed. Same for
    // the pictures.
    ...(Object.keys(weights).length > 0 ? { weights } : {}),
    ...(Object.keys(pictures).length > 0 ? { pictures } : {}),
    ...(Object.keys(exercises).length > 0 ? { exercises } : {}),
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

const ROLES: readonly SegmentRole[] = ['prepare', 'work', 'rest', 'recover', 'custom']

/** A role outside the union would draw with `var(--role-banana)`: no colour at all. */
function isRole(value: unknown): boolean {
  return value === undefined || (ROLES as readonly unknown[]).includes(value)
}

function isColour(value: unknown): boolean {
  return value === undefined || (ROUTINE_COLOURS as readonly unknown[]).includes(value)
}

function isReps(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const reps = value as { kind?: unknown; count?: unknown; perSide?: unknown }
  if (reps.perSide !== undefined && typeof reps.perSide !== 'boolean') return false
  if (reps.kind === 'rung') return true
  return reps.kind === 'fixed' && isFiniteNumber(reps.count)
}

/** Exported for the pictures table, which stores the same refs and used to carry a copy of this. */
export function isMedia(value: unknown): value is MediaRef {
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
    isOptionalString(block['load']) &&
    isRole(block['role']) &&
    (block['media'] === undefined || isMedia(block['media'])) &&
    isOptionalString(block['note'])
  )
}

function isBlockArray(value: unknown): value is Block[] {
  return Array.isArray(value) && value.every(isBlock)
}

function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false
  const block = value as Record<string, unknown>
  // Optional here: a hand-written file or an older link may omit it, and
  // `migrateBlocks` gives such a block one on the way in. The run keys a gate
  // on `${id}@${iteration}`, so two groups without one would be cleared by a
  // single tap; that is why it is filled rather than ignored.
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

/** Exported for the share link, which is as hand-editable as a file and gets the same checks. */
export function isWorkout(value: unknown): value is Workout {
  if (typeof value !== 'object' || value === null) return false
  const w = value as Record<string, unknown>
  const shaped =
    typeof w['id'] === 'string' &&
    typeof w['name'] === 'string' &&
    isColour(w['colour']) &&
    isOptionalFinite(w['createdAt']) &&
    isOptionalFinite(w['updatedAt']) &&
    isOptionalFinite(w['lastRunAt']) &&
    isOptionalFinite(w['estimatedTotalMs']) &&
    (w['favourite'] === undefined || typeof w['favourite'] === 'boolean') &&
    isBlockArray(w['blocks'])
  if (!shaped) return false
  // Size as well as shape: `compile()` refuses more steps than this, and it
  // does so in the run screen's render. A file or link is the one place a
  // routine that large can come from without the editor's guard seeing it.
  return stepCount(value as Workout) <= MAX_TIMELINE_ENTRIES
}

type BundleContents = {
  workouts: Workout[]
  /**
   * Names of routines the file carried but that were too damaged to read. Never
   * silently dropped: a restore that loses 3 of 10 must not look fully
   * successful, because the file is the user's only copy.
   */
  rejected: string[]
  /** The weights the file carried, if any. See `Bundle.weights`. */
  weights: Record<string, string>
  /** The exercise pictures the file carried, if any. See `Bundle.pictures`. */
  pictures: Record<string, MediaRef>
  /** The exercises of your own the file carried, if any. See `Bundle.exercises`. */
  exercises: CustomExercises
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
      /*
       * Named fields only. A file is hand-editable and `isWorkout` checks the
       * types of what it knows, not the absence of what it does not, so an
       * unknown key used to land in the store. A last run in the future, which
       * would sit at the top of the library for years, is brought back to now.
       */
      const { id, name, colour, blocks, createdAt, updatedAt, lastRunAt, favourite, estimatedTotalMs } =
        entry
      workouts.push({
        id,
        name,
        blocks,
        createdAt,
        updatedAt,
        schemaVersion: SCHEMA_VERSION,
        ...(colour !== undefined ? { colour } : {}),
        ...(lastRunAt !== undefined ? { lastRunAt: Math.min(lastRunAt, now) } : {}),
        ...(favourite !== undefined ? { favourite } : {}),
        ...(estimatedTotalMs !== undefined ? { estimatedTotalMs } : {}),
      })
      continue
    }
    const name = (entry as { name?: unknown } | null)?.name
    rejected.push(typeof name === 'string' && name.trim() !== '' ? name : 'Unnamed routine')
  }
  // Nothing readable AND nothing to name is an empty file. Nothing readable but
  // names to report is a result: the caller says which routines were lost,
  // which the thrown message could not.
  if (workouts.length === 0 && rejected.length === 0) throw new BundleError('no readable routines')

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
    weights: readWeights(bundle.weights),
    pictures: readPictures(bundle.pictures),
    /* Validated by the store's own reader rather than by a second copy here: a
       backup must not be able to put anything in that table the app would not
       have written itself. Never throws; see `readCustomExercises`. */
    exercises: readCustomExercises(bundle.exercises),
  }
}

/**
 * Refs only, and never throws: a damaged pictures map must not lose the
 * routines. Each entry is checked with the same guard a step's media gets, since
 * whatever passes here is stored and then rendered on every run.
 */
export function readPictures(value: unknown): Record<string, MediaRef> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, MediaRef> = {}
  for (const [name, ref] of Object.entries(value as Record<string, unknown>)) {
    if (isMedia(ref)) out[name] = ref
  }
  return out
}

/**
 * Strings only, and never throws: a damaged weights map must not lose the
 * routines. Empty strings are dropped too: an older export wrote a cleared
 * weight as '', and merged over the local table that emptied a real number.
 */
function readWeights(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, string> = {}
  for (const [name, load] of Object.entries(value as Record<string, unknown>)) {
    if (typeof load === 'string' && load.trim() !== '') out[name] = load
  }
  return out
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
