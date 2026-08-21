import type { Workout } from '../engine'
import { fromBundle } from '../storage/bundle'
import { importTabataFile, TabataImportError } from './tabataFormat'

export type ImportResult = {
  imported: Workout[]
  failed: { name: string; reason: string }[]
}

/**
 * Reads dropped or picked routine files.
 *
 * Two formats are accepted: this app's own export bundle, and the Tabata Timer
 * app's `.tabata` export. The bundle is tried first because it identifies itself
 * with a marker, so there is no guessing.
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
      const json: unknown = JSON.parse(await file.text())

      if (
        typeof json === 'object' &&
        json !== null &&
        (json as { kind?: unknown }).kind === 'davshack-timer-bundle'
      ) {
        // A bundle may hold a whole library, and each routine keeps its own id.
        for (const workout of fromBundle(json, now)) imported.push(workout)
        continue
      }

      // A fresh id per file: the tabata importer derives one from the timestamp,
      // which would collide across a multi-file drop.
      imported.push({ ...importTabataFile(json, now), id: crypto.randomUUID() })
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

/** Routine files are JSON, and browsers often report no MIME type for them. */
export function looksImportable(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.tabata') || name.endsWith('.json') || file.type === 'application/json'
}
