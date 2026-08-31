/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Builds a routine from a few answers, in the shape of the routines this app has
 * already been given.
 *
 * PURE, and no React, for the same reason the engine and the editor are: the
 * fiddly parts here are arithmetic and ordering, and they should be testable
 * without a browser. `rng` is injected so a test can pin a routine and so
 * "generate another" gives a different one.
 *
 * It INVENTS NOTHING. Every exercise comes from `exercises.ts`, every duration
 * from the routines the shapes were read off, and a weight is either one Wayne
 * has used for that exercise before or left blank. Anything it had to do that
 * was not asked for goes in `notes` and is shown, because a routine that quietly
 * dropped an area you selected looks like it worked.
 *
 * TWO SHAPES, read off real routines:
 *
 *  - `passive`, from `beginner-full-body.routine.json`:
 *    get ready, a group of sets, then a minute to recover.
 *  - `active`, from Wayne's mixed-cardio routines: announce the next exercise
 *    and its weight, a minute of cardio while you set the machine up, get ready,
 *    then the sets. Wrapped in a ten-minute cardio warm-up and a cool down.
 *
 * And a third, `sections`, read off the instructor's sixteen: see `THEME_SHAPE`.
 *
 * The length is not estimated and then hoped for. Exercises are added one at a
 * time and each one's real cost is known, so a per-side exercise costing two
 * blocks and an ankle-strap one costing five more seconds are both accounted for
 * exactly rather than averaged.
 */

import type { Block, Repeat, Section, Segment, Workout } from '../engine/types'
import { SCHEMA_VERSION } from '../engine/types'
import { blocksDurationMs, DEFAULT_LADDER_LABEL, DEFAULT_REPEAT_LABEL } from '../engine'
import { newId } from '../id'
import type { BodyArea, Exercise, Pattern } from './exercises'
import { EXERCISES, needsRigging, PREPARE_MS, RIG_PREPARE_MS } from './exercises'
import type { Prescription } from './exercises.prescription'
import { PRESCRIPTIONS } from './exercises.prescription'
import {
  LADDER_COUNTS,
  SECTION_THEMES,
  SECTIONS_MAX,
  SECTIONS_TYPICAL,
  WARM_UP_MOVES,
} from './exercises.shapes'
import { foldName } from './foldName'
import { exerciseKey } from './loads'
import { estimate } from './estimate'
import { GET_READY_MS } from './pasteFormat'
import { bundled } from '../media/resolve'

export type Recovery = 'passive' | 'active'

/**
 * Which kind of routine to build.
 *
 * `circuit` is the shape Wayne's own mixed-cardio routines take: one exercise at
 * a time, everything on a clock, so the length is knowable and solvable.
 *
 * `sections` is the shape his instructor sends: named sections, two or three
 * of them ladders, and most steps COUNTED rather than timed. Its length is not
 * knowable, because a self-paced step ends when you tap Next, so it is ESTIMATED
 * at a seconds-per-rep rate and whole sections are fitted to the minutes asked.
 * It was asked how many sections instead; Wayne's later decision (2026-08-28)
 * was that both shapes should be asked the same question.
 */
export type Style = 'circuit' | 'sections'

/** Multi-gym, nothing but the multi-gym, or both. */
export type EquipmentScope = 'machine' | 'none' | 'mixed'

export type RoutineSpec = {
  name?: string
  /** Roughly. The result is as close as whole exercises allow, and says how close. */
  totalMs: number
  areas: readonly BodyArea[]
  recovery: Recovery
  /** A cardio exercise's name, for `active`. Defaults to Cycling. */
  recoveryExercise?: string
  /** What the ten minutes at the start are. Defaults to Cycling. */
  warmUpExercise?: string
  /** What the minute at the end is. Defaults to Cycling. */
  coolDownExercise?: string
  /** How long the opening stretch of cardio runs. Defaults to ten minutes. */
  warmUpMs?: number
  /**
   * How long each gap between exercises runs, whether it is spent moving or
   * resting. Defaults to a minute, which is what both shapes were read off.
   */
  recoveryMs?: number
  /** How long the closing stretch runs. Defaults to two minutes. */
  coolDownMs?: number
  /**
   * Cardio exercises to draw the between-set minutes from, a different one each
   * time. Takes precedence over `recoveryExercise`; absent means the same
   * exercise all the way down.
   *
   * A LIST rather than a flag, so "surprise me" can still be bounded: nobody
   * wants a routine that is happy to put burpees in every gap, and the choice of
   * what may come up is the user's.
   *
   * The WARM-UP and the COOL DOWN are not included. They bookend the routine and
   * are named for what they are rather than for the exercise, so varying them
   * would change a picture and nothing else. Ten minutes of one thing is also
   * what a warm-up IS, and ten minutes of burpees is not something to hand
   * anybody.
   */
  recoveryPool?: readonly string[]
  equipment: EquipmentScope
  /** Sets per exercise. A per-side exercise gets two a side regardless. */
  sets?: number
  /** Reps in each multi-gym set. Defaults to twelve. */
  machineReps?: number
  /** Defaults to `circuit`. */
  style?: Style
  /**
   * Sections, for `sections`, as an OVERRIDE. Left out, the count is fitted to
   * `totalMs` by estimate. Given, that many are built, bookends included.
   */
  sections?: number
}

export type GeneratedRoutine = {
  workout: Workout
  /** Everything it did that the spec did not ask for. Never silent. */
  notes: string[]
}

type Rng = () => number

/** Timings taken from the routines these shapes were read off, not chosen. */
const WORK_MS = 20_000
const REST_MS = 10_000
const ANNOUNCE_MS = 30_000
const RECOVER_MS = 60_000
const WARM_UP_MS = 600_000
/** Longer than a recovery minute: the end of a session is not another gap in it. */
const COOL_DOWN_MS = 120_000
const DEFAULT_SETS = 3
/** A side gets two sets, not three, which is Wayne's own rule. */
const PER_SIDE_SETS = 2
/**
 * What a multi-gym set asks for: twelve reps inside twenty seconds.
 *
 * Both, not one or the other. The clock paces you and the count is the target,
 * which is exactly what the editor's `× in` unit exists to say. Wayne's own
 * routines read "12 × Leg Press 65kg" for twenty seconds, and until the editor
 * could hold both that twelve had to live in the step's NAME.
 *
 * Only for the machine. Everything else is prescribed the way the instructor
 * prescribes it, which is what `exercises.prescription.ts` is for.
 */
