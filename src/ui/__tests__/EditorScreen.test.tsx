/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/** A step that runs as its own countdown, so it gets an image button. */
const timed = (): Workout => ({
  id: 'w2',
  name: 'Tabata',
  blocks: [{ kind: 'segment', id: 's1', name: 'Squats', role: 'work', durationMs: 20_000 }],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

/**
 * Installs a clipboard, then opens the image chooser and waits for its probe.
 *
 * `permission` of null means the browser does not know the `clipboard-read`
 * descriptor and throws when asked — Safari and Firefox.
 */
async function openChooser(options: {
  read?: () => Promise<unknown[]>
  permission?: PermissionState | null
}) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: options.read ? { read: vi.fn(options.read) } : {},
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(async () => {
        if (options.permission == null) throw new TypeError('unknown descriptor')
        return { state: options.permission }
      }),
    },
  })

  render(<EditorScreen {...props(timed())} />)
  fireEvent.click(screen.getByLabelText('Add an image to Squats'))
  const label = await screen.findByText('Paste from clipboard')
  // The probe settles a tick later, so every caller waits on the state it wants.
  return label.closest('button') as HTMLButtonElement
}

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

  afterEach(() => {
    // @ts-expect-error jsdom ships neither, so the stubs come off entirely.
    delete navigator.clipboard
    // @ts-expect-error as above.
    delete navigator.permissions
  })

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

  it('offers Paste from clipboard, enabled, when the clipboard holds an image', async () => {
    const button = await openChooser({
      permission: 'granted',
      read: async () => [{ types: ['image/png'], getType: async () => new Blob() }],
    })
    await waitFor(() => expect(button.disabled).toBe(false))
    expect(button.title).toBe('Use the image on the clipboard')
  })

  it('disables Paste when the clipboard is known to hold no image', async () => {
    const button = await openChooser({
      permission: 'granted',
      read: async () => [{ types: ['text/plain'], getType: async () => new Blob() }],
    })
    await waitFor(() => expect(button.disabled).toBe(true))
    expect(button.title).toBe('There is no image on the clipboard')
  })

  it('leaves Paste enabled where the clipboard cannot be read without a tap', async () => {
    // Safari and iOS. A permanently grey button on the device the app is used on
    // would be worse than an occasional "nothing there" after the tap.
    const button = await openChooser({
      permission: null,
      read: async () => [{ types: ['image/png'], getType: async () => new Blob() }],
    })
    await waitFor(() => expect(button.title).toBe('Use the image on the clipboard'))
    expect(button.disabled).toBe(false)
  })

  it('disables Paste where the browser cannot read a clipboard at all', async () => {
    // An insecure origin has no navigator.clipboard, which is also where
    // crypto.subtle is missing, so uploads cannot work there either.
    const button = await openChooser({ permission: 'granted' })
    await waitFor(() => expect(button.disabled).toBe(true))
    expect(button.title).toBe('This browser cannot read the clipboard')
  })

  it('says so, and gives up the button, when a tapped Paste finds only text', async () => {
    const button = await openChooser({
      permission: null,
      read: async () => [{ types: ['text/plain'], getType: async () => new Blob() }],
    })
    fireEvent.click(button)

    expect(
      await screen.findByText('There is no image on the clipboard — copy one and try again'),
    ).toBeTruthy()
    // The chooser stays open behind the notice, and the button now knows better.
    expect(screen.getByText('Add an image')).toBeTruthy()
    await waitFor(() => expect(button.disabled).toBe(true))
  })

  it('reports a refused read differently, and keeps the button', async () => {
    const button = await openChooser({
      permission: null,
      read: async () => {
        throw new DOMException('Read permission denied', 'NotAllowedError')
      },
    })
    fireEvent.click(button)

    expect(await screen.findByText(/The clipboard could not be read/)).toBeTruthy()
    // A refusal is not evidence about the contents, so Paste stays available.
    expect(button.disabled).toBe(false)
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
