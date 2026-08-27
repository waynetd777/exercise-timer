/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { fromBundle } from '../storage/bundle'
import { restoreMedia } from '../storage/bundleMedia'
import { migrateWorkout } from '../storage/migrate'
import { loadWeights, saveWeights } from '../storage/weights'
import { hasBlob, putBlob } from '../media/store'
import { pinDraft } from '../media/pin'
import { parseRoutine } from './pasteFormat'
import { importTabataFile, TabataImportError } from './tabataFormat'
import { newId } from '../id'

export type ImportResult = {
  imported: Workout[]
  failed: { name: string; reason: string }[]
  /**
   * Photos in a bundle that could not be trusted: a key that does not match its
   * contents, or something that is not a readable image. The routines still
   * import; those steps simply arrive without a picture.
   */
  droppedImages: number
  /**
   * Names of routines a bundle carried but that were too damaged to read. The
   * file's readable routines still import; these must be reported, or a restore
   * that loses some of them looks fully successful.
   */
  rejectedRoutines: string[]
  /**
   * Hashes draft-pinned here for the blobs written below, so a GC sweep in the
   * window before the routines are saved cannot collect them. The caller owns
   * releasing them: one `unpinDraft` per entry once the imported routines have
   * been saved, or abandoned.
   */
  pinnedHashes: string[]
  /**
   * Lines the plain-text parser refused, per file. The routine still imports
   * without them; the paste dialog shows these same lines, and a dropped file
   * must not be the one way in that loses steps silently.
   */
  skippedLines: { file: string; lines: string[] }[]
}

/**
 * Reads dropped or picked routine files.
 *
 * Three formats: this app's own export bundle, the Tabata Timer app's `.tabata`
 * export, and plain text in the format the paste dialog accepts. The bundle is
 * tried first because it identifies itself with a marker, so there is no
 * guessing; text is tried last, when the file is not JSON at all.
 *
 * Text is worth accepting because the routines arrive as email, and saving one
 * to a file is often easier than getting at its text to copy, particularly on a
 * phone. The file's own name becomes the routine's.
 *
 * Every file is attempted and failures are collected rather than thrown, so one
 * bad file in a drop of ten does not lose the other nine.
 */
export async function importRoutineFiles(
  files: readonly File[],
  now: number,
): Promise<ImportResult> {
  const imported: Workout[] = []
  const failed: ImportResult['failed'] = []
  let droppedImages = 0
  const rejectedRoutines: string[] = []
  const pinnedHashes: string[] = []
  const skippedLines: ImportResult['skippedLines'] = []

  for (const file of files) {
    try {
      const text = await file.text()
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        // Not JSON, so read it the way the paste dialog would.
        const routine = pasted(text, file.name, now)
        imported.push(routine.workout)
        if (routine.skipped.length > 0) skippedLines.push({ file: file.name, lines: routine.skipped })
        continue
      }

      if (
        typeof json === 'object' &&
        json !== null &&
        (json as { kind?: unknown }).kind === 'davshack-timer-bundle'
      ) {
        // A bundle may hold a whole library, and each routine keeps its own id.
        const contents = fromBundle(json, now)
        for (const workout of contents.workouts) imported.push(workout)
        rejectedRoutines.push(...contents.rejected)

        /*
         * The uploaded photos it carries, stored BEFORE the routines are saved so
         * a step never renders looking for bytes that have not landed yet. Each
         * one has already been checked against its own hash. See `restoreMedia`.
         *
         * A photo the store already has is skipped rather than rewritten. The key
         * IS the hash of the bytes, so an image cannot be duplicated by importing
         * it twice, since the second write would land on the same key, and this saves
         * doing it at all. Same check `storeFile` makes on the way in.
         */
        const media = await restoreMedia((json as { media?: unknown }).media)
        for (const { hash, blob } of media.entries) {
          // Pinned before the write: the routines land only after this loop,
          // and a sweep in that gap must not collect bytes they will reference.
          pinDraft(hash)
          pinnedHashes.push(hash)
          if (!(await hasBlob(hash))) await putBlob(hash, blob)
        }
        droppedImages += media.skipped.length

        /*
         * The weights the file carried are MERGED over what is here, not
         * swapped in: a restore onto a device that already has weights should
         * not silently drop the ones the file has never heard of. The file
         * wins where both say something, since it is the one being restored.
         */
        if (Object.keys(contents.weights).length > 0) {
          saveWeights({ ...loadWeights(), ...contents.weights })
        }
        continue
      }

      /*
       * A fresh id per file: the tabata importer derives one from the timestamp,
       * which would collide across a multi-file drop.
       *
       * Migrated like every other way in. A `.tabata` file carries an image as a
       * URL, and those URLs are the postimages links the app used to load, so the
       * same pictures it now ships. Without this the import would reach for the
       * network for an illustration sitting in `public/exercises`. `fromBundle`
       * and the share-link reader already migrate; this was the one entry point
       * that did not.
       */
      imported.push(migrateWorkout({ ...importTabataFile(json, now), id: newId() }))
    } catch (cause) {
      failed.push({
        name: file.name,
        reason:
          cause instanceof TabataImportError
            ? cause.message
            : cause instanceof SyntaxError
              ? 'Not valid JSON.'
              : cause instanceof Error
                ? cause.message
                : 'Could not be read.',
      })
    }
  }

  return { imported, failed, droppedImages, rejectedRoutines, pinnedHashes, skippedLines }
}

/** Turns a plain-text routine into a workout, named after its file. */
function pasted(
  text: string,
  filename: string,
  now: number,
): { workout: Workout; skipped: string[] } {
  const name = filename.replace(/\.[^.]+$/, '').trim()
  const parsed = parseRoutine(text, name || 'Pasted routine')
  if (parsed.blocks.length === 0) throw new Error('No routine found in this file.')
  const workout: Workout = {
    id: newId(),
    name: parsed.name,
    blocks: parsed.blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  }
  return { workout, skipped: parsed.skipped.map((entry) => entry.text) }
}

/** Routine files are JSON, and browsers often report no MIME type for them. */
export function looksImportable(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.tabata') ||
    name.endsWith('.json') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    file.type === 'application/json' ||
    file.type.startsWith('text/')
  )
}
