/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateApp } from '../updateApp'

/*
 * Runs in the node environment with every browser global stubbed, so the
 * assertions are exact: updateApp touches precisely what these fakes expose.
 */

type FakeWorker = {
  state: string
  postMessage: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  fireStateChange: (state: string) => void
}

function fakeWorker(state: string): FakeWorker {
  const listeners: (() => void)[] = []
  const worker: FakeWorker = {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((_: string, fn: () => void) => listeners.push(fn)),
    removeEventListener: vi.fn(),
    fireStateChange: (next: string) => {
      worker.state = next
      for (const fn of [...listeners]) fn()
    },
  }
  return worker
}

function fakeRegistration(overrides: Record<string, unknown> = {}) {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    waiting: null,
    installing: null,
    ...overrides,
  }
}

const reload = vi.fn()

/** `updateApp` deliberately deletes no cache; any touch at all is a failure. */
const untouchable = new Proxy(
  {},
  {
    get() {
      throw new Error('updateApp must not touch caches')
    },
  },
)

function stubEnvironment(registration: unknown) {
  vi.stubGlobal('location', { reload })
  vi.stubGlobal('caches', untouchable)
  vi.stubGlobal('window', { caches: untouchable })
  vi.stubGlobal('navigator', {
    serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) },
  })
}

describe('updateApp', () => {
  beforeEach(() => {
    reload.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reloads after a successful update and never deletes any cache', async () => {
    const registration = fakeRegistration()
    stubEnvironment(registration)

    await updateApp()

    expect(registration.update).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('asks a waiting worker to skip waiting', async () => {
    const waiting = fakeWorker('installed')
    stubEnvironment(fakeRegistration({ waiting }))

    const done = updateApp()
    await vi.waitFor(() => expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
    waiting.fireStateChange('activated')
    await done

    expect(reload).toHaveBeenCalledOnce()
  })

  it('waits for an installing worker to activate before reloading', async () => {
    const installing = fakeWorker('installing')
    stubEnvironment(fakeRegistration({ installing }))

    const done = updateApp()
    await vi.waitFor(() => expect(installing.addEventListener).toHaveBeenCalled())
    expect(reload).not.toHaveBeenCalled()

    installing.fireStateChange('activated')
    await done
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads anyway when the installing worker never settles', async () => {
    vi.useFakeTimers()
    const installing = fakeWorker('installing')
    stubEnvironment(fakeRegistration({ installing }))

    const done = updateApp()
    await vi.advanceTimersByTimeAsync(3_000)
    await done

    expect(reload).toHaveBeenCalledOnce()
  })

  it('still reloads when update() rejects, as it does offline', async () => {
    const registration = fakeRegistration({
      update: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    })
    stubEnvironment(registration)

    await updateApp()

    expect(reload).toHaveBeenCalledOnce()
  })

  it('still reloads with no registration at all', async () => {
    stubEnvironment(undefined)

    await updateApp()

    expect(reload).toHaveBeenCalledOnce()
  })
})
