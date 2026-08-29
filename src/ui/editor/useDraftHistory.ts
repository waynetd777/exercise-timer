/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useState } from 'react'
import type { Block, Ladder, Repeat, RoutineColour, Section, Segment, Workout } from '../../engine'
import type { Path, Timing } from '../../editor/blocks'
import {
  isTypedPatch,
  setTiming,
  updateLadder,
  updateRepeat,
  updateSection,
  updateSegment,
} from '../../editor/blocks'
import { initHistory, push, redo, undo, type History } from '../../editor/history'

/** One undo step: name, colour and steps together, so they cannot drift apart. */
export type Draft = { name: string; blocks: Block[]; colour: RoutineColour | null }

/** The single field a group patch carries, for keying a run of keystrokes. */
function keyOf(patch: object): string {
  return Object.keys(patch).join(',')
}

/**
 * The draft and its undo history, with every way the editor writes to it.
 *
 * Name, steps and colour live in ONE history entry, so undo restores a
 * consistent draft rather than two states that can drift apart. `typing` names
 * the field a keystroke belongs to, so a run in one field collapses into a single
 * undo step; everything else is discrete and gets a step of its own: adding,
 * deleting, reordering, changing a step's type, choosing an image.
 */
export function useDraftHistory(workout: Workout): {
  history: History<Draft>
  setHistory: (next: (current: History<Draft>) => History<Draft>) => void
  edit: (next: (draft: Draft) => Draft, typing?: string | null) => void
  editBlocks: (op: (blocks: Block[]) => Block[], typing?: string | null) => void
  patchSegment: (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) => void
  patchRepeat: (path: Path, patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>) => void
  patchLadder: (path: Path, patch: Partial<Omit<Ladder, 'kind' | 'id' | 'children'>>) => void
  patchSection: (path: Path, patch: Partial<Omit<Section, 'kind' | 'id' | 'children'>>) => void
  patchTiming: (path: Path, timing: Timing, typed?: boolean) => void
} {
  const [history, setHistory] = useState(() =>
    initHistory<Draft>({
      name: workout.name,
      blocks: workout.blocks,
      colour: workout.colour ?? null,
    }),
  )

  const edit = (next: (draft: Draft) => Draft, typing: string | null = null) =>
    setHistory((current) => push(current, next(current.present), typing))

  const editBlocks = (op: (blocks: Block[]) => Block[], typing: string | null = null) =>
    edit((draft) => ({ ...draft, blocks: op(draft.blocks) }), typing)

  /**
   * Identifies the field being typed into.
   *
   * Per field, not per screen: with one shared flag, renaming a step and then
   * renaming the next one were a single undo step.
   */
  const typingIn = (path: Path, field: string) => `${path.join('.')}:${field}`

  /*
   * Only a keystroke-by-keystroke field coalesces. See `isTypedPatch`. Anything
   * else, an image above all, is one deliberate act and gets one undo step.
   */
  const patchSegment = (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) =>
    editBlocks(
      (current) => updateSegment(current, path, patch),
      isTypedPatch(patch) ? typingIn(path, 'name') : null,
    )
  /*
   * Every field on a group is typed straight into, so all three coalesce, keyed
   * on the field, so a label and a rep count do not share a step.
   */
  const patchRepeat = (path: Path, patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateRepeat(current, path, patch), typingIn(path, keyOf(patch)))
  const patchLadder = (path: Path, patch: Partial<Omit<Ladder, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateLadder(current, path, patch), typingIn(path, keyOf(patch)))
  const patchSection = (path: Path, patch: Partial<Omit<Section, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateSection(current, path, patch), typingIn(path, keyOf(patch)))
  /*
   * Switching a step between timed and counted is discrete, and undo should put
   * it back in one press rather than unwinding it through whatever typing came
   * before. TYPING the number is the other case: a run of keystrokes, which
   * collapses like any other, or "45" would cost two undos to take back.
   */
  const patchTiming = (path: Path, timing: Timing, typed = false) =>
    editBlocks(
      (current) => setTiming(current, path, timing),
      typed ? typingIn(path, 'timing') : null,
    )

  /*
   * Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. This deliberately overrides a text field's
   * native undo: the draft's history already covers typing (coalesced into one
   * step), so one undo stack for the whole editor is less surprising than two
   * that disagree.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      // Ctrl+Y is redo on Windows; Shift+Cmd/Ctrl+Z everywhere.
      const redoKey = key === 'y' && event.ctrlKey
      if (!(event.metaKey || event.ctrlKey) || !(key === 'z' || redoKey)) return
      // A modal on top owns the keyboard. Undoing the draft from behind the
      // image picker edits state the user cannot see, and steals the native
      // text undo from the picker's own search box.
      if (document.querySelector('dialog[open]')) return
      // A note, alternative or weight is committed on blur, so text still being
      // typed there is not in the history yet. Undoing the draft under it took
      // back the previous edit, deleting the very step being typed in. Leave
      // the browser's own undo to that field until it commits. Those fields
      // SAY they commit on blur; every other field's text is in the history as
      // it is typed. Telling them apart by value against defaultValue caught
      // the count fields too, since React does not keep defaultValue in step
      // on a focused number input, and Cmd+Z after typing a count went nowhere.
      const field = document.activeElement
      if (
        field instanceof HTMLInputElement &&
        field.dataset['commits'] === 'blur' &&
        field.value !== (field.dataset['committed'] ?? field.defaultValue)
      ) {
        return
      }
      event.preventDefault()
      setHistory(redoKey || event.shiftKey ? redo : undo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { history, setHistory, edit, editBlocks, patchSegment, patchRepeat, patchLadder, patchSection, patchTiming }
}
