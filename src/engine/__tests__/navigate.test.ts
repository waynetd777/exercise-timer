/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { compile } from '../compile'
import {
  advance,
  cursorForStep,
  groupEntries,
  groupOf,
  locate,
  nextRun,
  retreat,
  runIsOver,
  sectionOf,
  START,
} from '../navigate'
import type { Cursor } from '../navigate'
import { armsSection, ladder, legsLadder, rep, section, seg, step, tabata, workout } from './fixtures'

/** Warm-up (2 timed), two rep steps, then a rest and a plank (2 timed). */
const mixed = () =>
  compile(
    workout('Mixed', [
      seg('Jog', 40),
      seg('Jacks', 40),
      step('Push-ups', 12),
      step('V-Ups', 10),
      seg('Rest', 45, 'rest'),
      seg('Plank', 30),
    ]),
  )

const at = (runIndex: number, elapsedInRunMs: number): Cursor => ({ runIndex, elapsedInRunMs })

describe('locate', () => {
  it('behaves exactly as position() does inside a timed run', () => {
    const routine = mixed()
    expect(locate(routine, at(0, 0))).toMatchObject({
      step: 1,
      elapsedInEntryMs: 0,
      remainingMs: 40_000,
    })
    expect(locate(routine, at(0, 55_000))).toMatchObject({
      step: 2,
      elapsedInEntryMs: 15_000,
      remainingMs: 25_000,
    })
  })

  it('holds a self-paced step open, counting up with nothing to count down', () => {
    const routine = mixed()
    const held = locate(routine, at(1, 84_000))

    expect(held).toMatchObject({ step: 3, elapsedInEntryMs: 84_000, remainingMs: null })
    expect(held.entry!.name).toBe('Push-ups')
    expect(held.isComplete).toBe(false)
  })

  it('does NOT fall through a gate when the clock overshoots a timed run', () => {
    // Only advance() may cross a gate. A timeout that fired late must never cost
    // the user a step.
    const routine = mixed()
    const over = locate(routine, at(0, 10 * 60_000))

    expect(over.entry!.name).toBe('Jacks')
    expect(over.isComplete).toBe(false)
    expect(runIsOver(routine, at(0, 10 * 60_000))).toBe(true)
  })

  it('reports the next step across a run boundary, for image preloading', () => {
    const routine = mixed()
    expect(locate(routine, at(0, 50_000)).nextEntry!.name).toBe('Push-ups')
    expect(locate(routine, at(1, 0)).nextEntry!.name).toBe('V-Ups')
  })

  it('is complete past the last run, and clamps nonsense cursors', () => {
    const routine = mixed()
    expect(locate(routine, at(99, 0)).isComplete).toBe(true)
    expect(locate(routine, at(-2, -5)).step).toBe(1)
    expect(locate(routine, at(Number.NaN, Number.NaN)).step).toBe(1)
  })
})

describe('runIsOver', () => {
  it('is true only when a TIMED run has run out', () => {
    const routine = mixed()
    expect(runIsOver(routine, at(0, 79_999))).toBe(false)
    expect(runIsOver(routine, at(0, 80_000))).toBe(true)
    // A self-paced run waits however long it waits.
    expect(runIsOver(routine, at(1, 60 * 60_000))).toBe(false)
  })
})

describe('advance', () => {
  it('steps within a timed run', () => {
    expect(advance(mixed(), at(0, 5_000))).toEqual(at(0, 40_000))
  })

  it('crosses into the next run from the last step of a timed one', () => {
    expect(advance(mixed(), at(0, 50_000))).toEqual(at(1, 0))
  })

  it('crosses from a self-paced step, however long it has been held', () => {
    expect(advance(mixed(), at(1, 0))).toEqual(at(2, 0))
    expect(advance(mixed(), at(1, 10 * 60_000))).toEqual(at(2, 0))
  })

  it('discards overshoot rather than burning through later steps', () => {
    // Ten minutes in a pocket during the warm-up: arrive at the gate ready to go.
    const routine = mixed()
    expect(nextRun(routine, at(0, 10 * 60_000))).toEqual(at(1, 0))
    expect(locate(routine, nextRun(routine, at(0, 10 * 60_000))).step).toBe(3)
  })

  it('walks the whole routine one step at a time and then completes', () => {
    const routine = mixed()
    const seen: string[] = []
    let cursor = START
    for (let guard = 0; guard < 20; guard++) {
      const here = locate(routine, cursor)
      if (here.isComplete) break
      seen.push(here.entry!.name)
      cursor = advance(routine, cursor)
    }

    expect(seen).toEqual(['Jog', 'Jacks', 'Push-ups', 'V-Ups', 'Rest', 'Plank'])
    expect(locate(routine, cursor).isComplete).toBe(true)
    // Past the end stays past the end.
    expect(advance(routine, cursor)).toEqual(cursor)
  })
})

