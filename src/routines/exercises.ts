/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * What the routine generator is allowed to choose from.
 *
 * ONE table, not one per equipment type. The equipment is a FIELD, so asking for
 * a multi-gym routine filters rather than partitions, and a shortfall can widen
 * the filter instead of shortening the routine. The machine has only five torso
 * exercises, which is exactly the case that needs the fallback.
 *
 * Two halves, kept in separate files because they are trustworthy in different
 * ways:
 *
 *  - `exercises.machine.ts` is GENERATED from the Horizon Torus guide by
 *    `scripts/exercise_metadata.py`. Every field but `pattern` is read out of the
 *    manual, so it is fact rather than recollection, and a revised guide
 *    regenerates it.
 *  - the authored list below is everything the machine cannot do: bodyweight,
 *    dumbbell, kettlebell and band work. It has no illustrations, because the
 *    guide is the only source of those and it only draws the machine. A picture
 *    can be added to a step by hand afterwards.
 *
 * NOTHING here is advice. It is a vocabulary of movements, drawn from the
 * routines this app has been given, so a generated routine reads like the ones
 * Wayne is already sent rather than like something invented.
 */

import { MACHINE_EXERCISES } from './exercises.machine'
import { HARVESTED_EXERCISES } from './exercises.harvested'
import { OTHER_EXERCISES } from './exercises.other'

/** The guide's own three-way key, printed as the colour of each title band. */
export type BodyArea = 'upper' | 'torso' | 'lower'

/**
 * Push or pull, for upper-body work only.
 *
 * Not in the guide, and the one field derived rather than read. It exists
 * because "upper body" is too coarse for the alternation the generator copies
 * from Wayne's own routines, which runs legs, core, push, legs, push, legs,
 * pull, core, pull, legs.
 */
export type Pattern = 'push' | 'pull'

export type Equipment =
  | 'machine'
  | 'bodyweight'
  | 'dumbbell'
  | 'kettlebell'
  | 'band'
  | 'trampoline'
  | 'bike'

/**
 * What an exercise is FOR, which is not the same as what it works.
 *
 * The corpus makes the distinction unavoidable: a routine opens with ten minutes
 * of `mobility` and `cardio`, works through `strength`, and in Wayne's own
 * routines puts a minute of `cardio` between every set. One list with a `use`
 * field gives the generator all three pools without three tables.
 *
 * Absent means `strength`, which is what every machine exercise is.
 */
type Use = 'strength' | 'cardio' | 'mobility'

/** The five the guide lists. `ankle` is the one that costs setup time. */
type Attachment = 'lat bar' | 'low row bar' | 'ab strap' | 'free-motion' | 'ankle'

export type Exercise = {
  name: string
  area: BodyArea
  /** Upper body only. */
  pattern?: Pattern
  equipment: Equipment
  /** Absent means `strength`. */
  use?: Use
  /** A path under `public/`, for the exercises the guide illustrates. */
  media?: string
  /** Horizon station 1 to 8. Consecutive exercises on one station save re-rigging. */
  station?: number
  attachment?: Attachment
  /**
   * Worked one side at a time, so the generator gives it two sets a side and a
   * Change Sides step between them. Read from the guide, which says "complete
   * repetitions and repeat on opposite side".
   */
  perSide?: boolean
}

export const EXERCISES: readonly Exercise[] = [
  ...MACHINE_EXERCISES,
  ...OTHER_EXERCISES,
  ...HARVESTED_EXERCISES,
]

export { MACHINE_EXERCISES, OTHER_EXERCISES, HARVESTED_EXERCISES }

/**
 * The kit you choose a weight for.
 *
 * A press-up is loaded to your own bodyweight and a trampoline to nothing, so
 * neither has a number to keep. Everything else does: a stack has a pin, a
 * dumbbell has a number on the end and a band has a colour, which is why the
 * field is free text rather than kilos.
 */
const LOADABLE: readonly Equipment[] = ['machine', 'dumbbell', 'kettlebell', 'band']

/** True where it makes sense to write down what you lift for it. */
export function loadable(exercise: Exercise): boolean {
  return LOADABLE.includes(exercise.equipment)
}

/**
 * EVERY kit, in the order the app lists it: the multi-gym first, since that is
 * most of a session and all but one of the illustrations, then the two that
 * stand in the room and need no rigging, then everything you pick up.
 *
 * ONE ordering, used by the exercises page and by the editor's name field, so
 * the two cannot disagree about what the groups are called or which comes first.
 */
export const KIT_GROUPS: readonly { kit: Equipment; label: string }[] = [
  { kit: 'machine', label: 'Multi-gym' },
  { kit: 'bike', label: 'Bike' },
  { kit: 'trampoline', label: 'Trampoline' },
  { kit: 'bodyweight', label: 'Bodyweight' },
  { kit: 'dumbbell', label: 'Dumbbells' },
  { kit: 'kettlebell', label: 'Kettlebell' },
  { kit: 'band', label: 'Bands' },
]

/**
 * The subset you can put a weight against.
 *
 * Derived from `KIT_GROUPS` rather than listed again, so adding a kit in one
 * place cannot leave the other behind. A press-up and the trampoline are not
 * here: neither has a number to keep.
 */
export const LOADABLE_GROUPS: readonly { kit: Equipment; label: string }[] =
  KIT_GROUPS.filter((group) => LOADABLE.includes(group.kit))

/**
 * The longer get-ready, for anything you have to put ON.
 *
 * An ankle cuff has to be buckled and a band has to be stepped into and gripped;
 * a machine you sit at and start. Twenty seconds against fifteen, which is
 * Wayne's own margin from his routines rather than a guess.
 */
export const RIG_PREPARE_MS = 20_000
export const PREPARE_MS = 15_000

/** True where the exercise has to be put on before it can be started. */
export function needsRigging(exercise: Exercise): boolean {
  return exercise.attachment === 'ankle' || exercise.equipment === 'band'
}
