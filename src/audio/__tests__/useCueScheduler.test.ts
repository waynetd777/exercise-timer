/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compile } from '../../engine'
import { seg, step, workout } from '../../engine/__tests__/fixtures'
import type { RunStatus } from '../../state/useTimer'
import { useCueScheduler } from '../useCueScheduler'

/**
 * The hook against a hand-driven engine: what these tests pin down is WHEN the
 * hook cancels, arms and re-arms, which the pure-function tests in
 * `schedule.test.ts` cannot see. The dedup logic itself stays real.
 */
const mock = vi.hoisted(() => {
  const state = {
    ready: true,
    now: 100,
    /** Audio-clock moments handed to scheduleTone, in order. */
    tones: [] as number[],
    cancels: 0,
    resumes: 0,
    stateListeners: new Set<() => void>(),
  }
  const audio = {
    get ready() {
      return state.ready
    },
    get now() {
      return state.now
    },
    cancelPending: () => {
      state.cancels += 1
    },
    resume: () => {
      state.resumes += 1
    },
    scheduleTone: (at: number) => {
      state.tones.push(at)
    },
    onSampleDecoded: () => () => {},
    onStateChange: (listener: () => void) => {
      state.stateListeners.add(listener)
      return () => {
        state.stateListeners.delete(listener)
      }
    },
  }
  return { state, audio }
})

vi.mock('../engine', () => ({ audio: mock.audio }))

/**
 * 25s work then 30s rest: cues at 0 (whistle), 22/23/24 (countdown), 25 (bell),
 * 52/53/54 (countdown) and 55 (completion), all inside one run.
 */
const routine = compile(workout('drill', [seg('push-ups', 25, 'work'), seg('rest', 30, 'rest')]))

/** Ends on a self-paced step, so the finish fires on the tap, not the clock. */
const gated = compile(workout('gated', [step('plank')]))

type Props = { status: RunStatus; muted: boolean; generation: number }

let elapsed = 0
// Stable across renders, as the real timer's is: a fresh identity per render
// would re-run the hook's effect on every rerender and mask the very
// generation-driven re-arm these tests pin down.
const readElapsed = () => elapsed

function renderScheduler(initial: Partial<Props> = {}, target = routine) {
  return renderHook(
    ({ status, muted, generation }: Props) =>
      useCueScheduler({
        routine: target,
        runIndex: 0,
        status,
        muted,
        readElapsed,
        generation,
      }),
    { initialProps: { status: 'running' as RunStatus, muted: false, generation: 1, ...initial } },
  )
}

beforeEach(() => {
  elapsed = 0
  mock.state.ready = true
  mock.state.tones.length = 0
  mock.state.cancels = 0
  mock.state.resumes = 0
  mock.state.stateListeners.clear()
})

afterEach(() => {
  cleanup()
})

describe('useCueScheduler lifecycle', () => {
  it('queues the opening window on mount', () => {
    renderScheduler()
    // Everything within the 30s lookahead: cues at 0, 22, 23, 24, 25.
    expect(mock.state.tones).toEqual([100, 122, 123, 124, 125])
  })

  it('a clock jump cancels the stale queue and arms the new position at once', () => {
    const { rerender } = renderScheduler()
    mock.state.tones.length = 0
    const cancelsBefore = mock.state.cancels

    // A seek deep into the rest step: the whole first window is now stale.
    elapsed = 40_000
    rerender({ status: 'running', muted: false, generation: 2 })

    expect(mock.state.cancels).toBeGreaterThan(cancelsBefore)
    // The new window (cues at 52, 53, 54, 55) is queued immediately, not up
    // to REARM_MS later: no timer has ticked inside this test.
    expect(mock.state.tones).toEqual([112, 113, 114, 115])
  })

  it('returning to visibility drops what was queued before hiding, then queues afresh', () => {
    renderScheduler()
    mock.state.tones.length = 0
    const cancelsBefore = mock.state.cancels

    // Hidden for ten seconds: the run clock kept counting while the queued
    // cues sat aimed at a frozen audio clock.
    elapsed = 10_000
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mock.state.cancels).toBeGreaterThan(cancelsBefore)
    expect(mock.state.resumes).toBeGreaterThan(0)
    // The future cues (22, 23, 24, 25) are forgotten and queued again against
    // the live clock; the one at 0 already played and is not.
    expect(mock.state.tones).toEqual([112, 113, 114, 115])
  })

  it('arms as soon as the context reports running, not an interval later', () => {
    mock.state.ready = false
    renderScheduler()
    // The arm on mount bailed: nothing can be queued on a suspended context.
    expect(mock.state.tones).toEqual([])

    mock.state.ready = true
    for (const listener of mock.state.stateListeners) listener()

    expect(mock.state.tones).toEqual([100, 122, 123, 124, 125])
  })

  it('completing muted latches the finish, so unmuting later stays silent', () => {
    const { rerender } = renderScheduler({ muted: true }, gated)

    rerender({ status: 'complete', muted: true, generation: 2 })
    expect(mock.state.tones).toEqual([])

    // Unmuting on the summary screen, possibly minutes later.
    rerender({ status: 'complete', muted: false, generation: 2 })
    expect(mock.state.tones).toEqual([])
  })

  it('completing unmuted still fires the tap finish once', () => {
    const { rerender } = renderScheduler({}, gated)
    mock.state.tones.length = 0

    rerender({ status: 'complete', muted: false, generation: 2 })
    expect(mock.state.tones).toEqual([100])

    rerender({ status: 'complete', muted: true, generation: 2 })
    rerender({ status: 'complete', muted: false, generation: 2 })
    expect(mock.state.tones).toEqual([100])
  })
})
