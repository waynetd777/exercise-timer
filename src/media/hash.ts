/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Content hash for an image blob.
 *
 * Content-addressed rather than named, so the same illustration used by eight
 * steps across three routines is stored exactly once, and re-adding a file you
 * already have is free.
 */
export async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
