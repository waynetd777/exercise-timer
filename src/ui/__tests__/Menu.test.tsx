/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Menu, place } from '../Menu'

afterEach(cleanup)

const items = [
  { label: 'Copy a share link', onSelect: vi.fn() },
  { label: 'Copy as text', onSelect: vi.fn() },
]

describe('Menu', () => {
  it('names a labelled trigger by its label, and shows a caret', () => {
    render(<Menu label="Routines" items={items} />)
    const trigger = screen.getByRole('button', { name: 'Routines' })
    expect(trigger.querySelector('.menu__caret')).not.toBeNull()
  })

  it('names an icon-only trigger by its hint, and drops the caret', () => {
    // A row of 42px buttons has no room for a caret, and every button in it
    // opens something, so its absence says nothing the row does not already.
    render(<Menu label="" hint="Send this routine" items={items} />)
    const trigger = screen.getByRole('button', { name: 'Send this routine' })
    expect(trigger.querySelector('.menu__caret')).toBeNull()
    expect(trigger.getAttribute('title')).toBe('Send this routine')
  })

  it('takes the class it is given, so it can be a row button', () => {
    render(<Menu label="" hint="Send" className="btn btn--ghost" items={items} />)
    expect(screen.getByRole('button', { name: 'Send' }).className).toBe('btn btn--ghost')
  })

  it('is a chip by default, so the header menus are unchanged', () => {
    render(<Menu label="Routines" items={items} />)
    expect(screen.getByRole('button', { name: 'Routines' }).className).toBe('chip chip--action')
  })

  it('opens, runs the item it is given, and closes', () => {
    const onSelect = vi.fn()
    render(<Menu label="" hint="Send" items={[{ label: 'Copy as text', onSelect }]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy as text' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })
})

describe('where the list is mounted', () => {
  it('goes on the body, not inside the trigger’s ancestors', () => {
    /*
     * The bug this pins. `.library__scroll` carries `transform: translateY(--pull)`
     * for pull-to-refresh, and any transform makes that element the containing
     * block for `position: fixed` children. A menu rendered in place was then
     * positioned against the SCROLLED list rather than the viewport, and opened
     * far below its button. jsdom computes no layout, so the only thing worth
     * asserting is the fix itself: the list is not in there at all.
     */
    const { container } = render(
      <div style={{ transform: 'translateY(0)' }}>
        <Menu label="" hint="Send" items={items} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    const list = document.querySelector('.menu__list')!
    expect(list.parentElement).toBe(document.body)
    expect(container.contains(list)).toBe(false)
  })

  it('takes the list away again on close', () => {
    render(<Menu label="" hint="Send" items={items} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(document.querySelector('.menu__list')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(document.querySelector('.menu__list')).toBeNull()
  })
})

describe('place', () => {
  const VW = 390
  const VH = 800
  const at = (over: Partial<{ top: number; bottom: number; left: number; right: number }>) => ({
    top: 100,
    bottom: 142,
    left: 20,
    right: 62,
    ...over,
  })

  it('opens below the trigger when there is room', () => {
    expect(place(at({}), 208, 180, VW, VH).top).toBe(150)
  })

  it('opens above when there is not room below', () => {
    // A row near the bottom of a long library. 180 tall, 8 clear of the trigger.
    const { top } = place(at({ top: 700, bottom: 742 }), 208, 180, VW, VH)
    expect(top).toBe(700 - 8 - 180)
  })

  it('takes the roomier side when it fits neither, and caps its height', () => {
    const { top, maxHeight } = place(at({ top: 300, bottom: 342 }), 208, 5_000, VW, VH)
    expect(top).toBe(350) // below: 800 - 342 = 458 of room, against 300 above
    expect(maxHeight).toBe(800 - 342 - 8 - 8)
  })

  it('aligns its left edge with the trigger where that fits', () => {
    // A header chip. Unchanged by any of this.
    expect(place(at({ left: 20, right: 100 }), 208, 180, VW, VH).left).toBe(20)
  })

  it('opens leftwards from a trigger against the right edge', () => {
    // The Send button on a library row: left-aligned it would reach 556 on a
    // 390-wide phone, so the RIGHT edges line up instead and it opens inwards.
    const { left } = place(at({ left: 348, right: 390 }), 208, 180, VW, VH)
    expect(left).toBe(390 - 208)
    expect(left + 208).toBeLessThanOrEqual(VW)
  })

  it('never starts off the left edge, however narrow the screen', () => {
    const { left } = place(at({ left: 4, right: 46 }), 208, 180, 200, VH)
    expect(left).toBe(8)
  })
})
