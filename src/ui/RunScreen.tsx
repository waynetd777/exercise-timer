import { useEffect, useRef } from 'react'
import type { TimelineEntry, Workout } from '../engine'
import { stepCount, totalDurationMs } from '../engine'
import { audio } from '../audio/engine'
import { useCueScheduler } from '../audio/useCueScheduler'
import { useSpokenCues } from '../audio/useSpokenCues'
import { useMuted } from '../audio/useMuted'
import { useTimer } from '../state/useTimer'
import { clock, clockWidth, duration, fitCqi, pathLabel, wordCount } from './format'
import {
  BackIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  ResetIcon,
  SoundOffIcon,
  SoundOnIcon,
} from './icons'
import { useMediaUrl } from './useMediaUrl'
import './run-screen.css'

/** The final three seconds of a step, where the countdown starts to pulse. */
const URGENT_MS = 3_000

function MediaPanel({ entry, next }: { entry: TimelineEntry; next: TimelineEntry | null }) {
  const src = useMediaUrl(entry.media)
  const nextSrc = useMediaUrl(next?.media)

  // Decode the next step's image while this one is still running, or the
  // transition lands on a blank frame at exactly the wrong moment.
  useEffect(() => {
    if (!nextSrc) return
    const img = new Image()
    img.src = nextSrc
  }, [nextSrc])

  return (
    <aside className="panel">
      <div className="panel__frame">
        {src ? (
          <img src={src} alt={entry.name} />
        ) : (
          // The step name rather than "No image": plenty of real exercises have
          // no illustration, so this is a normal state. aria-hidden because the
          // name is already the heading beside it.
          <span
            className="panel__empty"
            style={{
              ['--fit' as string]: fitCqi(entry.name),
              ['--lines' as string]: wordCount(entry.name),
            }}
            aria-hidden="true"
          >
            {entry.name}
          </span>
        )}
      </div>
      <p className="panel__next label">
        {next ? (
          <>
            Next <b>{next.name}</b> <span className="unit">{duration(next.durationMs)}</span>
          </>
        ) : (
          'Last step'
        )}
      </p>
    </aside>
  )
}

type Props = {
  workout: Workout
  /** Back to the library. */
  onExit?: () => void
  /** Called when a run actually begins, so the library can stamp `lastRunAt`. */
  onStarted?: () => void
}

