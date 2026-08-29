/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import { EditorScreen } from '../EditorScreen'
import { savePictures, withPicture } from '../../storage/pictures'

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
 * descriptor and throws when asked: Safari and Firefox.
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

/** A step still called what its type called it when it was added. */
const untouched = (): Workout => ({
  id: 'w3',
  name: 'Tabata',
  blocks: [{ kind: 'segment', id: 's1', name: 'Exercise', role: 'work', durationMs: 20_000 }],
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

  // The exercises page's table is localStorage, and a picture written by one
  // test would be inherited by every step named the same in the next.
  beforeEach(() => savePictures({}))

  afterEach(() => {
    // @ts-expect-error jsdom ships neither, so the stubs come off entirely.
    delete navigator.clipboard
    // @ts-expect-error as above.
    delete navigator.permissions
  })

  it('counts the self-paced steps in the header total', () => {
    /*
     * `totalDurationMs` alone reads 0s for a routine of counted reps, so the
     * editor used to say "0s total" however much you built. The header now adds
     * the estimate and hedges it, exactly as the library row does.
     */
    render(<EditorScreen {...props(sectioned())} />)

    expect(screen.getByText(/about \d+ min/)).toBeTruthy()
  })

  it('gives an exact total where every step is timed', () => {
    render(<EditorScreen {...props(timed())} />)

    expect(screen.getByText('20s')).toBeTruthy()
  })

  it('renames a step whose name is still the one its old type gave it', () => {
    // Switching an untouched Work to Rest left a step called "Exercise"
    // coloured and cued as a rest, to be renamed by hand every time.
    render(<EditorScreen {...props(untouched())} />)

    fireEvent.change(screen.getByLabelText('Type of step'), { target: { value: 'rest' } })

    expect((screen.getByLabelText('Step name') as HTMLInputElement).value).toBe('Rest')
  })

  it('leaves a name the user typed alone when the type changes', () => {
    // "Squats" is theirs, whatever the step becomes.
    render(<EditorScreen {...props(timed())} />)

    fireEvent.change(screen.getByLabelText('Type of step'), { target: { value: 'rest' } })

    expect((screen.getByLabelText('Step name') as HTMLInputElement).value).toBe('Squats')
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

  it('picks an exercise into a work step: name, picture and per side at once', () => {
    /*
     * The point of picking rather than typing. "Cable Bicep Curl" typed by hand
     * matches nothing in the weights table or the pace table; the table's own
     * spelling matches both, and brings the illustration with it.
     */
    render(<EditorScreen {...props(timed())} />)

    fireEvent.change(screen.getByLabelText('Step name'), { target: { value: 'kickback' } })
    // The table holds "Band Glute Kickbacks" too, so the row is chosen by its
    // exact name rather than by a substring of it.
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Glute Kickback,/ }))

    expect((screen.getByLabelText('Step name') as HTMLInputElement).value).toBe('Glute Kickback')
    // The step now has an image, so the row offers to preview rather than add one.
    expect(screen.getByLabelText(/Image for Glute Kickback/)).toBeTruthy()
  })

  it('is one undo step, whatever the pick changed', () => {
    // Three patches would be three history entries, and the middle one a step
    // named for the new exercise still wearing the old one's photo.
    render(<EditorScreen {...props(timed())} />)

    fireEvent.change(screen.getByLabelText('Step name'), { target: { value: 'kickback' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: /^Glute Kickback,/ }))
    fireEvent.click(screen.getByLabelText('Undo'))

    // Back to what typing left behind, with the picture gone with it.
    expect((screen.getByLabelText('Step name') as HTMLInputElement).value).toBe('kickback')
    expect(screen.queryByLabelText(/Image for/)).toBeNull()
  })

  it('leaves the other roles a plain text field', () => {
    // `retypeSegment` already names a rest "Rest"; a list offering that over a
    // field which says it would be furniture.
    render(<EditorScreen {...props(timed())} />)

    fireEvent.change(screen.getByLabelText('Type of step'), { target: { value: 'rest' } })

    expect(screen.queryByLabelText('Choose an exercise')).toBeNull()
    expect(screen.getByLabelText('Step name').getAttribute('role')).toBeNull()
  })

  it('will not preview a draft over the step cap, since compiling it would throw', () => {
    // Save was already disabled there. Preview compiled in render, and the
    // error boundary that caught it took the unsaved draft with it.
    type Block = Workout['blocks'][number]
    const step = (id: string): Block => ({ kind: 'segment', id, name: 'Squats', role: 'work', durationMs: 20_000 })
    const huge: Workout = {
      ...timed(),
      blocks: [
        {
          kind: 'repeat',
          id: 'r1',
          times: 99,
          children: [{ kind: 'repeat', id: 'r2', times: 99, children: [step('a'), step('b')] }],
        },
      ],
    }
    render(<EditorScreen {...props(huge)} />)

    expect((screen.getByLabelText('Preview the routine') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Save routine') as HTMLButtonElement).disabled).toBe(true)
  })

  it('reads the draft end to end, then goes back to editing', () => {
    /*
     * A MODE of this screen, not a trip to the run screen: navigating away and
     * back would either lose the unsaved draft or hand it back as the editor's
     * new baseline, leaving a never-saved routine looking clean.
     */
    render(<EditorScreen {...props(timed())} />)

    fireEvent.change(screen.getByLabelText('Step name'), { target: { value: 'Leg Press' } })
    fireEvent.click(screen.getByLabelText('Preview the routine'))

    // The rows are gone, and the unsaved name is in the reading list.
    expect(screen.queryByLabelText('Step name')).toBeNull()
    expect(screen.getByText('Leg Press')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Back to editing'))

    expect((screen.getByLabelText('Step name') as HTMLInputElement).value).toBe('Leg Press')
  })

  it('shows the picture the exercises page supplies, marked as borrowed', () => {
    /*
     * The same rule as the weight hint: a step that carries none takes the
     * page's, so the row has to show what the run will show. Faintly, and
     * marked, because it is not something this routine has said.
     */
    savePictures(withPicture({}, 'Squats', { source: 'bundled', path: 'exercises/Deadlift.jpg' }))
    render(<EditorScreen {...props(timed())} />)

    const thumb = screen.getByLabelText(/Image for Squats, from the Exercises page/)
    expect(thumb.dataset.inherited).toBe('true')
    expect(thumb.querySelector('img')?.getAttribute('src')).toContain('Deadlift')
  })

  it('offers to override a borrowed picture rather than to remove it', () => {
    // There is nothing to remove: the picture is not the step's. Overriding is
    // the only thing the step can say about it.
    savePictures(withPicture({}, 'Squats', { source: 'bundled', path: 'exercises/Deadlift.jpg' }))
    render(<EditorScreen {...props(timed())} />)

    fireEvent.click(screen.getByLabelText(/Image for Squats, from the Exercises page/))

    expect(screen.getByText(/From the Exercises page/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Remove image/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Use my own/ }))
    expect(screen.getByRole('heading', { name: 'Add an image' })).toBeTruthy()
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

  it('leaves Cmd+Z to the field while a note is still being typed', () => {
    /*
     * A note is committed on blur, so mid-typing it is not in the history. The
     * global handler used to undo the draft anyway, taking back the previous
     * edit under the very field being typed in.
     */
    const p = props(sectioned())
    render(<EditorScreen {...p} />)
    const name = screen.getByLabelText('Routine name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Renamed' } })

    fireEvent.click(screen.getAllByLabelText('Add a note or an alternative')[0]!)
    const note = screen.getAllByLabelText('Note')[0] as HTMLInputElement
    note.focus()
    fireEvent.change(note, { target: { value: 'slow tempo' } })
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(name.value).toBe('Renamed')

    // Committed, the note is a step of its own, and undo is the draft's again.
    fireEvent.blur(note)
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(name.value).toBe('Renamed')
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(name.value).toBe('Strength day')
  })

  it('undoes a count typed a moment ago, rather than leaving Cmd+Z to the number field', () => {
    /*
     * A count commits on every keystroke, so it IS in the history. The guard
     * that leaves blur-committed fields alone told them apart by value against
     * defaultValue, which React does not keep in step on a focused number
     * input, so Cmd+Z after typing a count did nothing at all.
     */
    render(<EditorScreen {...props(timed())} />)
    const seconds = screen.getByLabelText('Seconds') as HTMLInputElement
    seconds.focus()
    fireEvent.change(seconds, { target: { value: '45' } })
    expect(seconds.value).toBe('45')

    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(seconds.value).toBe('20')
  })

  it('shows a step that is counted AND timed as both, and keeps both', () => {
    /*
     * The row used to hold ONE number, and `timingOf` preferred the count, so an
     * EMOM minute showed "12 ×" and its sixty seconds appeared nowhere. Worse,
     * `setTiming` cleared both fields before writing one, so the first keystroke
     * on that row destroyed the clock.
     */
    const emom = (): Workout => ({
      id: 'w1',
      name: 'Arms EMOM',
      blocks: [
        {
          kind: 'segment',
          id: 's1',
          name: 'Bicep Curls',
          role: 'work',
          durationMs: 60_000,
          reps: { kind: 'fixed', count: 12 },
        },
      ],
      schemaVersion: SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
    })

    const p = props(emom())
    render(<EditorScreen {...p} />)

    expect((screen.getByLabelText('Timed or counted') as HTMLSelectElement).value).toBe(
      'reps-timed',
    )
    expect((screen.getByLabelText('Reps') as HTMLInputElement).value).toBe('12')
    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('60')

    // Retyping either one leaves the other standing.
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '15' } })
    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('60')

    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '45' } })
    expect((screen.getByLabelText('Reps') as HTMLInputElement).value).toBe('15')
  })

  it('drops the clock only when the unit says self-paced', () => {
    const p = props({
      id: 'w1',
      name: 'Arms EMOM',
      blocks: [
        {
          kind: 'segment',
          id: 's1',
          name: 'Bicep Curls',
          role: 'work',
          durationMs: 60_000,
          reps: { kind: 'fixed', count: 12 },
        },
      ],
      schemaVersion: SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
    })
    render(<EditorScreen {...p} />)

    fireEvent.change(screen.getByLabelText('Timed or counted'), { target: { value: 'reps' } })
    expect(screen.queryByLabelText('Seconds')).toBeNull()

    /*
     * Coming back gets the DEFAULT, not the sixty seconds. A self-paced step has
     * no duration, so there is nothing to restore: remembering it would mean
     * component state that undo cannot see and that no document records. Undo is
     * how you get the old value back.
     */
    fireEvent.change(screen.getByLabelText('Timed or counted'), { target: { value: 'reps-timed' } })
    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('20')
  })

  it("gives a step going timed its role's own default clock, not twenty seconds", () => {
    // A recover going "× in" got its sixty seconds; going "s" it got twenty.
    const p = props({
      id: 'w1',
      name: 'Rest day',
      blocks: [{ kind: 'segment', id: 's1', name: 'Walk', role: 'recover', reps: { kind: 'fixed', count: 10 } }],
      schemaVersion: SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
    })
    render(<EditorScreen {...p} />)

    fireEvent.change(screen.getByLabelText('Timed or counted'), { target: { value: 'timed' } })

    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('60')
  })

  it('gives a timed step a count without resetting its clock', () => {
    // The other direction, where the duration IS still there and must survive.
    const p = props({
      id: 'w1',
      name: 'Plank day',
      blocks: [{ kind: 'segment', id: 's1', name: 'Plank', role: 'work', durationMs: 45_000 }],
      schemaVersion: SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
    })
    render(<EditorScreen {...p} />)
    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('45')

    fireEvent.change(screen.getByLabelText('Timed or counted'), { target: { value: 'reps-timed' } })

    expect((screen.getByLabelText('Seconds') as HTMLInputElement).value).toBe('45')
    expect((screen.getByLabelText('Reps') as HTMLInputElement).value).toBe('10')
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
      await screen.findByText('There is no image on the clipboard. Copy one and try again'),
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

/**
 * Dragging a row, with a layout for jsdom to be measured against.
 *
 * jsdom lays nothing out, so every rect is zero and the drag loop has nothing to
 * compare. These give each row a hundred pixels in the order it is currently in,
 * and add its `translateY` the way a real browser would, which is exactly what
 * the loop reads. So the geometry under test is the real geometry.
 */
const ROW_H = 100

const rectOf = (top: number, height: number) =>
  ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 320,
    width: 320,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect

function layOut() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList?.contains('editor__list')) return rectOf(0, 10_000)
    if (!this.hasAttribute?.('data-row-id')) return rectOf(0, 0)

    const rows = [...document.querySelectorAll('[data-row-id]')]
    const top = rows.indexOf(this) * ROW_H
    const moved = /translateY\((-?[\d.]+)px\)/.exec((this as HTMLElement).style.transform)
    return rectOf(top + (moved ? Number(moved[1]) : 0), ROW_H)
  }
}

