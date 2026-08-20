import { useCallback, useState } from 'react'
import type { Workout } from '../engine'
import { SEED_ROUTINES } from '../routines/samples'
import { useLibrary } from '../storage/useLibrary'
import { LibraryScreen } from './LibraryScreen'
import { RunScreen } from './RunScreen'

export function App() {
  const library = useLibrary(SEED_ROUTINES)

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
