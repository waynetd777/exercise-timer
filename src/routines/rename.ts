/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Putting a step's exercise back under the name the app knows it by.
 *
 * Routines are written by a person in a hurry and the exercise table takes its
 * names from the manufacturer's guide, so the same movement is a "Seated Ab
 * Crunch" in one place and a "Seated Abdominal Crunch" in the other. `findLoad`
 * already sees through that when it looks a weight up, but the step still READS
 * differently from everything else and still misses anything matching on the
 * name exactly.
 *
 * WHAT IS AND IS NOT A NAME. A step is called far more than its exercise:
 * "Get ready: 12 × Seated Ab Crunch 15kg (bodyweight)" is an announcement, a
 * count, an exercise, a weight and a note. Only the exercise is renamed; every
 * other part is put back exactly where it was. A rename that quietly dropped
 * "(knees or toes)" would be deleting the only record of the easier option.
 *
 * IT REFUSES TO GUESS, twice over. A name matching two exercises is left alone,
 * and so is one matching none. Renaming "Squat + Shoulder Press" to whichever
 * of its halves came first would be worse than leaving it unreadable.
 */

import type { Block, Workout } from '../engine/types'
import { EXERCISES } from './exercises'
import { foldName } from './foldName'

/**
 * Bare names with one obvious owner on this machine.
 *
 * The table has five chest presses and no plain one, so nothing can match
 * "Chest Press" — and yet on a Horizon it can only mean the standard one, which
 * is what Wayne confirmed it meant in routine 2. A short list of decisions,
 * kept here rather than guessed at by the matcher.
 */
const ALIASES: Readonly<Record<string, string>> = {
  'chest pres': 'Standard Chest Press',
}

/*
 * "Shoulder Press" is NOT here, though it has the same problem. The table has a
 * dumbbell exercise by exactly that name, so the plain name is already somebody's
 * — and in a multi-gym routine it means the standing one. Nothing in the name
 * can tell the two apart, so it is left as written. It resolves to the same
 * weight either way, which is why this costs nothing.
 */

/**
 * What a step is called, in the pieces a rename has to keep apart.
 *
 * `lead` is the announcement wording and the count; `trail` is everything the
 * name carries after the exercise, in the order it was written.
 */
const LEAD = /^(\s*(?:get\s+ready\s*:\s*)?(?:\d+\s*×\s*)?)/i
/** A weight typed on the end, the same shape `storage/migrate.ts` lifts out. */
const TRAILING_LOAD = /\s+\d+(?:\.\d+)?\s?(?:kg|lb|lbs)(?:\s+(?:each|per)\s+side)?$/i
/** A parenthetical: "(knees or toes)", "(bodyweight)". */
const TRAILING_NOTE = /\s*\([^)]*\)$/
/**
 * The paste format's dashed qualifier: "– 5 each leg". A space after the dash,
 * so a hyphenated word stays whole; none required before it, since "squat– 5"
 * is how it is sometimes typed.
 */
const TRAILING_DASH = /\s*[–—-]\s+.*$/
/** The side, or the limb: "left", "right leg", "per leg", "each side". */
const TRAILING_SIDE = /\s+(?:(?:left|right)(?:\s+(?:leg|arm|side))?|(?:per|each)\s+(?:leg|side|arm|direction))$/i
/** A count written after the name: "× 3", "x12". */
const TRAILING_COUNT = /\s*[×x]\s*\d+$/i

function split(name: string): { lead: string; core: string; trail: string } {
  const lead = LEAD.exec(name)?.[1] ?? ''
  let core = name.slice(lead.length)
  let trail = ''
  // Peeled repeatedly, since a name can carry more than one: "Leg Press 65kg
  // (both legs)" is a weight and a note. The side and a trailing count are
  // peeled too: `foldName` throws both away to match, and a rename that put the
  // canonical name back without them turned "side plank left" into "Side Plank".
  for (;;) {
    const match =
      TRAILING_LOAD.exec(core) ??
      TRAILING_NOTE.exec(core) ??
      TRAILING_DASH.exec(core) ??
      TRAILING_SIDE.exec(core) ??
      TRAILING_COUNT.exec(core)
    if (!match) break
    trail = core.slice(match.index) + trail
    core = core.slice(0, match.index)
  }
  return { lead, core: core.trim(), trail }
}

