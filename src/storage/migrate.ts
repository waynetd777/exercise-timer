/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, Segment, Workout } from '../engine'

/**
 * Forward-only fixes applied to a routine as it enters the app, from IndexedDB or
 * from an imported bundle.
 *
 * These run on READ rather than as a one-off rewrite, so an old export opened next
 * year is fixed the same way today's stored routines are, and nothing has to be
 * migrated in place before it can be read.
 */

/**
 * Repeat groups have been called "rounds" and then "reps", and every one created
 * by the editor stored that word as its literal label. They are SETS now, since
 * a group counts sets and the count of reps belongs on the step inside it, and
 * the label is DATA, so a code-only rename would leave existing routines saying
 * "Reps 2 of 3" forever.
 *
 * Only exact former defaults are renamed. A group someone deliberately named
 * "Round 1" or "Rounds" keeps its name. Theirs to choose, not ours to correct.
 *
 * `'Rep'` is in the list because it was briefly the default during the first
 * rename: short for repetitions, so it should always have been plural. It never
 * shipped, but a routine saved from a dev build could be carrying it.
 *
 * The default is SINGULAR because it is read as a position: "Set 2 of 3". The
 * button that makes one is plural, because that names the thing.
 */
const LEGACY_REPEAT_LABELS = ['Round', 'Rep', 'Reps']
const REPEAT_LABEL = 'Set'

/**
 * A ladder's iterations are RUNGS. Every ladder the editor and the generator
 * made carried the label "Set", so the run screen read "Set 3 of 9" over a
 * ladder, exactly what a repeat group says, and the two were indistinguishable
 * mid-workout. Same rule as above: only the exact defaults are touched, and a
 * name someone typed themselves is left alone.
 */
const LEGACY_LADDER_LABELS = ['Set', 'Round']
const LADDER_LABEL = 'Rung'

/**
 * Illustrations that used to be postimages links and now ship with the app.
 *
 * Every URL the catalogue has ever held, including the two duplicate uploads it
 * briefly listed and the four whose filenames changed when the set was
 * regenerated from the guide, so "Seated Ab Crunch" is "Seated Abdominal Crunch"
 * there, and "Cable Row" is "Seated Cable Row".
 *
 * Rewritten on READ, which is the whole reason this module exists: a routine
 * saved on the phone last week, and an export made last year, both come back with
 * pictures instead of dead links, with nothing to migrate in place. The old links
 * still work today. This is not a repair, it is cutting the dependency.
 *
 * A pinned copy is dropped along with the URL. That is not a loss: a bundled
 * image is precached by the service worker, so it is available offline without
 * anything being pinned.
 */
/** Exported for the test that checks every target is an image the app offers. */
export const REHOSTED: Record<string, string> = {
  'https://i.postimg.cc/SxXDbQ0P/Cable-Converging-Shoulder-Press.png': 'exercises/Cable-Converging-Shoulder-Press.jpg',
  'https://i.postimg.cc/KvY7cdKk/Cable-Fly.png': 'exercises/Cable-Fly.jpg',
  'https://i.postimg.cc/tgRC2Nrd/Cable-Lateral-Shoulder-Raise.png': 'exercises/Cable-Lateral-Shoulder-Raise.jpg',
  'https://i.postimg.cc/kgwmsjjn/Calf-Press.png': 'exercises/Calf-Press.jpg',
  'https://i.postimg.cc/0yFGWd24/Cycling.png': 'exercises/Cycling.jpg',
  'https://i.postimg.cc/VvyQv2NF/Deadlift.png': 'exercises/Deadlift.jpg',
  'https://i.postimg.cc/gJqyrpqR/Decline-Chest-Press.png': 'exercises/Decline-Chest-Press.jpg',
  'https://i.postimg.cc/7LWy858d/Free-Standing-Hamstring-Curl.png': 'exercises/Free-Standing-Hamstring-Curl.jpg',
  'https://i.postimg.cc/d1ZcqJJ1/Glute-Kickback.png': 'exercises/Glute-Kickback.jpg',
  'https://i.postimg.cc/8PpNPvH2/Hip-Abductor-Leg-Raise.png': 'exercises/Hip-Abductor-Leg-Raise.jpg',
  'https://i.postimg.cc/C1XhMTwJ/Incline-Chest-Press.png': 'exercises/Incline-Chest-Press.jpg',
  'https://i.postimg.cc/0yLZkgPy/Lat-Pulldown.png': 'exercises/Lat-Pulldown.jpg',
  'https://i.postimg.cc/TPg0hk3q/Leg-Press.png': 'exercises/Leg-Press.jpg',
  'https://i.postimg.cc/Znb8dQVQ/Seated-Ab-Crunch.png': 'exercises/Seated-Abdominal-Crunch.jpg',
  'https://i.postimg.cc/rphybRbB/Cable-Row.png': 'exercises/Seated-Cable-Row.jpg',
  'https://i.postimg.cc/0jpgwZM1/Seated-Leg-Extension.png': 'exercises/Seated-Leg-Extension.jpg',
  'https://i.postimg.cc/sXzcWpBF/Seated-Row.png': 'exercises/Seated-Row.jpg',
  'https://i.postimg.cc/Dwmh1KR5/Side-Cable-Bends.png': 'exercises/Side-Cable-Bends.jpg',
  'https://i.postimg.cc/fy8xjvPR/Standard-Chest-Press.png': 'exercises/Standard-Chest-Press.jpg',
  'https://i.postimg.cc/4d11QmtY/Standing-Arm-Curl.png': 'exercises/Standing-Arm-Curl.jpg',
  'https://i.postimg.cc/RFNCzVxN/Standing-Arm-Curl.png': 'exercises/Standing-Arm-Curl.jpg',
  'https://i.postimg.cc/PfZn9f6V/Standing-Leg-Curl.png': 'exercises/Standing-Leg-Curl.jpg',
  'https://i.postimg.cc/8PSgS89p/Standing-Leg-Extension.png': 'exercises/Standing-Leg-Extension.jpg',
  'https://i.postimg.cc/Y9c6xc3V/Standing-Shoulder-Press.png': 'exercises/Standing-Shoulder-Press.jpg',
  'https://i.postimg.cc/3rSS6RxS/Toe-Raise.png': 'exercises/Toe-Raise.jpg',
  'https://i.postimg.cc/xCSy08Hn/Tricep-Dip.png': 'exercises/Tricep-Dips.jpg',
  'https://i.postimg.cc/9FxpGW3Y/Tricep-Press.png': 'exercises/Triceps-Press.jpg',
  'https://i.postimg.cc/Gt7J6VXr/Tricep-Press.png': 'exercises/Triceps-Press.jpg',
  'https://i.postimg.cc/j56Gq1nB/horizon-5-0-r-recumbent-bike.jpg': 'exercises/horizon-5-0-r-recumbent-bike.jpg',
}

