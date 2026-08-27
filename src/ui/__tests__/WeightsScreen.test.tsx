/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { loadWeights, saveWeights, weightFor } from '../../storage/weights'
import { WeightsScreen } from '../WeightsScreen'

const saved = (name: string, load: string): Workout => ({
  id: 'w1',
  name: 'Last week',
  blocks: [{ kind: 'segment', id: 's', name, role: 'work', durationMs: 20_000, load }],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

const field = (name: string) => screen.getByLabelText(`Weight for ${name}`) as HTMLInputElement

beforeEach(() => {
  globalThis.localStorage?.clear()
  saveWeights({})
})
afterEach(cleanup)

describe('WeightsScreen', () => {
  it('shows the weight in force, seeded or typed', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(field('Leg Press').value).toBe('65kg')
    // Not looked up, so it asks rather than guessing.
    expect(field('Toe Raise').value).toBe('')
  })

  it('writes a change straight through, so closing the page cannot lose it', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(field('Leg Press'), { target: { value: '70kg' } })

    expect(weightFor('Leg Press')).toBe('70kg')
    expect(loadWeights()).toEqual({ 'leg pres': '70kg' })
  })

  it('lets a seeded weight be emptied', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(field('Leg Press'), { target: { value: '' } })

    expect(field('Leg Press').value).toBe('')
    expect(weightFor('Leg Press')).toBe('')
  })

  it('offers what the saved routines already use, and fills it in', () => {
    /*
     * The Toe Raise has no looked-up weight, but a routine has been using
     * 15kg for it. That is better evidence than anything on a website.
     */
    render(<WeightsScreen workouts={[saved('Toe Raise', '15kg')]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(field('Toe Raise').placeholder).toBe('15kg')
    fireEvent.click(screen.getByRole('button', { name: /Fill 1 from my routines/ }))

    expect(field('Toe Raise').value).toBe('15kg')
    expect(screen.queryByRole('button', { name: /from my routines/ })).toBeNull()
  })

  it('does not offer to overwrite a weight that is already set', () => {
    // The Leg Press is seeded, so a routine saying 40kg is not an offer to make.
    render(<WeightsScreen workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /from my routines/ })).toBeNull()
    expect(field('Leg Press').value).toBe('65kg')
  })

  it('filters by name', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Search exercises'), { target: { value: 'pulldown' } })

    expect(field('Lat Pulldown')).toBeTruthy()
    expect(screen.queryByLabelText('Weight for Leg Press')).toBeNull()
  })

  it('leaves the bodyweight exercises out entirely', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByLabelText('Weight for Sit Ups')).toBeNull()
  })
})

describe('the pictures', () => {
  beforeAll(() => {
    // jsdom does not implement the dialog methods; the open attribute is all
    // the code under test observes.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  })

  it('shows a thumbnail for an exercise the guide illustrates', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    const thumb = screen.getByLabelText('Picture of Leg Press')
    expect(thumb.querySelector('img')?.getAttribute('src')).toContain('exercises/Leg-Press.jpg')
  })

  it('offers no picture where there is none to offer', () => {
    // A band exercise has no illustration in the guide, so the frame is empty
    // and there is nothing to press.
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByLabelText('Picture of Band Squats')).toBeNull()
  })

  it('opens it full size, and closes again', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Picture of Leg Press'))
    expect(screen.getByRole('img', { name: 'Leg Press' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('img', { name: 'Leg Press' })).toBeNull()
  })
})

describe('letting routines follow the page', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  })

  it('offers to clear the weights a routine states for itself', () => {
    /*
     * A routine written before this page carries its own weight on every step,
     * so it overrides the page and goes on saying 40kg after you have moved on.
     */
    const onFollow = vi.fn()
    render(
      <WeightsScreen workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Let 1 routine follow these/ }))
    expect(screen.getByText(/1 step in 1 routine state/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear 1' }))

    const rewritten = onFollow.mock.calls[0]![0] as Workout[]
    expect(rewritten).toHaveLength(1)
    expect((rewritten[0]!.blocks[0] as { load?: string }).load).toBeUndefined()
  })

  it('says nothing when every routine already follows', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /follow these/ })).toBeNull()
  })

  it('leaves a weight this page has no answer for', () => {
    // Nothing here knows what a Band Squat should be loaded to, so the routine
    // is the only record of it.
    const onFollow = vi.fn()
    render(
      <WeightsScreen workouts={[saved('Band Squats', 'red')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    expect(screen.queryByRole('button', { name: /follow these/ })).toBeNull()
  })

  it('takes a weight typed just now into account', () => {
    // Typing a weight for the Band Squats brings that routine into scope: the
    // page can answer for it now, so its own weight can go.
    render(
      <WeightsScreen workouts={[saved('Band Squats', 'red')]} onExit={vi.fn()} onFollow={vi.fn()} />,
    )

    fireEvent.change(field('Band Squats'), { target: { value: 'green' } })

    expect(screen.getByRole('button', { name: /Let 1 routine follow these/ })).toBeTruthy()
  })

  it('cancels without touching anything', () => {
    const onFollow = vi.fn()
    render(
      <WeightsScreen workouts={[saved('Leg Press', '40kg')]} onExit={vi.fn()} onFollow={onFollow} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Let 1 routine follow these/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onFollow).not.toHaveBeenCalled()
  })
})

describe('help', () => {
  it('opens a tray of its own, not the library’s', () => {
    render(<WeightsScreen workouts={[]} onExit={vi.fn()} onFollow={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Help'))

    // The rule an empty field carries is the one thing this page must explain.
    expect(screen.getByText(/How a routine uses it/)).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Weights' })).toBeTruthy()
  })
})
