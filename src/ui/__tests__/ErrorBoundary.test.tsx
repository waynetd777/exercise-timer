/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('Workout expands to more than 10000 steps.')
  return <p>All well</p>
}

afterEach(cleanup)

describe('ErrorBoundary', () => {
  it('shows the message and a way back instead of a blank page', () => {
    // React logs the caught error as well; keep the test output quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReset = vi.fn()
    render(
      <ErrorBoundary onReset={onReset}>
        <Bomb armed />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/more than 10000 steps/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to routines' }))
    expect(onReset).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary onReset={() => {}}>
        <Bomb armed={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('All well')).toBeTruthy()
  })
})
