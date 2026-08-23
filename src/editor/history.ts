/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Undo/redo as pure data.
 *
 * The interesting rule is COALESCING. Every keystroke in a text field produces a
 * new state, and undoing a rename one character at a time is useless, so a run
 * of keystrokes collapses into a single step. The caller says which FIELD it is
 * typing into; that keeps the decision where the context is, and keeps this
 * module free of timers.
 *
 * A field rather than a flag, because a flag collapses too much: with one shared
 * "this was text" bit, renaming the routine and then renaming a step became a
 * single undo step, and every non-typing edit that rode the same path, choosing an
 * image above all, was absorbed into whatever typing came before it.
 */
export type History<T> = {
  past: readonly T[]
  present: T
  future: readonly T[]
  /**
   * The field the last push was typing into, or null when it was a discrete edit.
   * Only a push naming the SAME field may replace the present.
   */
  typing: string | null
}

/** Bounds memory. Deep enough that no one reaches the end of it by hand. */
export const HISTORY_LIMIT = 60

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], typing: null }
}

/**
 * Adds a state.
 *
 * `typing` names the field the keystroke belongs to, meaning anything stable and
 * unique to it. It is left out for a discrete edit, which always gets its own step.
 */
export function push<T>(history: History<T>, next: T, typing: string | null = null): History<T> {
  // A continuing run of keystrokes in the same field replaces the present rather
  // than stacking. A different field starts a new step, even mid-sentence.
  if (typing !== null && typing === history.typing) {
    return { ...history, present: next, future: [] }
  }

  const past = [...history.past, history.present]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: next,
    future: [],
    typing,
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
    // Undoing ends any run, so the next keystroke starts a fresh step.
    typing: null,
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0]!,
    future: history.future.slice(1),
    typing: null,
  }
}
