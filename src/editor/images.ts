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

/**
 * A readable name from an image URL: the filename, without its extension, with
 * separators turned back into spaces. "Cable-Fly.png" -> "Cable Fly".
 *
 * Deriving beats storing a parallel list of names — there is nothing to keep in
 * sync, and the catalogue's filenames are already the exercise names.
 */
export function labelFromUrl(url: string): string {
  const file = url.split('?')[0]!.split('/').pop() ?? ''
  const name = file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_+]+/g, ' ').trim()
  return name || 'Untitled'
}

/**
 * Every image a step can be given: the catalogue, plus anything a routine
 * already uses that is not in it.
 *
 * A catalogue entry keeps its filename label even when a routine uses it under
 * some other step name — "Cycling" describes the picture better than "Warm Up"
 * does. Anything outside the catalogue falls back to the step name it appears
 * under most often.
 */
export function collectImages(
  workouts: readonly Workout[],
  catalogue: readonly string[] = [],
): KnownImage[] {
  const byUrl = new Map<string, { uses: number; names: Map<string, number> }>()
  const inCatalogue = new Set(catalogue)

  for (const url of catalogue) byUrl.set(url, { uses: 0, names: new Map() })

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
      if (inCatalogue.has(url)) return { url, label: labelFromUrl(url), uses }
      // Most frequent step name wins; ties break alphabetically so the result is
      // stable rather than dependent on insertion order.
      const label =
        [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
        labelFromUrl(url)
      return { url, label, uses }
    })
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
        a.url.localeCompare(b.url),
    )
}
