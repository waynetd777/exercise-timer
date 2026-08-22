import type { Block, Ladder, Repeat, Section, Segment, SegmentRole } from '../engine'
import { isGroup } from '../engine'
import { newId } from '../id'

/**
 * Pure edits on a routine's block tree.
 *
 * A `Path` is the chain of indices to reach a block: `[2]` is the third
 * top-level block, `[1, 0]` is the first child of the second. Every operation
 * returns a new tree and never mutates the input, so the editor can hold undo
 * history by keeping old trees.
 *
 * Kept apart from React for the same reason as the run clock and the library:
 * this is where the fiddly cases live: reordering across the ends, removing a
 * block from inside a repeat, wrapping and unwrapping. It should be
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
    id: newId(),
    name: DEFAULT_NAME[role],
    durationMs: DEFAULT_SECONDS[role] * 1000,
    role,
  }
}

/**
 * A new reps group: three reps of a 20s exercise and a 10s rest.
 *
 * The default children matter. Adding "Reps" in the editor should give a usable
 * group, not an empty one or a bare exercise. `wrapInRepeat` passes its own
 * children, so the default only applies when a group is created fresh.
 */
export function newRepeat(
  children: Block[] = [newSegment('work'), newSegment('rest')],
  times = 3,
): Repeat {
  return { kind: 'repeat', id: newId(), times, children, label: 'Reps' }
}

/**
 * The shape a new routine opens on: get set, a round, get set for whatever comes
 * next, then a recovery interval. Exported so the app and its tests cannot
 * disagree about it.
 */
/**
 * A new ladder: three rungs of one exercise that scales with them.
 *
 * `5-10-15` rather than a symmetric pyramid, because a short ascending ladder is
 * the easiest thing to read while learning what the control does. The real ones
 * run to nine rungs and are easier to extend than to cut down.
 */
export function newLadder(children: Block[] = [newRungStep()], counts = [5, 10, 15]): Ladder {
  return { kind: 'ladder', id: newId(), counts, children, label: 'Set' }
}

/** A step whose rep count comes from the ladder around it. */
export function newRungStep(): Segment {
  return {
    kind: 'segment',
    id: newId(),
    name: DEFAULT_NAME.work,
    role: 'work',
    reps: { kind: 'rung' },
  }
}

/** A self-paced step: a rep count and no clock. */
export function newRepsStep(count = 10, role: SegmentRole = 'work'): Segment {
  return {
    kind: 'segment',
    id: newId(),
    name: DEFAULT_NAME[role],
    role,
    reps: { kind: 'fixed', count },
  }
}

/**
 * A new section, in list mode.
 *
 * List rather than timer, because a section is only worth creating for a part of
 * a routine that reads as a block of work. An all-timed one is shown as a
 * countdown anyway, whatever this says.
 */
export function newSection(name = 'Section', children: Block[] = [newRepsStep()]): Section {
  return { kind: 'section', id: newId(), name, display: 'list', children }
}

export function newRoutineBlocks(): Block[] {
  return [newSegment('prepare'), newRepeat(), newSegment('prepare'), newSegment('recover')]
}

