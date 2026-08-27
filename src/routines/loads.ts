/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Filling a routine's empty weights in from the ones you keep in Settings.
 *
 * A step that states no load is not saying "unloaded": it is saying "whatever I
 * lift for this". So the weight is resolved on the way INTO a run, an export or
 * the editor's placeholder, and never written back. Change the number in
 * Settings and every routine that does not override it follows, which is the
 * whole point of having the page.
 *
 * A step that DOES state a load is left exactly as it is, because it is saying
 * something the table cannot: that this routine, deliberately, is not your
 * usual weight.
 *
 * Pure, and takes the table as an argument, so nothing here reads storage and a
 * test gets the same answer whatever is in the browser.
 */

import type { Block, Workout } from '../engine/types'
import { foldName } from './foldName'

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
        const load = weights.get(exerciseKey(block.name))
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
