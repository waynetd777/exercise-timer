/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Exercise } from '../../routines/exercises'
import { collectExercises } from '../../routines/exerciseOptions'
import { ExerciseField } from '../editor/ExerciseField'

const ex = (name: string, extra: Partial<Exercise> = {}): Exercise => ({
  name,
  area: 'lower',
  equipment: 'machine',
  ...extra,
})

const options = collectExercises([
  ex('Leg Press', { station: 3, media: 'exercises/Leg-Press.jpg' }),
  ex('Seated Leg Extension', { station: 4 }),
  ex('Seated Abdominal Crunch', { station: 5 }),
  ex('Glute Kickback', { station: 7, perSide: true }),
  ex('Cycling', { equipment: 'bike', use: 'cardio', media: 'exercises/Cycling.jpg' }),
  ex('Ski Jumps', { equipment: 'trampoline' }),
])

/**
 * The field, with the state a row would hold for it.
 *
 * Stateful, because the editor is: `onType` patches the step and the new name
 * comes back down as a prop. A fixed `value` would also make `fireEvent.change`
 * a no-op wherever the text it types is the text already there, since React
 * drops a change that does not change the value.
 */
function Field({
  start = '',
  onPick = vi.fn(),
}: {
  start?: string
  onPick?: (o: unknown) => void
}) {
  const [value, setValue] = useState(start)
  return <ExerciseField value={value} options={options} onType={setValue} onPick={onPick} />
}

const field = () => screen.getByLabelText('Step name')
/** Types, one whole value at a time, as the editor's patch-per-keystroke does. */
const type = (text: string) => fireEvent.change(field(), { target: { value: text } })
/** The exercise names on offer, in order. The hint is asserted separately. */
const names = () =>
  screen
    .queryAllByRole('option')
    .map((row) => row.querySelector('.ename__label')?.textContent ?? '')

