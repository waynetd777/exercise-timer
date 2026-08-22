import { describe, expect, it } from 'vitest'
import type { Workout } from '../../engine'
import { SCHEMA_VERSION } from '../../engine'
import {
  clearMedia,
  clearText,
  moveBy,
  newLadder,
  newRepsStep,
  newRoutineBlocks,
  newRungStep,
  newSection,
  newSegment,
  removeAt,
  setTiming,
  updateLadder,
  updateRepeat,
  updateSection,
  updateSegment,
} from '../blocks'
import { isDirty } from '../dirty'

const workout = (): Workout => ({
  id: 'w1',
  name: 'Leg day',
  blocks: newRoutineBlocks(),
  schemaVersion: SCHEMA_VERSION,
  createdAt: 0,
  updatedAt: 0,
})

describe('isDirty', () => {
  it('is clean when nothing has been touched', () => {
    const w = workout()
    expect(isDirty(w, w.name, w.blocks)).toBe(false)
  })

  it('ignores whitespace around the name, since saving trims it', () => {
    const w = workout()
    expect(isDirty(w, '  Leg day  ', w.blocks)).toBe(false)
  })

  it('notices a renamed routine', () => {
    const w = workout()
    expect(isDirty(w, 'Leg day 2', w.blocks)).toBe(true)
  })

  it('notices a colour being chosen, changed and cleared', () => {
    const plain = workout()
    expect(isDirty(plain, plain.name, plain.blocks, 'blue')).toBe(true)

    const blue: Workout = { ...plain, colour: 'blue' }
    expect(isDirty(blue, blue.name, blue.blocks, 'blue')).toBe(false)
    expect(isDirty(blue, blue.name, blue.blocks, 'red')).toBe(true)
    expect(isDirty(blue, blue.name, blue.blocks, null)).toBe(true)
  })

  it('treats an absent colour and null as the same thing', () => {
    const w = workout()
    expect(isDirty(w, w.name, w.blocks, null)).toBe(false)
  })

  it('reports clean for a three-argument call on a coloured routine', () => {
    // The colour argument defaults to the original's, so a caller that predates
    // colours cannot be told a routine is dirty just for having one.
    const blue: Workout = { ...workout(), colour: 'blue' }
    expect(isDirty(blue, blue.name, blue.blocks)).toBe(false)
  })

  it('notices every kind of block edit', () => {
    const w = workout()
    const cases: Record<string, ReturnType<typeof updateSegment>> = {
      'changed duration': updateSegment(w.blocks, [0], { durationMs: 45_000 }),
      'changed name': updateSegment(w.blocks, [0], { name: 'Set up' }),
      'changed role': updateSegment(w.blocks, [0], { role: 'rest' }),
      'changed round count': updateRepeat(w.blocks, [1], { times: 8 }),
      'changed round label': updateRepeat(w.blocks, [1], { label: 'Set' }),
      'changed round advance': updateRepeat(w.blocks, [1], { advance: 'step' }),
      'removed a step': removeAt(w.blocks, [0]),
      'reordered steps': moveBy(w.blocks, [0], 1),
      'added an image': updateSegment(w.blocks, [1, 0], {
        media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
      }),
    }
    for (const [what, blocks] of Object.entries(cases)) {
      expect(isDirty(w, w.name, blocks), what).toBe(true)
    }
  })

  it('notices an image being cleared', () => {
    const withImage = updateSegment(newRoutineBlocks(), [0], {
      media: { source: 'remote', url: 'https://i.postimg.cc/x/y.png' },
    })
    const w = { ...workout(), blocks: withImage }
    expect(isDirty(w, w.name, clearMedia(withImage, [0]))).toBe(true)
  })

  it('is clean again if an edit is reverted to the same values', () => {
    const w = workout()
    const there = updateSegment(w.blocks, [0], { durationMs: 45_000 })
    const back = updateSegment(there, [0], { durationMs: 30_000 })
    expect(isDirty(w, w.name, back)).toBe(false)
  })

  it('is not fooled by key order: a patched object is compared by field', () => {
    const w = workout()
    // Patching to the SAME value rewrites the object without changing content.
    const repatched = updateSegment(w.blocks, [0], { name: 'Get ready' })
    expect(isDirty(w, w.name, repatched)).toBe(false)
  })

  it('notices a step added or removed inside a round', () => {
    const w = workout()
    expect(isDirty(w, w.name, removeAt(w.blocks, [1, 1]))).toBe(true)
  })

  it('treats a different step id as a change, even with the same values', () => {
    // Replacing a step is a change even if it looks identical.
    const w = workout()
    const replaced = [...w.blocks]
    replaced[0] = newSegment('prepare')
    expect(isDirty(w, w.name, replaced)).toBe(true)
  })
})

