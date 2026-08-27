/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Roughly how long a routine takes, including the parts that have no length.
 *
 * `totalDurationMs` answers this exactly for a timed routine and cannot answer
 * it at all for a rep-based one: a self-paced step ends when you tap Next, so it
 * contributes nothing and a section routine comes out at a couple of minutes of
 * warm-up. That is truthful and useless.
 *
 * So this returns BOTH halves, and the caller says which it has:
 *
 *   knownMs      the timed steps, which really are that long
 *   estimatedMs  the self-paced ones, at a seconds-per-rep rate
 *
 * WHERE THE RATE COMES FROM. The instructor writes some exercises both ways: a
 * "30-second Plank" one week and "20 x Plank" another. Fourteen of them say so,
 * and `exercises.prescription.ts` carries the rate for those. It runs from one
 * second for mountain climbers to six for a Bulgarian split squat, which is why
 * a single flat rate would be wrong by six times at the edges. Anything with no
 * rate of its own uses the median of the ones that have.
 *
 * WHAT IT CANNOT KNOW, and no rate ever will: how long you rest. A rep-based
 * routine is partly you deciding when you are ready. So the answer is "about 35
 * minutes" with the working time known, never "35:20", which is a promise only
 * the timed shapes can keep.
 */

import type { Block } from '../engine/types'
import { PRESCRIPTIONS } from './exercises.prescription'
import { foldName } from './foldName'

/**
 * The middle of the rates the corpus states, for an exercise that states none.
 *
 * Two seconds. Computed rather than chosen: it is the median of the fourteen
 * exercises the instructor has written both ways.
 */
export const DEFAULT_SECONDS_PER_REP = 2

export type Estimate = {
  /** Timed steps. Exact. */
  knownMs: number
  /** Self-paced steps, at a rate. Zero when there are none. */
  estimatedMs: number
  /** True where anything was estimated, so the caller can say "about". */
  rough: boolean
}

/**
 * The rate for one exercise, best evidence first.
 *
 * A MEASURED rate wins: it is this person on this machine, against a rate
 * implied by what one instructor wrote. Then the harvested one, then the median
 * of the harvested ones.
 */
function secondsPerRep(name: string, measured: ReadonlyMap<string, number>): number {
  const key = foldName(name)
  return (
    measured.get(key) ??
    PRESCRIPTIONS.find((p) => p.name === key)?.secondsPerRep ??
    DEFAULT_SECONDS_PER_REP
  )
}

/**
 * A self-paced step's length, at the rate for that exercise.
 *
 * A per-side count is doubled: "5 each side" is ten reps of work, and the field
 * deliberately holds the smaller, truer number.
 */
function stepMs(
  name: string,
  count: number,
  perSide: boolean,
  measured: ReadonlyMap<string, number>,
): number {
  return Math.round(count * (perSide ? 2 : 1) * secondsPerRep(name, measured) * 1000)
}

/**
 * @param measured rates recorded from actual runs, which beat the harvested
 * ones. Empty by default, so this stays pure and a test gets the same answer
 * whatever is in the browser's storage.
 */
export function estimate(
  blocks: readonly Block[],
  measured: ReadonlyMap<string, number> = new Map(),
): Estimate {
  let knownMs = 0
  let estimatedMs = 0

  const walk = (list: readonly Block[], rung: number | null): void => {
    for (const block of list) {
      if (block.kind === 'segment') {
        if (block.durationMs !== undefined) {
          knownMs += block.durationMs
          continue
        }
        // Self-paced. A rung takes its count from the ladder around it.
        const count =
          block.reps?.kind === 'fixed' ? block.reps.count : block.reps?.kind === 'rung' ? rung : null
        if (count !== null && count > 0) {
          estimatedMs += stepMs(block.name, count, block.reps?.perSide === true, measured)
        }
        continue
      }

      if (block.kind === 'repeat') {
        const before = { knownMs, estimatedMs }
        walk(block.children, rung)
        const once = { known: knownMs - before.knownMs, estimated: estimatedMs - before.estimatedMs }
        // The first pass is already counted, so add the rest.
        const more = Math.max(0, Math.floor(block.times) - 1)
        knownMs += once.known * more
        estimatedMs += once.estimated * more

        /*
         * A group's trailing rest does not run after the final rep, exactly as
         * `compile()` has it. Counting it every time would add a rest the
         * routine never plays.
         */
        const last = block.children.at(-1)
        if (last?.kind === 'segment' && last.role === 'rest' && last.durationMs !== undefined) {
          knownMs -= last.durationMs
        }
        continue
      }

      if (block.kind === 'ladder') {
        // Every rung, with the rung's own count where a child asks for it.
        for (const count of block.counts) walk(block.children, count)
        continue
      }

      walk(block.children, rung)
    }
  }

  walk(blocks, null)
  return { knownMs, estimatedMs, rough: estimatedMs > 0 }
}