describe('retreat', () => {
  it('restarts the current step, unless you have only just entered it', () => {
    const routine = mixed()
    expect(retreat(routine, at(0, 45_000))).toEqual(at(0, 40_000))
    expect(retreat(routine, at(0, 40_500))).toEqual(at(0, 0))
  })

  it('lands on the LAST step of the previous run, not the top of it', () => {
    const routine = mixed()
    // From the first rep step back onto the warm-up's second step.
    expect(retreat(routine, at(1, 0))).toEqual(at(0, 40_000))
    // From the rest, back onto the last rep step.
    expect(retreat(routine, at(3, 0))).toEqual(at(2, 0))
  })

  it('restarts a self-paced step that has been held a while', () => {
    expect(retreat(mixed(), at(1, 9_000))).toEqual(at(1, 0))
  })

  it('steps back onto the final run from completion', () => {
    const routine = mixed()
    expect(retreat(routine, at(routine.runs.length, 0))).toEqual(at(3, 45_000))
  })

  it('cannot go back past the start', () => {
    expect(retreat(mixed(), at(0, 0))).toEqual(START)
  })

  it('does not exit the run when its first step is shorter than the threshold', () => {
    // [gate, 1s Blip, 10s Work]: 500ms into Work is just past the Blip, so the
    // whole run's elapsed is still under the threshold. Retreat must land on
    // the start of the run, not back on the gate.
    const routine = compile(
      workout('Short first', [step('Push-ups', 12), seg('Blip', 1), seg('Work', 10)]),
    )
    expect(retreat(routine, at(1, 1500))).toEqual(at(1, 0))

    // From early in the Blip itself, the run IS exited, as the threshold rule
    // says.
    expect(retreat(routine, at(1, 500))).toEqual(at(0, 0))
  })
})

describe('cursorForStep', () => {
  it('round-trips every step of a mixed routine', () => {
    const routine = mixed()
    for (const entry of routine.entries) {
      expect(locate(routine, cursorForStep(routine, entry.step)).step).toBe(entry.step)
    }
  })

  it('clamps out-of-range steps', () => {
    const routine = mixed()
    expect(cursorForStep(routine, 0)).toEqual(START)
    expect(locate(routine, cursorForStep(routine, 999)).isComplete).toBe(true)
  })

  it('seeks a MID-GATE step to the gate top, deliberately', () => {
    // The gate is the unit of navigation: it clears with one tap and has no
    // position inside it to seek to. Seeking to the rung's second exercise
    // lands on the gate, which reports its FIRST step. Intended, not a bug.
    const routine = compile(
      workout('Rung', [ladder([5], [step('Squats', 'rung'), step('Walks', 10)])]),
    )
    const second = routine.entries[1]!
    const cursor = cursorForStep(routine, second.step)

    expect(cursor).toEqual(at(second.runIndex, 0))
    expect(locate(routine, cursor).step).toBe(routine.entries[0]!.step)
  })
})

describe('groupEntries: what list mode draws', () => {
  it('gives the current round of a repeat, and only that round', () => {
    const routine = compile(armsSection())
    const secondRound = routine.entries.filter((e) => groupOf(e)!.iteration === 2)
    const group = groupEntries(routine, secondRound[0]!)

    expect(group.map((e) => e.name)).toEqual(['Bicep Curls', 'Arnold Press', 'Upright Rows', 'Rest'])
    expect(group).toEqual(secondRound)
  })

  it('gives the current rung of a ladder, accessories included', () => {
    const routine = compile(legsLadder())
    const rungOf8 = routine.entries.find((e) => e.reps?.count === 8)!

    expect(groupEntries(routine, rungOf8).map((e) => e.name)).toEqual([
      'Goblet Squats',
      'RB Lateral Walks',
      'Breathe',
    ])
  })

  it('gives the whole section when the section has no group inside it', () => {
    const routine = compile(
      workout('Burnout', [
        section('Final Burnout', [step('Sumo Squats', 20), step('Squat Pulses', 20), seg('Wall Sit', 30)]),
      ]),
    )

    expect(groupEntries(routine, routine.entries[1]!)).toHaveLength(3)
  })

  it('gives the whole routine for a step outside every group', () => {
    const routine = compile(tabata())
    expect(groupEntries(routine, routine.entries[0]!)).toBe(routine.entries)
  })

  it('does not leak between two groups that share a parent', () => {
    const routine = compile(
      workout('Two ladders', [
        section('Legs', [
          ladder([5], [step('Squats', 'rung')]),
          ladder([5], [step('Lunges', 'rung')]),
        ]),
      ]),
    )

    expect(groupEntries(routine, routine.entries[0]!).map((e) => e.name)).toEqual(['Squats'])
  })
})

describe('sectionOf', () => {
  it('finds the enclosing section through the groups between', () => {
    const routine = compile(armsSection())
    const found = sectionOf(routine.entries[0]!)

    expect(found).toMatchObject({ kind: 'section', label: '#2 Arms & Shoulders', display: 'list' })
  })

  it('is null for a routine with no sections', () => {
    const routine = compile(workout('Plain', [rep(2, [seg('Work', 20)], 'Reps')]))
    expect(sectionOf(routine.entries[0]!)).toBeNull()
  })
})
