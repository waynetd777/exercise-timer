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
const NUMBERED_SECTION = /^#\s*\d+\s*(.+)$/

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
const UNIT = '(sec|secs|second|seconds|min|mins|minute|minutes)'

const toMs = (value: string, unit: string): number =>
  Math.round(Number(value) * (unit.toLowerCase().startsWith('m') ? 60_000 : 1_000))

/**
 * "40 sec each", "30 seconds each – continuous movement", "Mobility – 30 seconds each".
 * NOT "30 seconds each side": that is one step's own time per side, and reading
 * it as a directive would retime every exercise after it.
 */
const EACH_FOR = new RegExp(`${NUMBER}\\s*${UNIT}\\s+each\\b(?!\\s+(?:side|leg|arm|direction))`, 'i')

/** "4 Rounds", "3-5 Rounds:". The upper bound wins, as agreed. */
const ROUNDS = new RegExp(`^(\\d+)\\s*(?:${DASH}\\s*(\\d+))?\\s*rounds?\\b`, 'i')

/** "Counting: 2-4-6-8-10-8-6-4-2", or the bare "15-12-9-6-3-6-9-12-15". */
const LADDER = new RegExp(`^(?:counting:\\s*)?(\\d+(?:\\s*${DASH}\\s*\\d+){2,})\\s*$`, 'i')

/** "Rest 45 seconds after each round", "Rest: 30–45 seconds after each round". */
const ROUND_REST = new RegExp(
  `\\brest:?\\s*(\\d+)(?:\\s*${DASH}\\s*(\\d+))?\\s*(?:sec|secs|second|seconds)\\b.*\\bafter each round`,
  'i',
)

const MAIN_EXERCISE = /^main\s+exercise:?\s*$/i
/** "After every set:", "After every Goblet Squat set:". */
const AFTER_EVERY_SET = /^after every\b.*\bset:?\s*$/i
/** Openers that introduce a plain list and mean nothing structural. */
const LIST_OPENER = /^(perform the following|complete (?:the following|without stopping|once)):?\s*$/i
/** "Bonus: After completing the ladder, 30 seconds fast mountain climbers". */
const BONUS = /^bonus:\s*(.+)$/i

/** Instructions that belong on the section rather than on any one step. */
const SECTION_NOTE =
  /^(complete\b.*\b(?:exercise|count)\b|no rest between exercises|rest\b|reps? and sets?\b)/i

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

function restStep(seconds: number): Segment {
  return { kind: 'segment', id: nextId('seg'), name: 'Rest', role: 'rest', durationMs: seconds * 1000 }
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

  const closeSection = () => {
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

    // A timed step keeps its own duration; "40 sec each" fills in the rest.
    const durationMs =
      item.durationMs ?? (item.count === undefined && eachMs !== null ? eachMs : undefined)

    const step = segment(item, durationMs, reps)
    push(step)
    lastStep = step
  }

  const lines = text.split('\n')

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line === '') return
    const number = i + 1

    // Headings first: they reset everything below them.
    const numbered = NUMBERED_SECTION.exec(line)
    if (numbered) return openSection(numbered[1]!)

    const flame = FLAME_SECTION.exec(line)
    if (flame) return openSection(flame[1]!)

    if (AFTER_ROUND_SECTION.test(line)) return openSection(line.replace(/:$/, ''))

    const named = NAMED_SECTION.exec(line)
    if (named && !BULLET.test(line) && !NUMBERED.test(line)) {
      openSection(line.replace(/[:：]\s*$/, ''))
      // "WARM-UP – 40 seconds each" is a heading AND a duration directive.
      const each = EACH_FOR.exec(line)
      if (each) eachMs = toMs(each[1]!, each[2]!)
      return
    }

    const ladderCounts = LADDER.exec(line)
    if (ladderCounts) {
      const counts = ladderCounts[1]!
        .split(new RegExp(DASH))
        .map((part) => Number(part.trim()))
        .filter((count) => Number.isFinite(count))
      const group: Ladder = { kind: 'ladder', id: nextId('lad'), counts, children: [] }
      ensureSection().children.push(group)
      target = { kind: 'ladder-main', group }
      eachMs = null
      return
    }

    const rounds = ROUNDS.exec(line)
    if (rounds) {
      // "3–5 Rounds" stores the upper bound; the runner can end a section early.
      const times = Number(rounds[2] ?? rounds[1])
      const group: Repeat = { kind: 'repeat', id: nextId('rep'), times, children: [], label: 'Round' }
      ensureSection().children.push(group)
      target = { kind: 'rounds', group }
      eachMs = null
      return
    }

    const roundRest = ROUND_REST.exec(line)
    if (roundRest) {
      const seconds = Number(roundRest[2] ?? roundRest[1])
      if (target.kind === 'rounds') target.group.children.push(restStep(seconds))
      addNote(line)
      return
    }

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

    if (SECTION_NOTE.test(line) && !BULLET.test(line) && !NUMBERED.test(line)) {
      addNote(line)
      return
    }

    const bullet = BULLET.exec(line) ?? NUMBERED.exec(line)
    if (bullet) {
      for (const part of bullet[1]!.split(JOINED_ITEMS)) addItem(parseItem(part))
      return
    }

    // A lone "or …" qualifies the step above it rather than being one itself.
    const alternative = ALTERNATIVE_LINE.exec(line)
    if (alternative && lastStep) {
      lastStep.alternative = tidy(alternative[1]!)
      return
    }

    // A bare line right after "Main Exercise:", or the first one under a bare
    // ladder count, is that ladder's main lift.
    if (target.kind === 'ladder-main' && (expectMain || target.group.children.length === 0)) {
      expectMain = false
      return addItem(parseItem(line))
    }

    // A bare line that states its own duration is a step: the trampoline
    // warm-up ends with "Sprint Finish – Fast feet for 15 seconds".
    const loose = parseItem(line)
    if (loose.durationMs !== undefined) return addItem(loose)

    skipped.push({ line: number, text: line })
  })

  closeSection()

  const prepare = blocks.length > 0 ? getReady(blocks) : null
  return { name, blocks: prepare ? [prepare, ...blocks] : blocks, skipped }
}
