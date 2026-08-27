/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Block, Workout } from '../engine/types'
import { EXERCISES } from '../routines/exercises'
import type { BodyArea } from '../routines/exercises'
import { generateRoutine, seeded } from '../routines/generate'
import { SECTIONS_MAX, SECTIONS_MIN, SECTIONS_TYPICAL } from '../routines/exercises.shapes'
import type { EquipmentScope, Recovery, Style } from '../routines/generate'
import { duration, isoDate } from './format'
import { CloseIcon, PlusIcon } from './icons'

/**
 * The lengths a session actually runs to.
 *
 * Tight around the 42 to 45 minutes Wayne's own routines come to, rather than
 * spread from half an hour to a full one: the useful choice is a few minutes
 * either side of a normal session, not a different kind of session.
 */
const LENGTHS = [35, 40, 45, 50]

/**
 * The "surprise me" value for the cardio question.
 *
 * A sentinel rather than a second control, because it is one more thing in a
 * list you are already reading. It cannot collide with an exercise: nothing in
 * the table is named with brackets.
 */
const VARY = '[random]'

const AREAS: { area: BodyArea; label: string }[] = [
  { area: 'upper', label: 'Upper body' },
  { area: 'torso', label: 'Torso' },
  { area: 'lower', label: 'Lower body' },
]

const EQUIPMENT: { value: EquipmentScope; label: string; title: string }[] = [
  { value: 'machine', label: 'Multi-gym', title: 'Only the machine, and only what the guide illustrates' },
  { value: 'none', label: 'No multi-gym', title: 'Bodyweight, bands, dumbbells, kettlebell and trampoline' },
  { value: 'mixed', label: 'Mixed', title: 'Whatever fits best, machine or not' },
]

/**
 * A length in whole seconds.
 *
 * Seconds rather than minutes because two of the three are under two minutes,
 * and a field that reads 1.5 is worse than one that reads 90. Committed as typed
 * and clamped, the same as the editor's own duration field; an emptied box holds
 * its draft rather than snapping to the minimum under the cursor.
 */
