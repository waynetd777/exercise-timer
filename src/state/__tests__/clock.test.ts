import { describe, expect, it } from 'vitest'
import { elapsed, IDLE_CLOCK, paused, resumed, seeked, started } from '../clock'

describe('clock', () => {
  it('reads zero before starting', () => {
    expect(elapsed(IDLE_CLOCK, 5_000)).toBe(0)
  })

  it('advances with the monotonic clock while running', () => {
    const clock = started(1_000)
    expect(elapsed(clock, 1_000)).toBe(0)
    expect(elapsed(clock, 4_500)).toBe(3_500)
  })

  it('never reports negative elapsed if the clock reads backwards', () => {
    expect(elapsed(started(1_000), 500)).toBe(0)
  })

  it('freezes while paused, however long you wait', () => {
    const clock = paused(started(1_000), 6_000)
    expect(elapsed(clock, 6_000)).toBe(5_000)
    expect(elapsed(clock, 60_000)).toBe(5_000)
    expect(elapsed(clock, 600_000)).toBe(5_000)
  })

  it('continues from where it froze on resume', () => {
    let clock = started(1_000)
    clock = paused(clock, 6_000) // 5s in
    clock = resumed(clock, 20_000) // 14s spent paused
    expect(elapsed(clock, 20_000)).toBe(5_000)
    expect(elapsed(clock, 23_000)).toBe(8_000)
  })

  it('does not drift across many pause/resume cycles', () => {
    let clock = started(0)
    let now = 0
    for (let i = 0; i < 50; i++) {
      now += 1_000 // 1s running
      clock = paused(clock, now)
      now += 7_000 // 7s paused
      clock = resumed(clock, now)
    }
    expect(elapsed(clock, now)).toBe(50_000)
  })

  it('ignores a redundant pause or resume', () => {
    const running = started(1_000)
    expect(resumed(running, 5_000)).toBe(running)

    const stopped = paused(running, 3_000)
    expect(paused(stopped, 9_000)).toBe(stopped)
    expect(elapsed(paused(stopped, 9_000), 30_000)).toBe(2_000)
  })

  it('lands exactly on a seek target and keeps running', () => {
    const clock = seeked(10_000, 42_000, false)
    expect(elapsed(clock, 10_000)).toBe(42_000)
    expect(elapsed(clock, 12_500)).toBe(44_500)
  })

  it('stays frozen when seeking while paused', () => {
    const clock = seeked(10_000, 42_000, true)
    expect(elapsed(clock, 10_000)).toBe(42_000)
    expect(elapsed(clock, 999_000)).toBe(42_000)
  })

  it('resumes correctly after a frozen seek — the bug this file exists for', () => {
    // Seek while paused, sit there for a minute, then resume: elapsed must pick
    // up from the seek target, not jump by the time spent sitting.
    let clock = seeked(10_000, 42_000, true)
    clock = resumed(clock, 70_000)
    expect(elapsed(clock, 70_000)).toBe(42_000)
    expect(elapsed(clock, 71_000)).toBe(43_000)
  })

  it('survives a long background gap without drifting', () => {
    // Ten minutes with no callbacks at all: elapsed is derived, so returning
    // simply tells the truth.
    const clock = started(0)
    expect(elapsed(clock, 600_000)).toBe(600_000)
  })
})
