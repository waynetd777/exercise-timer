/**
 * A unique id for a routine or a block.
 *
 * `crypto.randomUUID()` is **secure-context only**: on a plain-HTTP origin it is
 * `undefined`, and every call site here threw: New, Duplicate, paste, import and
 * adding a step. That is exactly the origin a phone uses to test against a dev
 * server on the LAN, so the app was unusable in the one place it most needs
 * trying out, while working perfectly over HTTPS.
 *
 * `getRandomValues` has no such restriction, so the fallback is a real version-4
 * UUID rather than a weaker shape. `Math.random` is the last resort, for a context
 * with no `crypto` at all; ids only have to be unique within one device's library,
 * and a routine with no id at all is worse than one from a weaker source.
 */
export function newId(): string {
  const c: Crypto | undefined = globalThis.crypto

  if (typeof c?.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  // Version 4, variant 1: the two fields a v4 UUID is required to pin.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
