import type { Block, MediaRef, Repeat, Segment, SegmentRole, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'

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
