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
 * The length is not estimated and then hoped for. Exercises are added one at a
 * time and each one's real cost is known, so a per-side exercise costing two
 * blocks and an ankle-strap one costing five more seconds are both accounted for
 * exactly rather than averaged.
 */

import type { Block, Repeat, Segment, Workout } from '../engine/types'
import { SCHEMA_VERSION } from '../engine/types'
import { blocksDurationMs } from '../engine'
import { newId } from '../id'
import type { BodyArea, Exercise, Pattern } from './exercises'
import { EXERCISES, needsRigging, PREPARE_MS, RIG_PREPARE_MS } from './exercises'
import { PRESCRIPTIONS } from './exercises.prescription'
import {
  LADDER_COUNTS,
  SECTION_SIZE,
  SECTION_THEMES,
  SECTIONS_MAX,
  SECTIONS_TYPICAL,
} from './exercises.shapes'
import { foldName } from './foldName'
import { exerciseKey } from './loads'
import { GET_READY_MS } from './pasteFormat'

export type Recovery = 'passive' | 'active'

/**
 * Which kind of routine to build.
 *
 * `circuit` is the shape Wayne's own mixed-cardio routines take: one exercise at
 * a time, everything on a clock, so the length is knowable and solvable.
 *
 * `sections` is the shape his instructor sends: six named sections, two or three
 * of them ladders, and most steps COUNTED rather than timed. Its length is not
 * knowable, because a self-paced step ends when you tap Next, so the question
 * that shape asks is how many sections rather than how many minutes. Wayne's
 * decision.
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
   * Sections, for `sections`. Defaults to what the routines typically hold.
   *
   * This is what replaces `totalMs` for that style: a routine of self-paced
   * steps has no length to aim at, so the size of it is counted in sections.
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
 * which is a reasonable thing to want and not a claim about what he sends.
 */
export const SECTIONS_FEWEST = 3

