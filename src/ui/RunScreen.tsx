import { useEffect } from 'react'
import type { TimelineEntry, Workout } from '../engine'
import { stepCount, totalDurationMs } from '../engine'
import { audio } from '../audio/engine'
import { useCueScheduler } from '../audio/useCueScheduler'
import { useMuted } from '../audio/useMuted'
import { useTimer } from '../state/useTimer'
import { EffortStrip } from './EffortStrip'
import { clock, clockWidth, duration, fitCqi, pathLabel } from './format'
import { resolveMediaPreview } from './media'
import './run-screen.css'

/** The final three seconds of a step, where the countdown starts to pulse. */
const URGENT_MS = 3_000

function MediaPanel({ entry, next }: { entry: TimelineEntry; next: TimelineEntry | null }) {
  const src = resolveMediaPreview(entry.media)
  const nextSrc = resolveMediaPreview(next?.media)

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
            style={{ ['--fit' as string]: fitCqi(entry.name) }}
            aria-hidden="true"
          >
            {entry.name}
          </span>
        )}
      </div>
      <p className="panel__next label">
        {next ? (
          <>
            Next <b>{next.name}</b> {duration(next.durationMs)}
          </>
        ) : (
          'Last step'
        )}
      </p>
    </aside>
  )
}

export function RunScreen({ workout }: { workout: Workout }) {
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
  const rounds = entry ? pathLabel(entry.path) : ''
  const clockText = clock(timer.secondsLeft)

  return (
    <main className="run" style={{ ['--phase' as string]: phase }}>
      <EffortStrip timeline={timeline} currentIndex={isRunning ? at.index : -1} />

      {status === 'idle' && (
        <div className="rest-state">
          <p className="label">Ready</p>
          <h1 className="rest-state__title">{workout.name}</h1>
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
          <p className="label">Finished</p>
          <h1 className="rest-state__title">Done</h1>
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
            <p className="label">{rounds || workout.name}</p>
            <p
              // Remounting each second restarts the pulse animation, so it
              // lands on the beat instead of drifting against the countdown.
              key={timer.secondsLeft}
              className="count__clock"
              data-urgent={status === 'running' && at.remainingMs <= URGENT_MS}
              style={{ ['--chars' as string]: clockWidth(clockText) }}
              aria-live="off"
            >
              {clockText}
            </p>
            <h1 className="count__name">{entry.name}</h1>
            <p className="count__meta label">
              <span>{duration(at.totalRemainingMs)} left</span>
              <span>
                Step {at.index + 1} of {timeline.entries.length}
              </span>
              {status === 'paused' && <span>Paused</span>}
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
        >
          &#10216;&#10216;
        </button>

        {status === 'idle' && (
          <button className="btn btn--primary" onClick={withAudio(timer.start)}>
            Start
          </button>
        )}
        {status === 'running' && (
          <button className="btn btn--primary" onClick={withAudio(timer.pause)}>
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button className="btn btn--primary" onClick={withAudio(timer.resume)}>
            Resume
          </button>
        )}
        {status === 'complete' && (
          <button className="btn btn--primary" onClick={withAudio(timer.start)}>
            Again
          </button>
        )}

        <button
          className="btn"
          onClick={withAudio(timer.next)}
          disabled={status === 'idle' || status === 'complete'}
          aria-label="Next step"
        >
          &#10217;&#10217;
        </button>

        <button
          className="btn btn--ghost"
          onClick={withAudio(timer.reset)}
          disabled={status === 'idle'}
        >
          Reset
        </button>

        <button
          className="btn btn--ghost"
          onClick={toggleMuted}
          aria-pressed={muted}
          title={muted ? 'Turn sound on' : 'Turn sound off'}
        >
          {muted ? 'Muted' : 'Sound'}
        </button>
      </div>
    </main>
  )
}
