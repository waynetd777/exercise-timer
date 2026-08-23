/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compile, locate } from '../../engine'
import type { RoutinePosition } from '../../engine'
import { seg, workout } from '../../engine/__tests__/fixtures'
import { SPOKEN } from '../speech'
import { useSpokenCues } from '../useSpokenCues'

type Status = 'idle' | 'running' | 'paused' | 'complete'

const spoken: string[] = []

function stubSpeech(): void {
  vi.stubGlobal('speechSynthesis', {
    speak: (u: { text: string }) => spoken.push(u.text),
    cancel: () => {},
  })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      rate = 1
      volume = 1
      constructor(text: string) {
        this.text = text
      }
    },
  )
}

/** One 25s work step: long enough (over 20s) to earn an announcement. */
const routine = compile(workout('drill', [seg('push-ups', 25, 'work')]))

/** The position with this much run time on the clock. */
function positionAt(elapsedInRunMs: number): RoutinePosition {
  return locate(routine, { runIndex: 0, elapsedInRunMs })
}

function announcements(): string[] {
  return spoken.filter((text) => text === SPOKEN.tenSecondsLeft)
}

type Props = { at: RoutinePosition; status: Status; muted: boolean }

function renderSpoken(at: RoutinePosition, status: Status = 'running', muted = false) {
  return renderHook(({ at, status, muted }: Props) => useSpokenCues(at, status, muted), {
    initialProps: { at, status, muted },
  })
}

beforeEach(() => {
  spoken.length = 0
  stubSpeech()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the ten-seconds announcement', () => {
  it('fires on entering the window, not only on the exact second', () => {
    // Eleven seconds left: too early.
    const { rerender } = renderSpoken(positionAt(14_000))
    expect(announcements()).toEqual([])

    // A throttled tick jumped the render from eleven straight to nine.
    rerender({ at: positionAt(16_400), status: 'running', muted: false })
    expect(announcements()).toEqual([SPOKEN.tenSecondsLeft])
  })

  it('fires once per step, not on every render inside the window', () => {
    const { rerender } = renderSpoken(positionAt(15_000))
    rerender({ at: positionAt(16_000), status: 'running', muted: false })
    rerender({ at: positionAt(17_000), status: 'running', muted: false })
    expect(announcements()).toEqual([SPOKEN.tenSecondsLeft])
  })

  it('stays silent when a return from background lands past the window', () => {
    // Six and a half seconds left: the moment has passed, late is worse
    // than skipped.
    const { rerender } = renderSpoken(positionAt(2_000))
    rerender({ at: positionAt(18_500), status: 'running', muted: false })
    expect(announcements()).toEqual([])
  })

  it('announces the same step again on a rerun', () => {
    const { rerender } = renderSpoken(positionAt(15_000))
    expect(announcements()).toEqual([SPOKEN.tenSecondsLeft])

    // Back to the start screen, then a second run of the same routine.
    rerender({ at: positionAt(0), status: 'idle', muted: false })
    rerender({ at: positionAt(15_000), status: 'running', muted: false })
    expect(announcements()).toEqual([SPOKEN.tenSecondsLeft, SPOKEN.tenSecondsLeft])
  })
})

describe('the wrap-up', () => {
  it('completing muted latches it, so unmuting on the summary stays silent', () => {
    vi.useFakeTimers()
    const { rerender } = renderSpoken(positionAt(25_000), 'complete', true)

    // Unmuting on the summary screen, then every timer there is.
    rerender({ at: positionAt(25_000), status: 'complete', muted: false })
    vi.runAllTimers()

    expect(spoken).not.toContain(SPOKEN.thatsAWrap)
  })

  it('speaks once after an unmuted completion', () => {
    vi.useFakeTimers()
    const { rerender } = renderSpoken(positionAt(25_000), 'complete', false)
    vi.runAllTimers()
    expect(spoken.filter((text) => text === SPOKEN.thatsAWrap)).toHaveLength(1)

    // A mute toggle on the summary must not deliver it a second time.
    rerender({ at: positionAt(25_000), status: 'complete', muted: true })
    rerender({ at: positionAt(25_000), status: 'complete', muted: false })
    vi.runAllTimers()
    expect(spoken.filter((text) => text === SPOKEN.thatsAWrap)).toHaveLength(1)
  })
})
