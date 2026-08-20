import type { MediaRef, Segment, SegmentRole, Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'

/**
 * Importer for the `.tabata` export format used by the Tabata Timer app.
 *
 * `workout.intervals` is the FULLY EXPANDED sequence — the sibling fields
 * (`cycles`, `work`, `rest`, `prepare`, `restBetweenTabatas`, …) are the
 * template defaults the routine was generated from, not multipliers. Applying
 * `cycles` would triple a 42-minute workout. They are deliberately ignored.
 *
 * The flat list is imported faithfully as a flat sequence of segments. No
 * repeat groups are inferred: the shape is recoverable later if wanted, and a
 * wrong guess would silently change someone's workout.
 */

type TabataInterval = {
  type: number
  time: number
  description?: string
  url?: string
}

type TabataFile = {
  workout: {
    title?: string
    intervals: TabataInterval[]
  }
}

/** 0 is prepare or a between-exercise transition, 1 is work, 2 is rest. */
const ROLE_BY_TYPE: Record<number, SegmentRole> = {
  0: 'prepare',
  1: 'work',
  2: 'rest',
  3: 'recover',
}

const DEFAULT_NAME: Record<SegmentRole, string> = {
  prepare: 'Get ready',
  work: 'Work',
  rest: 'Rest',
  recover: 'Recover',
  custom: 'Step',
}

export class TabataImportError extends Error {
  constructor(detail: string) {
    super(`Not a readable .tabata file: ${detail}`)
    this.name = 'TabataImportError'
  }
}

function assertShape(json: unknown): TabataFile {
  if (typeof json !== 'object' || json === null) throw new TabataImportError('not an object')
  const workout = (json as { workout?: unknown }).workout
  if (typeof workout !== 'object' || workout === null) throw new TabataImportError('no workout')
  const intervals = (workout as { intervals?: unknown }).intervals
  if (!Array.isArray(intervals)) throw new TabataImportError('no intervals array')
  return json as TabataFile
}

export function importTabataFile(json: unknown, now = 0, id?: string): Workout {
  const { workout } = assertShape(json)

  const blocks: Segment[] = workout.intervals
    .filter((interval) => Number.isFinite(interval.time) && interval.time > 0)
    .map((interval, index) => {
      const role = ROLE_BY_TYPE[interval.type] ?? 'custom'
      const described = interval.description?.trim()
      const media: MediaRef | undefined = interval.url
        ? { source: 'remote', url: interval.url }
        : undefined

      return {
        kind: 'segment',
        id: `imported-${index}`,
        name: described || DEFAULT_NAME[role],
        durationMs: Math.round(interval.time * 1000),
        role,
        ...(media ? { media } : {}),
      }
    })

  return {
    id: id ?? `imported-${now}`,
    name: workout.title?.trim() || 'Imported routine',
    blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  }
}
