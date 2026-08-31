/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * The exercises you added yourself.
 *
 * The shipped table is a vocabulary of movements read off the Horizon guide and
 * out of the instructor's own routines, and it is fixed at build time: a name
 * typed into a step was carried by that step and by nothing else, so it had
 * nowhere to keep a weight, nowhere to keep a picture, no place in the name
 * field, and no way into a generated routine. This is where a name you type
 * becomes an exercise the app knows.
 *
 * IN `localStorage`, keyed by folded name, exactly like `weights.ts` and
 * `pictures.ts`: an exercise belongs to your gym rather than to a routine, and
 * the three tables are then keyed alike, so one exercise's name, weight and
 * picture are found by the same string. It rides along in a backup for the same
 * reason the weights do. A restore that put back the weight and lost the row it
 * belongs to would be worse than one that carried neither.
 *
 * FULL RECORDS, not just a name and a kit. The area and the push/pull are what
 * let a generated routine use your exercise: `generate.ts` builds its pools by
 * area, alternates push against pull, and draws the warm-up from `use`. A row
 * with only a name could sit on this page and could never be programmed.
 *
 * NO REFOLD PASS, unlike the other three tables. Their key is the only record of
 * the name, so a change to `foldName` orphaned them (see `refold.ts`); here the
 * record carries its own name, so every read re-keys from that and a fold change
 * costs nothing.
 */

import type { BodyArea, Equipment, Exercise, Pattern, Use } from '../routines/exercises'
import { EXERCISES, KIT_GROUPS } from '../routines/exercises'
import { foldName } from '../routines/foldName'

const KEY = 'davshack-timer-exercises'

/**
 * One exercise you added.
 *
 * Structurally an `Exercise` minus the three fields only the guide can supply:
 * `media` is the illustration that ships with the app, and `station` and
 * `attachment` describe the multi-gym. A picture of your own is not here either;
 * it goes in the pictures table with everyone else's, keyed by the same folded
 * name, so nothing has to know whether the exercise was shipped or typed.
 */
export type CustomExercise = {
  name: string
  area: BodyArea
  equipment: Equipment
  /** Upper body only, as in the shipped table. */
  pattern?: Pattern
  /** Absent means `strength`. */
  use?: Use
  perSide?: boolean
}

/** What is stored: records by folded name, so the same exercise cannot be added twice. */
export type CustomExercises = Record<string, CustomExercise>

const AREAS: readonly BodyArea[] = ['upper', 'torso', 'lower']
const PATTERNS: readonly Pattern[] = ['push', 'pull']
const USES: readonly Use[] = ['strength', 'cardio', 'mobility']
/* Derived from `KIT_GROUPS` rather than listed again: a kit the page has no
   heading for could be stored and would then never be shown. */
const KITS: readonly Equipment[] = KIT_GROUPS.map((group) => group.kit)

/** Every folded name the shipped table already holds. Built once. */
let shipped: Set<string> | null = null

function shippedKeys(): ReadonlySet<string> {
  shipped ??= new Set(EXERCISES.map((exercise) => foldName(exercise.name)))
  return shipped
}

function has<T>(values: readonly T[], value: unknown): value is T {
  return (values as readonly unknown[]).includes(value)
}

/**
 * One stored record, or null.
 *
 * Every field is checked for type and for membership, because whatever passes
 * here is merged into the table the generator draws from and the page renders:
 * an `area` of `"legs"` would sit in no pool and print as nothing, and a
 * hand-edited backup is a real way in. Damaged entries are dropped rather than
 * repaired: a guessed area is the one mistake this table can make that shows up
 * as a bad routine rather than as a missing row.
 */
