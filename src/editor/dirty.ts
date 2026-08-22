import type { Block, MediaRef, RoutineColour, Workout } from '../engine'

/**
 * Whether the editor holds unsaved changes.
 *
 * Compared field by field rather than by serialising: `JSON.stringify` depends
 * on key insertion order, and an edit that spreads an object then patches it can
 * reorder keys, which would report a false change. A false "dirty" only costs a
 * needless prompt, but the comparison should still be honest.
 */
function sameMedia(a: MediaRef | undefined, b: MediaRef | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  if (a.source !== b.source) return false
  if (a.source === 'remote' && b.source === 'remote') return a.url === b.url
  if (a.source === 'bundled' && b.source === 'bundled') return a.path === b.path
  if (a.source === 'local' && b.source === 'local') return a.hash === b.hash
  return false
}

function sameBlock(a: Block, b: Block): boolean {
  if (a.kind !== b.kind) return false

  if (a.kind === 'segment' && b.kind === 'segment') {
    return (
      a.id === b.id &&
      a.name === b.name &&
      a.durationMs === b.durationMs &&
      a.role === b.role &&
      a.note === b.note &&
      sameMedia(a.media, b.media)
    )
  }

  if (a.kind === 'repeat' && b.kind === 'repeat') {
    return (
      a.id === b.id && a.times === b.times && a.label === b.label && sameBlocks(a.children, b.children)
    )
  }

  return false
}

export function sameBlocks(a: readonly Block[], b: readonly Block[]): boolean {
  if (a.length !== b.length) return false
  return a.every((block, index) => sameBlock(block, b[index]!))
}

export function isDirty(
  original: Workout,
  name: string,
  blocks: readonly Block[],
  /**
   * The draft's colour, where null means untinted. Defaults to the original's, so
   * a caller that does not deal in colours can keep passing three arguments and
   * still get the right answer.
   */
  colour: RoutineColour | null = original.colour ?? null,
): boolean {
  // Trimmed, because leading or trailing space in the name field is not a change
  // worth warning about, since saving trims it anyway.
  if (name.trim() !== original.name.trim()) return true
  if (colour !== (original.colour ?? null)) return true
  return !sameBlocks(blocks, original.blocks)
}
