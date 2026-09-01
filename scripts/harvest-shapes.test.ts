/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Regenerates src/routines/exercises.shapes.ts from the instructor emails.
 *
 *     npm run harvest
 *
 * The generator can build a circuit. It cannot build the thing Wayne is actually
 * sent, which is six or seven named sections, two or three of them ladders, and
 * most of the steps counted rather than timed.
 *
 * The SHAPE of that is in the corpus as much as the exercises are, so it is read
 * rather than invented:
 *
 *   LADDER_COUNTS   the pyramids the instructor actually writes, commonest
 *                   first. Nineteen of them, and nearly all symmetric. Used
 *                   verbatim: a generated `4-9-14-9-4` would be arithmetically
 *                   fine and unlike anything she has ever been given.
 *
 *   SECTION_THEMES  the headings, in the order they appear. Warm-up, General
 *                   Body, Arms & Shoulders, Legs, Core, Finisher. Every routine
 *                   is a subset of that in that order.
 *
 *   SECTION_FORMATS which formats she writes each theme in, with counts. Most
 *                   sections are a plain list of counted exercises, but she also
 *                   writes an EMOM, a 30/30 interval and an AMRAP. The generator
 *                   picks a format weighted by these, so a 30/30 Legs turns up
 *                   about as often as she sends one.
 *
 *   SECTION_SIZE    how many exercises a themed section holds.
 *
 *   WARM_UP_MOVES   every movement that has opened a session, by folded name.
 *                   The warm-up draws its cardio from these and nothing else:
 *                   the cardio pool also holds burpees and plank jacks, which
 *                   she has never asked anyone to warm up with.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import type { Block } from '../src/engine/types'
import { parseRoutine } from '../src/routines/pasteFormat'
import { foldName } from '../src/routines/foldName'

const EMAILS = 'src/routines/__tests__/emails'
const OUT = 'src/routines/exercises.shapes.ts'

/**
 * The themes, and what a heading has to say to count as one.
 *
 * A closed list in the order the routines use, because the ORDER is the finding:
 * a warm-up first and a finisher last, with the body between them. Anything that
 * matches none of these is one of the instructor's one-off headings and is not a
 * theme worth generating.
 */
const THEMES: { theme: string; test: RegExp; areas: string[] }[] = [
  { theme: 'Warm-up', test: /warm[\s-]?up/i, areas: ['lower', 'upper'] },
  { theme: 'General Body', test: /general body/i, areas: ['lower', 'torso', 'upper'] },
  // `\b` in front, or "arm" matches inside "Warm up" — harmless for the
  // first-match classification (the Warm-up row wins) but it counted an arms
  // section into every routine's presence tally.
  { theme: 'Arms & Shoulders', test: /\barms?(\s*&\s*shoulders)?\b|shoulders/i, areas: ['upper'] },
  // `^\W*` for the asterisk-wrapped "*Legs*" headings four of the emails use,
  // which an anchor alone left unclassified; the lookahead sends "Legs Finisher"
  // (five emails) to the Finisher row below instead of counting it as a second
  // Legs, which had inverted the per-routine tallies.
  { theme: 'Legs', test: /^\W*legs?\b(?!.*\b(?:finisher|burn(?:out|er)?)\b)/i, areas: ['lower'] },
  { theme: 'Core', test: /core|abs?\b/i, areas: ['torso'] },
  // `\bburn\b` for "#5 FULL-LEG BURN – EVERY MINUTE ON THE MINUTE" (2026-08-25),
  // her finisher-slot EMOM, which "burnout|burner" left unread: the harvest saw
  // her declare an AMRAP finisher but never this one. CAUTION: this row is the
  // last resort of a first-match walk, so any future heading with a bare "burn"
  // that no row above claims ("TOTAL BODY BURN") lands here — review the
  // regenerated exercises.shapes.ts diff whenever a new email is added.
  { theme: 'Finisher', test: /finisher|burnout|burner|\bburn\b/i, areas: ['lower', 'torso'] },
]

/**
 * How a section is run, when she says so in its heading or the line under it.
 *
 * She declares these: "#3 LEGS - 30/30 INTERVAL", "5-Minute EMOM", "10-MINUTE
 * AMRAP". A section that declares nothing is `standard`, which is the counted
 * list most of them are. Read off the DECLARATION rather than the parsed steps,
 * because the shapes collide once parsed: her Core planks are also a repeat of
 * 30-second steps, and only the heading separates them from a 30/30.
 */
