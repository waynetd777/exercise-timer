/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Menu } from '../Menu'

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
