/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Exercise } from '../../routines/exercises'
import { ExerciseDialog } from '../ExerciseDialog'

const table: Exercise[] = [
  { name: 'Leg Press', area: 'lower', equipment: 'machine', station: 3 },
  { name: 'Bulgarian Split Squats', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Standard Chest Press', area: 'upper', pattern: 'push', equipment: 'machine' },
]

// jsdom has no dialog methods.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

const name = () => screen.getByLabelText('Exercise name') as HTMLInputElement

describe('adding an exercise of your own', () => {
  it('takes the typed name and the answers, and writes only what is not the default', () => {
    const onSave = vi.fn()
    render(
      <ExerciseDialog name="Sandbag Lunge" table={table} onSave={onSave} onClose={vi.fn()} />,
    )

    expect(name().value).toBe('Sandbag Lunge')
    fireEvent.click(screen.getByRole('button', { name: 'Kettlebell' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lower body' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    /*
     * `strength` and both sides together are what absent means in the shipped
     * table, so they are not written down: a record that spelled out every
     * default would answer differently from a shipped one that says nothing.
     */
    expect(onSave).toHaveBeenCalledWith(
      { name: 'Sandbag Lunge', area: 'lower', equipment: 'kettlebell' },
      null,
    )
  })

  it('asks about push or pull for the upper body only', () => {
    render(<ExerciseDialog name="Sandbag Lunge" table={table} onSave={vi.fn()} onClose={vi.fn()} />)

    // A squat has no direction to alternate, which is why the field is not there.
    expect(screen.queryByRole('button', { name: 'Push' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Upper body' }))
    expect(screen.getByRole('button', { name: 'Push' })).toBeTruthy()
  })

  it('keeps the pattern off a record whose area is not upper', () => {
    // Answered while the area was upper, then the area changed: the answer must
    // not survive as a field on a squat, since the generator reads it.
    const onSave = vi.fn()
    render(<ExerciseDialog name="Sandbag Lunge" table={table} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Upper body' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pull' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lower body' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSave.mock.calls[0]![0]).not.toHaveProperty('pattern')
  })

  it('records cardio and the side, which the generator reads', () => {
    const onSave = vi.fn()
    render(<ExerciseDialog name="Sled Drag" table={table} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cardio' }))
    fireEvent.click(screen.getByRole('button', { name: 'One at a time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSave.mock.calls[0]![0]).toMatchObject({ use: 'cardio', perSide: true })
  })
})

describe('the warning', () => {
  it('asks again when something similar is already here, and adds anyway on request', () => {
    const onSave = vi.fn()
    render(
      <ExerciseDialog
        name="Bugarian Split Squat"
        table={table}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    // Not saved yet: the first press is the question, not the answer.
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/Add “Bugarian Split Squat” anyway\?/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }))
    expect(onSave).toHaveBeenCalled()
  })

  it('offers the exercise you already have, as a button', () => {
    // The whole point of the warning: taking the one that exists has to be
    // cheaper than confirming the new one.
    const onUse = vi.fn()
    const onClose = vi.fn()
    render(
      <ExerciseDialog
        name="Bugarian Split Squat"
        table={table}
        onSave={vi.fn()}
        onUse={onUse}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: /Bulgarian Split Squats/ }))
    expect(onUse).toHaveBeenCalledWith('Bulgarian Split Squats')
    expect(onClose).toHaveBeenCalled()
  })

  it('goes back to the form, so a warning is not a dead end', () => {
    render(
      <ExerciseDialog name="Bugarian Split Squat" table={table} onSave={vi.fn()} onClose={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(name().value).toBe('Bugarian Split Squat')
  })

  it('does not ask twice about a name nothing resembles', () => {
    const onSave = vi.fn()
    render(<ExerciseDialog name="Ab Rollout" table={table} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onSave).toHaveBeenCalled()
  })
})

describe('a name the app already has', () => {
  it('refuses it rather than warning about it', () => {
    /*
     * A fold match is not a judgement call: the weights, paces and pictures
     * tables are keyed by exactly that string, so two rows would fight over one
     * weight and one picture. There is nothing to add, so Add is not offered.
     */
    render(<ExerciseDialog name="leg presses" table={table} onSave={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText(/“Leg Press” is already here/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lets you take it instead, where there is a step to take it onto', () => {
    const onUse = vi.fn()
    render(
      <ExerciseDialog
        name="leg presses"
        table={table}
        onSave={vi.fn()}
        onUse={onUse}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Leg Press' }))
    expect(onUse).toHaveBeenCalledWith('Leg Press')
  })

  it('will not save an empty name', () => {
    render(<ExerciseDialog name="   " table={table} onSave={vi.fn()} onClose={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('changing one of yours', () => {
  const mine = { name: 'Sandbag Lunge', area: 'lower' as const, equipment: 'kettlebell' as const }

  it('opens on what it already says', () => {
    render(
      <ExerciseDialog
        name=""
        editing={mine}
        table={[...table, mine]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(name().value).toBe('Sandbag Lunge')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('does not report that it clashes with itself', () => {
    render(
      <ExerciseDialog
        name=""
        editing={mine}
        table={[...table, mine]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText(/is already here/)).toBeNull()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('hands back the old name when the name changed, so the weight can follow it', () => {
    const onSave = vi.fn()
    render(
      <ExerciseDialog
        name=""
        editing={mine}
        table={[...table, mine]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(name(), { target: { value: 'Sandbag Step-up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sandbag Step-up' }), 'Sandbag Lunge')
  })

  it('says the warning is about a rename, not a second row', () => {
    // The confirm screen is shared with adding, where it says "Add anyway".
    // Here Save performs a rename, so "Add" would promise a row it will not make.
    const onSave = vi.fn()
    const squat = { name: 'Sandbag Squat', area: 'lower' as const, equipment: 'kettlebell' as const }
    render(
      <ExerciseDialog
        name=""
        editing={squat}
        table={[...table, squat]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(name(), { target: { value: 'Bugarian Split Squats' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText(/Rename to “Bugarian Split Squats” anyway\?/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rename anyway' }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bugarian Split Squats' }),
      'Sandbag Squat',
    )
  })

  it('saves an unchanged name without asking about the family it is in', () => {
    // Nothing new is being introduced, so there is nothing to warn about: the
    // exercise has been on the page since the day it was added.
    const onSave = vi.fn()
    const squat = { name: 'Sandbag Squat', area: 'lower' as const, equipment: 'kettlebell' as const }
    render(
      <ExerciseDialog
        name=""
        editing={squat}
        table={[...table, squat, { name: 'Goblet Squat', area: 'lower', equipment: 'kettlebell' }]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalled()
  })
})
