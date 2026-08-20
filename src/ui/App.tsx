import { useCallback, useState } from 'react'
import type { Workout } from '../engine'
import { BEGINNER_MIXED_CARDIO, TABATA, UPPER_CIRCUIT } from '../routines/samples'
import { useLibrary } from '../storage/useLibrary'
import { LibraryScreen } from './LibraryScreen'
import { RunScreen } from './RunScreen'

/** Imported on first run so the library is never empty. Stable identity for the hook. */
const SEED: readonly Workout[] = [BEGINNER_MIXED_CARDIO, TABATA, UPPER_CIRCUIT]

export function App() {
  const library = useLibrary(SEED)

  /**
   * The running routine is held in state rather than looked up by id: the
   * library array is replaced whenever metadata changes, and a fresh object
   * identity would recompile the timeline mid-workout.
   */
  const [running, setRunning] = useState<Workout | null>(null)

  const onStarted = useCallback(() => {
    if (running) void library.markRun(running)
  }, [running, library])

  if (running) {
    return (
      <RunScreen workout={running} onExit={() => setRunning(null)} onStarted={onStarted} />
    )
  }

  return <LibraryScreen library={library} onRun={setRunning} />
}
