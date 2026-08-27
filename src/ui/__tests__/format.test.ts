/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import {
  clock,
  clockWidth,
  duration,
  effortLabel,
  estimated,
  estimatedValue,
  effortSuffix,
  FIT_ADVANCE,
  FIT_AVAILABLE,
  fitBlockCqi,
  fitCqi,
  isoDate,
  listLines,
  nameLines,
  pathLabel,
  stopwatch,
  fitList,
  fitPanel,
  FIT_HEIGHT_BUDGET,
  LIST_GAP,
  nameWithEffort,
  nameWithLoad,
} from '../format'
import { defaultRoutineName } from '../PasteDialog'

describe('clock', () => {
  it('shows bare seconds under a minute: faster to read at three metres', () => {
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

describe('estimated', () => {
  it('keeps the seconds on a routine whose length is known', () => {
    expect(estimated(270_000, false)).toBe('4:30')
    expect(estimatedValue(270_000, false)).toBe('4:30')
  })

  it('drops to whole minutes and hedges where any of it was guessed', () => {
    // "about 35:20" claims a precision the estimate has not got while saying in
    // the same breath that it is a guess.
    expect(estimated(2_120_000, true)).toBe('about 35 min')
    expect(estimatedValue(2_120_000, true)).toBe('35 min')
  })

  it('never rounds a short routine down to nothing', () => {
    expect(estimated(20_000, true)).toBe('about 1 min')
  })
})

describe('stopwatch', () => {
  it('stays m:ss from zero, unlike duration', () => {
    // A clock in the corner must not change shape as the first minute passes.
    expect(stopwatch(0)).toBe('0:00')
    expect(stopwatch(9_000)).toBe('0:09')
    expect(stopwatch(59_000)).toBe('0:59')
    expect(stopwatch(60_000)).toBe('1:00')
    expect(stopwatch(3_930_000)).toBe('65:30')
  })

  it('floors, so it never reports a second that has not finished', () => {
    expect(stopwatch(59_900)).toBe('0:59')
    expect(stopwatch(119_999)).toBe('1:59')
  })

  it('never goes negative, whatever a clock hands it', () => {
    expect(stopwatch(-5_000)).toBe('0:00')
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

  it('hides a repeat that only runs once: it carries no information', () => {
    expect(pathLabel([{ label: 'Circuit', iteration: 1, of: 1 }])).toBe('')
  })

  it('falls back to "Set" when a repeat has no label', () => {
    expect(pathLabel([{ iteration: 3, of: 8 }])).toBe('Set 3 of 8')
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

describe('fitPanel', () => {
  it('agrees with a line per word for a short name, which is what one needs', () => {
    /*
     * The case the old word-count model was right about, and the reason it
     * survived so long. `fitCqi` sizes off the longest word, and at that size a
     * two or three word name really does take a line each.
     */
    expect(fitPanel('Rest').lines).toBe(1)
    expect(fitPanel('Get ready').lines).toBe(2)
    expect(fitPanel('Seated Abdominal Crunch').lines).toBe(3)
  })

  it('leaves a short name at the width bound, unchanged by the height one', () => {
    for (const name of ['Rest', 'Get ready', 'Seated Abdominal Crunch']) {
      expect(fitPanel(name).fit).toBeCloseTo(fitCqi(name), 10)
    }
  })

  it('fills the panel with a paragraph instead of bottoming out on the floor', () => {
    /*
     * The AMRAP round, which is what this function exists for. A word per line
     * asked for 30 lines, which drove the size under the CSS 1rem floor and then
     * used three of them: the panel was four fifths empty.
     */
    const round =
      '10 × Squat + Shoulder Press · 8 × Bulgarian split squat – 4 each leg · ' +
      '10 × Plank Shoulder Taps – 5 each side · 6 × Burpees · ' +
      '12 × Russian Twists – 6 each side · 10 Mountain Climbers'
    const { fit, lines } = fitPanel(round)

    // Words per line, not a line per word.
    expect(lines).toBeLessThan(wordsIn(round) / 2)
    // Comfortably off the 1rem floor: at 1cqi to a percent, this is several.
    expect(fit).toBeGreaterThan(5)
  })

  it('uses the height budget without overrunning it, at every length', () => {
    // The invariant the square root exists to hold: lines × size fits the box.
    for (const text of ['Go', 'Rest', 'Seated Abdominal Crunch', 'a '.repeat(90), 'x'.repeat(200)]) {
      const { fit, lines } = fitPanel(text)
      expect(lines * fit).toBeLessThanOrEqual(FIT_HEIGHT_BUDGET + fit)
    }
  })

  it('never returns a zero line count, which would blow the font size up', () => {
    // `lines` divides the height budget in CSS.
    for (const text of ['', '   ']) {
      expect(fitPanel(text).lines).toBeGreaterThanOrEqual(1)
      expect(Number.isFinite(fitPanel(text).fit)).toBe(true)
    }
  })

  it('still refuses to set a long word wider than the frame', () => {
    // The width bound is not traded away for height: an unbreakable word wins.
    const word = 'Supercalifragilisticexpialidocious'
    expect(fitPanel(word).fit).toBeLessThanOrEqual(fitCqi(word))
  })
})

const wordsIn = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

describe('fitList', () => {
  const ROUND = [
    '10 × Squat + Shoulder Press',
    '8 × Bulgarian split squat – 4 each leg',
    '10 × Plank Shoulder Taps – 5 each side',
    '6 × Burpees',
    '12 × Russian Twists – 6 each side',
    '10 Mountain Climbers',
  ]

  it('gives every item a line of its own, at least', () => {
    // The whole reason it exists: a bullet starts a line, however short it is.
    expect(fitList(ROUND).lines).toBeGreaterThanOrEqual(ROUND.length)
    expect(fitList(['a', 'b', 'c']).lines).toBeGreaterThanOrEqual(3)
  })

  it('stays inside the height budget, gaps between the bullets included', () => {
    for (const items of [ROUND, ['a'], ['x'.repeat(80), 'y'.repeat(80)], []]) {
      const { fit, lines } = fitList(items)
      expect(lines * fit).toBeLessThanOrEqual(FIT_HEIGHT_BUDGET + fit)
    }
  })

  it('counts the gaps, or five of them eat the slack meant for line spacing', () => {
    // Same items, one list: the gaps are the only difference, so a list of many
    // short items must be set no larger than the height budget alone allows.
    const many = Array.from({ length: 8 }, () => 'Burpees')
    const { fit, lines } = fitList(many)
    expect(lines).toBeGreaterThanOrEqual(many.length + Math.floor(7 * LIST_GAP))
    expect(fit).toBeLessThanOrEqual(FIT_HEIGHT_BUDGET / many.length)
  })

  it('never sets a long word wider than the frame', () => {
    const items = ['Supercalifragilisticexpialidocious', 'Go']
    expect(fitList(items).fit).toBeLessThanOrEqual(fitCqi(items.join(' ')))
  })

  it('survives an empty list without dividing by zero', () => {
    const { fit, lines } = fitList([])
    expect(lines).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(fit)).toBe(true)
  })

  it('fills more of the panel than running the round together would', () => {
    // The bullets cost height, so they are set smaller than one blob of text
    // would be, but both must be well clear of the 1rem floor.
    expect(fitList(ROUND).fit).toBeGreaterThan(4)
  })
})

describe('nameWithLoad', () => {
  it('puts the load after the name, as the name used to carry it', () => {
    expect(nameWithLoad({ name: 'Leg Press', load: '65kg' })).toBe('Leg Press 65kg')
  })

  it('leaves a step with no load alone', () => {
    expect(nameWithLoad({ name: 'Cycling' })).toBe('Cycling')
  })

  it('ignores a load that is only whitespace, which is what an emptied field holds', () => {
    expect(nameWithLoad({ name: 'Cycling', load: '   ' })).toBe('Cycling')
  })
})

describe('nameWithEffort', () => {
  it('puts the count in front, which the countdown has no column for', () => {
    expect(nameWithEffort({ name: 'Bicep Curls', reps: { count: 12 } })).toBe('12 × Bicep Curls')
  })

  it('leaves a step with no count alone', () => {
    expect(nameWithEffort({ name: 'Wall Sit', durationMs: 30_000 })).toBe('Wall Sit')
  })

  it('adds the per-side qualifier where the name does not carry it', () => {
    // The parser strips a BRACKETED "(each side)", so the name has lost it.
    expect(nameWithEffort({ name: 'Dead Bugs', reps: { count: 10, perSide: true } })).toBe(
      '10 × Dead Bugs each side',
    )
  })

  it('does not say per-side twice', () => {
    // A dashed "– each side" stays in the name: it is the only record of which
    // limb, since `perSide` is a boolean and cannot tell a leg from an arm.
    expect(
      nameWithEffort({ name: 'Plank Shoulder Taps – each side', reps: { count: 10, perSide: true } }),
    ).toBe('10 × Plank Shoulder Taps – each side')
  })

  it('does not say the count twice either', () => {
    // "5 × Bulgarian split squat – 5 each side" states it at both ends. The name
    // has already answered the question, so the prefix stands down.
    expect(
      nameWithEffort({ name: 'Bulgarian split squat – 5 each side', reps: { count: 5, perSide: true } }),
    ).toBe('Bulgarian split squat – 5 each side')
  })

  it('carries the load through, after the count and the per-side words', () => {
    expect(
      nameWithEffort({ name: 'Leg Press', load: '65kg', reps: { count: 12 } }),
    ).toBe('12 × Leg Press 65kg')
    expect(
      nameWithEffort({ name: 'Kickback', load: '20kg', reps: { count: 10, perSide: true } }),
    ).toBe('10 × Kickback each side 20kg')
  })

  it('shows a load on a timed step, which has no count at all', () => {
    expect(nameWithEffort({ name: 'Plank', load: '10kg', durationMs: 30_000 })).toBe('Plank 10kg')
  })

  it('still counts a step whose name merely contains the digits', () => {
    expect(nameWithEffort({ name: 'Squat to 90', reps: { count: 90 } })).toBe('90 × Squat to 90')
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
   * asserting against the assumed advance would prove nothing. The real
   * question is whether the text still fits when the font is wider than
   * assumed, which is exactly how the portrait-iPad truncation happened.
   */
  const PESSIMISTIC = 0.78

  it.each(WORDS)('fits “%s” even with a wider font than assumed', (text) => {
    const longest = Math.max(...text.split(' ').map((word) => word.length))
    const worstCase = longest * PESSIMISTIC * fitCqi(text)
    expect(worstCase).toBeLessThanOrEqual(FIT_AVAILABLE)
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

describe('fitBlockCqi: text in a wide box', () => {
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

describe('listLines: sizing a group to fill the sheet', () => {
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

describe('effortLabel and effortSuffix', () => {
  it('keeps the count and its qualifier apart, so counts can share a column', () => {
    const step = { reps: { count: 5, perSide: true } }
    expect(effortLabel(step)).toBe('5 ×')
    expect(effortSuffix(step)).toBe('each side')
  })

  it('has no suffix for a plain count or a duration', () => {
    expect(effortLabel({ reps: { count: 12 } })).toBe('12 ×')
    expect(effortSuffix({ reps: { count: 12 } })).toBe('')
    expect(effortLabel({ durationMs: 45_000 })).toBe('45s')
    expect(effortSuffix({ durationMs: 45_000 })).toBe('')
  })

  it('prefers reps over a duration, and is empty when a step has neither', () => {
    expect(effortLabel({ durationMs: 30_000, reps: { count: 8 } })).toBe('8 ×')
    expect(effortLabel({})).toBe('')
  })
})
