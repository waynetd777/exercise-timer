/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import type { Library } from '../../storage/useLibrary'

const legs: Workout = {
  id: 'a',
  name: 'Legs',
  blocks: [{ kind: 'segment', id: 's', name: 'Squats', role: 'work', durationMs: 20_000 }],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
}

/** Storage is not under test here; the hook is replaced with a still library. */
const stub: Library = {
  workouts: [legs],
  loading: false,
  error: null,
  add: vi.fn(async (w: Workout) => w),
  remove: vi.fn(async () => {}),
  duplicate: vi.fn(async () => {}),
  toggleFavourite: vi.fn(async () => {}),
  markRun: vi.fn(async () => {}),
}
vi.mock('../../storage/useLibrary', () => ({ useLibrary: () => stub }))

import { App } from '../App'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('opens on the library', () => {
    render(<App />)
    expect(screen.getByLabelText('Search routines')).toBeTruthy()
    expect(screen.getByText('Legs')).toBeTruthy()
  })

  it('keeps one history entry while a screen is open, so Back returns to the library', () => {
    /*
     * The browser's Back used to leave the page. One entry is pushed on the way
     * into the editor; popstate asks the editor to leave, and once it has, the
     * entry is taken back so the stack is level again.
     */
    const pushed = vi.spyOn(history, 'pushState')
    const back = vi.spyOn(history, 'back').mockImplementation(() => {})
    render(<App />)

    fireEvent.click(screen.getByLabelText('Edit routine'))
    expect(screen.getByLabelText('Routine name')).toBeTruthy()
    expect(pushed).toHaveBeenCalledTimes(1)

    // The hardware Back. The draft is clean, so the editor leaves at once.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getByLabelText('Search routines')).toBeTruthy()
    expect(back).toHaveBeenCalledTimes(1)
  })
})
