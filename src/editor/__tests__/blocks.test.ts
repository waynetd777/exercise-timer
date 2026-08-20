import { describe, expect, it } from 'vitest'
import type { Block, Repeat, Segment } from '../../engine'
import { compile, totalDurationMs } from '../../engine'
import {
  appendTo,
  blockAt,
  flatten,
  insertAfter,
  moveBy,
  newRepeat,
  newRoutineBlocks,
  newSegment,
  removeAt,
  unwrapRepeat,
  updateRepeat,
  updateSegment,
  wrapInRepeat,
} from '../blocks'

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
  label: 'Round',
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

  it('leaves a segment alone — it has no children to append to', () => {
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
    // Moving the first child up stays inside — it does not become a sibling of
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

  it('defaults a new round to 3 reps of a 20s exercise and a 10s rest', () => {
    const round = newRepeat()
    expect(round.times).toBe(3)
    expect(round.label).toBe('Round')
    expect(round.children.map((c) => (c.kind === 'segment' ? [c.role, c.durationMs] : null))).toEqual(
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

describe('newRoutineBlocks — what a new routine opens on', () => {
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

  it('compiles to 9 steps totalling 3:30', () => {
    // 30 + 3 x (20 + 10) + 30 + 60 = 210s
    const timeline = compile({ ...base, blocks: template })
    expect(timeline.entries).toHaveLength(9)
    expect(timeline.totalMs).toBe(210_000)
  })

  it('labels the rounds, so the run screen shows "Round 2 of 3"', () => {
    const entry = compile({ ...base, blocks: template }).entries[3]!
    expect(entry.path).toEqual([
      { repeatId: expect.any(String), label: 'Round', iteration: 2, of: 3 },
    ])
  })
})

describe('defaults, stated once', () => {
  it('holds every default the routines rely on', () => {
    // Restated as a single guard: get ready 30s, round of 3 with 20s work and
    // 10s rest, rest 10s. Changing any of these should fail here first.
    expect(newSegment('prepare').durationMs).toBe(30_000)
    expect(newSegment('rest').durationMs).toBe(10_000)
    expect(newSegment('work').durationMs).toBe(20_000)

    const round = newRepeat()
    expect(round.times).toBe(3)
    expect(round.children).toHaveLength(2)
    expect(compile({ ...base, blocks: [round] }).totalMs).toBe(3 * 30_000)
  })
})
