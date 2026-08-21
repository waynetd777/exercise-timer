/**
 * Core types for the interval-timer engine.
 *
 * Two models live here:
 *
 *  - The AUTHORING model (`Workout`, `Block`) — a recursive tree the user edits.
 *    Three group primitives cover everything seen so far: `repeat` (Tabata,
 *    circuits, nested sets), `ladder` (a repeat whose rep count changes each
 *    iteration) and `section` (a named part of a routine, with its own display
 *    mode).
 *
 *  - The RUNTIME model (`Routine`, `Run`, `TimelineEntry`) — flat arrays produced
 *    once by `compile()`. Everything the runner does is a pure lookup against
 *    them, which is what makes seek/skip trivial and the whole engine testable
 *    with a fake clock.
 *
 * RUNS AND GATES — the one idea to understand before changing anything here.
 *
 * A step either has a duration and advances itself, or is SELF-PACED and waits
 * for the user to tap Next. Not every routine is a timer: a strength session is
 * mostly rep-based, with timed steps (a 45s rest, a 30s plank) mixed in.
 *
 * So a routine compiles to a sequence of RUNS. A run is a maximal span of
 * consecutive timed steps, and it is an ordinary absolute-time timeline — inside
 * one, everything works exactly as it always has: `position()` is a binary search,
 * cues pre-schedule on the audio clock, and a phone that has been in a pocket for
 * ten minutes lands on the right step rather than the next one. Between runs sit
 * GATES: single self-paced steps where the clock parks until Next is tapped, and
 * the following run is rebased from that moment.
 *
 * A fully timed routine therefore compiles to exactly ONE run and behaves
 * identically to before this existed.
 *
 * Nothing in `src/engine` may import React or touch the DOM.
 */

export type SegmentRole = 'prepare' | 'work' | 'rest' | 'recover' | 'custom'

/**
 * Where a step's image comes from. Three sources, resolved to a URL by
 * `resolveMedia()` in src/media — the UI never branches on this itself.
 *
 *  - `remote`  the primary source; user's own postimages links. `cachedHash`
 *              is set once the blob has been pinned into IndexedDB, after
 *              which the local copy is preferred (offline + link-rot safety).
 *  - `bundled` curated images committed to `public/exercises/`, addressed
 *              relative to `import.meta.env.BASE_URL`. Exports as a short
 *              path, which is what keeps URL share links small.
 *  - `local`   own photos, content-addressed by sha256 of the stored blob.
 */
export type MediaRef =
  | { source: 'remote'; url: string; cachedHash?: string; w?: number; h?: number }
  | { source: 'bundled'; path: string; w?: number; h?: number }
  | { source: 'local'; hash: string; mime: string; w?: number; h?: number }

/**
 * Whether Next clears a whole iteration of a group or one step of it.
 *
 * `'set'` is the DEFAULT for every group, because a round or a rung is the unit
 * of work: "12 curls, 10 press, 12 flyes, 15 pull-aparts" is one round you do
 * and then tick off, not four prompts to tap through with your hands full.
 *
 * A TIMED step inside the iteration is never swallowed by the tap — it keeps its
 * own run, so the 45-second rest after a round and the 10-second wall sit after
 * a rung still count themselves down.
 *
 * `'step'` opts a group out, one exercise at a time.
 */
export type Advance = 'set' | 'step'

/**
 * How many reps a step calls for.
 *
 * Display only — the app cannot count reps, and a rep-based step ends when the
 * user taps Next. `perSide` records that the count is PER SIDE ("10 × Walking
 * Lunges (5 each leg)" is `{ count: 5, perSide: true }`), which is information
 * the user needs and the app must not silently double.
 *
 * `rung` takes its count from the enclosing `Ladder`'s current rung, which is
 * what makes one ladder primitive express both shapes in the source routines:
 * every child scaling with the rung (#1 General Body), or a main lift that
 * scales with fixed accessories after it (#3 Legs).
 */
export type Reps =
  | { kind: 'fixed'; count: number; perSide?: boolean }
  | { kind: 'rung'; perSide?: boolean }

export type Segment = {
  kind: 'segment'
  id: string
  name: string
  /**
   * Milliseconds, or ABSENT for a self-paced step that ends only when the user
   * taps Next.
   *
   * Absent and zero are NOT the same thing: a present-but-non-positive duration
   * is degenerate input and `compile()` drops the step, exactly as it always has.
   * Otherwise a mistyped `0` would quietly turn a timed step into a gate.
   */
  durationMs?: number
  /** What to show for a rep-based step. Absent for a purely timed one. */
  reps?: Reps
  /** A lower-impact or equipment-free swap: "knees or toes", "step-back option". */
  alternative?: string
  role: SegmentRole
  media?: MediaRef
  note?: string
}

