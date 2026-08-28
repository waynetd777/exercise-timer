/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useRef, useState } from 'react'

/**
 * A whole-number field that commits as it is typed, clamped into [min, max].
 *
 * Shared by the editor's rows and the generate dialog's lengths, which used to
 * carry a copy without the resync below.
 *
 * The draft exists so the field can be CLEARED while retyping: committing the
 * empty string used to snap the value to 1 under the cursor. It also holds raw
 * text past the cap, because the `max` attribute only guards the spinners; the
 * COMMITTED value is clamped, and blur tidies the field to it.
 */
export function CountField({
  value,
  min = 1,
  max,
  label,
  className = 'efield efield--secs',
  onCommit,
}: {
  value: number
  min?: number
  max: number
  label: string
  className?: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const lastCommit = useRef<number | null>(null)

  // An outside change (undo, redo) rewrites the value under the field. A draft
  // left standing would mask it, and the next blur would re-commit stale text.
  useEffect(() => {
    if (value !== lastCommit.current) setDraft(null)
  }, [value])

  return (
    <input
      className={className}
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      aria-label={label}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const entered = Number(text)
        if (text === '' || !Number.isFinite(entered)) return
        const clamped = Math.min(max, Math.max(min, Math.round(entered)))
        lastCommit.current = clamped
        onCommit(clamped)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
