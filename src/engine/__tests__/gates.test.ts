/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { compile, hasGates, stepCount, totalDurationMs } from '../compile'
import { armsSection, ladder, legsLadder, rep, section, seg, step, tabata, workout } from './fixtures'
import type { Repeat, Segment } from '../types'

describe('self-paced steps', () => {
  it('keeps a step with no duration, and marks it self-paced', () => {
    const routine = compile(workout('Reps only', [step('Push-ups', 12)]))

    expect(routine.entries).toHaveLength(1)
    expect(routine.entries[0]).toMatchObject({
      name: 'Push-ups',
      selfPaced: true,
      reps: { count: 12 },
      startMs: 0,
      endMs: 0,
    })
    // ABSENT, not present-and-undefined: `exactOptionalPropertyTypes` is on, and
    // the difference is what stops a self-paced step reading as a zero-length one.
    expect('durationMs' in routine.entries[0]!).toBe(false)
    expect(routine.hasGates).toBe(true)
  })

  it('DROPS a step whose duration is present but zero, rather than making it self-paced', () => {
    // The trap this rule exists for: a mistyped 0 must not silently become a
    // step that waits forever for a tap.
    const zero: Segment = { ...seg('Typo', 1), durationMs: 0 }
    const negative: Segment = { ...seg('Worse', 1), durationMs: -5000 }
    const nonFinite: Segment = { ...seg('Nonsense', 1), durationMs: Number.NaN }

    const routine = compile(workout('Degenerate', [zero, negative, nonFinite, seg('Real', 10)]))

    expect(routine.entries.map((e) => e.name)).toEqual(['Real'])
    expect(routine.hasGates).toBe(false)
  })

  it('counts only timed steps towards the total, and flags the routine as estimated', () => {
    const mixed = workout('Mixed', [seg('Warm up', 40), step('Push-ups', 12), seg('Rest', 20, 'rest')])
    const routine = compile(mixed)

    expect(routine.totalMs).toBe(60_000)
    expect(routine.hasGates).toBe(true)
    expect(totalDurationMs(mixed)).toBe(routine.totalMs)
    expect(stepCount(mixed)).toBe(3)
    expect(hasGates(mixed)).toBe(true)
  })
})

describe('runs and gates', () => {
  it('compiles a fully timed routine to exactly one run, unchanged from before', () => {
    const routine = compile(tabata())

    expect(routine.runs).toHaveLength(1)
    expect(routine.hasGates).toBe(false)
    expect(routine.runs[0]!.selfPaced).toBe(false)
    expect(routine.runs[0]!.totalMs).toBe(routine.totalMs)
    // Run-local times are routine times when there is only one run.
    expect(routine.entries[1]).toMatchObject({ startMs: 10_000, endMs: 30_000, index: 1 })
  })

  it('gives every self-paced step a run of its own, and groups timed steps between them', () => {
    const routine = compile(
      workout('Mixed', [
        seg('Jog', 40),
        seg('Jacks', 40),
        step('Push-ups', 12),
        step('V-Ups', 10),
        seg('Rest', 45, 'rest'),
        seg('Plank', 30),
      ]),
    )

    expect(routine.runs.map((run) => ({ selfPaced: run.selfPaced, steps: run.entries.length }))).toEqual([
      { selfPaced: false, steps: 2 },
      { selfPaced: true, steps: 1 },
      { selfPaced: true, steps: 1 },
      { selfPaced: false, steps: 2 },
    ])
    expect(routine.runs.map((run) => run.totalMs)).toEqual([80_000, 0, 0, 75_000])
  })

  it('restarts run-local time after every gate, while step numbers stay continuous', () => {
    const routine = compile(
      workout('Mixed', [seg('Jog', 40), step('Push-ups', 12), seg('Rest', 45, 'rest'), seg('Plank', 30)]),
    )

    expect(
      routine.entries.map((e) => ({ step: e.step, index: e.index, run: e.runIndex, start: e.startMs })),
    ).toEqual([
      { step: 1, index: 0, run: 0, start: 0 },
      { step: 2, index: 0, run: 1, start: 0 },
      { step: 3, index: 0, run: 2, start: 0 },
      { step: 4, index: 1, run: 2, start: 45_000 },
    ])
  })

  it('shares one entry object between the routine and its run', () => {
    const routine = compile(workout('Mixed', [seg('Jog', 40), step('Push-ups', 12)]))
    expect(routine.runs[0]!.entries[0]).toBe(routine.entries[0])
    expect(routine.runs[1]!.entries[0]).toBe(routine.entries[1])
  })
})

