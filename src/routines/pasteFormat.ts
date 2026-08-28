/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, Ladder, Repeat, Reps, Section, SectionDisplay, Segment } from '../engine'

/**
 * Reads a strength routine pasted as text.
 *
 * The source is a weekly email from a gym instructor. See
 * `__tests__/emails/` for the three the grammar was built against. They arrive on
 * one template, which is what makes parsing worth doing rather than typing each
 * routine in by hand.
 *
 * The one thing it ADDS to the text is five seconds to get ready at the start.
 * see `getReady`. Everything else is read, never invented.
 *
 * TWO RULES GOVERN EVERYTHING HERE.
 *
 * 1. **Never guess silently.** A line the parser does not understand is reported
 *    in `skipped`, with its number, rather than dropped or approximated. The same
 *    principle as the `.tabata` importer refusing to infer reps: a wrong guess
 *    quietly changes someone's workout, and the reviewer cannot see what they
 *    were not told.
 * 2. **The result is a DRAFT.** It lands in the editor for review. That is what
 *    makes rule 1 affordable. An imperfect parse costs a correction, not a bad
 *    workout.
 */

export type ParsedRoutine = {
  name: string
  blocks: Block[]
  /** Lines that could not be placed. Show these; do not hide them. */
  skipped: { line: number; text: string }[]
}

/**
 * Time to prop the phone up before anything starts.
 *
 * Five seconds: long enough to put it down and step back, short enough that
 * nobody waits through it twice. The emails never mention it because a person
 * reading one is already standing there. The app is not, and starting a jog the
 * instant you press Start means missing the first few seconds of it.
 */
export const GET_READY_MS = 5_000

