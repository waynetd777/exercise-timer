/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Hands the user a file.
 *
 * A temporary anchor rather than anything cleverer: it is the only approach that
 * works in every browser, including an installed PWA. The object URL is revoked
 * a minute later, not on the next tick: Safari starts reading the blob
 * asynchronously, and a multi-megabyte backup with photos in it was cancelled
 * before it had begun. A minute of one URL is nothing; a lost backup is not.
 */
const REVOKE_AFTER_MS = 60_000

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

export function downloadJson(filename: string, data: unknown): void {
  download(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

/** A routine written as text, for sending to someone who does not have the app. */
export function downloadText(filename: string, text: string): void {
  download(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }))
}

/** Copies text, reporting whether it worked so the caller can offer a fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
