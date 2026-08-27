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

  it('opens on a different routine each time', () => {
    /*
     * The seed was a constant, so every first look was the same routine until
     * you pressed Try another. Six opens: identical output from all six would
     * mean the seed is fixed again.
     */
    const seen = new Set<string>()
    for (let i = 0; i < 6; i++) {
      open()
      seen.add(screen.getByText(/exercises ·/).nextElementSibling?.textContent ?? '')
      cleanup()
    }
    expect(seen.size).toBeGreaterThan(1)
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

  it('opens on the three lengths, and takes new ones', () => {
    const onGenerate = open()
    expect((screen.getByLabelText('Warm up with, seconds') as HTMLInputElement).value).toBe('600')
    expect((screen.getByLabelText('Moving how, seconds') as HTMLInputElement).value).toBe('60')
    expect((screen.getByLabelText('Cool down with, seconds') as HTMLInputElement).value).toBe('120')

    fireEvent.change(screen.getByLabelText('Warm up with, seconds'), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: /Open in editor/ }))

    const blocks = (onGenerate.mock.calls[0]![0] as Workout).blocks
    const warm = blocks[1]
    expect(warm?.kind === 'segment' && warm.durationMs).toBe(300_000)
  })

  it('still offers a length when resting, where there is no cardio to choose', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rest' }))
    expect(screen.queryByLabelText('Warm up with, seconds')).toBeNull()
    expect((screen.getByLabelText('Resting for, seconds') as HTMLInputElement).value).toBe('60')
  })

  it('writes down no weight that Settings can supply', () => {
    /*
     * The Leg Press has a weight on the settings page, so the generated routine
     * leaves the field EMPTY on purpose: an empty load reads Settings every time
     * the routine is opened, and stamping 65kg here would freeze it at what last
     * week's routine happened to say. Stamping from the library is still what
     * happens for an exercise Settings has never heard of; `generate.test.ts`
     * covers that, since it is the generator's rule rather than the dialog's.
     */
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
    expect(loads).not.toContain('65kg')

    // And the name does not carry it either, or the weight would be frozen in
    // a string no settings change could reach.
    const names: string[] = []
    const walkNames = (blocks: readonly any[]) =>
      blocks.forEach((b) => (b.kind === 'segment' ? names.push(b.name) : walkNames(b.children)))
    walkNames(workout.blocks)
    expect(names.some((n) => n.includes('65kg'))).toBe(false)
  })
})

describe('the name it suggests', () => {
  it('follows the answers, and changes as they do', () => {
    open()
    const field = () => screen.getByLabelText('Routine name') as HTMLInputElement
    expect(field().placeholder).toBe('Full-Body Circuit, 45 min')

    fireEvent.click(screen.getByRole('button', { name: 'Upper body' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lower body' }))
    expect(field().placeholder).toBe('Core Circuit, 45 min')

    fireEvent.click(screen.getByRole('button', { name: 'Sections' }))
    expect(field().placeholder).toMatch(/Core, \d sections/)
  })

  it('is what the routine is called when nothing is typed', () => {
    const onGenerate = open()
    fireEvent.click(screen.getByRole('button', { name: /Open in editor/ }))
    expect((onGenerate.mock.calls[0]![0] as Workout).name).toBe('Full-Body Circuit, 45 min')
  })
})

describe('the shape question', () => {
  const pick = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))

  it('asks for a length for a circuit and for sections otherwise', () => {
    /*
     * A circuit is timed throughout, so it can be asked how long. The
     * instructor's shape is mostly self-paced and cannot: it ends when you have
     * tapped through it, so what it can be asked is how many sections.
     */
    open()
    expect(screen.getByText('About how long')).toBeTruthy()
    expect(screen.queryByText('How many sections')).toBeNull()

    pick('Sections')
    expect(screen.queryByText('About how long')).toBeNull()
    expect(screen.getByText('How many sections')).toBeTruthy()
  })

  it('hides every question that belongs to the circuit alone', () => {
    open()
    pick('Sections')
    for (const gone of ['Between sets', 'Sets', 'Warm up with', 'Moving how', 'Cool down with']) {
      expect(screen.queryByText(gone)).toBeNull()
    }
    // What is left is what applies to both.
    expect(screen.getByText('What to work')).toBeTruthy()
    expect(screen.getByText('Equipment')).toBeTruthy()
  })

  it('previews sections rather than a length it cannot know', () => {
    open()
    pick('Sections')
    expect(screen.getByText(/exercises · \d+ sections/)).toBeTruthy()
    expect(screen.queryByText(/exercises · \d+:\d+/)).toBeNull()
  })

  it('warns that the length is unknowable', () => {
    open()
    pick('Sections')
    expect(screen.getByText(/no length/)).toBeTruthy()
  })

  it('hands over a routine of sections', () => {
    const onGenerate = open()
    pick('Sections')
    fireEvent.click(screen.getByRole('button', { name: /Open in editor/ }))

    const blocks = (onGenerate.mock.calls[0]![0] as Workout).blocks
    expect(blocks.every((b) => b.kind === 'section')).toBe(true)
    expect(blocks[0]!.kind === 'section' && blocks[0]!.name).toBe('Warm-up')
  })
})