const MACHINE_REPS = 12
/** The longest a circuit set runs. See `asks`. */
const MAX_SET_MS = 45_000
/** Each movement in a warm-up, which the routines write as "40 sec each". */
const WARM_UP_EACH_MS = 40_000
/** Between rounds of a section, which the routines write as "Rest 45 seconds". */
const ROUND_REST_MS = 45_000
/** Where nothing has ever been prescribed for a counted step. */
const DEFAULT_REPS = 12
/**
 * The fewest sections that can be asked for.
 *
 * BELOW what the corpus does: no routine in the corpus has fewer than five, and
 * `SECTIONS_MIN` in `exercises.shapes.ts` says so. This is a shorter session than the instructor writes,
 * which is a reasonable thing to want and not a claim about what she sends.
 */
export const SECTIONS_FEWEST = 3

/** Whether the spec names a section count at all. NaN and Infinity do not count. */
function hasSectionCount(spec: RoutineSpec): spec is RoutineSpec & { sections: number } {
  return spec.sections !== undefined && Number.isFinite(spec.sections)
}

/** A count the builder will honour: whole, and within the bounds. */
function clampSections(count: number): number {
  return Math.min(SECTIONS_MAX, Math.max(SECTIONS_FEWEST, Math.round(count)))
}

/** The section count asked for, or the usual one where the spec has none or nonsense (NaN). */
function sectionsAsked(spec: RoutineSpec): number {
  return hasSectionCount(spec) ? spec.sections : SECTIONS_TYPICAL
}

/**
 * What one set of this exercise asks for.
 *
 * The multi-gym is Wayne's rule: twelve reps inside twenty seconds, whatever the
 * movement. Everything else is prescribed the way the instructor prescribes IT,
 * out of `exercises.prescription.ts`, which is why a plank comes out as forty
 * seconds and hammer curls as twelve.
 *
 * Timed either way. These are the circuit shapes, where the clock is what makes
 * the length knowable; a count rides along as the target. An exercise nobody has
 * ever prescribed gets the plain twenty seconds.
 */
function asks(exercise: Exercise, machineReps: number): { durationMs: number; count?: number } {
  if (exercise.equipment === 'machine') return { durationMs: WORK_MS, count: machineReps }

  const said = prescribed(exercise)
  if (!said) return { durationMs: WORK_MS }
  /*
   * Capped at `MAX_SET_MS`, because some of the harvested durations are the
   * FORMAT'S rather than the exercise's: an EMOM minute is sixty seconds because
   * the EMOM says so, not because a bicep curl takes a minute. In a circuit that
   * would be three minutes of curls with ten-second rests.
   */
  const wanted = (said.seconds ?? WORK_MS / 1000) * 1000
  return {
    durationMs: Math.min(Math.max(wanted, WORK_MS), MAX_SET_MS),
    ...(said.prescribe === 'reps' && said.reps !== undefined ? { count: said.reps } : {}),
  }
}

/**
 * A small deterministic generator, so a seed pins a routine.
 *
 * mulberry32. Not for anything that needs to be unguessable; it shuffles a list
 * of squats.
 */
export function seeded(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One of `items`, more often the ones seen more. Every ladder the instructor
 * has written is a candidate, in proportion to how often she wrote it: a fixed
 * cut of the first six left thirteen of the nineteen unreachable.
 */
function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let at = rng() * total
  for (const item of items) {
    at -= weight(item)
    if (at < 0) return item
  }
  return items[items.length - 1]!
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * The weight last used for this exercise, from routines already saved.
 *
 * The reason `Segment.load` being a real field matters: a generated routine
 * arrives already loaded to what you were lifting last time, without anyone
 * typing it in twice. A step whose name carries a count is matched on the name
 * underneath it, since "12 × Leg Press" and "Leg Press" are the same exercise.
 *
 * Nothing found leaves the field empty. A weight is not something to guess.
 */
function loadFrom(library: readonly Workout[]): Map<string, string> {
  const found = new Map<string, string>()
  const bare = (name: string) => name.replace(/^\s*\d+\s*×\s*/, '').trim().toLowerCase()

  // Oldest first, so a more recent routine overwrites what an older one said.
  const ordered = [...library].sort(
    (a, b) => (a.lastRunAt ?? a.updatedAt) - (b.lastRunAt ?? b.updatedAt),
  )
  const walk = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      if (block.kind !== 'segment') {
        walk(block.children)
      } else if (block.load?.trim()) {
        found.set(bare(block.name), block.load.trim())
      }
    }
  }
  for (const workout of ordered) walk(workout.blocks)
  return found
}

function eligible(scope: EquipmentScope, exercise: Exercise): boolean {
  if (scope === 'mixed') return true
  return scope === 'machine' ? exercise.equipment === 'machine' : exercise.equipment !== 'machine'
}

/**
 * How many of each area to aim for, in proportion to what is available.
 *
 * Proportional rather than equal because the pools are lopsided: asking for
 * upper and torso off the machine alone is asking for 25 exercises and 5, and
 * splitting those evenly would run the torso out immediately and repeat it.
 */
function share(areas: readonly BodyArea[], pools: Map<BodyArea, Exercise[]>, total: number) {
  const sizes = areas.map((area) => pools.get(area)?.length ?? 0)
  const sum = sizes.reduce((a, b) => a + b, 0)
  const want = new Map<BodyArea, number>()
  areas.forEach((area, i) => {
    want.set(area, sum === 0 ? 0 : Math.max(1, Math.round((total * sizes[i]!) / sum)))
  })
  return want
}

/**
 * The next area to work, never the same as the last one.
 *
 * This is what makes a generated routine read like Wayne's: routine 2 runs legs,
 * core, push, legs, push, legs, pull, core, pull, legs, and never puts two of the
 * same area together. Take whichever area is furthest behind its share, skipping
 * the one just used.
 */
