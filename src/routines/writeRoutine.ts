/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * A routine written back out as text the paste parser can read.
 *
 * The inverse of `parseRoutine`, and deliberately a NARROW inverse. The parser
 * reads a human's handout, so many surface forms land on the same blocks; this
 * writes exactly one form per block and leans on the round-trip test to prove
 * the choice reads back.
 *
 * It is LOSSY, and that is the point of `lost`: text is how you send a routine
 * to someone, not how you back one up. A bundle is the backup. Everything the
 * grammar has no way to say is collected and reported rather than dropped in
 * silence, because a share that quietly loses the pictures looks like it worked.
 *
 * What cannot survive, and why:
 *
 *  - IMAGES. There is no syntax for one, and the illustrations are the whole
 *    point of most of these routines.
 *  - The routine's NAME, COLOUR and favourite mark. The name is carried by the
 *    download's filename and typed into the paste dialog on the way back; the
 *    other two are library state, not routine content.
 *  - A `recover` or `custom` step. `segment()` in the parser derives the role
 *    from the NAME alone: "rest" makes a rest, "Get ready" makes a prepare, and
 *    everything else is work. A step whose role does not match its name comes
 *    back as work.
 *  - A note under `NOTE_MIN` characters. A short parenthesis stays in the name
 *    on the way back in, because at that length it is part of what the exercise
 *    is called, so writing one would rename the step instead of annotating it.
 *  - A section's own note, unless it is one of the handful of instructions the
 *    parser recognises. Any other line there would be read as a step.
 *  - `advance`, and a section's `display`. Both are inferred on the way in from
 *    the shape of the section, never stated.
 */

import type { Block, Ladder, Repeat, Section, Segment, Workout } from '../engine/types'
import { isGroup } from '../engine/types'
import { DESCRIPTION_CHARS, GET_READY_MS, parseItem, PREPARE_NAME, REST_NAME } from './pasteFormat'

/**
 * The shortest parenthesis the parser treats as a note rather than as part of
 * the name. The parser's own constant, imported rather than copied: these used
 * to be declared twice, with a comment asking that they be kept in step.
 */
const NOTE_MIN = DESCRIPTION_CHARS

/** Roles the parser can rebuild from a step's name. */
const ROLE_FROM_NAME = new Set(['work', 'rest', 'prepare'])

export type WrittenRoutine = {
  text: string
  /** One line per thing the grammar cannot say. Empty when nothing was lost. */
  lost: string[]
}

/**
 * Seconds, or minutes where they divide exactly.
 *
 * "600 seconds" is a correct way to write a ten-minute warm-up and a poor way to
 * read one. Both forms parse.
 */
function durationText(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
}

/** The trailing rest of a reps group, which the parser rebuilds from a line of its own. */
function trailingRest(children: readonly Block[]): Segment | null {
  const last = children.at(-1)
  if (!last || last.kind !== 'segment' || last.role !== 'rest') return null
  return last.durationMs === undefined ? null : last
}

/**
 * One step, as a bulleted line plus any line that belongs under it.
 *
 * Order inside the line is count, name, then time, because that is the order the
 * parser's own template writes them and the order they read aloud.
 */
