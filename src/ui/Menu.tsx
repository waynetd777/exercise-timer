/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { CheckIcon, DownIcon } from './icons'
import { useDismiss } from './useDismiss'

type MenuItem = {
  label: string
  icon?: ReactNode
  disabled?: boolean
  title?: string
  /** Marks the active choice, for a menu that picks rather than acts. */
  selected?: boolean
  onSelect: () => void
}

type Placement = { top: number; left: number; maxHeight: number }

/** Clear of the trigger, and clear of the edge of the screen. */
const GAP = 8
const MARGIN = 8

/**
 * Where the list goes, given the trigger and the size the list wants.
 *
 * Two rules, both about not running off the screen:
 *
 *  - BELOW the trigger where it fits, otherwise ABOVE. If it fits neither, the
 *    roomier side wins and the list scrolls inside `maxHeight`, which beats
 *    hanging off the bottom with the last item unreachable.
 *  - Left edge aligned with the trigger's, UNLESS that would overrun the right
 *    edge of the screen, in which case the RIGHT edges align and the list opens
 *    leftwards instead. A menu on a row of buttons sits hard against the right
 *    edge, so that is the case that matters; a header chip has room and is
 *    unaffected.
 *
 * Pure, and exported, because the arithmetic is the whole behaviour and jsdom
 * lays nothing out.
 */
export function place(
  anchor: { top: number; bottom: number; left: number; right: number },
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): Placement {
  const roomBelow = viewportHeight - anchor.bottom - GAP - MARGIN
  const roomAbove = anchor.top - GAP - MARGIN
  const below = height <= roomBelow || roomBelow >= roomAbove

  const maxHeight = Math.max(0, below ? roomBelow : roomAbove)
  const top = below
    ? anchor.bottom + GAP
    : Math.max(MARGIN, anchor.top - GAP - Math.min(height, maxHeight))

  const left =
    anchor.left + width <= viewportWidth - MARGIN
      ? Math.max(MARGIN, anchor.left)
      : Math.max(MARGIN, anchor.right - width)

  return { top, left, maxHeight }
}

/**
 * A button that opens a short list of actions.
 *
 * Hand-rolled rather than using the Popover API: a popover lives in the top
 * layer, where positioning it under its own trigger still needs CSS anchor
 * positioning, which is not dependable enough yet. This is a handful of lines
 * and behaves the same everywhere.
 *
 * Closes on selection, on Escape, and on a pointer down outside. `pointerdown`
 * rather than `click`, so it closes on the press instead of waiting for the
 * release.
 */
export function Menu({
  label,
  icon,
  items,
  className = 'chip chip--action',
  hint,
}: {
  /** Empty for an icon-only trigger, which then needs a `hint` to name it. */
  label: string
  icon?: ReactNode
  items: readonly MenuItem[]
  /** So the same menu can be a header chip or one more button on a row. */
  className?: string
  /** The accessible name and tooltip, where the label is not one. */
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<Placement | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()

  /*
   * Placed after the list exists, in a LAYOUT effect so it lands before the
   * browser paints and never appears in the wrong place first.
   *
   * Measured rather than assumed. The width used to be the hardcoded 208 that
   * matches `width: 13rem` in the stylesheet, which is only true while the root
   * font size is 16px, and the height was never considered at all.
   *
   * `at` is cleared on close, and the list is hidden until it is set, so the one
   * render where the size is not yet known cannot flash.
   */
  useLayoutEffect(() => {
    if (!open) {
      setAt(null)
      return
    }
    const anchor = trigger.current?.getBoundingClientRect()
    const box = list.current?.getBoundingClientRect()
    if (!anchor || !box) return
    setAt(place(anchor, box.width, box.height, window.innerWidth, window.innerHeight))
  }, [open])

  /*
   * The list is placed in viewport coordinates, so a scroll or a resize leaves it
   * pointing at nothing. That is this menu's own problem, since a popover
   * positioned inside the thing it belongs to travels with it. So it stays here
   * rather than
   * going into `useDismiss`.
   */
  useEffect(() => {
    if (!open) return
    const onMove = () => setOpen(false)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  // Both the trigger's wrapper and the list count as inside; the list is not a
  // descendant of the wrapper, so it has to be found by id.
  useDismiss(
    open,
    () => setOpen(false),
    (target) =>
      wrapper.current?.contains(target) === true ||
      document.getElementById(id)?.contains(target) === true,
  )

  return (
    <div className="menu" ref={wrapper}>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-label={hint ?? undefined}
        title={hint ?? undefined}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        {label}
        {/* An icon-only trigger has no room for a caret and does not need one:
            it sits in a row of buttons that all open something. */}
        {label !== '' && (
          <span className="menu__caret" aria-hidden="true">
            <DownIcon />
          </span>
        )}
      </button>

      {/*
        On the BODY, not here.

        `position: fixed` is resolved against the viewport only while no ancestor
        has a transform, a filter or containment. `.library__scroll` carries
        `transform: translateY(--pull)` for pull-to-refresh, unconditionally, and
        a `translateY(0)` is enough: it makes that element the containing block,
        so a menu opened from a library ROW was placed against the scrolled list
        and appeared far below its button. The header menus never showed it,
        because they sit outside the scroller.

        A portal makes the rule hold wherever the trigger happens to live, rather
        than making every future ancestor watch what it does with transforms.
      */}
      {open &&
        createPortal(
          <div
            ref={list}
            className="menu__list"
            id={id}
            role="menu"
            style={{
              top: at ? `${at.top}px` : '0',
              left: at ? `${at.left}px` : '0',
              maxHeight: at ? `${at.maxHeight}px` : undefined,
              // The one render before it has been measured. Hidden rather than
              // unmounted, because measuring it is the whole point of that render.
              visibility: at ? undefined : 'hidden',
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="menu__item"
                disabled={item.disabled ?? false}
                title={item.title ?? item.label}
                aria-checked={item.selected}
                data-selected={item.selected ?? false}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.icon}
                {item.label}
                {item.selected && (
                  <span className="menu__tick" aria-hidden="true">
                    <CheckIcon />
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
