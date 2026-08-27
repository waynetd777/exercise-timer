/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { GenerateDialog } from '../GenerateDialog'

beforeAll(() => {
  // jsdom implements neither, and the dialog opens itself on mount.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
afterEach(cleanup)

const saved: Workout = {
  id: 'w1',
  name: 'Last week',
  blocks: [
    { kind: 'segment', id: 's1', name: '12 × Leg Press', role: 'work', durationMs: 20_000, load: '65kg' },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 10,
}

const open = (library: Workout[] = []) => {
  const onGenerate = vi.fn()
  render(<GenerateDialog library={library} onCancel={vi.fn()} onGenerate={onGenerate} />)
  return onGenerate
}

describe('GenerateDialog', () => {
  it('previews the routine before it is generated', () => {
    open()
    // The whole point of the live preview: you can see what you are about to get
    // while the answers can still be changed.
    expect(screen.getByText(/\d+ exercises · \d+:\d+/)).toBeTruthy()
  })

  it('hands the routine over rather than saving it', () => {
    const onGenerate = open()
    fireEvent.click(screen.getByRole('button', { name: /Open in editor/ }))
    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onGenerate.mock.calls[0]![0].blocks.length).toBeGreaterThan(0)
  })

  it('reacts to an answer, without rerolling the exercises', () => {
    open()
    const before = screen.getByText(/exercises ·/).textContent
    fireEvent.click(screen.getByRole('button', { name: '50 min' }))
    expect(screen.getByText(/exercises ·/).textContent).not.toBe(before)
  })

  it('rerolls only when asked to', () => {
    open()
    const before = screen.getByText(/exercises ·/).nextElementSibling?.textContent
    fireEvent.click(screen.getByRole('button', { name: 'Try another' }))
    expect(screen.getByText(/exercises ·/).nextElementSibling?.textContent).not.toBe(before)
  })

  it('asks for something to work before it will generate anything', () => {
    open()
    for (const label of ['Upper body', 'Torso', 'Lower body']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
    expect(screen.getByText('Pick at least one thing to work.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open in editor/ })).toHaveProperty('disabled', true)
  })

  it('shows what it had to do that was not asked for', () => {
    open()
    // The machine has five torso exercises, nowhere near an hour.
    fireEvent.click(screen.getByRole('button', { name: 'Upper body' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lower body' }))
    fireEvent.click(screen.getByRole('button', { name: '50 min' }))
    expect(screen.getByText(/Every exercise matching that choice was used/)).toBeTruthy()
  })

  it('hides all three cardio questions when there is no cardio', () => {
    // Resting between sets means no warm-up and no cool down either: that shape
    // comes from `beginner-full-body.routine.json`, which has neither.
    open()
    for (const q of ['Warm up with', 'Moving how', 'Cool down with']) {
      expect(screen.getByLabelText(q)).toBeTruthy()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Rest' }))
    for (const q of ['Warm up with', 'Moving how', 'Cool down with']) {
      expect(screen.queryByLabelText(q)).toBeNull()
    }
  })

  it('warms up and cools down with what it was told', () => {
    const onGenerate = open()
    fireEvent.change(screen.getByLabelText('Warm up with'), { target: { value: 'Trampoline' } })
    fireEvent.change(screen.getByLabelText('Cool down with'), { target: { value: 'Burpees' } })
    fireEvent.click(screen.getByRole('button', { name: /Open in editor/ }))

    const blocks = (onGenerate.mock.calls[0]![0] as Workout).blocks
    const names = blocks.filter((b) => b.kind === 'segment').map((b) => b.name)
    expect(names[1]).toBe('Warm Up: Trampoline')
    expect(names.at(-1)).toBe('Cool Down: Burpees')
  })

  it('offers a list to randomise from, all on, once Random is chosen', () => {
    open()
    expect(screen.queryByRole('button', { name: 'Burpees' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Moving how'), { target: { value: '[random]' } })
    const burpees = screen.getByRole('button', { name: 'Burpees' })
    expect(burpees.getAttribute('aria-pressed')).toBe('true')

    // Bounding it is the point: nobody wants a routine willing to put burpees
    // in every gap.
    fireEvent.click(burpees)
    expect(screen.getByRole('button', { name: 'Burpees' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('will not generate with nothing to move with', () => {
    open()
    fireEvent.change(screen.getByLabelText('Moving how'), { target: { value: '[random]' } })
    for (const chip of screen.getAllByRole('button')) {
      if (chip.getAttribute('aria-pressed') === 'true' && chip.textContent !== 'Upper body') {
        fireEvent.click(chip)
      }
    }
    expect(screen.getByText('Pick at least one thing to move with.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open in editor/ })).toHaveProperty('disabled', true)
  })

  it('loads an exercise from what was last used for it', () => {
    const onGenerate = open([saved])
    fireEvent.click(screen.getByRole('button', { name: 'Upper body' }))
    fireEvent.click(screen.getByRole('button', { name: 'Torso' }))
    fireEvent.click(screen.getByRole('button', { name: '50 min' }))
    fireEvent.click(screen.getByRole('button', { name: /Open in editor/ }))

    const workout = onGenerate.mock.calls[0]![0] as Workout
    const loads: string[] = []
    const walk = (blocks: readonly any[]) =>
      blocks.forEach((b) => (b.kind === 'segment' ? b.load && loads.push(b.load) : walk(b.children)))
    walk(workout.blocks)
    expect(loads).toContain('65kg')
  })
})
