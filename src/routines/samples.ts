import type { Block, MediaRef, Repeat, Segment, SegmentRole, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import rawBeginnerMixedCardio from './beginner-mixed-cardio.tabata.json'
import { importTabataFile } from './tabataFormat'

let n = 0
const id = (p: string) => `${p}-${++n}`

const seg = (
  name: string,
  seconds: number,
  role: SegmentRole = 'work',
  media?: MediaRef,
): Segment => ({
  kind: 'segment',
  id: id('seg'),
  name,
  durationMs: seconds * 1000,
  role,
  ...(media ? { media } : {}),
})

const rep = (times: number, children: Block[], label: string): Repeat => ({
  kind: 'repeat',
  id: id('rep'),
  times,
  children,
  label,
})

const routine = (name: string, blocks: Block[]): Workout => ({
  id: id('wk'),
  name,
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

const CABLE_FLY: MediaRef = {
  source: 'remote',
  url: 'https://i.postimg.cc/jCGnZ34t/Cable-Fly.png',
}

export const TABATA = routine('Tabata', [
  seg('Get ready', 10, 'prepare'),
  rep(8, [seg('Work', 20, 'work'), seg('Rest', 10, 'rest')], 'Round'),
])

export const UPPER_CIRCUIT = routine('Upper body circuit', [
  seg('Get ready', 10, 'prepare'),
  rep(
    3,
    [
      seg('Cable fly', 40, 'work', CABLE_FLY),
      seg('Rest', 20, 'rest'),
      seg('Push-up', 40, 'work'),
      seg('Rest', 20, 'rest'),
      seg('Row', 40, 'work'),
      seg('Recover', 60, 'recover'),
    ],
    'Circuit',
  ),
])

/**
 * Wayne's real routine, imported from the Tabata Timer app's export: a 10-minute
 * cycling warm-up, then each exercise as prepare + 3 x (20s work / 10s rest)
 * with a 60s cycling interlude between. 86 steps, 42 minutes, 10 distinct
 * postimages illustrations — and a few exercises with no image at all, which
 * exercises the empty panel.
 */
export const BEGINNER_MIXED_CARDIO = importTabataFile(rawBeginnerMixedCardio)
