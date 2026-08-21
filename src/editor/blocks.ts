import type { Block, Repeat, Segment, SegmentRole } from '../engine'

/**
 * Pure edits on a routine's block tree.
 *
 * A `Path` is the chain of indices to reach a block: `[2]` is the third
 * top-level block, `[1, 0]` is the first child of the second. Every operation
 * returns a new tree and never mutates the input, so the editor can hold undo
 * history by keeping old trees.
 *
 * Kept apart from React for the same reason as the run clock and the library:
 * this is where the fiddly cases live — reordering across the ends, removing a
 * block from inside a repeat, wrapping and unwrapping — and it should be
 * testable without a browser.
 */
export type Path = readonly number[]

export type FlatBlock = {
  block: Block
  path: Path
  /** 0 for a top-level block, 1 inside one repeat, and so on. */
  depth: number
  /** True when the block is the first among its siblings. */
  first: boolean
  last: boolean
}

/**
 * Durations taken from Wayne's own routines, so an added step usually needs no
 * adjustment: 30s to get set, 20s of work, 10s rest, 60s recovery between
 * exercises.
 */
const DEFAULT_SECONDS: Record<SegmentRole, number> = {
  prepare: 30,
  work: 20,
  rest: 10,
  recover: 60,
  custom: 30,
}

const DEFAULT_NAME: Record<SegmentRole, string> = {
  prepare: 'Get ready',
  work: 'Exercise',
  rest: 'Rest',
  recover: 'Recover',
  custom: 'Step',
}

export function newSegment(role: SegmentRole = 'work'): Segment {
  return {
    kind: 'segment',
    id: crypto.randomUUID(),
    name: DEFAULT_NAME[role],
    durationMs: DEFAULT_SECONDS[role] * 1000,
    role,
  }
}

/**
 * A new reps group: three reps of a 20s exercise and a 10s rest.
 *
 * The default children matter — adding "Reps" in the editor should give a usable
 * group, not an empty one or a bare exercise. `wrapInRepeat` passes its own
 * children, so the default only applies when a group is created fresh.
 */
export function newRepeat(
  children: Block[] = [newSegment('work'), newSegment('rest')],
  times = 3,
): Repeat {
  return { kind: 'repeat', id: crypto.randomUUID(), times, children, label: 'Reps' }
}

/**
 * The shape a new routine opens on: get set, a round, get set for whatever comes
 * next, then a recovery interval. Exported so the app and its tests cannot
 * disagree about it.
 */
export function newRoutineBlocks(): Block[] {
  return [newSegment('prepare'), newRepeat(), newSegment('prepare'), newSegment('recover')]
}

export function blockAt(blocks: readonly Block[], path: Path): Block | undefined {
  if (path.length === 0) return undefined
  const [head, ...rest] = path
  const block = blocks[head!]
  if (!block) return undefined
  if (rest.length === 0) return block
  return block.kind === 'repeat' ? blockAt(block.children, rest) : undefined
}

/** Replaces the block at `path`; returning null removes it. */
function mapAt(
  blocks: readonly Block[],
  path: Path,
  fn: (block: Block) => Block | null,
): Block[] {
  if (path.length === 0) return [...blocks]
  const [head, ...rest] = path
  return blocks.flatMap((block, index) => {
    if (index !== head) return [block]
    if (rest.length === 0) {
      const next = fn(block)
      return next ? [next] : []
    }
    if (block.kind !== 'repeat') return [block]
    return [{ ...block, children: mapAt(block.children, rest, fn) }]
  })
}

/** Rewrites the sibling array that contains `path`. */
function withSiblings(
  blocks: readonly Block[],
  path: Path,
  fn: (siblings: Block[], index: number) => Block[],
): Block[] {
  if (path.length === 0) return [...blocks]
  const index = path[path.length - 1]!
  if (path.length === 1) return fn([...blocks], index)

  return mapAt(blocks, path.slice(0, -1), (parent) => {
    if (parent.kind !== 'repeat') return parent
    return { ...parent, children: fn([...parent.children], index) }
  })
}

export function insertAfter(blocks: readonly Block[], path: Path, block: Block): Block[] {
  if (path.length === 0) return [...blocks, block]
  return withSiblings(blocks, path, (siblings, index) => {
    siblings.splice(index + 1, 0, block)
    return siblings
  })
}

/** Inserts AT a position among siblings, pushing whatever is there along. */
export function insertAt(blocks: readonly Block[], path: Path, block: Block): Block[] {
  return withSiblings(blocks, path, (siblings, index) => {
    siblings.splice(index, 0, block)
    return siblings
  })
}

/** Appends into a repeat's children. `path` must point at the repeat. */
export function appendTo(blocks: readonly Block[], path: Path, block: Block): Block[] {
  return mapAt(blocks, path, (target) =>
    target.kind === 'repeat' ? { ...target, children: [...target.children, block] } : target,
  )
}

/**
 * Deep copy with fresh ids all the way down.
 *
 * New ids matter: React keys the editor rows by `block.id`, so a duplicate that
 * kept them would give two rows the same key.
 */
function withNewIds(block: Block): Block {
  if (block.kind === 'segment') return { ...block, id: crypto.randomUUID() }
  return { ...block, id: crypto.randomUUID(), children: block.children.map(withNewIds) }
}

