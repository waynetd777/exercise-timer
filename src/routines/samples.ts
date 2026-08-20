import type { Workout } from '../engine'
import rawFullBody from './beginner-full-body.tabata.json'
import rawMixedCardio1 from './beginner-mixed-cardio-1.tabata.json'
import rawMixedCardio2 from './beginner-mixed-cardio-2.tabata.json'
import { importTabataFile } from './tabataFormat'

/**
 * Routines seeded into the library.
 *
 * Wayne's real routines, exported from the Tabata Timer app and committed so
 * they double as test fixtures. Their ids are STABLE and deliberate: seeding is
 * keyed on them, so a routine is offered once and stays deleted if deleted.
 */

export const BEGINNER_FULL_BODY = importTabataFile(rawFullBody, 0, 'seed-beginner-full-body')
export const BEGINNER_MIXED_CARDIO_1 = importTabataFile(
  rawMixedCardio1,
  0,
  'seed-beginner-mixed-cardio-1',
)
export const BEGINNER_MIXED_CARDIO_2 = importTabataFile(
  rawMixedCardio2,
  0,
  'seed-beginner-mixed-cardio-2',
)

export const SEED_ROUTINES: readonly Workout[] = [
  BEGINNER_MIXED_CARDIO_2,
  BEGINNER_MIXED_CARDIO_1,
  BEGINNER_FULL_BODY,
]
