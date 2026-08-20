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
 * advances about 1 unit, a colon about half. Lets "8" and "17" render at the
 * same size while "4:30" steps down instead of overflowing.
 */
export function clockWidth(text: string): number {
  return [...text].reduce((width, char) => width + (char === ':' ? 0.5 : 1), 0)
}

/**
 * Font size in `cqi` for a headline that should fill its container, given that
 * it wraps between words. Sized off the LONGEST WORD, since that is what has to
 * fit on one line — so "REST" is set far larger than "LOW PULLEY SQUAT" and
 * both fill the frame.
 *
 * The 161 comes from 100cqi divided by an average uppercase bold advance of
 * ~0.62em. Same idea as `clockWidth`, applied to words instead of digits.
 */
export function fitCqi(text: string, max = 40): number {
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => word.length))
  return Math.min(max, 161 / longest)
}