export type Repeat = {
  kind: 'repeat'
  id: string
  /** Shown as e.g. "Reps 3 of 8" while running. */
  label?: string
  /** Iteration count. Floored; anything below 1 contributes nothing. */
  times: number
  /** Whether Next advances the whole round. See `Advance`; defaults to `'set'`. */
  advance?: Advance
  children: Block[]
}

/**
 * A repeat whose rep count changes each iteration: `2-4-6-8-10-8-6-4-2`.
 *
 * Each entry in `counts` is one rung, run in order. Children marked
 * `reps: { kind: 'rung' }` take that rung's count; children with a fixed count
 * keep it, which is how "after every set: 10 × Walking Lunges" works.
 *
 * A ladder is a PER-RUNG CIRCUIT: rung 2 is 2 reps of every scaling exercise,
 * then rung 4 is 4 of every one. It is not one exercise walked up and down the
 * whole ladder before the next begins.
 *
 * Unlike a repeat's trailing rest, everything in a ladder runs on the FINAL rung
 * too — "after every set" includes the last set. Two similar-looking rules with
 * opposite answers, both deliberate.
 */
export type Ladder = {
  kind: 'ladder'
  id: string
  /** Shown as e.g. "Set 4 of 9". Defaults to "Set". */
  label?: string
  /** Reps at each rung, in order. Non-integer or sub-1 rungs are dropped. */
  counts: number[]
  /**
   * Whether Next advances the whole rung or one exercise at a time.
   *
   * `'set'` is the DEFAULT, and is why a ladder is a ladder: the rung is the
   * unit you work. "20 Goblet Squats, then 10 lateral walks and 10 kickbacks"
   * is one piece of work you do and then tick off, not three prompts to tap
   * through with your hands full.
   *
   * See `Advance`; defaults to `'set'`.
   */
  advance?: Advance
  children: Block[]
}

/** How a section is shown while running. See `Section`. */
export type SectionDisplay = 'timer' | 'list'

/**
 * A named part of a routine — "#2 Arms & Shoulders", "Warm-up", "Final Burnout".
 *
 * Sections exist for the RUN SCREEN. `display: 'timer'` is the original one-step
 * countdown; `display: 'list'` shows the whole group on screen at once with the
 * current row highlighted, which is what a rep-based section needs — you have to
 * read the next four exercises, not be told them one at a time.
 *
 * `note` carries the instruction that applies to the whole section, e.g.
 * "No rest between exercises. Rest 45 seconds after each round."
 *
 * The data model allows a section anywhere; the editor only offers them at the
 * top level. Same arrangement as the two-level nesting cap — a UI decision, not a
 * schema one.
 */
export type Section = {
  kind: 'section'
  id: string
  name: string
  note?: string
  display: SectionDisplay
  children: Block[]
}

/** Every block that holds children. The one thing they all have in common. */
export type Group = Repeat | Ladder | Section

export type Block = Segment | Group

/** Narrowing helper, so a tree walk cannot forget a group kind. */
export function isGroup(block: Block): block is Group {
  return block.kind !== 'segment'
}

export const SCHEMA_VERSION = 1 as const

/**
 * Routine tints, in spectrum order rather than the order they were asked for, so
 * the picker reads as a palette instead of a list.
 *
 * These are labels, not phase colours. The run screen's green/red/blue mean get
 * ready/work/rest and a routine's tint deliberately does NOT override them —
 * recolouring the countdown would break the one thing that is readable across a
 * gym at a glance.
 */
export const ROUTINE_COLOURS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const

export type RoutineColour = (typeof ROUTINE_COLOURS)[number]

export type Workout = {
  id: string
  name: string
  /** A tint for the library row and the editor. Absent means untinted. */
  colour?: RoutineColour
  blocks: Block[]
  schemaVersion: typeof SCHEMA_VERSION
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  favourite?: boolean
  /**
   * Denormalised at save time so the library list can show a routine's length
   * without compiling every routine on every render. Derive with
   * `totalDurationMs()`.
   */
  estimatedTotalMs?: number
}

/**
 * One level of grouping above a timeline entry — a section, a repeat iteration or
 * a ladder rung. Renders as "Reps 3 of 8", "Set 4 of 9".
 *
 * A section contributes a level with `iteration: 1, of: 1`, which `pathLabel()`
 * filters out of the caption; it is there so the run screen can find the entries
 * of the innermost group, which is exactly what list mode draws.
 */
