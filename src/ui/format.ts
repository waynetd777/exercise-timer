/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/** Bare seconds under a minute: "17" reads faster than "0:17" at three metres. */
export function clock(seconds: number): string {
  if (seconds < 60) return String(Math.max(0, seconds))
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/** Compact duration for labels and stats: "20s", "4:30". */
export function duration(ms: number): string {
  const total = Math.round(ms / 1000)
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * A stopwatch reading: always `m:ss`, and floored rather than rounded.
 *
 * Not `duration()`, which is for labels. "45s" is the right thing for a label
 * to say and the wrong thing for a clock in the corner, which would then change
 * shape as the first minute passed. Floored because a stopwatch reports time
 * completed: rounding shows 1:00 half a second early.
 */
export function stopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "Reps 3 of 8 · Set 2 of 2" from a timeline entry's repeat path. */
export function pathLabel(path: { label?: string; iteration: number; of: number }[]): string {
  return path
    .filter((step) => step.of > 1)
    .map((step) => `${step.label?.trim() || 'Reps'} ${step.iteration} of ${step.of}`)
    .join(' · ')
}

/**
 * Width of a clock string in ems, for sizing the countdown: a tabular digit
 * advances about 1 unit, a colon about half, with a floor of 2. So the size only
 * ever steps DOWN for longer strings: "8" and "17" match, "4:30" is smaller.
 */
export function clockWidth(text: string): number {
  const units = [...text].reduce((width, char) => width + (char === ':' ? 0.5 : 1), 0)
  /*
   * Floored at 2, which is what the width coefficient is calibrated for. Without
   * it a single digit divides by 1 instead of 2, the width term stops binding,
   * the height term takes over, and "9" renders up to twice the size of "10",
   * jumping mid-countdown and shoving everything below it off the screen.
   */
  return Math.max(2, units)
}

/**
 * Share of the container actually available: 100% less the 4% proportional
 * padding either side.
 */
export const FIT_AVAILABLE = 92

/**
 * Share of the container the text is allowed to claim.
 *
 * Below `FIT_AVAILABLE` on purpose. The maths is exact by construction, since a
 * word sized this way occupies exactly the budget, so ALL the safety has to come
 * from this gap. It is set so the text still fits even if a font advances
 * noticeably wider than the estimate below.
 */
const FIT_BUDGET = 84

/** Assumed advance of a bold uppercase glyph, in ems. */
export const FIT_ADVANCE = 0.72

/**
 * Font size in `cqi` for a headline that should fill its container, given that
 * it wraps between words. Sized off the LONGEST WORD, since that is what has to
 * fit on one line, so "REST" is set far larger than "LOW PULLEY SQUAT" and
 * both fill the frame.
 *
 * The coefficient is the budget divided by the advance. The first version used
 * 161, from assuming a 0.62em advance and the FULL container width, both of them
 * optimistic. On a portrait iPad the panel is only ~250px wide and 24px of fixed
 * padding is a tenth of that, so every fallback name overflowed and was clipped.
 * Hence a measured-generously advance, and padding counted rather than ignored.
 *
 * Same idea as `clockWidth`, applied to words instead of digits.
 */
export function fitCqi(text: string, max = 40): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => word.length))
  return Math.min(max, FIT_BUDGET / FIT_ADVANCE / longest)
}

/**
 * Font size in `cqi` for text in a WIDE box, where words pack several to a line
 * rather than each taking its own.
 *
 * Two bounds, whichever is smaller. A word cannot break, so the longest one caps
 * the size exactly as in `fitCqi`. And at size `s` a line holds
 * `FIT_BUDGET / (s * FIT_ADVANCE)` characters, so fitting `total` characters
 * into `maxLines` lines needs `s <= FIT_BUDGET * maxLines / (FIT_ADVANCE * total)`.
 *
 * `fitCqi` is the narrow-box case of this, one word per line, and is right for
 * the media panel. This is right for a heading across a full-width column, where
 * assuming a line per word would set a five-word name absurdly small.
 */
export function fitBlockCqi(text: string, maxLines: number, max: number): number {
  const trimmed = text.trim()
  const longest = Math.max(1, ...trimmed.split(/\s+/).map((word) => word.length))
  const total = Math.max(1, trimmed.length)
  return Math.min(
    max,
    FIT_BUDGET / FIT_ADVANCE / longest,
    (FIT_BUDGET * Math.max(1, maxLines)) / (FIT_ADVANCE * total),
  )
}

/** The width `fitCqi`'s result will occupy, as a share of the container. */
export function fitWidthUsed(text: string, max = 40): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => word.length))
  return longest * FIT_ADVANCE * fitCqi(text, max)
}

/**
 * Share of the container's HEIGHT the media panel's fallback text may claim.
 *
 * Mirrors the `72cqh` in `.panel__empty`, which divides it by the line count to
 * get a font size. That model treats a line box as one em rather than the 1.05
 * it sets, and the slack for that is already in the gap below `FIT_AVAILABLE`.
 */
