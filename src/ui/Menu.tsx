/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckIcon, DownIcon } from './icons'
import { useDismiss } from './useDismiss'

export type MenuItem = {
  label: string
  icon?: ReactNode
  disabled?: boolean
  title?: string
  /** Marks the active choice, for a menu that picks rather than acts. */
  selected?: boolean
  onSelect: () => void
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
}: {
  label: string
  icon?: ReactNode
  items: readonly MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState({ top: 0, left: 0 })
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()

  /*
   * Positioned in viewport coordinates from the trigger's rect, because the
   * library shell sets `overflow: hidden` and an absolutely-positioned list
   * would simply be clipped at the header's edge.
   */
  const place = () => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const width = 208
    setAt({
      top: rect.bottom + 8,
      // Keep it on screen if the trigger sits near the right edge.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    })
  }

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
        className="chip chip--action"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          place()
          setOpen((current) => !current)
        }}
      >
        {icon}
        {label}
        <span className="menu__caret" aria-hidden="true">
          <DownIcon />
        </span>
      </button>

      {open && (
        <div
          className="menu__list"
          id={id}
          role="menu"
          style={{ top: `${at.top}px`, left: `${at.left}px` }}
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
        </div>
      )}
    </div>
  )
}
