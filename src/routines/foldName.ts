/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * An exercise name reduced far enough that its spellings meet.
 *
 * The instructor writes Mountain Climbers three ways and Bulgarian Split Squat
 * four, one of them "Bugarian". Everything that has to compare a written name
 * against another folds both first: the prescription harvest keys its table by
 * this, the exercise harvest matches against the table with it, and the
 * generator looks a prescription up through it.
 *
 * ONE implementation, in `src/` rather than in `scripts/` or in a generated
 * file, because it was briefly two. The harvests then disagreed about how many
 * of the same corpus they recognised, which is the sort of difference that reads
 * as data rather than as a bug.
 *
 * Drops anything bracketed, any count, any per-side qualifier, the side itself,
 * hyphens, and a plural. "10x Bicycle Crunches (per leg)", "Bicycle crunch" and
 * "Bicycle-Crunches" all arrive here as `bicycle crunch`.
 */
/**
 * The one candidate that reads as `key`, or null.
 *
 * Word by word: the same number of words, in the same order, each the start of
 * the other ("ab" finds "abdominal"), and at least two letters, since one would
 * match half the table. Two candidates decide nothing: putting the wrong number
 * on a bar is worse than putting none on it. Shared by the weight lookup and the
 * renamer, which used to carry a copy each with a comment asking that they be
 * kept in step.
 */
export function closestKey(key: string, candidates: Iterable<string>): string | null {
  const wanted = key.split(' ').filter(Boolean)
  if (wanted.length === 0) return null
  let found: string | null = null
  for (const candidate of candidates) {
    const words = candidate.split(' ')
    if (words.length !== wanted.length) continue
    const alike = words.every((word, at) => {
      const other = wanted[at]!
      const [short, long] = word.length <= other.length ? [word, other] : [other, word]
      return short.length >= 2 && long.startsWith(short)
    })
    if (!alike) continue
    if (found !== null) return null
    found = candidate
  }
  return found
}

export function foldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+\s*[×x]?\s*/g, ' ')
    .replace(/\b(?:each|per)\s+(?:side|leg|arm|direction)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(?:left|right)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      // "Crunches" is "crunch", not "crunche": an -es plural after a sibilant
      // drops both letters.
      if (/(?:ch|sh|ss|x|z)es$/.test(word)) return word.slice(0, -2)
      // "Press" is not a plural: a word ending in a double s keeps both.
      return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
    })
    // A trailing limb is the side, which is a field: "Fire Hydrant Left Leg".
    .filter((word, at, all) => !(at === all.length - 1 && /^(?:leg|arm|side)$/.test(word)))
    .join(' ')
}
