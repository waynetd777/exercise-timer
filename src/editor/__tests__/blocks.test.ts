import { describe, expect, it } from 'vitest'
import type { Block, Ladder, Repeat, Section, Segment } from '../../engine'
import { compile, listMode, SCHEMA_VERSION, totalDurationMs } from '../../engine'
import {
  appendTo,
  blockAt,
  clearText,
  duplicateAt,
  flatten,
  insertAfter,
  isTypedPatch,
  moveBy,
  moveStep,
  newLadder,
  newRepeat,
  newRoutineBlocks,
  newRungStep,
  newSection,
  newSegment,
  removeAt,
  setTiming,
  shownAsList,
  timingOf,
  unwrapRepeat,
  updateLadder,
  updateRepeat,
  updateSection,
  updateSegment,
  wrapInRepeat,
} from '../blocks'
import type { Timing } from '../blocks'

const seg = (name: string, seconds = 20): Segment => ({
  kind: 'segment',
  id: `id-${name}`,
  name,
  durationMs: seconds * 1000,
  role: 'work',
})

const rep = (id: string, children: Block[], times = 3): Repeat => ({
  kind: 'repeat',
  id,
  times,
  children,
  label: 'Reps',
})

/** A: 0, R: 1 (children B: [1,0], C: [1,1]), D: 2 */
const tree = (): Block[] => [seg('A'), rep('R', [seg('B'), seg('C')]), seg('D')]

const names = (blocks: readonly Block[]): string[] =>
  flatten(blocks).map((f) => (f.block.kind === 'segment' ? f.block.name : `[${f.block.id}]`))

describe('blockAt', () => {
  it('reads top-level and nested blocks', () => {
    expect(blockAt(tree(), [0])).toMatchObject({ name: 'A' })
    expect(blockAt(tree(), [1, 1])).toMatchObject({ name: 'C' })
  })

  it('returns undefined for a path that does not exist', () => {
    expect(blockAt(tree(), [])).toBeUndefined()
    expect(blockAt(tree(), [9])).toBeUndefined()
    // Descending into a segment is not a path.
    expect(blockAt(tree(), [0, 0])).toBeUndefined()
  })
})

describe('flatten', () => {
  it('lists depth-first with depth and sibling position', () => {
    expect(flatten(tree()).map((f) => [f.path, f.depth, f.first, f.last])).toEqual([
      [[0], 0, true, false],
      [[1], 0, false, false],
      [[1, 0], 1, true, false],
      [[1, 1], 1, false, true],
      [[2], 0, false, true],
    ])
  })

  it('is empty for an empty routine', () => {
    expect(flatten([])).toEqual([])
  })
})

describe('insertAfter', () => {
  it('inserts as a sibling at the top level', () => {
    expect(names(insertAfter(tree(), [0], seg('X')))).toEqual(['A', 'X', '[R]', 'B', 'C', 'D'])
  })

  it('inserts as a sibling inside a repeat', () => {
    expect(names(insertAfter(tree(), [1, 0], seg('X')))).toEqual(['A', '[R]', 'B', 'X', 'C', 'D'])
  })

  it('appends when given an empty path', () => {
    expect(names(insertAfter(tree(), [], seg('X'))).at(-1)).toBe('X')
  })

  it('does not mutate the input', () => {
    const original = tree()
    insertAfter(original, [0], seg('X'))
    expect(names(original)).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })
})

