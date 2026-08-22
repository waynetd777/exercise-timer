// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { useWakeLock } from '../useWakeLock'

function Holder({ active }: { active: boolean }) {
  useWakeLock(active)
  return null
}

type FakeLock = {
  release: () => Promise<void>
  addEventListener: (name: string, listener: () => void) => void
}

describe('useWakeLock', () => {
  let root: Root
  let container: HTMLElement
  let requests: Array<(lock: FakeLock) => void>
  let released: number

  const makeLock = (): FakeLock => ({
    release: () => {
      released += 1
      return Promise.resolve()
    },
    addEventListener: () => {},
  })

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    requests = []
    released = 0
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () =>
          new Promise<FakeLock>((resolve) => {
            requests.push(resolve)
          }),
      },
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  const flush = () => act(async () => {})

  it('acquires once while active and releases on cleanup', async () => {
    act(() => root.render(<Holder active={true} />))
    expect(requests).toHaveLength(1)
    requests[0]!(makeLock())
    await flush()

    act(() => root.render(<Holder active={false} />))
    expect(released).toBe(1)
  })

  it('does not start a second request while the first is still in flight', async () => {
    act(() => root.render(<Holder active={true} />))
    expect(requests).toHaveLength(1)

    // A hidden/visible flap lands while the first request has not resolved.
    // Both used to pass the sentinel null check and hold two locks, the first
    // orphaned beyond cleanup's reach.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(requests).toHaveLength(1)

    requests[0]!(makeLock())
    await flush()

    // Once the lock is held, another visibility flap has nothing to do either.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(requests).toHaveLength(1)
  })

  it('re-acquires after the browser dropped the lock on hide', async () => {
    act(() => root.render(<Holder active={true} />))
    let dropLock = () => {}
    const lock: FakeLock = {
      release: () => Promise.resolve(),
      addEventListener: (name, listener) => {
        if (name === 'release') dropLock = listener
      },
    }
    requests[0]!(lock)
    await flush()

    // The browser releases the lock when the page hides; coming back must ask
    // for a new one.
    dropLock()
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(requests).toHaveLength(2)
  })
})