/** Inserts a copy immediately after the block, so duplicating twice stacks up. */
export function duplicateAt(blocks: readonly Block[], path: Path): Block[] {
  const target = blockAt(blocks, path)
  if (!target) return [...blocks]
  return insertAfter(blocks, path, withNewIds(target))
}

export function removeAt(blocks: readonly Block[], path: Path): Block[] {
  return mapAt(blocks, path, () => null)
}

/**
 * Reorders a block among its siblings. A move past either end is a no-op rather
 * than an error, so holding the button down cannot corrupt the tree.
 */
export function moveBy(blocks: readonly Block[], path: Path, delta: number): Block[] {
  return withSiblings(blocks, path, (siblings, index) => {
    const target = index + delta
    if (target < 0 || target >= siblings.length) return siblings
    const [moved] = siblings.splice(index, 1)
    siblings.splice(target, 0, moved!)
    return siblings
  })
}

/**
 * Moves a step through the routine as it READS, crossing group boundaries.
 *
 * `moveBy` only reorders among siblings, which leaves a step trapped inside or
 * outside a round. This walks the visual order instead:
 *
 *   - next to a group      -> move INTO it (first child going down, last going up)
 *   - next to a step       -> swap with it
 *   - at the edge, nested  -> move OUT, landing beside the group
 *   - at the edge, top     -> nothing to do
 *
 * Reps groups themselves only ever swap with their siblings: `wrapInRepeat`
 * refuses to nest a group in a group, so moving one into another would build a
 * tree the editor cannot show.
 *
 * A group left empty by a departing step is kept rather than pruned — a group
 * vanishing under you is more surprising than an empty one you can delete.
 */
export function moveStep(blocks: readonly Block[], path: Path, delta: 1 | -1): Block[] {
  const target = blockAt(blocks, path)
  if (!target) return [...blocks]
  if (target.kind === 'repeat') return moveBy(blocks, path, delta)

  const index = path[path.length - 1]!
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length > 0 ? blockAt(blocks, parentPath) : undefined
  const siblings =
    parent && parent.kind === 'repeat' ? parent.children : parentPath.length === 0 ? blocks : []

  const neighbour = siblings[index + delta]

  if (neighbour?.kind === 'repeat') {
    const without = removeAt(blocks, path)
    // Going down, removing the step shifts the round back by one; going up it
    // sits before the step and is unaffected.
    const roundPath = [...parentPath, delta === 1 ? index : index - 1]
    return delta === 1
      ? insertAt(without, [...roundPath, 0], target)
      : appendTo(without, roundPath, target)
  }

  if (neighbour) return moveBy(blocks, path, delta)

  // At the edge of a round: step outside it.
  if (parentPath.length > 0) {
    const without = removeAt(blocks, path)
    const roundIndex = parentPath[parentPath.length - 1]!
    return insertAt(without, [...parentPath.slice(0, -1), roundIndex + (delta === 1 ? 1 : 0)], target)
  }

  return [...blocks]
}

export function updateSegment(
  blocks: readonly Block[],
  path: Path,
  patch: Partial<Omit<Segment, 'kind' | 'id'>>,
): Block[] {
  return mapAt(blocks, path, (block) =>
    block.kind === 'segment' ? { ...block, ...patch } : block,
  )
}

/**
 * Removes a segment's image.
 *
 * Separate from `updateSegment` because `exactOptionalPropertyTypes` forbids
 * patching a key to `undefined` — and deleting the key is what is actually
 * meant, so the property is absent rather than present-and-undefined.
 */
export function clearMedia(blocks: readonly Block[], path: Path): Block[] {
  return mapAt(blocks, path, (block) => {
    if (block.kind !== 'segment') return block
    const next: Segment = { ...block }
    delete next.media
    return next
  })
}

export function updateRepeat(
  blocks: readonly Block[],
  path: Path,
  patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>,
): Block[] {
  return mapAt(blocks, path, (block) =>
    block.kind === 'repeat' ? { ...block, ...patch } : block,
  )
}

/** Wraps a block in a new repeat, so a step becomes "3 rounds of that step". */
export function wrapInRepeat(blocks: readonly Block[], path: Path, times = 3): Block[] {
  const target = blockAt(blocks, path)
  // Nesting a repeat inside a repeat is refused: the editor only renders two
  // levels, and a deeper tree would be invisible and un-editable.
  if (!target || target.kind === 'repeat') return [...blocks]
  return mapAt(blocks, path, (block) => newRepeat([block], times))
}

/** Replaces a repeat with its children, keeping one iteration's worth. */
export function unwrapRepeat(blocks: readonly Block[], path: Path): Block[] {
  const target = blockAt(blocks, path)
  if (!target || target.kind !== 'repeat') return [...blocks]
  return withSiblings(blocks, path, (siblings, index) => {
    siblings.splice(index, 1, ...target.children)
    return siblings
  })
}

/** Depth-first list for rendering, with the sibling position each row needs. */
export function flatten(blocks: readonly Block[], prefix: Path = []): FlatBlock[] {
  return blocks.flatMap((block, index) => {
    const path = [...prefix, index]
    const row: FlatBlock = {
      block,
      path,
      depth: prefix.length,
      first: index === 0,
      last: index === blocks.length - 1,
    }
    return block.kind === 'repeat' ? [row, ...flatten(block.children, path)] : [row]
  })
}
