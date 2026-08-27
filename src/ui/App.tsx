/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { newRoutineBlocks } from '../editor/blocks'
import { collectImages } from '../editor/images'
import { IMAGE_CATALOGUE } from '../routines/imageCatalogue'
import { SEED_ROUTINES } from '../routines/samples'
import { decodeRoutine, routineParam } from '../storage/shareLink'
import { useLibrary } from '../storage/useLibrary'
import { EditorScreen } from './EditorScreen'
import { ErrorBoundary } from './ErrorBoundary'
import { LibraryScreen } from './LibraryScreen'
import { RunScreen } from './RunScreen'
import { WeightsScreen } from './WeightsScreen'
import { withWeights } from '../routines/loads'
import { currentWeights } from '../storage/weights'
import { newId } from '../id'

/**
 * The sound bench is a development tool and is not shipped.
 *
 * Loaded through a DYNAMIC import inside a `DEV` branch, not a static one. Vite
 * replaces `import.meta.env.DEV` with `false` in a production build and drops the
 * dead branch, which takes the dynamic import, and therefore the whole chunk,
 * with it. A static import would NOT do this: `SoundsScreen.tsx` imports
 * `sounds.css`, and a CSS import is a side effect, so the stylesheet would be
 * bundled even with the component unused.
 *
 * Reach it with `npm run dev`. Add `-- --host` to open it from a phone on the
 * same network.
 */
const SoundsScreen = import.meta.env.DEV
  ? lazy(() => import('./SoundsScreen').then((module) => ({ default: module.SoundsScreen })))
  : null

type View =
  | { screen: 'library' }
  | { screen: 'run'; workout: Workout }
  | { screen: 'edit'; workout: Workout }
  | { screen: 'sounds' }
  | { screen: 'weights' }

function blankRoutine(): Workout {
  const now = Date.now()
  return {
    id: newId(),
    name: '',
    /*
     * Opens on the shape Wayne's routines actually take: get set, three reps
     * of work and rest, then get set for whatever comes next. Building the next
     * exercise is then a matter of adding reps after that second prepare,
     * rather than starting from an empty list.
     */
    blocks: newRoutineBlocks(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * The screens, inside the one error boundary. Going back from the crash card
 * remounts them, which lands on the library with fresh state: the routine that
 * threw is no longer open, and the library is read again from storage.
 */
export function App() {
  const [generation, setGeneration] = useState(0)
  return (
    <ErrorBoundary onReset={() => setGeneration((n) => n + 1)}>
      <Screens key={generation} />
    </ErrorBoundary>
  )
}

function Screens() {
  const library = useLibrary(SEED_ROUTINES)

  /**
   * The current routine is held in view state rather than looked up by id: the
   * library array is replaced whenever metadata changes, and a fresh object
   * identity would recompile the timeline mid-workout.
   */
  const [view, setView] = useState<View>({ screen: 'library' })

  /**
   * A shared routine arriving in the URL fragment. Imported once, then the
   * fragment is cleared so a reload does not add it again, and guarded by a ref
   * because the library finishes loading after this effect first runs.
   */
  const consumedShare = useRef(false)
  useEffect(() => {
    if (consumedShare.current || library.loading) return
    const param = routineParam(location.hash)
    if (!param) return
    consumedShare.current = true

    void (async () => {
      try {
        const workout = await decodeRoutine(param, Date.now(), newId())
        const saved = await library.add(workout)
        history.replaceState(null, '', `${location.pathname}${location.search}`)
        setView({ screen: 'edit', workout: saved })
      } catch {
        history.replaceState(null, '', `${location.pathname}${location.search}`)
      }
    })()
  }, [library])

  /**
   * Every image already in use, so the editor can offer them for reuse. The base
   * is needed because a catalogue entry is a PATH now. See `imageCatalogue`.
   */
  const knownImages = useMemo(
    () => collectImages(library.workouts, IMAGE_CATALOGUE, import.meta.env.BASE_URL),
    [library.workouts],
  )
  const toLibrary = useCallback(() => setView({ screen: 'library' }), [])

  const onStarted = useCallback(() => {
    if (view.screen === 'run') void library.markRun(view.workout)
  }, [view, library])

  /*
   * Waited for, and the library is shown only once the write has landed. It
   * used to fire and forget: a save that failed went back to the library
   * looking saved. Now a failure keeps the editor, and its draft, on screen.
   */
  const onSave = useCallback(
    async (workout: Workout) => {
      await library.add(workout)
      toLibrary()
    },
    [library, toLibrary],
  )

  if (view.screen === 'run') {
    /*
     * The weights are filled in HERE, on the way into the run, and never saved
     * back. A step that states no load of its own is not unloaded: it means
     * "whatever I lift for this", so it reads the settings page every time it
     * is opened and follows a change made there. A step that does state one is
     * left alone, because it is overriding on purpose.
     */
    return (
      <RunScreen
        workout={withWeights(view.workout, currentWeights())}
        onExit={toLibrary}
        onStarted={onStarted}
      />
    )
  }

  if (view.screen === 'weights') {
    return (
      <WeightsScreen
        workouts={library.workouts}
        onExit={toLibrary}
        /* One save each, in order: `add` replaces a routine by id and returns
           the stamped copy, and doing them together would race the state. */
        onFollow={async (rewritten) => {
          for (const workout of rewritten) await library.add(workout)
        }}
      />
    )
  }

  if (view.screen === 'sounds' && SoundsScreen) {
    // No fallback worth showing: it is a local chunk on a development server.
    return (
      <Suspense fallback={null}>
        <SoundsScreen onExit={toLibrary} />
      </Suspense>
    )
  }

  if (view.screen === 'edit') {
    return (
      <EditorScreen
        workout={view.workout}
        knownImages={knownImages}
        onSave={onSave}
        onCancel={toLibrary}
      />
    )
  }

  return (
    <LibraryScreen
      library={library}
      onRun={(workout) => setView({ screen: 'run', workout })}
      onEdit={(workout) => setView({ screen: 'edit', workout })}
      onNew={() => setView({ screen: 'edit', workout: blankRoutine() })}
      onDraft={(workout) => setView({ screen: 'edit', workout })}
      onSounds={() => setView({ screen: 'sounds' })}
      onWeights={() => setView({ screen: 'weights' })}
    />
  )
}
