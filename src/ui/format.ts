/** Bare seconds under a minute — "17" reads faster than "0:17" at three metres. */
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
 * Not `duration()`, which is for labels — "45s" is the right thing for a label
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
    .map((step) => `${step.label ?? 'Reps'} ${step.iteration} of ${step.of}`)
    .join(' · ')
}

/**
 * Width of a clock string in ems, for sizing the countdown: a tabular digit
 * advances about 1 unit, a colon about half, with a floor of 2. So the size only
 * ever steps DOWN for longer strings — "8" and "17" match, "4:30" is smaller.
 */
export function clockWidth(text: string): number {
  const units = [...text].reduce((width, char) => width + (char === ':' ? 0.5 : 1), 0)
  /*
   * Floored at 2, which is what the width coefficient is calibrated for. Without
   * it a single digit divides by 1 instead of 2, the width term stops binding,
   * the height term takes over, and "9" renders up to twice the size of "10" —
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
 * Below `FIT_AVAILABLE` on purpose. The maths is exact by construction — a word
 * sized this way occupies exactly the budget — so ALL the safety has to come
 * from this gap. It is set so the text still fits even if a font advances
 * noticeably wider than the estimate below.
 */
const FIT_BUDGET = 84

/** Assumed advance of a bold uppercase glyph, in ems. */
export const FIT_ADVANCE = 0.72

/**
 * Font size in `cqi` for a headline that should fill its container, given that
 * it wraps between words. Sized off the LONGEST WORD, since that is what has to
 * fit on one line — so "REST" is set far larger than "LOW PULLEY SQUAT" and
 * both fill the frame.
 *
 * The coefficient is the budget divided by the advance. The first version used
 * 161, from assuming a 0.62em advance and the FULL container width — both
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
 * `fitCqi` is the narrow-box case of this — one word per line — and is right for
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
 * Number of lines the fallback step name will occupy, at most.
 *
 * `fitCqi` sizes so the LONGEST word fits one line, which means each word may
 * end up on its own line — so the word count is an upper bound, and using it to
 * divide the height budget errs on the side of fitting.
 */
export function wordCount(text: string): number {
  return Math.max(1, text.trim().split(/\s+/).filter(Boolean).length)
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

/**
 * The caption for the group being shown in list mode: "Round 2 of 4",
 * "Set 5 of 9 · 15 reps".
 *
 * A section contributes `of: 1` and so captions as nothing — its name is already
 * the heading above the list.
 */
export function groupCaption(group: {
  kind: 'section' | 'repeat' | 'ladder'
  label?: string
  iteration: number
  of: number
  rung?: number
} | null): string {
  if (!group || group.of <= 1) return ''
  const position = `${group.label ?? 'Reps'} ${group.iteration} of ${group.of}`
  return group.rung === undefined ? position : `${position} · ${group.rung} reps`
}

/**
 * Roughly how many lines a group needs in list mode, so the rows can be sized to
 * FILL the sheet rather than sitting small in the middle of it.
 *
 * With four or five short exercises there is a lot of height going spare, and a
 * row set at a phone's 1rem floor is unreadable from where the phone is propped.
 * Dividing the height budget by an estimated line count is the same move
 * `.panel__empty` makes with `wordCount`, and errs the same way — generously, so
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
  /** The rows showing their note — the whole current gate, which may be a rung. */
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
