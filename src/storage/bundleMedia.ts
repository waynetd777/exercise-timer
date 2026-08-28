/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Workout } from '../engine'
import { blobToDataUrl, dataUrlToBlob, MAX_IMAGE_BYTES } from '../media/dataUrl'
import { localHashes } from '../media/gc'
import { sha256 } from '../media/hash'

/**
 * The photos in an export file.
 *
 * The illustrations that ship with the app need nothing here. A bundled ref is
 * already a short path, and the picture is in the app on the other side. An
 * UPLOADED photo is different: its bytes live in this device's IndexedDB and
 * nothing else has them, so if they do not travel in the file they do not travel
 * at all. Since the image-link field went, this is the only way one reaches
 * another device.
 *
 * Keyed by content hash, which is the same key the store uses, so importing the
 * same photo twice costs nothing and two routines sharing one carry one copy.
 */

/** Reads a blob out of storage. Injected so this can be tested without IndexedDB. */
type ReadBlob = (hash: string) => Promise<Blob | undefined>

type MediaReport = {
  /** Images ready to store, already verified against their key. */
  entries: { hash: string; blob: Blob }[]
  /** Hashes that could not be used, and why. Reported, never thrown. */
  skipped: { hash: string; reason: string }[]
}

/**
 * The `media` map for an export: every uploaded photo the routines reference,
 * plus the ones the exercises page holds.
 *
 * `alsoLocal` is that second set. Those photos belong to no step, so the walk
 * over the routines cannot find them, and a backup without them would restore a
 * page of empty frames. Keyed by hash like everything else, so a photo used both
 * on the page and on a step is carried once.
 */
export async function collectMedia(
  workouts: readonly Workout[],
  read: ReadBlob,
  alsoLocal: readonly string[] = [],
): Promise<Record<string, string>> {
  const media: Record<string, string> = {}

  for (const hash of new Set([...localHashes(workouts), ...alsoLocal])) {
    const blob = await read(hash)
    // A missing blob is not an error worth stopping an export for: the step will
    // simply have no picture on the other side, exactly as it has none here.
    if (!blob || blob.size > MAX_IMAGE_BYTES) continue
    media[hash] = await blobToDataUrl(blob)
  }

  return media
}

/**
 * The photos a bundle carries, decoded and CHECKED.
 *
 * Every entry is re-hashed and compared against its key. The store is
 * content-addressed, so a key that lies about its contents would poison it for
 * every routine that shares the hash, and re-hashing costs a millisecond on a
 * file that has just been read off disk. A bad entry is skipped and reported; the
 * routines still import, and a step whose photo was dropped shows no picture
 * rather than the wrong one.
 */
export async function restoreMedia(media: unknown): Promise<MediaReport> {
  const report: MediaReport = { entries: [], skipped: [] }
  if (typeof media !== 'object' || media === null) return report

  for (const [hash, value] of Object.entries(media as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      report.skipped.push({ hash, reason: 'not a string' })
      continue
    }

    const blob = dataUrlToBlob(value)
    if (!blob) {
      report.skipped.push({ hash, reason: 'not a readable data URL' })
      continue
    }

    const actual = await sha256(blob)
    if (actual !== hash) {
      report.skipped.push({ hash, reason: 'contents do not match the hash' })
      continue
    }

    report.entries.push({ hash, blob })
  }

  return report
}
