/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MediaRef } from '../../engine'
import type { ExerciseOption } from '../../routines/exerciseOptions'
import { exerciseRows, indexOfName, optionsOf } from '../../routines/exerciseOptions'
import { CheckIcon, DownIcon } from '../icons'
import { place } from '../Menu'
import { useDismiss } from '../useDismiss'
import { useMediaUrl } from '../useMediaUrl'

/**
 * The tallest the list is allowed to be, in pixels.
 *
 * 147 exercises would otherwise fill a laptop screen with a dropdown, which
 * covers the routine you are editing to answer a question about one step of it.
 * Applied BEFORE `place()` as well as after, so the side it chooses and the
 * height it renders are decided from the same number.
 */
const MAX_LIST_PX = 384

/**
 * A work step's name: type it, or pick it off the exercise table.
 *
 * A TEXT FIELD that grows a list, never a select. Two of the names in Wayne's own
 * library, "Warm Up" and "Cool Down", are not exercises at all, and two more
 * are his own wording for one that is, so a closed list would lock out the cases
 * the field has to carry. Typing is unchanged: the same input, the same
 * `aria-label`, the same patch on every keystroke.
 *
 * What picking adds is the three things a typed name cannot bring with it: the
 * table's own spelling (which is what the weight hint and the pace estimate key
 * on), the illustration, and the per-side flag. See `applyExercise`.
 *
 * Only on WORK steps. The other roles have no table to draw on, and
 * `retypeSegment` already fills their names in; a list offering "Rest" over a
 * field that says "Rest" would be furniture.
 */
