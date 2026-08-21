import type {
  Block,
  Ladder,
  PathStep,
  Repeat,
  Reps,
  Routine,
  Run,
  Section,
  Segment,
  TimelineEntry,
  Workout,
} from './types'

/**
 * Guard against a pathological authoring tree (e.g. two nested repeats of 1000)
 * producing a million-entry array and locking up the tab. Well above any real
 * routine: a 90-minute workout of 5-second steps is ~1080 entries, and the
 * longest strength routine seen is ~250 steps.
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

/**
 * A step's duration, or `null` when it is self-paced.
 *
 * The distinction that matters: an ABSENT duration is a self-paced step and is
 * kept; a PRESENT but non-positive or non-finite one is degenerate input and the
 * step is dropped, exactly as it always has been. Without that rule a mistyped
 * `0` would quietly turn a timed step into a gate.
 */
function segmentDurationMs(segment: Segment): number | null {
  if (segment.durationMs === undefined) return null
  if (!Number.isFinite(segment.durationMs) || segment.durationMs <= 0) return 0
  return Math.round(segment.durationMs)
}

/** True when the step survives compilation at all. */
function runs(segment: Segment): boolean {
  return segmentDurationMs(segment) !== 0
}

/**
 * The trailing rest of a reps group, which does NOT run after the final rep.
 *
 * A rest belongs BETWEEN reps: three reps of work-then-rest is work rest work
 * rest work, five steps, not six. A trailing rest would leave the routine resting
 * into whatever comes next, which is usually another rest or the finish.
 *
 * Only the last child, and only the `rest` role. `recover` is a deliberate long
 * interval that someone put at the end on purpose, and anything before the last
 * child is inside the rep rather than after it.
 *
 * To rest after the last rep as well, put a rest step AFTER the group rather than
 * inside it. That reads as what it is, and it survives a change to the rep count.
 *
 * A LADDER has no equivalent rule: "after every set" includes the final set.
 */
function trailingRest(children: Block[]): Segment | null {
  const last = children.at(-1)
  return last?.kind === 'segment' && last.role === 'rest' ? last : null
}

/** A repeat contributes nothing unless it runs at least once. */
function repeatTimes(times: number): number {
  if (!Number.isFinite(times)) return 0
  const floored = Math.floor(times)
  return floored < 1 ? 0 : floored
}

/**
 * The rungs a ladder actually runs. Degenerate rungs are dropped rather than
 * throwing, for the same reason `compile()` tolerates a half-typed duration: the
 * editor validates, the engine must never crash on a routine mid-edit.
 */
function ladderRungs(counts: readonly number[]): number[] {
  return counts
    .filter((count) => Number.isFinite(count) && count >= 1)
    .map((count) => Math.floor(count))
}

/**
 * A step's rep count, resolved against the rung of the nearest enclosing ladder.
 *
 * A `rung` spec outside a ladder resolves to nothing rather than to zero: it is
 * a half-authored step, and showing "0 ×" would be worse than showing no count.
 */
function resolveReps(
  reps: Reps | undefined,
  rung: number | null,
): { count: number; perSide?: boolean } | undefined {
  if (!reps) return undefined
  if (reps.kind === 'fixed') {
    if (!Number.isFinite(reps.count) || reps.count < 1) return undefined
    return { count: Math.floor(reps.count), ...(reps.perSide ? { perSide: true } : {}) }
  }
  if (rung === null) return undefined
  return { count: rung, ...(reps.perSide ? { perSide: true } : {}) }
}

function sectionStep(block: Section): PathStep {
  return {
    kind: 'section',
    id: block.id,
    label: block.name,
    iteration: 1,
    of: 1,
    display: block.display,
    ...(block.note !== undefined ? { note: block.note } : {}),
  }
}

