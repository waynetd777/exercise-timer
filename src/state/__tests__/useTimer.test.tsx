// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { useTimer } from '../useTimer'
import type { Timer } from '../useTimer'
import { seg, step, workout } from '../../engine/__tests__/fixtures'
import type { Workout } from '../../engine'

/*
 * The monotonic clock is faked alongside vitest's timers, because the hook
 * derives every value from performance.now(): advancing one without the other
 * would test a physically impossible world.
 */
let fakeNow = 0

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderTimer(wk: Workout) {
  const ref: { current: Timer | null } = { current: null }
  const statuses: string[] = []
  function Probe() {
    ref.current = useTimer(wk)
    statuses.push(ref.current.status)
    return null
  }
  const container = document.createElement('div')
  document.body.append(container)
  let root: Root
  act(() => {
    root = createRoot(container)
    root.render(<Probe />)
  })
  return { ref, statuses, unmount: () => act(() => root.unmount()) }
}

/*
 * Stepped in 100ms slices so timers fire in the same order they would in a
 * browser, with performance.now() consistent at every firing.
 */
const advance = (ms: number) => {
  const slices = Math.ceil(ms / 100)
  for (let i = 0; i < slices; i++) {
    const slice = Math.min(100, ms - i * 100)
    act(() => {
      fakeNow += slice
      vi.advanceTimersByTime(slice)
    })
  }
}

describe('useTimer', () => {
  beforeEach(() => {
    fakeNow = 0
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('starts and ticks to each whole-second boundary', () => {
    const { ref, unmount } = renderTimer(workout('Plain', [seg('Work', 5)]))
    const t = () => ref.current!

    expect(t().status).toBe('idle')
    act(() => t().start())
    expect(t().status).toBe('running')
    expect(t().secondsLeft).toBe(5)

    advance(1000)
    expect(t().secondsLeft).toBe(4)
    advance(500)
    expect(t().secondsLeft).toBe(4)
    advance(500)
    expect(t().secondsLeft).toBe(3)
    unmount()
  })

  it('pause freezes the display and resume continues from it', () => {
    const { ref, unmount } = renderTimer(workout('Plain', [seg('Work', 10)]))
    const t = () => ref.current!

    act(() => t().start())
    advance(3000)
    expect(t().secondsLeft).toBe(7)

    act(() => t().pause())
    expect(t().status).toBe('paused')
    advance(30_000)
    expect(t().secondsLeft).toBe(7)

    act(() => t().resume())
    expect(t().status).toBe('running')
    advance(2000)
    expect(t().secondsLeft).toBe(5)
    unmount()
  })

  it('keeps ticking after an automatic crossing into a gate, and through Next into the final run', () => {
    // A timed run, a self-paced gate, then a final timed run: the shape every
    // gated routine has, and the one that killed the tick chain.
    const wk = workout('Gated', [seg('Jog', 5), step('Push-ups', 10), seg('Rest', 10, 'rest')])
    const { ref, unmount } = renderTimer(wk)
    const t = () => ref.current!

    act(() => t().start())
    advance(1000)
    expect(t().secondsLeft).toBe(4)

    // Cross the 5s boundary into the gate without any user interaction.
    advance(4100)
    expect(t().at.remainingMs).toBe(null)

    // The gate must keep counting up on its own.
    advance(5000)
    expect(t().secondsSpent).toBe(5)

    act(() => t().next())
    expect(t().at.remainingMs).not.toBe(null)
    expect(t().secondsLeft).toBe(10)

    advance(3000)
    expect(t().secondsLeft).toBe(7)

    advance(8000)
    expect(t().status).toBe('complete')
    unmount()
  })

  it('keeps the chain alive across next and previous while running', () => {
    const { ref, unmount } = renderTimer(workout('Two', [seg('A', 5), seg('B', 5)]))
    const t = () => ref.current!

    act(() => t().start())
    advance(1000)
    expect(t().secondsLeft).toBe(4)

    act(() => t().next())
    expect(t().secondsLeft).toBe(5)
    advance(1000)
    expect(t().secondsLeft).toBe(4)

    act(() => t().previous())
    const afterBack = t().secondsLeft
    advance(1000)
    expect(t().secondsLeft).toBe(afterBack - 1)

    advance(30_000)
    expect(t().status).toBe('complete')
    unmount()
  })

  it('completes exactly once and stays complete', () => {
    const { ref, statuses, unmount } = renderTimer(workout('Short', [seg('Work', 3)]))
    const t = () => ref.current!

    act(() => t().start())
    advance(3100)
    expect(t().status).toBe('complete')

    advance(10_000)
    expect(t().status).toBe('complete')

    const completions = statuses.filter(
      (s, i) => s === 'complete' && statuses[i - 1] !== 'complete',
    ).length
    expect(completions).toBe(1)
    unmount()
  })

  it('credits time the page was suspended, on the way back to visible', () => {
    // iOS freezes the WebContent process in the background and performance.now()
    // excludes the frozen stretch; the wall clock does not. Two minutes away
    // must read as two minutes gone.
    const { ref, unmount } = renderTimer(workout('Long', [seg('Work', 300)]))
    const t = () => ref.current!

    act(() => t().start())
    advance(5000)
    expect(t().secondsLeft).toBe(295)

    act(() => {
      vi.setSystemTime(Date.now() + 120_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(t().secondsLeft).toBe(175)
    expect(t().status).toBe('running')

    // And the chain is still alive afterwards.
    advance(1000)
    expect(t().secondsLeft).toBe(174)
    unmount()
  })

  it('does not rewind when the wall clock is set backwards', () => {
    const { ref, unmount } = renderTimer(workout('Long', [seg('Work', 300)]))
    const t = () => ref.current!

    act(() => t().start())
    advance(5000)

    act(() => {
      vi.setSystemTime(Date.now() - 3_600_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(t().secondsLeft).toBe(295)
    expect(t().status).toBe('running')
    unmount()
  })
})