function stepLines(segment: Segment, lost: string[]): string[] {
  let line = '* '
  const reps = segment.reps

  /*
   * A count and a time cannot be written on the same step. The parser reads
   * "12 × Bicep Curls - 60 seconds" as a step CALLED "12 × Bicep Curls", because
   * a trailing duration ends the name and the count in front of it is by then
   * part of what the step is called. Only an EMOM's "Minute 1:" says both, and
   * that form needs a minute and an EMOM to sit in.
   *
   * So the time wins and the count is reported. The time is the part the app
   * actually runs; a count it cannot count is a label.
   */
  const countable = reps?.kind === 'fixed' && segment.durationMs === undefined

  if (reps?.kind === 'fixed' && !countable) {
    lost.push(`The count on "${segment.name}" (${reps.count} ×), which is also timed`)
  }

  if (countable && reps.kind === 'fixed') {
    /*
     * A per-side count is written as the parser's own form: the doubled total in
     * front, the true per-side number in the parenthesis. Writing "5 each side"
     * as a tail does NOT read back; it stays in the name.
     */
    line += reps.perSide ? `${reps.count * 2} × ` : `${reps.count} × `
  }

  /*
   * The load goes back into the NAME, which is where the grammar can carry it:
   * there is no syntax for a weight, and "Leg Press 65kg" is exactly how these
   * routines were written before the field existed. So it survives the round
   * trip, and `storage/migrate.ts` lifts it out of the name again on the way in.
   *
   * Written out here rather than borrowed from `ui/format.ts`'s `nameWithLoad`,
   * which reads the same today: everything else in this file depends only on the
   * engine, and a serializer reaching into the UI layer for a string would be the
   * one import pointing the wrong way. The round-trip test is what holds the two
   * spellings together.
   */
  const load = segment.load?.trim()
  line += load ? `${segment.name} ${load}` : segment.name

  if (countable && reps.kind === 'fixed' && reps.perSide) {
    line += ` (${reps.count} each side)`
  }

  /*
   * "20 × Front Punches + 20 × Uppercuts" is TWO steps to the parser, and it
   * splits only when both halves state a count. A name shaped like that cannot
   * be written back as one step, and there is no escape for it.
   */
  if (/\d\s*(?:×|x)?\s*[^+]*\+\s*\d/.test(segment.name)) {
    lost.push(`"${segment.name}" will split into two steps, because of the + between two counts`)
  }

  const bare = line
  let note: string | null = null
  if (segment.note !== undefined && segment.note.trim() !== '') {
    if (segment.note.includes('\n')) {
      // A parenthesis cannot hold a line break. The AMRAP whose round is its
      // note is written as an AMRAP instead; see `amrapLines`.
      lost.push(`The note on "${segment.name}", which runs to several lines`)
    } else if (segment.note.length >= NOTE_MIN) {
      note = segment.note
      line += ` (${segment.note})`
    } else {
      lost.push(`Note on "${segment.name}" is too short to survive: "${segment.note}"`)
    }
  }

  const time = segment.durationMs !== undefined ? ` - ${durationText(segment.durationMs)}` : ''
  line += time

  /*
   * Read back before it is written out. The grammar has no escaping, so a note
   * that says "hold for 2 seconds" or contains a parenthesis of its own is read
   * as a duration or as the end of the name: "Plank (hold for 2 seconds at the
   * top) - 40 seconds" came back as a two-second step called "Plank (hold", and
   * nothing said so. A line the parser reads differently from what it means
   * loses its note and says why; one that is wrong even bare is reported.
   */
  const expectedName = load ? `${segment.name} ${load}` : segment.name
  const readsBack = (text: string): boolean => {
    // Without its bullet, which the reader strips before `parseItem` sees a line.
    const back = parseItem(text.slice(2))
    return (
      back.name === expectedName &&
      back.durationMs === segment.durationMs &&
      back.count === (countable && reps.kind === 'fixed' ? reps.count : undefined)
    )
  }
  if (!readsBack(line)) {
    if (note !== null) {
      lost.push(`Note on "${segment.name}" would change how the step reads, so it was left out: "${note}"`)
      line = bare + time
    }
    if (!readsBack(line)) {
      lost.push(`"${segment.name}" will not read back as written`)
    }
  }

  if (!ROLE_FROM_NAME.has(segment.role)) {
    lost.push(`"${segment.name}" is a ${segment.role} step and will come back as work`)
  } else if (segment.role === 'rest' && !REST_NAME.test(segment.name)) {
    lost.push(`"${segment.name}" is a rest and will come back as work`)
  } else if (segment.role === 'prepare' && !PREPARE_NAME.test(segment.name)) {
    lost.push(`"${segment.name}" is a get-ready step and will come back as work`)
  } else if (segment.role === 'work' && REST_NAME.test(segment.name)) {
    lost.push(`"${segment.name}" will come back as a rest, because of its name`)
  }

  if (segment.media) lost.push(`The picture on "${segment.name}"`)

  const lines = [line]
  if (segment.alternative !== undefined && segment.alternative.trim() !== '') {
    lines.push(`or ${segment.alternative}`)
  }
  return lines
}