function nextArea(
  want: Map<BodyArea, number>,
  used: Map<BodyArea, number>,
  previous: BodyArea | null,
): BodyArea | null {
  const areas = [...want.keys()]
  const behind = (area: BodyArea) => (want.get(area) ?? 0) - (used.get(area) ?? 0)
  /*
   * "Not the one just used" is a rule about ALTERNATING, so it only applies when
   * there is something to alternate with. Asking for the torso alone otherwise
   * excludes the only area available and the routine stops after one exercise.
   */
  const allowed = areas.length === 1 ? areas : areas.filter((area) => area !== previous)
  const keen = allowed.filter((area) => behind(area) > 0)
  const pick = keen.length > 0 ? keen : allowed
  if (pick.length === 0) return null
  return pick.reduce((best, area) => (behind(area) > behind(best) ? area : best), pick[0]!)
}

const segment = (over: Partial<Segment> & { name: string; role: Segment['role'] }): Segment => ({
  kind: 'segment',
  id: newId(),
  ...over,
})

const sets = (child: Segment, times: number): Repeat => ({
  kind: 'repeat',
  id: newId(),
  times,
  label: DEFAULT_REPEAT_LABEL,
  children: [child, segment({ name: 'Rest', role: 'rest', durationMs: REST_MS })],
})


/** Everything one exercise contributes, ready to be costed before it is kept. */
function exerciseBlocks(
  exercise: Exercise,
  spec: RoutineSpec,
  load: string | undefined,
  recoveryName: string,
  recoveryMedia: string | undefined,
  announce: boolean,
  recoverMs: number,
): Block[] {
  const prepareMs = needsRigging(exercise) ? RIG_PREPARE_MS : PREPARE_MS
  const labelled = load ? `${exercise.name} ${load}` : exercise.name
  const set = asks(exercise, spec.machineReps ?? MACHINE_REPS)
  const work = segment({
    name: exercise.name,
    role: 'work',
    durationMs: set.durationMs,
    ...(set.count !== undefined ? { reps: { kind: 'fixed' as const, count: set.count } } : {}),
    ...(load ? { load } : {}),
    ...(exercise.media ? { media: bundled(exercise.media) } : {}),
  })
  const count = exercise.perSide ? PER_SIDE_SETS : (spec.sets ?? DEFAULT_SETS)

  const blocks: Block[] = []
  if (spec.recovery === 'active') {
    /*
     * The announcement, then the cardio you set the machine up during. Wayne's
     * own format, and the reason it names the weight: the minute on the bike is
     * when you change the pin.
     */
    if (announce) {
      /*
       * Thirty seconds to announce it, but only for a MACHINE exercise.
       *
       * The long announcement is not there to be read: it is the time you spend
       * changing the pin and moving the seat while the cardio minute runs. A
       * press-up needs none of that, so it gets the ordinary fifteen. The name
       * and the weight stay either way, since knowing what is coming is the
       * other half of what the step is for.
       */
      const announceMs = exercise.equipment === 'machine' ? ANNOUNCE_MS : PREPARE_MS
      blocks.push(
        segment({ name: `Get ready: ${labelled}`, role: 'prepare', durationMs: announceMs }),
        segment({
          name: recoveryName,
          role: 'work',
          durationMs: recoverMs,
          ...(recoveryMedia ? { media: bundled(recoveryMedia) } : {}),
        }),
      )
    }
    blocks.push(segment({ name: 'Get ready', role: 'prepare', durationMs: prepareMs }))
  } else {
    // No cardio to announce it during, so the get-ready carries the name itself.
    blocks.push(
      segment({ name: `Get ready: ${labelled}`, role: 'prepare', durationMs: prepareMs }),
    )
  }

  blocks.push(sets(work, count))
  if (exercise.perSide) {
    blocks.push(segment({ name: 'Change Sides', role: 'prepare', durationMs: prepareMs }))
    blocks.push(sets({ ...work, id: newId() }, count))
  }
  if (spec.recovery === 'passive') {
    blocks.push(segment({ name: 'Recover', role: 'recover', durationMs: recoverMs }))
  }
  return blocks
}

/**
 * What each theme IS, read off the 16 routines. The counts are in
 * `README.md` under "Generating a routine".
 *
 *  - `climb`: General Body. One pyramid, and EVERY exercise climbs it:
 *    "Complete one exercise before moving to the next." Four or five moves.
 *  - `rounds`: Arms & Shoulders. Five or six counted moves, four or five
 *    rounds, "Rest 45 seconds after each round".
 *  - `ladder`: Legs. "Main Exercise:" then "After every set:", two or three
 *    accessories keeping their own count.
 *  - `coreRounds`: Core. Four counted moves and a timed hold to close each
 *    round, three to five rounds, then "After Round N:" loose steps.
 *  - `finisher`: a Legs ladder, then "Final Burnout": loose steps done once,
 *    ending on a wall sit where there is one.
 *
 * It used to be positional, a ladder every third section, which put the
 * ladders on General Body and Core. Since July she has written the Finisher as
 * a ladder every time and Core as rounds every time. The shape belongs to the
 * theme.
 */
/** The three themes the builder treats specially, spelled as the harvest spells them. */
const WARM_UP = 'Warm-up'
const GENERAL_BODY = 'General Body'
const FINISHER = 'Finisher'

type ThemeShape = 'warmUp' | 'climb' | 'rounds' | 'ladder' | 'coreRounds' | 'finisher'
const THEME_SHAPE: Readonly<Record<string, ThemeShape>> = {
  [WARM_UP]: 'warmUp',
  [GENERAL_BODY]: 'climb',
  'Arms & Shoulders': 'rounds',
  Legs: 'ladder',
  Core: 'coreRounds',
  Finisher: 'finisher',
}

/** Cardio moves in a warm-up, at `WARM_UP_EACH_MS`, before the stretches. */
const WARM_UP_CARDIO = 4
/** Stretches after them, which she writes as "Then finish with 30 sec each". */
const WARM_UP_MOBILITY = 4
const MOBILITY_EACH_MS = 30_000
/**
 * A hold nobody has ever put a time on. The corpus writes planks at 20, 30, 40,
 * 45 and 60 seconds; thirty is the median, and "12 × Plank" is not a thing.
 */
const HOLD_MS = 30_000
// "wall sit" whole, or `\bsit\b` turns Sit-ups into a thirty-second hold.
const HOLD_LIKE = /\b(plank|hold|wall sit)\b/i

