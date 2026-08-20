/**
 * Undo/redo as pure data.
 *
 * The interesting rule is COALESCING. Every keystroke in a text field produces a
 * new state, and undoing a rename one character at a time is useless — so a run
 * of text edits collapses into a single step, and any structural change ends the
 * run. The caller says which kind of edit it is made; that keeps the decision
 * where the context is, and keeps this module free of timers.
 */
export type History<T> = {
  past: readonly T[]
  present: T
  future: readonly T[]
  /** True when the last push was coalescible, so the next one may replace it. */
  coalescing: boolean
}

/** Bounds memory. Deep enough that no one reaches the end of it by hand. */
export const HISTORY_LIMIT = 60

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], coalescing: false }
}

export function push<T>(history: History<T>, next: T, coalesce = false): History<T> {
  // A continuing run of text edits replaces the present rather than stacking.
  if (coalesce && history.coalescing) {
    return { ...history, present: next, future: [] }
  }

  const past = [...history.past, history.present]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    future: [],
    coalescing: coalesce,
  }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  const past = history.past.slice(0, -1)
  return {
    past,
    present: history.past[history.past.length - 1]!,
    future: [history.present, ...history.future],
    // Undoing ends any run, so the next text edit starts a fresh step.
    coalescing: false,
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0]!,
    future: history.future.slice(1),
    coalescing: false,
  }
}
