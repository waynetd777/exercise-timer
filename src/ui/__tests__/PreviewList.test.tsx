/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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