/**
 * Said for this exercise, by folded name, which is how the harvest keys them.
 *
 * Memoised: the draws test every exercise in a pool against `isRung` and
 * `isHold`, and folding a name then scanning 192 prescriptions for each of 147
 * exercises on every draw made one routine cost a tenth of a second.
 */
const PRESCRIBED = new Map<string, Prescription | undefined>()
const prescribed = (exercise: Exercise): Prescription | undefined => {
  if (!PRESCRIBED.has(exercise.name)) {
    const key = foldName(exercise.name)
    PRESCRIBED.set(exercise.name, PRESCRIPTIONS.find((p) => p.name === key))
  }
  return PRESCRIBED.get(exercise.name)
}

/** It has carried one of her ladders, so it can carry one here. */
const isRung = (exercise: Exercise): boolean => prescribed(exercise)?.rung === true

/** Timed rather than counted: a plank, a wall sit, a hollow hold. */
const isHold = (exercise: Exercise): boolean => {
  const said = prescribed(exercise)
  if (said) return said.prescribe === 'time' && said.seconds !== undefined
  return HOLD_LIKE.test(exercise.name)
}

/**
 * Something she has opened a session with.
 *
 * The cardio pool also holds burpees, mountain climbers and plank jacks, none
 * of which has ever been a warm-up. Matched as a PHRASE inside a harvested
 * name, because those fold raggedly: "jog on the spot increase the tempo"
 * holds "jog on the spot", and "high knee lift" holds "high knee".
 */
const warmsUpWith = (exercise: Exercise): boolean => {
  const key = ` ${foldName(exercise.name)} `
  return key.trim() !== '' && WARM_UP_MOVES.some((move) => ` ${move} `.includes(key))
}

/** Between `low` and `high` inclusive, from the injected rng. */
const between = (low: number, high: number, rng: Rng) => low + Math.floor(rng() * (high - low + 1))

/**
 * The name a theme takes once the areas have been narrowed to what was asked.
 *
 * "General Body" of nothing but legs is not general, and a Finisher of core
 * work is not her Legs Finisher. So a narrowed theme is named for what is left
 * in it, in her own words where she has them: "Legs Finisher" is her heading,
 * and "Abs" is what she calls a core section that is not the Core one.
 */
function themeName(theme: string, areas: readonly BodyArea[], all: readonly string[]): string {
  if (areas.length === all.length) return theme
  const order: BodyArea[] = ['upper', 'torso', 'lower']
  const kept = order.filter((area) => areas.includes(area))
  if (theme === FINISHER) {
    return kept.length === 1 && kept[0] === 'lower' ? 'Legs Finisher' : 'Core Finisher'
  }
  if (theme === GENERAL_BODY) {
    const words: Record<BodyArea, string> = { upper: 'Upper Body', torso: 'Abs', lower: 'Lower Body' }
    return kept.map((area) => words[area]).join(' & ')
  }
  return theme
}

/**
 * A routine in the instructor's shape: named sections, ladders, counted steps.
 *
 * SELF-PACED, which is the whole difference. A rep-based step has no duration
 * and ends when you tap Next, so this routine has no length: `notes` says so
 * rather than the app pretending to a number. That is why the spec asks for
 * sections instead of minutes here.
 *
 * The skeleton, the ladders and the shape of each section are not invented.
 * `exercises.shapes.ts` is read out of the instructor's routines: warm-up
 * first, finisher last, the body between, and her own pyramids used verbatim
 * because `4-9-14-9-4` would be arithmetically fine and unlike anything she has
 * ever been given. `THEME_SHAPE` says which kind of section each theme is.
 */