function repeatStep(block: Repeat, iteration: number, of: number): PathStep {
  return {
    kind: 'repeat',
    id: block.id,
    iteration,
    of,
    ...(block.label !== undefined ? { label: block.label } : {}),
    ...(block.advance !== undefined ? { advance: block.advance } : {}),
  }
}

function ladderStep(block: Ladder, iteration: number, of: number, rung: number): PathStep {
  return {
    kind: 'ladder',
    id: block.id,
    iteration,
    of,
    rung,
    label: block.label ?? 'Set',
    ...(block.advance !== undefined ? { advance: block.advance } : {}),
  }
}

/**
 * The group a self-paced step advances WITH, or `null` if it advances alone.
 *
 * Steps sharing a key are cleared by one Next. The innermost round or rung wins,
 * and both collapse by default, because the ITERATION is the unit of work —
 * tapping through a round's five exercises separately is five taps for one thing
 * you just did. A section does not qualify: it is a part of a routine, not a
 * piece of work, and collapsing one would hide a whole screen behind one tap.
 */
function gateKey(entry: TimelineEntry): string | null {
  for (let i = entry.path.length - 1; i >= 0; i--) {
    const step = entry.path[i]!
    if (step.kind === 'section') continue
    // An explicit opt-out wins over an outer group's default: asking for one
    // exercise at a time must not be overruled by the group enclosing it.
    if (step.advance === 'step') return null
    return `${step.id}@${step.iteration}`
  }
  return null
}

/**
 * Flattens the recursive authoring tree into a list of steps, then partitions it
 * into runs.
 *
 * Expands every repeat and ladder into its iterations and records the group path
 * on each entry, so the UI can render "Reps 3 of 8" and — more importantly — find
 * the other entries of the innermost group, which is what list mode draws. Media
 * refs pass straight through, so the runner reads `entry.media` without walking
 * back up to the authoring model.
 *
 * @throws {TimelineTooLargeError} if expansion exceeds `MAX_TIMELINE_ENTRIES`.
 */
export function compile(workout: Workout): Routine {
  const entries: TimelineEntry[] = []

  const walk = (blocks: Block[], path: PathStep[], rung: number | null): void => {
    for (const block of blocks) {
      if (block.kind === 'segment') {
        const durationMs = segmentDurationMs(block)
        if (durationMs === 0) continue

        if (entries.length >= MAX_TIMELINE_ENTRIES) {
          throw new TimelineTooLargeError(MAX_TIMELINE_ENTRIES)
        }

        const reps = resolveReps(block.reps, rung)
        entries.push({
          // Both are rewritten once the runs are known; see `partition()`.
          index: 0,
          runIndex: 0,
          step: entries.length + 1,
          segmentId: block.id,
          name: block.name,
          role: block.role,
          selfPaced: durationMs === null,
          startMs: 0,
          endMs: 0,
          path,
          ...(durationMs !== null ? { durationMs } : {}),
          ...(reps ? { reps } : {}),
          ...(block.alternative !== undefined ? { alternative: block.alternative } : {}),
          ...(block.media ? { media: block.media } : {}),
          ...(block.note !== undefined ? { note: block.note } : {}),
        })
        continue
      }

      if (block.kind === 'section') {
        walk(block.children, [...path, sectionStep(block)], rung)
        continue
      }

      if (block.kind === 'ladder') {
        const rungs = ladderRungs(block.counts)
        rungs.forEach((count, i) => {
          walk(block.children, [...path, ladderStep(block, i + 1, rungs.length, count)], count)
        })
        continue
      }

      const times = repeatTimes(block.times)
      const drop = trailingRest(block.children) !== null
      for (let i = 0; i < times; i++) {
        const children = drop && i === times - 1 ? block.children.slice(0, -1) : block.children
        walk(children, [...path, repeatStep(block, i + 1, times)], rung)
      }
    }
  }

  walk(workout.blocks, [], null)
  return partition(entries)
}

