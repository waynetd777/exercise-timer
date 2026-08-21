import { describe, expect, it } from 'vitest'
import { compile } from '../../engine'
import { seg, step, workout } from '../../engine/__tests__/fixtures'
import { tick } from '../tick'

/** 40s + 40s warm-up, a rep step, then a 45s rest and a 30s plank. */
const mixed = () =>
  compile(
    workout('Mixed', [
      seg('Jog', 40),
      seg('Jacks', 40),
      step('Push-ups', 12),
      seg('Rest', 45, 'rest'),
      seg('Plank', 30),
    ]),
  )

const timed = () => compile(workout('Timed', [seg('Work', 20), seg('Rest', 10, 'rest')]))

describe('tick', () => {
  it('stays in the run and wakes on the next whole second', () => {
    expect(tick(timed(), 0, 0)).toEqual({
      kind: 'stay',
      cursor: { runIndex: 0, elapsedInRunMs: 0 },
      nextChangeInMs: 1000,
    })
    // 3.4s in: 16.6s shown, so the display next changes 600ms from now.
    expect(tick(timed(), 0, 3_400)).toMatchObject({ kind: 'stay', nextChangeInMs: 600 })
  })

  it('wakes exactly at the end of a step, not a whole second past it', () => {
    // 19.2s into a 20s step shows "1", which changes when the step ends.
    expect(tick(timed(), 0, 19_200)).toMatchObject({ kind: 'stay', nextChangeInMs: 800 })
  })

  it('never schedules busier than 60fps', () => {
    expect(tick(timed(), 0, 19_999.5)).toMatchObject({ kind: 'stay', nextChangeInMs: 16 })
  })

  it('moves to the next run when a timed run runs out', () => {
    expect(tick(mixed(), 0, 80_000)).toEqual({ kind: 'move', cursor: { runIndex: 1, elapsedInRunMs: 0 } })
  })

  it('JUMPS to the gate after ten minutes asleep, rather than walking to it', () => {
    // The property the whole derived-clock design exists for. One move, and the
    // overshoot is discarded — arrive at the rep step ready to go.
    const routine = mixed()
    const woken = tick(routine, 0, 10 * 60_000)

    expect(woken).toEqual({ kind: 'move', cursor: { runIndex: 1, elapsedInRunMs: 0 } })
    expect(tick(routine, 1, 0)).toMatchObject({ kind: 'stay' })
  })

  it('holds a self-paced step open forever, ticking once a second', () => {
    const routine = mixed()
    expect(tick(routine, 1, 0)).toEqual({
      kind: 'stay',
      cursor: { runIndex: 1, elapsedInRunMs: 0 },
      nextChangeInMs: 1000,
    })
    expect(tick(routine, 1, 2_400)).toMatchObject({ kind: 'stay', nextChangeInMs: 600 })
    // An hour later it is still waiting, and still not complete.
    expect(tick(routine, 1, 60 * 60_000)).toMatchObject({ kind: 'stay' })
  })

  it('completes when the final run runs out', () => {
    const routine = mixed()
    expect(tick(routine, 2, 75_000)).toEqual({
      kind: 'complete',
      cursor: { runIndex: 3, elapsedInRunMs: 0 },
    })
    expect(tick(routine, 3, 0)).toMatchObject({ kind: 'complete' })
  })

  it('completes a fully timed routine exactly at its total', () => {
    expect(tick(timed(), 0, 30_000)).toMatchObject({ kind: 'complete' })
    expect(tick(timed(), 0, 29_999)).toMatchObject({ kind: 'stay' })
  })

  it('walks a mixed routine end to end, one tick per display change', () => {
    const routine = mixed()
    let runIndex = 0
    let elapsed = 0
    const moves: string[] = []

    for (let guard = 0; guard < 400; guard++) {
      const next = tick(routine, runIndex, elapsed)
      if (next.kind === 'complete') break
      if (next.kind === 'move') {
        runIndex = next.cursor.runIndex
        elapsed = 0
        moves.push(`run ${runIndex}`)
        continue
      }
      // A self-paced step never ends on its own: the user taps past it.
      if (routine.runs[runIndex]!.selfPaced) {
        runIndex += 1
        elapsed = 0
        moves.push(`tapped past run ${runIndex - 1}`)
        continue
      }
      elapsed += next.nextChangeInMs
    }

    // Warm-up expires into the gate; the gate is tapped past; the closing run
    // expires into completion.
    expect(moves).toEqual(['run 1', 'tapped past run 1'])
  })
})
