/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { usePullToRefresh } from '../usePullToRefresh'

function Puller({ onRefresh }: { onRefresh: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  usePullToRefresh(ref, onRefresh)
  return <div ref={ref} data-testid="scroller" />
}

const touch = (y: number) => ({ clientY: y }) as Touch

function fire(element: HTMLElement, type: string, y: number) {
  const event = new Event(type, { cancelable: true }) as TouchEvent
  Object.defineProperty(event, 'touches', { value: [touch(y)] })
  element.dispatchEvent(event)
}

describe('usePullToRefresh', () => {
  let root: Root
  let container: HTMLElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('judges the threshold on the distance at release, not the last render', () => {
    const onRefresh = vi.fn()
    act(() => root.render(<Puller onRefresh={onRefresh} />))
    const scroller = container.querySelector('[data-testid="scroller"]') as HTMLElement

    // The whole gesture lands between renders: the handlers used to read the
    // pull distance out of a render closure, so a release that beat the
    // re-render judged a stale value and dropped the refresh.
    fire(scroller, 'touchstart', 0)
    fire(scroller, 'touchmove', 300)
    fire(scroller, 'touchend', 300)

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on a short pull', () => {
    const onRefresh = vi.fn()
    act(() => root.render(<Puller onRefresh={onRefresh} />))
    const scroller = container.querySelector('[data-testid="scroller"]') as HTMLElement

    fire(scroller, 'touchstart', 0)
    fire(scroller, 'touchmove', 40)
    fire(scroller, 'touchend', 40)

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('attaches its listeners once, not per rendered pixel of movement', () => {
    const onRefresh = vi.fn()
    act(() => root.render(<Puller onRefresh={onRefresh} />))
    const scroller = container.querySelector('[data-testid="scroller"]') as HTMLElement
    const spy = vi.spyOn(scroller, 'addEventListener')

    act(() => {
      fire(scroller, 'touchstart', 0)
      fire(scroller, 'touchmove', 100)
      fire(scroller, 'touchmove', 200)
      fire(scroller, 'touchmove', 300)
    })

    // Movement re-renders (the indicator draws from state) but must not churn
    // the listeners: with state in the effect deps, every move re-attached all
    // four.
    expect(spy).not.toHaveBeenCalled()
    fire(scroller, 'touchend', 300)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
