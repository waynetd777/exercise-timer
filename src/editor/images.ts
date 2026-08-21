import type { Block, MediaRef, Workout } from '../engine'
import { resolvePlan } from '../media/resolve'

/**
 * An image a step can be given, whether it ships with the app or a routine
 * brought it.
 *
 * `ref` is what gets stored and `src` is what the picker renders; they are not
 * the same thing for a bundled image, whose ref is a base-less path so the
 * routine survives a change of host. `id` is the stable identity — the path or
 * the URL — used for deduplication and as the React key.
 */
export type KnownImage = {
  id: string
  ref: MediaRef
  src: string
  label: string
  /** How many steps across the library use it. */
  uses: number
}

/**
 * What a catalogue entry means.
 *
 * A path is an image that ships with the app, under `public/`; an absolute URL is
 * something hosted elsewhere. The catalogue is all paths since the rehosting, but
 * the URL case stays because it costs one line and a routine may still carry one.
 */
export function refFor(entry: string): MediaRef {
  return entry.startsWith('https://')
    ? { source: 'remote', url: entry }
    : { source: 'bundled', path: entry }
}

/** The identity of a ref, for deduplication. Local blobs have no picker entry. */
function idOf(ref: MediaRef): string | null {
  if (ref.source === 'remote') return ref.url
  if (ref.source === 'bundled') return ref.path
  return null
}

function walk(blocks: readonly Block[], visit: (ref: MediaRef, name: string) => void): void {
  for (const block of blocks) {
    if (block.kind !== 'segment') {
      walk(block.children, visit)
      continue
    }
    /*
     * Bundled as well as remote, or every catalogue image a routine actually uses
     * would look unused — and an image a routine brought would be missing from
     * the picker entirely. An uploaded photo is deliberately left out: its bytes
     * live in IndexedDB, so it has no src to show without reading storage, and
     * the picker resolves synchronously.
     */
    if (block.media && idOf(block.media) !== null) visit(block.media, block.name.trim())
  }
}

/**
 * A readable name from an image path or URL: the filename, without its extension,
 * with separators turned back into spaces. "Cable-Fly.jpg" -> "Cable Fly".
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
  /** `import.meta.env.BASE_URL`, for resolving a bundled path to a thumbnail. */
  base = '/',
): KnownImage[] {
  const byId = new Map<string, { ref: MediaRef; uses: number; names: Map<string, number> }>()
  const inCatalogue = new Set<string>()

  for (const entry of catalogue) {
    const ref = refFor(entry)
    const id = idOf(ref)!
    inCatalogue.add(id)
    byId.set(id, { ref, uses: 0, names: new Map() })
  }

  for (const workout of workouts) {
    walk(workout.blocks, (ref, name) => {
      const id = idOf(ref)!
      const entry = byId.get(id) ?? { ref, uses: 0, names: new Map<string, number>() }
      entry.uses += 1
      if (name) entry.names.set(name, (entry.names.get(name) ?? 0) + 1)
      byId.set(id, entry)
    })
  }

  /*
   * `resolvePlan` rather than a second `${base}${path}` of our own, so the picker
   * and the run screen cannot disagree about where an image lives. `hasBlob` is
   * stubbed false because the picker resolves synchronously: a pinned remote
   * image shows from its URL here, which is what it did before.
   */
  const srcOf = (ref: MediaRef): string => {
    const plan = resolvePlan(ref, () => false, base)
    return plan.kind === 'url' ? plan.url : ''
  }

  return [...byId.entries()]
    .map(([id, { ref, uses, names }]) => {
      if (inCatalogue.has(id)) return { id, ref, src: srcOf(ref), label: labelFromUrl(id), uses }
      // Most frequent step name wins; ties break alphabetically so the result is
      // stable rather than dependent on insertion order.
      const label =
        [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
        labelFromUrl(id)
      return { id, ref, src: srcOf(ref), label, uses }
    })
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
        a.id.localeCompare(b.id),
    )
}