function sectionsRoutine(
  spec: RoutineSpec,
  loads: (name: string) => string | undefined,
  rates: ReadonlyMap<string, number>,
  rng: Rng,
  notes: string[],
  /** The whole vocabulary: the shipped table plus the exercises you added. */
  table: readonly Exercise[],
): Block[] {
  // Nothing to work is the same answer the circuit gives, not a routine of one warm-up.
  if (spec.areas.length === 0) throw new Error('No exercises match that combination of areas and equipment.')

  /**
   * Everything eligible, by area, shuffled once so a section can draw freely.
   *
   * The EQUIPMENT choice does not apply to the warm-up. Nothing on the multi-gym
   * is a stretch or a jog, so a machine-only routine came out with no warm-up at
   * all: the section was built, found nothing, and was silently dropped. You warm
   * up on the floor or the bike whatever the session is made of.
   */
  const pool = (area: BodyArea, use: 'strength' | 'cardio' | 'mobility'): Exercise[] =>
    shuffled(
      table.filter(
        (e) =>
          e.area === area &&
          (e.use ?? 'strength') === use &&
          (use === 'strength' ? eligible(spec.equipment, e) : true),
      ),
      rng,
    )

  const taken = new Set<string>()
  /*
   * Drawn ACROSS the areas, one from each in turn, rather than area by area.
   * Walking the areas in order filled "four mobility, four cardio" from upper
   * and torso before lower was ever reached, so twenty-two exercises, every
   * lower-body stretch, jump and trampoline move, could not be generated.
   *
   * `keep` narrows the draw: to lifts that can carry a ladder, to holds, to
   * what she warms up with. A narrowed draw that comes up short is topped up by
   * the caller with an open one, so a preference never empties a section.
   */
  const take = (pools: Exercise[][], want: number): Exercise[] => {
    const out: Exercise[] = []
    for (let turn = 0; out.length < want && pools.some((p) => p.length > 0); turn++) {
      const exercise = pools[turn % pools.length]!.shift()
      if (!exercise || taken.has(exercise.name)) continue
      taken.add(exercise.name)
      out.push(exercise)
    }
    return out
  }
  const pools = (
    areas: readonly BodyArea[],
    use: 'strength' | 'cardio' | 'mobility',
    keep: (exercise: Exercise) => boolean,
  ) => areas.map((area) => pool(area, use).filter((e) => !taken.has(e.name) && keep(e)))
  const draw = (
    areas: readonly BodyArea[],
    use: 'strength' | 'cardio' | 'mobility',
    want: number,
    keep: (exercise: Exercise) => boolean = () => true,
  ) => take(pools(areas, use, keep), want)
  /**
   * The same, from ONE pool rather than a turn from each area.
   *
   * For the warm-up, where alternating areas is the wrong instinct: the only
   * upper-body cardio she has warmed up with is punches, so a turn for the upper
   * body opened every routine with Front Punches. Mixed, the punches come up
   * about as often as she writes them.
   */
  const drawMixed = (
    areas: readonly BodyArea[],
    use: 'strength' | 'cardio' | 'mobility',
    want: number,
    keep: (exercise: Exercise) => boolean = () => true,
  ) => take([shuffled(pools(areas, use, keep).flat(), rng)], want)
  /** `want` of them, the preferred kind first and anything eligible after. */
  const drawPreferring = (
    areas: readonly BodyArea[],
    want: number,
    prefer: (exercise: Exercise) => boolean,
  ): Exercise[] => {
    const first = draw(areas, 'strength', want, prefer)
    return [...first, ...draw(areas, 'strength', want - first.length, (e) => !isHold(e))]
  }

  /** A counted step, which is what most of an instructor routine is made of. */
  const counted = (exercise: Exercise): Segment => {
    const said = prescribed(exercise)
    const load = loads(exercise.name)
    const timed = isHold(exercise)
    return segment({
      name: exercise.name,
      role: 'work',
      ...(timed
        ? { durationMs: (said?.seconds ?? HOLD_MS / 1000) * 1000 }
        : { reps: { kind: 'fixed', count: said?.reps ?? DEFAULT_REPS, ...(exercise.perSide ? { perSide: true } : {}) } }),
      ...(load ? { load } : {}),
      ...(exercise.media ? { media: bundled(exercise.media) } : {}),
    })
  }
  /** The lift a ladder scales: its count is the rung's. */
  const rung = (exercise: Exercise): Segment =>
    segment({
      name: exercise.name,
      role: 'work',
      reps: { kind: 'rung', ...(exercise.perSide ? { perSide: true } : {}) },
      ...(exercise.media ? { media: bundled(exercise.media) } : {}),
      ...(loads(exercise.name) ? { load: loads(exercise.name)! } : {}),
    })
  const rest = () => segment({ name: 'Rest', role: 'rest', durationMs: ROUND_REST_MS })
  /** One of her pyramids, drawn by how often each shape appears, around whatever climbs it. */
  const ladder = (children: Block[]): Block => ({
    kind: 'ladder',
    id: newId(),
    counts: [...weightedPick(LADDER_COUNTS, (l) => l.seen, rng).counts],
    label: DEFAULT_LADDER_LABEL,
    children,
  })
  const ladderOf = (main: Exercise, accessories: readonly Exercise[]): Block =>
    ladder([rung(main), ...accessories.map(counted)])
  const roundsOf = (times: number, moves: readonly Exercise[]): Block => ({
    kind: 'repeat',
    id: newId(),
    times,
    // The app's word, so the editor and the run screen agree with what a
    // reload would show; "Round" was migrated to "Set" on the next read.
    label: DEFAULT_REPEAT_LABEL,
    children: [...moves.map(counted), rest()],
  })
  const section = (name: string, children: Block[], over: Partial<Section> = {}): Section => ({
    kind: 'section',
    id: newId(),
    name,
    display: 'list',
    children,
    ...over,
  })

  /*
   * Every theme narrowed to what was asked for, and a theme left with nothing
   * dropped entirely.
   *
   * The themes carry their own areas, and taking them as written ignored the
   * question: asking for Core alone still built an Arms & Shoulders section and
   * a Legs one. The circuit shape had always intersected; this one had not.
   *
   * The WARM-UP is exempt for the same reason it ignores the equipment: you warm
   * the whole of yourself up whatever the session then works.
   */
  const themes = SECTION_THEMES.map((entry) => ({
    ...entry,
    /** Every area the theme covers, for naming a section that works only some of them. */
    all: entry.areas,
    areas: (entry.theme === WARM_UP
      ? entry.areas
      : entry.areas.filter((area) => spec.areas.includes(area as BodyArea))) as BodyArea[],
  })).filter((entry) => entry.areas.length > 0)

  /** One section in its theme's shape, or null where the pool could not fill it. */
  const build = ({ theme, areas, all }: { theme: string; areas: BodyArea[]; all: readonly string[] }): Section | null => {
    const name = themeName(theme, areas, all)
    const shape = THEME_SHAPE[theme] ?? 'rounds'
    const short = () => {
      notes.push(`Not enough left for a ${name} section with the equipment chosen.`)
      return null
    }

    if (shape === 'warmUp') {
      /*
       * Every area, whatever the theme lists: a torso stretch warms you up too,
       * and the two torso mobility moves could never be drawn otherwise.
       *
       * Cardio FIRST, at forty seconds, then the stretches at thirty, which is
       * the order and the timing of every warm-up she has written since July:
       * "40 sec each (continuous movement)" then "Then finish with 30 sec each".
       * The cardio is drawn from what she has actually opened a session with.
       */
      const everywhere: BodyArea[] = ['upper', 'torso', 'lower']
      const cardio = drawMixed(everywhere, 'cardio', WARM_UP_CARDIO, warmsUpWith)
      const mobility = drawMixed(everywhere, 'mobility', WARM_UP_MOBILITY)
      if (cardio.length + mobility.length === 0) return null
      return section(
        name,
        [
          ...cardio.map((e) => segment({ name: e.name, role: 'work', durationMs: WARM_UP_EACH_MS })),
          ...mobility.map((e) => segment({ name: e.name, role: 'work', durationMs: MOBILITY_EACH_MS })),
        ],
        { display: 'timer', note: `${WARM_UP_EACH_MS / 1000} seconds each, continuous movement` },
      )
    }

    if (shape === 'climb') {
      // Lifts that have carried her ladders first, then whatever fills it. A hold
      // cannot climb a rep ladder, so none is drawn here.
      const moves = drawPreferring(areas, between(4, 5, rng), isRung)
      if (moves.length < 2) return short()
      return section(name, [
        ladder(moves.map(rung)),
      ])
    }

    if (shape === 'ladder' || shape === 'finisher') {
      const [main] = drawPreferring(areas, 1, isRung)
      const accessories = draw(areas, 'strength', between(2, 3, rng))
      if (!main || accessories.length === 0) return short()
      const children: Block[] = [ladderOf(main, accessories)]
      if (shape === 'finisher') {
        /*
         * "Final Burnout (No Rest)": done once, straight through, and closed on
         * a wall sit where the pool still has one. Loose in the section after
         * the ladder, which the text writer separates with `Then:` so it
         * pastes back as written.
         */
        const burnout = draw(areas, 'strength', 3, (e) => !isHold(e))
        const hold = draw(areas, 'strength', 1, isHold)
        children.push(...burnout.map(counted), ...hold.map(counted))
      }
      return section(name, children)
    }

    if (shape === 'coreRounds') {
      // Four counted, then ONE hold to close the round, which is her Core every time since July.
      const moves = draw(areas, 'strength', 4, (e) => !isHold(e))
      const hold = draw(areas, 'strength', 1, isHold)
      if (moves.length < 2) return short()
      const children: Block[] = [roundsOf(between(3, 5, rng), [...moves, ...hold])]
      // "After Round N:" a couple more, and a hold to finish where one is left.
      const tail = [...draw(areas, 'strength', 2, (e) => !isHold(e)), ...draw(areas, 'strength', 1, isHold)]
      children.push(...tail.map(counted))
      return section(name, children)
    }

    // `rounds`: Arms & Shoulders, and any theme this table has not met.
    const moves = draw(areas, 'strength', between(5, 6, rng), (e) => !isHold(e))
    if (moves.length < 2) return short()
    return section(name, [roundsOf(between(4, 5, rng), moves)])
  }

  /*
   * The bookends first, then the body between them.
   *
   * A warm-up opens every routine of her and a finisher closes fourteen of
   * sixteen, whatever else is in it, so those two are built before the count is
   * decided rather than falling off the end of it when the count is small.
   * Building the finisher before the body only changes which exercises it
   * draws, not where it goes.
   */
  const bookend = (theme: string) => {
    const entry = themes.find((t) => t.theme === theme)
    return entry ? build(entry) : null
  }
  const warmUp = bookend(WARM_UP)
  const finisher = bookend(FINISHER)
  const body = themes.filter((t) => t.theme !== WARM_UP && t.theme !== FINISHER)
  const ends = (warmUp ? 1 : 0) + (finisher ? 1 : 0)

  /** Roughly how long a section takes, timed steps plus a rate on the counted ones. */
  const cost = (block: Block) => {
    const guess = estimate([block], rates)
    return guess.knownMs + guess.estimatedMs
  }

  const middle: Block[] = []
  if (hasSectionCount(spec)) {
    // Asked for a count outright: that many, the bookends included.
    const wanted = clampSections(spec.sections)
    for (const entry of body.slice(0, Math.max(0, wanted - ends))) {
      const built = build(entry)
      if (built) middle.push(built)
    }
    if (middle.length + ends < wanted) {
      notes.push(
        `Only ${middle.length + ends} sections suit what you asked to work; the rest would have had nothing in them.`,
      )
    }
  } else {
    /*
     * Fitted to the minutes asked, the way the circuit is fitted: whole sections
     * until the next would overshoot by more than half of itself. The length is
     * an ESTIMATE, since counted steps end when you tap Next, but it is the same
     * estimate the library row and the Ready card show, so what the dialog
     * promises is what those will say.
     *
     * Her own routines run long by this measure: the template ones since July
     * come to 56 to 91 minutes. A 45-minute routine is therefore four sections
     * or so rather than her six, and the ones that did not fit are named.
     *
     * WHICH themes get the room rotates with the seed. Taking them in her order
     * made Core the casualty of every short routine; dropping the largest would
     * have made it Legs, her signature ladder, every time. Her four body themes
     * appear about equally often across the sixteen, and her shorter routines
     * differ in which one is missing, so the priority is shuffled, with General
     * Body protected: it opens thirteen of sixteen, and a routine of Warm-up,
     * Core, Finisher is not one she has sent. The sections are then ASSEMBLED in
     * her order whatever the priority was, so the routine still reads like hers.
     */
    const budget = spec.totalMs - (warmUp ? cost(warmUp) : 0) - (finisher ? cost(finisher) : 0)
    const priority = [
      ...body.filter((t) => t.theme === GENERAL_BODY),
      ...shuffled(body.filter((t) => t.theme !== GENERAL_BODY), rng),
    ]
    let spent = 0
    const left: string[] = []
    const fitted = new Map<string, Section>()
    for (const entry of priority) {
      if (left.length > 0) {
        left.push(entry.theme)
        continue
      }
      const built = build(entry)
      if (!built) continue
      const price = cost(built)
      // Half a section past the target is further from it than stopping here.
      if (fitted.size > 0 && spent + price > budget + price / 2) {
        left.push(entry.theme)
        continue
      }
      fitted.set(entry.theme, built)
      spent += price
    }
    for (const entry of body) {
      const built = fitted.get(entry.theme)
      if (built) middle.push(built)
    }
    left.sort((a, b) => body.findIndex((t) => t.theme === a) - body.findIndex((t) => t.theme === b))
    if (left.length > 0) {
      notes.push(`No room for ${left.join(', ')} in ${Math.round(spec.totalMs / 60_000)} minutes.`)
    }
  }

  const blocks: Block[] = [...(warmUp ? [warmUp] : []), ...middle, ...(finisher ? [finisher] : [])]
  const came = blocks.reduce((sum, block) => sum + cost(block), 0)
  const off = Math.round((came - spec.totalMs) / 60_000)
  // The same test as the builder's: a count of NaN took the fitted path above
  // and then suppressed this note, as if a count had been honoured.
  if (!hasSectionCount(spec) && Math.abs(off) >= 5) {
    notes.push(
      `It should come out about ${Math.abs(off)} minutes ${off > 0 ? 'longer' : 'shorter'} than asked: sections come whole.`,
    )
  }

  notes.push(
    'A rep-based routine has no length: its steps end when you tap Next, so the app cannot say how long it will take.',
  )
  return blocks
}

