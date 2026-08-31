/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Block, MediaRef, Workout } from '../engine'
import type { Equipment, Exercise } from '../routines/exercises'
import { attributesOf, KIT_GROUPS, loadable } from '../routines/exercises'
import { exerciseKey, withoutStatedLoads } from '../routines/loads'
import type { KnownImage } from '../editor/images'
import { currentWeights, loadWeights, saveWeights, weightFor, withWeight } from '../storage/weights'
import { chosenPicture, loadPictures, picturesOver, savePictures, withPicture } from '../storage/pictures'
import type { CustomExercise } from '../storage/customExercises'
import {
  addCustom,
  customList,
  isCustom,
  loadCustomExercises,
  removeCustom,
  saveCustomExercises,
  withCustom,
} from '../storage/customExercises'
import { renamePace } from '../storage/paces'
import { renameInWorkout } from '../routines/rename'
import { sweepOrphans } from '../storage/sweep'
import { storeFile } from '../media/pin'
import { resolveMedia, resolveMediaSync } from '../media/resolveMedia'
import { BackIcon, CloseIcon, HelpIcon, ImageIcon, PencilIcon, PlusIcon, TrashIcon } from './icons'
import { ConfirmDialog } from './ConfirmDialog'
import { NoticeDialog } from './NoticeDialog'
import { ExerciseDialog } from './ExerciseDialog'
import { HelpTray } from './HelpTray'
import { ImagePicker, ImageSheet } from './editor/ImageDialogs'
import { EXERCISES_HELP } from './help'
import './exercises.css'
import { foldName } from '../routines/foldName'

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
 * ALL OF THEM ARE LISTED, not only the ones you can put a number against: that
 * was the page's old shape, and it left the 79 bodyweight, trampoline and bike
 * exercises with nowhere to keep a picture. The weight field simply does not
 * appear on a row that has nothing to weigh.
 *
 * AND IT IS NOT A FIXED LIST ANY MORE. The app's own exercises are read-only:
 * they come off the Horizon guide and out of the instructor's routines, and this
 * device does not get to edit them. Yours can be added, changed and removed
 * here, and everywhere the app reads the table it reads both: the editor's name
 * field offers them, the generator programmes them, and a rename carries the
 * weight, the picture and the measured pace with it. See
 * `storage/customExercises.ts`.
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
 * The sheet, the picture and the line that stands in for a missing one are the
 * editor's `ImageSheet`; only what is said and offered underneath is this one's.
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
  return (
    <ImageSheet src={src} alt={name} onClose={onClose}>
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
    </ImageSheet>
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
  knownImages,
  onExit,
  onFollow,
}: {
  workouts: readonly Workout[]
  /** The catalogue plus every image the routines use, collected once by App. */
  knownImages: readonly KnownImage[]
  onExit: () => void
  /**
   * Saves the routines this page rewrote: weights cleared so they follow this
   * page (see `follow`), or an exercise of yours renamed in the steps that name
   * it. Both are the same act: this page changing routines it does not own. So
   * they go out the same way.
   */
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
  /*
   * The exercises you added, held and written through exactly as the other two
   * are. The app's own table is a build-time constant and is not in here.
   */
  const [custom, setCustom] = useState(loadCustomExercises)
  const [query, setQuery] = useState('')
  /** The exercise whose picture is open, by name. */
  const [viewing, setViewing] = useState<string | null>(null)
  /** The exercise a picture is being CHOSEN for. The editor's own picker does it. */
  const [choosing, setChoosing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [helping, setHelping] = useState(false)
  /**
   * The kits whose rows are showing. EMPTY to begin with: all of them open at
   * once is 147 rows, and the page opened three screens deep in the multi-gym
   * with the kettlebell and the bands nowhere in sight. Seven headings is the
   * whole page, and you open the one you are standing at.
   *
   * ONE AT A TIME, EXCEPT IN A SEARCH. Opening a kit closes whichever was open, so
   * the page is always seven headings plus one kit's rows and the heading you want
   * is never a scroll away. Results are the exception: a search opens every kit
   * that matched, because the answer to "where is this exercise" is the whole list
   * of them at once. A heading pressed during a search folds just that kit away
   * and leaves the rest of the results showing.
   */
  const [opened, setOpened] = useState<ReadonlySet<Equipment>>(new Set())
  /** Adding one, or changing one of yours: the dialog is the same one. */
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CustomExercise | null>(null)
  /** The exercise of yours a removal is being confirmed for, by name. */
  const [removing, setRemoving] = useState<CustomExercise | null>(null)
  /**
   * A rename that has been saved, and the steps in the library still calling the
   * exercise by its old name.
   *
   * The exercise is renamed the moment Save is pressed; this is the SECOND
   * question, about routines already written, and it is asked separately because
   * the answer is genuinely either: a step that says "Bugarian Split Squat"
   * should be put right, and one deliberately named something else should not.
   */
  const [renamed, setRenamed] = useState<{ from: string; to: string } | null>(null)

  /*
   * A SEARCH OPENS EVERYTHING, and clearing it puts the page back as it was.
   *
   * Typing "press" and getting seven collapsed headings would be a search that
   * hides its own results. The effect runs on the flip rather than per keystroke,
   * and one set of state means the headings still toggle while a query is up.
   */
  const searching = query.trim() !== ''
  useEffect(() => {
    setOpened(searching ? new Set(KIT_GROUPS.map((group) => group.kit)) : new Set())
  }, [searching])

  const fromLibrary = useMemo(() => observed(workouts), [workouts])

  /**
   * The whole vocabulary: the app's, then yours.
   *
   * ONE list from here on, so nothing on this page has to ask which half an
   * exercise came from except the two controls only yours have. Shipped first,
   * which is also what makes the app's record win if a harvest ever adds a name
   * you had already typed; see `readCustomExercises`.
   */
  const table = useMemo(() => withCustom(customList(custom)), [custom])

  const rows = useMemo(() => {
    const wanted = query.trim().toLowerCase()
    const groups: { kit: Equipment; label: string; items: Exercise[] }[] = []
    // EVERY kit, not only the ones you can weigh: a press-up has no number and
    // still has a picture. `KIT_GROUPS` is the same ordering the editor's name
    // field uses.
    for (const { kit, label } of KIT_GROUPS) {
      const items = table.filter(
        (exercise) =>
          exercise.equipment === kit &&
          (wanted === '' || exercise.name.toLowerCase().includes(wanted)),
      )
      if (items.length > 0) groups.push({ kit, label, items })
    }
    return groups
  }, [query, table])

  /** True where the exercise is one of yours: the two controls no other row has. */
  const mine = (name: string): boolean => isCustom(custom, name)

  /** How many of a kit's exercises you added. Counted per heading, on 7 groups. */
  const yoursIn = (items: readonly Exercise[]): number =>
    items.reduce((count, exercise) => (mine(exercise.name) ? count + 1 : count), 0)

  /**
   * Moves whatever a per-device table keys by name, for a rename.
   *
   * The weights and the pictures are held here, so they move here; the measured
   * pace is nobody's state and moves through `renamePace`. Without all three, a
   * renamed exercise would keep its row and lose its number, its photo and its
   * pace to a key nothing asks about again.
   */
  const carryOver = (from: string, to: string) => {
    const fromKey = foldName(from)
    const toKey = foldName(to)
    if (fromKey === toKey) return
    const load = weights[fromKey]
    if (load !== undefined) {
      const next = { ...weights }
      delete next[fromKey]
      next[toKey] = load
      setWeights(next)
      saveWeights(next)
    }
    const picture = pictures[fromKey]
    if (picture !== undefined) {
      const next = { ...pictures }
      delete next[fromKey]
      next[toKey] = picture
      setPictures(next)
      savePictures(next)
    }
    renamePace(from, to)
  }

  /**
   * One of yours, added or changed.
   *
   * A rename is a REPLACE, not an edit in place: the table is keyed by folded
   * name, so the old key has to go or the exercise would be listed twice. What
   * the old name owned follows it over, and the steps already written are the
   * second question, asked separately below.
   */
  const saveExercise = (exercise: CustomExercise, from: string | null) => {
    const next = addCustom(from === null ? custom : removeCustom(custom, from), exercise)
    setCustom(next)
    saveCustomExercises(next)
    setAdding(false)
    setEditing(null)
    // Its kit opens, or the exercise you just added would land inside a closed
    // section and look as though nothing had happened.
    setOpened(new Set([exercise.equipment]))
    if (from !== null) {
      carryOver(from, exercise.name)
      setRenamed({ from, to: exercise.name })
    }
  }

  /**
   * One of yours, removed.
   *
   * Its weight and its picture go with it: they are keyed by a name the app no
   * longer knows, and leaving them would be invisible clutter that a re-add would
   * silently inherit. Its photo is swept, as clearing a picture sweeps one.
   *
   * STEPS ALREADY WRITTEN KEEP THE NAME. They are just text again, exactly as a
   * typed name was before this page could hold it, so nothing in the library
   * breaks and nothing is silently rewritten by a removal.
   */
  const removeExercise = (exercise: CustomExercise) => {
    const key = foldName(exercise.name)
    const table_ = removeCustom(custom, exercise.name)
    setCustom(table_)
    saveCustomExercises(table_)
    setRemoving(null)

    if (weights[key] !== undefined) {
      const next = { ...weights }
      delete next[key]
      setWeights(next)
      saveWeights(next)
    }
    const picture = pictures[key]
    if (picture !== undefined) {
      const next = { ...pictures }
      delete next[key]
      setPictures(next)
      savePictures(next)
      if (picture.source !== 'bundled') void sweepOrphans(next).catch(() => {})
    }
  }

  /**
   * The steps still calling a renamed exercise by its old name, and the routines
   * they are in. Counted only while the question is on screen.
   */
  const stale = useMemo(() => {
    if (renamed === null) return { rewritten: [] as Workout[], steps: 0 }
    const rewritten: Workout[] = []
    let steps = 0
    for (const workout of workouts) {
      const { workout: next, renamed: count } = renameInWorkout(workout, renamed.from, renamed.to)
      if (count > 0) {
        rewritten.push(next)
        steps += count
      }
    }
    return { rewritten, steps }
  }, [renamed, workouts])

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
   * object, so building a bundled ref per render gave all 147
   * rows a new ref every time, which re-armed 147 effects, which set state,
   * which rendered again: the page span rather than opened, and its tests timed
   * out. Memoised, each row's effect runs once.
   *
   * Read from the component's own copy of the table rather than through
   * `pictureFor`, which reads SAVED storage: a picture just cleared must not come
   * straight back out of that cache.
   */
  const shownPictures = useMemo(() => picturesOver(pictures), [pictures])

  const pictureOf = (name: string): MediaRef | undefined => shownPictures.get(foldName(name))

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
    // Every map here is keyed as `picturesOver` keys: by folded name.
    const key = foldName(name)
    if (!shownPictures.has(key)) return null
    return syncSrc.get(key) ?? blobSrc.get(key) ?? null
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

  const missing = table.filter(
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

/*
 * NO "n of n weighed, n of n pictured" HERE ANY MORE. It read as a completeness
 * score for a page nobody is meant to complete: most of these exercises you will
 * never do, blank is a real answer for a weight, and the number quietly asked
 * you to fill in 68 of them. Each kit's heading carries its own count, which
 * answers the only question the total was really being asked: how much is in
 * here. "Fill n from my routines" still says when there is something to do.
 */

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
        <span className="search">
          <input
            className="weights__search"
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search exercises"
            onChange={(event) => setQuery(event.target.value)}
          />
          {/* Ours rather than the browser's, which WebKit hides the moment the
              field loses focus. See `.search` in theme.css. */}
          {query !== '' && (
            <button
              type="button"
              className="search__clear"
              aria-label="Clear the search"
              title="Clear the search"
              onClick={() => setQuery('')}
            >
              <CloseIcon />
            </button>
          )}
        </span>
        {/* First of the actions: it is the one that is always available, and the
            other two appear only when there is something for them to do. */}
        <button
          className="chip chip--action"
          onClick={() => setAdding(true)}
          /* "New", with a plus, as the library's own New is: this page adds
             exercises the way that one adds routines, and one word for one act
             beats two names for it. The title says what is new. */
          aria-label="New exercise"
          title="An exercise the app does not have"
        >
          <PlusIcon />
          New
        </button>
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
            /*
             * A native `<details>`, like every dialog here is a native
             * `<dialog>`: the open state, the keyboard and what a screen reader
             * announces come free. `open` is driven from state and the summary's
             * default action is prevented, which is the way a controlled
             * `<details>` is written.
             */
            <details key={kit} className="weights__group" open={opened.has(kit)}>
              <summary
                className="weights__kit label label--sm"
                onClick={(event) => {
                  event.preventDefault()
                  setOpened((current) => {
                    /*
                     * In RESULTS, each heading is its own: everything that matched
                     * is open, and folding one away must not take the other six
                     * with it.
                     */
                    if (searching) {
                      const next = new Set(current)
                      if (!next.delete(kit)) next.add(kit)
                      return next
                    }
                    /*
                     * Otherwise opening REPLACES rather than adds: closing what
                     * was open is the whole point. Pressing the open one closes it
                     * and leaves the page on its headings.
                     */
                    return current.has(kit) ? new Set() : new Set([kit])
                  })
                }}
              >
                {label}
                {/*
                  How many are in there, which is the one thing a closed section
                  cannot show you, and how many of those are yours.

                  "(2 yours)" only where there are some. On the four kits you have
                  never added to it would be "(0 yours)" seven times over, which is
                  noise standing in for information.
                */}
                <span className="weights__kitcount">
                  {items.length}
                  {yoursIn(items) > 0 && ` (${yoursIn(items)} yours)`}
                </span>
              </summary>
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
                      <span className="weight__text">
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
                          What the table knows besides the name: the area, the
                          push or pull, the station, the attachment, whether it is
                          worked a side at a time. It was all invisible here, and
                          it is what a person is actually asking when they
                          cannot tell two rows apart. On a row of yours it is
                          also the only proof that your answers went in.
                        */}
                        <span className="weight__attrs label label--sm">
                          {mine(exercise.name) && (
                            <>
                              {/*
                                Yours, said in a word rather than an icon: the two
                                controls beside it exist on no other row, so the
                                marker has to explain them, and an icon would need
                                a legend to do that.
                              */}
                              <span className="weight__pill">Yours</span>
                              {/*
                                NAMED, both of them. The visible word is "Edit"
                                on every row that has one, and a screen reader
                                reading a page of buttons all called Edit cannot
                                say which exercise it is on. The label STARTS with
                                the visible word, so the two still agree.
                              */}
                              <button
                                type="button"
                                className="weight__act"
                                onClick={() => setEditing(custom[foldName(exercise.name)] ?? null)}
                                aria-label={`Edit ${exercise.name}`}
                                title={`Edit ${exercise.name}`}
                              >
                                <PencilIcon />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="weight__act"
                                onClick={() => setRemoving(custom[foldName(exercise.name)] ?? null)}
                                aria-label={`Remove ${exercise.name}`}
                                title={`Remove ${exercise.name}`}
                              >
                                <TrashIcon />
                                Remove
                              </button>
                            </>
                          )}
                          {attributesOf(exercise).join(' · ')}
                        </span>
                      </span>
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
            </details>
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
          guide={table.find((e) => e.name === viewing)?.media !== undefined}
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

      {(adding || editing !== null) && (
        <ExerciseDialog
          name=""
          editing={editing}
          table={table}
          onSave={saveExercise}
          /*
             There is no step to write a name onto from this page, so taking the
             exercise that already exists means showing it: the search box is what
             puts one row on the screen out of 147.
          */
          onUse={(name) => {
            setQuery(name)
            setAdding(false)
            setEditing(null)
          }}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {removing !== null && (
        <ConfirmDialog
          question={`Remove “${removing.name}”?`}
          detail={
            'It goes from this page and from the editor’s name list, and a generated routine will not use it again. Its weight and picture are dropped with it. Steps in your routines keep the name, as plain text.'
          }
          confirmLabel="Remove"
          onConfirm={() => removeExercise(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}

      {/*
        The second question after a rename, and only where the library has
        something to say: the exercise is already renamed, so cancelling here
        costs nothing but leaves the old wording written where it was written.
      */}
      {renamed !== null && stale.steps > 0 && (
        <ConfirmDialog
          question="Rename it in your routines too?"
          detail={`${stale.steps} ${stale.steps === 1 ? 'step' : 'steps'} in ${
            stale.rewritten.length
          } ${stale.rewritten.length === 1 ? 'routine' : 'routines'} still say “${
            renamed.from
          }”. Renaming those changes only the exercise. The count, the weight and the note stay exactly as written.`}
          confirmLabel={`Rename ${stale.steps}`}
          onConfirm={() => {
            const rewritten = stale.rewritten
            setRenamed(null)
            void Promise.resolve(onFollow(rewritten)).catch((cause: unknown) => {
              const reason = cause instanceof Error ? cause.message : 'Could not save'
              setNotice(`${reason}. The exercise is renamed; the routines still say the old name.`)
            })
          }}
          onCancel={() => setRenamed(null)}
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
