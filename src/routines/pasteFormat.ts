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
const FLAME_SECTION = /^🔥\s*(.+?):?$/

/** "After Round 4", the same idea without the emoji. */
const AFTER_ROUND_SECTION = /^after round\s+\d+:?\s*$/i

/**
 * Headings with no marker of their own. Deliberately a closed vocabulary: a
 * heuristic like "Title Case on its own line" would swallow half the exercises.
 */
const NAMED_SECTION =
  /^((?:trampoline\s+)?warm[-\s]?up|cool[-\s]?down|final\s+burnout|band\s+burner|burnout\s+ladder)\b(.*)$/i

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
  `^(?:repeat\\s*[×x]?\\s*)?(\\d+)\\s*(?:${DASH}\\s*(\\d+))?\\s*rounds?\\b`,
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
const LADDER = new RegExp(
  `^(?:counting:\\s*)?(\\d+(?:\\s*${DASH}\\s*\\d+){2,})\\s*(.*)$`,
  'i',
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
  /^(complete\b.*\b(?:exercise|count)\b|no rest between exercises|rest\b|reps? and sets?\b|as many\b|start a new\b|work\s*(?:→|->)\s*rest\b)/i

const BULLET = new RegExp(`^(?:[*•]|${DASH})\\s+(.+)$`)
const NUMBERED = /^\d+\.\s+(.+)$/
/** A lone "or …" line: the previous step's low-impact swap. */
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
const TRAILING_DURATION = new RegExp(
  `^(.+?)[\\s${DASH_CHARS}:]+${NUMBER}\\s*${UNIT}(?:\\s+each\\s+(?:side|leg|arm|direction))?\\s*$`,
  'i',
)
/** "12 × Hammer Curls", and the bare "20 Flutter Kicks". */
const LEADING_COUNT = /^(\d+)\s*(?:[×x]\s*|\s)(.+)$/
/** "wide squats 15x", "…crunch x12". The `x` is what makes it a count. */
const TRAILING_COUNT = /^(\p{L}.*?)[\s:]+(?:[×x]\s*(\d+)|(\d+)\s*[×x])$/u

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
const DESCRIPTION_CHARS = 24

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
const PREPARE_NAME = /^(get (ready|set)|prepare|set ?up)\b/i
const REST_NAME = /\brest\b/i

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

  const closeSection = () => {
    flushAmrap()
    if (!section) return
    if (section.children.length > 0) {
      section.display = displayFor(section.children)
      blocks.push(section)
    }
    section = null
  }

  const openSection = (title: string) => {
    closeSection()
    section = { kind: 'section', id: nextId('sec'), name: tidy(title), display: 'list', children: [] }
    target = { kind: 'section' }
    eachMs = null
    lastStep = null
    expectItem = false
    pendingMs = null
    pendingFill = false
    amrap = null
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

  const lines = text.split('\n')

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line === '') return
    const number = i + 1

    /*
     * Headings first: they reset everything below them.
     *
     * A heading can arrive behind a marker: "(Optional) 🔥 Final Burnout". It is
     * matched without the marker and NAMED with it, because whether a block is
     * optional is the reader's to know, not the parser's to drop.
     */
    const marker = LEADING_PAREN.exec(line)?.[0] ?? ''
    const heading = line.slice(marker.length)

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

    const trailing = LADDER_TRAILING.exec(line)
    const ladderCounts = LADDER.exec(line) ?? (trailing ? [line, trailing[2]!, trailing[1]!] : null)
    const mainLift = ladderCounts?.[2]?.trim() ?? ''
    if (ladderCounts && (mainLift === '' || (/^\p{L}/u.test(mainLift) && !UNIT_WORD.test(mainLift)))) {
      flushAmrap()
      const counts = ladderCounts[1]!
        .split(new RegExp(DASH))
        .map((part) => Number(part.trim()))
        .filter((count) => Number.isFinite(count))
      const group: Ladder = { kind: 'ladder', id: nextId('lad'), counts, children: [] }
      ensureSection().children.push(group)
      target = { kind: 'ladder-main', group }
      eachMs = null
      // Named on the same line, so it is the lift the rungs count.
      if (mainLift !== '') addItem(parseItem(mainLift))
      return
    }

    const rounds = ROUNDS.exec(line)
    if (rounds) {
      flushAmrap()
      // "3–5 Rounds" stores the upper bound; the runner can end a section early.
      const times = Number(rounds[2] ?? rounds[1])
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

    if (SECTION_NOTE.test(line) && !BULLET.test(line) && !NUMBERED.test(line)) {
      addNote(line)
      return
    }

    const bullet = BULLET.exec(line) ?? NUMBERED.exec(line)
    if (bullet) {
      // Inside an AMRAP the list is the round, and the round is one step's note.
      if (amrap) {
        amrap.round.push(tidy(bullet[1]!))
        return
      }
      for (const part of bullet[1]!.split(JOINED_ITEMS)) addItem(parseItem(part))
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

  closeSection()

  const prepare = blocks.length > 0 ? getReady(blocks) : null
  return { name, blocks: prepare ? [prepare, ...blocks] : blocks, skipped }
}
