/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * The clipboard as a source of images.
 *
 * A screenshot of an exercise, or a picture copied out of a message, is the
 * shortest path from "I have that image" to "that step has it". Everything here
 * hands a Blob to `storeFile`, so a pasted image goes through the same
 * downscale-hash-store pipeline as a file picked off the device; nothing
 * downstream knows or cares where it came from.
 *
 * The awkward part is knowing whether there IS an image, before the user asks.
 * Reading the clipboard is a privacy operation and every browser gates it
 * differently:
 *
 * - Chromium exposes `clipboard-read` to the Permissions API. Once granted, a
 *   read is silent, so the answer is free and we can take it.
 * - Safari and Firefox do not expose that descriptor at all, and will not answer
 *   without a user gesture: Safari puts up its own native Paste confirmation.
 *   Asking on the off-chance would show that prompt for a question the user
 *   never asked, so we do not ask: the state stays `unknown` and the button
 *   stays enabled, because the tap is the gesture that gets the answer.
 * - An insecure origin has no `navigator.clipboard` at all, which is `unsupported`.
 *   The LAN dev server over plain HTTP lands here, as does `crypto.subtle` and
 *   therefore uploads, so nothing about pasting is testable there.
 */

/**
 * What we can say about the clipboard right now.
 *
 * Four states rather than a boolean because "there is no image" and "we are not
 * allowed to look" are different answers, and the button behaves differently
 * on each: `none` disables it, `unknown` leaves it enabled.
 */
export type ClipboardImage = 'image' | 'none' | 'unknown' | 'unsupported'

/** Anything a browser will decode. Type first, extension never: a clipboard has no filenames. */
const isImage = (type: string) => type.startsWith('image/')

/** Whether an async clipboard read exists here at all. False on an insecure origin. */
export function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'
}

/**
 * Whether the clipboard already holds an image, WITHOUT prompting for anything.
 *
 * Returns `unknown` rather than reading whenever a read could put a prompt on
 * the screen. See the note above: that is not a fallback, it is the point.
 */
export async function probeClipboardImage(): Promise<ClipboardImage> {
  if (!canReadClipboard()) return 'unsupported'
  if (!(await readGranted())) return 'unknown'

  try {
    const items = await navigator.clipboard.read()
    return items.some((item) => item.types.some(isImage)) ? 'image' : 'none'
  } catch {
    // Granted a moment ago is not granted now: the permission can be revoked,
    // and Chromium also refuses while the document is not focused.
    return 'unknown'
  }
}

/** True only where a read is known to cost the user nothing. */
async function readGranted(): Promise<boolean> {
  try {
    // `clipboard-read` is not in the typed PermissionName union, and querying a
    // name a browser does not know THROWS rather than reporting 'denied', which
    // is how Safari and Firefox end up answering false here.
    const status = await navigator.permissions.query({
      name: 'clipboard-read',
    } as unknown as PermissionDescriptor)
    return status.state === 'granted'
  } catch {
    return false
  }
}

/**
 * The first image on the clipboard, or null if there is none.
 *
 * Call this from a click handler and nowhere else: Safari and Firefox only
 * answer under user activation, and this is the call that spends it. Rejects
 * when the read itself is refused, which the caller must tell apart from a
 * clipboard that simply holds text.
 */
export async function imageFromClipboard(): Promise<Blob | null> {
  if (!canReadClipboard()) return null

  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find(isImage)
    if (type) return await item.getType(type)
  }
  return null
}
