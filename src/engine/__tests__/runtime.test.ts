/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { compile } from '../compile'
import { elapsedAtStepStart, position, skipBack, skipForward } from '../runtime'
import { circuit, seg, tabata, workout } from './fixtures'

const TABATA = compile(tabata())

describe('position', () => {
  it('sits at the top of the first step at 0ms', () => {
    const at = position(TABATA, 0)
    expect(at).toMatchObject({
      index: 0,
      elapsedInEntryMs: 0,
      remainingMs: 10_000,
      totalElapsedMs: 0,
      totalRemainingMs: TABATA.totalMs,
      isComplete: false,
    })
    expect(at.entry!.name).toBe('Get ready')
    expect(at.nextEntry!.name).toBe('Work')
  })

  it('owns [startMs, endMs): a boundary belongs to the step that starts there', () => {
    // Prepare ends at 10_000, so 9_999 is still prepare and 10_000 is work.
    expect(position(TABATA, 9_999).entry!.name).toBe('Get ready')
    expect(position(TABATA, 9_999).remainingMs).toBe(1)
    expect(position(TABATA, 10_000).entry!.name).toBe('Work')
    expect(position(TABATA, 10_000).remainingMs).toBe(20_000)
  })

  it('is correct at every boundary in the timeline', () => {
    for (const entry of TABATA.entries) {
      expect(position(TABATA, entry.startMs).index).toBe(entry.index)
      expect(position(TABATA, entry.startMs).remainingMs).toBe(entry.durationMs)
      expect(position(TABATA, entry.endMs - 1).index).toBe(entry.index)

      const atEnd = position(TABATA, entry.endMs)
      if (entry.index === TABATA.entries.length - 1) {
        expect(atEnd.isComplete).toBe(true)
      } else {
        expect(atEnd.index).toBe(entry.index + 1)
      }
    }
  })

  it('keeps elapsed and remaining consistent throughout', () => {
    for (let t = 0; t < TABATA.totalMs; t += 137) {
      const at = position(TABATA, t)
      expect(at.totalElapsedMs + at.totalRemainingMs).toBe(TABATA.totalMs)
      expect(at.elapsedInEntryMs + at.remainingMs).toBe(at.entry!.durationMs)
      expect(at.elapsedInEntryMs).toBeGreaterThanOrEqual(0)
      expect(at.remainingMs).toBeGreaterThan(0)
    }
  })

  it('reports completion at and beyond the total', () => {
    for (const t of [TABATA.totalMs, TABATA.totalMs + 1, TABATA.totalMs * 10]) {
      expect(position(TABATA, t)).toMatchObject({
        entry: null,
        nextEntry: null,
        index: TABATA.entries.length,
        remainingMs: 0,
        totalElapsedMs: TABATA.totalMs,
        totalRemainingMs: 0,
        isComplete: true,
      })
    }
  })

  it('clamps negative and non-finite input to the start', () => {
    // All non-finite input is invalid, so it gets one rule rather than treating
    // +Infinity as "past the end". A real clock never produces these.
    for (const t of [
      -1,
      -10_000,
      Number.NaN,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(position(TABATA, t)).toMatchObject({
        index: 0,
        elapsedInEntryMs: 0,
        isComplete: false,
      })
    }
  })

  it('exposes nextEntry for image preloading, and null on the last step', () => {
    const lastIndex = TABATA.entries.length - 1
    const onLast = position(TABATA, TABATA.entries[lastIndex]!.startMs)
    expect(onLast.entry!.index).toBe(lastIndex)
    expect(onLast.nextEntry).toBeNull()

    const onFirst = position(TABATA, 0)
    expect(onFirst.nextEntry!.index).toBe(1)
  })

  it('treats an empty timeline as immediately complete', () => {
    const empty = compile(workout('Empty', []))
    expect(position(empty, 0)).toMatchObject({ entry: null, isComplete: true, totalRemainingMs: 0 })
  })

  it('carries media onto the position so the runner reads it directly', () => {
    const timeline = compile(circuit())
    expect(position(timeline, 0).entry!.media).toMatchObject({ source: 'remote' })
  })
})

describe('seek helpers', () => {
  it('clamps elapsedAtStepStart into range', () => {
    expect(elapsedAtStepStart(TABATA, -5)).toBe(0)
    expect(elapsedAtStepStart(TABATA, 0)).toBe(0)
    expect(elapsedAtStepStart(TABATA, 2)).toBe(TABATA.entries[2]!.startMs)
    expect(elapsedAtStepStart(TABATA, 999)).toBe(TABATA.totalMs)
  })

  it('skips forward to the top of the next step', () => {
    expect(skipForward(TABATA, 0)).toBe(10_000)
    expect(skipForward(TABATA, 5_000)).toBe(10_000)
    expect(skipForward(TABATA, 10_000)).toBe(30_000)
  })

  it('skips forward off the end into completion', () => {
    const lastStart = TABATA.entries[TABATA.entries.length - 1]!.startMs
    expect(skipForward(TABATA, lastStart)).toBe(TABATA.totalMs)
    expect(skipForward(TABATA, TABATA.totalMs)).toBe(TABATA.totalMs)
  })

  it('restarts the current step when well into it, else goes back one', () => {
    // 5s into the 10s prepare -> restart prepare (already index 0, so 0 either way)
    expect(skipBack(TABATA, 5_000)).toBe(0)
    // 5s into the first work step -> restart it
    expect(skipBack(TABATA, 15_000)).toBe(10_000)
    // 0.5s into the first work step -> back to prepare
    expect(skipBack(TABATA, 10_500)).toBe(0)
  })

  it('lands on the last step when skipping back from completion', () => {
    const lastStart = TABATA.entries[TABATA.entries.length - 1]!.startMs
    expect(skipBack(TABATA, TABATA.totalMs)).toBe(lastStart)
  })

  it('honours a custom restart threshold', () => {
    expect(skipBack(TABATA, 10_500, 100)).toBe(10_000)
    expect(skipBack(TABATA, 10_500, 5_000)).toBe(0)
  })

  it('handles a single-step timeline', () => {
    const one = compile(workout('Solo', [seg('Only', 30)]))
    expect(skipForward(one, 0)).toBe(30_000)
    expect(skipBack(one, 20_000)).toBe(0)
  })
})