let sequence = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`

// ── Line classifiers ────────────────────────────────────────────────────────
// Every pattern accepts both hyphens and en-dashes, because the emails mix them
// freely, and `×` as well as `x` for counts.

/**
 * The emails mix hyphens, en-dashes and em-dashes freely.
 *
 * Two forms, because they are NOT interchangeable: `DASH` is a complete class
 * for use on its own, `DASH_CHARS` is the bare characters for building a larger
 * one. Nesting `DASH` inside another class silently produces `[\s[-–—]]`, which
 * matches a literal bracket and not much else. It is what stopped
 * "30-second Plank" being read as a duration.
 */
const DASH_CHARS = '-–—'
const DASH = `[${DASH_CHARS}]`

/** "#1 General Body", "#5 Legs Finisher – Burnout Ladder". */
/**
 * "#1 Full Body Ladder", and the barer forms the earlier routines use: "#1" and
 * "2#" with no name at all, and "#Warmup" with no number.
 */
const NUMBERED_SECTION = /^#\s*\d+\s*(.*)$/
const TRAILING_HASH_SECTION = /^(\d+)\s*#\s*(.*)$/
const WORD_HASH_SECTION = /^#\s*(\p{L}.*)$/u

/** "🔥 Final Burnout", "🔥 After Round 5:". */
const FLAME_SECTION = /^\p{Extended_Pictographic}\s*(.+?):?$/u

/** "After Round 4", the same idea without the emoji. */
const AFTER_ROUND_SECTION = /^after round\s+\d+:?\s*$/i

/**
 * Headings with no marker of their own. Deliberately a closed vocabulary: a
 * heuristic like "Title Case on its own line" would swallow half the exercises.
 */
const NAMED_SECTION =
  /^((?:trampoline\s+)?warm[-\s]?up|cool[-\s]?down|final\s+burnout|(?:[\p{L}]+\s+)?burner|burnout\s+ladder|(?:[\p{L}&\s]{0,24}\s)?finisher)\b(.*)$/iu

/**
 * A heading in capitals: "LEGS", "ARMS", "ABS".
 *
 * Still closed rather than heuristic, just closed on SHAPE instead of on a word
 * list. No lowercase letter anywhere, no digit, at most three words, and short.
 * "TABATA TIMER" only ever appears at the end of a longer line, and an exercise
 * shouted in capitals would have to be under 24 characters to be caught.
 */
const SHOUTED_SECTION = /^(?=.*\p{Lu})[^\p{Ll}\d]{2,24}$/u

/** A heading wrapped in asterisks, the way these emails emphasise one. */
const STARRED_SECTION = /^\*+\s*([^*]+?)\s*\*+\s*(.*)$/

/**
 * Durations arrive in seconds or minutes: "30 seconds", "2 min", "1.5 minutes".
 * One shared fragment, so a unit accepted here is accepted by every duration
 * pattern at once. Fractions exist for minutes ("1.5 minutes" is 90 seconds);
 * fractional seconds fall out for free and cost nothing.
 */
const NUMBER = '(\\d+(?:\\.\\d+)?)'
const UNIT = '(sec|secs|second|seconds|m|min|mins|minute|minutes)'

const toMs = (value: string, unit: string): number =>
  Math.round(Number(value) * (unit.toLowerCase().startsWith('m') ? 60_000 : 1_000))

/**
 * "40 sec each", "30 seconds each – continuous movement", "Mobility – 30 seconds each".
 * NOT "30 seconds each side": that is one step's own time per side, and reading
 * it as a directive would retime every exercise after it.
 */
const EACH_FOR = new RegExp(`${NUMBER}\\s*${UNIT}\\s+each\\b(?!\\s+(?:side|leg|arm|direction))`, 'i')

/**
 * "4 Rounds", "3-5 Rounds:", "Repeat 2 rounds", "Repeat × 4 rounds". The upper
 * bound of a range wins, as agreed.
 *
 * The "Repeat" forms also appear AFTER the steps they repeat, which is handled
 * where the line is read rather than here. See the round handler.
 */
const ROUNDS = new RegExp(
  `^(?:repeat\\s*[×x]?\\s*)?(\\d+)\\s*(?:${DASH}\\s*(\\d+))?\\s*(?:rounds?\\b|[×x]\\s*$)`,
  'i',
)

/** "3 × 30 seconds": a round count and the time every step in it gets. */
const SETS_OF = new RegExp(`^(\\d+)\\s*[×x]\\s*${NUMBER}\\s*${UNIT}\\s*$`, 'i')

/** "Counting: 2-4-6-8-10-8-6-4-2", or the bare "15-12-9-6-3-6-9-12-15". */
/**
 * "Counting: 10-8-6-4-2", and the bare "15-12-9-6-3".
 *
 * The counts may be FOLLOWED by the lift they belong to, which is how the
 * routines before July write a ladder: "2-4-6-8-10-8-6-4-2 king squats" on one
 * line rather than a `Counting:` line and a name under it.
 *
 * The name has to start with a letter, and must not be a unit: without that
 * guard "20-30-45-30-20 sec cardio" reads as a rep ladder whose main lift is
 * called "sec cardio", and "1-2-3-4-5-6-… (keep climbing)" as one called "…".
 */
const UNIT_WORD = /^(?:secs?|seconds?|mins?|minutes?|reps?)\b/i
/*
 * Rungs of at most two digits. The corpus tops out at 20, and three numbers
 * with dashes between is also how a date is written: "2026-04-16" at the top of
 * a pasted email read as a ladder and claimed the next step as its main lift.
 */
const LADDER = new RegExp(
  `^(?:counting:\\s*)?(\\(?\\d{1,2}\\)?(?:\\s*(?:[${DASH_CHARS},]|→|->)\\s*\\(?\\d{1,2}\\)?){2,})\\s*(.*)$`,
  'i',
)
/**
 * A ladder of DURATIONS rather than of reps.
 *
 * "20-30-45-30-20 sec cardio" states the unit once at the end;
 * "Plank 20sec-30sec-40sec-30sec-20sec" repeats it on every rung and puts the
 * exercise first. Both are a run of timed steps of the same movement, which is
 * what a person reading them does, and NOT a `Ladder`, whose rungs are counts.
 */
const DURATION_LADDER = new RegExp(
  '^(?:(\\p{L}[^0-9]*?)\\s+)?' +
    `(\\d+\\s*(?:sec|secs|min|mins)?(?:\\s*${DASH}\\s*\\d+\\s*(?:sec|secs|min|mins)?){2,})` +
    '\\s*(sec|secs|second|seconds|min|mins|minute|minutes)?\\s*(.*)$',
  'iu',
)

/** The same, written the other way round: "sit ups 5-10-15-10-5". */
const LADDER_TRAILING = new RegExp(
  `^(\\p{L}[^${DASH_CHARS}]*?)\\s+(\\d+(?:\\s*${DASH}\\s*\\d+){2,})\\s*$`,
  'iu',
)

/** "Rest 45 seconds after each round", "Rest: 30–45 seconds after each round". */
const ROUND_REST = new RegExp(
  `\\brest:?\\s*(\\d+)(?:\\s*${DASH}\\s*(\\d+))?\\s*(?:sec|secs|second|seconds)\\b.*\\bafter each round`,
  'i',
)

/**
 * One minute of an EMOM ("Every Minute On the Minute").
 *
 * The minute is the unit: you do the work, then rest whatever is left of it.
 * That is an ordinary timed step whose label happens to be a rep target, so an
 * EMOM needs no primitive of its own.
 */
const MINUTE_MS = 60_000

/** "Minute 1: 12 × Bicep Curls", the whole minute on one line. */
const MINUTE_ITEM = new RegExp(`^minute\\s+\\d+\\s*[:.${DASH_CHARS}]?\\s*(.+)$`, 'i')
/** "Minute 4", a heading over the bulleted list that fills it. */
const MINUTE_HEADING = /^minute\s+\d+\s*:?\s*$/i

/**
 * "5-Minute EMOM", "6-Minute EMOM (Every Minute On the Minute)".
 *
 * A heading, not a step. The minutes below it carry the structure, so the line
 * itself becomes a note; read as a step it produced a five-minute countdown with
 * its own minutes stranded after it.
 */
const EMOM_HEADING = new RegExp(
  `^(?:${NUMBER}[\\s${DASH_CHARS}]*(?:min|mins|minute|minutes)\\s+)?emom\\b`,
  'i',
)

/**
 * "10-MINUTE AMRAP (As Many Rounds As Possible)".
 *
 * THE CLOCK IS THE WORKOUT. An AMRAP is ten minutes against a round you repeat
 * until the buzzer, so it becomes one timed step of the stated length whose note
 * is the round, and the countdown layout gives it the whole screen.
 *
 * What cannot be read out of the text is HOW MANY rounds, and nothing here tries
 * to: the number is the person's to make, live, and a count invented to fill a
 * `Repeat` would be exactly the silent guess this parser refuses to make. The
 * ten minutes is not a guess. It is stated, so it is read.
 *
 * The alternative, keeping the exercises as steps and the cap as a note, was
 * worse than a skipped line: with no clock and one pass through the list, the app
 * quietly turned a ten-minute block into a single round and said nothing.
 *
 * An AMRAP with no stated length has no clock to build and stays a note.
 */
const AMRAP_HEADING = new RegExp(
  `^(?:${NUMBER}[\\s${DASH_CHARS}]*(?:min|mins|minute|minutes)\\s+)?amrap\\b`,
  'i',
)

/** The step an AMRAP becomes. The time is read; the rounds are yours to count. */
const AMRAP_NAME = 'As many rounds as possible'

/**
 * "30 sec WORK", "30 sec REST": the 30/30 interval form.
 *
 * WORK names no exercise, because the exercise is on the NEXT line. REST names
 * itself and is a step on its own.
 */
const WORK_REST = new RegExp(`^${NUMBER}\\s*${UNIT}\\s+(work|rest)\\s*$`, 'i')

/** "LAST 20 SECONDS", heading the all-out effort on the line below it. */
const LAST_STRETCH = new RegExp(`^last\\s+${NUMBER}\\s*${UNIT}\\s*$`, 'i')

/** "15 sec rest between exercises", stated after the list it applies to. */
const BETWEEN_REST = new RegExp(
  `^${NUMBER}\\s*${UNIT}\\s+rest\\s+between\\s+(?:each\\s+)?exercises?\\b`,
  'i',
)

/** "Every time you finish a round:", introducing the step that closes one. */
const EVERY_ROUND = /^every time you finish (?:a|each|the) round:?\s*$/i

/** "Then:", which ends the block above it rather than opening anything. */
const THEN = /^then:?\s*$/i

/** "Replace rest with 30-second Squat Hold", under a "Final round" heading. */
const REPLACE_WITH = /^replace\b.*?\bwith\s+(.+)$/i

/** "(Optional) FINAL BURNOUT": a marker sitting in front of a known heading. */
const LEADING_PAREN = /^\([^)]*\)\s*/

const MAIN_EXERCISE = /^main\s+exercise:?\s*$/i
/** "After every set:", "After every Goblet Squat set:". */
const AFTER_EVERY_SET = /^after every\b.*\bset:?\s*$/i
/** Openers that introduce a plain list and mean nothing structural. */
const LIST_OPENER = /^(perform the following|complete (?:the following|without stopping|once)):?\s*$/i
/** "Bonus: After completing the ladder, 30 seconds fast mountain climbers". */
const BONUS = /^bonus:\s*(.+)$/i

/** Instructions that belong on the section rather than on any one step. */
const SECTION_NOTE =
  /^(complete\b|no rest between exercises|rest\b|reps? and sets?\b|as many\b|start a new\b|work\s*(?:→|->)\s*rest\b|use\b|after every round\b|repeat the sequence\b|keep climbing\b|\d[\d\s\p{Pd},]*(?:…|\.\.\.)|b-weights\b|tabata\b)/iu

/**
 * `•side plank left` has no space after the bullet, and only `•` is allowed to
 * do that: a bare `*` with no space is an asterisk-wrapped heading, and a bare
 * dash with none is a range.
 */
const BULLET = new RegExp(`^(?:[*]\\s+|${DASH}\\s+|•\\s*)(.+)$`)
const NUMBERED = /^\d+\.\s+(.+)$/
/**
 * "1 - 20 x Straight legs up overhead crunch": a numbered list written with a
 * dash instead of a dot. The space after the dash is what keeps it clear of
 * "2-4-6-8-10", which has none.
 */
const NUMBERED_DASH = new RegExp(`^\\d+\\s*${DASH}\\s+(.+)$`)
/** The same line, for the number itself: which entry of the vocabulary it is. */
const NUMBERED_DASH_INDEX = new RegExp(`^(\\d+)\\s*${DASH}\\s+`)
/** "1", "1 + 2", "1 + 2 + 3": one round of a pyramid circuit. */
const PYRAMID_ROW = /^\d+(?:\s*\+\s*\d+)*$/
/**
 * A COURSE drawn in characters: "A🔺-------5m———🔺B".
 *
 * Two markers and the distance between them. The line itself is not a step, it
 * is the shape of the room, so it becomes the section's note and the distance is
 * kept for the lines beneath it.
 */
const COURSE = /^\s*A\s*\S*[\s\p{Pd}_.]*(\d+\s*m)\b[\s\p{Pd}_.]*\S*\s*B\s*$/iu

/**
 * "Walking lunge A-B", which is that course walked one way and then the other.
 *
 * The MARKERS are kept rather than turned into forwards and backwards: they are
 * what the diagram above labelled, and the diagram is the section's note, so
 * "Walking lunge 5m A-B" still points at something.
 */
const COURSE_LEG = /^(.+?)\s+([AB])\s*[\p{Pd}]\s*([AB])\s*$/iu

/**
 * A step whose length is described rather than stated: "wall sit till 1min is
 * over", "Wall sit (time remaining after the 10 lunges per leg)".
 *
 * The app cannot work out what is left of someone else's minute, so the step
 * waits for Next instead. Wayne's call, and it is the honest one: a made-up
 * thirty seconds would be the app inventing the number it could not read.
 */
const OPEN_ENDED = /\btime (?:left|remaining)\b|\btill\b.*\bis over\b/i

/** A lone "or …" line: the previous step's low-impact swap. */
/** "Squats 20sec - 10sec squat hold": the work, then what to hold at the end. */
const INTERVAL_PAIR = new RegExp(
  `^(\\p{L}.*?)\\s+${NUMBER}\\s*${UNIT}\\s*${DASH}\\s*${NUMBER}\\s*${UNIT}\\s+(\\p{L}.*)$`,
  'iu',
)

/** A heading that says so by ending in a colon, and states no number. */
const COLON_HEADING = /^[^\d:]{2,40}:$/

/** "10mins" alone under a heading: how long that section runs. */
const BARE_DURATION = new RegExp(`^${NUMBER}\\s*${UNIT}\\s*$`, 'i')

const ALTERNATIVE_LINE = /^or\s+(.+)$/i

// ── Item parsing ────────────────────────────────────────────────────────────

const PER_SIDE = /\b(?:each (?:side|leg|arm|direction)|alternate (?:sides|legs))\b/i
/**
 * "(5 each leg)" and "– 5 each direction" both restate the count PER SIDE, and
 * it is the smaller, truer number: "10 × Walking Lunges (5 each leg)" is five a
 * side, not ten a side.
 */
const PER_SIDE_COUNT = new RegExp(
  `(?:\\(|${DASH}\\s*)(\\d+)\\s*each\\s+(?:side|leg|arm|direction)`,
  'i',
)
/** "(or Reverse Lunges for low impact)", "– step-back option for low impact". */
const ALTERNATIVE = new RegExp(`[(,]\\s*or\\s+([^)]+?)\\s*\\)|\\s+${DASH}\\s+(.*?\\boption\\b.*)$`, 'i')

/** "30-second Plank", "1-minute Wall Sit", "20 second Hollow Hold". */
const LEADING_DURATION = new RegExp(`^${NUMBER}[\\s${DASH_CHARS}]*${UNIT}\\s+(.+)$`, 'i')
/** "Fast feet for 15 seconds", "Jog for 2 min". */
const FOR_DURATION = new RegExp(`^(.+?)\\s+for\\s+${NUMBER}\\s*${UNIT}\\b`, 'i')
/**
 * "Side Plank - 30 seconds each side", "Plank - 1 minute": a duration stated at
 * the end of the name, with no "for" to announce it. The per-side tail is
 * consumed so it does not linger in the name; `PER_SIDE` has already read it.
 */
/**
 * "Jogging (30 sec)", "Knee lifts (20 sec)(Tabata)".
 *
 * A whole warm-up is written this way in the routines before July. A second
 * parenthesis after it is a marker rather than a time, and is dropped with the
 * first: "(Tabata)" names the timer the instructor had in mind, not the step.
 *
 * A unit is required, so "10 × Walking Lunges (5 each leg)" is untouched.
 */
const PAREN_DURATION = new RegExp(
  `^(.+?)\\s*\\(\\s*${NUMBER}\\s*${UNIT}\\s*\\)\\s*(?:\\([^)]*\\)\\s*)?$`,
  'i',
)

const TRAILING_DURATION = new RegExp(
  `^(.+?)[\\s${DASH_CHARS}:]+${NUMBER}\\s*${UNIT}(?:\\s+each\\s+(?:side|leg|arm|direction))?\\s*$`,
  'i',
)
/** "12 × Hammer Curls", and the bare "20 Flutter Kicks". */
// The "x" must stand alone: "10 xtreme pushups" is not ten of "treme pushups".
const LEADING_COUNT = /^(\d+)\s*(?:×\s*|x\s+|\s)(.+)$/
/**
 * A RANGE where one number is expected: "10/12 x lateral raises",
 * "10-15 x Fire hydrant left leg", "1-2mins Jumping jacks".
 *
 * The upper bound wins, on the same reasoning the parser already applies to
 * "3-5 Rounds": you can always stop early, and a target you might beat is more
 * use than one you have already passed.
 *
 * A range of three or more is a LADDER, not a range, and is matched long before
 * this.
 */
// The dashes lead: `[/-–—]` reads `/` to `–` as a range and so excludes the
// plain hyphen, which is the one these routines actually use.
const RANGE = `(?:\\s*[${DASH_CHARS}/]\\s*(\\d+))?`
const LEADING_RANGE_COUNT = new RegExp(`^(\\d+)${RANGE}\\s*[×x]\\s*(.+)$`)
const LEADING_RANGE_DURATION = new RegExp(
  `^${NUMBER}${RANGE}\\s*${UNIT}\\s+(.+)$`,
  'i',
)

/** "wide squats 15x", "…crunch x12". The `x` is what makes it a count. */
const TRAILING_COUNT =
  /^(\p{L}.*?)[\s:]+(?:[×x]\s*(\d+)|(\d+)\s*[×x])(?:\s+(?:each|per)\s+(?:side|leg|arm|direction))?$/u

/**
 * "20 × Front Punches + 20 × Uppercuts" is two exercises on one line, and so is
 * "20 Front Punches + 20 Uppercuts" without the ×. Split only when the
 * right-hand side states its own count. "Squat + Shoulder Press" and
 * "Thrusters – squat + press" are single movements and must survive intact.
 */
const JOINED_ITEMS = /\s\+\s(?=\d+\s*[×x]\s*\S|\d+\s\S)/

type Item = {
  name: string
  durationMs?: number
  count?: number
  perSide: boolean
  alternative?: string
  /** A trailing description, lifted out of the name. See `splitDescription`. */
  note?: string
}

/**
 * How long a trailing parenthetical may be before it stops being part of the
 * name and becomes a description.
 *
 * "(basic)" and "(floor or trampoline)" are part of what the exercise IS.
 * "(start standing, step out to one side, sink your hips into a squat, and
 * reach your arms across your body for an added stretch)" is instructions, and
 * leaving it in makes a 159-character step name that no amount of sizing can
 * render legibly across a gym.
 */
export const DESCRIPTION_CHARS = 24

/** A trailing "(…)", which is where these routines put their instructions. */
const TRAILING_PAREN = /^(.*?)\s*\(([^()]*)\)\s*$/

/**
 * Splits "Name (long instruction)" into a name and a note.
 *
 * Only a TRAILING parenthetical, and only a long one: "RB (resistance band)
 * Lateral Walks" glosses a term mid-name and has to stay where it is.
 */
function splitDescription(name: string): { name: string; note?: string } {
  const match = TRAILING_PAREN.exec(name)
  if (!match) return { name }
  const head = match[1]!.trim()
  const inner = match[2]!.trim()
  if (head === '' || inner.length < DESCRIPTION_CHARS) return { name }
  return { name: head, note: inner }
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—-]+|[\s:.]+$/g, '')
    .trim()
}

/**
 * Turns one list line into a step.
 *
 * Order matters: a duration is looked for BEFORE a count, because "30-second
 * Plank" starts with a number that is not a rep count.
 */
export function parseItem(text: string): Item {
  let rest = text.trim()
  let alternative: string | undefined

  const alt = ALTERNATIVE.exec(rest)
  if (alt) {
    alternative = tidy(alt[1] ?? alt[2] ?? '')
    rest = tidy(rest.slice(0, alt.index))
    /*
     * "(alternate legs each set, or perform half the reps per leg)" leaves the
     * opening bracket behind. An unclosed one means the parenthetical was
     * qualifying the alternative, not the exercise, so drop it with the rest.
     */
    const open = rest.lastIndexOf('(')
    if (open !== -1 && !rest.slice(open).includes(')')) rest = tidy(rest.slice(0, open))
  }

  const perSideCount = PER_SIDE_COUNT.exec(rest)
  const perSide = PER_SIDE.test(rest)

  /*
   * "Speed Skaters (each side)" already says "each side" in its effort column
   * once `perSide` is set, so leaving it in the name prints it twice. Only the
   * bracketed form goes: "Plank Shoulder Taps – each side" reads as part of the
   * name, and removing a dashed clause would leave a dangling dash.
   */
  if (perSide) rest = tidy(rest.replace(/\s*\((?:\d+\s*)?each\s+(?:side|leg|arm|direction)\)/i, ''))

  const done = (name: string, extra: Partial<Item> = {}): Item => {
    const split = splitDescription(name)
    return {
      ...split,
      perSide,
      ...extra,
      ...(alternative ? { alternative } : {}),
    }
  }

  const leading = LEADING_DURATION.exec(rest)
  if (leading) {
    return done(tidy(leading[3]!), { durationMs: toMs(leading[1]!, leading[2]!) })
  }

  const trailingFor = FOR_DURATION.exec(rest)
  if (trailingFor) {
    return done(tidy(trailingFor[1]!), { durationMs: toMs(trailingFor[2]!, trailingFor[3]!) })
  }

  const trailing = TRAILING_DURATION.exec(rest)
  if (trailing) {
    return done(tidy(trailing[1]!), { durationMs: toMs(trailing[2]!, trailing[3]!) })
  }

  const paren = PAREN_DURATION.exec(rest)
  if (paren) {
    return done(tidy(paren[1]!), { durationMs: toMs(paren[2]!, paren[3]!) })
  }

  const rangeDuration = LEADING_RANGE_DURATION.exec(rest)
  if (rangeDuration && rangeDuration[2]) {
    return done(tidy(rangeDuration[4]!), {
      durationMs: toMs(rangeDuration[2]!, rangeDuration[3]!),
    })
  }

  const rangeCount = LEADING_RANGE_COUNT.exec(rest)
  if (rangeCount && rangeCount[2]) {
    const count = perSideCount ? Number(perSideCount[1]) : Number(rangeCount[2])
    return done(tidy(rangeCount[3]!), { count })
  }

  const leadingCount = LEADING_COUNT.exec(rest)
  if (leadingCount) {
    // "10 × Walking Lunges (5 each leg)" is five a side, not ten.
    const count = perSideCount ? Number(perSideCount[1]) : Number(leadingCount[1])
    return done(tidy(leadingCount[2]!), { count })
  }

  /*
   * The count written AFTER the name, which the routines before July do as often
   * as before it: "wide squats 15x", "straight leg up over head crunch x12",
   * "Curtsy lunges: 10x per leg". The `x` is required here, unlike the leading
   * form, or every name ending in a number would grow a rep count.
   */
  const trailingCount = TRAILING_COUNT.exec(rest)
  if (trailingCount) {
    const stated = Number(trailingCount[2] ?? trailingCount[3])
    const count = perSideCount ? Number(perSideCount[1]) : stated
    return done(tidy(trailingCount[1]!), { count })
  }

  return done(tidy(rest))
}

// ── Blocks ──────────────────────────────────────────────────────────────────

/** A step that is the routine getting you ready rather than working you. */
export const PREPARE_NAME = /^(get (ready|set)|prepare|set ?up)\b/i
export const REST_NAME = /\brest\b/i

function segment(item: Item, durationMs: number | undefined, reps: Reps | undefined): Segment {
  const role = REST_NAME.test(item.name)
    ? 'rest'
    : PREPARE_NAME.test(item.name)
      ? 'prepare'
      : 'work'
  return {
    kind: 'segment',
    id: nextId('seg'),
    name: item.name,
    role,
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(reps ? { reps } : {}),
    ...(item.alternative ? { alternative: item.alternative } : {}),
    ...(item.note !== undefined ? { note: item.note } : {}),
  }
}

function restFor(durationMs: number): Segment {
  return { kind: 'segment', id: nextId('seg'), name: 'Rest', role: 'rest', durationMs }
}

/** A section shows as a timer only when every step in it is timed. */
function displayFor(children: Block[]): SectionDisplay {
  const allTimed = (blocks: Block[]): boolean =>
    blocks.every((block) =>
      block.kind === 'segment' ? block.durationMs !== undefined : allTimed(block.children),
    )
  return allTimed(children) ? 'timer' : 'list'
}

type Target =
  /** Loose steps, straight into the section. */
  | { kind: 'section' }
  | { kind: 'rounds'; group: Repeat }
  /** The ladder's main exercise: no count of its own, so it takes the rung. */
  | { kind: 'ladder-main'; group: Ladder }
  /** "After every set": fixed counts, and they run on the final rung too. */
  | { kind: 'ladder-accessory'; group: Ladder }

/**
 * Reads a pasted routine into blocks.
 *
 * A line-by-line state machine rather than a grammar: the input is a human's
 * handout, not a format, so recovering from an odd line matters more than
 * elegance. Every line either lands somewhere or is reported in `skipped`.
 */
/**
 * The step the app adds, unless the routine already opens with one.
 *
 * Top level rather than inside the first section: it is not part of the warm-up,
 * it is the app giving you a moment before the warm-up. And it is skipped when
 * the text already starts with a prepare step, so a routine that says "30 sec to
 * get set" is not made to wait twice.
 */
function getReady(blocks: readonly Block[]): Segment | null {
  const first = (list: readonly Block[]): Segment | undefined => {
    for (const block of list) {
      if (block.kind === 'segment') return block
      const inner = first(block.children)
      if (inner) return inner
    }
    return undefined
  }
  if (first(blocks)?.role === 'prepare') return null
  return {
    kind: 'segment',
    id: nextId('seg'),
    name: 'Get ready',
    role: 'prepare',
    durationMs: GET_READY_MS,
  }
}

export function parseRoutine(text: string, name = 'Pasted routine'): ParsedRoutine {
  const skipped: ParsedRoutine['skipped'] = []
  const blocks: Block[] = []

  let section: Section | null = null
  let target: Target = { kind: 'section' }
  /** Set by "40 sec each"; applies until the next directive or section. */
  let eachMs: number | null = null
  let lastStep: Segment | null = null
  /** Set by "Main Exercise:": the next bare line is the ladder's main lift. */
  let expectMain = false
  /**
   * A directive on the line above has announced the step on this one.
   *
   * "30 sec WORK", "Minute 4", "LAST 20 SECONDS" and "Every time you finish a
   * round:" all name no exercise themselves. That licence is what lets a BARE
   * line become a step: without it one stays reported, because a heading, an
   * instruction and an exercise are indistinguishable once the bullet is gone.
   */
  let expectItem = false
  /** The duration that licence carries, if it carried one. */
  let pendingMs: number | null = null
  /** Whether the balance of the minute is rest. See `MINUTE_MS`. */
  let pendingFill = false
  /**
   * An open AMRAP, and the round being collected for its note.
   *
   * Lines are kept AS WRITTEN rather than parsed and rendered back: they are read
   * by a person off a screen, not by the runner, and "12 × Russian Twists - 6
   * each side" says it better than anything reassembled from its parts.
   */
  let amrap: { durationMs: number; round: string[] } | null = null

  /**
   * Ends an open AMRAP, emitting the one timed step it becomes.
   *
   * Called where the block ends: at the close of a section, and before any line
   * that opens a group, since a ladder or a round below an AMRAP begins the next
   * block rather than continuing this one.
   */
  const flushAmrap = () => {
    if (!amrap) return
    const { durationMs, round } = amrap
    amrap = null
    ensureSection().children.push({
      kind: 'segment',
      id: nextId('seg'),
      name: AMRAP_NAME,
      role: 'work',
      durationMs,
      /*
       * The panel beside the countdown shows a step's note, so this is where the
       * round goes: on screen, in full, for all ten minutes. One item per LINE,
       * because the panel draws a multi-line note as a bulleted list and a round
       * run together into a paragraph cannot be scanned mid-burpee.
       */
      ...(round.length > 0 ? { note: round.join('\n') } : {}),
    })
  }

  /**
   * A PYRAMID CIRCUIT, which two routines write and no other form covers.
   *
   *     1 - 20 x Straight legs up overhead crunch     <- the vocabulary
   *     2 - 15 x Plie squats
   *     3 - 10 x Around the world
   *     4 - 5 x Rev lunge/forward lunge
   *
   *     1                                             <- the work
   *     1 + 2
   *     1 + 2 + 3
   *     1 + 2 + 3 + 4
   *     1 + 2 + 3
   *     1 + 2
   *     1
   *
   * Seven rounds, growing and then shrinking. The numbered lines are not steps
   * to do in their own right: they say what 1, 2, 3 and 4 MEAN, and the rows
   * below spend them.
   *
   * Expanded at section close rather than as it reads, because the other routine
   * that does this puts the vocabulary AFTER the rows, and one pass cannot spend
   * a word it has not been told yet.
   *
   * The definitions are the ascending run 1..N. A lone "1 - plank jacks x 10"
   * that is not part of such a run is an ordinary step: Wayne's confirmation,
   * and in his routine it bookends the pyramid on both sides.
   */
  const pyramidRows: { rungs: number[]; line: number; text: string }[] = []
  /** The distance a course states, for the "A-B" lines beneath it. */
  let courseDistance: string | null = null
  /**
   * The numbered lines seen in this section, by identity rather than by a field
   * on `Segment`: this is parser bookkeeping and has no business in the schema,
   * where it would need adding to the bundle validator and the dirty check too.
   */
  const numberedItems: { index: number; block: Segment }[] = []

  const expandPyramid = (current: Section): void => {
    if (pyramidRows.length === 0) return

    const numbered = numberedItems.flatMap((entry) => {
      const at = current.children.indexOf(entry.block)
      return at === -1 ? [] : [{ at, index: entry.index, block: entry.block }]
    })
    // The vocabulary: 1, 2, 3 … in order, and at least two of them.
    const vocabulary = new Map<number, Segment>()
    for (const entry of numbered) {
      if (entry.index === vocabulary.size + 1) vocabulary.set(entry.index, entry.block)
    }
    /*
     * No vocabulary means the rows referred to nothing, so they are REPORTED
     * rather than dropped. A pyramid quietly deleted would look like a parse.
     */
    if (vocabulary.size < 2) {
      for (const row of pyramidRows) skipped.push({ line: row.line, text: row.text })
      pyramidRows.length = 0
      numberedItems.length = 0
      return
    }

    const spent = new Set(numbered.filter((e) => vocabulary.get(e.index) === e.block).map((e) => e.at))
    // A row naming a rung no line defined loses that rung: said, rather than a
    // shorter round built quietly.
    for (const row of pyramidRows) {
      if (row.rungs.some((rung) => !vocabulary.has(rung))) skipped.push({ line: row.line, text: row.text })
    }
    const rounds: Block[] = pyramidRows.map((row) => ({
      kind: 'repeat',
      id: nextId('rep'),
      times: 1,
      label: 'Round',
      children: row.rungs
        .map((rung) => vocabulary.get(rung))
        .filter((step): step is Segment => step !== undefined)
        .map((step) => ({ ...step, id: nextId('seg') })),
    }))

    // The vocabulary out, the rounds in where the first of it stood.
    const first = Math.min(...spent)
    current.children = [
      ...current.children.slice(0, first).filter((_, at) => !spent.has(at)),
      ...rounds,
      ...current.children.slice(first + 1).filter((_, at) => !spent.has(at + first + 1)),
    ]
    pyramidRows.length = 0
    numberedItems.length = 0
  }

  /** The line that opened the current section, so an empty one can be reported. */
  let sectionSource: { line: number; text: string } | null = null
  /** Lines read under the current section, refused or not. */
  let sectionLines = 0
  /** The line being read, for `openSection` to record. */
  let currentLine: { line: number; text: string } | null = null

  const closeSection = (atEnd = false) => {
    flushAmrap()
    if (!section) return
    expandPyramid(section)
    if (section.children.length > 0) {
      section.display = displayFor(section.children)
      blocks.push(section)
    } else if (atEnd && sectionLines === 0 && sectionSource) {
      /*
       * A heading with nothing under it at the END of the text used to vanish,
       * against the rule that every line lands somewhere or is reported: "Cool
       * down walk for 2 minutes" as the last line matched the heading vocabulary
       * and was gone. Only then: mid-text, an empty heading is a title split
       * over two lines ("3#" then "Finisher"), and one whose lines were all
       * refused has those lines reported already.
       */
      skipped.push(sectionSource)
    }
    section = null
    sectionSource = null
  }

  const openSection = (title: string) => {
    closeSection()
    section = { kind: 'section', id: nextId('sec'), name: tidy(title), display: 'list', children: [] }
    sectionSource = currentLine
    sectionLines = 0
    target = { kind: 'section' }
    eachMs = null
    lastStep = null
    expectItem = false
    pendingMs = null
    pendingFill = false
    amrap = null
    pyramidRows.length = 0
    numberedItems.length = 0
    courseDistance = null
  }

  /** Steps outside any section still need somewhere to go. */
  const ensureSection = (): Section => {
    if (!section) openSection('Routine')
    return section!
  }

  const addNote = (note: string) => {
    const host = ensureSection()
    // Full stops are kept here, unlike in a step name: two instructions joined
    // into one sentence read as nonsense.
    const text = note.replace(/\s+/g, ' ').trim()
    host.note = host.note ? `${host.note} ${text}` : text
  }

  const push = (block: Block) => {
    const host = ensureSection()
    if (target.kind === 'section') host.children.push(block)
    else target.group.children.push(block)
  }

  const addItem = (item: Item) => {
    /*
     * The one rule that covers every ladder in the source material: inside a
     * ladder, an item with no count of its own scales with the rung, and an item
     * that states a count keeps it. That is #1 (every exercise scales) and #3
     * (main lift scales, accessories fixed) without a special case for either.
     */
    const inLadder = target.kind === 'ladder-main' || target.kind === 'ladder-accessory'
    const reps: Reps | undefined =
      item.count !== undefined
        ? { kind: 'fixed', count: item.count, ...(item.perSide ? { perSide: true } : {}) }
        : inLadder && item.durationMs === undefined
          ? { kind: 'rung', ...(item.perSide ? { perSide: true } : {}) }
          : undefined

    /*
     * A timed step keeps its own duration. Failing that it takes the one the
     * directive above it carried ("30 sec WORK", "Minute 4"), which applies to
     * a rep-based step too: a minute of curls is both twelve reps and sixty
     * seconds. Only then does "40 sec each" fill in the rest, and as before it
     * leaves a counted step alone.
     */
    const durationMs =
      item.durationMs ??
      pendingMs ??
      (item.count === undefined && eachMs !== null ? eachMs : undefined)

    const step = segment(item, durationMs, reps)
    push(step)
    lastStep = step

    /*
     * An EMOM's minute is fixed, so a step that states a SHORTER time of its own
     * ("Minute 6: 30-sec Wall Sit") is worked for that long and the balance of
     * the minute is rest. Only a shortfall that can be computed is filled: a
     * rep-based minute has no knowable work time, so it simply takes the minute.
     */
    if (pendingFill && item.durationMs !== undefined && item.durationMs < MINUTE_MS) {
      push(restFor(MINUTE_MS - item.durationMs))
    }

    expectItem = false
    pendingMs = null
    pendingFill = false
  }

  /**
   * One minute of an EMOM.
   *
   * "12 × Lateral Raises + 10 Cross Punches" is one minute's work, not two, so
   * unlike a bulleted line it is NOT split into two steps: that would double the
   * minute. The pair stays one step and keeps both counts in its name.
   */
  const addMinute = (text: string) => {
    pendingMs = MINUTE_MS
    pendingFill = true
    if (JOINED_ITEMS.test(text)) addItem({ name: tidy(text), perSide: false })
    else addItem(parseItem(text))
  }

  /**
   * A ladder of durations, as the run of timed steps it is. True if the text was
   * one. Bulleted or not: "- Plank 20sec-30sec-40sec" under a section read as a
   * single twenty-second step called "Plank 20sec-30sec-40sec" until the bullet
   * path asked too.
   */
  const readDurationLadder = (text: string): boolean => {
    const durationLadder = DURATION_LADDER.exec(text)
    if (!durationLadder || !(durationLadder[3] || /\d\s*(?:sec|min)/i.test(durationLadder[2]!))) {
      return false
    }
    const unit = durationLadder[3] ?? 'sec'
    const name = tidy(durationLadder[1] ?? durationLadder[4] ?? '')
    if (name === '') return false
    flushAmrap()
    for (const rung of durationLadder[2]!.split(new RegExp(DASH))) {
      const own = /(\d+)\s*(sec|secs|min|mins)/i.exec(rung)
      const value = own ? own[1]! : rung.trim()
      addItem(parseItem(`${name} - ${value} ${own ? own[2]! : unit}`))
    }
    return true
  }

  const lines = text.split('\n')

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line === '') return
    const number = i + 1
    currentLine = { line: number, text: line }
    if (section) sectionLines += 1

    /*
     * Headings first: they reset everything below them.
     *
     * A heading can arrive behind a marker: "(Optional) 🔥 Final Burnout". It is
     * matched without the marker and NAMED with it, because whether a block is
     * optional is the reader's to know, not the parser's to drop.
     */
    // "(Repeat 2x)" is the directive in brackets, not a marker on a heading.
    const bracketed = /^\((.+)\)$/.exec(line)
    const unwrapped =
      bracketed && ROUNDS.test(bracketed[1]!.trim()) ? bracketed[1]!.trim() : line

    const marker = LEADING_PAREN.exec(unwrapped)?.[0] ?? ''
    const heading = unwrapped.slice(marker.length)

    const numbered = NUMBERED_SECTION.exec(heading)
    if (numbered) return openSection((marker + (numbered[1] || heading)).trim())

    const trailingHash = TRAILING_HASH_SECTION.exec(heading)
    if (trailingHash) {
      return openSection((marker + (trailingHash[2] || `#${trailingHash[1]}`)).trim())
    }

    const wordHash = WORD_HASH_SECTION.exec(heading)
    if (wordHash) return openSection((marker + wordHash[1]!).trim())

    const flame = FLAME_SECTION.exec(heading)
    if (flame) return openSection(marker + flame[1]!)

    if (AFTER_ROUND_SECTION.test(heading)) return openSection(marker + heading.replace(/:$/, ''))

    const starred = STARRED_SECTION.exec(heading)
    if (starred) return openSection((marker + starred[1]! + ' ' + (starred[2] ?? '')).trim())

    if (
      SHOUTED_SECTION.test(heading.trim()) &&
      // A real word, and not a step's own shout: "REST" and "WORK" are steps.
      /\p{L}{3}/u.test(heading) &&
      !/^(?:rest|work)$/i.test(heading.trim()) &&
      !AMRAP_HEADING.test(heading) &&
      !EMOM_HEADING.test(heading)
    ) {
      return openSection((marker + heading).trim())
    }

    const named = NAMED_SECTION.exec(heading)
    if (named && !BULLET.test(line) && !NUMBERED.test(line)) {
      openSection(line.replace(/[:：]\s*$/, ''))
      // "WARM-UP – 40 seconds each" is a heading AND a duration directive.
      const each = EACH_FOR.exec(line)
      if (each) eachMs = toMs(each[1]!, each[2]!)
      return
    }

    if (EMOM_HEADING.test(line)) return addNote(line)

    const amrapHeading = AMRAP_HEADING.exec(line)
    if (amrapHeading) {
      addNote(line)
      // With no stated length there is no clock to build, so it stays a note and
      // the exercises below it are read as ordinary steps.
      if (amrapHeading[1]) {
        flushAmrap()
        amrap = { durationMs: toMs(amrapHeading[1], 'min'), round: [] }
      }
      return
    }

    /*
     * A ladder of durations is read BEFORE a ladder of reps, because it looks
     * exactly like one until the unit is noticed. Emitted as the run of timed
     * steps it is: "20-30-45-30-20 sec cardio" is five steps of cardio.
     */
    if (readDurationLadder(line)) return

    const trailing = LADDER_TRAILING.exec(line)
    const ladderCounts = LADDER.exec(line) ?? (trailing ? [line, trailing[2]!, trailing[1]!] : null)
    let mainLift = ladderCounts?.[2]?.trim() ?? ''
    // "Counting: 12-8-4-8-12-(16) (Complete all reps of the main exercise)": the
    // parenthetical explains the ladder, it is not the lift.
    const ladderNote = /^\((.+)\)$/.exec(mainLift)
    if (ladderNote) mainLift = ''
    if (ladderCounts && (mainLift === '' || (/^\p{L}/u.test(mainLift) && !UNIT_WORD.test(mainLift)))) {
      flushAmrap()
      const counts = ladderCounts[1]!
        .split(new RegExp(`(?:[${DASH_CHARS},]|→|->)`))
        // A rung offered rather than required is written "(16)". It is still a
        // rung; the brackets are the instructor saying "if you have it in you".
        .map((part) => Number(part.replace(/[()]/g, '').trim()))
        .filter((count) => Number.isFinite(count))
      const group: Ladder = { kind: 'ladder', id: nextId('lad'), counts, children: [] }
      ensureSection().children.push(group)
      target = { kind: 'ladder-main', group }
      eachMs = null
      if (ladderNote) addNote(ladderNote[1]!)
      // Named on the same line, so it is the lift the rungs count.
      if (mainLift !== '') addItem(parseItem(mainLift))
      return
    }

    const rounds = ROUNDS.exec(unwrapped)
    if (rounds) {
      // Whether an AMRAP was open is decided BEFORE it is flushed: flushed, it
      // is one more loose segment, and "4 Rounds" under it wrapped the ten-minute
      // clock into the repeat for forty minutes of AMRAP.
      const afterAmrap = amrap !== null
      flushAmrap()
      // "3–5 Rounds" stores the upper bound; the runner can end a section early.
      const times = Number(rounds[2] ?? rounds[1])
      // "0 Rounds" is not a round count; reported rather than built as a group
      // that never runs.
      if (times < 1) {
        skipped.push({ line: number, text: line })
        return
      }
      const group: Repeat = { kind: 'repeat', id: nextId('rep'), times, children: [], label: 'Round' }
      const host = ensureSection()
      /*
       * "Repeat 2 rounds" is written above the steps it repeats in one email and
       * BELOW them in the next. Read after a run of loose steps it closes a block
       * rather than opening one, so those steps move inside it.
       *
       * Only loose steps, and only with no group already open: a section that has
       * built a ladder or a round is a section whose structure is already stated,
       * and swallowing it would rewrite the workout rather than read it.
       */
      const trailing =
        target.kind === 'section' &&
        !afterAmrap &&
        host.children.length > 0 &&
        host.children.every((child) => child.kind === 'segment')
      if (trailing) {
        group.children.push(...host.children)
        host.children.length = 0
      }
      host.children.push(group)
      target = { kind: 'rounds', group }
      eachMs = null
      return
    }

    // "3 × 30 seconds" over a list: a round count and the time each step gets.
    const setsOf = SETS_OF.exec(line)
    if (setsOf) {
      flushAmrap()
      const group: Repeat = {
        kind: 'repeat',
        id: nextId('rep'),
        times: Number(setsOf[1]),
        children: [],
        label: 'Round',
      }
      ensureSection().children.push(group)
      target = { kind: 'rounds', group }
      eachMs = toMs(setsOf[2]!, setsOf[3]!)
      return
    }

    const roundRest = ROUND_REST.exec(line)
    if (roundRest) {
      const seconds = Number(roundRest[2] ?? roundRest[1])
      if (target.kind === 'rounds') target.group.children.push(restFor(seconds * 1000))
      addNote(line)
      return
    }

    /*
     * "15 sec rest between exercises", stated after the list it applies to.
     *
     * BETWEEN, so there is one fewer rest than there are steps: the last exercise
     * of a round runs straight into the next round, which is what the line says
     * and not what a rest after every step would do. With nothing to space out
     * yet it is only an instruction, and is kept as one.
     */
    const betweenRest = BETWEEN_REST.exec(line)
    if (betweenRest) {
      const host = target.kind === 'section' ? ensureSection() : target.group
      if (host.children.length < 2) {
        addNote(line)
        return
      }
      const ms = toMs(betweenRest[1]!, betweenRest[2]!)
      const spaced: Block[] = []
      for (const child of host.children) {
        if (spaced.length > 0) spaced.push(restFor(ms))
        spaced.push(child)
      }
      host.children.splice(0, host.children.length, ...spaced)
      return
    }

    // "30 sec WORK" heads the exercise on the next line; "30 sec REST" is a step.
    const workRest = WORK_REST.exec(line)
    if (workRest) {
      const ms = toMs(workRest[1]!, workRest[2]!)
      if (/rest/i.test(workRest[3]!)) {
        push(restFor(ms))
        return
      }
      pendingMs = ms
      expectItem = true
      return
    }

    // "LAST 20 SECONDS", over the all-out effort on the line below.
    const lastStretch = LAST_STRETCH.exec(line)
    if (lastStretch) {
      pendingMs = toMs(lastStretch[1]!, lastStretch[2]!)
      expectItem = true
      return
    }

    if (MINUTE_HEADING.test(line)) {
      pendingMs = MINUTE_MS
      pendingFill = true
      expectItem = true
      return
    }

    const minuteItem = MINUTE_ITEM.exec(line)
    if (minuteItem) return addMinute(minuteItem[1]!)

    if (MAIN_EXERCISE.test(line)) {
      if (target.kind === 'ladder-accessory' || target.kind === 'ladder-main') {
        target = { kind: 'ladder-main', group: target.group }
        expectMain = true
      }
      return
    }

    if (AFTER_EVERY_SET.test(line)) {
      if (target.kind === 'ladder-main' || target.kind === 'ladder-accessory') {
        target = { kind: 'ladder-accessory', group: target.group }
      }
      return
    }

    /*
     * "Every time you finish a round:" introduces the step that CLOSES a round,
     * which is where the next item lands anyway: at the end of the open round,
     * or at the end of the list when the block is an AMRAP with no round to open.
     */
    if (EVERY_ROUND.test(line)) {
      expectItem = true
      return
    }

    // "Then:" ends the block above it. Without this the list that follows lands
    // inside the ladder it was written to come after.
    if (THEN.test(line)) {
      // An AMRAP is a block too: "Then:" under one used to add what followed
      // to its round.
      flushAmrap()
      target = { kind: 'section' }
      eachMs = null
      return
    }

    if (LIST_OPENER.test(line)) return

    const bonus = BONUS.exec(line)
    if (bonus) {
      // The bonus follows the ladder rather than sitting inside it.
      target = { kind: 'section' }
      addItem(parseItem(bonus[1]!.replace(/^after [^,]+,\s*/i, '')))
      return
    }

    // Only a line of its own can retime the list: a bulleted "Side Plank -
    // 30 seconds each side" is a step stating its own time, not a directive,
    // and consuming it here silently deleted the step and retimed the rest.
    const each = !BULLET.test(line) && !NUMBERED.test(line) ? EACH_FOR.exec(line) : null
    if (each) {
      eachMs = toMs(each[1]!, each[2]!)
      return
    }

    /*
     * "Replace rest with 30-second Squat Hold" is both: the hold is a real step,
     * and what it replaces is why it is there, so the line is kept as a note too.
     */
    const replace = REPLACE_WITH.exec(line)
    if (replace) {
      addNote(line)
      addItem(parseItem(replace[1]!))
      return
    }

    // "Rest 30 seconds" on its own line is a rest STEP, not an instruction about
    // the section: the routines before July have no bullets, and this read as a
    // note and vanished from the clock. "Rest 30 seconds between rounds" stays
    // an instruction.
    if (/^rest\b/i.test(line) && /\d\s*(?:sec|min)/i.test(line) && !/\b(?:between|after|each)\b/i.test(line)) {
      addItem(parseItem(line))
      return
    }

    if (SECTION_NOTE.test(line) && !BULLET.test(line) && !NUMBERED.test(line)) {
      addNote(line)
      return
    }

    /*
     * The room, not a step. Kept as the section's note so it is still readable,
     * and its distance is what the legs beneath it are measured in.
     */
    const course = COURSE.exec(line)
    if (course) {
      courseDistance = course[1]!.replace(/\s+/g, '')
      addNote(line)
      return
    }

    /*
     * "Walking lunge A-B" and then "Walking lunge B-A": the same course walked
     * out and back. Named for what is done rather than for the markers, since
     * "A-B" means nothing once the diagram is off the screen.
     */
    const leg = COURSE_LEG.exec(line)
    if (leg && courseDistance) {
      const markers = `${leg[2]!.toUpperCase()}-${leg[3]!.toUpperCase()}`
      return addItem(parseItem(`${tidy(leg[1]!)} ${courseDistance} ${markers}`))
    }

    /*
     * A length the app cannot work out: "wall sit till 1min is over". It waits
     * for Next rather than inventing a number.
     */
    if (OPEN_ENDED.test(line) && !BULLET.test(line)) {
      return addItem({ name: tidy(line), perSide: PER_SIDE.test(line) })
    }

    /*
     * A row of a pyramid circuit: "1", "1 + 2", "1 + 2 + 3". Held rather than
     * built, because the numbered lines it spends may not have been read yet.
     */
    if (PYRAMID_ROW.test(line)) {
      pyramidRows.push({
        rungs: line.split('+').map((part) => Number(part.trim())),
        line: number,
        text: line,
      })
      return
    }

    const dashIndex = NUMBERED_DASH_INDEX.exec(line)?.[1]
    const bullet = BULLET.exec(line) ?? NUMBERED.exec(line) ?? NUMBERED_DASH.exec(line)
    if (bullet) {
      // Inside an AMRAP the list is the round, and the round is one step's note.
      if (amrap) {
        amrap.round.push(tidy(bullet[1]!))
        return
      }
      if (readDurationLadder(bullet[1]!)) return
      // Under a "Minute N" heading a joined pair is ONE minute's work, exactly
      // as it is on the one-line form; split, the second half became an untimed
      // gate that doubled the minute.
      if (pendingFill) return addMinute(bullet[1]!)
      for (const part of bullet[1]!.split(JOINED_ITEMS)) addItem(parseItem(part))
      if (dashIndex !== undefined && lastStep) {
        numberedItems.push({ index: Number(dashIndex), block: lastStep })
      }
      return
    }

    // A lone "or …" qualifies the step above it rather than being one itself.
    const alternative = ALTERNATIVE_LINE.exec(line)
    if (alternative && lastStep) {
      lastStep.alternative = tidy(alternative[1]!)
      return
    }

    // A directive on the line above announced this one. See `expectItem`.
    if (expectItem) {
      expectItem = false
      // "Every time you finish a round: / 10 Mountain Climbers" closes an AMRAP's
      // round exactly as it closes any other, so it belongs in the same note.
      if (amrap) {
        amrap.round.push(tidy(line))
        return
      }
      return addItem(parseItem(line))
    }

    // A bare line right after "Main Exercise:", or the first one under a bare
    // ladder count, is that ladder's main lift.
    if (target.kind === 'ladder-main' && (expectMain || target.group.children.length === 0)) {
      expectMain = false
      return addItem(parseItem(line))
    }

    /*
     * "Squats (heels on weights) 20sec - 10sec squat hold": two steps, not a
     * range. The first is the work and the second is what to hold at the end of
     * it, which is what the line says if you read it aloud.
     */
    const pair = INTERVAL_PAIR.exec(line)
    if (pair) {
      addItem(parseItem(`${tidy(pair[1]!)} - ${pair[2]!} ${pair[3]!}`))
      return addItem(parseItem(`${tidy(pair[6]!)} - ${pair[4]!} ${pair[5]!}`))
    }

    /*
     * A heading that says it is one by ending in a colon. LAST of all, so every
     * rule that could have claimed the line has already declined it.
     */
    if (COLON_HEADING.test(line)) return openSection(line.replace(/:$/, ''))

    // A length on its own under a heading is how long that section runs.
    if (BARE_DURATION.test(line)) return addNote(line)

    /*
     * A bare line that states its own AMOUNT is a step, whether that amount is a
     * time or a count. The trampoline warm-up ends with "Sprint Finish – Fast
     * feet for 15 seconds"; the routines before July are written almost entirely
     * as "10 x Tricep dips" with no bullet at all.
     *
     * A count needs its name to begin with a LETTER, which a duration does not.
     * "1 + 2" and "1 + 2 + 3" are an accumulator written down the page, and
     * without that guard they become a step called "+ 2": a junk step that looks
     * like a parse, which is worse than a line reported as unread.
     */
    const loose = parseItem(line)
    if (loose.durationMs !== undefined) return addItem(loose)
    if (loose.count !== undefined && /^\p{L}/u.test(loose.name)) return addItem(loose)

    skipped.push({ line: number, text: line })
  })

  closeSection(true)

  const prepare = blocks.length > 0 ? getReady(blocks) : null
  return { name, blocks: prepare ? [prepare, ...blocks] : blocks, skipped }
}