describe('ladders', () => {
  it('runs one iteration per rung, in order, scaling only the rung-marked children', () => {
    const routine = compile(
      workout('Ladder', [ladder([2, 4, 6], [step('Thrusters', 'rung'), step('Lunges', 10)])]),
    )

    expect(routine.entries.map((e) => `${e.name} ${e.reps!.count}`)).toEqual([
      'Thrusters 2',
      'Lunges 10',
      'Thrusters 4',
      'Lunges 10',
      'Thrusters 6',
      'Lunges 10',
    ])
  })

  it('runs the accessories after the FINAL rung too, unlike a trailing rest', () => {
    const routine = compile(legsLadder())
    const last = routine.entries.slice(-3).map((e) => e.name)

    expect(last).toEqual(['Goblet Squats', 'RB Lateral Walks', 'Breathe'])
    // 5 rungs x 3 children, nothing dropped at the end.
    expect(routine.entries).toHaveLength(15)
  })

  it('records the rung on the path, so the run screen can caption "Set 4 of 5 · 8 reps"', () => {
    const routine = compile(legsLadder())
    const fourthRung = routine.entries.find((e) => e.reps?.count === 8)!

    expect(fourthRung.path.at(-1)).toEqual({
      kind: 'ladder',
      id: expect.any(String),
      label: 'Set',
      iteration: 4,
      of: 5,
      rung: 8,
    })
  })

  it('drops degenerate rungs and floors fractional ones', () => {
    const routine = compile(
      workout('Rough', [ladder([0, -3, Number.NaN, 2.7, 5], [step('Squats', 'rung')])]),
    )
    expect(routine.entries.map((e) => e.reps!.count)).toEqual([2, 5])
  })

  it('contributes nothing when it has no usable rungs', () => {
    const empty = workout('Empty ladder', [ladder([], [step('Squats', 'rung')])])
    expect(compile(empty).entries).toHaveLength(0)
    expect(stepCount(empty)).toBe(0)
  })

  it('shows no count for a rung-marked step outside a ladder', () => {
    // Half-authored rather than zero reps: "0 ×" would be worse than nothing.
    const routine = compile(workout('Orphan', [step('Squats', 'rung')]))
    expect(routine.entries[0]!.reps).toBeUndefined()
  })

  it('keeps perSide, and never doubles the count itself', () => {
    const routine = compile(legsLadder())
    const walks = routine.entries.find((e) => e.name === 'RB Lateral Walks')!
    expect(walks.reps).toEqual({ count: 5, perSide: true })
  })
})

