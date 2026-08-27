/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Block, MediaRef, Reps, RoutineColour, Workout } from '../engine'

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

/**
 * `perSide` is compared strictly, absent and `false` unequal. The editor only
 * ever writes `perSide: true` or omits the key, so the strict form never fires
 * a false prompt, and it stays honest about data from anywhere else.
 */
function sameReps(a: Reps | undefined, b: Reps | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  if (a.kind !== b.kind) return false
  if (a.kind === 'fixed' && b.kind === 'fixed' && a.count !== b.count) return false
  return a.perSide === b.perSide
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
      a.alternative === b.alternative &&
      a.load === b.load &&
      sameReps(a.reps, b.reps) &&
      sameMedia(a.media, b.media)
    )
  }

  if (a.kind === 'repeat' && b.kind === 'repeat') {
    return (
      a.id === b.id &&
      a.times === b.times &&
      a.label === b.label &&
      a.advance === b.advance &&
      sameBlocks(a.children, b.children)
    )
  }

  if (a.kind === 'ladder' && b.kind === 'ladder') {
    return (
      a.id === b.id &&
      a.label === b.label &&
      a.advance === b.advance &&
      a.counts.length === b.counts.length &&
      a.counts.every((count, index) => count === b.counts[index]) &&
      sameBlocks(a.children, b.children)
    )
  }

  if (a.kind === 'section' && b.kind === 'section') {
    return (
      a.id === b.id &&
      a.name === b.name &&
      a.note === b.note &&
      a.display === b.display &&
      a.advance === b.advance &&
      sameBlocks(a.children, b.children)
    )
  }

  // A mixed pair. Unreachable while the kinds above stay exhaustive, but a new
  // block kind must read as dirty, not clean, until a branch is written for it.
  return false
}

function sameBlocks(a: readonly Block[], b: readonly Block[]): boolean {
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
