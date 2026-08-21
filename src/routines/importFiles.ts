import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { fromBundle } from '../storage/bundle'
import { migrateWorkout } from '../storage/migrate'
import { parseRoutine } from './pasteFormat'
import { importTabataFile, TabataImportError } from './tabataFormat'

export type ImportResult = {
  imported: Workout[]
  failed: { name: string; reason: string }[]
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
 * to a file is often easier than getting at its text to copy — particularly on a
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

  for (const file of files) {
    try {
      const text = await file.text()
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        // Not JSON, so read it the way the paste dialog would.
        imported.push(pasted(text, file.name, now))
        continue
      }

      if (
        typeof json === 'object' &&
        json !== null &&
        (json as { kind?: unknown }).kind === 'davshack-timer-bundle'
      ) {
        // A bundle may hold a whole library, and each routine keeps its own id.
        for (const workout of fromBundle(json, now)) imported.push(workout)
        continue
      }

      /*
       * A fresh id per file: the tabata importer derives one from the timestamp,
       * which would collide across a multi-file drop.
       *
       * Migrated like every other way in. A `.tabata` file carries an image as a
       * URL, and those URLs are the postimages links the app used to load — the
       * same pictures it now ships. Without this the import would reach for the
       * network for an illustration sitting in `public/exercises`. `fromBundle`
       * and the share-link reader already migrate; this was the one entry point
       * that did not.
       */
      imported.push(migrateWorkout({ ...importTabataFile(json, now), id: crypto.randomUUID() }))
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

  return { imported, failed }
}

/** Turns a plain-text routine into a workout, named after its file. */
function pasted(text: string, filename: string, now: number): Workout {
  const name = filename.replace(/\.[^.]+$/, '').trim()
  const parsed = parseRoutine(text, name || 'Pasted routine')
  if (parsed.blocks.length === 0) throw new Error('No routine found in this file.')
  return {
    id: crypto.randomUUID(),
    name: parsed.name,
    blocks: parsed.blocks,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  }
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
