import type { Block, Segment, PathStep, Timeline, TimelineEntry, Workout } from './types'

/**
 * Guard against a pathological authoring tree (e.g. two nested repeats of 1000)
 * producing a million-entry array and locking up the tab. Well above any real
 * routine: a 90-minute workout of 5-second steps is ~1080 entries.
 */
export const MAX_TIMELINE_ENTRIES = 10_000

export class TimelineTooLargeError extends Error {
  constructor(limit: number) {
    super(
      `Workout expands to more than ${limit} steps. Reduce a repeat count or remove a level of nesting.`,
    )
    this.name = 'TimelineTooLargeError'
  }
}

/** A segment contributes nothing unless it has a positive, finite duration. */
function segmentDurationMs(segment: Segment): number {
  if (!Number.isFinite(segment.durationMs) || segment.durationMs <= 0) return 0
  return Math.round(segment.durationMs)
}

/** A repeat contributes nothing unless it runs at least once. */
function repeatTimes(times: number): number {
  if (!Number.isFinite(times)) return 0
  const floored = Math.floor(times)
  return floored < 1 ? 0 : floored
}

/**
 * Flattens the recursive authoring tree into an absolute-time timeline.
 *
 * Expands every `repeat` into its iterations, accumulates offsets, and records
 * the repeat path on each entry so the UI can render "Round 3 of 8". Media refs
 * pass straight through, so the runner reads `entry.media` without walking back
 * up to the authoring model.
 *
 * @throws {TimelineTooLargeError} if expansion exceeds `MAX_TIMELINE_ENTRIES`.
 */
export function compile(workout: Workout): Timeline {
  const entries: TimelineEntry[] = []
  let cursor = 0

  const walk = (blocks: Block[], path: PathStep[]): void => {
    for (const block of blocks) {
      if (block.kind === 'segment') {
        const durationMs = segmentDurationMs(block)
        if (durationMs === 0) continue

        if (entries.length >= MAX_TIMELINE_ENTRIES) {
          throw new TimelineTooLargeError(MAX_TIMELINE_ENTRIES)
        }

        entries.push({
          index: entries.length,
          segmentId: block.id,
          name: block.name,
          role: block.role,
          durationMs,
          startMs: cursor,
          endMs: cursor + durationMs,
          path,
          ...(block.media ? { media: block.media } : {}),
          ...(block.note !== undefined ? { note: block.note } : {}),
        })
        cursor += durationMs
        continue
      }

      const times = repeatTimes(block.times)
      for (let i = 0; i < times; i++) {
        walk(block.children, [
          ...path,
          {
            repeatId: block.id,
            iteration: i + 1,
            of: times,
            ...(block.label !== undefined ? { label: block.label } : {}),
          },
        ])
      }
    }
  }

  walk(workout.blocks, [])

  return { entries, totalMs: cursor }
}

/**
 * Total length without building a timeline — cheap enough to call for every row
 * of the library list. Agrees with `compile(workout).totalMs` by construction;
 * asserted in the tests.
 */
export function totalDurationMs(workout: Workout): number {
  const sum = (blocks: Block[]): number => {
    let total = 0
    for (const block of blocks) {
      total +=
        block.kind === 'segment'
          ? segmentDurationMs(block)
          : repeatTimes(block.times) * sum(block.children)
    }
    return total
  }
  return sum(workout.blocks)
}

/** Number of steps a routine will actually run, for "24 steps" in the library. */
export function stepCount(workout: Workout): number {
  const count = (blocks: Block[]): number => {
    let total = 0
    for (const block of blocks) {
      total +=
        block.kind === 'segment'
          ? segmentDurationMs(block) > 0
            ? 1
            : 0
          : repeatTimes(block.times) * count(block.children)
    }
    return total
  }
  return count(workout.blocks)
}
