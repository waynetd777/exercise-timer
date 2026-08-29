/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Block, MediaRef, Workout } from '../engine'
import type { Equipment } from '../routines/exercises'
import { EXERCISES, KIT_GROUPS, loadable } from '../routines/exercises'
import { IMAGE_CATALOGUE } from '../routines/imageCatalogue'
import { exerciseKey, withoutStatedLoads } from '../routines/loads'
import { collectImages } from '../editor/images'
import { currentWeights, loadWeights, saveWeights, weightFor, withWeight } from '../storage/weights'
import { chosenPicture, loadPictures, savePictures, withPicture } from '../storage/pictures'
import { sweepOrphans } from '../storage/sweep'
import { storeFile } from '../media/pin'
import { resolveMedia, resolveMediaSync } from '../media/resolveMedia'
import { BackIcon, CloseIcon, HelpIcon, ImageIcon, TrashIcon } from './icons'
import { ConfirmDialog } from './ConfirmDialog'
import { NoticeDialog } from './NoticeDialog'
import { HelpTray } from './HelpTray'
import { ImagePicker } from './editor/ImageDialogs'
import { EXERCISES_HELP } from './help'
import './exercises.css'
import { useModal } from './useModal'

/**
 * The exercises themselves: what each one looks like, and what you lift for it.
 *
 * Both belong to your gym rather than to a routine. The weight lived in each
 * routine before this page existed, so moving up a plate meant editing every
 * routine that named the lift; the picture had it worse, since the guide draws
 * 42 of the 147 movements and the rest could only be pictured by attaching a
 * photo to a step, in every routine, one at a time. Written down here, a routine
 * that says nothing of its own takes both every time it is opened.
 *
 * ALL 147 ARE LISTED, not only the ones you can put a number against: that was
 * the page's old shape, and it left the 79 bodyweight, trampoline and bike
 * exercises with nowhere to keep a picture. The weight field simply does not
 * appear on a row that has nothing to weigh.
 *
 * Blank is a real answer for the weight. Every field starts empty, because a
 * guessed weight is worse than none: an empty field asks the question instead of
 * answering it wrongly. "Fill from my routines" answers it from evidence.
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
 * One exercise's picture, full size, with the two things you can do to it.
 *
 * Its own dialog rather than the editor's `ImageDialog`: that one removes a
 * STEP's picture, and the question here is a different one. Change replaces what
 * this exercise shows everywhere; Use the guide's drops the chosen photo and
 * puts the exercise back on the illustration that ships with the app, which is
 * why it appears only where there is one to go back to.
 *
 * Everything else is the same `.modal` sheet and `.notice` panel every dialog in
 * the app uses.
 */
