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
