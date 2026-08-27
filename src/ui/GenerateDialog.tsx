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
import type { EquipmentScope, Recovery } from '../routines/generate'
import { duration, isoDate } from './format'
import { CloseIcon, PlusIcon } from './icons'

/** Enough to fill a session, and the lengths Wayne's own routines come to. */
const LENGTHS = [30, 45, 60]

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
  const [minutes, setMinutes] = useState(45)
  const [areas, setAreas] = useState<BodyArea[]>(['upper', 'torso', 'lower'])
  const [recovery, setRecovery] = useState<Recovery>('active')
  const [equipment, setEquipment] = useState<EquipmentScope>('machine')
  const [cardio, setCardio] = useState('Cycling')
  const [sets, setSets] = useState(3)
  const [name, setName] = useState('')
  /** Bumped by "Try another", which is the only thing that should reroll. */
  const [seed, setSeed] = useState(1)

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
          totalMs: minutes * 60_000,
          areas,
          recovery,
          ...(recovery === 'active' ? { recoveryExercise: cardio } : {}),
          equipment,
          sets,
        },
        { library, rng: seeded(seed), now: Date.now() },
      )
    } catch {
      return null
    }
  }, [areas, cardio, equipment, fallback, library, minutes, name, recovery, seed, sets])

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
          legend="About how long"
          options={LENGTHS.map((m) => ({ value: m, label: `${m} min` }))}
          value={minutes}
          onChange={setMinutes}
        />

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
          legend="Between sets"
          options={[
            { value: 'active' as Recovery, label: 'Keep moving', title: 'A minute of cardio between exercises' },
            { value: 'passive' as Recovery, label: 'Rest', title: 'A minute to recover between exercises' },
          ]}
          value={recovery}
          onChange={setRecovery}
        />

        {recovery === 'active' && (
          <label className="generate__field">
            <span className="label label--sm">Moving how</span>
            <select
              className="paste__name"
              value={cardio}
              aria-label="Active recovery"
              onChange={(event) => setCardio(event.target.value)}
            >
              {cardioOptions.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <Choice
          legend="Equipment"
          options={EQUIPMENT}
          value={equipment}
          onChange={setEquipment}
        />

        <Choice
          legend="Sets"
          options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
          value={sets}
          onChange={setSets}
        />

        {/*
          Live, and before generating rather than after. A torso-only machine
          routine cannot fill an hour, and that is worth knowing while the answer
          can still be changed.
        */}
        <div className="paste__report">
          {areas.length === 0 ? (
            <p className="label label--sm">Pick at least one thing to work.</p>
          ) : result === null ? (
            <p className="label label--sm">Nothing matches that combination.</p>
          ) : (
            <>
              <p className="label label--sm">
                {chosen.length} {chosen.length === 1 ? 'exercise' : 'exercises'} ·{' '}
                {duration(result.workout.estimatedTotalMs ?? 0)}
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
          <button type="button" className="btn btn--ghost" onClick={onCancel} aria-label="Close">
            <CloseIcon />
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={result === null}
            onClick={() => result && onGenerate(result.workout)}
          >
            <PlusIcon />
            Open in editor
          </button>
        </div>
      </div>
    </dialog>
  )
}
