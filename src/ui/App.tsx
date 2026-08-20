import { useCallback, useMemo, useState } from 'react'
import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { newRoutineBlocks } from '../editor/blocks'
import { collectImages } from '../editor/images'
import { SEED_ROUTINES } from '../routines/samples'
import { useLibrary } from '../storage/useLibrary'
import { EditorScreen } from './EditorScreen'
import { LibraryScreen } from './LibraryScreen'
import { RunScreen } from './RunScreen'

type View =
  | { screen: 'library' }
  | { screen: 'run'; workout: Workout }
  | { screen: 'edit'; workout: Workout }

function blankRoutine(): Workout {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: '',
    /*
     * Opens on the shape Wayne's routines actually take: get set, three rounds
     * of work and rest, then get set for whatever comes next. Building the next
     * exercise is then a matter of adding a round after that second prepare,
     * rather than starting from an empty list.
     */
    blocks: newRoutineBlocks(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  }
}

export function App() {
  const library = useLibrary(SEED_ROUTINES)

  /**
   * The current routine is held in view state rather than looked up by id: the
   * library array is replaced whenever metadata changes, and a fresh object
   * identity would recompile the timeline mid-workout.
   */
  const [view, setView] = useState<View>({ screen: 'library' })

  /** Every image already in use, so the editor can offer them for reuse. */
  const knownImages = useMemo(() => collectImages(library.workouts), [library.workouts])
  const toLibrary = useCallback(() => setView({ screen: 'library' }), [])

  const onStarted = useCallback(() => {
    if (view.screen === 'run') void library.markRun(view.workout)
  }, [view, library])

  const onSave = useCallback(
    (workout: Workout) => {
      void library.add(workout)
      toLibrary()
    },
    [library, toLibrary],
  )

  if (view.screen === 'run') {
    return <RunScreen workout={view.workout} onExit={toLibrary} onStarted={onStarted} />
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
    />
  )
}
