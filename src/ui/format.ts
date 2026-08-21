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

/** "Round 3 of 8 · Set 2 of 2" from a timeline entry's repeat path. */
export function pathLabel(path: { label?: string; iteration: number; of: number }[]): string {
  return path
    .filter((step) => step.of > 1)
    .map((step) => `${step.label ?? 'Round'} ${step.iteration} of ${step.of}`)
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
