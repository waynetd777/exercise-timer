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
import { newId } from '../id'
import type { BodyArea, Exercise, Pattern } from './exercises'
import { EXERCISES, needsRigging, PREPARE_MS, RIG_PREPARE_MS } from './exercises'
import { PRESCRIPTIONS } from './exercises.prescription'
import { foldName } from './foldName'

export type Recovery = 'passive' | 'active'

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
}

export type GeneratedRoutine = {
  workout: Workout
  /** Everything it did that the spec did not ask for. Never silent. */
  notes: string[]
}

export type Rng = () => number

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

function totalMs(blocks: readonly Block[]): number {
  let total = 0
  for (const block of blocks) {
    if (block.kind === 'segment') {
      total += block.durationMs ?? 0
    } else if (block.kind === 'repeat') {
      total += block.times * totalMs(block.children)
      const last = block.children.at(-1)
      // A trailing rest does not run after the final set. See `compile()`.
      if (last?.kind === 'segment' && last.role === 'rest') total -= last.durationMs ?? 0
    } else {
      total += totalMs(block.children)
    }
  }
  return total
}

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

export function generateRoutine(
  spec: RoutineSpec,
  options: { library?: readonly Workout[]; rng?: Rng; now?: number } = {},
): GeneratedRoutine {
  const rng = options.rng ?? Math.random
  const now = options.now ?? 0
  const notes: string[] = []
  const loads = loadFrom(options.library ?? [])

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

  const named = (want: string | undefined) => cardio.find((e) => e.name === want) ?? recovery
  const warmUp = named(spec.warmUpExercise)
  const coolDown = named(spec.coolDownExercise)
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

  const budget = spec.totalMs - totalMs(opening) - totalMs(closing)
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
      loads.get(pick.name.toLowerCase()),
      spinner?.name ?? 'Cycling',
      spinner?.media,
      announce,
      recoverMs,
    )
    const cost = totalMs(blocks)

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
    name: spec.name?.trim() || 'Generated routine',
    blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    estimatedTotalMs: totalMs(blocks),
  }

  const off = Math.round((totalMs(blocks) - spec.totalMs) / 60_000)
  if (Math.abs(off) >= 2) {
    notes.push(
      `It came out ${Math.abs(off)} minutes ${off > 0 ? 'longer' : 'shorter'} than asked: exercises come in whole numbers.`,
    )
  }
  return { workout, notes }
}
