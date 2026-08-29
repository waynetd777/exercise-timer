/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Block, Workout } from '../../engine'
import { compile, SCHEMA_VERSION } from '../../engine'

// The audio layer is exercised by its own hook tests; here it would only try to
// build a real AudioContext, which jsdom does not have.
vi.mock('../../audio/useCueScheduler', () => ({ useCueScheduler: () => {} }))
vi.mock('../../audio/useSpokenCues', () => ({ useSpokenCues: () => {} }))
vi.mock('../../audio/engine', () => ({ audio: { unlock: () => {} } }))
vi.mock('../../audio/speech', () => ({ unlockSpeech: () => {} }))

import { PreviewList } from '../PreviewList'
import { RunScreen } from '../RunScreen'

const workout = (blocks: Block[]): Workout => ({
  id: 'w',
  name: 'Legs',
  blocks,
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

/** A section of two rounds: the shape almost every real routine has. */
const circuit = (): Workout =>
  workout([
    {
      kind: 'section',
      id: 'sec',
      name: 'MAIN CIRCUIT',
      display: 'list',
      note: 'rest as needed between rounds',
      children: [
        {
          kind: 'repeat',
          id: 'r',
          label: 'Round',
          times: 2,
          children: [
            {
              kind: 'segment',
              id: 'a',
              name: 'Goblet Squat',
              role: 'work',
              reps: { kind: 'fixed', count: 12 },
              load: '6kg',
              note: 'chest up, knees out',
              alternative: 'bodyweight squat',
            },
            { kind: 'segment', id: 'b', name: 'Rest', role: 'rest', durationMs: 45_000 },
          ],
        },
      ],
    },
  ])

/** A routine whose one work step carries a picture. */
const pictured = (): Workout =>
  workout([
    {
      kind: 'segment',
      id: 'a',
      name: 'Leg Press',
      role: 'work',
      reps: { kind: 'fixed', count: 12 },
      load: '65kg',
      // Remote, because `resolveMediaSync` answers with the url and no blob
      // store has to exist for the thumbnail to have a src in jsdom.
      media: { source: 'remote', url: 'https://example.test/leg-press.png' },
    },
    // Self-paced too, so both steps come up in the same layout and the assertion
    // below is reading one element rather than two different ones.
    { kind: 'segment', id: 'b', name: 'Cycling', role: 'work', reps: { kind: 'fixed', count: 20 } },
  ])

// jsdom has no dialog methods, and opening a picture needs them.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

// Mute is remembered in localStorage, so one test muting leaves the next one
// starting muted and asserting nothing.
beforeEach(() => globalThis.localStorage?.clear())

afterEach(cleanup)

describe('PreviewList', () => {
  it('reads the routine expanded: every round printed, in order', () => {
    render(<PreviewList routine={compile(circuit())} />)

    expect(screen.getByText('Round 1 of 2')).toBeTruthy()
    expect(screen.getByText('Round 2 of 2')).toBeTruthy()
    // Twice, because the routine does it twice. A collapsed reading is what the
    // editor and the text export already give.
    expect(screen.getAllByText('Goblet Squat 6kg')).toHaveLength(2)
  })

  it('names the section once, above the rounds inside it', () => {
    render(<PreviewList routine={compile(circuit())} />)

    expect(screen.getAllByRole('heading', { name: 'MAIN CIRCUIT' })).toHaveLength(1)
    expect(screen.getByText('rest as needed between rounds')).toBeTruthy()
  })

  it('says what each step asks of you: reps, weight, time', () => {
    render(<PreviewList routine={compile(circuit())} />)

    expect(screen.getAllByText('12 ×')).toHaveLength(2)
    /*
     * ONCE, though the round states a rest and runs twice: `compile()` drops a
     * group's trailing rest on the final iteration, because a rest belongs
     * between rounds. The preview is a reading of the compiled routine, so it
     * shows the rest that will actually play rather than the one the tree
     * states, which is the whole reason to read it expanded.
     */
    expect(screen.getAllByText('45s')).toHaveLength(1)
  })

  it('shows every step its how-to and its alternative', () => {
    // The run sheet shows the note of the step being worked only, since the
    // rest of the group has to stay on screen. Nothing is pushed off here.
    render(<PreviewList routine={compile(circuit())} />)

    expect(screen.getAllByText('chest up, knees out')).toHaveLength(2)
    expect(screen.getAllByText('or bodyweight squat')).toHaveLength(2)
  })

  it('captions a group that runs once with nothing at all', () => {
    const routine = compile(
      workout([
        {
          kind: 'repeat',
          id: 'r',
          label: 'Round',
          times: 1,
          children: [{ kind: 'segment', id: 'a', name: 'Jog', role: 'work', durationMs: 60_000 }],
        },
      ]),
    )
    render(<PreviewList routine={routine} />)

    expect(screen.queryByText('Round 1 of 1')).toBeNull()
    expect(screen.getByText('Jog')).toBeTruthy()
  })
})

describe('RunScreen: the preview', () => {
  it('opens from the Ready card and closes from the header', () => {
    render(<RunScreen workout={circuit()} />)

    expect(screen.getByText('Ready')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(screen.queryByText('Ready')).toBeNull()
    expect(screen.getByText('Round 2 of 2')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Back to ready'))
    expect(screen.getByText('Ready')).toBeTruthy()
  })

  it('closes itself when the routine starts', () => {
    // It is a mode of the idle state. Starting from the preview must show the
    // step being worked, not a list with a clock running behind it.
    render(<RunScreen workout={circuit()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(screen.getByLabelText('Start'))

    expect(screen.queryByText('Round 2 of 2')).toBeNull()
    // The toggle goes with it: the slot it sat in is the running stopwatch's.
    expect(screen.queryByLabelText('Preview the routine')).toBeNull()
  })
})

describe('PreviewList: a picture, full size', () => {
  it('opens the picture a thumbnail stands for, named and loaded', () => {
    render(<PreviewList routine={compile(pictured())} />)

    // The thumbnail itself is alt="", so the button carries the name: a
    // hundred rows of "Leg Press 65kg" images would be a hundred read-outs.
    fireEvent.click(screen.getByRole('button', { name: 'Leg Press 65kg, full size' }))

    const shown = screen.getByRole('dialog')
    expect(shown.querySelector('img')?.getAttribute('src')).toBe('https://example.test/leg-press.png')
    // The load reads with the name, exactly as it does in the row.
    expect(screen.getAllByText('Leg Press 65kg').length).toBeGreaterThan(1)
  })

  it('closes again, leaving the reading where it was', () => {
    render(<PreviewList routine={compile(pictured())} />)

    fireEvent.click(screen.getByRole('button', { name: 'Leg Press 65kg, full size' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leg Press 65kg, full size' })).toBeTruthy()
  })

  it('leaves an empty frame alone: there is nothing behind it to enlarge', () => {
    render(<PreviewList routine={compile(circuit())} />)

    // Nothing in `circuit` carries an image, so not one row offers the button.
    expect(screen.queryByRole('button', { name: /full size/ })).toBeNull()
  })
})

describe('RunScreen: a picture opened from Preview', () => {
  const sound = () => screen.queryByLabelText('Turn sound off') !== null

  const openPreview = () => {
    render(<RunScreen workout={pictured()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  }

  it('still takes M as mute when no picture is open', () => {
    // The control for the test below: without it, that one passes vacuously.
    openPreview()
    expect(sound()).toBe(true)

    fireEvent.keyDown(window, { key: 'm' })

    expect(sound()).toBe(false)
  })

  it('does not mute from behind the picture', () => {
    // A dialog owns the keyboard. The arrows were already safe, since `next`
    // and `previous` ignore an idle routine, and Space is taken by the
    // dialog's own focused button. M reached through and muted the app.
    openPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Leg Press 65kg, full size' }))

    fireEvent.keyDown(window, { key: 'm' })

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(sound()).toBe(true)
  })
})