/**
 * Groups the flat step list into runs, and stamps each entry with its place in
 * one.
 *
 * A run is a maximal span of consecutive TIMED steps; every self-paced step is a
 * run of its own. Entry times are relative to the run, which is the only axis
 * that exists once a routine can wait for a tap. A fully timed routine yields
 * exactly one run, and then run time and routine time are the same thing.
 *
 * The entry objects are shared between `routine.entries` and `run.entries` — the
 * same steps seen two ways, never copied.
 */
function partition(entries: TimelineEntry[]): Routine {
  const runList: Run[] = []
  let current: Run | null = null
  let totalMs = 0
  let hasGates = false

  /** The open self-paced run and the group it belongs to, if any. */
  let gate: { run: Run; key: string } | null = null

  for (const entry of entries) {
    if (entry.selfPaced) {
      hasGates = true
      current = null

      const key = gateKey(entry)
      // Steps of the same ladder rung share a gate: one Next clears them all.
      const run: Run =
        key !== null && gate?.key === key
          ? gate.run
          : { index: runList.length, entries: [], totalMs: 0, selfPaced: true }
      if (run.entries.length === 0) runList.push(run)

      entry.runIndex = run.index
      entry.index = run.entries.length
      entry.startMs = 0
      entry.endMs = 0
      run.entries.push(entry)
      gate = key === null ? null : { run, key }
      continue
    }

    // A timed step ends the gate: the rung resumes in a new one after it.
    gate = null

    if (current === null) {
      current = { index: runList.length, entries: [], totalMs: 0, selfPaced: false }
      runList.push(current)
    }

    // Safe: a non-self-paced entry always has a duration.
    const durationMs = entry.durationMs!
    entry.runIndex = current.index
    entry.index = current.entries.length
    entry.startMs = current.totalMs
    entry.endMs = current.totalMs + durationMs
    current.entries.push(entry)
    current.totalMs += durationMs
    totalMs += durationMs
  }

  return { entries, runs: runList, totalMs, hasGates }
}

/**
 * Total TIMED length without building a routine — cheap enough to call for every
 * row of the library list. Agrees with `compile(workout).totalMs` by
 * construction; asserted in the tests.
 *
 * Self-paced steps contribute nothing, so for a routine with gates this is a
 * floor rather than a length. Pair it with `hasGates()`.
 */
export function totalDurationMs(workout: Workout): number {
  const sum = (blocks: Block[]): number => {
    let total = 0
    for (const block of blocks) {
      if (block.kind === 'segment') {
        total += segmentDurationMs(block) ?? 0
        continue
      }
      if (block.kind === 'section') {
        total += sum(block.children)
        continue
      }
      if (block.kind === 'ladder') {
        total += ladderRungs(block.counts).length * sum(block.children)
        continue
      }
      const times = repeatTimes(block.times)
      total += times * sum(block.children)
      // The final rep's trailing rest never runs, so it is not in the total.
      const rest = times > 0 ? trailingRest(block.children) : null
      if (rest) total -= segmentDurationMs(rest) ?? 0
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
      if (block.kind === 'segment') {
        total += runs(block) ? 1 : 0
        continue
      }
      if (block.kind === 'section') {
        total += count(block.children)
        continue
      }
      if (block.kind === 'ladder') {
        total += ladderRungs(block.counts).length * count(block.children)
        continue
      }
      const times = repeatTimes(block.times)
      total += times * count(block.children)
      const rest = times > 0 ? trailingRest(block.children) : null
      // A dropped rest was never counted, so there is nothing to take off.
      if (rest && runs(rest)) total -= 1
    }
    return total
  }
  return count(workout.blocks)
}

/**
 * Whether a routine contains a self-paced step, without compiling it. The
 * library needs this to know that "24:50" would be a lie.
 */
export function hasGates(workout: Workout): boolean {
  const any = (blocks: Block[]): boolean =>
    blocks.some((block) =>
      block.kind === 'segment' ? segmentDurationMs(block) === null : any(block.children),
    )
  return any(workout.blocks)
}
