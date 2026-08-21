import { describe, expect, it } from 'vitest'
import {
  clock,
  clockWidth,
  duration,
  FIT_ADVANCE,
  FIT_AVAILABLE,
  fitBlockCqi,
  fitCqi,
  fitWidthUsed,
  isoDate,
  listLines,
  nameLines,
  pathLabel,
  wordCount,
} from '../format'
import { defaultRoutineName } from '../PasteDialog'

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
        { label: 'Reps', iteration: 1, of: 8 },
      ]),
    ).toBe('Set 2 of 3 · Reps 1 of 8')
  })

  it('hides a repeat that only runs once — it carries no information', () => {
    expect(pathLabel([{ label: 'Circuit', iteration: 1, of: 1 }])).toBe('')
  })

  it('falls back to "Reps" when a repeat has no label', () => {
    expect(pathLabel([{ iteration: 3, of: 8 }])).toBe('Reps 3 of 8')
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

describe('wordCount', () => {
  it('counts the words a fallback name will wrap onto', () => {
    expect(wordCount('Rest')).toBe(1)
    expect(wordCount('Get ready')).toBe(2)
    expect(wordCount('Seated Abdominal Crunch')).toBe(3)
  })

  it('never returns zero, so it is safe as a divisor', () => {
    // It divides the height budget in CSS — a zero would blow the font size up.
    expect(wordCount('')).toBe(1)
    expect(wordCount('   ')).toBe(1)
  })

  it('collapses runs of whitespace', () => {
    expect(wordCount('  Get   ready  ')).toBe(2)
  })
})

describe('fitCqi always fits its container', () => {
  // The invariant the portrait-iPad truncation broke: whatever the text, the
  // longest word must fit inside the width budget, expressed as a share of the
  // container so it holds at any size.
  const WORDS = [
    'Rest',
    'Go',
    'Get ready',
    'Cycling',
    'Change Sides',
    'Low Pulley Squat',
    'Seated Abdominal Crunch',
    'Cable Converging Shoulder Press',
    'Extraordinarilylongexercisename',
  ]

  /**
   * A pessimistic advance. The sizing maths is exact by construction, so
   * asserting against the assumed advance would prove nothing — the real
   * question is whether the text still fits when the font is wider than
   * assumed, which is exactly how the portrait-iPad truncation happened.
   */
  const PESSIMISTIC = 0.78

  it.each(WORDS)('fits “%s” even with a wider font than assumed', (text) => {
    const longest = Math.max(...text.split(' ').map((word) => word.length))
    const worstCase = longest * PESSIMISTIC * fitCqi(text)
    expect(worstCase).toBeLessThanOrEqual(FIT_AVAILABLE)
  })

  it('claims less than the space available, so the slack is real', () => {
    for (const text of WORDS) {
      expect(fitWidthUsed(text)).toBeLessThan(FIT_AVAILABLE)
    }
  })

  it('is bounded by the cap for very short words, still with headroom', () => {
    expect(fitCqi('Go')).toBe(40)
    expect(2 * PESSIMISTIC * fitCqi('Go')).toBeLessThanOrEqual(FIT_AVAILABLE)
  })

  it('still only ever steps down as words get longer', () => {
    const sizes = WORDS.map((w) => fitCqi(w))
    const longest = WORDS.map((w) => Math.max(...w.split(' ').map((p) => p.length)))
    for (let i = 0; i < WORDS.length; i++) {
      for (let j = 0; j < WORDS.length; j++) {
        if (longest[i]! < longest[j]!) expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[j]!)
      }
    }
  })
})

describe('fitBlockCqi — text in a wide box', () => {
  it('leaves a short heading at full size', () => {
    expect(fitBlockCqi('Rest', 3, 11)).toBe(11)
  })

  it('shrinks with total length, not with word count', () => {
    // Five short words pack onto a line or two, so this stays large; the
    // one-word-per-line assumption behind fitCqi would set it absurdly small.
    expect(fitBlockCqi('Side-to-Side Squats with a Reach', 3, 11)).toBeGreaterThan(9)
  })

  it('sizes a long name down far enough to fit its line budget', () => {
    const text =
      'Side-to-Side Squats with a Reach (start standing, step out to one side, sink your hips into a squat)'
    const size = fitBlockCqi(text, 3, 11)
    // Three lines at this size must hold every character.
    expect(size * FIT_ADVANCE * text.length).toBeLessThanOrEqual(FIT_AVAILABLE * 3)
  })

  it('never lets an unbreakable word overflow, however few lines are needed', () => {
    const size = fitBlockCqi('Supercalifragilistic', 4, 11)
    expect(size * FIT_ADVANCE * 'Supercalifragilistic'.length).toBeLessThanOrEqual(FIT_AVAILABLE)
  })

  it('handles empty and whitespace input without dividing by zero', () => {
    expect(fitBlockCqi('', 2, 11)).toBeGreaterThan(0)
    expect(Number.isFinite(fitBlockCqi('   ', 2, 11))).toBe(true)
  })
})

describe('listLines — sizing a group to fill the sheet', () => {
  const rows = [
    { name: 'Bicep Curls' },
    { name: 'Arnold Press' },
    { name: 'Upright Rows' },
    { name: 'Rest' },
  ]

  it('counts one line per short row', () => {
    expect(listLines(rows)).toBe(4)
  })

  it('credits a long name the lines it will wrap to', () => {
    expect(listLines([{ name: 'RB (resistance band) Lateral Walks – 5 each direction' }])).toBe(3)
  })

  it('charges less than a full line for a sub-line', () => {
    const withAlt = listLines([{ name: 'Squat Jumps', alternative: 'squat + calf raise' }])
    expect(withAlt).toBeGreaterThan(1)
    expect(withAlt).toBeLessThan(2)
  })

  it('charges for a note only on the rows showing one', () => {
    const current = { name: 'Toy Soldier Kicks', note: 'straight-leg kicks with opposite hand' }
    const others = [{ name: 'Butt Kicks', note: 'a note nobody is shown' }]
    expect(listLines([current, ...others], [current])).toBeGreaterThan(
      listLines([current, ...others]),
    )
  })

  it('charges for every row of a gate that clears at once, such as a ladder rung', () => {
    const rung = [
      { name: 'Goblet Squats', note: 'chest up, elbows inside the knees' },
      { name: 'RB Lateral Walks', note: 'stay low throughout' },
    ]
    expect(listLines(rung, rung)).toBeGreaterThan(listLines(rung, [rung[0]!]))
  })

  it('never returns zero, so the divisor is always safe', () => {
    expect(listLines([])).toBe(1)
    expect(listLines([{ name: '' }])).toBe(1)
  })
})

describe('isoDate', () => {
  it('formats the LOCAL date, not the UTC one', () => {
    // 01:00 on the 22nd in Johannesburg is still the 21st in UTC, and a routine
    // pasted then must not be dated the day before.
    const afterMidnight = new Date(2026, 7, 22, 1, 0, 0)
    expect(isoDate(afterMidnight)).toBe('2026-08-22')
  })

  it('pads months and days', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(isoDate(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('defaultRoutineName', () => {
  it('dates the routine, since they arrive weekly on one template', () => {
    expect(defaultRoutineName(new Date(2026, 6, 20))).toBe('Strength Training - 2026-07-20')
  })
})

describe('nameLines', () => {
  it('is one line for a short name', () => {
    expect(nameLines('Rest')).toBe(1)
    expect(nameLines('Hammer Curls')).toBe(1)
  })

  it('is two for the name that pushed the step counter off screen', () => {
    expect(nameLines('Inchworm + Shoulder Tap')).toBe(2)
  })

  it('caps at three, however long the name is', () => {
    expect(nameLines('RB (resistance band) Lateral Walks – 5 each direction')).toBe(3)
  })

  it('never returns zero, so the countdown cannot claim a negative height', () => {
    expect(nameLines('')).toBe(1)
    expect(nameLines('   ')).toBe(1)
  })
})