describe('isDirty: rep counts and alternatives', () => {
  // A self-paced routine: one step of 10 reps, with a swap noted.
  const repsWorkout = (): Workout => ({
    id: 'w2',
    name: 'Push day',
    blocks: [{ ...newRepsStep(10), alternative: 'From the knees' }],
    schemaVersion: SCHEMA_VERSION,
    createdAt: 0,
    updatedAt: 0,
  })

  it('is clean when nothing has been touched', () => {
    const w = repsWorkout()
    expect(isDirty(w, w.name, w.blocks)).toBe(false)
  })

  it('notices every way the timing choice can change', () => {
    const w = repsWorkout()
    const cases: Record<string, ReturnType<typeof setTiming>> = {
      'changed rep count': setTiming(w.blocks, [0], { kind: 'reps', count: 12 }),
      'toggled each side': setTiming(w.blocks, [0], { kind: 'reps', count: 10, perSide: true }),
      'switched to a rung count': setTiming(w.blocks, [0], { kind: 'rung' }),
      'switched to a timer': setTiming(w.blocks, [0], { kind: 'timed', durationMs: 30_000 }),
    }
    for (const [what, blocks] of Object.entries(cases)) {
      expect(isDirty(w, w.name, blocks), what).toBe(true)
    }
  })

  it('is clean when the timing is re-set to the same values', () => {
    // setTiming rewrites the step object either way; only content may count.
    const w = repsWorkout()
    expect(isDirty(w, w.name, setTiming(w.blocks, [0], { kind: 'reps', count: 10 }))).toBe(false)
  })

  it('notices an alternative being edited or cleared', () => {
    const w = repsWorkout()
    const edited = updateSegment(w.blocks, [0], { alternative: 'On an incline' })
    expect(isDirty(w, w.name, edited), 'edited').toBe(true)
    expect(isDirty(w, w.name, clearText(w.blocks, [0], 'alternative')), 'cleared').toBe(true)
  })
})

describe('isDirty: sections and ladders', () => {
  const grouped = (): Workout => ({
    id: 'w3',
    name: 'Full body',
    blocks: [
      newSection('Warm-up', [newRepsStep(10)]),
      newLadder([newRungStep()], [5, 10, 15]),
    ],
    schemaVersion: SCHEMA_VERSION,
    createdAt: 0,
    updatedAt: 0,
  })

  it('is clean when nothing has been touched', () => {
    const w = grouped()
    expect(isDirty(w, w.name, w.blocks)).toBe(false)
  })

  it('is clean when a field is re-set to the same value', () => {
    const w = grouped()
    const repatched = updateSection(w.blocks, [0], { name: 'Warm-up' })
    expect(isDirty(w, w.name, repatched)).toBe(false)
  })

  it('notices every section and ladder edit', () => {
    const w = grouped()
    const cases: Record<string, ReturnType<typeof updateSection>> = {
      'renamed section': updateSection(w.blocks, [0], { name: 'Prep' }),
      'changed section note': updateSection(w.blocks, [0], { note: 'No rest between' }),
      'changed section display': updateSection(w.blocks, [0], { display: 'timer' }),
      'changed section advance': updateSection(w.blocks, [0], { advance: 'step' }),
      'edited a step inside the section': updateSegment(w.blocks, [0, 0], { name: 'Squats' }),
      'changed ladder label': updateLadder(w.blocks, [1], { label: 'Rung' }),
      'changed one rung': updateLadder(w.blocks, [1], { counts: [5, 12, 15] }),
      'added a rung': updateLadder(w.blocks, [1], { counts: [5, 10, 15, 20] }),
      'changed ladder advance': updateLadder(w.blocks, [1], { advance: 'step' }),
      'edited a step inside the ladder': setTiming(w.blocks, [1, 0], {
        kind: 'rung',
        perSide: true,
      }),
    }
    for (const [what, blocks] of Object.entries(cases)) {
      expect(isDirty(w, w.name, blocks), what).toBe(true)
    }
  })
})
