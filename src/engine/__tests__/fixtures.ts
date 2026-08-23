/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type {
  Block,
  Ladder,
  MediaRef,
  Repeat,
  Reps,
  Section,
  SectionDisplay,
  Segment,
  SegmentRole,
  Workout,
} from '../types'
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

/** A named circuit: the case a fixed Tabata timer cannot express. */
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

/**
 * A self-paced step: reps, no duration. Ends when the user taps Next.
 *
 * `reps` is a plain number for a fixed count, or `'rung'` to take the enclosing
 * ladder's current rung.
 */
export function step(name: string, reps?: number | 'rung', perSide = false): Segment {
  const spec: Reps | undefined =
    reps === undefined
      ? undefined
      : reps === 'rung'
        ? { kind: 'rung', ...(perSide ? { perSide: true } : {}) }
        : { kind: 'fixed', count: reps, ...(perSide ? { perSide: true } : {}) }
  return {
    kind: 'segment',
    id: nextId('step'),
    name,
    role: 'work',
    ...(spec ? { reps: spec } : {}),
  }
}

export function ladder(counts: number[], children: Block[], label?: string): Ladder {
  return {
    kind: 'ladder',
    id: nextId('lad'),
    counts,
    children,
    ...(label !== undefined ? { label } : {}),
  }
}

export function section(
  name: string,
  children: Block[],
  display: SectionDisplay = 'list',
  note?: string,
): Section {
  return {
    kind: 'section',
    id: nextId('sec'),
    name,
    display,
    children,
    ...(note !== undefined ? { note } : {}),
  }
}

/**
 * "#2 ARMS & SHOULDERS", 4 rounds, from the 17 Aug routine, trimmed to three
 * exercises. Rep-based steps with a timed rest after each round: the mixed case
 * the whole runs-and-gates design exists for.
 */
export function armsSection(): Workout {
  return workout('Arms', [
    section(
      '#2 Arms & Shoulders',
      [
        rep(
          4,
          [
            step('Bicep Curls', 12),
            step('Arnold Press', 10),
            step('Upright Rows', 10),
            seg('Rest', 45, 'rest'),
          ],
          'Round',
        ),
      ],
      'list',
      'No rest between exercises. Rest 45 seconds after each round.',
    ),
  ])
}

/**
 * "#3 LEGS", the 20-16-12-8-4 main-lift ladder with fixed accessories after
 * every set, including the last.
 */
export function legsLadder(): Workout {
  return workout('Legs', [
    section('#3 Legs', [
      ladder(
        [20, 16, 12, 8, 4],
        [step('Goblet Squats', 'rung'), step('RB Lateral Walks', 5, true), seg('Breathe', 15, 'rest')],
      ),
    ]),
  ])
}
