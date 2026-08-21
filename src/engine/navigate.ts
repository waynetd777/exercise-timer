import { elapsedAtStepStart, position, skipBack, skipForward } from './runtime'
import type { PathStep, Routine, Run, TimelineEntry } from './types'

/**
 * Moving around a routine that can wait for the user.
 *
 * `runtime.ts` handles everything INSIDE a run and knows nothing about gates.
 * This is the layer above: which run are we in, and what happens at its edges.
 * Both are pure — the caller owns the clock.
 */

/** Where the runner is: which run, and how far into it. */
export type Cursor = {
  runIndex: number
  /** Time since this run began. Counts up on a self-paced step, informationally. */
  elapsedInRunMs: number
}

export const START: Cursor = { runIndex: 0, elapsedInRunMs: 0 }

export type RoutinePosition = {
  /** `null` once the routine is complete. */
  entry: TimelineEntry | null
  /** The step after `entry`, ACROSS runs — for preloading the next image. */
  nextEntry: TimelineEntry | null
  elapsedInEntryMs: number
  /** `null` for a self-paced step, which has nothing to count down. */
  remainingMs: number | null
  /** 1-based position in the whole routine; `entries.length + 1` when complete. */
  step: number
  isComplete: boolean
}

function runAt(routine: Routine, index: number): Run | null {
  return routine.runs[index] ?? null
}

function clampCursor(cursor: Cursor): Cursor {
  const runIndex = Number.isFinite(cursor.runIndex) ? Math.max(0, Math.floor(cursor.runIndex)) : 0
  const elapsed = Number.isFinite(cursor.elapsedInRunMs) ? Math.max(0, cursor.elapsedInRunMs) : 0
  return { runIndex, elapsedInRunMs: elapsed }
}

/** The cursor for the top of a run. */
function topOf(runIndex: number): Cursor {
  return { runIndex, elapsedInRunMs: 0 }
}

function complete(routine: Routine): RoutinePosition {
  return {
    entry: null,
    nextEntry: null,
    elapsedInEntryMs: 0,
    remainingMs: 0,
    step: routine.entries.length + 1,
    isComplete: true,
  }
}

/**
 * Resolves a cursor to a step.
 *
 * A self-paced run holds its single step for as long as it takes: elapsed keeps
 * climbing and the step never ends by itself. A timed run defers entirely to
 * `position()`, so boundary semantics inside one are unchanged — and a cursor
 * past the end of a timed run reports the run's LAST step rather than falling
 * through, because only `advance()` may cross a gate. Nothing should skip a step
 * because a timeout fired late.
 */
export function locate(routine: Routine, cursor: Cursor): RoutinePosition {
  const { runIndex, elapsedInRunMs } = clampCursor(cursor)
  const run = runAt(routine, runIndex)
  if (!run) return complete(routine)

  if (run.selfPaced) {
    /*
     * The FIRST step of the gate. A gate usually holds one step, but a ladder
     * rung advances as a whole, so it can hold several — and then what comes
     * next is what follows the RUN, not the next step inside it.
     */
    const entry = run.entries[0]!
    const last = run.entries.at(-1)!
    return {
      entry,
      nextEntry: routine.entries[last.step] ?? null,
      elapsedInEntryMs: elapsedInRunMs,
      remainingMs: null,
      step: entry.step,
      isComplete: false,
    }
  }

  const within = position(run, Math.min(elapsedInRunMs, Math.max(0, run.totalMs - 1)))
  const entry = within.entry
  if (!entry) return complete(routine)

  return {
    entry,
    nextEntry: routine.entries[entry.step] ?? null,
    elapsedInEntryMs: within.elapsedInEntryMs,
    remainingMs: within.remainingMs,
    step: entry.step,
    isComplete: false,
  }
}

/**
 * Has the current run finished on its own? Only a timed run ever can — a
 * self-paced one waits however long it waits.
 *
 * The tick calls this rather than comparing times itself, so "the run is over"
 * is defined in one place.
 */
export function runIsOver(routine: Routine, cursor: Cursor): boolean {
  const { runIndex, elapsedInRunMs } = clampCursor(cursor)
  const run = runAt(routine, runIndex)
  if (!run || run.selfPaced) return false
  return elapsedInRunMs >= run.totalMs
}

/**
 * The cursor after the current run ends, whether it ran out or was tapped past.
 *
 * **Overshoot is deliberately discarded.** A phone that spent ten minutes in a
 * pocket during the warm-up arrives at the next step ready to go, rather than
 * silently burning the rest of the routine — and the step after a timed run is
 * always a gate, since runs are maximal, so there is nothing to carry the
 * overshoot into anyway.
 */
export function nextRun(routine: Routine, cursor: Cursor): Cursor {
  const { runIndex } = clampCursor(cursor)
  return topOf(Math.min(runIndex + 1, routine.runs.length))
}

/**
 * Skip forward one step: the user tapping Next, or advancing past a self-paced
 * step.
 *
 * Inside a timed run this is the existing music-player skip. At the last step of
 * a run — and always, for a self-paced step — it crosses into the next run.
 */
