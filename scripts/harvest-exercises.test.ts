/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Regenerates src/routines/exercises.harvested.ts from the instructor emails.
 *
 *     npm run harvest
 *
 * WHY THERE IS A SECOND EXERCISE FILE
 *
 * `exercises.other.ts` was authored by hand from FOUR routines. There are
 * sixteen now, and the prescription harvest reported 135 movements in them that
 * the table has never heard of: King squats, Zulu war dance, Around the world,
 * plank toe taps, dead bug with reach. A generator that cannot name them cannot
 * build a routine that reads like the ones Wayne is sent.
 *
 * Hand-authoring 135 more rows would be the same job again, and wrong again the
 * next time an email arrives. So this reads the corpus and classifies what it
 * finds, and `CORRECTIONS` below holds every place a human disagreed, so the
 * disagreement survives the next regeneration.
 *
 * WHAT IS GUESSED, AND HOW MUCH TO TRUST IT
 *
 *   area        from the movement in the name: squat and lunge are lower, plank
 *               and crunch are torso, press and curl are upper. Confident.
 *   pattern     push or pull, upper body only, the same rules the machine table
 *               uses. Confident, and the arguable ones are in `CORRECTIONS`.
 *   equipment   from the kit the name mentions. A name that mentions none is
 *               bodyweight, which is right far more often than not.
 *   use         cardio for the things you do to raise a heart rate, mobility for
 *               the things that open a joint. The LEAST confident of the four.
 *
 * Nothing here states a weight. The generator seeds one from what Wayne has
 * lifted before, and soon from the settings page.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import type { Block } from '../src/engine/types'
import { MACHINE_EXERCISES, OTHER_EXERCISES } from '../src/routines/exercises'
import { parseRoutine } from '../src/routines/pasteFormat'
import { fold } from './fold'

const EMAILS = 'src/routines/__tests__/emails'
const OUT = 'src/routines/exercises.harvested.ts'

/** Words that place a movement, most specific first. */
const AREA: [RegExp, string][] = [
  [/plank|crunch|sit ?up|v-?up|hollow|russian twist|oblique|dead ?bug|flutter|heel tap|leg raise|toe touch|knee raise|bicycle|ab\b|abs\b|mountain climber|windmill|torso/i, 'torso'],
  [/squat|lunge|calf|glute|hamstring|quad|leg (?:curl|extension|swing)|hip|kickback|fire hydrant|step ?up|bridge|skater|jump|bounce|knee lift|jog|run|heel dig|butt kick|fast feet|toe raise/i, 'lower'],
  [/press|curl|row|raise|fly|flye|punch|push ?up|push-?up|dip|pulldown|pull ?apart|shrug|tricep|bicep|shoulder|chest|arnold|around the world|arm|uppercut|plank jack/i, 'upper'],
]

const PATTERN: [string, RegExp][] = [
  ['pull', /rear|row|pulldown|curl|shrug|pull ?apart/i],
  ['push', /press|fly|flye|dip|extension|raise|push ?up|push-?up|punch|uppercut/i],
]

const EQUIPMENT: [RegExp, string][] = [
  [/kettle ?ball|kettlebell/i, 'kettlebell'],
  [/resistance band|\bband\b|\brb\b/i, 'band'],
  [/dumbbell|weights|goblet|arnold|hammer curl/i, 'dumbbell'],
  [/trampoline|rebound|bounce/i, 'trampoline'],
]

const CARDIO = /jog|run\b|jump|jack|burpee|climber|skater|fast feet|bounce|knee lift|high knee|butt kick|heel dig|punch|uppercut|sprint|shuffle|ski/i
const MOBILITY = /stretch|circle|swing|rotation|hug|soldier|inchworm|windmill|opener|mobilit/i

const PER_SIDE = /\b(?:each|per)\s+(?:side|leg|arm|direction)\b|\bleft\b|\bright\b|alternat/i

/**
 * Where the guess was wrong, and one human said so. Keyed by the harvested name.
 *
 * `null` drops a row: something that is not an exercise, or a duplicate of one
 * the hand-authored table already has under a better name.
 */
const CORRECTIONS: Record<string, Record<string, unknown> | null> = {
  // Not exercises: an instruction, a piece of kit, a heading that slipped through.
  Exercises: null,
  'B Weights': null,
  Weights: null,
  'Reps Min': null,
  'On Trampoline': null,
  'Time Left Wall Sit Till Min Is Over': null,

  // The hand-authored table already has these under a name it chose. Folding
  // cannot see through a rewording, only through a spelling.
  'Bodyweight Squats': null, // Squats
  'Curtsy Lunge': null, // Alternating Curtsy Lunges
  'Alternating Reverse Lunges': null, // Reverse Lunges
  'Jump Squats': null, // Squat Jumps
  'Bicycle Abs': null, // Bicycle Crunches
  'Rb Squats': null, // Band Squats
  'Rb Glute Kickbacks': null, // Band Glute Kickbacks
  'Glute Bridge Rb Abduction': null, // Glute Bridge with Band Abduction
  'Torso Rotations With Arms Extended': null, // Torso Rotations
  'High Plank Jack': null, // Plank Jacks, the same thing said twice
  'Reverse Lunges Side Lunge': null, // two movements run together, not one

  // Held with a weight, which the name does not say.
  'Around The World': { equipment: 'dumbbell', pattern: 'push' },
  'Squat With Front Raise': { equipment: 'dumbbell' },
  'Sit Up Press': { equipment: 'dumbbell' },
  'King Squats': { equipment: 'dumbbell' },
}