/** The section count asked for, or the usual one where the spec has none or nonsense (NaN). */
function sectionsAsked(spec: RoutineSpec): number {
  return spec.sections !== undefined && Number.isFinite(spec.sections) ? spec.sections : SECTIONS_TYPICAL
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

  // Folded, because that is how the harvest keys them: one name for every
  // spelling the instructor uses.
  const said = PRESCRIPTIONS.find((p) => p.name === foldName(exercise.name))
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
 * has written is a candidate, in proportion to how often he wrote it: a fixed
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
  label: 'Set',
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
    ...(exercise.media ? { media: { source: 'bundled', path: exercise.media } } : {}),
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
          ...(recoveryMedia ? { media: { source: 'bundled', path: recoveryMedia } } : {}),
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
 * A routine in the instructor's shape: named sections, ladders, counted steps.
 *
 * SELF-PACED, which is the whole difference. A rep-based step has no duration
 * and ends when you tap Next, so this routine has no length: `notes` says so
 * rather than the app pretending to a number. That is why the spec asks for
 * sections instead of minutes here.
 *
 * The skeleton and the ladders are not invented. `exercises.shapes.ts` is read
 * out of the instructor's routines: warm-up first, finisher last, the body between,
 * and his own pyramids used verbatim because `4-9-14-9-4` would be
 * arithmetically fine and unlike anything he has ever been given.
 */
function sectionsRoutine(
  spec: RoutineSpec,
  loads: (name: string) => string | undefined,
  rng: Rng,
  notes: string[],
): Block[] {
  // Nothing to work is the same answer the circuit gives, not a routine of one warm-up.
  if (spec.areas.length === 0) throw new Error('No exercises match that combination of areas and equipment.')
  const wanted = Math.min(SECTIONS_MAX, Math.max(SECTIONS_FEWEST, Math.round(sectionsAsked(spec))))

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
      EXERCISES.filter(
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
   */
  const draw = (areas: readonly string[], use: 'strength' | 'cardio' | 'mobility', want: number) => {
    const pools = areas.map((area) => pool(area as BodyArea, use).filter((e) => !taken.has(e.name)))
    const out: Exercise[] = []
    for (let turn = 0; out.length < want && pools.some((p) => p.length > 0); turn++) {
      const exercise = pools[turn % pools.length]!.shift()
      if (!exercise || taken.has(exercise.name)) continue
      taken.add(exercise.name)
      out.push(exercise)
    }
    return out
  }

  /** A counted step, which is what most of an instructor routine is made of. */
  const counted = (exercise: Exercise): Segment => {
    const said = PRESCRIPTIONS.find((p) => p.name === foldName(exercise.name))
    const load = loads(exercise.name)
    const timed = said?.prescribe === 'time' && said.seconds !== undefined
    return segment({
      name: exercise.name,
      role: 'work',
      ...(timed
        ? { durationMs: said!.seconds! * 1000 }
        : { reps: { kind: 'fixed', count: said?.reps ?? DEFAULT_REPS, ...(exercise.perSide ? { perSide: true } : {}) } }),
      ...(load ? { load } : {}),
      ...(exercise.media ? { media: { source: 'bundled', path: exercise.media } } : {}),
    })
  }

  const blocks: Block[] = []

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
    areas:
      entry.theme === 'Warm-up'
        ? entry.areas
        : entry.areas.filter((area) => spec.areas.includes(area as BodyArea)),
  }))
    .filter((entry) => entry.areas.length > 0)
    .slice(0, wanted)

  if (themes.length < wanted) {
    notes.push(
      `Only ${themes.length} sections suit what you asked to work; the rest would have had nothing in them.`,
    )
  }

  for (const { theme, areas } of themes) {
    if (theme === 'Warm-up') {
      // Every area, whatever the theme lists: a torso stretch warms you up too,
      // and the two torso mobility moves could never be drawn otherwise.
      const everywhere: BodyArea[] = ['upper', 'torso', 'lower']
      const moves = [...draw(everywhere, 'mobility', 4), ...draw(everywhere, 'cardio', 4)]
      if (moves.length === 0) continue
      blocks.push({
        kind: 'section',
        id: newId(),
        name: theme,
        display: 'timer',
        note: `${WARM_UP_EACH_MS / 1000} seconds each, continuous movement`,
        children: moves.map((exercise) =>
          segment({ name: exercise.name, role: 'work', durationMs: WARM_UP_EACH_MS }),
        ),
      })
      continue
    }

    const chosen = draw(areas, 'strength', SECTION_SIZE)
    if (chosen.length < 2) {
      notes.push(`Not enough left for a ${theme} section with the equipment chosen.`)
      continue
    }

    /*
     * A ladder needs a lift that can carry the rungs and accessories that keep
     * their own count, which is the shape the instructor's ladders take: "Main
     * exercise:" then "After every set:". Every third section, so a routine has
     * two or three of them rather than six.
     */
    const asLadder = blocks.length % 3 === 1
    if (asLadder) {
      const shape = weightedPick(LADDER_COUNTS, (l) => l.seen, rng)
      const [main, ...rest] = chosen
      blocks.push({
        kind: 'section',
        id: newId(),
        name: theme,
        display: 'list',
        children: [
          {
            kind: 'ladder',
            id: newId(),
            counts: [...shape.counts],
            label: 'Rung',
            children: [
              segment({
                name: main!.name,
                role: 'work',
                reps: { kind: 'rung', ...(main!.perSide ? { perSide: true } : {}) },
                ...(main!.media ? { media: { source: 'bundled', path: main!.media } } : {}),
                ...(loads(main!.name) ? { load: loads(main!.name)! } : {}),
              }),
              ...rest.map(counted),
            ],
          },
        ],
      })
      continue
    }

    const rounds = 3 + Math.floor(rng() * 2)
    blocks.push({
      kind: 'section',
      id: newId(),
      name: theme,
      display: 'list',
      children: [
        {
          kind: 'repeat',
          id: newId(),
          times: rounds,
          // The app's word, so the editor and the run screen agree with what a
          // reload would show; "Round" was migrated to "Set" on the next read.
          label: 'Set',
          children: [
            ...chosen.map(counted),
            segment({ name: 'Rest', role: 'rest', durationMs: ROUND_REST_MS }),
          ],
        },
      ],
    })
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
export function describeRoutine(spec: RoutineSpec): string {
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
    const count = Math.min(SECTIONS_MAX, Math.max(SECTIONS_FEWEST, sectionsAsked(spec)))
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
  } = {},
): GeneratedRoutine {
  const rng = options.rng ?? Math.random
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
    const sections = sectionsRoutine(spec, loads, rng, notes)
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
        name: spec.name?.trim() || describeRoutine(spec),
        blocks,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        estimatedTotalMs: blocksDurationMs(blocks),
      },
      notes,
    }
  }

  const cardio = EXERCISES.filter((e) => e.use === 'cardio')
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
    const pool = EXERCISES.filter(
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
            ...(warmUp?.media ? { media: { source: 'bundled', path: warmUp.media } } : {}),
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
            ...(coolDown?.media ? { media: { source: 'bundled', path: coolDown.media } } : {}),
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
    const station = EXERCISES.find((e) => e.name === previousStation?.name)?.station
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