/** The rows as they read, top to bottom. */
const order = () =>
  [...document.querySelectorAll('[data-row-id]')].map(
    (row) => (row.querySelector('[aria-label="Step name"]') as HTMLInputElement | null)?.value,
  )

/** The rows as they read, by block id, so a group's children can be seen to follow. */
const rowIds = () =>
  [...document.querySelectorAll('[data-row-id]')].map((row) => row.getAttribute('data-row-id'))

const twoSections = (): Workout => ({
  id: 'w6',
  name: 'Strength day',
  blocks: ['A', 'B'].map((tag) => ({
    kind: 'section' as const,
    id: `sec${tag}`,
    name: `Part ${tag}`,
    display: 'list' as const,
    children: [
      {
        kind: 'segment' as const,
        id: `${tag.toLowerCase()}1`,
        name: `Step ${tag}`,
        role: 'work' as const,
        durationMs: 20_000,
      },
    ],
  })),
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

const three = (): Workout => ({
  id: 'w5',
  name: 'Tabata',
  blocks: ['A', 'B', 'C'].map((name, i) => ({
    kind: 'segment' as const,
    id: `s${i}`,
    name,
    role: 'work' as const,
    durationMs: 20_000,
  })),
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

describe('EditorScreen: dragging a row by its grip', () => {
  let frames: FrameRequestCallback[] = []

  beforeAll(() => {
    // jsdom implements neither, and the grip calls both on the way in.
    HTMLElement.prototype.setPointerCapture = function () {}
    HTMLElement.prototype.releasePointerCapture = function () {}
  })

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    layOut()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  /**
   * Runs the frames queued so far; each one queues the next.
   *
   * Inside `act`, because a move is dispatched from an animation frame rather
   * than from a React event, so nothing is committed to the DOM until React is
   * given the chance. Without it the next frame measures the old order.
   */
  const tick = () => {
    const due = frames
    frames = []
    act(() => {
      for (const frame of due) frame(0)
    })
  }

  const grips = () => [...document.querySelectorAll<HTMLElement>('.erow__grip')]

  const centreOf = (row: number) => row * ROW_H + ROW_H / 2
  /** Frames enough for a move to apply and the one settling frame after it. */
  const settle = (times = 3) => {
    for (let i = 0; i < times; i += 1) tick()
  }

  /** A pixel PAST the target's middle: the comparison is strictly greater. */
  const dragTo = (from: number, to: number) => {
    fireEvent.pointerDown(grips()[from]!, { button: 0, clientY: centreOf(from) })
    fireEvent.pointerMove(window, { clientY: centreOf(to) + 1 })
    settle()
  }

  it('reorders the row it is dragged past', () => {
    render(<EditorScreen {...props(three())} />)
    expect(order()).toEqual(['A', 'B', 'C'])

    dragTo(0, 1)

    expect(order()).toEqual(['B', 'A', 'C'])
  })

  it('settles instead of running on, once it is where the finger is', () => {
    // The loop re-queues every frame. Measuring against a neighbour it has
    // already passed would walk the row to the end of the list on its own.
    render(<EditorScreen {...props(three())} />)

    dragTo(0, 1)
    settle(6)

    expect(order()).toEqual(['B', 'A', 'C'])
  })

  it('is one undo step however many rows it crossed', () => {
    /*
     * The whole drag shares the `'drag'` coalescing key, the same mechanism a run
     * of keystrokes uses. Without it, undo would take a drag back one row at a
     * time, which is not how anyone thinks of the gesture they just made.
     */
    render(<EditorScreen {...props(three())} />)

    fireEvent.pointerDown(grips()[0]!, { button: 0, clientY: centreOf(0) })
    fireEvent.pointerMove(window, { clientY: centreOf(1) + 1 })
    settle()
    fireEvent.pointerMove(window, { clientY: centreOf(2) + 1 })
    settle()
    fireEvent.pointerUp(window)
    expect(order()).toEqual(['B', 'C', 'A'])

    fireEvent.click(screen.getByLabelText('Undo'))

    expect(order()).toEqual(['A', 'B', 'C'])
  })

  it('puts everything back when Escape is pressed mid-drag, leaving nothing to undo', () => {
    render(<EditorScreen {...props(three())} />)

    fireEvent.pointerDown(grips()[0]!, { button: 0, clientY: centreOf(0) })
    fireEvent.pointerMove(window, { clientY: centreOf(1) + 1 })
    settle()
    expect(order()).toEqual(['B', 'A', 'C'])

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(order()).toEqual(['A', 'B', 'C'])
    // The cancelled drag used to leave a step behind whose undo did nothing.
    expect((screen.getByLabelText('Undo') as HTMLButtonElement).disabled).toBe(true)
  })

  it('moves focus to the row above after a delete, not to the body', () => {
    // The Delete button unmounts with its row; the next key press went nowhere.
    render(<EditorScreen {...props(three())} />)
    fireEvent.click(screen.getAllByLabelText('Delete step')[1]!)
    expect(order()).toEqual(['A', 'C'])
    expect(document.activeElement).toBe(grips()[0])
  })

  it('lands focus on the copy of a group, not on its first child', () => {
    // The copy is inserted after the whole block, descendants included; the
    // focus target was the row below the original, which for a group is its
    // own first child.
    render(<EditorScreen {...props(sectioned())} />)
    const before = grips().length
    fireEvent.click(screen.getByLabelText('Duplicate this section'))
    expect(grips().length).toBeGreaterThan(before)
    // sectioned(): the section, its one child, then the copy.
    expect(document.activeElement).toBe(grips()[2])
  })

  it('does not end a typing run when a grip is tapped without a drag', () => {
    // A press and release on a grip with no move ended the run all the same,
    // so the name being typed beside it became two undo steps.
    render(<EditorScreen {...props(three())} />)
    const name = screen.getByLabelText('Routine name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Ren' } })
    fireEvent.pointerDown(grips()[0]!, { button: 0, clientY: centreOf(0) })
    fireEvent.pointerUp(window)
    fireEvent.change(name, { target: { value: 'Renamed' } })

    fireEvent.click(screen.getByLabelText('Undo'))
    expect(name.value).toBe('Tabata')
  })

  it('makes two drags two undo steps', () => {
    // The first drag's run was never ended, so the second coalesced into it
    // and one Undo took both back.
    render(<EditorScreen {...props(three())} />)

    dragTo(0, 1)
    fireEvent.pointerUp(window)
    expect(order()).toEqual(['B', 'A', 'C'])

    // Upwards this time, so the row has to pass ABOVE the neighbour's centre.
    fireEvent.pointerDown(grips()[2]!, { button: 0, clientY: centreOf(2) })
    fireEvent.pointerMove(window, { clientY: centreOf(1) - 1 })
    settle()
    fireEvent.pointerUp(window)
    expect(order()).toEqual(['B', 'C', 'A'])

    fireEvent.click(screen.getByLabelText('Undo'))
    expect(order()).toEqual(['B', 'A', 'C'])
    fireEvent.click(screen.getByLabelText('Undo'))
    expect(order()).toEqual(['A', 'B', 'C'])
  })

  it('leaves the transform behind when the drag ends', () => {
    // A row that kept its translate would sit visibly off its own row for good.
    render(<EditorScreen {...props(three())} />)

    dragTo(0, 1)
    fireEvent.pointerUp(window)

    for (const row of document.querySelectorAll<HTMLElement>('[data-row-id]')) {
      expect(row.style.transform).toBe('')
    }
  })

  it('gives every kind of row a grip, focusable and labelled', () => {
    render(<EditorScreen {...props(sectioned())} />)
    const found = grips()

    expect(found.length).toBe(document.querySelectorAll('[data-row-id]').length)
    for (const grip of found) {
      expect(grip.tabIndex).toBe(0)
      expect(grip.getAttribute('aria-label')).toMatch(/reorder/i)
    }
  })

  it('reorders from the keyboard, which is now the grip’s job alone', () => {
    /*
     * The step row's Move up and Move down buttons are gone, so this IS the
     * keyboard path. A grip that answered only a pointer would have made
     * reordering impossible without one.
     */
    render(<EditorScreen {...props(three())} />)

    fireEvent.keyDown(grips()[0]!, { key: 'ArrowDown' })
    expect(order()).toEqual(['B', 'A', 'C'])

    fireEvent.keyDown(grips()[1]!, { key: 'ArrowUp' })
    expect(order()).toEqual(['A', 'B', 'C'])
  })

  it('no longer carries Move up and Move down on any row', () => {
    // The grip replaced them everywhere, steps and groups alike, and it answers
    // the arrow keys so nothing is left pointer-only.
    for (const workout of [three(), sectioned()]) {
      render(<EditorScreen {...props(workout)} />)

      expect(screen.queryAllByLabelText('Move up')).toHaveLength(0)
      expect(screen.queryAllByLabelText('Move down')).toHaveLength(0)
      cleanup()
    }
  })

  it('reorders a group from the keyboard, children and all', () => {
    // A section is a row like any other now: its grip is the only way to move it,
    // and moving it has to take what is inside it along.
    render(<EditorScreen {...props(twoSections())} />)
    expect(rowIds()).toEqual(['secA', 'a1', 'secB', 'b1'])

    fireEvent.keyDown(grips()[0]!, { key: 'ArrowDown' })

    expect(rowIds()).toEqual(['secB', 'b1', 'secA', 'a1'])
  })

  it('keeps the moved row focused, so the key can be held down', () => {
    // Rows are keyed by block id, so React moves the node instead of rebuilding
    // it. Without that, the first press would move the row and lose the focus.
    render(<EditorScreen {...props(three())} />)
    const grip = grips()[0]!
    grip.focus()

    fireEvent.keyDown(grip, { key: 'ArrowDown' })

    expect(order()).toEqual(['B', 'A', 'C'])
    expect(document.activeElement).toBe(grip)
  })
})
