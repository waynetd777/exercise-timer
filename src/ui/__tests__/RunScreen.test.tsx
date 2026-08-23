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
