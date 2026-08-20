import type { Workout } from '../engine'
import { importTabataFile, TabataImportError } from './tabataFormat'

export type ImportResult = {
  imported: Workout[]
  failed: { name: string; reason: string }[]
}

/**
 * Reads dropped or picked `.tabata` files into routines.
 *
 * Every file is attempted and failures are collected rather than thrown, so one
 * bad file in a drop of ten does not lose the other nine.
 */
export async function importTabataFiles(files: readonly File[], now: number): Promise<ImportResult> {
  const imported: Workout[] = []
  const failed: ImportResult['failed'] = []

  for (const file of files) {
    try {
      const workout = importTabataFile(JSON.parse(await file.text()), now)
      // A fresh id per file: the importer derives one from the timestamp, which
      // would collide across a multi-file drop.
      imported.push({ ...workout, id: crypto.randomUUID() })
    } catch (cause) {
      failed.push({
        name: file.name,
        reason:
          cause instanceof TabataImportError
            ? cause.message
            : cause instanceof SyntaxError
              ? 'Not valid JSON.'
              : 'Could not be read.',
      })
    }
  }

  return { imported, failed }
}

/** `.tabata` files are JSON, and browsers report them with no MIME type. */
export function looksImportable(file: File): boolean {
  return file.name.toLowerCase().endsWith('.tabata') || file.type === 'application/json'
}
