/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * What an exercise LOOKS like, per exercise, in one place.
 *
 * The twin of `weights.ts`, and it exists for the same reason. A picture belongs
 * to your gym rather than to a routine: the guide draws 42 of the 147 movements
 * and the other 105 had no picture anywhere, so the only way to see a press-up
 * was to attach a photo to a step, in every routine that used it, one at a time.
 * Written down here once, every routine that names the exercise shows it.
 *
 * A ROUTINE'S OWN PICTURE STILL WINS, exactly as its own weight does. A step
 * carrying a photo is saying something this table cannot: that this routine, on
 * purpose, shows something else. So the fill only ever reaches a step with no
 * picture of its own, and nothing here is written back into a routine.
 *
 * The GUIDE is the floor under both. `currentPictures()` starts from the
 * illustrations that ship with the app and lets this table override them, so a
 * step named "Leg Press" and never picked from a list still shows the machine.
 *
 * IN `localStorage`, like the weights, but what it stores is a `MediaRef` rather
 * than a string, and an uploaded photo's BYTES live in IndexedDB under its hash
 * like any other. Two consequences worth knowing, both handled:
 *
 *  - the blob sweep in `useLibrary` must count this table as a root, or the
 *    first delete of a routine would collect a picture only this page holds. See
 *    `liveHashes`.
 *  - a backup carries the table and those bytes, like it carries the weights and
 *    a step's own photos. See `bundle.ts` and `bundleMedia.ts`.
 */

import type { MediaRef } from '../engine'
import { EXERCISES } from '../routines/exercises'
import { foldName } from '../routines/foldName'
import { refoldKeys } from './refold'
import { findFor } from '../routines/loads'

const KEY = 'davshack-timer-pictures'

/** What has been chosen, keyed by folded exercise name. */
export type Pictures = Record<string, MediaRef>

let cached: Map<string, MediaRef> | null = null

/*
 * Another tab saving drops this tab's cache, for the same reason as the weights:
 * two tabs each keeping their own copy means the second to save writes stale
 * values over the first's. `storage` fires only in OTHER tabs.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY || event.key === null) cached = null
  })
}

/**
 * A stored value that is actually a `MediaRef`.
 *
 * Checked on the way OUT of storage, not just on the way in. What is here is
 * rendered on every step of every run, and a hand-edited or half-written entry
 * would throw in React rather than simply showing no picture.
 */
export function isMediaRef(value: unknown): value is MediaRef {
  if (typeof value !== 'object' || value === null) return false
  const ref = value as Record<string, unknown>
  switch (ref['source']) {
    case 'bundled':
      return typeof ref['path'] === 'string'
    case 'remote':
      return typeof ref['url'] === 'string'
    case 'local':
      return typeof ref['hash'] === 'string' && typeof ref['mime'] === 'string'
    default:
      return false
  }
}

/** Only what has been chosen. Never throws: a broken store means no pictures. */
export function loadPictures(): Pictures {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Pictures = {}
    for (const [name, ref] of Object.entries(parsed as Record<string, unknown>)) {
      if (isMediaRef(ref)) out[name] = ref
    }
    // Keys written under the older fold ("leg pres") move to the current one
    // ("leg press"), once, on the first read. See `refold.ts`.
    const { table, changed } = refoldKeys(out)
    if (changed) savePictures(table)
    return table
  } catch {
    return {}
  }
}

export function savePictures(pictures: Pictures): void {
  cached = null
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(pictures))
  } catch {
    // Storage turned off, or a private window. Steps fall back to whatever
    // picture they carry themselves, which is where they were before this.
  }
}

/**
 * The pictures in force: the guide's illustrations, with this table over them.
 *
 * The guide is included so the table only ever has to hold what it ADDS. It also
 * means the fill answers for an exercise nobody has touched: a routine typed by
 * hand, or one imported from a `.tabata` file, shows the machine it names.
 *
 * Cached, and dropped on save: every step of every routine asks.
 */
export function currentPictures(): ReadonlyMap<string, MediaRef> {
  if (cached) return cached
  const out = new Map<string, MediaRef>()
  for (const exercise of EXERCISES) {
    if (exercise.media) out.set(foldName(exercise.name), { source: 'bundled', path: exercise.media })
  }
  for (const [name, ref] of Object.entries(loadPictures())) out.set(name, ref)
  cached = out
  return out
}

/**
 * One exercise's picture, by its written name, or undefined.
 *
 * Through `findFor`, the same lookup the weight uses and a running routine uses,
 * so the editor's hint cannot promise a picture the run does not show.
 */
export function pictureFor(name: string): MediaRef | undefined {
  return findFor(currentPictures(), name)
}

/** What this table itself holds for a name, ignoring the guide underneath it. */
export function chosenPicture(pictures: Pictures, name: string): MediaRef | undefined {
  return pictures[foldName(name)]
}

/**
 * Writes one exercise's picture and returns the new store. `null` removes the
 * entry, which puts the exercise back on the guide's illustration where it has
 * one, and on nothing where it has not.
 */
export function withPicture(pictures: Pictures, name: string, ref: MediaRef | null): Pictures {
  const key = foldName(name)
  const next = { ...pictures }
  if (ref) next[key] = ref
  else delete next[key]
  return next
}

/**
 * The entries a set of written names could actually use.
 *
 * For a backup of ONE routine. The whole-library backup carries the whole table,
 * because that file is the restore and an entry for an exercise no routine
 * happens to use today is still yours; a single routine is a thing you send, and
 * sending one routine should not post every photo you own with it. The weights
 * ride whole either way: sixty-seven short strings are not a payload.
 *
 * The key is found through `findFor`, so the shorthand a routine is written in
 * reaches the same entry the run would.
 */
export function picturesFor(names: Iterable<string>, pictures: Pictures): Pictures {
  // key -> key, so `findFor` hands back the KEY that answers rather than the ref.
  const keys = new Map(Object.keys(pictures).map((key) => [key, key]))
  const out: Pictures = {}
  for (const name of names) {
    const key = findFor(keys, name)
    if (key !== undefined) out[key] = pictures[key]!
  }
  return out
}

/**
 * Every blob this table holds, for the sweep and for an export.
 *
 * Local hashes only where `uploadedOnly`, matching `gc.ts`'s split: the sweep
 * must also keep a pinned copy of a linked image alive, an export wants only the
 * bytes nothing else has.
 */
export function pictureHashes(
  pictures: Pictures,
  uploadedOnly = false,
): string[] {
  const found = new Set<string>()
  for (const ref of Object.values(pictures)) {
    if (ref.source === 'local') found.add(ref.hash)
    else if (!uploadedOnly && ref.source === 'remote' && ref.cachedHash) found.add(ref.cachedHash)
  }
  return [...found].sort()
}
