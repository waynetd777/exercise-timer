/**
 * Core types for the interval-timer engine.
 *
 * Two models live here:
 *
 *  - The AUTHORING model (`Workout`, `Block`) — a recursive tree the user edits.
 *    `repeat` groups are the single primitive that expresses classic Tabata,
 *    named circuits, pyramids and nested sets.
 *
 *  - The RUNTIME model (`Timeline`, `TimelineEntry`) — a flat, absolute-time
 *    array produced once by `compile()`. Everything the runner does is a pure
 *    lookup against it, which is what makes seek/skip trivial and the whole
 *    engine testable with a fake clock.
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

export type Segment = {
  kind: 'segment'
  id: string
  name: string
  /** Milliseconds. Segments with a non-positive or non-finite duration are dropped by `compile()`. */
  durationMs: number
  role: SegmentRole
  media?: MediaRef
  note?: string
}

export type Repeat = {
  kind: 'repeat'
  id: string
  /** Shown as e.g. "Round 3 of 8" while running. */
  label?: string
  /** Iteration count. Floored; anything below 1 contributes nothing. */
  times: number
  children: Block[]
}

export type Block = Segment | Repeat

export const SCHEMA_VERSION = 1 as const

export type Workout = {
  id: string
  name: string
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

/** One level of repeat nesting above a timeline entry, for "Round 3 of 8" labels. */
export type PathStep = {
  repeatId: string
  label?: string
  /** 1-based. */
  iteration: number
  of: number
}

/**
 * A single step of a compiled workout, occupying the half-open interval
 * `[startMs, endMs)` of workout time.
 */
export type TimelineEntry = {
  /** Position in `Timeline.entries`. */
  index: number
  /** Id of the authoring `Segment` this came from; not unique across repeats. */
  segmentId: string
  name: string
  role: SegmentRole
  durationMs: number
  startMs: number
  endMs: number
  media?: MediaRef
  note?: string
  path: PathStep[]
}

export type Timeline = {
  entries: TimelineEntry[]
  totalMs: number
}

export type CueKind = 'phase-change' | 'countdown' | 'workout-complete'

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
