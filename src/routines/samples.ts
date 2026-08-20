import type { Block, Repeat, Segment, SegmentRole, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import rawFullBody from './beginner-full-body.tabata.json'
import rawMixedCardio1 from './beginner-mixed-cardio-1.tabata.json'
import rawMixedCardio2 from './beginner-mixed-cardio-2.tabata.json'
import { importTabataFile } from './tabataFormat'

/**
 * Routines seeded into the library.
 *
 * The three imported ones are Wayne's real routines, exported from the Tabata
 * Timer app and committed so they also serve as test fixtures. Their ids are
 * STABLE and deliberate: seeding is keyed on them, so a routine is offered once
 * and stays deleted if it is deleted.
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

const seg = (
  name: string,
  seconds: number,
  role: SegmentRole = 'work',
): Segment => ({
  kind: 'segment',
  id: `tabata-${name}-${seconds}-${role}`,
  name,
  durationMs: seconds * 1000,
  role,
})

const rep = (times: number, children: Block[], label: string): Repeat => ({
  kind: 'repeat',
  id: 'tabata-rounds',
  times,
  children,
  label,
})

/**
 * Classic Tabata, kept because it is genuinely useful and because it is the
 * only seeded routine that uses a repeat group — imported `.tabata` files are
 * always flat, so this is what exercises the "Round 3 of 8" path.
 */
export const CLASSIC_TABATA: Workout = {
  id: 'seed-classic-tabata',
  name: 'Classic Tabata',
  blocks: [
    seg('Get ready', 10, 'prepare'),
    rep(8, [seg('Work', 20, 'work'), seg('Rest', 10, 'rest')], 'Round'),
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
}

export const SEED_ROUTINES: readonly Workout[] = [
  BEGINNER_MIXED_CARDIO_2,
  BEGINNER_MIXED_CARDIO_1,
  BEGINNER_FULL_BODY,
  CLASSIC_TABATA,
]
