import { useEffect, useRef } from 'react'
import type { Routine, RoutinePosition, Run, TimelineEntry, Workout } from '../engine'
import { groupEntries, groupOf, sectionOf, stepCount, totalDurationMs } from '../engine'
import { audio } from '../audio/engine'
import { useCueScheduler } from '../audio/useCueScheduler'
import { useSpokenCues } from '../audio/useSpokenCues'
import { useMuted } from '../audio/useMuted'
import { useTimer } from '../state/useTimer'
import {
  clock,
  clockWidth,
  duration,
  effortLabel,
  fitBlockCqi,
  fitCqi,
  groupCaption,
  listLines,
  pathLabel,
  wordCount,
} from './format'
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

/**
 * A whole group on screen at once: the round or rung being worked, every step in
 * it, with the current one marked.
 *
 * This is what a rep-based routine needs and a countdown cannot give. You are
 * not told one exercise at a time — you read the next four while you are still
 * on the first, which is how the source handouts are written and how people
 * actually work through them.
 *
 * The list is the innermost group (see `groupEntries`), never the whole section:
 * one round of four, not all four rounds.
 */
function SectionList({
  routine,
  run,
  at,
  secondsLeft,
}: {
  routine: Routine
  run: Run
  at: RoutinePosition
  secondsLeft: number
}) {
  const entry = at.entry
  if (!entry) return null

  const section = sectionOf(entry)
  const rows = groupEntries(routine, entry)
  const caption = groupCaption(groupOf(entry))

  return (
    <div className="sheet">
      <div className="sheet__head">
        {section && <h2 className="sheet__title">{section.label}</h2>}
        {caption && <p className="sheet__caption label">{caption}</p>}
        {section?.note && <p className="sheet__note label label--sm">{section.note}</p>}
      </div>

      {/* Sized to fill the sheet: see `listLines`. A group of four short
          exercises has height going spare, and the rows should use it. */}
      <ol
        className="sheet__list"
        style={{ ['--lines' as string]: listLines(rows, run.entries) }}
      >
        {rows.map((row) => {
          const done = row.step < entry.step
          /*
           * Membership of the current RUN, not equality with one step: a ladder
           * rung is cleared by a single Next, so every exercise in it is being
           * worked at once and all of them are marked.
           */
          const current = run.entries.includes(row)
          return (
            <li
              key={`${row.step}`}
              className="sheet__row"
              data-state={current ? 'current' : done ? 'done' : 'todo'}
              aria-current={current ? 'step' : undefined}
            >
              {/* A timed step counts down once it is the one being worked; until
                  then it shows the time it will take. */}
              <span className="sheet__effort">
                {current && row.durationMs !== undefined ? clock(secondsLeft) : effortLabel(row)}
              </span>
              <span className="sheet__name">
                {row.name}
                {row.alternative && <em className="sheet__alt">or {row.alternative}</em>}
                {/* The how-to only on the row being worked: it is guidance for
                    what you are doing NOW, and printing every step's would push
                    the rest of the group off the screen the list exists to show. */}
                {current && row.note && <em className="sheet__alt">{row.note}</em>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function MediaPanel({ entry, next }: { entry: TimelineEntry; next: TimelineEntry | null }) {
  const src = useMediaUrl(entry.media)
  const nextSrc = useMediaUrl(next?.media)

  /*
   * The instruction when there is one, the name otherwise.
   *
   * The name is already the heading beside this panel, so repeating it wastes
   * the largest text box on the screen. These routines carry their how-to in a
   * trailing parenthetical — "start standing, step out to one side, sink your
   * hips…" — and an exercise you have not done before is exactly when the panel
   * is empty, because it has no illustration either.
   */
  const fallback = entry.note ?? entry.name

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
              ['--fit' as string]: fitCqi(fallback),
              ['--lines' as string]: wordCount(fallback),
            }}
            aria-hidden="true"
          >
            {fallback}
          </span>
        )}
      </div>
      <p className="panel__next label">
        {next ? (
          <>
            Next <b>{next.name}</b>{' '}
            {next.durationMs !== undefined && (
              <span className="unit">{duration(next.durationMs)}</span>
            )}
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
  const { at, status, routine, run } = timer
  const [muted, toggleMuted] = useMuted()

  useCueScheduler({
    // The current RUN: cues are scheduled on one clock, and a gate ends it.
    timeline: run,
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

  /*
   * The section decides, not the step: a 45-second rest inside a rep-based
   * section is still a row in that section's list, and flipping to a full-screen
   * countdown for it and back would be disorienting. A self-paced step outside
   * any section has no other sensible rendering.
   */
  const asList = entry !== null && (sectionOf(entry)?.display === 'list' || entry.selfPaced)

  const phase = `var(--role-${entry?.role ?? 'prepare'})`
  const reps = entry ? pathLabel(entry.path) : ''
  /*
   * A timed step counts down. A self-paced one has nothing to count down to, so
   * it shows its rep target instead — the number the user is actually working
   * to — falling back to time on the step when there is no target either.
   */
  const selfPaced = entry?.selfPaced === true
  const clockText = selfPaced
    ? entry.reps
      ? String(entry.reps.count)
      : clock(timer.secondsSpent)
    : clock(timer.secondsLeft)

  /*
   * Sized from the step's LONGEST string — the value at its top — not from what
   * is on screen right now. Otherwise a 90s step counting through 1:00 to 59
   * drops from 3.5 units to 2 and the numerals jump ~75% larger mid-step.
   * Constant within a step, so the countdown never changes size while running.
   */
  const clockChars =
    entry && entry.durationMs !== undefined
      ? clockWidth(clock(Math.ceil(entry.durationMs / 1000)))
      : selfPaced && entry.reps
        ? clockWidth(String(entry.reps.count))
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
        style={{ ['--progress' as string]: timer.progress }}
        role="progressbar"
        aria-label="Workout progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(timer.progress * 100)}
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
            {/* A gated routine has no elapsed time to report: the clock only
                ever measured one run at a time. */}
            {!routine.hasGates && (
              <span className="stat">
                <b>{duration(routine.totalMs)}</b>
                <span className="label">Elapsed</span>
              </span>
            )}
            <span className="stat">
              <b>{routine.entries.length}</b>
              <span className="label">Steps</span>
            </span>
          </div>
        </div>
      )}

      {entry && asList && (
        <div className="run__sheet">
          <SectionList routine={routine} run={run} at={at} secondsLeft={timer.secondsLeft} />
          <button
            type="button"
            className="chip chip--primary sheet__next"
            onClick={withAudio(timer.next)}
            disabled={status !== 'running' && status !== 'paused'}
          >
            Next
          </button>
        </div>
      )}

      {entry && !asList && (
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
                data-urgent={
                  status === 'running' && at.remainingMs !== null && at.remainingMs <= URGENT_MS
                }
                style={{ ['--chars' as string]: clockChars }}
                aria-live="off"
              >
                {clockText}
              </p>
              <h1
                className="count__name"
                style={{ ['--fit' as string]: fitBlockCqi(entry.name, 3, 11) }}
              >
                {entry.name}
              </h1>
            </div>

            {/* No "Paused" chip — the primary button already reads "Resume". */}
            <p className="count__meta label">
              {timer.totalRemainingMs !== null && (
                <span>
                  <span className="unit">{duration(timer.totalRemainingMs)}</span> left
                </span>
              )}
              <span>
                Step {at.step} / {routine.entries.length}
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
