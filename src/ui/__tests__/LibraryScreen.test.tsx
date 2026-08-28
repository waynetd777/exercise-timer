/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import type { Library } from '../../storage/useLibrary'
import { LibraryScreen } from '../LibraryScreen'

const workout = (id: string, name: string, over: Partial<Workout> = {}): Workout => ({
  id,
  name,
  blocks: [{ kind: 'segment', id: `${id}-s`, name: 'Work', role: 'work', durationMs: 20_000 }],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

/** The hook's surface, with every write a spy that resolves. */
function library(workouts: Workout[], over: Partial<Library> = {}): Library {
  return {
    workouts,
    loading: false,
    error: null,
    add: vi.fn(async (w: Workout) => w),
    remove: vi.fn(async () => {}),
    duplicate: vi.fn(async () => {}),
    toggleFavourite: vi.fn(async () => {}),
    markRun: vi.fn(async () => {}),
    ...over,
  }
}

const props = (lib: Library) => ({
  library: lib,
  onRun: vi.fn(),
  onPreview: vi.fn(),
  onEdit: vi.fn(),
  onNew: vi.fn(),
  onDraft: vi.fn(),
  onSounds: vi.fn(),
  onExercises: vi.fn(),
})

afterEach(cleanup)

describe('LibraryScreen', () => {
  it('lists the routines, and Start opens one', () => {
    const p = props(library([workout('a', 'Legs'), workout('b', 'Core')]))
    render(<LibraryScreen {...p} />)

    expect(screen.getByText('Legs')).toBeTruthy()
    expect(screen.getByText('Core')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Start Legs'))
    expect(p.onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('Preview opens a routine without starting it, and reads before edit in the row', () => {
    const p = props(library([workout('a', 'Legs')]))
    render(<LibraryScreen {...p} />)

    fireEvent.click(screen.getByLabelText('Preview Legs'))
    expect(p.onPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    expect(p.onRun).not.toHaveBeenCalled()

    // Look, change, copy, send, destroy: the order the tools do more in.
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((l) => l && ['Preview Legs', 'Edit routine', 'Duplicate', 'Delete'].includes(l))
    expect(labels).toEqual(['Preview Legs', 'Edit routine', 'Duplicate', 'Delete'])
  })

  it('filters by name as you type', () => {
    render(<LibraryScreen {...props(library([workout('a', 'Legs'), workout('b', 'Core')]))} />)

    fireEvent.change(screen.getByLabelText('Search routines'), { target: { value: 'cor' } })

    expect(screen.queryByText('Legs')).toBeNull()
    expect(screen.getByText('Core')).toBeTruthy()
  })

  it('deletes in two steps, in the row, and Keep backs out', () => {
    const lib = library([workout('a', 'Legs')])
    render(<LibraryScreen {...props(lib)} />)

    fireEvent.click(screen.getByLabelText('Delete'))
    expect(screen.getByText('Delete?')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Keep'))
    expect(screen.queryByText('Delete?')).toBeNull()
    expect(lib.remove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Delete'))
    fireEvent.click(screen.getByLabelText('Delete Legs'))
    expect(lib.remove).toHaveBeenCalledWith('a')
  })

  it('stars a routine through the library, not by editing it', () => {
    const lib = library([workout('a', 'Legs')])
    render(<LibraryScreen {...props(lib)} />)

    fireEvent.click(screen.getByLabelText('Add to favourites'))
    expect(lib.toggleFavourite).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
  })

  it('shows what the library could not do, as an alert', () => {
    // A failed write or an unreadable record lands here; it used to vanish.
    render(
      <LibraryScreen
        {...props(library([workout('a', 'Legs')], { error: 'Could not save “Legs”: quota exceeded' }))}
      />,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/Could not save/)
  })

  it('explains itself when there is nothing yet', () => {
    render(<LibraryScreen {...props(library([]))} />)
    expect(screen.getByText(/Drop a \.tabata/)).toBeTruthy()
  })
})
