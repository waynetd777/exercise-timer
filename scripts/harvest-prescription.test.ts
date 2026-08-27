/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Regenerates src/routines/exercises.prescription.ts from the instructor emails.
 *
 *     npm run harvest
 *
 * NOT part of `npm test`: it has its own config, because it WRITES a source file
 * and a test that rewrites the tree on every run is not a test. It is a generator that happens to be
 * written as a test, because the only reader of these emails is the app's own
 * parser and that is TypeScript. A second parser in Python would be a second
 * thing to keep true.
 *
 * WHAT IT ANSWERS
 *
 * The exercise table knows what each movement IS. It does not know how the
 * instructor prescribes it, and the generator has to guess: everything comes out
 * as twenty timed seconds, when half these exercises are counted and the counts
 * are not arbitrary. Twelve hammer curls, twenty bent-over rows, a thirty-second
 * plank.
 *
 * So, per exercise, from sixteen routines:
 *
 *   prescribe  reps or time, whichever the instructor uses more often
 *   reps       the median count, where it is counted
 *   seconds    the median duration, where it is timed
 *   rung       whether it has ever been a ladder's main lift
 *
 * A median rather than a mean: these are round numbers a person chose, and the
 * mean of 10 and 20 is 15, which nobody wrote.
 *
 * MATCHING is the part to distrust. The emails spell Mountain Climbers three
 * ways and Bulgarian Split Squat four, so every name is reduced to a key before
 * it is compared, and the run PRINTS what it could not place. A silent 60% match
 * rate would look exactly like a good one.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import type { Block } from '../src/engine/types'
import { parseRoutine } from '../src/routines/pasteFormat'
import { fold } from './fold'

const EMAILS = 'src/routines/__tests__/emails'
const OUT = 'src/routines/exercises.prescription.ts'

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]!
}

type Seen = { reps: number[]; seconds: number[]; rung: number; paired: number[] }

describe('harvest', () => {
  it('writes the prescription table', () => {
    const seen = new Map<string, Seen>()
    const bump = (name: string): Seen => {
      const k = fold(name)
      const found = seen.get(k) ?? { reps: [], seconds: [], rung: 0, paired: [] }
      seen.set(k, found)
      return found
    }

    const walk = (blocks: readonly Block[]) => {
      for (const block of blocks) {
        if (block.kind !== 'segment') {
          walk(block.children)
          continue
        }
        if (block.role !== 'work' || !fold(block.name)) continue
        const entry = bump(block.name)
        if (block.reps?.kind === 'fixed') entry.reps.push(block.reps.count)
        if (block.reps?.kind === 'rung') entry.rung += 1
        // A warm-up minute is a directive's doing, not the exercise's own.
        if (block.durationMs !== undefined && block.durationMs <= 120_000) {
          entry.seconds.push(Math.round(block.durationMs / 1000))
        }
        /*
         * Kept apart for the RATE, which needs the two halves of a pair that are
         * never written on one line: a "30-second Plank" one week and a
         * "20 x Plank" another.
         *
         * Under a minute only. A 60-second entry is almost always an EMOM
         * minute, where the reps are done and then you REST for the balance, so
         * counting one would say a bicep curl takes five seconds.
         */
        if (block.durationMs !== undefined && block.durationMs < 60_000) {
          entry.paired.push(block.durationMs / 1000)
        }
      }
    }

    const files = readdirSync(EMAILS).filter((f) => f.endsWith('.txt')).sort()
    for (const file of files) {
      walk(parseRoutine(readFileSync(`${EMAILS}/${file}`, 'utf8'), file).blocks)
    }

    /*
     * Every movement in the corpus, keyed by its FOLDED name, rather than only
     * the ones the exercise table happens to hold today.
     *
     * It used to walk `EXERCISES`, which made this file depend on the exercise
     * harvest having already written its own: same process, module already
     * imported, stale table, 67 rows instead of the 200 the corpus can support.
     * A generated file that changes depending on what ran first is not one to
     * trust. The generator folds when it looks up, so nothing is lost.
     */
    const rows: string[] = []
    const matched = new Set<string>()
    for (const [key, found] of [...seen.entries()].sort()) {
      if (key.split(' ').length < 2) continue
      matched.add(key)
      const counted = found.reps.length >= found.seconds.length && found.reps.length > 0
      const fields = [`name: '${key.replace(/'/g, "\\'")}'`]
      fields.push(`prescribe: '${counted ? 'reps' : 'time'}'`)
      if (found.reps.length) fields.push(`reps: ${median(found.reps)}`)
      if (found.seconds.length) fields.push(`seconds: ${median(found.seconds)}`)
      if (found.rung > 0) fields.push('rung: true')
      // Held things are not repeated things: a stretch's "3 reps" is three
      // holds, and its rate says nothing about how fast anyone moves.
      if (found.paired.length > 0 && found.reps.length > 0 && !/stretch|hold/.test(key)) {
        const rate = median(found.paired) / median(found.reps)
        // Anything outside this is the format talking, not the movement.
        if (rate >= 0.5 && rate <= 6) fields.push(`secondsPerRep: ${Number(rate.toFixed(1))}`)
      }
      rows.push(`  { ${fields.join(', ')} },`)
    }

    console.log(`${files.length} routines, ${seen.size} distinct movements`)
    console.log(`  prescriptions written : ${rows.length}`)
    console.log(`  one word, left out    : ${seen.size - rows.length}`)

    writeFileSync(
      OUT,
      `/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * How the instructor prescribes each exercise.
 *
 * GENERATED by \`scripts/harvest-prescription.test.ts\` from the ${files.length} routines in
 * \`__tests__/emails\`. Do not edit by hand: run the harvest instead, and add
 * another email if an exercise is missing rather than typing a number in.
 *
 * The table in \`exercises.ts\` knows what a movement IS. This knows what is
 * asked of it: twelve reps or thirty seconds, and whether it has ever been a
 * ladder's main lift. Medians, because these are round numbers a person chose
 * and the mean of 10 and 20 is 15, which nobody wrote.
 *
 * Names are FOLDED: lower case, singular, no side, no count. Look one up with
 * \`foldName\` from \`./foldName\` rather than by \`Exercise.name\`. That is what lets this cover
 * every movement the corpus holds rather than only the ones the exercise table
 * happens to name today.
 */

export type Prescription = {
  name: string
  /** Whichever the instructor uses more often for it. */
  prescribe: 'reps' | 'time'
  reps?: number
  seconds?: number
  /**
   * How long one rep takes, where the instructor has written this exercise BOTH
   * ways and so said so himself. Absent for most of them.
   */
  secondsPerRep?: number
  /** It has been a ladder's main lift, so it can scale with the rungs. */
  rung?: boolean
}

export const PRESCRIPTIONS: readonly Prescription[] = [
${rows.join('\n')}
]
`,
      'utf8',
    )
    expect(rows.length).toBeGreaterThan(100)
  })
})
