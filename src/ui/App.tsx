import { useCallback, useState } from 'react'
import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { newSegment } from '../editor/blocks'
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
    // One step rather than nothing, so the editor opens on something to change.
    blocks: [newSegment('work')],
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
    return <EditorScreen workout={view.workout} onSave={onSave} onCancel={toLibrary} />
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