/**
 * What to call a routine nobody has named.
 *
 * Built from the answers, because "Generated - 2026-08-27" tells you nothing in
 * a library of them and a second one the same day tells you less. What a person
 * scans a list for is what it works and how big it is, so that is what the name
 * says: "Full-Body Circuit, 45 min", "Bodyweight Legs & Core, 6 sections".
 *
 * The equipment is named only when it is worth naming. Every routine here is on
 * the multi-gym unless it says otherwise, so saying so on most of them would
 * push the useful half off the end of a narrow row.
 *
 * Exported so the dialog can show it as the placeholder: what you would get is
 * better than a description of what you would get.
 */
export function describeRoutine(
  spec: RoutineSpec,
  /**
   * The section count actually BUILT, where the caller knows it. Without it the
   * name says what was asked, clamped to what can be asked for, and a routine
   * of two sections was called "3 sections" because three is the fewest.
   */
  built?: number,
): string {
  const AREA_NAMES: Record<BodyArea, string> = {
    upper: 'Upper Body',
    torso: 'Core',
    lower: 'Lower Body',
  }
  const order: BodyArea[] = ['upper', 'torso', 'lower']
  const areas = order.filter((area) => spec.areas.includes(area))

  const worked =
    areas.length === 0
      ? 'Routine'
      : areas.length === order.length
        ? 'Full-Body'
        : areas.map((area) => AREA_NAMES[area]).join(' & ')

  const kit =
    spec.equipment === 'none' ? 'Bodyweight ' : spec.equipment === 'mixed' ? 'Mixed ' : ''

  if (spec.style === 'sections') {
    const count = built ?? clampSections(sectionsAsked(spec))
    return `${kit}${worked}, ${count} sections`
  }
  const minutes = Math.round(spec.totalMs / 60_000)
  return `${kit}${worked} Circuit, ${minutes} min`
}

