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
import { EXERCISES } from '../src/routines/exercises'
import { parseRoutine } from '../src/routines/pasteFormat'

const EMAILS = 'src/routines/__tests__/emails'
const OUT = 'src/routines/exercises.prescription.ts'

/**
 * A name reduced to what it is, for comparing across sixteen spellings.
 *
 * Drops anything bracketed, any count, any per-side qualifier, and any trailing
 * plural. "10x Bicycle Crunches (per leg)" and "Bicycle crunch" meet here.
 */
function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s*[×x]?\s*/g, ' ')
    .replace(/\b(?:each|per)\s+(?:side|leg|arm|direction)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    // "Fire hydrant left leg" and "Fire hydrant right leg" are one exercise done
    // twice, not two. The side is a field, not part of the name.
    .replace(/\b(?:left|right)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ')
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]!
}

type Seen = { reps: number[]; seconds: number[]; rung: number }

describe('harvest', () => {
  it('writes the prescription table', () => {
    const seen = new Map<string, Seen>()
    const bump = (name: string): Seen => {
      const k = key(name)
      const found = seen.get(k) ?? { reps: [], seconds: [], rung: 0 }
      seen.set(k, found)
      return found
    }

    const walk = (blocks: readonly Block[]) => {
      for (const block of blocks) {
        if (block.kind !== 'segment') {
          walk(block.children)
          continue
        }
        if (block.role !== 'work' || !key(block.name)) continue
        const entry = bump(block.name)
        if (block.reps?.kind === 'fixed') entry.reps.push(block.reps.count)
        if (block.reps?.kind === 'rung') entry.rung += 1
        // A warm-up minute is a directive's doing, not the exercise's own.
        if (block.durationMs !== undefined && block.durationMs <= 120_000) {
          entry.seconds.push(Math.round(block.durationMs / 1000))
        }
      }
    }

    const files = readdirSync(EMAILS).filter((f) => f.endsWith('.txt')).sort()
    for (const file of files) {
      walk(parseRoutine(readFileSync(`${EMAILS}/${file}`, 'utf8'), file).blocks)
    }

    // Onto the names the app actually uses. Anything that does not land is
    // printed: a quiet miss looks the same as a match.
    const rows: string[] = []
    const matched = new Set<string>()
    for (const exercise of EXERCISES) {
      const found = seen.get(key(exercise.name))
      if (!found) continue
      matched.add(key(exercise.name))
      const counted = found.reps.length >= found.seconds.length && found.reps.length > 0
      const fields = [`name: '${exercise.name.replace(/'/g, "\\'")}'`]
      fields.push(`prescribe: '${counted ? 'reps' : 'time'}'`)
      if (found.reps.length) fields.push(`reps: ${median(found.reps)}`)
      if (found.seconds.length) fields.push(`seconds: ${median(found.seconds)}`)
      if (found.rung > 0) fields.push('rung: true')
      rows.push(`  { ${fields.join(', ')} },`)
    }

    const missed = [...seen.keys()].filter((k) => !matched.has(k) && k.split(' ').length <= 6)
    console.log(`${files.length} routines, ${seen.size} distinct movements`)
    console.log(`  matched to the table : ${rows.length}`)
    console.log(`  in the emails only   : ${missed.length}`)
    for (const name of missed.slice(0, 40)) console.log(`      ${name}`)

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
 * An exercise absent from here has simply never appeared in a routine we hold.
 */

export type Prescription = {
  name: string
  /** Whichever the instructor uses more often for it. */
  prescribe: 'reps' | 'time'
  reps?: number
  seconds?: number
  /** It has been a ladder's main lift, so it can scale with the rungs. */
  rung?: boolean
}

export const PRESCRIPTIONS: readonly Prescription[] = [
${rows.join('\n')}
]
`,
      'utf8',
    )
    expect(rows.length).toBeGreaterThan(30)
  })
})
