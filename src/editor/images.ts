import type { Block, Workout } from '../engine'

/**
 * The distinct images already used across the library, so a step can reuse one
 * by picking it rather than by pasting a link.
 *
 * The label is the step name that URL appears under most often — a picker
 * showing "Leg Press" is useful in a way that a list of postimages ids is not.
 */
export type KnownImage = {
  url: string
  label: string
  /** How many steps across the library use it. */
  uses: number
}

function walk(blocks: readonly Block[], visit: (url: string, name: string) => void): void {
  for (const block of blocks) {
    if (block.kind === 'repeat') {
      walk(block.children, visit)
      continue
    }
    if (block.media?.source === 'remote') visit(block.media.url, block.name.trim())
  }
}

export function collectImages(workouts: readonly Workout[]): KnownImage[] {
  const byUrl = new Map<string, { uses: number; names: Map<string, number> }>()

  for (const workout of workouts) {
    walk(workout.blocks, (url, name) => {
      const entry = byUrl.get(url) ?? { uses: 0, names: new Map<string, number>() }
      entry.uses += 1
      if (name) entry.names.set(name, (entry.names.get(name) ?? 0) + 1)
      byUrl.set(url, entry)
    })
  }

  return [...byUrl.entries()]
    .map(([url, { uses, names }]) => {
      // Most frequent name wins; ties break alphabetically so the result is
      // stable rather than dependent on insertion order.
      const label =
        [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
        'Untitled'
      return { url, label, uses }
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}
