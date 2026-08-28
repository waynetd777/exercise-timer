/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useMemo, useState } from 'react'
import type { Block, Workout } from '../engine'
import type { Equipment } from '../routines/exercises'
import { EXERCISES, LOADABLE_GROUPS, loadable } from '../routines/exercises'
import { exerciseKey, withoutStatedLoads } from '../routines/loads'
import { currentWeights, loadWeights, saveWeights, weightFor, withWeight } from '../storage/weights'
import { BackIcon, CloseIcon, HelpIcon } from './icons'
import { ConfirmDialog } from './ConfirmDialog'
import { HelpTray } from './HelpTray'
import { WEIGHTS_HELP } from './help'
import './weights.css'
import { useModal } from './useModal'

/**
 * Where what you lift is written down.
 *
 * A weight belongs to your gym, not to a routine. It lived in each routine
 * before this, so moving up a plate meant editing every routine that named the
 * lift; now a routine that states no weight of its own reads this table every
 * time it is opened, and one number changes all of them.
 *
 * DOZENS OF ROWS, which is why there is a search box. Everything you can put
 * a number against is listed rather than only what you have used, because the
 * page is also how you find out what the multi-gym can do.
 *
 * Blank is a real answer. Every field starts empty, because a guessed weight is
 * worse than no weight: an empty field asks the question instead of answering
 * it wrongly. "Fill from my routines" answers it from evidence.
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

/**
 * One illustration, full size.
 *
 * Its own dialog rather than the editor's: that one carries Remove, which has
 * no meaning here: the picture belongs to the exercise table, not to a step,
 * and nothing on this page can take it away. Everything else is the same
 * `.modal` sheet and `.notice` panel every dialog in the app uses.
 */
function ImageView({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const { dialog, onBackdropClick } = useModal(onClose)

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} onClick={onBackdropClick}>
      <div className="notice weights__view">
        <img className="weights__picture" src={src} alt={name} />
        <p className="notice__text">{name}</p>
        <div className="notice__actions">
          <button type="button" className="chip" onClick={onClose} autoFocus>
            <CloseIcon />
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function WeightsScreen({
  workouts,
  onExit,
  onFollow,
}: {
  workouts: readonly Workout[]
  onExit: () => void
  /** Saves the routines this page rewrote. See `follow` below. */
  onFollow: (workouts: readonly Workout[]) => Promise<void> | void
}) {
  /*
   * The store is held here and written through on every keystroke. Dozens of
   * small strings in localStorage is not worth debouncing, and a settings page
   * that loses the last thing you typed because you closed it too quickly is
   * the one failure that would matter.
   */
  const [weights, setWeights] = useState(loadWeights)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<{ src: string; name: string } | null>(null)
  const [asking, setAsking] = useState(false)
  const [helping, setHelping] = useState(false)

  /*
   * Every illustration here is a BUNDLED one: a short path under `public/`,
   * shipped with the app. No blob to read and nothing to await, so the URL is
   * the base plus the path and the row can render it directly.
   */
  const base = import.meta.env.BASE_URL

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

  /*
   * What is still overriding this page.
   *
   * Every routine written before the page carries its own weight on every step,
   * so it goes on saying 65kg after you have moved to 70. Counted here, and
   * cleared only on the button below: it cannot be undone, and the number is
   * what makes the question answerable.
   *
   * Recomputed on every keystroke in a weight field, which is right: typing a
   * weight for an exercise brings that exercise's steps into scope.
   */
  const overriding = useMemo(() => {
    const table = currentWeights()
    const rewritten: Workout[] = []
    let steps = 0
    for (const workout of workouts) {
      const { workout: next, cleared } = withoutStatedLoads(workout, table)
      if (cleared > 0) {
        rewritten.push(next)
        steps += cleared
      }
    }
    return { rewritten, steps }
    // `weights` is read through `currentWeights()`, not the closure, so it has
    // to be named here for a weight typed just now to bring a routine into scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, weights])

  const follow = () => {
    setAsking(false)
    void onFollow(overriding.rewritten)
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
        {/* In the slot the back button's mirror image leaves, which is why that
            slot was reserved rather than collapsed. */}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setHelping(true)}
          aria-label="Help"
          title="What this screen can do"
        >
          <HelpIcon />
        </button>
      </header>

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
        {overriding.steps > 0 && (
          <button
            className="chip"
            onClick={() => setAsking(true)}
            title="Clear the weights your routines state, so they use this page instead"
          >
            Let {overriding.rewritten.length}{' '}
            {overriding.rewritten.length === 1 ? 'routine' : 'routines'} follow these
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
                      {/*
                        A picture for the 41 multi-gym exercises the guide
                        illustrates, and an empty frame for the rest so the
                        names still line up. Tapping it opens the picture:
                        43 pixels is enough to recognise a station and not
                        enough to see how the seat is set.
                      */}
                      {exercise.media ? (
                        <button
                          type="button"
                          className="weight__thumb"
                          onClick={() =>
                            setViewing({ src: `${base}${exercise.media}`, name: exercise.name })
                          }
                          aria-label={`Picture of ${exercise.name}`}
                          title={`Picture of ${exercise.name}`}
                        >
                          <img src={`${base}${exercise.media}`} alt="" loading="lazy" />
                        </button>
                      ) : (
                        <span className="weight__thumb weight__thumb--none" aria-hidden="true" />
                      )}
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

      {helping && (
        <HelpTray title="Weights" sections={WEIGHTS_HELP} onClose={() => setHelping(false)} />
      )}

      {asking && (
        <ConfirmDialog
          question="Let your routines follow these weights?"
          detail={`${overriding.steps} ${overriding.steps === 1 ? 'step' : 'steps'} in ${
            overriding.rewritten.length
          } ${
            overriding.rewritten.length === 1 ? 'routine' : 'routines'
          } state a weight of their own. Clearing those makes them read this page instead, every time they run. A step for an exercise with no weight here keeps what it has.`}
          confirmLabel={`Clear ${overriding.steps}`}
          onConfirm={follow}
          onCancel={() => setAsking(false)}
        />
      )}

      {viewing && (
        <ImageView src={viewing.src} name={viewing.name} onClose={() => setViewing(null)} />
      )}
    </main>
  )
}