describe('a round clears with ONE tap', () => {
  it('puts a round\'s rep-based steps in one gate, and keeps its rest on the clock', () => {
    const routine = compile(armsSection())

    expect(
      routine.runs.map((run) => ({
        selfPaced: run.selfPaced,
        names: run.entries.map((entry) => entry.name),
      })),
    ).toEqual([
      { selfPaced: true, names: ['Bicep Curls', 'Arnold Press', 'Upright Rows'] },
      { selfPaced: false, names: ['Rest'] },
      { selfPaced: true, names: ['Bicep Curls', 'Arnold Press', 'Upright Rows'] },
      { selfPaced: false, names: ['Rest'] },
      { selfPaced: true, names: ['Bicep Curls', 'Arnold Press', 'Upright Rows'] },
      { selfPaced: false, names: ['Rest'] },
      // The fourth round has no rest after it, by the trailing-rest rule.
      { selfPaced: true, names: ['Bicep Curls', 'Arnold Press', 'Upright Rows'] },
    ])
  })

  it('does not merge one round into the next', () => {
    const routine = compile(
      workout('Rounds', [rep(3, [step('Curls', 12), step('Press', 10)], 'Round')]),
    )
    expect(routine.runs).toHaveLength(3)
  })

  it('does not merge two rounds of a repeat around a single-rung ladder', () => {
    // Both rounds run the ladder's iteration 1, so a key built from the
    // innermost level alone read them as one gate and a tap skipped round 2.
    const routine = compile(
      workout('Rounds of one rung', [rep(2, [ladder([5], [step('Squats', 'rung')])], 'Round')]),
    )
    expect(routine.runs).toHaveLength(2)
    expect(routine.runs.every((run) => run.selfPaced && run.entries.length === 1)).toBe(true)
  })

  it('does not merge the rounds of a repeat around a section', () => {
    // A section is always iteration 1 of 1: only the outer repeat's level on
    // the path can tell its rounds apart.
    const routine = compile(
      workout('Rounds of a block', [
        rep(3, [section('Block', [step('Curls', 12), step('Press', 10)])], 'Round'),
      ]),
    )
    expect(routine.runs).toHaveLength(3)
    expect(routine.runs.map((run) => run.entries.length)).toEqual([2, 2, 2])
  })

  it('collapses the loose steps of a section, which is what "without stopping" means', () => {
    const routine = compile(
      workout('Burnout', [
        section('Final Burnout', [
          step('Sumo Squats', 20),
          step('Curtsy Lunges', 20),
          step('Squat Pulses', 30),
        ]),
      ]),
    )
    expect(routine.runs).toHaveLength(1)
    expect(routine.runs[0]!.entries).toHaveLength(3)
  })

  it('keeps a section\'s own steps separate from a group inside it', () => {
    // The last rung of the ladder must not merge with the block that follows it.
    const routine = compile(
      workout('Legs', [
        section('Legs', [ladder([5], [step('Squats', 'rung')]), step('Calf Raises', 15)]),
      ]),
    )
    expect(routine.runs.map((run) => run.entries.map((e) => e.name))).toEqual([
      ['Squats'],
      ['Calf Raises'],
    ])
  })

  it('advances a step belonging to no group at all on its own', () => {
    const routine = compile(workout('Loose', [step('Push-ups', 12), step('V-Ups', 10)]))
    expect(routine.runs).toHaveLength(2)
  })

  it('lets an inner opt-out beat an outer default', () => {
    const inner: Repeat = { ...rep(2, [step('Curls', 12), step('Press', 10)]), advance: 'step' }
    const routine = compile(workout('Mixed', [ladder([5], [inner])]))

    // Four steps, four taps: the inner "one at a time" is not overruled by the
    // ladder enclosing it.
    expect(routine.runs).toHaveLength(4)
  })
})

describe('a ladder rung clears with ONE tap', () => {
  it('puts the whole rung in one gate', () => {
    const routine = compile(
      workout('Ladder', [ladder([20, 16], [step('Goblet Squats', 'rung'), step('Walks', 10), step('Kickbacks', 10)])]),
    )

    // Two rungs of three exercises: six steps, but two gates.
    expect(routine.entries).toHaveLength(6)
    expect(routine.runs).toHaveLength(2)
    expect(routine.runs.map((run) => run.entries.map((entry) => entry.name))).toEqual([
      ['Goblet Squats', 'Walks', 'Kickbacks'],
      ['Goblet Squats', 'Walks', 'Kickbacks'],
    ])
  })

  it('keeps a timed step inside the rung on its own clock', () => {
    // A 10-second wall sit is worth counting down, so it is not swallowed by the
    // tap that clears the reps. It plays itself and flows into the next rung.
    const routine = compile(legsLadder())

    expect(routine.runs.slice(0, 4).map((run) => ({
      selfPaced: run.selfPaced,
      names: run.entries.map((entry) => entry.name),
    }))).toEqual([
      { selfPaced: true, names: ['Goblet Squats', 'RB Lateral Walks'] },
      { selfPaced: false, names: ['Breathe'] },
      { selfPaced: true, names: ['Goblet Squats', 'RB Lateral Walks'] },
      { selfPaced: false, names: ['Breathe'] },
    ])
  })

  it('does not merge rungs, or two ladders, into one gate', () => {
    const routine = compile(
      workout('Two', [
        ladder([5, 10], [step('Squats', 'rung')]),
        ladder([5, 10], [step('Lunges', 'rung')]),
      ]),
    )
    expect(routine.runs).toHaveLength(4)
  })

  it('advances one exercise at a time when the ladder asks for it', () => {
    const group = ladder([20], [step('Squats', 'rung'), step('Walks', 10)])
    const routine = compile(workout('Stepped', [{ ...group, advance: 'step' }]))

    expect(routine.runs).toHaveLength(2)
  })

  it('leaves self-paced steps outside a ladder one to a gate', () => {
    const routine = compile(workout('Loose', [step('Push-ups', 12), step('V-Ups', 10)]))
    expect(routine.runs).toHaveLength(2)
  })
})