export type PathStep = {
  kind: 'section' | 'repeat' | 'ladder'
  /** Id of the group block. */
  id: string
  label?: string
  /** 1-based. */
  iteration: number
  of: number
  /** Ladder only: the rep count at this rung. */
  rung?: number
  /** Repeat and ladder: whether Next clears the whole iteration. See `Advance`. */
  advance?: Advance
  /** Section only. */
  display?: SectionDisplay
  /** Section only: the instruction covering the whole section. */
  note?: string
}

/**
 * A single step of a compiled routine.
 *
 * A TIMED step occupies the half-open interval `[startMs, endMs)`. **Those are
 * relative to the start of the step's RUN, not the routine** — a routine with
 * gates has no single time axis to be absolute against. For a fully timed
 * routine there is one run, so the two are the same thing.
 *
 * A SELF-PACED step has no `durationMs`, and `startMs === endMs === 0`: it is
 * alone in its run and ends when the user taps Next.
 */
export type TimelineEntry = {
  /** Position within the entry's own run. This is what `position()` returns. */
  index: number
  /** 1-based position in the whole routine, for "step 12 of 45". */
  step: number
  /** Which run this entry belongs to. */
  runIndex: number
  /** Id of the authoring `Segment` this came from; not unique across repeats. */
  segmentId: string
  name: string
  role: SegmentRole
  /** Absent for a self-paced step. */
  durationMs?: number
  startMs: number
  endMs: number
  /** True when the step waits for Next. Equivalent to `durationMs === undefined`. */
  selfPaced: boolean
  /** Resolved against the enclosing ladder's rung, if any. */
  reps?: { count: number; perSide?: boolean }
  alternative?: string
  media?: MediaRef
  note?: string
  path: PathStep[]
}

/**
 * A span of the routine that shares one clock: either a maximal run of
 * consecutive timed steps, or a single self-paced step.
 *
 * Structurally a `Timeline`, so `position()`, `cues()` and the seek helpers take
 * a run and need to know nothing about gates.
 */
export type Run = {
  index: number
  /**
   * A timed run holds consecutive timed steps. A self-paced run holds ONE step,
   * unless they belong to a group that advances as a whole — a ladder rung — in
   * which case it holds all of them and one Next clears the lot.
   */
  entries: TimelineEntry[]
  /** Length of the run. 0 when `selfPaced`. */
  totalMs: number
  /** True when this run is one step waiting for Next. */
  selfPaced: boolean
}

/**
 * What `position()` and the cue functions need: an ordered list of entries and a
 * length. A `Run` satisfies it.
 */
export type Timeline = {
  entries: TimelineEntry[]
  totalMs: number
}

/** A compiled routine: the same entries seen two ways. */
export type Routine = {
  /** Every step in order. Use this to display; `entry.index` is run-local. */
  entries: TimelineEntry[]
  /** The same entry objects, partitioned into runs. Use this to run the clock. */
  runs: Run[]
  /** Sum of every timed step. NOT the wall-clock length once `hasGates`. */
  totalMs: number
  /** True if any step is self-paced, so the routine's length is an estimate. */
  hasGates: boolean
}

/**
 * Every boundary is simultaneously the end of one step and the start of the
 * next, so what distinguishes these is WHICH KIND of step is being entered:
 *
 *   `work-start`  entering a work step — a referee's whistle, play begins
 *   `work-end`    entering anything else — a bell, the round is over
 *
 * That is why there is no single "phase change": the two moments mean opposite
 * things to someone mid-effort and should not sound alike.
 */
export type CueKind = 'countdown' | 'work-start' | 'work-end' | 'workout-complete'

/** An audio cue at an absolute offset from workout start. */
export type CuePoint = {
  atMs: number
  kind: CueKind
  entryIndex: number
  /** For `countdown`: seconds remaining (3, 2, 1). */
  value?: number
}

/** Result of locating a moment in a timeline. Pure function of (timeline, elapsedMs). */
export type Position = {
  /** `null` once the workout is complete, or if the timeline is empty. */
  entry: TimelineEntry | null
  /** The step after `entry` — used to preload its image before the transition. */
  nextEntry: TimelineEntry | null
  /** Index of `entry`, or `entries.length` when complete. */
  index: number
  elapsedInEntryMs: number
  /** Remaining in the current step. Display with `Math.ceil(ms / 1000)`. */
  remainingMs: number
  totalElapsedMs: number
  totalRemainingMs: number
  isComplete: boolean
}