export function advance(routine: Routine, cursor: Cursor): Cursor {
  const clamped = clampCursor(cursor)
  const run = runAt(routine, clamped.runIndex)
  if (!run) return topOf(routine.runs.length)
  if (run.selfPaced) return nextRun(routine, clamped)

  const target = skipForward(run, clamped.elapsedInRunMs)
  if (target >= run.totalMs) return nextRun(routine, clamped)
  return { runIndex: clamped.runIndex, elapsedInRunMs: target }
}

/**
 * Skip back one step, with the same music-player convention as within a run:
 * restart the current step unless you have only just started it.
 *
 * At the top of a run that means landing on the LAST step of the previous run,
 * which is the step the user actually just left — not the top of it.
 */
export function retreat(routine: Routine, cursor: Cursor, restartThresholdMs = 1500): Cursor {
  const clamped = clampCursor(cursor)

  const toEndOfPrevious = (runIndex: number): Cursor => {
    const previous = runAt(routine, runIndex - 1)
    if (!previous) return topOf(0)
    if (previous.selfPaced) return topOf(previous.index)
    return {
      runIndex: previous.index,
      elapsedInRunMs: elapsedAtStepStart(previous, previous.entries.length - 1),
    }
  }

  // Past the end: step back onto the final run.
  if (clamped.runIndex >= routine.runs.length) return toEndOfPrevious(routine.runs.length)

  // Safe: the index is in range after the check above.
  const run = routine.runs[clamped.runIndex]!

  if (run.selfPaced) {
    if (clamped.elapsedInRunMs > restartThresholdMs) return topOf(run.index)
    return toEndOfPrevious(run.index)
  }

  const target = skipBack(run, clamped.elapsedInRunMs, restartThresholdMs)
  const atTop = clamped.elapsedInRunMs <= restartThresholdMs && target === 0
  if (atTop && run.index > 0) return toEndOfPrevious(run.index)
  return { runIndex: run.index, elapsedInRunMs: target }
}

/** The cursor for the top of a given step, for seeking from a list. */
export function cursorForStep(routine: Routine, step: number): Cursor {
  const entry = routine.entries[step - 1]
  if (!entry) return step <= 1 ? START : topOf(routine.runs.length)
  const run = runAt(routine, entry.runIndex)
  if (!run || run.selfPaced) return topOf(entry.runIndex)
  return { runIndex: entry.runIndex, elapsedInRunMs: entry.startMs }
}

function sameLevel(a: PathStep, b: PathStep): boolean {
  return a.id === b.id && a.iteration === b.iteration
}

/**
 * The steps shown together in list mode: everything belonging to the same
 * innermost group iteration as `entry`.
 *
 * That is one round of a repeat, one rung of a ladder, or — where a section has
 * no group inside it — the whole section. It is the unit the source routines are
 * written in ("4 Rounds: 12 × Hammer Curls, 10 × Shoulder Press, …") and the unit
 * a user needs on screen at once.
 *
 * A step outside every group returns the whole routine, which is the only honest
 * answer and is what a section-less routine wants anyway.
 */
export function groupEntries(routine: Routine, entry: TimelineEntry): TimelineEntry[] {
  const depth = entry.path.length
  if (depth === 0) return routine.entries

  return routine.entries.filter(
    (other) =>
      other.path.length >= depth &&
      entry.path.every((step, i) => sameLevel(step, other.path[i]!)),
  )
}

/** The innermost group above a step, which is what list mode captions. */
export function groupOf(entry: TimelineEntry): PathStep | null {
  return entry.path.at(-1) ?? null
}

/** The nearest enclosing section, which owns the display mode. */
export function sectionOf(entry: TimelineEntry): PathStep | null {
  for (let i = entry.path.length - 1; i >= 0; i--) {
    const step = entry.path[i]!
    if (step.kind === 'section') return step
  }
  return null
}

/**
 * Whether a step is shown as a LIST of its group, or as the countdown.
 *
 * Pure and here rather than in the component, because it is a real rule with
 * three clauses and one of them is easy to get backwards.
 *
 *  - A step outside a list-mode section is a countdown, as it always was.
 *  - A TIMED step is a countdown wherever it falls. You are not reading a list
 *    while holding a wall sit — you are watching the clock. A rest between
 *    rounds, a hold at the end of a rung and one in the middle of a burnout are
 *    all the same case.
 *  - A gate with nothing after it in its group is a countdown too: the list
 *    would be a column of struck-through text and one live row.
 *
 * The editor asks the same question of an unrun tree, to decide whether to offer
 * a step an image at all — only the countdown has a media panel. That is
 * `shownAsList()` in `editor/blocks.ts`, which mirrors the first two clauses and
 * deliberately drops the third; this function is the authority, and a test binds
 * the two. Change one, look at the other.
 */
export function listMode(routine: Routine, entry: TimelineEntry): boolean {
  if (!entry.selfPaced) return false
  if (sectionOf(entry)?.display !== 'list') return false
  return groupEntries(routine, entry).filter((row) => row.step >= entry.step).length > 1
}
