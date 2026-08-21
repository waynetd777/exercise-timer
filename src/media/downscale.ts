/** Longest edge of a stored image. Enough for a phone at full width. */
const MAX_EDGE = 1024

/** WebP quality. 0.8 keeps an illustration crisp at roughly a tenth the bytes. */
const QUALITY = 0.8

/** Below this, re-encoding costs more than it saves. */
const SKIP_BELOW_BYTES = 300_000

/**
 * Shrinks an image before it is stored.
 *
 * Not optional for photos: a phone camera file is 3-5MB, and a handful would
 * exhaust the origin's storage quota. Files already small enough are passed
 * through untouched rather than re-encoded for nothing.
 */
export async function downscale(file: Blob): Promise<Blob> {
  if (file.size <= SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', QUALITY),
    )
    // Keep whichever is smaller: re-encoding an already-optimised PNG can grow it.
    return encoded && encoded.size < file.size ? encoded : file
  } catch {
    // HEIC outside Safari, or any other format the browser will not decode.
    // Storing the original is better than losing the image.
    return file
  }
}