describe('the exercise name field', () => {
  afterEach(cleanup)

  it('is a text field with nothing open until asked', () => {
    render(<Field start="Warm Up" />)

    expect((field() as HTMLInputElement).value).toBe('Warm Up')
    expect(field().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('opens the whole table from the caret, grouped by kit, on an empty step', () => {
    render(<Field />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    expect(names().length).toBe(6)
    expect(screen.getByText('Multi-gym')).toBeTruthy()
    expect(screen.getByText('Trampoline')).toBeTruthy()
  })

  it('filters to the exercise the step already names, and ticks it', () => {
    // The caret on a filled row answers "which one is this", not "what else is
    // there": the list is filtered to it, highlighted, and carries the tick.
    render(<Field start="Leg Press" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    expect(names()).toEqual(['Leg Press'])
    const row = screen.getByRole('option', { name: /^Leg Press/ })
    expect(row.dataset.active).toBe('true')
    expect(row.getAttribute('aria-current')).toBe('true')
    expect(row.querySelector('.ename__tick')).toBeTruthy()
  })

  it('shows the whole table where the step is named something the table has not', () => {
    /*
     * "Warm Up", or a course leg the paste parser wrote. Filtering on it would
     * open the caret onto an empty box, so an opening nobody has typed into
     * falls back to everything.
     */
    render(<Field start="Warm Up" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    expect(names().length).toBe(6)
    expect(screen.queryByText(/Typing your own is fine/)).toBeNull()
  })

  it('ticks what the field SAYS, not what the cursor is on', () => {
    /*
     * The two coincide when the list opens and part company as soon as the name
     * is edited: the editor patches the step on every keystroke, so a field
     * reading "Cycl" is a step that is no longer on Cycling, and nothing should
     * claim otherwise. The row is still offered; it just is not ticked.
     */
    render(<Field start="Cycling" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))
    expect(screen.getByRole('option', { name: /^Cycling/ }).getAttribute('aria-current')).toBe(
      'true',
    )

    type('Cycl')

    const row = screen.getByRole('option', { name: /^Cycling/ })
    expect(row.getAttribute('aria-current')).toBeNull()
    expect(row.dataset.active).toBe('true')
  })

  it('filters to what has been typed, and ranks the closest first', () => {
    render(<Field />)

    type('leg')

    expect(names()).toEqual(['Leg Press', 'Seated Leg Extension'])
    // No headings in a filtered list, so the row says the kit itself.
    expect(screen.getByRole('option', { name: /Leg Press/ }).textContent).toContain('Multi-gym')
  })

  it('shows the thumbnail the guide draws, and a tile where it draws none', () => {
    render(<Field />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    // Two of the five are illustrated; the other three keep their column.
    const shown = screen.getAllByRole('option')
    const sources = shown.map((row) => row.querySelector('img')?.getAttribute('src') ?? null)
    expect(sources).toEqual([
      '/exercises/Leg-Press.jpg',
      null,
      null,
      null,
      '/exercises/Cycling.jpg',
      null,
    ])
  })

  it('picks with the pointer', () => {
    const onPick = vi.fn()
    render(<Field onPick={onPick} />)

    type('kick')
    // `mousedown`, not `click`: the field blurs first otherwise and the list is
    // gone before the tap lands.
    fireEvent.mouseDown(screen.getByRole('option', { name: /Glute Kickback/ }))

    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Glute Kickback', perSide: true }),
    )
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('walks the list with the arrow keys and picks with Enter', () => {
    const onPick = vi.fn()
    render(<Field onPick={onPick} />)

    // Closed, the down arrow opens the table: the keyboard's caret press.
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeTruthy()

    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Seated Leg Extension' }))
  })

  it('wraps at both ends, so the list has no dead press', () => {
    const onPick = vi.fn()
    render(<Field onPick={onPick} />)

    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    fireEvent.keyDown(field(), { key: 'ArrowUp' })
    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ski Jumps' }))
  })

  it('opens on the exercise the step already names, not at the top of the list', () => {
    /*
     * Pressing the caret beside "Cycling" and being shown Leg Press, highlighted,
     * is the list answering a question nobody asked. The active row is scrolled
     * into view by the effect, so the exercise you have is what you land on.
     */
    render(<Field start="Cycling" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    const active = screen.getAllByRole('option').find((row) => row.dataset.active === 'true')
    expect(active?.querySelector('.ename__label')?.textContent).toBe('Cycling')
  })

  it('finds it through the instructor\'s own spelling', () => {
    // The routines are full of shorthand; the table is not.
    render(<Field start="12 × Seated Ab Crunch" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    const active = screen.getAllByRole('option').find((row) => row.dataset.active === 'true')
    expect(active?.querySelector('.ename__label')?.textContent).toBe('Seated Abdominal Crunch')
  })

  it('opens on the exercise inside a name that says more than the exercise', () => {
    /*
     * The third pass of `indexOfName`. A name read "12 × Seated Abdominal Crunch
     * 15kg" before the count and the weight became fields, and the paste parser
     * still writes a course leg as "Walking lunge 5m A-B". Both name an exercise
     * with the routine's own words around it; the ranked search finds it.
     */
    render(<Field start="12 × Seated Abdominal Crunch 15kg" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    const active = screen.getAllByRole('option').find((row) => row.dataset.active === 'true')
    expect(active?.querySelector('.ename__label')?.textContent).toBe('Seated Abdominal Crunch')
  })

  it('lands on the first row for a name no table holds', () => {
    render(<Field start="Warm Up" />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))

    expect(screen.getAllByRole('option')[0]?.dataset.active).toBe('true')
  })

  it('stays open while the list itself is scrolled', () => {
    /*
     * The close-on-scroll listener is on the capture phase, because a scroll
     * event does not bubble. That means it sees the LIST scrolling too, and the
     * first drag through 147 exercises shut the thing.
     */
    render(<Field />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))
    fireEvent.scroll(screen.getByRole('listbox'))

    expect(screen.queryByRole('listbox')).toBeTruthy()
  })

  it('closes when the page behind it scrolls', () => {
    // Its coordinates are the viewport's, so a page scroll leaves it pointing at
    // nothing. That is the case the listener is there for.
    render(<Field />)

    fireEvent.click(screen.getByLabelText('Choose an exercise'))
    fireEvent.scroll(document.body)

    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('points aria-activedescendant at the row the arrows are on', () => {
    // The row is highlighted from the same index, so what a screen reader
    // announces and what looks selected cannot disagree.
    render(<Field />)

    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    const active = field().getAttribute('aria-activedescendant')

    expect(active).toBeTruthy()
    expect(document.getElementById(active!)?.getAttribute('aria-selected')).toBe('true')
  })

  it('closes on Escape and on Tab, leaving the typed name alone', () => {
    render(<Field start="Warm" />)

    type('Warm')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(screen.getByLabelText('Choose an exercise'))
    fireEvent.keyDown(field(), { key: 'Tab' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect((field() as HTMLInputElement).value).toBe('Warm')
  })

  it('says a name of its own is fine rather than treating it as an error', () => {
    // "Warm Up" and "Cool Down" are in the library and in no table.
    render(<Field start="Warm Up" />)

    type('Warm Up!')

    expect(screen.queryAllByRole('option').length).toBe(0)
    expect(screen.getByText(/Typing your own is fine/)).toBeTruthy()
  })

  it('never picks anything by itself', () => {
    // Enter on a closed field belongs to whatever else is listening for it, and
    // typing a name that matches nothing must not silently choose a neighbour.
    const onPick = vi.fn()
    render(<Field start="Warm Up" onPick={onPick} />)

    fireEvent.keyDown(field(), { key: 'Enter' })
    type('Warm Up!')
    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(onPick).not.toHaveBeenCalled()
  })
})
