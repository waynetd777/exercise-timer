/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Whether the run screen's shortcuts should act on a key, given what has focus.
 *
 * Clicking a control leaves that control focused, so every keydown afterwards is
 * targeted at a `<button>`. The rule used to be "ignore the key if a button has
 * focus", which quietly broke the arrows: start a routine with the mouse and
 * skipping stopped working, while starting it with the spacebar left focus on the
 * body and everything worked. Two ways to begin, two different keyboards.
 *
 * What a focused control actually consumes is narrower than that:
 *
 * - A text field or a select takes every key. Typing must never trigger a
 *   shortcut, and a select's own arrow keys change its value.
 * - A button takes Space and Enter, which activate it. Those are left alone, so
 *   the press does one thing rather than the button's action AND play/pause.
 * - Nothing takes the arrows, `m` or `k`. They belong to the screen.
 *
 * Pure and here rather than inline in the component, because it is a rule with
 * three clauses and the failure mode is silence.
 */
const TAKES_EVERY_KEY = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/** Keys a focused button activates itself. */
const ACTIVATES_A_BUTTON = new Set([' ', 'Enter'])

export function shortcutApplies(tagName: string | undefined, key: string): boolean {
  if (tagName !== undefined && TAKES_EVERY_KEY.has(tagName)) return false
  if (tagName === 'BUTTON' && ACTIVATES_A_BUTTON.has(key)) return false
  return true
}
