/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Filling a routine's empty WEIGHTS and PICTURES in from the exercises page.
 *
 * A step that states no load is not saying "unloaded": it is saying "whatever I
 * lift for this". A step with no picture is saying the same about what the
 * exercise looks like. So both are resolved on the way INTO a run, an export or
 * the editor's hint, and neither is written back. Change the number or the
 * photo on the page and every routine that does not override it follows, which
 * is the whole point of having the page.
 *
 * A step that DOES state one is left exactly as it is, because it is saying
 * something the table cannot: that this routine, deliberately, is not the usual
 * weight, or shows a different picture.
 *
 * Pure, and takes the table as an argument, so nothing here reads storage and a
 * test gets the same answer whatever is in the browser.
 */

import type { Block, MediaRef, Workout } from '../engine/types'
import { closestKey, foldName } from './foldName'

/**
 * The exercise a step is about, under whatever the step is called.
 *
 * A routine names the same lift three ways: `Leg Press` on the work step,
 * `12 × Leg Press` where the count rides in the name, and `Get ready: Leg Press`
 * on the announcement you set the machine up during. All three want the same
 * weight, so all three fold to the same key.
 *
 * `foldName` already drops a leading count. The announcement prefix is this
 * app's own wording rather than an exercise name, so it comes off here.
 */
export function exerciseKey(name: string): string {
  return foldName(name.replace(/^\s*get\s+ready\s*:\s*/i, ''))
}

/**
 * A per-exercise table's entry for a written name, allowing for the SHORTHAND
 * people write. The weight and the picture both come through here.
 *
 * The exact key first. That misses more than it looks: the exercise table takes
 * its names from the manufacturer's guide, and a routine is written by a person
 * in a hurry. "Seated Ab Crunch" and "Seated Abdominal Crunch" are the same
 * machine, and the first is what actually gets typed.
 *
 * So the fallback matches word by word, with a shorter word allowed to be the
 * start of a longer one: `ab` finds `abdominal`, `tricep` finds `triceps`. The
 * shape has to line up exactly, the same number of words in the same order,
 * which is what keeps `Incline Chest Press` away from `Incline Cable Converging
 * Chest Press`, and `Hip Abductor` away from `Hip Adductor`, since neither of
 * those is the start of the other.
 *
 * AMBIGUITY REFUSES TO GUESS. Two matches mean no answer: putting the wrong
 * number on a bar is worse than putting none on it, and the same goes for
 * showing the wrong machine.
 */
export function findFor<T>(table: ReadonlyMap<string, T>, name: string): T | undefined {
  const key = exerciseKey(name)
  const exact = table.get(key)
  if (exact !== undefined) return exact

  const hit = closestKey(key, table.keys())
  return hit === null ? undefined : table.get(hit)
}

/**
 * The weight for a written name. `findFor` over the weights table.
 *
 * Kept as its own name because it reads at every call site as what it is, and
 * because the generic is what the picture table needed rather than a second copy
 * of the same three lines.
 */
export function findLoad(
  weights: ReadonlyMap<string, string>,
  name: string,
): string | undefined {
  return findFor(weights, name)
}

/**
 * Every step's weight, filled in where the step does not state one.
 *
 * Returns the SAME blocks where nothing changed, so an unloaded routine costs
 * one walk and no allocation, and React sees no new identities.
 */
export function fillLoads(
  blocks: readonly Block[],
  weights: ReadonlyMap<string, string>,
): readonly Block[] {
  if (weights.size === 0) return blocks

  let changed = false
  const walk = (list: readonly Block[]): Block[] =>
    list.map((block) => {
      if (block.kind === 'segment') {
        if (block.load !== undefined) return block
        const load = findLoad(weights, block.name)
        if (!load) return block
        changed = true
        return { ...block, load }
      }
      const children = walk(block.children)
      if (children.every((child, at) => child === block.children[at])) return block
      return { ...block, children } as Block
    })

  const next = walk(blocks)
  return changed ? next : blocks
}

/** The same, for a whole routine. Identity-preserving in the same way. */
export function withWeights(workout: Workout, weights: ReadonlyMap<string, string>): Workout {
  const blocks = fillLoads(workout.blocks, weights)
  return blocks === workout.blocks ? workout : { ...workout, blocks: [...blocks] }
}

/**
 * Every step's picture, filled in where the step carries none.
 *
 * The same shape and the same rules as `fillLoads`, including returning the SAME
 * blocks where nothing changed, so a fully illustrated routine costs one walk
 * and React sees no new identities.
 *
 * A step that carries a picture keeps it, whatever the table says: an uploaded
 * photo on a step is the routine disagreeing on purpose. A step with a picture
 * is also the ONLY thing a share link or a text export can carry, which is the
 * other reason this never writes back.
 */
export function fillPictures(
  blocks: readonly Block[],
  pictures: ReadonlyMap<string, MediaRef>,
): readonly Block[] {
  if (pictures.size === 0) return blocks

  let changed = false
  const walk = (list: readonly Block[]): Block[] =>
    list.map((block) => {
      if (block.kind === 'segment') {
        if (block.media !== undefined) return block
        const media = findFor(pictures, block.name)
        if (!media) return block
        changed = true
        return { ...block, media }
      }
      const children = walk(block.children)
      if (children.every((child, at) => child === block.children[at])) return block
      return { ...block, children } as Block
    })

  const next = walk(blocks)
  return changed ? next : blocks
}

/** The same, for a whole routine. Identity-preserving in the same way. */
export function withPictures(
  workout: Workout,
  pictures: ReadonlyMap<string, MediaRef>,
): Workout {
  const blocks = fillPictures(workout.blocks, pictures)
  return blocks === workout.blocks ? workout : { ...workout, blocks: [...blocks] }
}

/**
 * The same routine with its stated weights TAKEN OUT, where the table has one.
 *
 * The other direction, and the destructive one. Routines written before the
 * weights page carry their own load on every step, so they override it and go
 * on saying 65kg after you have moved to 70. This is how they let go: a step
 * whose exercise has a weight in the table loses its own and starts following.
 *
 * A step the table says nothing about keeps what it has. Losing that would be
 * losing the only record of it.
 *
 * Returns the count as well, because this cannot be undone and the number is
 * what makes the question answerable: "clear 14 weights in 3 routines" is a
 * decision, "clear your weights" is a leap.
 */
export function stripLoads(
  blocks: readonly Block[],
  weights: ReadonlyMap<string, string>,
): { blocks: readonly Block[]; cleared: number } {
  let cleared = 0
  const walk = (list: readonly Block[]): Block[] =>
    list.map((block) => {
      if (block.kind === 'segment') {
        if (block.load === undefined || findLoad(weights, block.name) === undefined) return block
        cleared += 1
        const { load: _gone, ...rest } = block
        return rest
      }
      const children = walk(block.children)
      if (children.every((child, at) => child === block.children[at])) return block
      return { ...block, children } as Block
    })

  const next = walk(blocks)
  return cleared === 0 ? { blocks, cleared } : { blocks: next, cleared }
}

/** The same, for a whole routine. */
export function withoutStatedLoads(
  workout: Workout,
  weights: ReadonlyMap<string, string>,
): { workout: Workout; cleared: number } {
  const { blocks, cleared } = stripLoads(workout.blocks, weights)
  return cleared === 0 ? { workout, cleared } : { workout: { ...workout, blocks: [...blocks] }, cleared }
}
