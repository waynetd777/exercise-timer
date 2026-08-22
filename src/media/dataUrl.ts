/**
 * Blobs as text, so an image can travel inside an export file.
 *
 * A data URL rather than raw base64 with the type beside it: the string carries
 * its own mime, so an export cannot lose track of what an image was, and the
 * value works directly as an `<img src>` while debugging one.
 *
 * Base64 costs a third in size. A downscaled photo is 60 to 100KB, so it lands at
 * 80 to 130KB in the file. A whole library of them is a couple of megabytes, which
 * is what an AirDrop is for.
 */

/**
 * Refused above this, decoded or encoded.
 *
 * `downscale()` produces ~100KB and passes anything already under 300KB through
 * untouched, so nothing this app writes comes close. A megabyte-and-a-half entry
 * means a hand-edited file, and the store is worth protecting from one.
 */
export const MAX_IMAGE_BYTES = 2_000_000

/** How many bytes at a time are turned into characters. */
const CHUNK = 8 * 1024

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())

  /*
   * Chunked rather than one `String.fromCharCode(...bytes)`: spreading a hundred
   * thousand arguments overflows the call stack, and it does it at the size a
   * real photo arrives in rather than in a test.
   */
  let binary = ''
  for (let at = 0; at < bytes.length; at += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK))
  }

  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

const DATA_URL = /^data:([^;,]*)(;base64)?,(.*)$/s

/** Decodes a data URL, or null if the string is not one this app would write. */
export function dataUrlToBlob(value: string): Blob | null {
  const match = DATA_URL.exec(value)
  if (!match || match[2] === undefined) return null

  try {
    const binary = atob(match[3]!)
    if (binary.length > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(binary.length)
    for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at)
    return new Blob([bytes], { type: match[1] || 'application/octet-stream' })
  } catch {
    // Malformed base64. Returning null keeps one bad image from failing a whole
    // import.
    return null
  }
}
