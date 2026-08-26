/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useRef, useState } from 'react'
import type { Run, TimelineEntry, Workout } from '../engine'
import { groupEntries, groupOf, listMode, sectionOf, stepCount, totalDurationMs } from '../engine'
import { audio } from '../audio/engine'
import { useCueScheduler } from '../audio/useCueScheduler'
import { useSpokenCues } from '../audio/useSpokenCues'
import { unlockSpeech } from '../audio/speech'
import { useMuted } from '../audio/useMuted'
import { useTimer } from '../state/useTimer'
import type { RunStatus } from '../state/useTimer'
import {
  clock,
  clockWidth,
  duration,
  effortLabel,
  effortSuffix,
  fitBlockCqi,
  fitList,
  nameWithEffort,
  fitPanel,
  groupCaption,
  listLines,
  nameLines,
  pathLabel,
  stopwatch,
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
import { ConfirmDialog } from './ConfirmDialog'
import { shortcutApplies } from './keys'
import { useMediaUrl } from './useMediaUrl'
import './run-screen.css'

/** The final three seconds of a step, where the countdown starts to pulse. */
const URGENT_MS = 3_000

/** The one control a rep-based routine is driven by. */
function NextSlab({ onNext, status }: { onNext: () => void; status: RunStatus }) {
  return (
    <button
      type="button"
      className="chip chip--primary sheet__next"
      onClick={onNext}
      disabled={status !== 'running' && status !== 'paused'}
      title="Next (right arrow)"
    >
      Next
    </button>
  )
}

/**
 * A whole group on screen at once: the round or rung being worked, every step in
 * it, with the current one marked.
 *
 * This is what a rep-based routine needs and a countdown cannot give. You are
 * not told one exercise at a time. You read the next four while you are still
 * on the first, which is how the source handouts are written and how people
 * actually work through them.
 *
 * The list is the innermost group (see `groupEntries`), never the whole section:
 * one round of four, not all four rounds.
 */
function SectionList({
  rows,
  run,
  entry,
  secondsLeft,
}: {
  rows: TimelineEntry[]
  run: Run
  entry: TimelineEntry
  secondsLeft: number
}) {
  const section = sectionOf(entry)
  const caption = groupCaption(groupOf(entry))

  return (
    <div className="sheet">
      <div className="sheet__head">
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
              {/* Its own column, so the counts line up with each other rather
                  than with the end of "each side". */}
              <span className="sheet__side">{effortSuffix(row)}</span>
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
   * trailing parenthetical, like "start standing, step out to one side, sink your
   * hips…", and an exercise you have not done before is exactly when the panel
   * is empty, because it has no illustration either.
   *
   * WITH the count, so the two big texts on the screen say the same thing. The
   * heading has read "12 × Bicep Curls" since an EMOM minute became both timed
   * and counted, and a panel reading only "Bicep Curls" beside it looked like a
   * different step rather than the same one twice.
   */
  const fallback = entry.note ?? nameWithEffort(entry)
  /*
   * A note written one item per line is a LIST, and the only thing that writes
   * one is an AMRAP's round. Drawn as bullets under each other rather than run
   * together, because it is read at a glance between burpees.
   *
   * Sized to FILL the frame on both axes either way, but by different maths: see
   * `fitList` for why a list cannot use the closed form a paragraph can.
   */
  const items = fallback.includes('\n') ? fallback.split('\n') : null
  const { fit, lines } = items ? fitList(items) : fitPanel(fallback)

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
        ) : items ? (
          /* NOT aria-hidden, unlike the name below: the round is the only place
             these exercises are written, so it is the panel's own content. */
          <ul className="panel__round" style={{ ['--fit' as string]: fit, ['--lines' as string]: lines }}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          // The step name rather than "No image": plenty of real exercises have
          // no illustration, so this is a normal state. aria-hidden because the
          // name is already the heading beside it.
          <span
            className="panel__empty"
            style={{
              ['--fit' as string]: fit,
              ['--lines' as string]: lines,
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
  const [leaving, setLeaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  useCueScheduler({
    // One run at a time: cues are scheduled on one clock, and a gate ends it.
    routine,
    runIndex: run.index,
    status,
    muted,
    readElapsed: timer.readElapsed,
    generation: timer.generation,
  })

  useSpokenCues(at, status, muted)

  /**
   * Every control unlocks the AudioContext and primes the voice. Both have to
   * happen synchronously inside a user gesture, since mobile browsers refuse
   * otherwise, and both are idempotent, so wrapping all of them is simpler than
   * guessing which tap comes first.
   *
   * The voice needs it for the same reason and in a worse way: the opening line
   * is spoken from an effect and then a timeout, so it is never itself inside the
   * gesture, and iOS drops a page's first utterance when that is the case.
   */
  const withAudio = (action: () => void) => () => {
    audio.unlock()
    unlockSpeech()
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
  const rows = entry ? groupEntries(routine, entry) : []
  const showList = entry !== null && listMode(routine, entry)

  const phase = `var(--role-${entry?.role ?? 'prepare'})`
  const reps = entry ? pathLabel(entry.path) : ''
  // Only for the countdown: the list layout already heads itself with this.
  const section = entry ? (sectionOf(entry)?.label ?? '') : ''
  /*
   * A timed step counts down. A self-paced one has nothing to count down to, so
   * it shows its rep target instead, the number the user is actually working to,
   * falling back to time on the step when there is no target either.
   */
  const selfPaced = entry?.selfPaced === true
  const clockText = selfPaced
    ? entry.reps
      ? String(entry.reps.count)
      : clock(timer.secondsSpent)
    : clock(timer.secondsLeft)

  /*
   * Sized from the step's LONGEST string, the value at its top, not from what
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
    // A dialog owns the keyboard while it is open.
    if (leaving || resetting) return
    // Leave the key alone only if what has focus actually uses it: a button
    // takes Space and Enter, a field takes everything. See `shortcutApplies`.
    if (!shortcutApplies((event.target as HTMLElement | null)?.tagName, event.key)) return

    const act = (run: () => void) => {
      event.preventDefault()
      audio.unlock()
      unlockSpeech()
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

  /*
   * Leaving mid-workout pauses first and asks.
   *
   * The clock stops the moment Back is pressed rather than when the question is
   * answered, so the seconds spent reading it are not charged to the step. If
   * the answer is no, a workout that was running goes back to running. Back was
   * a mistake, and nothing about the run should have changed.
   */
  const wasRunning = useRef(false)
  const inProgress = status === 'running' || status === 'paused'

  const requestExit = () => {
    if (!inProgress) return onExit?.()
    wasRunning.current = status === 'running'
    timer.pause()
    setLeaving(true)
  }

  const stay = () => {
    setLeaving(false)
    if (wasRunning.current) timer.resume()
  }

  /*
   * Reset asks the same way Back does, and for the same reason: it sits one
   * stray tap from throwing away a whole session's place. Same choreography
   * too: pause the moment it is pressed, and a no puts a workout that was
   * running back exactly as it was. A COMPLETE workout resets without asking,
   * like Back leaves one, because there is no place left to lose.
   */
  const requestReset = () => {
    if (status === 'complete') return timer.reset()
    wasRunning.current = status === 'running'
    timer.pause()
    setResetting(true)
  }

  const keepGoing = () => {
    setResetting(false)
    if (wasRunning.current) timer.resume()
  }
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
          <button
            className="btn btn--ghost"
            onClick={requestExit}
            aria-label="Back to routines"
            title="Back to routines"
          >
            <BackIcon />
          </button>
        ) : (
          <span />
        )}
        {/*
          The routine, and under it which section is running.

          Here rather than above the countdown because the header row is `auto`
          and gives way. The count column's own budget has about two points of
          slack in it, so a section name that wrapped to two lines overflowed the
          column and landed on top of both the header and the step count. It also
          puts the section in ONE place for both layouts, which the list heading
          used to duplicate.
        */}
        <div className="run__heading">
          <h1 className="run__title">{workout.name}</h1>
          {section && <p className="label label--sm label--section">{section}</p>}
        </div>

        {/*
          The session stopwatch, in the slot the layout already kept empty for
          symmetry. Peripheral on purpose, since the countdown is the number that
          holds the eye, but it is the ONLY clock a rep-based routine has, since
          those run in the list layout with no countdown at all.
        */}
        {status === 'idle' ? (
          <span />
        ) : (
          <span
            className="run__elapsed"
            title="Time since you started"
            aria-label={`${stopwatch(timer.sessionMs)} elapsed`}
          >
            {stopwatch(timer.sessionMs)}
          </span>
        )}
      </header>

      {/*
        Whole-workout progress, edge to edge under the header rule. Driven by a
        scaled inner element rather than a gradient stop, because a transform
        transitions smoothly and a gradient stop does not. The value only
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
            {/* The time it actually took, which is what the session clock is
                for. It used to be the routine's scheduled length, and was
                omitted entirely for a gated routine, where the question "how
                long did that take" is the only one time can answer. */}
            <span className="stat">
              <b>{duration(timer.sessionMs)}</b>
              <span className="label">Elapsed</span>
            </span>
            <span className="stat">
              <b>{routine.entries.length}</b>
              <span className="label">Steps</span>
            </span>
          </div>
        </div>
      )}

      {entry && showList && (
        <div className="run__sheet">
          <SectionList rows={rows} run={run} entry={entry} secondsLeft={timer.secondsLeft} />
          <NextSlab onNext={withAudio(timer.next)} status={status} />
        </div>
      )}

      {entry && !showList && (
        <div className="run__body">
          {/* The countdown and the name share this column, so both are sized
              against how many lines the name takes. */}
          <div
            className="count"
            style={{ ['--name-lines' as string]: nameLines(nameWithEffort(entry)) }}
          >
            {/* Grouped so the meta row below can be pinned to the bottom of the
                column while this block stays vertically centred. */}
            <div className="count__lead">
              {/* Reps only, since the routine name is in the header now. Omitted
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
              {/* WITH the count it asks for: an EMOM minute is timed AND
                  counted, and this column has no effort field the way a list
                  row does. See `nameWithEffort`. */}
              <h1
                className="count__name"
                style={{ ['--fit' as string]: fitBlockCqi(nameWithEffort(entry), 3, 11) }}
              >
                {nameWithEffort(entry)}
              </h1>
            </div>

            {/* No "Paused" chip: the primary button already reads "Resume". */}
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

          {/* A self-paced step needs the slab wherever it is shown: the icon in
              the control row is not a target you hit mid-effort at arm's length. */}
          {entry.selfPaced && <NextSlab onNext={withAudio(timer.next)} status={status} />}
        </div>
      )}

      {leaving && (
        <ConfirmDialog
          question="Leave this workout?"
          detail="It is paused. Leaving loses your place in it."
          confirmLabel="Leave"
          onConfirm={() => onExit?.()}
          onCancel={stay}
        />
      )}

      {resetting && (
        <ConfirmDialog
          question="Start this workout over?"
          detail="It is paused. Resetting loses your place in it."
          confirmLabel="Reset"
          onConfirm={withAudio(() => {
            setResetting(false)
            timer.reset()
          })}
          onCancel={keepGoing}
        />
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
          onClick={withAudio(requestReset)}
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