export function blockAt(blocks: readonly Block[], path: Path): Block | undefined {
  if (path.length === 0) return undefined
  const [head, ...rest] = path
  const block = blocks[head!]
  if (!block) return undefined
  if (rest.length === 0) return block
  return isGroup(block) ? blockAt(block.children, rest) : undefined
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
    if (!isGroup(block)) return [block]
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
    if (!isGroup(parent)) return parent
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

/** Appends into a group's children. `path` must point at the group. */
export function appendTo(blocks: readonly Block[], path: Path, block: Block): Block[] {
  return mapAt(blocks, path, (target) =>
    isGroup(target) ? { ...target, children: [...target.children, block] } : target,
  )
}

/**
 * Deep copy with fresh ids all the way down.
 *
 * New ids matter: React keys the editor rows by `block.id`, so a duplicate that
 * kept them would give two rows the same key.
 */
function withNewIds(block: Block): Block {
  if (block.kind === 'segment') return { ...block, id: newId() }
  return { ...block, id: newId(), children: block.children.map(withNewIds) }
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
 * Groups themselves only ever swap with their siblings, whatever their kind:
 * `wrapInRepeat` refuses to nest a repeat or a section, so moving a group into
 * a neighbouring group would build a tree the editor cannot show.
 *
 * A group left empty by a departing step is kept rather than pruned. A group
 * vanishing under you is more surprising than an empty one you can delete.
 */
export function moveStep(blocks: readonly Block[], path: Path, delta: 1 | -1): Block[] {
  const target = blockAt(blocks, path)
  if (!target) return [...blocks]
  if (isGroup(target)) return moveBy(blocks, path, delta)

  const index = path[path.length - 1]!
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length > 0 ? blockAt(blocks, parentPath) : undefined
  const siblings =
    parent && isGroup(parent) ? parent.children : parentPath.length === 0 ? blocks : []

  const neighbour = siblings[index + delta]

  if (neighbour && isGroup(neighbour)) {
    const without = removeAt(blocks, path)
    // Going down, removing the step shifts the group back by one; going up it
    // sits before the step and is unaffected.
    const groupPath = [...parentPath, delta === 1 ? index : index - 1]
    return delta === 1
      ? insertAt(without, [...groupPath, 0], target)
      : appendTo(without, groupPath, target)
  }

  if (neighbour) return moveBy(blocks, path, delta)

  // At the edge of a group: step outside it.
  if (parentPath.length > 0) {
    const without = removeAt(blocks, path)
    const groupIndex = parentPath[parentPath.length - 1]!
    return insertAt(without, [...parentPath.slice(0, -1), groupIndex + (delta === 1 ? 1 : 0)], target)
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
 * patching a key to `undefined`, and deleting the key is what is actually
 * meant, so the property is absent rather than present-and-undefined.
 */
/**
 * Removes a step's note or alternative.
 *
 * A separate operation for the same reason as `clearMedia`: with
 * `exactOptionalPropertyTypes` you cannot patch a key to `undefined`, and an
 * empty string is not the same as absent. One renders an empty line under the
 * step, the other renders nothing.
 */
export function clearText(
  blocks: readonly Block[],
  path: Path,
  field: 'note' | 'alternative',
): Block[] {
  return mapAt(blocks, path, (block) => {
    if (block.kind !== 'segment') return block
    const next = { ...block }
    delete next[field]
    return next
  })
}

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

export function updateLadder(
  blocks: readonly Block[],
  path: Path,
  patch: Partial<Omit<Ladder, 'kind' | 'id' | 'children'>>,
): Block[] {
  return mapAt(blocks, path, (block) => (block.kind === 'ladder' ? { ...block, ...patch } : block))
}

export function updateSection(
  blocks: readonly Block[],
  path: Path,
  patch: Partial<Omit<Section, 'kind' | 'id' | 'children'>>,
): Block[] {
  return mapAt(blocks, path, (block) => (block.kind === 'section' ? { ...block, ...patch } : block))
}

/**
 * What a step asks of you, as one exclusive choice.
 *
 * The data model lets a step carry both a duration and a rep count; the editor
 * does not, because a step that says "20 ×" and counts down 30 seconds cannot be
 * obeyed. Switching between them therefore has to DELETE the other key rather
 * than set it undefined. `exactOptionalPropertyTypes` is on, and a key present
 * and undefined is not the same as absent, which is exactly what separates a
 * self-paced step from a timed one.
 */
export type Timing =
  | { kind: 'timed'; durationMs: number }
  | { kind: 'reps'; count: number; perSide?: boolean }
  | { kind: 'rung'; perSide?: boolean }

export function setTiming(blocks: readonly Block[], path: Path, timing: Timing): Block[] {
  return mapAt(blocks, path, (block) => {
    if (block.kind !== 'segment') return block
    const next = { ...block }
    delete next.durationMs
    delete next.reps

    if (timing.kind === 'timed') return { ...next, durationMs: timing.durationMs }
    if (timing.kind === 'rung') {
      return { ...next, reps: { kind: 'rung', ...(timing.perSide ? { perSide: true } : {}) } }
    }
    return {
      ...next,
      reps: { kind: 'fixed', count: timing.count, ...(timing.perSide ? { perSide: true } : {}) },
    }
  })
}

/** Reads a step's current choice, for the control that sets it. */
export function timingOf(segment: Segment): Timing {
  if (segment.reps?.kind === 'rung') {
    return { kind: 'rung', ...(segment.reps.perSide ? { perSide: true } : {}) }
  }
  if (segment.reps) {
    return {
      kind: 'reps',
      count: segment.reps.count,
      ...(segment.reps.perSide ? { perSide: true } : {}),
    }
  }
  return { kind: 'timed', durationMs: segment.durationMs ?? DEFAULT_SECONDS[segment.role] * 1000 }
}

/** Wraps a block in a new repeat, so a step becomes "3 rounds of that step". */
export function wrapInRepeat(blocks: readonly Block[], path: Path, times = 3): Block[] {
  const target = blockAt(blocks, path)
  /*
   * A repeat may not wrap another repeat, nor a section.
   *
   * Two levels of counting nested inside each other are unreadable, and a
   * section is a part of the routine rather than a piece of work, so putting one
   * inside a round would say the round contains a part of the routine. A LADDER
   * may be wrapped: "3 rounds of this ladder" is a real thing to ask for.
   */
  if (!target || target.kind === 'repeat' || target.kind === 'section') return [...blocks]
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

/**
 * Fields of a step that are edited a character at a time, and so should collapse
 * into the undo step before them.
 *
 * Deliberately just the one. Coalescing exists because a field bound to
 * `onChange` produces a state per keystroke, and undoing a rename letter by
 * letter is useless. Nothing else on a step is like that: a note, an alternative
 * and an image link are committed on blur, one state each, while a role comes from a
 * select, and an image chosen from the picker or uploaded is not typing at all.
 *
 * The rule this replaces was "anything that is not the role", which quietly gave
 * the image picker a shared undo step: choosing pictures for two steps in a row
 * collapsed into one, and one press of undo took both back.
 */
const TYPED_SEGMENT_FIELDS = new Set(['name'])

/**
 * Whether a patch is a run of keystrokes, and so coalescible.
 *
 * `every`, not `some`: a patch is only typing if all of it is.
 */
export function isTypedPatch(patch: Partial<Omit<Segment, 'kind' | 'id'>>): boolean {
  const keys = Object.keys(patch)
  return keys.length > 0 && keys.every((key) => TYPED_SEGMENT_FIELDS.has(key))
}

/**
 * Whether this step will be shown as a row in a list rather than as the
 * countdown, which is the same as asking whether its image can ever be seen,
 * since only the countdown layout has a media panel.
 *
 * The authoring-time counterpart of `listMode()` in `engine/navigate.ts`, which
 * is the authority; keep the two in step. Two of its three conditions can be
 * decided from the tree alone:
 *
 * - the step waits for a tap, i.e. it has no duration of its own, and
 * - its nearest enclosing SECTION is displayed as a list.
 *
 * It is the section that owns the display mode, never the immediate group: a
 * ladder or a reps group outside a section always runs as the countdown, and
 * inside a list section its steps are listed. So this deliberately asks about
 * ancestry, not about the group a step happens to sit in.
 *
 * The third condition is positional: the LAST remaining row of a group is shown as
 * the countdown, so its image does appear. It is left out on purpose. A
 * control that materialised on whichever step happened to be last, and moved
 * when the steps were reordered, would be worse than one that is simply absent.
 * Callers therefore treat this as "the image will not be seen", and must still
 * show an image that is already set: see `EditorScreen`.
 */
export function shownAsList(blocks: readonly Block[], path: Path): boolean {
  const target = blockAt(blocks, path)
  if (!target || target.kind !== 'segment' || target.durationMs !== undefined) return false

  let listed = false
  let level: readonly Block[] = blocks
  // Every ancestor except the step itself, outermost first, so the NEAREST
  // section is the one that decides.
  for (const index of path.slice(0, -1)) {
    const block: Block | undefined = level[index]
    if (!block || !isGroup(block)) return listed
    if (block.kind === 'section') listed = block.display === 'list'
    level = block.children
  }
  return listed
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
    return isGroup(block) ? [row, ...flatten(block.children, path)] : [row]
  })
}