describe('appendTo', () => {
  it('appends into a repeat', () => {
    expect(names(appendTo(tree(), [1], seg('X')))).toEqual(['A', '[R]', 'B', 'C', 'X', 'D'])
  })

  it('leaves a segment alone: it has no children to append to', () => {
    expect(names(appendTo(tree(), [0], seg('X')))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })
})

describe('removeAt', () => {
  it('removes a top-level block, repeat children and all', () => {
    expect(names(removeAt(tree(), [1]))).toEqual(['A', 'D'])
  })

  it('removes one child from inside a repeat', () => {
    expect(names(removeAt(tree(), [1, 0]))).toEqual(['A', '[R]', 'C', 'D'])
  })

  it('can empty a repeat without removing it', () => {
    let blocks = removeAt(tree(), [1, 1])
    blocks = removeAt(blocks, [1, 0])
    expect(names(blocks)).toEqual(['A', '[R]', 'D'])
    expect(compile({ ...base, blocks }).entries).toHaveLength(2)
  })
})

describe('moveBy', () => {
  it('reorders among top-level siblings', () => {
    expect(names(moveBy(tree(), [0], 1))).toEqual(['[R]', 'B', 'C', 'A', 'D'])
  })

  it('reorders inside a repeat', () => {
    expect(names(moveBy(tree(), [1, 0], 1))).toEqual(['A', '[R]', 'C', 'B', 'D'])
  })

  it('is a no-op past either end, so holding the button cannot corrupt the tree', () => {
    expect(names(moveBy(tree(), [0], -1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
    expect(names(moveBy(tree(), [2], 1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
    expect(names(moveBy(tree(), [1, 1], 5))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })

  it('does not move a block out of its repeat', () => {
    // Moving the first child up stays inside. It does not become a sibling of
    // the repeat itself.
    expect(names(moveBy(tree(), [1, 0], -1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })
})

describe('updateSegment / updateRepeat', () => {
  it('patches a segment', () => {
    const blocks = updateSegment(tree(), [1, 0], { name: 'Renamed', durationMs: 45_000 })
    expect(blockAt(blocks, [1, 0])).toMatchObject({ name: 'Renamed', durationMs: 45_000 })
  })

  it('patches a repeat count', () => {
    const blocks = updateRepeat(tree(), [1], { times: 8 })
    expect(blockAt(blocks, [1])).toMatchObject({ times: 8 })
    // 8 rounds of two 20s children, plus A and D.
    expect(totalDurationMs({ ...base, blocks })).toBe((20 + 8 * 40 + 20) * 1000)
  })

  it('ignores a segment patch aimed at a repeat, and vice versa', () => {
    expect(names(updateSegment(tree(), [1], { name: 'nope' }))).toEqual([
      'A',
      '[R]',
      'B',
      'C',
      'D',
    ])
    expect(blockAt(updateRepeat(tree(), [0], { times: 9 }), [0])).toMatchObject({ name: 'A' })
  })
})

describe('wrapInRepeat', () => {
  it('turns a step into rounds of that step', () => {
    const blocks = wrapInRepeat(tree(), [0], 4)
    const wrapper = blockAt(blocks, [0])!
    expect(wrapper.kind).toBe('repeat')
    expect((wrapper as Repeat).times).toBe(4)
    expect(blockAt(blocks, [0, 0])).toMatchObject({ name: 'A' })
    expect(totalDurationMs({ ...base, blocks })).toBe((4 * 20 + 40 * 3 + 20) * 1000)
  })

  it('refuses to nest a repeat inside a repeat', () => {
    // The editor renders two levels; a deeper tree would be un-editable.
    expect(wrapInRepeat(tree(), [1])).toEqual(tree())
  })

  it('refuses a path that does not exist', () => {
    expect(wrapInRepeat(tree(), [9])).toEqual(tree())
  })
})

describe('unwrapRepeat', () => {
  it('replaces a repeat with its children in place', () => {
    expect(names(unwrapRepeat(tree(), [1]))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('leaves a segment alone', () => {
    expect(names(unwrapRepeat(tree(), [0]))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })

  it('drops an empty repeat entirely', () => {
    const blocks = [seg('A'), rep('R', []), seg('D')]
    expect(names(unwrapRepeat(blocks, [1]))).toEqual(['A', 'D'])
  })
})

describe('constructors', () => {
  it('gives every new block a distinct id', () => {
    const ids = [newSegment().id, newSegment().id, newRepeat().id, newRepeat().id]
    expect(new Set(ids).size).toBe(4)
  })

  it('defaults a new segment to the durations the real routines use', () => {
    // Taken from Wayne's own routines, so an added step usually needs no edit.
    expect(newSegment('prepare')).toMatchObject({ role: 'prepare', durationMs: 30_000 })
    expect(newSegment('work')).toMatchObject({ role: 'work', durationMs: 20_000 })
    expect(newSegment('rest')).toMatchObject({ role: 'rest', durationMs: 10_000 })
    expect(newSegment('recover').durationMs).toBe(60_000)
    for (const role of ['prepare', 'work', 'rest', 'recover'] as const) {
      expect(newSegment(role).name.length).toBeGreaterThan(0)
    }
  })

  it('makes a new repeat that compiles to something', () => {
    const blocks = [newRepeat([newSegment('work')], 5)]
    expect(compile({ ...base, blocks }).entries).toHaveLength(5)
  })

  it('defaults a new group to 3 reps of a 20s exercise and a 10s rest', () => {
    const reps = newRepeat()
    expect(reps.times).toBe(3)
    expect(reps.label).toBe('Reps')
    expect(reps.children.map((c) => (c.kind === 'segment' ? [c.role, c.durationMs] : null))).toEqual(
      [
        ['work', 20_000],
        ['rest', 10_000],
      ],
    )
  })
})

const base = {
  id: 'w',
  name: 'W',
  schemaVersion: 1 as const,
  createdAt: 0,
  updatedAt: 0,
}

describe('newRoutineBlocks: what a new routine opens on', () => {
  const template = newRoutineBlocks()

  it('is get set, three rounds of work and rest, get set again, then recover', () => {
    expect(template.map((b) => b.kind)).toEqual(['segment', 'repeat', 'segment', 'segment'])
    expect((template[1] as Repeat).times).toBe(3)
    expect((template[1] as Repeat).children.map((c) => c.kind)).toEqual(['segment', 'segment'])
    expect(template.map((b) => (b.kind === 'segment' ? b.role : 'repeat'))).toEqual([
      'prepare',
      'repeat',
      'prepare',
      'recover',
    ])
  })

  it('compiles to 8 steps totalling 3:20', () => {
    // 30 + (20 + 10 + 20 + 10 + 20) + 30 + 60 = 200s. Five steps from the reps,
    // not six: a rest belongs BETWEEN reps, so the third rep has none after it.
    const timeline = compile({ ...base, blocks: template })
    expect(timeline.entries).toHaveLength(8)
    expect(timeline.totalMs).toBe(200_000)
  })

  it('ends the reps on work, never on a rest', () => {
    const entries = compile({ ...base, blocks: template }).entries
    const reps = entries.filter((entry) => entry.path.length > 0)
    expect(reps.map((entry) => entry.role)).toEqual(['work', 'rest', 'work', 'rest', 'work'])
  })

  it('labels the reps, so the run screen shows "Reps 2 of 3"', () => {
    const entry = compile({ ...base, blocks: template }).entries[3]!
    expect(entry.path).toEqual([
      { kind: 'repeat', id: expect.any(String), label: 'Reps', iteration: 2, of: 3 },
    ])
  })
})

describe('defaults, stated once', () => {
  it('holds every default the routines rely on', () => {
    // Restated as a single guard: get ready 30s, reps of 3 with 20s work and
    // 10s rest, rest 10s. Changing any of these should fail here first.
    expect(newSegment('prepare').durationMs).toBe(30_000)
    expect(newSegment('rest').durationMs).toBe(10_000)
    expect(newSegment('work').durationMs).toBe(20_000)

    const reps = newRepeat()
    expect(reps.times).toBe(3)
    expect(reps.children).toHaveLength(2)
    // 3 works and 2 rests, not 3 of each: the last rep has no rest after it.
    expect(compile({ ...base, blocks: [reps] }).totalMs).toBe(3 * 20_000 + 2 * 10_000)
  })
})

describe('duplicateAt', () => {
  it('places the copy immediately after the original', () => {
    expect(names(duplicateAt(tree(), [0]))).toEqual(['A', 'A', '[R]', 'B', 'C', 'D'])
  })

  it('duplicates inside a repeat without leaving it', () => {
    expect(names(duplicateAt(tree(), [1, 0]))).toEqual(['A', '[R]', 'B', 'B', 'C', 'D'])
  })

  it('copies a repeat with all of its children', () => {
    const blocks = duplicateAt(tree(), [1])
    expect(flatten(blocks).map((f) => f.block.kind)).toEqual([
      'segment',
      'repeat',
      'segment',
      'segment',
      'repeat',
      'segment',
      'segment',
      'segment',
    ])
    expect(totalDurationMs({ ...base, blocks })).toBe(
      totalDurationMs({ ...base, blocks: tree() }) + 3 * 40_000,
    )
  })

  it('gives the copy fresh ids, right down through the children', () => {
    // React keys the rows by id, so a shared id would collide.
    const blocks = duplicateAt(tree(), [1])
    const ids = flatten(blocks).map((f) => f.block.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries the values across, including an image', () => {
    const withImage = updateSegment(tree(), [0], {
      name: 'Cable fly',
      durationMs: 45_000,
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    })
    const copy = blockAt(duplicateAt(withImage, [0]), [1])
    expect(copy).toMatchObject({
      name: 'Cable fly',
      durationMs: 45_000,
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    })
  })

  it('leaves the original tree untouched, and ignores a bad path', () => {
    const original = tree()
    duplicateAt(original, [0])
    expect(names(original)).toEqual(['A', '[R]', 'B', 'C', 'D'])
    expect(names(duplicateAt(original, [9]))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })

  it('stacks when duplicated repeatedly', () => {
    let blocks = duplicateAt(tree(), [0])
    blocks = duplicateAt(blocks, [1])
    expect(names(blocks)).toEqual(['A', 'A', 'A', '[R]', 'B', 'C', 'D'])
  })
})

describe('moveStep: moving through rounds, not just around them', () => {
  // A: 0, R: 1 (B: [1,0], C: [1,1]), D: 2
  it('moves a step down INTO the round that follows it', () => {
    expect(names(moveStep(tree(), [0], 1))).toEqual(['[R]', 'A', 'B', 'C', 'D'])
    expect(blockAt(moveStep(tree(), [0], 1), [0, 0])).toMatchObject({ name: 'A' })
  })

  it('moves a step up INTO the round above it, landing last', () => {
    expect(names(moveStep(tree(), [2], -1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
    expect(blockAt(moveStep(tree(), [2], -1), [1, 2])).toMatchObject({ name: 'D' })
  })

  it('moves the first step of a round OUT, above the round', () => {
    expect(names(moveStep(tree(), [1, 0], -1))).toEqual(['A', 'B', '[R]', 'C', 'D'])
  })

  it('moves the last step of a round OUT, below the round', () => {
    expect(names(moveStep(tree(), [1, 1], 1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
    // C is now a top-level sibling after the round, not its child.
    const blocks = moveStep(tree(), [1, 1], 1)
    expect(blockAt(blocks, [2])).toMatchObject({ name: 'C' })
  })

  it('still swaps two adjacent steps, inside a round or out', () => {
    const four = [seg('A'), seg('B'), rep('R', [seg('C'), seg('D')])]
    expect(names(moveStep(four, [0], 1))).toEqual(['B', 'A', '[R]', 'C', 'D'])
    expect(names(moveStep(four, [2, 0], 1))).toEqual(['A', 'B', '[R]', 'D', 'C'])
  })

  it('does nothing at the very start or the very end', () => {
    expect(names(moveStep(tree(), [0], -1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
    expect(names(moveStep(tree(), [2], 1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })

  it('changes the total, because a step inside a round runs three times', () => {
    // Moving A (20s) into a x3 round takes it from 20s to 60s.
    const before = totalDurationMs({ ...base, blocks: tree() })
    const after = totalDurationMs({ ...base, blocks: moveStep(tree(), [0], 1) })
    expect(after - before).toBe(2 * 20_000)
  })

  it('leaves an emptied round in place rather than pruning it', () => {
    // A group vanishing under you is more surprising than an empty one.
    let blocks = moveStep(tree(), [1, 0], -1)
    blocks = moveStep(blocks, [2, 0], 1)
    expect(names(blocks)).toEqual(['A', 'B', '[R]', 'C', 'D'])
    expect(blockAt(blocks, [2])).toMatchObject({ kind: 'repeat', children: [] })
  })

  it('only swaps rounds: it never nests one inside another', () => {
    const two = [rep('R1', [seg('A')]), rep('R2', [seg('B')])]
    const moved = moveStep(two, [0], 1)
    expect(moved.map((b) => b.id)).toEqual(['R2', 'R1'])
    expect((moved[0] as Repeat).children).toHaveLength(1)
  })

  it('is reversible: down then up returns the original shape', () => {
    const original = tree()
    const there = moveStep(original, [0], 1)
    const back = moveStep(there, [0, 0], -1)
    expect(names(back)).toEqual(names(original))
  })

  it('does not mutate the input, and ignores a bad path', () => {
    const original = tree()
    moveStep(original, [0], 1)
    expect(names(original)).toEqual(['A', '[R]', 'B', 'C', 'D'])
    expect(names(moveStep(original, [9], 1))).toEqual(['A', '[R]', 'B', 'C', 'D'])
  })
})

describe('moveStep: sections and ladders, not just rounds', () => {
  const sec = (id: string, children: Block[]): Section => ({
    kind: 'section',
    id,
    name: id,
    display: 'list',
    children,
  })
  const lad = (id: string, children: Block[], counts = [5, 10]): Ladder => ({
    kind: 'ladder',
    id,
    counts,
    children,
    label: 'Set',
  })

  it('swaps adjacent steps inside a section, both directions', () => {
    const t = (): Block[] => [sec('S', [seg('A'), seg('B'), seg('C'), seg('D')])]
    expect(names(moveStep(t(), [0, 1], 1))).toEqual(['[S]', 'A', 'C', 'B', 'D'])
    expect(names(moveStep(t(), [0, 1], -1))).toEqual(['[S]', 'B', 'A', 'C', 'D'])
    // Still the section's child, not ejected beside it.
    expect(blockAt(moveStep(t(), [0, 1], 1), [0, 2])).toMatchObject({ name: 'B' })
  })

  it('swaps adjacent steps inside a ladder', () => {
    const t = (): Block[] => [lad('L', [seg('A'), seg('B'), seg('C')])]
    expect(names(moveStep(t(), [0, 0], 1))).toEqual(['[L]', 'B', 'A', 'C'])
    expect(blockAt(moveStep(t(), [0, 0], 1), [0, 1])).toMatchObject({ name: 'A' })
    expect(names(moveStep(t(), [0, 2], -1))).toEqual(['[L]', 'A', 'C', 'B'])
  })

  it('still steps out at the edges of a section', () => {
    const t = (): Block[] => [seg('X'), sec('S', [seg('A'), seg('B')]), seg('Y')]
    expect(names(moveStep(t(), [1, 0], -1))).toEqual(['X', 'A', '[S]', 'B', 'Y'])
    expect(names(moveStep(t(), [1, 1], 1))).toEqual(['X', '[S]', 'A', 'B', 'Y'])
    expect(blockAt(moveStep(t(), [1, 1], 1), [2])).toMatchObject({ name: 'B' })
  })

  it('steps out of a ladder into the section around it', () => {
    const t: Block[] = [sec('S', [lad('L', [seg('A'), seg('B')])])]
    const moved = moveStep(t, [0, 0, 1], 1)
    expect(names(moved)).toEqual(['[S]', '[L]', 'A', 'B'])
    expect(blockAt(moved, [0, 1])).toMatchObject({ name: 'B' })
  })

  it('moves a step down INTO the section that follows it', () => {
    const moved = moveStep([seg('A'), sec('S', [seg('B')])], [0], 1)
    expect(names(moved)).toEqual(['[S]', 'A', 'B'])
    expect(blockAt(moved, [0, 0])).toMatchObject({ name: 'A' })
  })

  it('moves a step up INTO the ladder above it, landing last', () => {
    const moved = moveStep([lad('L', [seg('A')]), seg('B')], [1], -1)
    expect(names(moved)).toEqual(['[L]', 'A', 'B'])
    expect(blockAt(moved, [0, 1])).toMatchObject({ name: 'B' })
  })

  it('swaps a section past a round rather than nesting it', () => {
    const two: Block[] = [sec('S', [seg('A')]), rep('R', [seg('B')])]
    const moved = moveStep(two, [0], 1)
    expect(moved.map((b) => b.id)).toEqual(['R', 'S'])
    expect((moved[1] as Section).children).toHaveLength(1)
  })

  it('is reversible inside a section: down then up returns the shape', () => {
    const original: Block[] = [sec('S', [seg('A'), seg('B'), seg('C')])]
    const there = moveStep(original, [0, 0], 1)
    const back = moveStep(there, [0, 1], -1)
    expect(names(back)).toEqual(names(original))
  })
})

describe('the tree operations reach every kind of group', () => {
  const routine = (): Block[] => [
    newSection('Warm-up', [seg('Jog', 40)]),
    newSection('Legs', [newLadder([newRungStep()], [5, 10])]),
  ]

  it('flattens a section and a ladder, not just a repeat', () => {
    const rows = flatten(routine())
    expect(rows.map((row) => `${'  '.repeat(row.depth)}${row.block.kind}`)).toEqual([
      'section',
      '  segment',
      'section',
      '  ladder',
      '    segment',
    ])
  })

  it('finds and edits a block three levels down', () => {
    const blocks = routine()
    const path = [1, 0, 0]

    expect(blockAt(blocks, path)?.kind).toBe('segment')
    const renamed = updateSegment(blocks, path, { name: 'Goblet Squats' })
    expect((blockAt(renamed, path) as Segment).name).toBe('Goblet Squats')
  })

  it('removes, appends and reorders inside a section', () => {
    const blocks = updateSection(routine(), [0], { name: 'Prep' })
    expect((blockAt(blocks, [0]) as Section).name).toBe('Prep')

    const added = appendTo(blocks, [0], seg('Jacks', 40))
    expect((blockAt(added, [0]) as Section).children).toHaveLength(2)

    const moved = moveBy(added, [0, 1], -1)
    expect(((blockAt(moved, [0]) as Section).children[0] as Segment).name).toBe('Jacks')

    const gone = removeAt(moved, [0, 0])
    expect((blockAt(gone, [0]) as Section).children).toHaveLength(1)
  })

  it('edits a ladder\'s counts', () => {
    const blocks = updateLadder(routine(), [1, 0], { counts: [3, 6, 9] })
    expect((blockAt(blocks, [1, 0]) as Ladder).counts).toEqual([3, 6, 9])
  })

  it('duplicates a whole section with fresh ids all the way down', () => {
    const blocks = duplicateAt(routine(), [1])
    const original = blockAt(blocks, [1]) as Section
    const copy = blockAt(blocks, [2]) as Section

    expect(copy.name).toBe(original.name)
    expect(copy.id).not.toBe(original.id)
    expect((copy.children[0] as Ladder).id).not.toBe((original.children[0] as Ladder).id)
  })
})

describe('setTiming: a step is timed OR counted, never both', () => {
  const stepAt = (blocks: Block[]) => blockAt(blocks, [0]) as Segment

  it('switching to reps DELETES the duration rather than blanking it', () => {
    // Absent and present-but-undefined are different things to `compile()`: one
    // is a self-paced step and the other would still be timed.
    const blocks = setTiming([seg('Squats', 20)], [0], { kind: 'reps', count: 12 })

    expect(stepAt(blocks).reps).toEqual({ kind: 'fixed', count: 12 })
    expect('durationMs' in stepAt(blocks)).toBe(false)
  })

  it('switching back to timed deletes the reps', () => {
    const reps = setTiming([seg('Squats', 20)], [0], { kind: 'reps', count: 12 })
    const timed = setTiming(reps, [0], { kind: 'timed', durationMs: 30_000 })

    expect(timed[0]).toMatchObject({ durationMs: 30_000 })
    expect('reps' in (timed[0] as Segment)).toBe(false)
  })

  it('carries perSide, and drops it when it is not asked for', () => {
    const on = setTiming([seg('Lunges', 20)], [0], { kind: 'reps', count: 5, perSide: true })
    expect(stepAt(on).reps).toEqual({ kind: 'fixed', count: 5, perSide: true })

    const off = setTiming(on, [0], { kind: 'reps', count: 5 })
    expect(stepAt(off).reps).toEqual({ kind: 'fixed', count: 5 })
  })

  it('round-trips through timingOf', () => {
    const cases: Timing[] = [
      { kind: 'timed', durationMs: 45_000 },
      { kind: 'reps', count: 12 },
      { kind: 'reps', count: 5, perSide: true },
      { kind: 'rung' },
      { kind: 'rung', perSide: true },
    ]
    for (const timing of cases) {
      expect(timingOf(stepAt(setTiming([seg('Step', 20)], [0], timing)))).toEqual(timing)
    }
  })

  it('offers the role default to a step that has no duration to go back to', () => {
    const restStep: Segment = { ...seg('Rest'), role: 'rest' }
    const reps = setTiming([restStep], [0], { kind: 'reps', count: 1 })
    expect(timingOf(stepAt(reps))).toEqual({ kind: 'reps', count: 1 })

    const cleared = { ...stepAt(reps) }
    delete cleared.reps
    // 10s, the default for a rest, not the 20s of the work step it started as.
    expect(timingOf(cleared)).toEqual({ kind: 'timed', durationMs: 10_000 })
  })
})

describe('wrapInRepeat, with the new kinds around', () => {
  it('wraps a ladder: "3 rounds of this ladder" is a real thing to ask for', () => {
    const wrapped = wrapInRepeat([newLadder()], [0])
    expect(wrapped[0]?.kind).toBe('repeat')
    expect((wrapped[0] as Repeat).children[0]?.kind).toBe('ladder')
  })

  it('refuses a section, which is a part of the routine rather than work', () => {
    const blocks = [newSection('Burnout')]
    expect(wrapInRepeat(blocks, [0])).toEqual(blocks)
  })

  it('still refuses a repeat', () => {
    const blocks = [newRepeat()]
    expect(wrapInRepeat(blocks, [0])).toEqual(blocks)
  })
})

describe('clearText: emptying a note removes it', () => {
  const noted = (): Block[] => [{ ...seg('Squats'), note: 'chest up', alternative: 'box squat' }]

  it('deletes the key rather than storing an empty string', () => {
    // "" and absent are different: one renders an empty line under the step.
    const blocks = clearText(noted(), [0], 'note')
    expect('note' in (blocks[0] as Segment)).toBe(false)
    expect((blocks[0] as Segment).alternative).toBe('box squat')
  })

  it('clears each field independently', () => {
    const blocks = clearText(clearText(noted(), [0], 'note'), [0], 'alternative')
    expect('alternative' in (blocks[0] as Segment)).toBe(false)
  })

  it('leaves a group alone', () => {
    const blocks = [newSection('Burnout')]
    expect(clearText(blocks, [0], 'note')).toEqual(blocks)
  })
})

describe('shownAsList: where an image can never be seen', () => {
  /** A counted step: no duration, so it waits for a tap. */
  const counted = (name: string): Segment => ({
    kind: 'segment',
    id: `id-${name}`,
    name,
    role: 'work',
    reps: { kind: 'fixed', count: 12 },
  })

  const section = (children: Block[], display: 'list' | 'timer' = 'list'): Section => ({
    kind: 'section',
    id: 'sec',
    name: 'Upper body',
    display,
    children,
  })

  it('is true for a counted step inside a list section', () => {
    const blocks = [section([counted('Curls'), counted('Press')])]
    expect(shownAsList(blocks, [0, 0])).toBe(true)
  })

  it('is false for a TIMED step in the same section: it runs as the countdown', () => {
    const blocks = [section([seg('Plank', 30), counted('Press')])]
    expect(shownAsList(blocks, [0, 0])).toBe(false)
  })

  it('is false for a section displayed as a timer', () => {
    const blocks = [section([counted('Curls')], 'timer')]
    expect(shownAsList(blocks, [0, 0])).toBe(false)
  })

  it('asks about the SECTION, not the group the step sits in', () => {
    // A ladder or a reps group on its own always runs as the countdown; inside a
    // list section, its steps are listed. The section owns the display mode.
    const loose = [rep('r', [counted('Curls')])]
    expect(shownAsList(loose, [0, 0])).toBe(false)

    // section → repeat → step, so the step is two levels down.
    const nested = [section([rep('r', [counted('Curls')])])]
    expect(shownAsList(nested, [0, 0, 0])).toBe(true)
  })

  it('is false for a step in no section at all, and for a group itself', () => {
    expect(shownAsList([counted('Curls')], [0])).toBe(false)
    expect(shownAsList([section([counted('Curls')])], [0])).toBe(false)
  })

  it('never hides the controls for a step the runtime actually shows a panel for', () => {
    /*
     * The property that matters, checked against the authority: every entry the
     * runtime draws as a list row must be one the editor calls listed. The
     * converse does not hold, because the last remaining row of a group runs as
     * the countdown, so this is a one-way check by design.
     */
    const blocks: Block[] = [
      seg('Get ready', 5),
      section([counted('Curls'), counted('Press'), seg('Plank', 30)]),
      section([counted('Rows'), counted('Dips')], 'timer'),
      rep('r', [counted('Squats'), counted('Lunges')]),
    ]
    const routine = compile({
      id: 'w',
      name: 'Mixed',
      blocks,
      schemaVersion: SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
    })

    const listedByEditor = new Set(
      flatten(blocks)
        .filter(({ block, path }) => block.kind === 'segment' && shownAsList(blocks, path))
        .map(({ block }) => block.id),
    )

    for (const entry of routine.entries) {
      if (!listMode(routine, entry)) continue
      expect(listedByEditor, `${entry.name} is listed while running`).toContain(entry.segmentId)
    }
    // And the check is not vacuous: something in there IS listed while running.
    expect(routine.entries.some((entry) => listMode(routine, entry))).toBe(true)
  })
})

describe('isTypedPatch: which edits share an undo step', () => {
  it('coalesces a name, which is bound to every keystroke', () => {
    expect(isTypedPatch({ name: 'Squa' })).toBe(true)
  })

  it('does NOT coalesce an image', () => {
    /*
     * The bug this exists for: with "anything but the role" as the rule, choosing
     * a picture for two steps in a row collapsed into one undo step, and one
     * press took both back.
     */
    expect(isTypedPatch({ media: { source: 'remote', url: 'https://x/y.jpg' } })).toBe(false)
  })

  it('does NOT coalesce a role, a note or an alternative', () => {
    // A role is a select; a note and an alternative are committed on blur, so
    // each is one deliberate state rather than a run of them.
    expect(isTypedPatch({ role: 'rest' })).toBe(false)
    expect(isTypedPatch({ note: 'chest up' })).toBe(false)
    expect(isTypedPatch({ alternative: 'box squat' })).toBe(false)
  })

  it('treats a mixed patch as discrete: all of it has to be typing', () => {
    expect(isTypedPatch({ name: 'Squats', role: 'work' })).toBe(false)
  })

  it('is false for an empty patch, which is not an edit at all', () => {
    expect(isTypedPatch({})).toBe(false)
  })
})
