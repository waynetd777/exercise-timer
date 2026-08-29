/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { MediaRef } from '../engine'
import type { Equipment, Exercise } from './exercises'
import { EXERCISES, KIT_GROUPS } from './exercises'
import { closestKey, foldName } from './foldName'
import { bundled } from '../media/resolve'

/**
 * The exercise table as the editor's name field needs it: a label, a picture,
 * and the two fields a pick carries onto the step.
 *
 * A view of `EXERCISES` rather than a second table. The generator has been
 * choosing from that list since it was written; the editor could not see it at
 * all, so a name typed by hand was the only way to fill a work step in, and a
 * name typed by hand is what `weightFor()` and `storage/paces.ts` then fail to
 * recognise. Nothing here is new data.
 */
export type ExerciseOption = {
  /** The table's own spelling, which is what a pick writes to the step. */
  name: string
  /**
   * The picture in force for the exercise: the exercises page's where one was
   * chosen there, else the guide's illustration, else none. For the thumbnail
   * only; a pick writes no picture onto the step, since the step takes this
   * same picture on the way into a run.
   */
  picture?: MediaRef
  /** Worked one side at a time, so a pick sets the count's per-side flag. */
  perSide?: boolean
  /** The kit, named as the list's heading names it: "Multi-gym", "Bands". */
  kit: string
  /** A short second line: the station, or what the exercise is for. */
  hint: string
  /** `foldName` of the name, so matching survives the spelling. Never shown. */
  key: string
}

/** A heading, or one exercise, in the order the list renders them. */
export type ExerciseRow =
  | { kind: 'group'; label: string }
  | { kind: 'option'; option: ExerciseOption }

/**
 * The kit, in the order the list offers it: `KIT_GROUPS`, which the exercises
 * page uses too, so the two screens cannot disagree about the headings.
 */
const GROUPS = KIT_GROUPS

/**
 * What to say about an exercise besides its name.
 *
 * The station earns its place: consecutive exercises on one station save
 * re-rigging the machine, which is the whole reason `station` is in the table.
 * `use` earns its place because "Cycling" and "Ski Jumps" are not strength work
 * and a routine wants them in different slots. Anything else the row has room
 * for is already in the picture.
 */
function hintFor(exercise: Exercise): string {
  const parts: string[] = []
  if (exercise.station !== undefined) parts.push(`Station ${exercise.station}`)
  if (exercise.use === 'cardio') parts.push('Cardio')
  if (exercise.use === 'mobility') parts.push('Mobility')
  if (exercise.perSide === true) parts.push('each side')
  return parts.join(' · ')
}

/**
 * Every exercise the field can offer, grouped by kit and deduplicated.
 *
 * Deduplicated by FOLDED name, not by name: the table is three files, one of
 * them harvested from the routines, so the same movement can arrive twice under
 * two spellings. The first wins, which means the machine's own spelling wins,
 * since `EXERCISES` puts the guide first. There are no collisions today; this is
 * here so the next harvest cannot put a duplicate React key on the screen.
 *
 * Order WITHIN a group is the table's own, which for the multi-gym is station
 * order: physical order at the machine beats alphabetical order in a list you
 * are reading while standing at it.
 */
export function collectExercises(
  exercises: readonly Exercise[] = EXERCISES,
  /**
   * `currentPictures()`, keyed by folded name: the exercises page's table laid
   * over the guide. Without it the guide's own illustrations stand in, which is
   * what a test wants and what the page would supply with nothing chosen.
   */
  pictures?: ReadonlyMap<string, MediaRef>,
): ExerciseOption[] {
  const byKit = new Map<Equipment, ExerciseOption[]>()
  const seen = new Set<string>()

  for (const exercise of exercises) {
    const key = foldName(exercise.name)
    if (key === '' || seen.has(key)) continue
    seen.add(key)

    const group = GROUPS.find((entry) => entry.kit === exercise.equipment)
    // Kit the list has no heading for. Impossible today, since `GROUPS` covers
    // every `Equipment`, and skipped rather than dropped into an unlabelled
    // group if one is ever added.
    if (!group) continue

    const picture =
      pictures?.get(key) ??
      (exercise.media ? bundled(exercise.media) : undefined)

    const option: ExerciseOption = {
      name: exercise.name,
      ...(picture !== undefined ? { picture } : {}),
      ...(exercise.perSide === true ? { perSide: true } : {}),
      kit: group.label,
      hint: hintFor(exercise),
      key,
    }

    byKit.set(exercise.equipment, [...(byKit.get(exercise.equipment) ?? []), option])
  }

  return GROUPS.flatMap((group) => byKit.get(group.kit) ?? [])
}

/**
 * How well an option answers what has been typed, lowest first, or null for
 * "not at all".
 *
 * Both sides are folded first, so "ab crunch" finds "Abdominal Oblique Crunch"
 * and "bugarian" finds the split squat: the instructor's own spellings are the
 * reason `foldName` exists, and they are what gets typed into this field.
 *
 * The order matters more than the exactness. Whatever is first is what Enter
 * picks, so a name that STARTS with what you typed has to beat one that merely
 * contains it, or typing "row" would offer Bentover Row before Seated Row on
 * nothing but table order.
 */