function Seconds({
  value,
  label,
  onChange,
}: {
  value: number
  label: string
  onChange: (seconds: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <span className="generate__secs">
      <input
        className="paste__name generate__number"
        type="number"
        min={5}
        max={3600}
        value={draft ?? String(value)}
        aria-label={label}
        onChange={(event) => {
          setDraft(event.target.value)
          const entered = Number(event.target.value)
          if (event.target.value === '' || !Number.isFinite(entered)) return
          onChange(Math.min(3600, Math.max(5, Math.round(entered))))
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="label label--sm" aria-hidden="true">
        s
      </span>
    </span>
  )
}

/** A cardio exercise picked from a list, and how long that slot runs. */
function Cardio({
  legend,
  options,
  value,
  onChange,
  extra,
  seconds,
  onSeconds,
}: {
  legend: string
  options: { name: string }[]
  value: string
  onChange: (value: string) => void
  /** An option the table does not hold, such as Random. */
  extra?: { value: string; label: string }
  seconds: number
  onSeconds: (seconds: number) => void
}) {
  return (
    <label className="generate__field">
      <span className="label label--sm">{legend}</span>
      <span className="generate__pair">
        <select
          className="paste__name"
          value={value}
          aria-label={legend}
          onChange={(event) => onChange(event.target.value)}
        >
          {extra && <option value={extra.value}>{extra.label}</option>}
          {options.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
        <Seconds value={seconds} label={`${legend}, seconds`} onChange={onSeconds} />
      </span>
    </label>
  )
}

/**
 * A row of choices, one of which is on.
 *
 * `chip` rather than a select: there are two or three options, they are all
 * worth reading at once, and a native select on a phone hides them behind a
 * wheel for no gain.
 */
function Choice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: { value: T; label: string; title?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="generate__field">
      <legend className="label label--sm">{legend}</legend>
      <div className="generate__options">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className="chip chip--action"
            aria-pressed={option.value === value}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Build a routine by answering a few questions.
 *
 * The preview is live, and that is the point: the generator is pure and fast, so
 * the length and the exercise list update as the answers change rather than
 * behind a button. You find out that a torso-only machine routine cannot fill an
 * hour BEFORE you generate it, which is the same principle as the paste dialog
 * listing unparsed lines before saving.
 *
 * It hands the routine to the EDITOR rather than the library. A generated
 * routine is a draft: the whole point is to change the parts you disagree with,
 * and everything it produces is steps and sets, which the editor shows.
 */
export function GenerateDialog({
  library,
  onCancel,
  onGenerate,
}: {
  /** Saved routines, which is where a weight for an exercise comes from. */
  library: readonly Workout[]
  onCancel: () => void
  onGenerate: (workout: Workout) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  /**
   * Which shape to build, and it decides which of the other questions apply.
   *
   * A circuit is timed throughout, so it can be asked for a LENGTH. The
   * instructor's shape is mostly self-paced, so it cannot: what it can be asked
   * for is how many sections. Every question below that only makes sense for one
   * of them is hidden for the other, rather than being shown and ignored.
   */
  const [style, setStyle] = useState<Style>('circuit')
  const [sections, setSections] = useState(SECTIONS_TYPICAL)
  const [minutes, setMinutes] = useState(45)
  const [areas, setAreas] = useState<BodyArea[]>(['upper', 'torso', 'lower'])
  const [recovery, setRecovery] = useState<Recovery>('active')
  const [equipment, setEquipment] = useState<EquipmentScope>('machine')
  const [cardio, setCardio] = useState('Cycling')
  const [warmUp, setWarmUp] = useState('Cycling')
  const [coolDown, setCoolDown] = useState('Cycling')
  const [warmUpSecs, setWarmUpSecs] = useState(600)
  const [recoverSecs, setRecoverSecs] = useState(60)
  const [coolDownSecs, setCoolDownSecs] = useState(120)
  /** What Random may draw from. Everything, until it is narrowed. */
  const [pool, setPool] = useState<string[]>(() =>
    EXERCISES.filter((e) => e.use === 'cardio').map((e) => e.name),
  )
  const [sets, setSets] = useState(3)
  const [name, setName] = useState('')
  /**
   * Where the shuffle starts.
   *
   * Random ONCE, when the dialog opens, so two visits are two different
   * routines. It was a constant, which made every first look identical until you
   * pressed Try another: the generator was shuffling correctly and always being
   * handed the same seed to shuffle with.
   *
   * State rather than a fresh draw per render, so changing an answer re-runs the
   * generator without also reshuffling the exercises under you. Try another is
   * the only thing that rerolls.
   */
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31))

  useEffect(() => {
    // Guarded: StrictMode runs effects twice in dev, and showModal() on an
    // already-open dialog throws.
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  const fallback = `Generated - ${isoDate(new Date())}`
  const cardioOptions = useMemo(() => EXERCISES.filter((e) => e.use === 'cardio'), [])

  /*
   * Regenerated on every answer, and cheap enough to do so: the generator is
   * pure arithmetic over a 127-row table. The seed is state, so changing an
   * answer does not silently reroll the exercises as well.
   */
  const result = useMemo(() => {
    if (areas.length === 0) return null
    try {
      return generateRoutine(
        {
          name: name.trim() || fallback,
          style,
          sections,
          totalMs: minutes * 60_000,
          areas,
          recovery,
          ...(recovery === 'active' && cardio !== VARY ? { recoveryExercise: cardio } : {}),
          ...(recovery === 'active' && cardio === VARY ? { recoveryPool: pool } : {}),
          ...(recovery === 'active'
            ? {
                warmUpExercise: warmUp,
                coolDownExercise: coolDown,
                warmUpMs: warmUpSecs * 1000,
                coolDownMs: coolDownSecs * 1000,
              }
            : {}),
          recoveryMs: recoverSecs * 1000,
          equipment,
          sets,
        },
        { library, rng: seeded(seed), now: Date.now() },
      )
    } catch {
      return null
    }
  }, [
    areas,
    cardio,
    coolDown,
    equipment,
    fallback,
    library,
    minutes,
    name,
    pool,
    recovery,
    seed,
    sections,
    sets,
    style,
    warmUp,
    warmUpSecs,
    recoverSecs,
    coolDownSecs,
  ])

  const chosen = useMemo(() => {
    if (!result) return []
    const names: string[] = []
    const walk = (blocks: readonly Block[]): void => {
      for (const block of blocks) {
        if (block.kind !== 'segment') walk(block.children)
        else if (block.role === 'work' && EXERCISES.some((e) => e.name === block.name && e.use !== 'cardio')) {
          if (!names.includes(block.name)) names.push(block.name)
        }
      }
    }
    walk(result.workout.blocks)
    return names
  }, [result])

  const circuit = style === 'circuit'
  const emptyPool = circuit && recovery === 'active' && cardio === VARY && pool.length === 0

  const toggle = (area: BodyArea) =>
    setAreas((current) =>
      current.includes(area) ? current.filter((a) => a !== area) : [...current, area],
    )

  return (
    <dialog ref={dialog} className="modal" onCancel={onCancel} onClose={onCancel}>
      {/* The panel is its own element. See `.modal` in theme.css. */}
      <div className="generate">
        <h2 className="paste__title">Generate a routine</h2>

        <label className="generate__field">
          <span className="label label--sm">Name</span>
          <input
            className="paste__name"
            value={name}
            placeholder={fallback}
            aria-label="Routine name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <Choice
          legend="Shape"
          options={[
            {
              value: 'circuit' as Style,
              label: 'Circuit',
              title: 'One exercise at a time, everything on a clock',
            },
            {
              value: 'sections' as Style,
              label: 'Sections',
              title: 'Named sections and ladders, counted reps, in the shape your routines come in',
            },
          ]}
          value={style}
          onChange={setStyle}
        />

        {style === 'circuit' && (
          <Choice
            legend="About how long"
            options={LENGTHS.map((m) => ({ value: m, label: `${m} min` }))}
            value={minutes}
            onChange={setMinutes}
          />
        )}

        {/*
          Sections rather than minutes, because a routine of counted steps has no
          length: it ends when you have tapped through it.
        */}
        {style === 'sections' && (
          <Choice
            legend="How many sections"
            options={Array.from({ length: SECTIONS_MAX - SECTIONS_MIN + 1 }, (_, i) => ({
              value: SECTIONS_MIN + i,
              label: String(SECTIONS_MIN + i),
            }))}
            value={sections}
            onChange={setSections}
          />
        )}

        <fieldset className="generate__field">
          <legend className="label label--sm">What to work</legend>
          <div className="generate__options">
            {AREAS.map(({ area, label }) => (
              <button
                key={area}
                type="button"
                className="chip chip--action"
                aria-pressed={areas.includes(area)}
                onClick={() => toggle(area)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <Choice
          legend="Equipment"
          options={EQUIPMENT}
          value={equipment}
          onChange={setEquipment}
        />

        {circuit && recovery === 'active' && (
          <Cardio
            legend="Warm up with"
            options={cardioOptions}
            value={warmUp}
            onChange={setWarmUp}
            seconds={warmUpSecs}
            onSeconds={setWarmUpSecs}
          />
        )}

        {circuit && (
          <Choice
            legend="Sets"
            options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            value={sets}
            onChange={setSets}
          />
        )}

        {circuit && (
        <Choice
          legend="Between sets"
          options={[
            { value: 'active' as Recovery, label: 'Keep moving', title: 'A minute of cardio between exercises' },
            { value: 'passive' as Recovery, label: 'Rest', title: 'A minute to recover between exercises' },
          ]}
          value={recovery}
          onChange={setRecovery}
        />
        )}

        {circuit && recovery === 'active' && (
          <Cardio
            legend="Moving how"
            options={cardioOptions}
            value={cardio}
            onChange={setCardio}
            extra={{ value: VARY, label: 'Random, a different one each time' }}
            seconds={recoverSecs}
            onSeconds={setRecoverSecs}
          />
        )}

        {/*
          What Random may draw from, on all by default.
          
          The same multi-select chips as "What to work" rather than a column of
          checkboxes: seventeen checkboxes is seventeen lines, and chips wrap into
          four. Bounding the randomness is the point, since nobody wants a routine
          willing to put burpees in every gap.
        */}
        {circuit && recovery === 'active' && cardio === VARY && (
          <fieldset className="generate__field">
            <legend className="label label--sm">Random, from</legend>
            <div className="generate__options generate__options--pool">
              {cardioOptions.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  className="chip chip--action"
                  aria-pressed={pool.includes(option.name)}
                  onClick={() =>
                    setPool((current) =>
                      current.includes(option.name)
                        ? current.filter((n) => n !== option.name)
                        : [...current, option.name],
                    )
                  }
                >
                  {option.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {circuit && recovery === 'passive' && (
          <label className="generate__field">
            <span className="label label--sm">Resting for</span>
            <Seconds value={recoverSecs} label="Resting for, seconds" onChange={setRecoverSecs} />
          </label>
        )}

        {circuit && recovery === 'active' && (
          <Cardio
            legend="Cool down with"
            options={cardioOptions}
            value={coolDown}
            onChange={setCoolDown}
            seconds={coolDownSecs}
            onSeconds={setCoolDownSecs}
          />
        )}

        {/*
          Live, and before generating rather than after. A torso-only machine
          routine cannot fill an hour, and that is worth knowing while the answer
          can still be changed.
        */}
        <div className="paste__report">
          {areas.length === 0 ? (
            <p className="label label--sm">Pick at least one thing to work.</p>
          ) : recovery === 'active' && cardio === VARY && pool.length === 0 ? (
            <p className="label label--sm">Pick at least one thing to move with.</p>
          ) : result === null ? (
            <p className="label label--sm">Nothing matches that combination.</p>
          ) : (
            <>
              {/*
                A circuit can promise a length. The sections shape cannot, and
                saying "44:40" for a routine that ends when you stop tapping
                would be the dialog inventing it.
              */}
              <p className="label label--sm">
                {chosen.length} {chosen.length === 1 ? 'exercise' : 'exercises'}
                {circuit
                  ? ` · ${duration(result.workout.estimatedTotalMs ?? 0)}`
                  : ` · ${result.workout.blocks.length} sections`}
              </p>
              <p className="generate__list label label--sm">{chosen.join(' · ')}</p>
              {result.notes.map((note) => (
                <p key={note} className="generate__note label label--sm">
                  {note}
                </p>
              ))}
            </>
          )}
        </div>

        <div className="paste__actions">
          <button
            type="button"
            className="chip chip--action"
            disabled={result === null}
            title="The same answers, a different set of exercises"
            onClick={() => setSeed((current) => current + 1)}
          >
            Try another
          </button>
          {/* `chip--primary`, not `btn--primary`: the latter is the 68px SQUARE
              icon button, which clipped this label to "Open in". A labelled
              action is a chip here, the same as the paste dialog's. */}
          <button type="button" className="chip" onClick={onCancel}>
            <CloseIcon />
            Cancel
          </button>
          <button
            type="button"
            className="chip chip--primary"
            disabled={result === null || emptyPool}
            onClick={() => result && !emptyPool && onGenerate(result.workout)}
          >
            <PlusIcon />
            Open in editor
          </button>
        </div>
      </div>
    </dialog>
  )
}
