// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { EditorScreen } from '../EditorScreen'

const sectioned = (): Workout => ({
  id: 'w1',
  name: 'Strength day',
  blocks: [
    {
      kind: 'section',
      id: 'sec1',
      name: 'Arms',
      display: 'list',
      children: [
        { kind: 'segment', id: 's1', name: 'Curls', role: 'work', reps: { kind: 'fixed', count: 10 } },
      ],
    },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

const props = (workout: Workout) => ({
  workout,
  knownImages: [],
  onSave: vi.fn(),
  onCancel: vi.fn(),
})

describe('EditorScreen', () => {
  beforeAll(() => {
    // jsdom does not implement the dialog methods; the open attribute is all
    // the code under test observes.
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })

  afterEach(cleanup)

  it('leaves without a prompt when nothing changed, sections included', () => {
    // A routine holding a section used to read as permanently dirty, prompting
    // "Discard your changes?" on every untouched exit.
    const p = props(sectioned())
    render(<EditorScreen {...p} />)

    fireEvent.click(screen.getByLabelText('Back to routines'))
    expect(screen.queryByText('Discard your changes?')).toBeNull()
    expect(p.onCancel).toHaveBeenCalledTimes(1)
  })

  it('treats an edited rep count as a change worth confirming', () => {
    // Rep edits were invisible to dirty tracking, so Back discarded them
    // silently.
    const p = props(sectioned())
    render(<EditorScreen {...p} />)

    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '12' } })
    fireEvent.click(screen.getByLabelText('Back to routines'))

    expect(screen.getByText('Discard your changes?')).toBeTruthy()
    expect(p.onCancel).not.toHaveBeenCalled()
  })

  it('undoes with Cmd+Z, except while a modal owns the keyboard', () => {
    const p = props(sectioned())
    render(<EditorScreen {...p} />)
    const name = screen.getByLabelText('Routine name') as HTMLInputElement

    fireEvent.change(name, { target: { value: 'Renamed' } })
    expect(name.value).toBe('Renamed')

    // With the help dialog on top, undo must not edit the draft behind it.
    fireEvent.click(screen.getByLabelText('Help'))
    expect(document.querySelector('dialog[open]')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(name.value).toBe('Renamed')

    document.querySelector('dialog[open]')?.removeAttribute('open')
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(name.value).toBe('Strength day')
  })

  it('clamps a typed rep count to the field cap on commit', () => {
    const p = props(sectioned())
    render(<EditorScreen {...p} />)
    const reps = screen.getByLabelText('Reps') as HTMLInputElement

    // The max attribute only guards the spinners; typing sailed past it.
    fireEvent.change(reps, { target: { value: '999999' } })
    fireEvent.blur(reps)
    expect(reps.value).toBe('999')
  })

  it('does not commit anything while the field is cleared for retyping', () => {
    const p = props(sectioned())
    render(<EditorScreen {...p} />)
    const reps = screen.getByLabelText('Reps') as HTMLInputElement

    // Clearing used to commit Math.max(1, Number('')) and snap the value to 1
    // under the cursor.
    fireEvent.change(reps, { target: { value: '' } })
    expect(reps.value).toBe('')
    fireEvent.change(reps, { target: { value: '15' } })
    fireEvent.blur(reps)
    expect(reps.value).toBe('15')

    fireEvent.click(screen.getByLabelText('Back to routines'))
    expect(screen.getByText('Discard your changes?')).toBeTruthy()
  })
})
