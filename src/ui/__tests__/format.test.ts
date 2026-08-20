import { describe, expect, it } from 'vitest'
import { clock, clockWidth, duration, pathLabel } from '../format'

describe('clock', () => {
  it('shows bare seconds under a minute — faster to read at three metres', () => {
    expect(clock(0)).toBe('0')
    expect(clock(9)).toBe('9')
    expect(clock(59)).toBe('59')
  })

  it('switches to m:ss at a minute and pads the seconds', () => {
    expect(clock(60)).toBe('1:00')
    expect(clock(75)).toBe('1:15')
    expect(clock(605)).toBe('10:05')
  })

  it('never renders a negative countdown', () => {
    expect(clock(-3)).toBe('0')
  })
})

describe('clockWidth', () => {
  it('sizes one and two digits so the countdown does not jump', () => {
    expect(clockWidth('8')).toBe(1)
    expect(clockWidth('17')).toBe(2)
  })

  it('counts a colon as half a digit', () => {
    expect(clockWidth('4:30')).toBe(3.5)
    expect(clockWidth('10:05')).toBe(4.5)
  })
})

describe('duration', () => {
  it('uses seconds below a minute and m:ss above', () => {
    expect(duration(20_000)).toBe('20s')
    expect(duration(59_400)).toBe('59s')
    expect(duration(270_000)).toBe('4:30')
  })
})

describe('pathLabel', () => {
  it('renders the repeat chain outermost first', () => {
    expect(
      pathLabel([
        { label: 'Set', iteration: 2, of: 3 },
        { label: 'Round', iteration: 1, of: 8 },
      ]),
    ).toBe('Set 2 of 3 · Round 1 of 8')
  })

  it('hides a repeat that only runs once — it carries no information', () => {
    expect(pathLabel([{ label: 'Circuit', iteration: 1, of: 1 }])).toBe('')
  })

  it('falls back to "Round" when a repeat has no label', () => {
    expect(pathLabel([{ iteration: 3, of: 8 }])).toBe('Round 3 of 8')
  })

  it('returns empty for a step outside any repeat', () => {
    expect(pathLabel([])).toBe('')
  })
})