describe('sections', () => {
  it('adds a path level carrying the display mode and the section note', () => {
    const routine = compile(armsSection())

    expect(routine.entries[0]!.path[0]).toEqual({
      kind: 'section',
      id: expect.any(String),
      label: '#2 Arms & Shoulders',
      iteration: 1,
      of: 1,
      display: 'list',
      note: 'No rest between exercises. Rest 45 seconds after each round.',
    })
  })

  it('changes nothing about timing or step count', () => {
    const bare = workout('Bare', [seg('Jog', 40), seg('Rest', 20, 'rest')])
    const wrapped = workout('Wrapped', [section('Warm-up', [seg('Jog', 40), seg('Rest', 20, 'rest')], 'timer')])

    expect(compile(wrapped).totalMs).toBe(compile(bare).totalMs)
    expect(compile(wrapped).entries).toHaveLength(compile(bare).entries.length)
  })

  it('still drops a round’s trailing rest inside a section', () => {
    // "Rest 45 seconds after each round" meets the between-reps rule: three rests
    // for four rounds. A parser wanting the fourth rest must place it AFTER the
    // group rather than inside it.
    const routine = compile(armsSection())
    expect(routine.entries.filter((e) => e.name === 'Rest')).toHaveLength(3)
    expect(routine.entries.at(-1)!.name).toBe('Upright Rows')
  })
})

describe('the cheap measures agree with compile', () => {
  const cases = {
    tabata: tabata(),
    arms: armsSection(),
    legs: legsLadder(),
    nestedSections: workout('Nested', [
      section('Warm-up', [seg('Jog', 40), seg('Jacks', 40)], 'timer'),
      section('Main', [rep(3, [step('Burpees', 10), seg('Rest', 30, 'rest')], 'Round')]),
      section('Finish', [ladder([5, 10], [step('Squats', 'rung')])]),
    ]),
  }

  it.each(Object.entries(cases))('%s', (_name, routine) => {
    const compiled = compile(routine)
    expect(totalDurationMs(routine)).toBe(compiled.totalMs)
    expect(stepCount(routine)).toBe(compiled.entries.length)
    expect(hasGates(routine)).toBe(compiled.hasGates)
  })

  it('agrees that a gate inside a never-running repeat is no gate', () => {
    const wk = workout('Skipped', [rep(0, [step('Push-ups', 12)])])
    expect(compile(wk).hasGates).toBe(false)
    expect(hasGates(wk)).toBe(false)
  })

  it('agrees that a single round drops its self-paced trailing rest', () => {
    const restUntilReady: Segment = { ...step('Rest until ready'), role: 'rest' }
    const once = workout('One round', [rep(1, [seg('Work', 30), restUntilReady])])
    expect(compile(once).hasGates).toBe(false)
    expect(hasGates(once)).toBe(false)

    // With two rounds the rest RUNS between them, so it is a gate again.
    const restBetween: Segment = { ...step('Rest until ready'), role: 'rest' }
    const twice = workout('Two rounds', [rep(2, [seg('Work', 30), restBetween])])
    expect(compile(twice).hasGates).toBe(true)
    expect(hasGates(twice)).toBe(true)
  })

  it('agrees that a gate inside a ladder with no usable rungs is no gate', () => {
    const wk = workout('No rungs', [ladder([], [step('Squats', 'rung')])])
    expect(compile(wk).hasGates).toBe(false)
    expect(hasGates(wk)).toBe(false)
  })
})