export function generateRoutine(
  spec: RoutineSpec,
  options: {
    library?: readonly Workout[]
    rng?: Rng
    now?: number
    /**
     * The weights kept in Settings, which the routine does NOT write down.
     *
     * A weight this table can supply is left off the step on purpose: an empty
     * load reads from Settings every time the routine is opened, so changing
     * the number there changes every routine at once. Stamping it in would
     * freeze it at what you lifted the day it was generated, which is the thing
     * the settings page exists to stop.
     *
     * Empty by default, so a test sees the old behaviour and `generateRoutine`
     * still reads nothing from storage.
     */
    weights?: ReadonlyMap<string, string>
    /**
     * Seconds-per-rep rates measured on this phone, for fitting the sections
     * shape to a length. Empty by default, which falls back to the harvested
     * rates, so a test gets the same answer whatever the browser has stored.
     */
    rates?: ReadonlyMap<string, number>
    /**
     * The exercises you added yourself, from `storage/customExercises.ts`.
     *
     * Drawn from exactly as the shipped ones are: they carry an area, a
     * push-or-pull and a `use` for that reason, so a routine generated for the
     * lower body can put your own squat variation in a working set. Empty by
     * default, so a test sees the shipped table alone and this function still
     * reads nothing from storage.
     */
    extra?: readonly Exercise[]
  } = {},
): GeneratedRoutine {
  const rng = options.rng ?? Math.random
  /*
   * Shipped first, so a name in both halves resolves to the app's own record.
   * The same order, and the same reason, as `withCustom`.
   */
  const table: readonly Exercise[] =
    options.extra && options.extra.length > 0 ? [...EXERCISES, ...options.extra] : EXERCISES
  const now = options.now ?? 0
  const notes: string[] = []
  const weights = options.weights ?? new Map<string, string>()
  const observed = loadFrom(options.library ?? [])
  /*
   * Settings first, and where it answers, nothing is written down at all. Only
   * a weight Settings has never heard of is stamped from what your last routine
   * said, which is where it used to come from.
   */
  const loads = (name: string): string | undefined =>
    weights.has(exerciseKey(name)) ? undefined : observed.get(name.toLowerCase())

  /*
   * Two shapes, and they share almost nothing: the circuit solves for a length
   * and the sections count sections. Dispatched here rather than threaded
   * through, because a function that did both would be mostly `if (style)`.
   */
  if (spec.style === 'sections') {
    const sections = sectionsRoutine(spec, loads, options.rates ?? new Map(), rng, notes, table)
    if (sections.length === 0) {
      throw new Error('No exercises match that combination of areas and equipment.')
    }
    /*
     * The same five seconds a pasted routine gets, loose and above the first
     * section: the app giving you a moment before the warm-up, not part of it.
     * The length and name match `parseRoutine` exactly, so Send as text leaves
     * it out and Paste puts it back, the way it does for a pasted routine.
     */
    const blocks: Block[] = [
      segment({ name: 'Get ready', role: 'prepare', durationMs: GET_READY_MS }),
      ...sections,
    ]
    return {
      workout: {
        id: newId(),
        /*
         * Named for what was BUILT, not what was asked. Asking for six sections
         * of core work builds four, and "Core, 6 sections" over a routine of
         * four was a name that lied while a note told the truth underneath.
         */
        name: spec.name?.trim() || describeRoutine(spec, sections.length),
        blocks,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        estimatedTotalMs: blocksDurationMs(blocks),
      },
      notes,
    }
  }

  const cardio = table.filter((e) => e.use === 'cardio')
  const recovery =
    cardio.find((e) => e.name === spec.recoveryExercise) ??
    cardio.find((e) => e.name === 'Cycling') ??
    cardio[0]

  /*
   * Shuffled once and then walked in order, rather than picked afresh each time:
   * an independent draw per slot repeats itself, and a minute of burpees twice
   * running is the one thing nobody wants from "surprise me".
   */
  const asked = spec.recoveryPool ?? []
  const chosen = cardio.filter((e) => asked.includes(e.name))
  if (asked.length > 0 && chosen.length === 0) {
    notes.push(`Nothing in the list to move with is a cardio exercise, so ${recovery?.name} was used.`)
  }
  const spin = chosen.length > 0 ? shuffled(chosen, rng) : []

  /*
   * The bookends, each chosen in its own right.
   *
   * NAMED for the exercise as well as the purpose: "Warm Up" alone was enough
   * while it was always the bike and always carried its picture, and stopped
   * being enough the moment it could be the trampoline, which has no
   * illustration at all. "Warm Up: Trampoline" says what to do without one.
   */
  /** A length from the spec, or the default. Never zero: that is not a slot. */
  const span = (want: number | undefined, fallbackMs: number) =>
    want !== undefined && Number.isFinite(want) && want > 0 ? Math.round(want) : fallbackMs
  const warmUpMs = span(spec.warmUpMs, WARM_UP_MS)
  const recoverMs = span(spec.recoveryMs, RECOVER_MS)
  const coolDownMs = span(spec.coolDownMs, COOL_DOWN_MS)

  // Never silent: the recovery exercise said when it fell back, these did not.
  const named = (want: string | undefined, slot: string) => {
    const found = cardio.find((e) => e.name === want)
    if (want && !found) notes.push(`No cardio exercise called "${want}" for the ${slot}, so ${recovery?.name} was used.`)
    return found ?? recovery
  }
  const warmUp = named(spec.warmUpExercise, 'warm-up')
  const coolDown = named(spec.coolDownExercise, 'cool-down')
  let spun = 0
  const nextSpin = (): Exercise => {
    const pick = spin[spun % spin.length] ?? recovery!
    spun += 1
    return pick
  }
  if (spec.recovery === 'active' && spec.recoveryExercise && recovery?.name !== spec.recoveryExercise) {
    notes.push(`No cardio exercise called "${spec.recoveryExercise}", so ${recovery?.name} was used.`)
  }

  const pools = new Map<BodyArea, Exercise[]>()
  for (const area of spec.areas) {
    const pool = table.filter(
      (e) => (e.use ?? 'strength') === 'strength' && e.area === area && eligible(spec.equipment, e),
    )
    pools.set(area, shuffled(pool, rng))
    if (pool.length === 0) {
      notes.push(`Nothing works the ${area} body with the equipment chosen, so it was left out.`)
      pools.delete(area)
    }
  }
  if (pools.size === 0) {
    throw new Error('No exercises match that combination of areas and equipment.')
  }

  const opening: Block[] =
    spec.recovery === 'active'
      ? [
          segment({ name: 'Get ready', role: 'prepare', durationMs: PREPARE_MS }),
          segment({
            name: warmUp ? `Warm Up: ${warmUp.name}` : 'Warm Up',
            role: 'work',
            durationMs: warmUpMs,
            ...(warmUp?.media ? { media: bundled(warmUp.media) } : {}),
          }),
        ]
      : []
  const closing: Block[] =
    spec.recovery === 'active'
      ? [
          segment({ name: 'Get ready', role: 'prepare', durationMs: PREPARE_MS }),
          segment({
            name: coolDown ? `Cool Down: ${coolDown.name}` : 'Cool Down',
            role: 'work',
            durationMs: coolDownMs,
            ...(coolDown?.media ? { media: bundled(coolDown.media) } : {}),
          }),
        ]
      : []

  const budget = spec.totalMs - blocksDurationMs(opening) - blocksDurationMs(closing)
  const perExercise =
    (spec.recovery === 'active' ? ANNOUNCE_MS + recoverMs + PREPARE_MS : PREPARE_MS + recoverMs) +
    (spec.sets ?? DEFAULT_SETS) * (WORK_MS + REST_MS) -
    REST_MS
  const rough = Math.max(1, Math.round(budget / Math.max(1, perExercise)))
  const want = share([...pools.keys()], pools, rough)

  const body: Block[] = []
  const used = new Map<BodyArea, number>()
  const taken = new Set<string>()
  let previous: BodyArea | null = null
  let lastPattern: Pattern | null = null
  let spent = 0
  let exhausted = false

  while (!exhausted) {
    const area = nextArea(want, used, previous)
    if (area === null) break

    const pool = pools.get(area)!
    /*
     * Within the upper body, alternate push and pull as well: routine 2 never
     * runs two presses together. A pull after a push is preferred, not required,
     * so running out of one does not end the routine.
     */
    const fresh = pool.filter((e) => !taken.has(e.name))
    const preferred = fresh.filter((e) => !e.pattern || e.pattern !== lastPattern)
    const candidates = preferred.length > 0 ? preferred : fresh
    if (candidates.length === 0) {
      // This area has nothing left. Stop offering it rather than repeating.
      want.delete(area)
      if (want.size === 0) break
      continue
    }

    const previousStation = [...body]
      .reverse()
      .flatMap((b) => (b.kind === 'repeat' ? b.children : []))
      .find((b): b is Segment => b.kind === 'segment' && b.role === 'work')
    const station = table.find((e) => e.name === previousStation?.name)?.station
    // Among equally good candidates, one already rigged on this station.
    const pick =
      candidates.find((e) => station !== undefined && e.station === station) ?? candidates[0]!

    const announce = body.length > 0 || spec.recovery !== 'active'
    // Drawn only where a slot is actually going to be built, or the sequence
    // advances on exercises that never make it past the budget check.
    const spinner = spin.length > 0 && announce && spec.recovery === 'active' ? nextSpin() : recovery
    const blocks = exerciseBlocks(
      pick,
      spec,
      loads(pick.name),
      spinner?.name ?? 'Cycling',
      spinner?.media,
      announce,
      recoverMs,
    )
    const cost = blocksDurationMs(blocks)

    // Half an exercise past the target is further from it than stopping here.
    if (spent > 0 && spent + cost > budget + cost / 2) break

    body.push(...blocks)
    spent += cost
    taken.add(pick.name)
    used.set(area, (used.get(area) ?? 0) + 1)
    previous = area
    if (pick.pattern) lastPattern = pick.pattern
    exhausted = taken.size >= [...pools.values()].flat().length
  }

  for (const area of spec.areas) {
    if ((used.get(area) ?? 0) === 0 && pools.has(area)) {
      notes.push(`No room for the ${area} body in ${Math.round(spec.totalMs / 60_000)} minutes.`)
    }
  }
  if (exhausted) {
    notes.push(
      'Every exercise matching that choice was used, so the routine is shorter than asked for.',
    )
  }

  const blocks = [...opening, ...body, ...closing]
  const workout: Workout = {
    id: newId(),
    name: spec.name?.trim() || describeRoutine(spec),
    blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    estimatedTotalMs: blocksDurationMs(blocks),
  }

  const off = Math.round((blocksDurationMs(blocks) - spec.totalMs) / 60_000)
  if (Math.abs(off) >= 2) {
    notes.push(
      `It came out ${Math.abs(off)} minutes ${off > 0 ? 'longer' : 'shorter'} than asked: exercises come in whole numbers.`,
    )
  }
  return { workout, notes }
}