/**
 * Whether what is left is purely a name. A side or a number still in the core is
 * a qualifier the peeling did not recognise, and `match()` would fold it away
 * and lose it. Better to leave the step as written than to shorten it.
 */
const QUALIFIED = /\b(?:left|right)\b|\d/i

/** Every exercise, by folded name. A fold shared by two is a fold that decides nothing. */
function table(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const exercise of EXERCISES) {
    const key = foldName(exercise.name)
    out.set(key, [...(out.get(key) ?? []), exercise.name])
  }
  return out
}

/**
 * The one exercise this name means, or nothing.
 *
 * The same two passes `findLoad` makes, and deliberately so: a step the weights
 * page can answer for is exactly a step this can rename, and a rule that held
 * in one place and not the other would be a bug waiting to be found in the gap.
 */
function match(core: string, byKey: Map<string, string[]>): string | null {
  const key = foldName(core)
  if (key === '') return null

  const exact = byKey.get(key)
  if (exact) return exact.length === 1 ? exact[0]! : null

  const alias = ALIASES[key]
  if (alias) return alias

  const wanted = key.split(' ').filter(Boolean)
  let found: string | null = null
  for (const [candidate, names] of byKey) {
    const words = candidate.split(' ')
    if (words.length !== wanted.length || names.length !== 1) continue
    const alike = words.every((word, at) => {
      const other = wanted[at]!
      const [short, long] = word.length <= other.length ? [word, other] : [other, word]
      return short.length >= 2 && long.startsWith(short)
    })
    if (!alike) continue
    if (found !== null) return null
    found = names[0]!
  }
  return found
}

/** The name this step should have, or `null` where it already has it. */
export function canonicalName(name: string, byKey = table()): string | null {
  const { lead, core, trail } = split(name)
  if (QUALIFIED.test(core)) return null
  const canonical = match(core, byKey)
  if (canonical === null || canonical === core) return null
  return `${lead}${canonical}${trail}`
}

export type Rename = { from: string; to: string }

/**
 * Every step renamed, and the list of what changed.
 *
 * Identity-preserving where nothing did, so a library of routines that are
 * already tidy costs one walk and no re-render.
 */
export function tidyNames(
  blocks: readonly Block[],
  byKey = table(),
): { blocks: readonly Block[]; renamed: Rename[] } {
  const renamed: Rename[] = []
  const walk = (list: readonly Block[]): Block[] =>
    list.map((block) => {
      if (block.kind === 'segment') {
        const next = canonicalName(block.name, byKey)
        if (next === null) return block
        renamed.push({ from: block.name, to: next })
        return { ...block, name: next }
      }
      const children = walk(block.children)
      if (children.every((child, at) => child === block.children[at])) return block
      return { ...block, children } as Block
    })

  const next = walk(blocks)
  return renamed.length === 0 ? { blocks, renamed } : { blocks: next, renamed }
}

/** The same, for a whole routine. */
export function tidyWorkout(
  workout: Workout,
  byKey = table(),
): { workout: Workout; renamed: Rename[] } {
  const { blocks, renamed } = tidyNames(workout.blocks, byKey)
  return renamed.length === 0
    ? { workout, renamed }
    : { workout: { ...workout, blocks: [...blocks] }, renamed }
}

/** What a whole library would become. Routines that need nothing are left out. */
export function tidyLibrary(workouts: readonly Workout[]): {
  workouts: Workout[]
  renamed: Rename[]
} {
  const byKey = table()
  const out: Workout[] = []
  const renamed: Rename[] = []
  for (const workout of workouts) {
    const tidied = tidyWorkout(workout, byKey)
    if (tidied.renamed.length === 0) continue
    out.push(tidied.workout)
    renamed.push(...tidied.renamed)
  }
  return { workouts: out, renamed }
}
