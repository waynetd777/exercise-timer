import type { Block, RoutineColour, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import rawFullBody from './beginner-full-body.routine.json'

/**
 * The routine seeded into an empty library.
 *
 * One routine, not three. It ships as an authored `Workout` — name, colour and
 * block tree — rather than as a `.tabata` file put through the importer, because
 * it is no longer a straight import: its exercise runs are Reps groups, which the
 * importer deliberately never infers (guessing a routine's shape would silently
 * change someone's workout).
 *
 * The `.tabata` files that used to be seeded are still in this folder as test
 * fixtures for the importer, which is a live feature — see `__tests__/fixtures`.
 * They are not in the app's import graph, so they add nothing to the bundle.
 *
 * The id is STABLE and deliberate: seeding is keyed on it and recorded as "once,
 * ever", so this routine is offered a given install one time and stays deleted if
 * deleted. Keeping the old id means an install that already had it is NOT offered
 * this version — the reps rewrite changes nothing about what plays, so quietly
 * replacing a routine someone may have edited would be the worse trade.
 */
const authored = rawFullBody as { name: string; colour: string; blocks: Block[] }

export const BEGINNER_FULL_BODY: Workout = {
  id: 'seed-beginner-full-body',
  name: authored.name,
  colour: authored.colour as RoutineColour,
  blocks: authored.blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
}

export const SEED_ROUTINES: readonly Workout[] = [BEGINNER_FULL_BODY]
