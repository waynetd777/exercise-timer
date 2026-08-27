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

  it('hides the cardio question when there is no cardio', () => {
    open()
    expect(screen.getByLabelText('Active recovery')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rest' }))
    expect(screen.queryByLabelText('Active recovery')).toBeNull()
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
