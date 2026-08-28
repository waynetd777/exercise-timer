/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { PathStep, TimelineEntry } from '../engine'
import { samePathStep } from '../engine'

/**
 * The routine cut into the blocks a preview prints.
 *
 * A block is a run of consecutive steps that sit in the SAME place: same
 * section, same round, same rung. It carries the path they sit in, so the
 * screen can print the headings that open above them.
 *
 * The routine is read EXPANDED, off `routine.entries`, so round 3 of 8 is
 * printed as round 3 of 8 rather than as an eight against a single round. That
 * is the point of a preview: it shows what the run will actually do, in the
 * order it will do it, which a collapsed reading cannot. The collapsed reading
 * already exists twice over, in the editor's tree and in `writeRoutine`'s text.
 */
export type PreviewBlock = {
  /** Where these rows sit, outermost group first. */
  path: PathStep[]
  /**
   * How many levels of that path the block above already printed.
   *
   * Only `path.slice(carried)` is a new heading. Without this every round of a
   * circuit would reprint the section name above it, and the headings would be
   * most of what the screen said.
   */
  carried: number
  rows: TimelineEntry[]
}

/**
 * Groups the compiled steps by the place they sit in.
 *
 * A block ends whenever the path CHANGES, not only when it deepens: a step that
 * follows a section at the top level opens a block of its own with no heading,
 * or it would be printed as though it were still inside the section it comes
 * after.
 */
export function previewBlocks(entries: readonly TimelineEntry[]): PreviewBlock[] {
  const blocks: PreviewBlock[] = []

  for (const entry of entries) {
    const previous = blocks.at(-1)

    if (previous) {
      let shared = 0
      while (
        shared < previous.path.length &&
        shared < entry.path.length &&
        samePathStep(previous.path[shared]!, entry.path[shared]!)
      ) {
        shared++
      }

      if (shared === previous.path.length && shared === entry.path.length) {
        previous.rows.push(entry)
        continue
      }

      blocks.push({ path: entry.path, carried: shared, rows: [entry] })
      continue
    }

    blocks.push({ path: entry.path, carried: 0, rows: [entry] })
  }

  return blocks
}