/** A ladder: the counts, the lift that scales, and the accessories that do not. */
function ladderLines(ladder: Ladder, counter: { n: number }, lost: string[]): string[] {
  if (ladder.label && ladder.label.trim() !== '' && ladder.label !== 'Set') {
    lost.push(`The name "${ladder.label}" on a ladder; it will come back as "Set"`)
  }
  const lines = [`Counting: ${ladder.counts.join('-')}`]

  const scaling = ladder.children.filter(
    (child) => child.kind === 'segment' && child.reps?.kind === 'rung',
  )
  const fixed = ladder.children.filter(
    (child) => child.kind !== 'segment' || child.reps?.kind !== 'rung',
  )

  if (scaling.length > 0) {
    lines.push('Main exercise:')
    lines.push(...siblingLines(scaling, counter, lost, false))
  }
  if (fixed.length > 0) {
    lines.push('After every set:')
    lines.push(...siblingLines(fixed, counter, lost, false))
  }
  return lines
}

/** A reps group: the count, the steps, and the rest that belongs between them. */
function repeatLines(repeat: Repeat, counter: { n: number }, lost: string[]): string[] {
  const rest = trailingRest(repeat.children)
  const body = rest ? repeat.children.slice(0, -1) : repeat.children

  // The grammar names every group "Rounds"; the reader's migration then calls
  // it "Set". Any other name is the user's, and does not survive.
  if (repeat.label && repeat.label !== 'Set' && repeat.label !== 'Round') {
    lost.push(`The name "${repeat.label}" on a group of ${repeat.times}; it will come back as "Set"`)
  }
  const lines = [`${repeat.times} Rounds`]
  lines.push(...siblingLines(body, counter, lost, false))
  if (rest) lines.push(`Rest ${durationText(rest.durationMs!)} after each round`)
  return lines
}

function sectionLines(
  section: Section,
  counter: { n: number },
  lost: string[],
  headingAfter: boolean,
): string[] {
  if (section.note !== undefined && section.note.trim() !== '') {
    lost.push(`The note on section "${section.name}": "${section.note}"`)
  }
  /*
   * Numbered, always. A bare heading is only recognised where it is one of the
   * handful of known names, and "any short line in title case" would swallow
   * half the exercises, so the number is what makes an arbitrary name a heading.
   */
  return [
    `#${counter.n} ${section.name}`,
    ...siblingLines(section.children, counter, lost, headingAfter),
  ]
}

/**
 * A run of blocks that sit side by side, with the separators they need.
 *
 * `Then:` is the rule that has to live here rather than at the top level: a
 * rounds group claims everything below it until a heading arrives, so a loose
 * step after one is read INTO it. That is as true of a section's children as it
 * is of the routine's.
 */
function siblingLines(
  blocks: readonly Block[],
  counter: { n: number },
  lost: string[],
  /** True where a section heading, or the end of the text, follows this list. */
  headingAfter: boolean,
): string[] {
  const out: string[] = []
  blocks.forEach((block, i) => {
    if (block.kind === 'section') counter.n += 1
    const next = blocks[i + 1]
    const heading = next === undefined ? headingAfter : next.kind === 'section'
    out.push(...blockLines(block, counter, lost, heading))
    if (next !== undefined && !isGroup(next) && claimsWhatFollows(block)) out.push('Then:')
  })
  return out
}

/**
 * True where a block, once written, would read the next loose step into itself.
 *
 * A rounds group and a ladder claim everything below them until `Then:` or a
 * heading. An AMRAP is not on this list even though it claims harder than
 * either: nothing short of a section heading ends its round, so it is never
 * WRITTEN as an AMRAP unless a heading already follows. See `blockLines`.
 */
function claimsWhatFollows(block: Block): boolean {
  return block.kind === 'repeat' || block.kind === 'ladder'
}

/**
 * The AMRAP step written back as the AMRAP it came from.
 *
 * The parser turns "6-minute AMRAP" plus a bulleted list into ONE timed step
 * named `AMRAP_STEP`, carrying the round as a multi-line note. A parenthesis
 * cannot hold those line breaks, so the only way to write it is as the thing it
 * was: the heading, then the round as bullets again.
 */
