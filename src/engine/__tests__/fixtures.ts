import type { Block, MediaRef, Segment, Repeat, SegmentRole, Workout } from '../types'
import { SCHEMA_VERSION } from '../types'

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

export function seg(
  name: string,
  seconds: number,
  role: SegmentRole = 'work',
  media?: MediaRef,
): Segment {
  return {
    kind: 'segment',
    id: nextId('seg'),
    name,
    durationMs: seconds * 1000,
    role,
    ...(media ? { media } : {}),
  }
}

export function rep(times: number, children: Block[], label?: string): Repeat {
  return {
    kind: 'repeat',
    id: nextId('rep'),
    times,
    children,
    ...(label !== undefined ? { label } : {}),
  }
}

export function workout(name: string, blocks: Block[]): Workout {
  return {
    id: nextId('wk'),
    name,
    blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

export const CABLE_FLY: MediaRef = {
  source: 'remote',
  url: 'https://i.postimg.cc/jCGnZ34t/Cable-Fly.png',
}

/** Classic Tabata: 10s prepare, then 8 rounds of 20s work / 10s rest. */
export function tabata(): Workout {
  return workout('Tabata', [
    seg('Get ready', 10, 'prepare'),
    rep(8, [seg('Work', 20, 'work'), seg('Rest', 10, 'rest')], 'Reps'),
  ])
}

/** A named circuit — the case a fixed Tabata timer cannot express. */
export function circuit(): Workout {
  return workout('Upper body circuit', [
    rep(
      3,
      [
        seg('Cable fly', 40, 'work', CABLE_FLY),
        seg('Rest', 20, 'rest'),
        seg('Push-up', 40, 'work', { source: 'bundled', path: 'exercises/push-up.webp' }),
        seg('Rest', 20, 'rest'),
      ],
      'Circuit',
    ),
  ])
}

/** Two levels of repeat nesting, to exercise the `path` chain. */
export function nested(): Workout {
  return workout('Pyramid', [
    rep(2, [rep(3, [seg('Work', 5), seg('Rest', 5, 'rest')], 'Reps'), seg('Recover', 30, 'recover')], 'Set'),
  ])
}
