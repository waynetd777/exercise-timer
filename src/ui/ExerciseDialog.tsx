/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useMemo, useState } from 'react'
import type { BodyArea, Equipment, Exercise, Pattern, Use } from '../routines/exercises'
import { AREA_NAMES, attributesOf, KIT_GROUPS } from '../routines/exercises'
import type { CustomExercise } from '../storage/customExercises'
import { sameExercise, similarExercises } from '../routines/similar'
import { CheckIcon, CloseIcon, PlusIcon } from './icons'
import { useModal } from './useModal'

/**
 * Adding an exercise of your own, or changing one.
 *
 * ASKS FOR FOUR THINGS, not one. A name and a kit would be enough to put a row
 * on the exercises page and keep a weight and a picture against it, and it would
 * NOT be enough to generate a routine with: `generate.ts` builds its pools by
 * area, alternates push against pull, and draws warm-ups from `use`. An exercise
 * the generator cannot see is half an exercise, so the dialog asks for what the
 * generator needs and says why.
 *
 * WARNS BEFORE IT SAVES. The exercise table is 147 movements written by three
 * hands and the instructor spells Bulgarian Split Squat four ways. So the
 * likeliest thing a typed name is, is something already here under another
 * spelling. A second row splits one exercise's weight, picture and measured pace
 * in two. The candidates are offered as BUTTONS, not as prose: taking the
 * exercise you already have has to be cheaper than confirming the new one. See
 * `routines/similar.ts`.
 *
 * A NAME THAT FOLDS ONTO AN EXISTING ONE IS REFUSED, which is a different answer
 * from a warning. The weights, paces and pictures tables are keyed by exactly
 * that folded name, so two rows under one key would fight over one weight and
 * one picture; there is nothing to add, so nothing is offered but the exercise
 * that is already there.
 */

const AREAS: readonly { value: BodyArea; label: string }[] = [
  { value: 'upper', label: AREA_NAMES.upper },
  { value: 'torso', label: AREA_NAMES.torso },
  { value: 'lower', label: AREA_NAMES.lower },
]

/**
 * Push, pull, or neither.
 *
 * Upper body only, exactly as in the shipped table: the alternation the
 * generator copies from Wayne's own routines runs push, pull, push, and legs and
 * core have no direction to alternate. "Neither" is a real answer for an upper
 * body exercise that is both, or is a stretch.
 */
const PATTERNS: readonly { value: Pattern | 'none'; label: string; title: string }[] = [
  { value: 'push', label: 'Push', title: 'Pressing away: a chest press, a shoulder press' },
  { value: 'pull', label: 'Pull', title: 'Pulling towards: a row, a pulldown, a curl' },
  { value: 'none', label: 'Neither', title: 'Both at once, or a stretch' },
]

/**
 * Worked one side at a time, or both together.
 *
 * TWO BUTTONS, not one that changes its own label. A single toggle reading "Both
 * together" cannot say whether that is what the exercise IS or what pressing it
 * would make it, and every other question in this dialog is answered by picking
 * one of a row.
 */
const SIDES: readonly { value: 'one' | 'both'; label: string; title: string }[] = [
  {
    value: 'one',
    label: 'One at a time',
    title: 'A generated routine gives it two sets a side, with a Change Sides step between them',
  },
  { value: 'both', label: 'Both', title: 'Worked with both arms or both legs at once' },
]

const USES: readonly { value: Use; label: string; title: string }[] = [
  { value: 'strength', label: 'Strength', title: 'Working sets. Where most of a routine goes' },
  { value: 'cardio', label: 'Cardio', title: 'A warm-up, or a minute of moving between sets' },
  { value: 'mobility', label: 'Mobility', title: 'A stretch. Warm-ups and cool-downs' },
]

