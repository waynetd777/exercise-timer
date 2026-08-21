import { describe, expect, it } from 'vitest'
import general from './emails/2026-07-20-general.txt?raw'
import { parseRoutine } from '../pasteFormat'
import { advance, compile, listMode, locate, SCHEMA_VERSION, START } from '../../engine'
import type { Cursor, Routine } from '../../engine'

function routineFrom(text: string): Routine {
  return compile({
    id: 'test',
    name: 'Test',
    blocks: parseRoutine(text).blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: 0,
    updatedAt: 0,
  })
}

/** Every gate and timed run of a section, as the runner would meet them. */
function walk(routine: Routine, section: string): string[] {
  const out: string[] = []
  let cursor: Cursor = START
  for (let guard = 0; guard < 500; guard++) {
    const at = locate(routine, cursor)
    if (at.isComplete) break
    const run = routine.runs[cursor.runIndex]!
    if (at.entry!.path.some((step) => step.label?.includes(section))) {
      const names = run.entries.map((entry) => entry.name).join(' + ')
      const screen = listMode(routine, at.entry!) ? 'list' : 'countdown'
      out.push(`${run.selfPaced ? 'tap' : 'timed'} · ${screen} · ${names}`)
    }
    cursor = advance(routine, cursor)
  }
  return out
}

describe('the Final Burnout, end to end', () => {
  it('is one tap, then a countdown for the hold, then one more tap', () => {
    expect(walk(routineFrom(general), 'Final Burnout')).toEqual([
      'tap · list · Sumo Squat Pulses + Alternating Curtsy Lunges',
      'timed · countdown · Wall Sit',
      'tap · countdown · Squat Pulses',
    ])
  })
})

describe('a round, end to end', () => {
  it('is one tap per round with the rest counting itself down between', () => {
    expect(walk(routineFrom(general), 'Arms & Shoulders').slice(0, 4)).toEqual([
      'tap · list · Hammer Curls + Shoulder Press + Lateral Raises + Bent-over Rows + Front Punches',
      'timed · countdown · Rest',
      'tap · list · Hammer Curls + Shoulder Press + Lateral Raises + Bent-over Rows + Front Punches',
      'timed · countdown · Rest',
    ])
  })
})

describe('the warm-up, end to end', () => {
  it('stays a plain countdown throughout, with no taps', () => {
    const screens = walk(routineFrom(general), 'Warm-up')
    expect(screens).toHaveLength(10)
    expect(screens.every((line) => line.startsWith('timed · countdown'))).toBe(true)
  })
})