const FORMATS: { format: string; test: RegExp }[] = [
  { format: 'amrap', test: /\bamrap\b|as many rounds as possible/i },
  { format: 'emom', test: /\bemom\b|every minute on the minute/i },
  { format: 'interval30', test: /\b30\s*\/\s*30\b/i },
]

describe('harvest shapes', () => {
  it('writes the ladders and the section skeleton', () => {
    const ladders = new Map<string, number>()
    const themeCounts = new Map<string, number>()
    /** Keyed `theme|format`. */
    const formatCounts = new Map<string, number>()
    const sizes: number[] = []
    const warmUpMoves = new Set<string>()
    let routines = 0
    /** Routines that name at least three distinct themes; see below. */
    let themedRoutines = 0
    /** Per theme, how many of the themed routines carry it at least once. */
    const themeInRoutines = new Map<string, number>()
    const sectionsPer: number[] = []

    for (const file of readdirSync(EMAILS).filter((f) => f.endsWith('.txt')).sort()) {
      routines += 1
      let sections = 0
      /*
       * Which themes THIS routine names, matched against every row rather than
       * the first: "Abs & arms" is evidence of an arms section AND a core one,
       * whatever single bucket the section itself is counted into. Feeds the
       * per-routine absence tallies below, which the generator uses to decide
       * what to drop when the minutes run out — a per-SECTION count cannot say
       * that ("Arms & Shoulders" reaches seventeen sections in sixteen routines).
       */
      const present = new Set<string>()
      const walk = (blocks: readonly Block[]) => {
        for (const block of blocks) {
          if (block.kind === 'ladder') {
            const key = block.counts.join('-')
            ladders.set(key, (ladders.get(key) ?? 0) + 1)
          }
          if (block.kind === 'section') {
            sections += 1
            for (const t of THEMES) if (t.test.test(block.name)) present.add(t.theme)
            const theme = THEMES.find((t) => t.test.test(block.name))?.theme
            if (theme) themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1)
            if (theme) {
              // The heading AND the note under it: "GENERAL BODY" says nothing,
              // and the "10-MINUTE AMRAP" below it says all of it.
              const said = `${block.name} ${block.note ?? ''}`
              const format = FORMATS.find((f) => f.test.test(said))?.format ?? 'standard'
              const key = `${theme}|${format}`
              formatCounts.set(key, (formatCounts.get(key) ?? 0) + 1)
            }
            if (theme === 'Warm-up') {
              const steps = (blocks: readonly Block[]): void => {
                for (const b of blocks) {
                  if (b.kind === 'segment') {
                    if (b.role === 'work' && foldName(b.name)) warmUpMoves.add(foldName(b.name))
                  } else steps(b.children)
                }
              }
              steps(block.children)
            }
            // Exercises, not groups: a ladder counts as the one thing it is.
            if (block.children.length > 1) sizes.push(block.children.length)
          }
          if (block.kind !== 'segment') walk(block.children)
        }
      }
      walk(parseRoutine(readFileSync(`${EMAILS}/${file}`, 'utf8'), file).blocks)
      sectionsPer.push(sections)
      /*
       * Only a routine that NAMES its sections can show a theme being left out:
       * the two terse April emails head their sections "#1", "#2" and would
       * otherwise count as omitting everything at once. Three distinct themes is
       * the line between "she names her sections" and "bare markers".
       */
      if (present.size >= 3) {
        themedRoutines += 1
        for (const theme of present) themeInRoutines.set(theme, (themeInRoutines.get(theme) ?? 0) + 1)
      }
    }

    const ordered = [...ladders.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const median = (values: number[]) =>
      [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]!

    console.log(`${routines} routines`)
    console.log(`  ladder shapes    : ${ordered.length}`)
    console.log(`  sections each    : ${median(sectionsPer)} typical, ${Math.min(...sectionsPer)} to ${Math.max(...sectionsPer)}`)
    console.log(`  exercises a piece: ${median(sizes)} typical`)
    for (const { theme } of THEMES) {
      const declared = [...formatCounts.entries()]
        .filter(([key, seen]) => key.startsWith(`${theme}|`) && !key.endsWith('|standard') && seen > 0)
        .map(([key, seen]) => `${key.split('|')[1]} ${seen}`)
      console.log(
        `      ${theme}: ${themeCounts.get(theme) ?? 0}${declared.length > 0 ? ` (${declared.join(', ')})` : ''}`,
      )
    }
    console.log(`  warm-up moves    : ${warmUpMoves.size}`)

    const rungs = ordered
      .map(([counts, seen]) => `  { counts: [${counts.split('-').join(', ')}], seen: ${seen} },`)
      .join('\n')
    const themes = THEMES.map(
      ({ theme, areas }) =>
        `  { theme: '${theme}', areas: [${areas.map((a) => `'${a}'`).join(', ')}], seen: ${themeCounts.get(theme) ?? 0}, absent: ${themedRoutines - (themeInRoutines.get(theme) ?? 0)} },`,
    ).join('\n')

    /** Every theme and format pair seen, in theme order, commonest format first. */
    const formats = THEMES.flatMap(({ theme }) =>
      [...formatCounts.entries()]
        .filter(([key]) => key.startsWith(`${theme}|`))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, seen]) => `  { theme: '${theme}', format: '${key.split('|')[1]}', seen: ${seen} },`),
    ).join('\n')

    writeFileSync(
      OUT,
      `/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * The SHAPE of an instructor routine, read out of the ${routines} we hold.
 *
 * GENERATED by \`scripts/harvest-shapes.test.ts\`. Do not edit by hand: run
 * \`npm run harvest\`.
 *
 * A generator that knows the exercises but not the shape produces a list. These
 * are the ladders the instructor actually writes and the sections she actually
 * names, so what comes out reads like what she sends rather than like arithmetic.
 */

export type LadderShape = {
  /** Reps at each rung, exactly as written. */
  counts: readonly number[]
  /** How many of the ${routines} routines use it. */
  seen: number
}

/**
 * Used VERBATIM, never generated. \`4-9-14-9-4\` would be arithmetically fine and
 * unlike anything she has been given; \`2-4-6-8-10-8-6-4-2\` is what she knows.
 * Commonest first.
 */
export const LADDER_COUNTS: readonly LadderShape[] = [
${rungs}
]

export type SectionTheme = {
  theme: string
  /** Which body areas belong in it. */
  areas: readonly string[]
  /** Sections carrying the theme, across all ${routines} routines. More than one can share a routine. */
  seen: number
  /**
   * Of the ${themedRoutines} routines that name at least three distinct themes,
   * how many have NO section of this one. The two terse April emails head their
   * sections "#1", "#2" and can show nothing about what she leaves out, so they
   * are not counted. A heading naming two themes ("Abs & arms") is presence for
   * both. What the generator drops first when the minutes run out.
   */
  absent: number
}

/**
 * In the order the routines use them, which is the finding: a warm-up first and
 * a finisher last, with the body between. Every routine is a subset of this list
 * in this order.
 */
export const SECTION_THEMES: readonly SectionTheme[] = [
${themes}
]

export type SectionFormat = 'standard' | 'emom' | 'interval30' | 'amrap'

export type ThemeFormat = {
  theme: string
  format: SectionFormat
  /** How many of the ${routines} routines write that theme that way. */
  seen: number
}

/**
 * How she runs each theme, and how often.
 *
 * \`standard\` is the counted list most sections are. The other three are formats
 * she declares in the heading: an EMOM (a minute an exercise, work then rest out
 * the minute), a 30/30 interval, and an AMRAP (one clock, rounds until it stops).
 * The generator picks from this weighted by \`seen\`, so they come up about as
 * often as she writes them, which is rarely.
 */
export const SECTION_FORMATS: readonly ThemeFormat[] = [
${formats}
]

/** Routines harvested. Against a theme's \`seen\`, how often she leaves it out. */
export const ROUTINES = ${routines}

/** Sections in a routine: ${median(sectionsPer)} typical, ${Math.min(...sectionsPer)} to ${Math.max(...sectionsPer)}. */
export const SECTIONS_TYPICAL = ${median(sectionsPer)}
export const SECTIONS_MIN = ${Math.min(...sectionsPer)}
export const SECTIONS_MAX = ${Math.max(...sectionsPer)}

/** Exercises in a themed section. */
export const SECTION_SIZE = ${median(sizes)}

/**
 * Every movement that has opened one of her sessions, folded the way
 * \`exercises.prescription.ts\` folds names. What a warm-up may be made of.
 */
export const WARM_UP_MOVES: readonly string[] = [
${[...warmUpMoves].sort().map((m) => `  '${m.replace(/'/g, "\\'")}',`).join('\n')}
]
`,
      'utf8',
    )
    expect(ordered.length).toBeGreaterThan(10)
  })
})
