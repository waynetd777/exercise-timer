import { describe, expect, it } from 'vitest'
import { clock, clockWidth, duration, fitCqi, pathLabel } from '../format'

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
  it('reports one and two digits identically, so the countdown cannot jump', () => {
    // Floored at 2. Returning 1 here let the width term stop binding, the
    // height term take over, and "9" render up to twice the size of "10".
    expect(clockWidth('8')).toBe(2)
    expect(clockWidth('17')).toBe(2)
  })

  it('counts a colon as half a digit', () => {
    expect(clockWidth('4:30')).toBe(3.5)
    expect(clockWidth('10:05')).toBe(4.5)
  })

  it('only ever steps the size down, never up', () => {
    const widths = ['9', '10', '1:00', '10:05'].map(clockWidth)
    expect(widths).toEqual([...widths].sort((a, b) => a - b))
    expect(Math.min(...widths)).toBe(2)
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

describe('fitCqi', () => {
  it('sizes off the longest word, since that is what must fit a line', () => {
    // "REST" fits a line easily, so it is set much larger than "LOW PULLEY
    // SQUAT", whose longest word is "PULLEY".
    expect(fitCqi('Rest')).toBeGreaterThan(fitCqi('Low Pulley Squat'))
    expect(fitCqi('Get ready')).toBeGreaterThan(fitCqi('Seated Abdominal Crunch'))
  })

  it('ignores total length when the words are short', () => {
    expect(fitCqi('a a a a a a')).toBe(fitCqi('a'))
  })

  it('caps short words so one letter does not fill the panel', () => {
    expect(fitCqi('Go')).toBe(40)
    expect(fitCqi('Go', 25)).toBe(25)
  })

  it('shrinks steadily as the longest word grows', () => {
    const sizes = ['Rest', 'Cycling', 'Abdominal', 'Extraordinarily'].map((n) => fitCqi(n))
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })

  it('survives empty input', () => {
    expect(fitCqi('')).toBe(40)
  })
})
