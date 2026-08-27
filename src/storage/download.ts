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
 * on the next tick. Revoking it immediately can cancel the download in some
 * browsers before it has started reading.
 */
function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  setTimeout(() => URL.revokeObjectURL(url), 0)
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