/** A row of choices, one of which is on. `GenerateDialog` has the same shape in its own classes. */
function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly { value: T; label: string; title?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="exdlg__field">
      <legend className="label label--sm">{legend}</legend>
      <div className="exdlg__options">
        {options.map((option) => (
          <button
            key={option.value}
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

export function ExerciseDialog({
  name: typed,
  editing = null,
  table,
  onSave,
  onUse,
  onClose,
}: {
  /** The name to start from: what was typed into a step, or nothing. */
  name: string
  /** The exercise being changed, or null when adding. */
  editing?: CustomExercise | null
  /** Every exercise the app knows, yours included: what a clash or a warning is measured against. */
  table: readonly Exercise[]
  /**
   * Saves it. `from` is the name it had before, when a rename is what happened,
   * so the caller can move the weight and the picture with it.
   */
  onSave: (exercise: CustomExercise, from: string | null) => void
  /**
   * Takes the exercise that is already here instead of adding a new one. Absent
   * where there is nothing to take it onto: the page's own Add button has no step
   * to write a name to, so it only offers to show you the row.
   */
  onUse?: (name: string) => void
  onClose: () => void
}) {
  const { dialog, onBackdropClick } = useModal(onClose)

  const [name, setName] = useState(editing?.name ?? typed.trim())
  const [kit, setKit] = useState<Equipment>(editing?.equipment ?? 'bodyweight')
  const [area, setArea] = useState<BodyArea>(editing?.area ?? 'lower')
  const [pattern, setPattern] = useState<Pattern | 'none'>(editing?.pattern ?? 'none')
  const [use, setUse] = useState<Use>(editing?.use ?? 'strength')
  const [side, setSide] = useState<'one' | 'both'>(editing?.perSide === true ? 'one' : 'both')
  /** True once Add has been pressed and there is something to warn about. */
  const [confirming, setConfirming] = useState(false)

  /*
   * What the checks measure against: everything the app knows, MINUS the exercise
   * being edited. Without that subtraction, opening an exercise of yours and
   * pressing Save would report that it clashes with itself.
   */
  const others = useMemo(
    () => table.filter((exercise) => exercise.name !== editing?.name).map((exercise) => exercise.name),
    [table, editing?.name],
  )

  const trimmed = name.trim()
  /** The exercise this name already IS. Blocks the save; see the doc comment. */
  const clash = useMemo(() => (trimmed === '' ? null : sameExercise(trimmed, others)), [trimmed, others])
  const similar = useMemo(
    () => (trimmed === '' || clash !== null ? [] : similarExercises(trimmed, others)),
    [trimmed, clash, others],
  )
  const attributes = useMemo(() => {
    const found = new Map(table.map((exercise) => [exercise.name, exercise]))
    return (of: string): string => {
      const exercise = found.get(of)
      return exercise ? attributesOf(exercise).slice(0, 2).join(' · ') : ''
    }
  }, [table])

  const built = (): CustomExercise => ({
    name: trimmed,
    area,
    equipment: kit,
    // Only where it means something: `pattern` is upper body only in the shipped
    // table, and a stored `pattern` on a squat would be a field the generator
    // reads and nothing sets honestly.
    ...(area === 'upper' && pattern !== 'none' ? { pattern } : {}),
    // `strength` is what absent means, so it is not written down.
    ...(use !== 'strength' ? { use } : {}),
    ...(side === 'one' ? { perSide: true } : {}),
  })

  const save = () => {
    onSave(built(), editing && editing.name !== trimmed ? editing.name : null)
  }

  const submit = () => {
    // A rename is the only edit that can introduce a name worth warning about;
    // saving an exercise whose name has not moved has nothing new to clash with.
    if (similar.length > 0 && trimmed !== editing?.name) return setConfirming(true)
    save()
  }

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} onClick={onBackdropClick}>
      {/* The panel is its own element: a <dialog> styled as the box does not hug
          its content on iOS. See `.modal` in theme.css. */}
      <div className="exdlg">
        {confirming ? (
          <>
            {/* The act it performs: this screen also reaches a RENAME, where
                "Add" would promise a second row that is not what Save does. */}
            <h2 className="exdlg__title">
              {editing ? <>Rename to “{trimmed}” anyway?</> : <>Add “{trimmed}” anyway?</>}
            </h2>
            <p className="exdlg__why label label--sm">
              {similar.length === 1 ? 'This is already here' : 'These are already here'}. One
              exercise under two names keeps two weights, two pictures and two measured paces, so
              take the one you have if it is the same movement.
            </p>
            <ul className="exdlg__cands">
              {similar.map((found) => (
                <li key={found.name}>
                  {/*
                    A BUTTON per candidate, not a line of text. Where the dialog
                    was opened from a step, pressing one puts that exercise on the
                    step and adds nothing; from the page it shows you the row.
                    Either way it is one tap against retyping.
                  */}
                  <button
                    type="button"
                    className="exdlg__cand"
                    onClick={() => {
                      onUse?.(found.name)
                      onClose()
                    }}
                  >
                    <span className="exdlg__candname">{found.name}</span>
                    <span className="exdlg__candwhy label label--sm">
                      {[found.why === 'typo' ? 'looks like the same name' : 'same movement',
                        attributes(found.name)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="exdlg__actions">
              {/* Back is focused: a stray Enter must not be what adds a duplicate. */}
              <button type="button" className="chip" onClick={() => setConfirming(false)} autoFocus>
                <CloseIcon />
                Back
              </button>
              {/* `chip--primary`, the filled blue the generator's own Generate
                  button uses: this is the affirmative action of the dialog, and
                  `chip--action` is only a lighter label. */}
              <button type="button" className="chip chip--primary" onClick={save}>
                {editing ? <CheckIcon /> : <PlusIcon />}
                {editing ? 'Rename anyway' : 'Add anyway'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="exdlg__title">{editing ? 'Change this exercise' : 'Add an exercise'}</h2>

            <label className="exdlg__field">
              <span className="label label--sm">Name</span>
              <input
                className="exdlg__name"
                value={name}
                aria-label="Exercise name"
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            {clash !== null && (
              <p className="exdlg__clash label label--sm">
                “{clash}” is already here, and this is another way of writing it. Two rows would
                share one weight and one picture.{' '}
                {onUse ? 'Take that one instead:' : 'Search the page for it to set its weight.'}
                {onUse && (
                  <button
                    type="button"
                    className="exdlg__cand"
                    onClick={() => {
                      onUse(clash)
                      onClose()
                    }}
                  >
                    <span className="exdlg__candname">{clash}</span>
                  </button>
                )}
              </p>
            )}

            <Choice
              legend="Kit"
              options={KIT_GROUPS.map((group) => ({ value: group.kit, label: group.label }))}
              value={kit}
              onChange={setKit}
            />

            <Choice legend="What it works" options={AREAS} value={area} onChange={setArea} />

            {/* Upper body only, as in the table. A squat has no direction. */}
            {area === 'upper' && (
              <Choice
                legend="Push or pull"
                options={PATTERNS}
                value={pattern}
                onChange={setPattern}
              />
            )}

            <Choice legend="What it is for" options={USES} value={use} onChange={setUse} />

            <Choice legend="Side" options={SIDES} value={side} onChange={setSide} />

            {/*
              Said once, at the bottom, because it is the answer to "why is it
              asking me all this".
            */}
            <p className="exdlg__why label label--sm">
              The area, the direction and what it is for are what let a generated routine use this
              exercise. Everything here can be changed afterwards.
            </p>

            <div className="exdlg__actions">
              {/* Cancel focused, as everywhere else: the safe answer is the easy one. */}
              <button type="button" className="chip" onClick={onClose} autoFocus>
                <CloseIcon />
                Cancel
              </button>
              <button
                type="button"
                className="chip chip--primary"
                disabled={trimmed === '' || clash !== null}
                onClick={submit}
              >
                {editing ? <CheckIcon /> : <PlusIcon />}
                {editing ? 'Save' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