function classify(name: string): Record<string, unknown> | null {
  const area = AREA.find(([test]) => test.test(name))?.[1]
  if (!area) return null

  const use = CARDIO.test(name) ? 'cardio' : MOBILITY.test(name) ? 'mobility' : undefined
  const equipment = EQUIPMENT.find(([test]) => test.test(name))?.[1] ?? 'bodyweight'
  const pattern = area === 'upper' ? PATTERN.find(([, test]) => test.test(name))?.[0] : undefined

  return {
    name,
    area,
    ...(pattern ? { pattern } : {}),
    equipment,
    ...(use ? { use } : {}),
    ...(PER_SIDE.test(name) ? { perSide: true } : {}),
  }
}

/**
 * Trailing words that describe the SESSION rather than the movement.
 *
 * "Jumping Jacks Tabata Timer" and "Jog On The Spot Increase The Tempo" are one
 * exercise each with an instruction stuck to the end of the name.
 */
const TAIL_NOISE =
  /\s+(?:tabata(?:\s+timer)?|timer|increase the tempo|per (?:leg|arm|side)|with weights|on trampoline|use trampoline|optional|basic|left|right|tab \w+)\s*$/i

/** Title Case, and the qualifiers that belong in a field rather than a name. */
function canonical(raw: string): string {
  let text = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s*[×x]?\s*/g, ' ')
    .replace(/\b(?:each|per)\s+(?:side|leg|arm|direction)\b/gi, ' ')
    .replace(/[^\p{L}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Repeatedly, since two can be stacked: "… per leg (Tab 3)".
  for (let i = 0; i < 3; i++) text = text.replace(TAIL_NOISE, '')

  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const literal = (value: unknown): string =>
  typeof value === 'boolean' ? String(value) : `'${String(value).replace(/'/g, "\\'")}'`

describe('harvest exercises', () => {
  it('writes the exercises the corpus knows and the table does not', () => {
    const found = new Map<string, { name: string; routines: Set<string> }>()
    let file = ''
    const walk = (blocks: readonly Block[]) => {
      for (const block of blocks) {
        if (block.kind !== 'segment') {
          walk(block.children)
          continue
        }
        if (block.role !== 'work') continue
        const name = canonical(block.name)
        // Two words or more, and not something the parser synthesised.
        if (name.split(' ').length < 2 || /^(Rest|Recover|Get Ready|As Many)/i.test(name)) continue
        const key = fold(name)
        const entry = found.get(key) ?? { name, routines: new Set<string>() }
        // The shortest spelling wins: it is the one without the commentary.
        if (name.length < entry.name.length) entry.name = name
        entry.routines.add(file)
        found.set(key, entry)
      }
    }
    for (const name of readdirSync(EMAILS).filter((f) => f.endsWith('.txt')).sort()) {
      file = name
      walk(parseRoutine(readFileSync(`${EMAILS}/${file}`, 'utf8'), file).blocks)
    }

    /*
     * The AUTHORED tables only, never `EXERCISES`.
     *
     * `EXERCISES` includes this file's own output, so comparing against it made
     * the harvest eat itself: the first run wrote 16 rows, the second saw them
     * as already known, wrote none, and the table silently lost 16 exercises. A
     * generator whose output is an input to itself has to be told which half is
     * which.
     */
    const known = new Set([...MACHINE_EXERCISES, ...OTHER_EXERCISES].map((e) => fold(e.name)))
    const rows: string[] = []
    let dropped = 0
    let unplaceable = 0
    let once = 0

    const entries = [...found.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
    for (const [key, entry] of entries) {
      const name = entry.name
      if (known.has(key)) continue
      /*
       * Seen in at least TWO routines. An exercise the instructor comes back to
       * is part of the vocabulary; a movement named once is as likely to be a
       * phrasing of something else as a thing in its own right, and a generator
       * built on one-offs reads like a stranger wrote it.
       */
      if (entry.routines.size < 2) {
        once += 1
        continue
      }
      if (name in CORRECTIONS && CORRECTIONS[name] === null) {
        dropped += 1
        continue
      }
      const guessed = classify(name)
      if (!guessed) {
        unplaceable += 1
        continue
      }
      const row = { ...guessed, ...CORRECTIONS[name] }
      const fields = Object.entries(row).map(([k, v]) => `${k}: ${literal(v)}`)
      rows.push(`  { ${fields.join(', ')} },`)
    }

    console.log(`${found.size} distinct movements in the corpus`)
    console.log(`  already in the table : ${found.size - rows.length - dropped - unplaceable}`)
    console.log(`  harvested            : ${rows.length}`)
    console.log(`  dropped by hand      : ${dropped}`)
    console.log(`  could not be placed  : ${unplaceable}`)
    console.log(`  seen in one routine  : ${once} (left out)`)

    writeFileSync(
      OUT,
      `/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Everything the instructor has written that the hand-authored table does not
 * name.
 *
 * GENERATED by \`scripts/harvest-exercises.test.ts\` from the routines in
 * \`__tests__/emails\`. Do not edit by hand: run \`npm run harvest\`, and put a
 * human decision in that script's \`CORRECTIONS\` so it survives the next run.
 *
 * \`exercises.other.ts\` is the hand-authored core, written when there were four
 * routines. This is the rest, found by reading all of them. The area and the
 * equipment are read off the name and are usually right; \`use\` is the least
 * confident of the four fields.
 */

import type { Exercise } from './exercises'

export const HARVESTED_EXERCISES: readonly Exercise[] = [
${rows.join('\n')}
]
`,
      'utf8',
    )
    /*
     * That the CORPUS was read, not that new rows came out of it. The harvest is
     * idempotent: once its output is in the table, a second run finds nothing
     * new and should not fail for saying so.
     */
    expect(found.size).toBeGreaterThan(150)
  })
})
