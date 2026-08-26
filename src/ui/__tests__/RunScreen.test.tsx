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

// The audio layer is exercised by its own hook tests; here it would only try
// to build a real AudioContext, which jsdom does not have.
vi.mock('../../audio/useCueScheduler', () => ({ useCueScheduler: () => {} }))
vi.mock('../../audio/useSpokenCues', () => ({ useSpokenCues: () => {} }))
vi.mock('../../audio/engine', () => ({ audio: { unlock: () => {} } }))
vi.mock('../../audio/speech', () => ({ unlockSpeech: () => {} }))

import { RunScreen } from '../RunScreen'

const timed = (): Workout => ({
  id: 'w1',
  name: 'Tabata',
  blocks: [
    { kind: 'segment', id: 's1', name: 'Work', durationMs: 20_000, role: 'work' },
    { kind: 'segment', id: 's2', name: 'Rest', durationMs: 10_000, role: 'rest' },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

/** A section holding one EMOM minute: timed and counted at the same time. */
const emom = (): Workout => ({
  id: 'w2',
  name: 'Weekly',
  blocks: [
    {
      kind: 'section',
      id: 'sec1',
      name: 'ARMS & SHOULDERS',
      display: 'timer',
      children: [
        {
          kind: 'segment',
          id: 's1',
          name: 'Bicep Curls',
          durationMs: 60_000,
          reps: { kind: 'fixed', count: 12 },
          role: 'work',
        },
      ],
    },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

/** An AMRAP: one timed step whose note is the round, one item per line. */
const amrap = (): Workout => ({
  id: 'w3',
  name: 'Weekly',
  blocks: [
    {
      kind: 'section',
      id: 'sec1',
      name: 'GENERAL BODY',
      display: 'timer',
      children: [
        {
          kind: 'segment',
          id: 's1',
          name: 'As many rounds as possible',
          durationMs: 600_000,
          role: 'work',
          note: '10 × Squat + Shoulder Press\n6 × Burpees\n10 Mountain Climbers',
        },
      ],
    },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

/** A rep-based section, which runs as the LIST rather than the countdown. */
const listed = (): Workout => ({
  id: 'w4',
  name: 'Weekly',
  blocks: [
    {
      kind: 'section',
      id: 'sec1',
      name: 'CORE',
      display: 'list',
      children: [
        { kind: 'segment', id: 's1', name: 'Heel Taps', role: 'work', reps: { kind: 'fixed', count: 10 } },
        { kind: 'segment', id: 's2', name: 'Toe Touches', role: 'work', reps: { kind: 'fixed', count: 12 } },
      ],
    },
  ],
  schemaVersion: SCHEMA_VERSION,
  createdAt: 1,
  updatedAt: 1,
})

describe('RunScreen: the countdown layout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  /** The body only exists once a run is under way. */
  const run = (workout: Workout) => {
    render(<RunScreen workout={workout} />)
    fireEvent.click(screen.getByLabelText('Start'))
  }

  it('shows the count a step asks for, not just its clock', () => {
    /*
     * An EMOM minute is timed AND counted. The countdown has no effort column
     * the way a list row does, so without this it read "Bicep Curls" and never
     * said twelve.
     */
    run(emom())
    expect(screen.getByRole('heading', { level: 1, name: '12 × Bicep Curls' })).toBeTruthy()
  })

  it('says the count in the panel too, so the two big texts agree', () => {
    // The heading has read "12 × Bicep Curls" since an EMOM minute became both
    // timed and counted; a panel reading only "Bicep Curls" beside it looked
    // like a different step rather than the same one twice.
    run(emom())

    expect(screen.getAllByText('12 × Bicep Curls')).toHaveLength(2)
  })

  it('still gives the panel over to the how-to when a step has one', () => {
    // The name is already the heading, so an instruction is worth more here.
    const workout = emom()
    const step = (workout.blocks[0] as { children: { note?: string }[] }).children[0]!
    step.note = 'elbows in, and do not swing'
    run(workout)

    expect(screen.getByText('elbows in, and do not swing')).toBeTruthy()
    expect(screen.getAllByText('12 × Bicep Curls')).toHaveLength(1)
  })

  it('draws a note written one item per line as bullets under one another', () => {
    run(amrap())
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)

    expect(items).toEqual([
      '10 × Squat + Shoulder Press',
      '6 × Burpees',
      '10 Mountain Climbers',
    ])
  })

  it('names the section once, in the header, whichever layout is running', () => {
    /*
     * ONE place for both layouts. It was a large bone heading on the list and
     * nothing at all on the countdown; putting it above the countdown then
     * overflowed a column whose own budget leaves about two points of slack, and
     * it landed on the header and on the step count. The header row is `auto`
     * and gives way, so nothing has to be traded for it.
     */
    run(listed())
    expect(screen.getAllByText('CORE')).toHaveLength(1)
    expect(screen.getByText('CORE').closest('header')).not.toBeNull()
    cleanup()

    run(emom())
    const heading = screen.getAllByText('ARMS & SHOULDERS')

    expect(heading).toHaveLength(1)
    expect(heading[0]!.className).toContain('label--section')
    expect(heading[0]!.closest('header')).not.toBeNull()
    // Emphatically NOT in the countdown column, which cannot afford it.
    expect(heading[0]!.closest('.count__lead')).toBeNull()
  })

  it('leaves a one-line note as the single block it always was', () => {
    // Only a list is drawn as a list; an ordinary how-to note is not.
    const workout = amrap()
    const step = (workout.blocks[0] as { children: { note?: string }[] }).children[0]!
    step.note = 'start standing, step out to one side'
    run(workout)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText('start standing, step out to one side')).toBeTruthy()
  })
})

describe('RunScreen: the reset confirmation', () => {
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

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const start = () => {
    render(<RunScreen workout={timed()} />)
    fireEvent.click(screen.getByLabelText('Start'))
  }

  it('asks before resetting a running workout, and pauses while asking', () => {
    start()

    fireEvent.click(screen.getByLabelText('Reset'))

    expect(screen.getByText('Start this workout over?')).toBeTruthy()
    // Paused the moment Reset was pressed, so reading the question costs the
    // step nothing.
    expect(screen.getByLabelText('Resume')).toBeTruthy()
  })

  it('cancel puts a workout that was running back to running', () => {
    start()

    fireEvent.click(screen.getByLabelText('Reset'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Start this workout over?')).toBeNull()
    expect(screen.getByLabelText('Pause')).toBeTruthy()
  })

  it('cancel leaves a workout that was already paused, paused', () => {
    start()
    fireEvent.click(screen.getByLabelText('Pause'))

    fireEvent.click(screen.getByLabelText('Reset'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByLabelText('Resume')).toBeTruthy()
  })

  it('confirming resets to the very start', () => {
    start()

    fireEvent.click(screen.getByLabelText('Reset'))
    fireEvent.click(screen.getByText('Reset', { selector: 'button.chip' }))

    expect(screen.queryByText('Start this workout over?')).toBeNull()
    expect(screen.getByLabelText('Start')).toBeTruthy()
    expect((screen.getByLabelText('Reset') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the space shortcut stays dead while the question is up', () => {
    start()

    fireEvent.click(screen.getByLabelText('Reset'))
    fireEvent.keyDown(window, { key: ' ' })

    // Space would have resumed; the dialog owns the keyboard instead.
    expect(screen.getByText('Start this workout over?')).toBeTruthy()
    expect(screen.getByLabelText('Resume')).toBeTruthy()
  })
})