export function ExerciseField({
  value,
  options,
  onType,
  onPick,
}: {
  value: string
  options: readonly ExerciseOption[]
  /** A keystroke, patched straight through as the plain input always did. */
  onType: (name: string) => void
  onPick: (option: ExerciseOption) => void
}) {
  const [open, setOpen] = useState(false)
  /*
   * Whether a key has been pressed since this opening, which decides what an
   * EMPTY result means.
   *
   * The list always filters on what the field says, so the caret beside a step
   * that reads "Leg Press" opens on Leg Press, matched and highlighted. But a
   * step can be called something the table does not hold ("Warm Up", or a
   * course leg the paste parser wrote), and there the caret would open on
   * nothing at all. So an opening that has not been typed into falls back to the
   * whole table rather than to an empty box.
   *
   * Typing keeps the honest answer: "No exercise matches" is what you want after
   * a keystroke, not 147 exercises jumping back onto the screen.
   */
  const [typed, setTyped] = useState(false)
  /** Which option the arrow keys are on, as an index into `shown`. */
  const [active, setActive] = useState(0)
  const [at, setAt] = useState<{ top: number; left: number; maxHeight: number } | null>(null)

  const wrapper = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const listId = useId()
  const optionId = (index: number) => `${listId}-${index}`

  const rows = useMemo(() => (open ? listRows(options, value, !typed) : []), [open, options, value, typed])
  const shown = useMemo(() => optionsOf(rows), [rows])
  /** True while the list is showing everything, which is the only time it has headings. */
  const grouped = rows.some((row) => row.kind === 'group')
  /*
   * The exercise the step is ALREADY on, which is not the same question as which
   * row the arrow keys are on. They coincide the moment the list opens and part
   * company on the first press of Down, and the tick is the thing that still says
   * "this is the one you have" after that.
   */
  const current = value.trim().toLowerCase()

  /*
   * Placed after the list exists, in a LAYOUT effect so it lands before the
   * browser paints, and portalled to the body: `.editor__scroll` clips its
   * overflow and a suggestion list cut off at the bottom row is worthless. The
   * arithmetic is `Menu`'s, not a second copy of it.
   */
  useLayoutEffect(() => {
    if (!open) {
      setAt(null)
      return
    }
    const anchor = input.current?.getBoundingClientRect()
    const box = list.current?.getBoundingClientRect()
    if (!anchor || !box) return
    /*
     * `scrollHeight`, not the box's height: once a placement has applied its
     * `max-height` the box is that height, so re-measuring it would tell
     * `place()` the list fits below however long it really is, and the choice of
     * side would depend on which placement ran first. The scroll height is what
     * the list would be if nothing clamped it, which is the question `place()`
     * is actually asking.
     */
    const height = Math.min(list.current?.scrollHeight ?? box.height, MAX_LIST_PX)
    setAt(place(anchor, box.width, height, window.innerWidth, window.innerHeight))
    // `rows.length` as well as `open`: the list shrinks as you type, and a list
    // placed ABOVE the field has its top edge decided by its height.
  }, [open, rows.length])

  /*
   * Fixed coordinates go stale the moment the PAGE scrolls, so the list closes
   * rather than hanging over the wrong row. Same reason as `Menu`.
   *
   * But not when the scroll is the LIST's own. The listener is on the capture
   * phase because a scroll event does not bubble, which means it also sees the
   * list scrolling inside itself: 147 exercises, and the first drag through them
   * shut the thing. `Menu` never noticed because its lists are seven items long.
   */
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onScroll = (event: Event) => {
      if (list.current?.contains(event.target as Node) === true) return
      close()
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // The list is portalled, so it is not inside the wrapper and has to be found by
  // id. Escape is handled here too, which is what `useDismiss` gives us.
  useDismiss(
    open,
    () => setOpen(false),
    (target) =>
      wrapper.current?.contains(target) === true ||
      document.getElementById(listId)?.contains(target) === true,
  )

  /** Keeps the arrow-key selection inside the list as it scrolls past the edge. */
  useEffect(() => {
    if (!open) return
    const row = document.getElementById(optionId(active))
    // Feature-tested, not assumed: jsdom ships no layout and therefore no
    // `scrollIntoView`, and an effect that throws takes the whole list down.
    if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, rows.length])

  const choose = (option: ExerciseOption) => {
    setOpen(false)
    setTyped(false)
    onPick(option)
    // Focus stays in the field: picking is usually followed by editing the clock
    // beside it, and losing focus to the body would break the tab order back.
    input.current?.focus()
  }

  /*
   * Opening lands ON the exercise the step already names.
   *
   * The rows are worked out here rather than read off the memo, which has not
   * run yet: `open` is still false at this point. It is one pass over 147
   * strings, on a press.
   */
  const show = () => {
    const listed = optionsOf(listRows(options, value, true))
    setTyped(false)
    setActive(indexOfName(listed, value))
    setOpen(true)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      // Closed: the down arrow opens the whole table, which is the keyboard's
      // equivalent of pressing the caret.
      if (!open) return show()
      if (shown.length === 0) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      return setActive((current) => (current + delta + shown.length) % shown.length)
    }

    if (event.key === 'Enter' && open) {
      const option = shown[active]
      if (!option) return
      // Only when the list is open and has something under the cursor. Enter in
      // a closed field belongs to whatever else is listening for it.
      event.preventDefault()
      return choose(option)
    }

    // Escape is `useDismiss`'s; Tab leaves the field, and a list left hanging
    // over the next row would be pointing at the wrong step.
    if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div className="ename" ref={wrapper}>
      <input
        ref={input}
        className="efield efield--name"
        value={value}
        /* Unchanged, and load-bearing: the editor focuses a new row by this
           label, and `useDraftHistory` reads it to leave native undo alone. */
        aria-label="Step name"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
        autoComplete="off"
        onChange={(event) => {
          onType(event.target.value)
          // Typing always opens: the list appearing IS the signal that the field
          // has a table behind it. The top match is what Enter would take.
          setTyped(true)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />

      {/* Overlaid on the field's right-hand end rather than beside it, so the
          name keeps the full width of the row. Same trick as `.efield-clear`. */}
      <button
        type="button"
        className="ename__caret"
        aria-label="Choose an exercise"
        title="Choose an exercise"
        // The field, not the button, is the combobox: a screen reader announces
        // the state from there, and this is one more way to open it.
        tabIndex={-1}
        onClick={() => {
          if (open) return setOpen(false)
          show()
          input.current?.focus()
        }}
      >
        <DownIcon />
      </button>

      {open &&
        createPortal(
          <div
            ref={list}
            id={listId}
            className="ename__list"
            role="listbox"
            aria-label="Exercises"
            style={{
              top: at ? `${at.top}px` : '0',
              left: at ? `${at.left}px` : '0',
              maxHeight: at ? `${Math.min(at.maxHeight, MAX_LIST_PX)}px` : undefined,
              // The one render before it has been measured. Hidden, not
              // unmounted: measuring it is what that render is for.
              visibility: at ? undefined : 'hidden',
            }}
          >
            {shown.length === 0 ? (
              /*
               * A name of your own, which is a legitimate answer and not an
               * error: "Warm Up" is in the library and in no table. Said plainly,
               * with nothing to press.
               */
              <p className="ename__empty">
                No exercise matches “{value.trim()}”. Typing your own is fine.
              </p>
            ) : (
              (() => {
                // Runs alongside the rows so an option knows its index into
                // `shown` without searching for itself.
                let index = -1
                return rows.map((row) => {
                  if (row.kind === 'group') {
                    return (
                      <p
                        key={`group:${row.label}`}
                        className="ename__group"
                        role="presentation"
                      >
                        {row.label}
                      </p>
                    )
                  }
                  index += 1
                  const option = row.option
                  const mine = index
                  /* A grouped list puts the kit in the heading above; a
                     filtered one has no headings, so the row says it instead. */
                  const hint = [grouped ? '' : option.kit, option.hint]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <div
                      key={option.name}
                      id={optionId(mine)}
                      role="option"
                      aria-selected={mine === active}
                      /*
                       * Spelled out, because the accessible name computed from
                       * the row's own spans runs them together: "Glute
                       * KickbackStation 7 · each side". A space between the
                       * spans would be an anonymous fourth grid item and would
                       * shift the columns, so the label says it properly instead.
                       */
                      aria-label={hint === '' ? option.name : `${option.name}, ${hint}`}
                      className="ename__option"
                      data-active={mine === active || undefined}
                      /* Not `aria-selected`: that is the combobox's cursor, and
                         it is already on this row when the list opens. */
                      aria-current={option.name.toLowerCase() === current || undefined}
                      /* `mousedown`, not `click`: the field would blur first
                         otherwise, and on a touch screen the list would be gone
                         before the tap landed. `preventDefault` keeps the caret
                         in the input. */
                      onMouseDown={(event) => {
                        event.preventDefault()
                        choose(option)
                      }}
                      onMouseEnter={() => setActive(mine)}
                    >
                      <Thumb picture={option.picture} />
                      {/*
                        The name over the hint, in ONE column beside the picture.
                        Side by side they competed for the row: the hint does not
                        wrap, so it took what it needed and left the name a
                        column one character wide, printed straight down the page.
                        Stacked, the name gets the whole width and the hint is
                        the quiet second line it always read as.
                      */}
                      <span className="ename__text">
                        <span className="ename__label">{option.name}</span>
                        {hint !== '' && <span className="ename__hint">{hint}</span>}
                      </span>

                      {/* The step's own exercise, ticked. `aria-current` says it
                          to a reader; this says it to everyone else. */}
                      {option.name.toLowerCase() === current && (
                        <span className="ename__tick" aria-hidden="true">
                          <CheckIcon />
                        </span>
                      )}
                    </div>
                  )
                })
              })()
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

/**
 * The row's picture, resolved as a run resolves one: a bundled path is a URL at
 * once, an uploaded photo is read out of the blob store and lands a frame later.
 * Its own component so the hook runs per row, and so a photo chosen on the
 * exercises page shows here exactly as it will on the step.
 */
function Thumb({ picture }: { picture: MediaRef | undefined }) {
  const url = useMediaUrl(picture)
  return url ? (
    <img className="ename__thumb" src={url} alt="" loading="lazy" />
  ) : (
    /* An empty tile, so the names stay in one column whether the exercise has a
       picture or not. 105 of the 147 have none; a ragged left edge over that
       many rows is harder to read than a blank square. */
    <span className="ename__thumb ename__thumb--none" aria-hidden="true" />
  )
}

/**
 * The rows for what the field says. Where nothing matches and `wholeTable` is
 * allowed (nobody has typed; see `typed`), the whole list instead of an empty
 * box. The one place the rule lives: the memo and `show()` both read it, so the
 * list that opens is the list the caret is placed in.
 */
function listRows(options: readonly ExerciseOption[], value: string, wholeTable: boolean) {
  const filtered = exerciseRows(options, value)
  return filtered.length > 0 || !wholeTable ? filtered : exerciseRows(options, '')
}
