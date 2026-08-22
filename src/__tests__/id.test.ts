import { describe, expect, it } from 'vitest'
import { newId } from '../id'

describe('newId', () => {
  it('is a version-4 UUID', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('does not repeat', () => {
    const many = new Set(Array.from({ length: 500 }, () => newId()))
    expect(many.size).toBe(500)
  })

  it('still works where randomUUID does not exist', async () => {
    /*
     * The whole reason this module exists: `crypto.randomUUID` is secure-context
     * only, so on the plain-HTTP origin a phone uses to reach a dev server it is
     * undefined, and every New, Duplicate, paste and import threw.
     */
    const real = globalThis.crypto.randomUUID
    try {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
      expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: real, configurable: true })
    }
  })
})
