import type { Block, Workout } from '../engine'

/**
 * Forward-only fixes applied to a routine as it enters the app, from IndexedDB or
 * from an imported bundle.
 *
 * These run on READ rather than as a one-off rewrite, so an old export opened next
 * year is fixed the same way today's stored routines are, and nothing has to be
 * migrated in place before it can be read.
 */

/**
 * Repeat groups were called "rounds" and every one created by the editor stored
 * the literal label `'Round'`. They are reps now, and the label is DATA, so a
 * code-only rename would leave existing routines saying "Round 2 of 3" forever.
 *
 * Only exact former defaults are renamed. A group someone deliberately named
 * "Round 1" or "Rounds" keeps its name — theirs to choose, not ours to correct.
 *
 * `'Rep'` is in the list because it was briefly the default during the rename:
 * short for repetitions, so it should always have been plural. It never shipped,
 * but a routine saved from a dev build could be carrying it.
 */
const LEGACY_REPEAT_LABELS = ['Round', 'Rep']
const REPEAT_LABEL = 'Reps'

function migrateBlocks(blocks: Block[]): Block[] {
  let changed = false
  const next = blocks.map((block) => {
    if (block.kind !== 'repeat') return block
    const children = migrateBlocks(block.children)
    const relabel = block.label !== undefined && LEGACY_REPEAT_LABELS.includes(block.label)
    if (!relabel && children === block.children) return block
    changed = true
    return { ...block, ...(relabel ? { label: REPEAT_LABEL } : {}), children }
  })
  return changed ? next : blocks
}

/** Identity when there is nothing to fix, so React sees no needless new objects. */
export function migrateWorkout(workout: Workout): Workout {
  const blocks = migrateBlocks(workout.blocks)
  return blocks === workout.blocks ? workout : { ...workout, blocks }
}
