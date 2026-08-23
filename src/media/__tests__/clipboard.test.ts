// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canReadClipboard, imageFromClipboard, probeClipboardImage } from '../clipboard'

/** One clipboard entry, shaped like the real ClipboardItem in the ways we use. */
const item = (types: string[], blob = new Blob(['x'], { type: types[0] ?? '' })) => ({
  types,
  getType: vi.fn(async () => blob),
})

/**
 * Installs a clipboard and a permission answer.
 *
 * `permission` of null means the descriptor is unknown, which browsers signal by
 * THROWING from query() rather than reporting denied — Safari and Firefox both.
 */
function stub(options: {
  read?: () => Promise<unknown[]>
  permission?: PermissionState | null
}) {
  const read = options.read ? vi.fn(options.read) : undefined
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: read ? { read } : {},
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(async () => {
        if (options.permission == null) throw new TypeError('unknown descriptor')
        return { state: options.permission }
      }),
    },
  })
  return { read }
}

describe('clipboard', () => {
  afterEach(() => {
    // @ts-expect-error removing the stubs; jsdom ships neither by default.
    delete navigator.clipboard
    // @ts-expect-error as above.
    delete navigator.permissions
  })

  it('reports unsupported where there is no clipboard read', async () => {
    stub({ permission: 'granted' })
    expect(canReadClipboard()).toBe(false)
    expect(await probeClipboardImage()).toBe('unsupported')
    // And never throws: the button is disabled, not broken.
    expect(await imageFromClipboard()).toBeNull()
  })

  it('does NOT read the clipboard when the permission is not already granted', async () => {
    // The whole point of the probe. Reading here would put Safari's native paste
    // confirmation on the screen for a question the user never asked.
    for (const permission of ['prompt', 'denied', null] as const) {
      const { read } = stub({ permission, read: async () => [item(['image/png'])] })
      expect(await probeClipboardImage()).toBe('unknown')
      expect(read).not.toHaveBeenCalled()
    }
  })

  it('sees an image once reading is granted', async () => {
    stub({ permission: 'granted', read: async () => [item(['text/plain']), item(['image/png'])] })
    expect(await probeClipboardImage()).toBe('image')
  })

  it('reports none when the clipboard holds no image', async () => {
    stub({ permission: 'granted', read: async () => [item(['text/plain', 'text/html'])] })
    expect(await probeClipboardImage()).toBe('none')
  })

  it('falls back to unknown when a granted read is refused anyway', async () => {
    // Chromium refuses while the document is not focused, and a permission can
    // be revoked between the query and the read. Neither means "no image".
    stub({
      permission: 'granted',
      read: async () => {
        throw new DOMException('Document is not focused', 'NotAllowedError')
      },
    })
    expect(await probeClipboardImage()).toBe('unknown')
  })

  it('returns the first image blob, skipping non-image entries', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    stub({
      permission: 'granted',
      read: async () => [item(['text/plain']), item(['image/png'], png)],
    })
    expect(await imageFromClipboard()).toBe(png)
  })

  it('returns null rather than throwing when the clipboard is only text', async () => {
    // Distinct from a refused read, which rejects: the caller shows a different
    // message and disables the button for one and not the other.
    stub({ permission: 'granted', read: async () => [item(['text/plain'])] })
    expect(await imageFromClipboard()).toBeNull()
  })

  it('propagates a refused read so the caller can say so', async () => {
    stub({
      permission: 'granted',
      read: async () => {
        throw new DOMException('Read permission denied', 'NotAllowedError')
      },
    })
    await expect(imageFromClipboard()).rejects.toThrow()
  })

  it('takes an image of any type, having no filename to go on', async () => {
    stub({ permission: 'granted', read: async () => [item(['image/heic'])] })
    expect(await probeClipboardImage()).toBe('image')
  })
})