function PictureDialog({
  src,
  name,
  chosen,
  guide,
  onChange,
  onClear,
  onClose,
}: {
  src: string | null
  name: string
  /** True where the picture shown is this page's, not the guide's. */
  chosen: boolean
  /** True where the guide illustrates this exercise. */
  guide: boolean
  onChange: () => void
  onClear: () => void
  onClose: () => void
}) {
  const { dialog, onBackdropClick } = useModal(onClose)

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} onClick={onBackdropClick}>
      <div className="notice exview">
        {src ? (
          <img className="exview__picture" src={src} alt={name} />
        ) : (
          /* A ref whose bytes are not on this device: a backup restored without
             its photos. Saying so beats an empty frame, and Change is offered
             anyway. */
          <p className="exview__missing label label--sm">
            This picture is not on this device, so it cannot be shown.
          </p>
        )}
        <p className="notice__text">{name}</p>
        {chosen && (
          <p className="notice__detail label label--sm">
            Shown by every routine that names this exercise and carries no picture of its own.
          </p>
        )}
        <div className="notice__actions">
          {/* Close first and focused, so a stray Enter keeps the picture. The
              same order, for the same reason, as every other dialog here. */}
          <button type="button" className="chip" onClick={onClose} autoFocus>
            <CloseIcon />
            Close
          </button>
          <button type="button" className="chip chip--action" onClick={onChange}>
            <ImageIcon />
            Change
          </button>
          {chosen && (
            <button type="button" className="chip chip--danger" onClick={onClear}>
              <TrashIcon />
              {guide ? "Use the guide's" : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}

/**
 * One row's picture: the exercise's own, the guide's, or an empty frame.
 *
 * Takes a plain `src`, deliberately. The obvious shape was `useMediaUrl(media)`
 * here, one hook per row, and it made the page unusable: 147 rows each resolving
 * asynchronously means 147 state updates, each re-rendering all 147 rows. The
 * resolving is done ONCE for the whole page instead; see `srcOf` below.
 */
function Thumb({
  src,
  has,
  name,
  onOpen,
}: {
  src: string | null
  /** There is a picture, even if its bytes are not on this device. */
  has: boolean
  name: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="exrow__thumb"
      data-empty={has ? undefined : true}
      onClick={onOpen}
      aria-label={has ? `Picture of ${name}. Change it.` : `Add a picture of ${name}`}
      title={has ? `Picture of ${name}` : `Add a picture of ${name}`}
    >
      {/* An EMPTY FRAME where there is no picture, drawn in CSS rather than with
          an icon element. 105 of the 147 exercises have none, and an icon each
          is four hundred nodes of nothing: it slowed the page's own tests down
          more than it told anyone anything. See `.exrow__thumb[data-empty]`. */}
      {src && <img src={src} alt="" loading="lazy" />}
    </button>
  )
}

export function ExercisesScreen({
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
  /*
   * The picture table, held and written through exactly as the weights are. Both
   * are small, both are yours, and a settings page that loses the last thing you
   * did because you closed it too quickly is the one failure that would matter.
   */
  const [pictures, setPictures] = useState(loadPictures)
  const [query, setQuery] = useState('')
  /** The exercise whose picture is open, by name. */
  const [viewing, setViewing] = useState<string | null>(null)
  /** The exercise a picture is being CHOSEN for. The editor's own picker does it. */
  const [choosing, setChoosing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [helping, setHelping] = useState(false)

  const fromLibrary = useMemo(() => observed(workouts), [workouts])

  /*
   * The catalogue the picker offers, plus whatever the routines already use.
   * Built once: `collectImages` walks the whole library.
   */
  const knownImages = useMemo(
    () => collectImages(workouts, IMAGE_CATALOGUE, import.meta.env.BASE_URL),
    [workouts],
  )

  const rows = useMemo(() => {
    const wanted = query.trim().toLowerCase()
    const groups: { kit: Equipment; label: string; items: typeof EXERCISES }[] = []
    // EVERY kit, not only the ones you can weigh: a press-up has no number and
    // still has a picture. `KIT_GROUPS` is the same ordering the editor's name
    // field uses.
    for (const { kit, label } of KIT_GROUPS) {
      const items = EXERCISES.filter(
        (exercise) =>
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
   * A picture chosen, or cleared. `null` puts the exercise back on the guide's
   * illustration where there is one.
   *
   * The BYTES of an uploaded photo are already in IndexedDB by the time this
   * runs, written by `storeFile`. Nothing pins them: unlike an editor draft, this
   * table is saved in the same breath, so there is no window in which a sweep
   * could see the hash as unreferenced. See `storage/pictures.ts`.
   */
  const setPicture = (name: string, ref: MediaRef | null) => {
    const next = withPicture(pictures, name, ref)
    setPictures(next)
    savePictures(next)
    // A photo taken off the page, or replaced, has no owner left unless a
    // routine states it. Swept now: it used to sit in IndexedDB until some
    // unrelated routine was deleted.
    const before = chosenPicture(pictures, name)
    if (before !== undefined && before.source !== 'bundled' && before !== ref) {
      void sweepOrphans(next).catch(() => {})
    }
  }

  const upload = async (name: string, file: Blob) => {
    try {
      setPicture(name, await storeFile(file))
      setChoosing(null)
    } catch {
      setNotice('That image could not be read. Try another one.')
    }
  }

  /**
   * What each row shows: the exercise's own picture, else the guide's.
   *
   * ONE map, rebuilt only when the table changes, and the identity of what it
   * holds matters as much as the value. `useMediaUrl` keys its effect on the ref
   * object, so building `{ source: 'bundled', path }` per render gave all 147
   * rows a new ref every time, which re-armed 147 effects, which set state,
   * which rendered again: the page span rather than opened, and its tests timed
   * out. Memoised, each row's effect runs once.
   *
   * Read from the component's own copy of the table rather than through
   * `pictureFor`, which reads SAVED storage: a picture just cleared must not come
   * straight back out of that cache.
   */
  const shownPictures = useMemo(() => {
    const map = new Map<string, MediaRef>()
    for (const exercise of EXERCISES) {
      const own = chosenPicture(pictures, exercise.name)
      if (own) map.set(exercise.name, own)
      else if (exercise.media) map.set(exercise.name, { source: 'bundled', path: exercise.media })
    }
    return map
  }, [pictures])

  const pictureOf = (name: string): MediaRef | undefined => shownPictures.get(name)

  /*
   * Every row's image URL, resolved for the page rather than by the row.
   *
   * Two passes, the same two `useMediaUrl` makes for one image, done here for
   * all of them at once. The synchronous pass answers for every bundled
   * illustration immediately, so the guide's 42 paint on the first frame; the
   * effect then reads whatever needs a blob out of IndexedDB, and there is ONE
   * state update at the end of it rather than one per row.
   */
  const base = import.meta.env.BASE_URL
  const syncSrc = useMemo(() => {
    const map = new Map<string, string>()
    for (const [name, ref] of shownPictures) {
      const src = resolveMediaSync(ref, base)
      if (src) map.set(name, src)
    }
    return map
  }, [shownPictures, base])

  const [blobSrc, setBlobSrc] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    // Only what the synchronous pass could not answer: an uploaded photo, or a
    // pinned copy of a link. Usually a handful, and often none at all.
    const pending = [...shownPictures].filter(([name]) => !syncSrc.has(name))
    if (pending.length === 0) {
      /*
       * Nothing needs a blob any more, so whatever the last table left here has
       * to GO. Returning early instead is what made a removed photo carry on
       * being shown: this map is consulted first, and it still held the URL of
       * the picture that had just been taken away.
       */
      setBlobSrc((current) => (current.size === 0 ? current : new Map()))
      return
    }

    let live = true
    void Promise.all(
      // One read per row, and `resolveMedia` never rejects, so a photo that
      // cannot be read costs its own row and not the other twenty-nine.
      pending.map(async ([name, ref]) => [name, await resolveMedia(ref, base)] as const),
    ).then((pairs) => {
      if (!live) return
      const map = new Map<string, string>()
      for (const [name, src] of pairs) if (src) map.set(name, src)
      setBlobSrc(map)
    })
    return () => {
      live = false
    }
  }, [shownPictures, syncSrc, base])

  /*
   * The synchronous answer first, then the blob one, and NEITHER for an exercise
   * that no longer has a picture: both maps are rebuilt from `shownPictures`,
   * but the effect that fills the second one lands a frame later, so the guard
   * is what makes a removal show immediately.
   */
  const srcOf = (name: string): string | null => {
    if (!shownPictures.has(name)) return null
    return syncSrc.get(name) ?? blobSrc.get(name) ?? null
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
    // The saves run one after another in App, so a failure part-way leaves the
    // earlier routines rewritten and the rest as they were. Said here, on the
    // page that asked, rather than left as an unhandled rejection.
    void Promise.resolve(onFollow(overriding.rewritten)).catch((cause: unknown) => {
      const reason = cause instanceof Error ? cause.message : 'Could not save'
      setNotice(`${reason}. The routines not yet rewritten still state their own weights; try again.`)
    })
  }

  const total = EXERCISES.filter((e) => loadable(e)).length
  const filled = EXERCISES.filter((e) => loadable(e) && shown(e.name)).length
  /* Counted over ALL of them, and the guide's own illustrations count: the
     question the number answers is "how many exercises can I see", not "how many
     have I photographed". */
  const pictured = EXERCISES.filter((e) => pictureOf(e.name) !== undefined).length

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
        <h1 className="weights__title">Exercises</h1>
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
          {filled} of {total} weighed · {pictured} of {EXERCISES.length} pictured
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
                        The picture, and the way to change it. 43 pixels is
                        enough to recognise a station and not enough to see how
                        the seat is set, so the tap opens it full size.
                      */}
                      <Thumb
                        src={srcOf(exercise.name)}
                        has={pictureOf(exercise.name) !== undefined}
                        name={exercise.name}
                        onOpen={() =>
                          pictureOf(exercise.name)
                            ? setViewing(exercise.name)
                            : setChoosing(exercise.name)
                        }
                      />
                      {/*
                        A `<label>` only where there is a field for it to point
                        at. On a row with nothing to weigh it would be a label
                        for an element that does not exist: invalid, and slow, since
                        resolving one walks the document.
                      */}
                      {loadable(exercise) ? (
                        <label className="weight__name" htmlFor={id}>
                          {exercise.name}
                        </label>
                      ) : (
                        <span className="weight__name">{exercise.name}</span>
                      )}
                      {/*
                        Only where there is something to weigh. A press-up is
                        loaded to your own bodyweight and the trampoline to
                        nothing, so a field there would be a question with no
                        answer; the row keeps the column so the names still line
                        up down the page.
                      */}
                      {loadable(exercise) ? (
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
                      ) : (
                        <span className="weight__field weight__field--none" aria-hidden="true" />
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {helping && (
        <HelpTray title="Exercises" sections={EXERCISES_HELP} onClose={() => setHelping(false)} />
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

      {viewing !== null && (
        <PictureDialog
          src={srcOf(viewing)}
          name={viewing}
          chosen={chosenPicture(pictures, viewing) !== undefined}
          guide={EXERCISES.find((e) => e.name === viewing)?.media !== undefined}
          onChange={() => {
            setChoosing(viewing)
            setViewing(null)
          }}
          onClear={() => {
            setPicture(viewing, null)
            setViewing(null)
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {/*
        The EDITOR's picker, unchanged: the same catalogue, the same upload and
        the same paste-from-clipboard. The question "which picture" is one
        question, and a second dialog asking it would be a second set of answers
        to keep in step.
      */}
      {choosing !== null && (
        <ImagePicker
          images={knownImages}
          onPick={(ref) => {
            setPicture(choosing, ref)
            setChoosing(null)
          }}
          onUpload={(file) => void upload(choosing, file)}
          onError={setNotice}
          onClose={() => setChoosing(null)}
        />
      )}

      {/* A SIBLING of the picker, never a child: `close` reaches React's
          handlers on the way up, so a notice nested inside would fire the
          picker's own onClose. Same arrangement as the editor. */}
      {notice !== null && (
        <NoticeDialog text={notice} busy={false} onClose={() => setNotice(null)} />
      )}
    </main>
  )
}