const AMRAP_STEP = 'As many rounds as possible'

function amrapLines(segment: Segment): string[] | null {
  if (segment.name !== AMRAP_STEP) return null
  if (segment.durationMs === undefined || segment.note === undefined) return null
  const seconds = Math.round(segment.durationMs / 1000)
  if (seconds < 60 || seconds % 60 !== 0) return null
  const round = segment.note.split('\n').filter((line) => line.trim() !== '')
  if (round.length === 0) return null
  return [
    `${seconds / 60}-minute AMRAP (as many rounds as possible)`,
    ...round.map((line) => `* ${line}`),
  ]
}

function blockLines(
  block: Block,
  counter: { n: number },
  lost: string[],
  headingAfter: boolean,
): string[] {
  /*
   * The AMRAP form is only safe with a SECTION HEADING behind it.
   *
   * Its round is the bulleted list below the heading, and it goes on collecting
   * bullets until a heading arrives. `Then:` does not stop it: that ends a
   * rounds group, and an AMRAP is a step. So anywhere else the AMRAP is written
   * as the plain timed countdown it is, and `stepLines` reports the round it
   * could not carry. That is the whole of what a text export loses on the
   * template, and it settles there.
   */
  if (block.kind === 'segment') {
    return (headingAfter ? amrapLines(block) : null) ?? stepLines(block, lost)
  }
  if (block.kind === 'repeat') return repeatLines(block, counter, lost)
  if (block.kind === 'ladder') return ladderLines(block, counter, lost)
  return sectionLines(block, counter, lost, headingAfter)
}

/**
 * Writes a routine as text.
 *
 * Blank lines separate top-level blocks, and `Then:` closes a group that is
 * followed by loose steps, since a rounds group otherwise runs on to everything
 * below it until a heading arrives.
 */
export function writeRoutine(workout: Workout): WrittenRoutine {
  const lost: string[] = []
  const parts: string[] = []
  /*
   * The five seconds the parser adds are not written back.
   *
   * `parseRoutine` prepends exactly this step unless the text already opens on a
   * get-ready, and it prepends it LOOSE, above any section. Writing it as a
   * bullet would put it inside the first section instead, so a routine that had
   * been through text once would sit one level deeper every time it went
   * through again. Leaving it out lets the parser put back what it took, which
   * is the only way this settles.
   *
   * A get-ready of any other length is the user's, and is written.
   */
  const head = workout.blocks[0]
  const blocks =
    head?.kind === 'segment' &&
    head.role === 'prepare' &&
    head.name === 'Get ready' &&
    head.durationMs === GET_READY_MS
      ? workout.blocks.slice(1)
      : workout.blocks

  const counter = { n: 0 }
  blocks.forEach((block, i) => {
    if (block.kind === 'section') counter.n += 1
    const next = blocks[i + 1]
    // The end of the text closes an AMRAP as surely as a heading does.
    const heading = next === undefined ? true : next.kind === 'section'
    const lines = blockLines(block, counter, lost, heading)
    if (next !== undefined && !isGroup(next) && claimsWhatFollows(block)) lines.push('Then:')
    /*
     * A blank line sets a group or a section apart from what surrounds it. A run
     * of loose steps is just a list and reads better without the gaps, which on
     * a routine like the mixed-cardio ones is the difference between one screen
     * and three. Blank lines mean nothing to the parser either way.
     */
    const part = lines.join('\n')
    const previous = blocks[i - 1]
    if (i > 0) {
      const tight =
        !isGroup(block) &&
        previous !== undefined &&
        (!isGroup(previous) || parts[parts.length - 1]?.endsWith('Then:') === true)
      parts.push(tight ? '\n' : '\n\n')
    }
    parts.push(part)
  })

  if (workout.colour !== undefined) lost.push(`The routine's colour (${workout.colour})`)
  if (workout.favourite) lost.push('The favourite mark')
  lost.push(`The routine's name ("${workout.name}"), which is typed in on the way back`)

  return { text: parts.join('') + '\n', lost }
}

/** A filesystem-safe filename for a text export, so the name survives the trip. */
export function textFilename(name: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 10)
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'routine'}-${stamp}.txt`
}
