/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Called when the person asks to go back; the boundary clears itself first. */
  onReset: () => void
}

type State = { error: Error | null }

/**
 * The last thing between a render that throws and a blank page.
 *
 * `compile()` runs inside a `useMemo` in the run screen and throws on a routine
 * of more than ten thousand steps, so a nested repeat or an imported file used
 * to unmount the whole app on Start with its message unseen. The editor and the
 * importers now refuse such a routine first; this is for whatever still gets
 * through, and for any other render error, so the person is told and can leave.
 *
 * A class, because React has no hook for this.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The one place the app writes to the console: a render error with no
    // stack would be undiagnosable from a screenshot.
    console.error(error, info.componentStack)
  }

  private readonly reset = () => {
    this.setState({ error: null })
    this.props.onReset()
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children
    return (
      <main className="crash">
        <div className="crash__card">
          <h1 className="crash__title">Something went wrong</h1>
          <p className="crash__text">{this.state.error.message}</p>
          <button type="button" className="btn btn--primary" onClick={this.reset}>
            Back to routines
          </button>
        </div>
      </main>
    )
  }
}