export const FIT_HEIGHT_BUDGET = 72

/**
 * Size and line count for the media panel's fallback text, which has to fill a
 * box on BOTH axes.
 *
 * Two bounds. The longest word still has to fit one line, which is `fitCqi`. The
 * new one is the height: at size `s` a line holds `FIT_BUDGET / (s * FIT_ADVANCE)`
 * characters, so `total` characters need `total * s * FIT_ADVANCE / FIT_BUDGET`
 * lines and stand `s` high each. Setting that product against the height budget
 * gives a SQUARE ROOT, because shrinking the text cuts the line count as well as
 * the line height.
 *
 * That fixed point is the whole point. The previous version divided the height
 * budget by the WORD COUNT, on the reasoning that `fitCqi` may put every word on
 * its own line. True of a three-word exercise name in a narrow panel, and for
 * those this returns the identical answer. For a thirty-word note it is wildly
 * pessimistic: it asked for thirty lines, bottomed out on the CSS `1rem` floor,
 * and then used three of them, leaving the panel four fifths empty.
 *
 * `lines` is the count at the size returned, rounded up, so `.panel__empty`'s own
 * height term agrees rather than shrinking the text again. It stays as the
 * backstop for a panel far from square, where mixing `cqi` and `cqh` the way this
 * does breaks down; erring there costs space rather than clipping a word.
 */
/**
 * The bullet's hanging indent, in ems. Mirrors `padding-inline-start` on
 * `.panel__round`, and is subtracted from the width budget below because an
 * indent that scales with the type takes a share of the line that grows with it.
 */
export const LIST_INDENT = 1.2

/**
 * The gap between one bullet and the next, in ems. Mirrors `li + li` on
 * `.panel__round`.
 *
 * Counted as height like any line is, or five gaps of it silently eat the slack
 * the height budget keeps for line spacing.
 */
export const LIST_GAP = 0.35

/**
 * Size and line count for a LIST in the media panel: each item starts a line of
 * its own, and a long one wraps underneath itself.
 *
 * `fitPanel` has a closed form because one blob of text wraps as one blob, so the
 * line count is total length over line width and the fixed point is a square
 * root. A list has no such form. Six items of different lengths each round UP to
 * a whole line of their own, so the count STEPS rather than curves.
 *
 * Bisection instead, on the one thing that is monotonic: taller type needs more
 * lines, so `lines(s) * s` only ever grows with `s`, and the largest size that
 * still fits the height budget can be cornered. The longest word remains a hard
 * ceiling, exactly as everywhere else here, since a word cannot break.
 *
 * The step is why the result can leave height unused: one notch bigger tips an
 * item over to an extra line and overflows. Better a short column than a clipped
 * one.
 */
export function fitList(items: readonly string[], max = 40): { fit: number; lines: number } {
  const lengths = items.map((item) => Math.max(1, item.trim().length))
  const ceiling = fitCqi(items.join(' '), max)

  /* Characters a wrapped line holds at size `s`, the indent already taken out. */
  const linesAt = (size: number): number => {
    const perLine = (FIT_BUDGET - LIST_INDENT * size) / (size * FIT_ADVANCE)
    if (perLine <= 0) return Number.POSITIVE_INFINITY
    return lengths.reduce((total, length) => total + Math.ceil(length / perLine), 0)
  }

  /* Lines plus the gaps between the bullets, both paid for in height. */
  const gaps = Math.max(0, lengths.length - 1) * LIST_GAP
  const heightAt = (size: number): number => linesAt(size) + gaps

  // Zero is always feasible, so `low` is only ever a size that fits.
  let low = 0
  let high = ceiling
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2
    if (heightAt(mid) * mid <= FIT_HEIGHT_BUDGET) low = mid
    else high = mid
  }
  // Rounded up so `.panel__round`'s own height term agrees rather than shrinking
  // the type a second time.
  return { fit: low, lines: Math.max(1, Math.ceil(heightAt(low))) }
}

export function fitPanel(text: string, max = 40): { fit: number; lines: number } {
  const total = Math.max(1, text.trim().length)
  const fill = Math.sqrt((FIT_HEIGHT_BUDGET * FIT_BUDGET) / (FIT_ADVANCE * total))
  const fit = Math.min(fitCqi(text, max), fill)
  return { fit, lines: Math.max(1, Math.ceil((total * fit * FIT_ADVANCE) / FIT_BUDGET)) }
}

type Effort = { durationMs?: number; reps?: { count: number; perSide?: boolean } }

/**
 * What a step asks of you, WITHOUT its per-side qualifier: "12 ×", or "45s".
 *
 * Split from the qualifier so a list can put the numbers in a column of their
 * own. As one string, "5 × each side" is three times the width of "12 ×", and a
 * right-aligned column then lines the digits up with the end of "side" instead
 * of with each other.
 *
 * Reps come first because a rep-based step is the common case in a strength
 * routine, and a step can carry both only by accident of editing.
 */
