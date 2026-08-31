/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Names that look like the one about to be added.
 *
 * The exercise table is 147 movements written by three different hands, and the
 * instructor spells Mountain Climbers three ways and Bulgarian Split Squat four,
 * one of them "Bugarian". So the likeliest thing a typed name is, is something
 * the app already knows under another spelling. Added a second time, its weight,
 * its picture and its measured pace split across two rows that mean one
 * exercise.
 *
 * A LOOSER MATCHER THAN THE NAME FIELD'S, on purpose. `exerciseOptions.score`
 * ranks by prefix and substring over folded names, and the button that offers to
 * add an exercise appears exactly where that returned nothing for all 147: a
 * warning built on the same rules could never fire from there. One wrong letter
 * in the middle of a word defeats every one of its six rules, and one wrong
 * letter is the case that matters most.
 *
 * Two signals, and they answer different questions:
 *
 *  - a TYPO: the whole folded name is within an edit or two of one already
 *    listed. "Bugarian split squat" against "bulgarian split squat".
 *  - a FAMILY: it shares the movement with something listed. "Bulgarian Split
 *    Squat" against King Squats and Plie Squats, which are not the same exercise
 *    and are worth seeing before you add a third squat.
 *
 * NOTHING HERE DECIDES ANYTHING. `closestKey` in `foldName.ts` is the app's
 * other fuzzy match and returns null the moment two candidates qualify, because
 * its answer is used silently to put a weight on a bar. This one is shown to a
 * person who then chooses, so ambiguity is the output rather than a reason to
 * give up.
 */

import { foldName } from './foldName'

export type Similar = {
  /** The existing exercise's own name, spelled as its table spells it. */
  name: string
  /** Why it is here, which is what the dialog says about it. */
  why: 'typo' | 'family'
}

/**
 * How many single-character edits apart two strings are, counted no further than
 * `max`.
 *
 * Ordinary Levenshtein over two rows rather than a full matrix, with an early
 * exit: the answer is only ever compared against a small `max`, and the caller
 * asks it 147 times on a keystroke. A pair further apart than `max` returns
 * `max + 1`, which is all anyone here needs to know.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  // Length alone can settle it, and usually does: a squat cannot be two edits
  // from a press-up.
  if (Math.abs(a.length - b.length) > max) return max + 1

  let previous = Array.from({ length: b.length + 1 }, (_, at) => at)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i, ...Array.from({ length: b.length }, () => 0)]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      )
    }
    // Every path onward from this row costs at least its cheapest cell, so a row
    // whose best is already over budget cannot come back under it.
    if (Math.min(...row) > max) return max + 1
    previous = row
  }
  return Math.min(previous[b.length] ?? max + 1, max + 1)
}

/**
 * How far apart two names may be and still read as the same one, mistyped.
 *
 * Scaled by length, because a fixed threshold is wrong at both ends: two edits
 * is most of "Row" and a rounding error in "Straight Legs Up Overhead Crunch".
 * One edit under seven letters, two above, and nothing at all under four: three
 * letters within one edit of each other is half the alphabet.
 */
function budget(key: string): number {
  if (key.length < 4) return 0
  return key.length <= 6 ? 1 : 2
}

/** The words worth comparing: a fold's own words, minus the ones too short to mean anything. */
function words(key: string): string[] {
  return key.split(' ').filter((word) => word.length >= 3)
}

/**
 * Whether two names end on the same movement.
 *
 * A PREFIX counts, not only an exact match, because the movement is the word
 * most likely to be typed short or typed wrong: "Standard Chest Pres" folds to
 * end in `pre`, and the whole-name distance cannot rescue it when the two names
 * differ by an entire word as well. Three letters at least, the same floor
 * `closestKey` uses, since two would make `ab` the start of half the table.
 */
function sameMovement(mine: string | undefined, theirs: string | undefined): boolean {
  if (mine === undefined || theirs === undefined) return false
  const [short, long] = mine.length <= theirs.length ? [mine, theirs] : [theirs, mine]
  return short.length >= 3 && long.startsWith(short)
}

/**
 * The exercise this name already IS, spelled as the table spells it, or null.
 *
 * A fold match is not a similarity and is not a question: the weights, paces and
 * pictures tables are keyed by exactly this string, so a second row under the
 * same key would fight the first over one weight and one picture. The caller
 * offers the existing exercise instead of offering to add anything.
 */
export function sameExercise(name: string, existing: Iterable<string>): string | null {
  const key = foldName(name)
  if (key === '') return null
  for (const other of existing) {
    if (foldName(other) === key) return other
  }
  return null
}

/**
 * What to warn about before adding `name`, best first, at most `limit`.
 *
 * Typos rank above families, and inside each the closer match first, because the
 * first row is the one a person actually reads. An exact fold match is NOT
 * included: that is `sameExercise`, and a different answer.
 */
export function similarExercises(
  name: string,
  existing: Iterable<string>,
  limit = 4,
): Similar[] {
  const key = foldName(name)
  if (key === '') return []
  const mine = words(key)
  const last = mine.at(-1)

  const found: { name: string; why: Similar['why']; rank: number }[] = []
  for (const other of existing) {
    const theirs = foldName(other)
    if (theirs === key || theirs === '') continue

    const apart = editDistance(key, theirs, budget(key))
    if (apart <= budget(key)) {
      found.push({ name: other, why: 'typo', rank: apart })
      continue
    }

    /*
     * The MOVEMENT is the last word of an exercise name: Chest Press, Seated
     * Row, Bicycle Crunch, Plie Squats. Sharing it says "you already have three
     * of these"; sharing a modifier ("Seated", "Standing") says almost nothing,
     * which is why one shared word anywhere is not enough on its own.
     */
    const shared = words(theirs).filter((word) => mine.includes(word))
    const family = sameMovement(last, words(theirs).at(-1)) || shared.length >= 2
    if (family) found.push({ name: other, why: 'family', rank: 10 - shared.length })
  }

  return found
    .sort((a, b) =>
      a.why === b.why ? a.rank - b.rank || a.name.localeCompare(b.name) : a.why === 'typo' ? -1 : 1,
    )
    .slice(0, limit)
    .map(({ name: found_, why }) => ({ name: found_, why }))
}
