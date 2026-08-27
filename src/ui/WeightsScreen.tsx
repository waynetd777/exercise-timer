/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useMemo, useState } from 'react'
import type { Block, Workout } from '../engine'
import type { Equipment } from '../routines/exercises'
import { EXERCISES, LOADABLE_GROUPS, loadable } from '../routines/exercises'
import { exerciseKey } from '../routines/loads'
import { loadWeights, saveWeights, weightFor, withWeight } from '../storage/weights'
import { BackIcon } from './icons'
import './weights.css'

/**
 * Where what you lift is written down.
 *
 * A weight belongs to your gym, not to a routine. It lived in each routine
 * before this, so moving up a plate meant editing every routine that named the
 * lift; now a routine that states no weight of its own reads this table every
 * time it is opened, and one number changes all of them.
 *
 * SIXTY-SEVEN ROWS, which is why there is a search box. Everything you can put
 * a number against is listed rather than only what you have used, because the
 * page is also how you find out what the multi-gym can do.
 *
 * Blank is a real answer. Eleven have a starting number from strengthlevel.com;
 * the rest are empty because a guessed weight is worse than no weight, and an
 * empty field asks the question instead of answering it wrongly.
 */

/** What the saved library says you last lifted, for a row with nothing in it. */
function observed(workouts: readonly Workout[]): Map<string, string> {
  const found = new Map<string, string>()
  const ordered = [...workouts].sort(
    (a, b) => (a.lastRunAt ?? a.updatedAt) - (b.lastRunAt ?? b.updatedAt),
  )
  const walk = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      if (block.kind !== 'segment') walk(block.children)
      else if (block.load?.trim()) found.set(exerciseKey(block.name), block.load.trim())
    }
  }
  for (const workout of ordered) walk(workout.blocks)
  return found
}

export function WeightsScreen({
  workouts,
  onExit,
}: {
  workouts: readonly Workout[]
  onExit: () => void
}) {
  /*
   * The store is held here and written through on every keystroke. Sixty-seven
   * small strings in localStorage is not worth debouncing, and a settings page
   * that loses the last thing you typed because you closed it too quickly is
   * the one failure that would matter.
   */
  const [weights, setWeights] = useState(loadWeights)
  const [query, setQuery] = useState('')

  const fromLibrary = useMemo(() => observed(workouts), [workouts])

  const rows = useMemo(() => {
    const wanted = query.trim().toLowerCase()
    const groups: { kit: Equipment; label: string; items: typeof EXERCISES }[] = []
    for (const { kit, label } of LOADABLE_GROUPS) {
      const items = EXERCISES.filter(
        (exercise) =>
          loadable(exercise) &&
          exercise.equipment === kit &&
          (wanted === '' || exercise.name.toLowerCase().includes(wanted)),
      )
      if (items.length > 0) groups.push({ kit, label, items })
    }
    return groups
  }, [query])

  const set = (name: string, value: string) => {
    const next = withWeight(weights, name, value)
    setWeights(next)
    saveWeights(next)
  }

  /*
   * What is in force, not what is stored: a seeded row has a weight without
   * anything having been typed, and the field has to show it or the number the
   * routines are using would be invisible on the page that owns it.
   */
  const shown = (name: string): string => {
    const key = exerciseKey(name)
    return key in weights ? weights[key]! : weightFor(name)
  }

  const missing = EXERCISES.filter(
    (exercise) => loadable(exercise) && !shown(exercise.name) && fromLibrary.has(exerciseKey(exercise.name)),
  )

  const fillFromRoutines = () => {
    let next = weights
    for (const exercise of missing) {
      next = withWeight(next, exercise.name, fromLibrary.get(exerciseKey(exercise.name))!)
    }
    setWeights(next)
    saveWeights(next)
  }

  const total = EXERCISES.filter((e) => loadable(e)).length
  const filled = EXERCISES.filter((e) => loadable(e) && shown(e.name)).length

  return (
    <main className="weights">
      <header className="weights__head">
        <button
          className="btn btn--ghost"
          onClick={onExit}
          aria-label="Back to routines"
          title="Back to routines"
        >
          <BackIcon />
        </button>
        <h1 className="weights__title">Weights</h1>
        <span />
      </header>

      <p className="weights__lede label label--sm">
        What you lift, in one place. A routine that does not state a weight of its own uses these,
        so changing one here changes every routine at once.
      </p>

      <div className="weights__tools">
        <input
          className="weights__search"
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search exercises"
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="weights__count label label--sm">
          {filled} of {total} set
        </span>
        {missing.length > 0 && (
          <button className="chip chip--action" onClick={fillFromRoutines}>
            Fill {missing.length} from my routines
          </button>
        )}
      </div>

      <div className="weights__scroll">
        {rows.length === 0 ? (
          <p className="weights__empty label label--sm">Nothing matches “{query.trim()}”.</p>
        ) : (
          rows.map(({ kit, label, items }) => (
            <section key={kit} className="weights__group">
              <h2 className="weights__kit label label--sm">{label}</h2>
              <ul className="weights__list">
                {items.map((exercise) => {
                  const key = exerciseKey(exercise.name)
                  const hint = fromLibrary.get(key)
                  // An id cannot hold a space, and a folded key is words.
                  const id = `weight-${key.replace(/\s+/g, '-')}`
                  return (
                    <li key={exercise.name} className="weight">
                      <label className="weight__name" htmlFor={id}>
                        {exercise.name}
                      </label>
                      <input
                        id={id}
                        className="weight__field"
                        type="text"
                        inputMode="text"
                        value={shown(exercise.name)}
                        /*
                         * The placeholder is what your own routines have been
                         * using, where they say. Better than "e.g. 60kg": it is
                         * the actual answer, and one tap of Fill takes it.
                         */
                        placeholder={hint ?? 'not set'}
                        aria-label={`Weight for ${exercise.name}`}
                        onChange={(event) => set(exercise.name, event.target.value)}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  )
}