function score(option: ExerciseOption, needle: string, words: readonly string[]): number | null {
  if (option.key === needle) return 0
  if (option.key.startsWith(needle)) return 1
  // A word of the name starts with the whole needle: "curl" finds "Standing Arm
  // Curl", which neither of the two above does.
  if (option.key.split(' ').some((word) => word.startsWith(needle))) return 2
  if (option.key.includes(needle)) return 3
  /*
   * Every word typed appears SOMEWHERE in the name, in any order: "press chest"
   * and "chest press" find the same three machines. This is the one rule that
   * matches out of order.
   */
  if (words.length > 1 && words.every((word) => option.key.includes(word))) return 4

  /*
   * The other way round: what was typed CONTAINS the whole exercise, because it
   * says more than the exercise does. "Walking lunge 5m A-B" is a course leg the
   * paste parser wrote, and "12 × Leg Press 65kg" is how a name read before the
   * count and the weight became fields; both still name an exercise, with the
   * routine's own words around it.
   *
   * Two words at least. A five-letter key like "squat" or "plank" appears inside
   * plenty of prose, and this rule is loose enough without letting one word claim
   * a whole sentence. Ranked last, so it never displaces something that actually
   * begins with what you typed.
   */
  if (option.key.includes(' ') && needle.includes(option.key)) return 5
  return null
}

/**
 * What has been typed, folded far enough to compare against a name.
 *
 * `foldName` alone was wrong here, and quietly: it DROPS a trailing limb, since
 * "Fire Hydrant Left Leg" names a side rather than an exercise, so the query
 * "leg" folded to nothing and the field answered a search with the whole table.
 * Same for "arm" and "side". Those three are prefixes anyone typing this field
 * will reach on the way to Leg Press.
 *
 * So: fold, and where folding leaves nothing, keep the letters instead. A
 * half-typed word is not a routine and does not need a routine's rules applied
 * to it.
 */
function needleOf(query: string): string {
  const folded = foldName(query)
  if (folded !== '') return folded
  return query
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/**
 * The rows to render for what has been typed.
 *
 * Two shapes, deliberately:
 *
 *  - NOTHING typed, i.e. browsing: every exercise, under its kit's heading. The
 *    headings are the point of this mode: you are reading a list of 147 things
 *    and "Multi-gym" tells you which 42 you can do without getting up.
 *  - something typed: the matches ranked, flat and headingless. A heading is
 *    noise over two results, and ranked order would make it repeat anyway. The
 *    kit still shows, on the row itself; see `ExerciseField`.
 */
export function exerciseRows(
  options: readonly ExerciseOption[],
  query: string,
): ExerciseRow[] {
  const needle = needleOf(query)

  if (needle === '') {
    const rows: ExerciseRow[] = []
    let kit: string | null = null
    for (const option of options) {
      if (option.kit !== kit) {
        rows.push({ kind: 'group', label: option.kit })
        kit = option.kit
      }
      rows.push({ kind: 'option', option })
    }
    return rows
  }

  const words = needle.split(' ').filter(Boolean)
  return options
    .map((option, at) => ({ option, at, rank: score(option, needle, words) }))
    .filter((entry): entry is { option: ExerciseOption; at: number; rank: number } =>
      entry.rank !== null,
    )
    // `at` breaks ties, so equally good matches stay in table order rather than
    // in whatever order `sort` happens to leave them.
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map(({ option }) => ({ kind: 'option', option }))
}

/**
 * Where a written name sits in the list, or 0 for one the table does not hold.
 *
 * This is what the field opens ON, so it reads a step's name the way a person
 * would, in three passes, each looser than the last:
 *
 *  1. the folded name exactly, which is most steps;
 *  2. `closestKey`, so "Seated Ab Crunch" finds Seated Abdominal Crunch, the
 *     same near-miss rule the weight lookup and the renamer use;
 *  3. the ranked search, for a name that carries more than the exercise. The
 *     paste parser writes a course leg as "Walking lunge 5m A-B", and neither
 *     rule above can see Walking Lunges inside that; the search can, since it
 *     is built to answer half a name.
 *
 * 0 rather than -1 because the caller is choosing a row to highlight, and the
 * top of the list is the right answer for a name that is in no table at all.
 */
export function indexOfName(options: readonly ExerciseOption[], name: string): number {
  const needle = needleOf(name)
  if (needle === '') return 0

  const exact = options.findIndex((option) => option.key === needle)
  if (exact !== -1) return exact

  /*
   * Then the near miss, through the same `closestKey` the weight lookup and the
   * renamer use: "Seated Ab Crunch" is what the routine says and "Seated
   * Abdominal Crunch" is what the table calls it. It returns null where two
   * candidates read alike, which is the right answer here too: highlighting the
   * wrong one of two is worse than highlighting neither.
   */
  const closest = closestKey(needle, options.map((option) => option.key))
  if (closest !== null) {
    const at = options.findIndex((option) => option.key === closest)
    if (at !== -1) return at
  }

  /*
   * Then whatever the search itself would put first. It is the same ranking the
   * list shows while you type, so the row the field opens on is the row Enter
   * would have picked, which is one behaviour rather than two.
   */
  const best = exerciseRows(options, name).find((row) => row.kind === 'option')
  if (best?.kind !== 'option') return 0
  const at = options.indexOf(best.option)
  return at === -1 ? 0 : at
}

/** Just the options from a row list, in order: what the arrow keys walk. */
export function optionsOf(rows: readonly ExerciseRow[]): ExerciseOption[] {
  return rows.flatMap((row) => (row.kind === 'option' ? [row.option] : []))
}