function readOne(value: unknown): CustomExercise | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (name === '' || foldName(name) === '') return null
  if (!has(AREAS, record.area) || !has(KITS, record.equipment)) return null
  if (record.pattern !== undefined && !has(PATTERNS, record.pattern)) return null
  if (record.use !== undefined && !has(USES, record.use)) return null
  if (record.perSide !== undefined && typeof record.perSide !== 'boolean') return null
  return {
    name,
    area: record.area,
    equipment: record.equipment,
    ...(record.pattern !== undefined ? { pattern: record.pattern } : {}),
    ...(record.use !== undefined ? { use: record.use } : {}),
    ...(record.perSide === true ? { perSide: true } : {}),
  }
}

/**
 * A stored or imported table, validated and re-keyed from the names it holds.
 *
 * Shared with the bundle reader, so a backup cannot put anything in here that
 * the app would not have written itself. Never throws: a damaged table means
 * fewer exercises, not a screen that will not open.
 *
 * A NAME THE SHIPPED TABLE NOW HAS IS DROPPED. The three per-device tables are
 * keyed by folded name, so two rows claiming one key would fight over one
 * weight and one picture, and `collectExercises` would silently show only the
 * first. This can happen without anyone doing anything wrong: a harvest adds
 * "Sit Ups" a month after you typed it. The shipped record wins, and the weight
 * and picture you set stay exactly where they are. They were never keyed to this
 * table.
 */
export function readCustomExercises(value: unknown): CustomExercises {
  if (typeof value !== 'object' || value === null) return {}
  const out: CustomExercises = {}
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const exercise = readOne(entry)
    if (!exercise) continue
    const key = foldName(exercise.name)
    if (shippedKeys().has(key)) continue
    out[key] = exercise
  }
  return out
}

let cached: readonly CustomExercise[] | null = null

/*
 * Another tab saving drops this tab's cache, as in `weights.ts`: `storage` fires
 * only in OTHER tabs, which is exactly the set holding a stale copy.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) cached = null
  })
}

/** What is stored. Never throws: a broken store means no exercises of your own. */
export function loadCustomExercises(): CustomExercises {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return {}
    return readCustomExercises(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function saveCustomExercises(table: CustomExercises): void {
  cached = null
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(table))
  } catch {
    // Storage turned off, or a private window. The app keeps the shipped table,
    // which is where it was before this existed.
  }
}

/**
 * Your exercises, in the order a list should show them: by name.
 *
 * The shipped table has an order that means something: the multi-gym is in
 * station order, because that is the order you walk the machine in. Yours has no
 * such order, so alphabetical is the only answer that does not depend on which
 * day you added what. They sort WITHIN their kit group, since that is what both
 * the page and the name field group by.
 *
 * Cached, and dropped on save: the editor asks once per screen but the generator
 * asks per routine, and re-parsing storage for each is work for nothing.
 */
export function currentCustomExercises(): readonly CustomExercise[] {
  cached ??= customList(loadCustomExercises())
  return cached
}

/** A stored table as a sorted list. Pure, for a caller holding its own copy. */
export function customList(table: CustomExercises): readonly CustomExercise[] {
  return Object.values(table).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The whole vocabulary: what ships, then what you added.
 *
 * Shipped FIRST, deliberately. `collectExercises` deduplicates by folded name
 * and keeps the first, so this order is what makes the shipped record win a
 * collision that `readCustomExercises` did not catch.
 */
export function withCustom(custom: readonly CustomExercise[]): readonly Exercise[] {
  return custom.length === 0 ? EXERCISES : [...EXERCISES, ...custom]
}

/** Adds or replaces one exercise, by folded name, and returns the new table. */
export function addCustom(table: CustomExercises, exercise: CustomExercise): CustomExercises {
  return { ...table, [foldName(exercise.name)]: exercise }
}

/** Removes one, by written name. */
export function removeCustom(table: CustomExercises, name: string): CustomExercises {
  const next = { ...table }
  delete next[foldName(name)]
  return next
}

/** True where this name is one of yours rather than one of the app's. */
export function isCustom(table: CustomExercises, name: string): boolean {
  return foldName(name) in table
}
