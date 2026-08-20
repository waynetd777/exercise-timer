import { useCallback, useEffect, useState } from 'react'

const KEY = 'exercise-timer:muted'

/**
 * Mute preference, persisted. localStorage is the right home for a UI flag —
 * the IndexedDB decision was about routines and images, which have size and
 * dedupe requirements a boolean does not.
 */
export function useMuted(): [boolean, () => void] {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, muted ? '1' : '0')
    } catch {
      // Private mode or blocked storage: the preference just will not persist.
    }
  }, [muted])

  return [muted, useCallback(() => setMuted((m) => !m), [])]
}