export function RunScreen({ workout, onExit, onStarted }: Props) {
  const timer = useTimer(workout)
  const { at, status, timeline } = timer
  const [muted, toggleMuted] = useMuted()

  useCueScheduler({
    timeline,
    status,
    muted,
    readElapsed: timer.readElapsed,
    generation: timer.generation,
  })

  useSpokenCues(at, status, muted)

  /**
   * Every control unlocks the AudioContext. It has to happen synchronously
   * inside a user gesture — mobile browsers refuse otherwise — and unlock() is
   * idempotent, so wrapping all of them is simpler than guessing which tap
   * comes first.
   */
  const withAudio = (action: () => void) => () => {
    audio.unlock()
    action()
  }

  // `position()` returns the first step at 0ms, so `at.entry` is non-null even
  // before the workout starts. The running body must be gated on status, or
  // idle renders the ready panel and a live countdown at the same time.
  const isRunning = status === 'running' || status === 'paused'
  const entry = isRunning ? at.entry : null

  const phase = `var(--role-${entry?.role ?? 'prepare'})`
  const reps = entry ? pathLabel(entry.path) : ''
  const clockText = clock(timer.secondsLeft)

  /*
   * Sized from the step's LONGEST string — the value at its top — not from what
   * is on screen right now. Otherwise a 90s step counting through 1:00 to 59
   * drops from 3.5 units to 2 and the numerals jump ~75% larger mid-step.
   * Constant within a step, so the countdown never changes size while running.
   */
  const clockChars = entry
    ? clockWidth(clock(Math.ceil(entry.durationMs / 1000)))
    : 2

  /*
   * Keyboard control. A keydown IS a user gesture, so unlocking audio from here
   * works exactly as a tap does.
   *
   * The handler is kept in a ref and the listener registered once: writing it
   * straight into an effect with no dependency array would re-attach on every
   * render, and listing the dependencies would re-attach on every tick.
   */
  const onKeyRef = useRef<(event: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    // Leave the key alone if something focused wants it — space on a button.
    const tag = (event.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT') return

    const act = (run: () => void) => {
      event.preventDefault()
      audio.unlock()
      run()
    }

    switch (event.key) {
      case ' ':
      case 'k':
        return act(status === 'running' ? timer.pause : primaryAction)
      case 'ArrowRight':
        return act(timer.next)
      case 'ArrowLeft':
        return act(timer.previous)
      case 'm':
        return act(toggleMuted)
      default:
        return
    }
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyRef.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const begin = () => {
    onStarted?.()
    timer.start()
  }
  const primaryAction = status === 'paused' ? timer.resume : begin
  const primaryLabel =
    status === 'running'
      ? 'Pause'
      : status === 'paused'
        ? 'Resume'
        : status === 'complete'
          ? 'Start again'
          : 'Start'

  return (
    <main className="run" style={{ ['--phase' as string]: phase }}>
      <header className="run__header">
        {onExit ? (
          <button className="btn btn--ghost" onClick={onExit} aria-label="Back to routines" title="Back to routines">
            <BackIcon />
          </button>
        ) : (
          <span />
        )}
        <h1 className="run__title">{workout.name}</h1>
        <span />
      </header>

      {/*
        Whole-workout progress, edge to edge under the header rule. Driven by a
        scaled inner element rather than a gradient stop, because a transform
        transitions smoothly and a gradient stop does not — the value only
        changes once a second.
      */}
      <div
        className="run__progress"
        style={{
          ['--progress' as string]: timeline.totalMs
            ? at.totalElapsedMs / timeline.totalMs
            : 0,
        }}
        role="progressbar"
        aria-label="Workout progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(
          timeline.totalMs ? (at.totalElapsedMs / timeline.totalMs) * 100 : 0,
        )}
      >
        <span />
      </div>

      {status === 'idle' && (
        <div className="rest-state">
          <p className="rest-state__title">Ready</p>
          <div className="rest-state__stats">
            <span className="stat">
              <b>{duration(totalDurationMs(workout))}</b>
              <span className="label">Total</span>
            </span>
            <span className="stat">
              <b>{stepCount(workout)}</b>
              <span className="label">Steps</span>
            </span>
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="rest-state">
          <p className="rest-state__title">Done</p>
          <div className="rest-state__stats">
            <span className="stat">
              <b>{duration(timeline.totalMs)}</b>
              <span className="label">Elapsed</span>
            </span>
            <span className="stat">
              <b>{timeline.entries.length}</b>
              <span className="label">Steps</span>
            </span>
          </div>
        </div>
      )}

      {entry && (
        <div className="run__body">
          <div className="count">
            {/* Grouped so the meta row below can be pinned to the bottom of the
                column while this block stays vertically centred. */}
            <div className="count__lead">
              {/* Reps only — the routine name is in the header now. Omitted
                  entirely for a flat routine, so the row collapses rather than
                  reserving empty space. */}
              {reps && <p className="label">{reps}</p>}
              <p
                // Remounting each second restarts the pulse animation, so it
                // lands on the beat instead of drifting against the countdown.
                key={timer.secondsLeft}
                className="count__clock"
                data-urgent={status === 'running' && at.remainingMs <= URGENT_MS}
                style={{ ['--chars' as string]: clockChars }}
                aria-live="off"
              >
                {clockText}
              </p>
              <h1 className="count__name">{entry.name}</h1>
            </div>

            {/* No "Paused" chip — the primary button already reads "Resume". */}
            <p className="count__meta label">
              <span>
                <span className="unit">{duration(at.totalRemainingMs)}</span> left
              </span>
              <span>
                Step {at.index + 1} / {timeline.entries.length}
              </span>
            </p>
          </div>

          <MediaPanel entry={entry} next={at.nextEntry} />
        </div>
      )}

      <div className="controls">
        <button
          className="btn"
          onClick={withAudio(timer.previous)}
          disabled={status === 'idle'}
          aria-label="Previous step"
          title="Previous step (left arrow)"
        >
          <PrevIcon />
        </button>

        {/* Icon-only, so every control carries its name in aria-label and title
            rather than on screen. */}
        <button
          className="btn btn--primary"
          onClick={withAudio(status === 'running' ? timer.pause : primaryAction)}
          aria-label={primaryLabel}
          title={`${primaryLabel} (space)`}
        >
          {status === 'running' ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          className="btn"
          onClick={withAudio(timer.next)}
          disabled={status === 'idle' || status === 'complete'}
          aria-label="Next step"
          title="Next step (right arrow)"
        >
          <NextIcon />
        </button>

        <button
          className="btn btn--ghost"
          onClick={withAudio(timer.reset)}
          disabled={status === 'idle'}
          aria-label="Reset"
          title="Reset"
        >
          <ResetIcon />
        </button>

        <button
          className="btn btn--ghost"
          onClick={toggleMuted}
          aria-pressed={muted}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
          title={muted ? 'Turn sound on (m)' : 'Turn sound off (m)'}
        >
          {muted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
      </div>
    </main>
  )
}