/**
 * The AMRAP step's name, and the separator its round used to be joined with.
 *
 * FROZEN COPIES, deliberately not imported from `routines/pasteFormat`. A
 * migration describes data that already exists, so it has to keep matching that
 * data if the parser renames the step or changes the join tomorrow. Importing
 * the live constants would silently stop it finding anything.
 */
const AMRAP_STEP = 'As many rounds as possible'
const RUN_TOGETHER = ' · '

/**
 * A weight typed on the end of a step's name, which is where weights used to
 * live because there was no field for them.
 *
 * "12 × Leg Press 65kg" becomes "12 × Leg Press" loaded to "65kg". Deliberately
 * NARROW: a number and a unit at the very END of the name, nothing else. It is
 * rewriting text the user typed, so it takes only the shape that cannot mean
 * anything else.
 *
 * What it must not touch, and does not:
 *
 *  - "Squat to 90", "Minute 5", "Row 500m": no weight unit.
 *  - "20kg Goblet Squat": not at the end, so it is part of the name as written.
 *  - a step that already HAS a load: nothing to lift, and the two might disagree.
 *
 * `each side` is allowed to follow the unit, since "Glute Kickback 20kg each
 * side" is one weight qualified, not a weight plus a name.
 */
const TRAILING_LOAD = /\s+(\d+(?:\.\d+)?\s?(?:kg|lb|lbs)(?:\s+(?:each|per)\s+side)?)$/i

function liftLoad(segment: Segment): Segment {
  if (segment.load !== undefined) return segment
  const match = TRAILING_LOAD.exec(segment.name)
  if (!match) return segment
  const name = segment.name.slice(0, match.index).trim()
  // A name that was ONLY a weight keeps it: "65kg" alone is what the step is
  // called, and stripping it would leave a step with no name at all.
  if (name === '') return segment
  return { ...segment, name, load: match[1]!.trim() }
}

function migrateSegment(segment: Segment): Segment {
  let next = liftLoad(segment)

  /*
   * An AMRAP's round was joined into one paragraph before the media panel could
   * draw it as bullets, and a routine is STORED as it was parsed. Without this,
   * fixing the parser fixes nothing already saved, and re-pasting means getting
   * the email back onto the clipboard of the phone it is being read on.
   */
  if (next.name === AMRAP_STEP && next.note?.includes(RUN_TOGETHER)) {
    next = { ...next, note: next.note.split(RUN_TOGETHER).join('\n') }
  }

  if (next.media?.source === 'remote') {
    const path = REHOSTED[next.media.url]
    if (path) next = { ...next, media: { source: 'bundled', path } }
  }

  return next
}

/**
 * Every group is recursed into, not just repeats.
 *
 * It used to return a section or a ladder untouched, so a repeat nested in one
 * never had its label fixed. And now that steps carry images to rewrite, a
 * pasted routine is nothing BUT sections, which would have made this migration
 * do nothing at all where it matters most.
 */
function migrateBlocks(blocks: Block[]): Block[] {
  let changed = false
  const next = blocks.map((block) => {
    if (block.kind === 'segment') {
      const migrated = migrateSegment(block)
      if (migrated === block) return block
      changed = true
      return migrated
    }
    const children = migrateBlocks(block.children)
    const relabel =
      block.kind === 'repeat' && block.label !== undefined && LEGACY_REPEAT_LABELS.includes(block.label)
        ? REPEAT_LABEL
        : block.kind === 'ladder' && block.label !== undefined && LEGACY_LADDER_LABELS.includes(block.label)
          ? LADDER_LABEL
          : null
    if (relabel === null && children === block.children) return block
    changed = true
    return { ...block, ...(relabel !== null ? { label: relabel } : {}), children }
  })
  return changed ? next : blocks
}

/** Identity when there is nothing to fix, so React sees no needless new objects. */
export function migrateWorkout(workout: Workout): Workout {
  const blocks = migrateBlocks(workout.blocks)
  return blocks === workout.blocks ? workout : { ...workout, blocks }
}