export function effortLabel(step: Effort): string {
  if (step.reps) return `${step.reps.count} ×`
  if (step.durationMs !== undefined) return duration(step.durationMs)
  return ''
}

/** "each side", or nothing. Its own column beside `effortLabel`. */
export function effortSuffix(step: Effort): string {
  return step.reps?.perSide ? 'each side' : ''
}

/** "each side", "5 each leg": the routine already said it, in the name. */
const NAMES_PER_SIDE = /\b(?:each|per)\s+(?:side|leg|arm|direction)\b/i

/**
 * A step's name with the count it asks for: "12 × Bicep Curls".
 *
 * For the COUNTDOWN layout, which unlike the list has no column of its own for
 * the effort. That was harmless while a counted step was always self-paced and
 * therefore always drawn as a list. An EMOM minute is both timed and counted, so
 * without this it showed a clock and the words "Bicep Curls" and never said
 * twelve.
 *
 * Two things it will not say twice. The per-side qualifier is added only where
 * the name does not already carry it, since the parser leaves a dashed "– 5 each
 * leg" in place: it is the only record of which limb, and `perSide` is a boolean.
 * And where the name already states the count per side, the count is not
 * prefixed either, because "5 × Bulgarian split squat – 5 each side" says it
 * twice and the name has already answered the question.
 */
export function nameWithEffort(step: { name: string } & Effort): string {
  if (!step.reps) return step.name
  const { count } = step.reps
  const statesCount = new RegExp(`\\b${count}\\s+(?:each|per)\\s+\\w+`, 'i').test(step.name)
  const suffix = step.reps.perSide && !NAMES_PER_SIDE.test(step.name) ? ' each side' : ''
  return statesCount ? `${step.name}${suffix}` : `${count} × ${step.name}${suffix}`
}

/**
 * The caption for the group being shown in list mode: "Round 2 of 4",
 * "Set 5 of 9 · 15 reps".
 *
 * A section contributes `of: 1` and so captions as nothing, because its name is
 * already the heading above the list.
 */
export function groupCaption(group: {
  kind: 'section' | 'repeat' | 'ladder'
  label?: string
  iteration: number
  of: number
  rung?: number
} | null): string {
  if (!group || group.of <= 1) return ''
  // `||`, not `??`: deleting the label in the editor stores an empty string,
  // and a caption reading " 2 of 3" is worse than the default word.
  const position = `${group.label?.trim() || 'Reps'} ${group.iteration} of ${group.of}`
  return group.rung === undefined ? position : `${position} · ${group.rung} reps`
}

/**
 * Roughly how many lines a group needs in list mode, so the rows can be sized to
 * FILL the sheet rather than sitting small in the middle of it.
 *
 * With four or five short exercises there is a lot of height going spare, and a
 * row set at a phone's 1rem floor is unreadable from where the phone is propped.
 * Dividing the height budget by an estimated line count is the same move
 * `.panel__empty` makes through `fitPanel`, and errs the same way, generously, so
 * a wrapped row costs space rather than overflowing.
 *
 * `CHARS_PER_LINE` is deliberately pessimistic: at the sizes this produces, a
 * row's name column holds more than that, so a name is more likely to be
 * credited two lines and use one than the reverse.
 */
const CHARS_PER_LINE = 24
/** A sub-line is 0.72em, so it costs less than a full line of the row's type. */
const SUB_LINE = 0.8

export function listLines(
  rows: readonly { name: string; alternative?: string; note?: string }[],
  /** The rows showing their note: the whole current gate, which may be a rung. */
  showNotesFor: readonly { note?: string }[] = [],
): number {
  const lines = (text: string) => Math.max(1, Math.ceil(text.length / CHARS_PER_LINE))
  return Math.max(
    1,
    rows.reduce((total, row) => {
      const note = showNotesFor.includes(row) && row.note ? SUB_LINE * lines(row.note) : 0
      const alternative = row.alternative ? SUB_LINE * lines(row.alternative) : 0
      return total + lines(row.name) + note + alternative
    }, 0),
  )
}

/**
 * `YYYY-MM-DD` in the LOCAL timezone.
 *
 * Not `toISOString().slice(0, 10)`, which is UTC: at 01:00 in Johannesburg that
 * still reads as yesterday, and a routine pasted after midnight would be dated
 * the day before.
 */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Chars a full-width step name fits on one line at its usual size.
 *
 * Mixed case at 650 weight, so a good deal narrower than `FIT_ADVANCE`, which is
 * measured for bold uppercase. Used only to decide how many lines the name will
 * take, not to size it.
 */
const NAME_CHARS_PER_LINE = 17

/**
 * How many lines the step name will wrap to, capped at three.
 *
 * The countdown and the name SHARE one column, so the clock has to know: a
 * two-line name is another 11cqh, and at the sizes they both want that is more
 * than the column has. Without this the name pushed "step 8 / 179" out from
 * under it and behind the media panel.
 */
export function nameLines(text: string): number {
  return Math.min(3, Math.max(1, Math.ceil(text.trim().length / NAME_CHARS_PER_LINE)))
}
