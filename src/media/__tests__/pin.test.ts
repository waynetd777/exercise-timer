/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { describe, expect, it } from 'vitest'
import { orphanedHashes } from '../gc'
import { draftPinnedHashes, pinDraft, unpinDraft } from '../pin'

describe('draft pins', () => {
  it('shields an unsaved draft image from the sweep', () => {
    pinDraft('h-draft')
    try {
      // No persisted routine references it yet: without the pin, a delete in
      // another tab would collect the bytes the draft is about to save.
      expect(orphanedHashes(['h-draft'], [], draftPinnedHashes())).toEqual([])
    } finally {
      unpinDraft('h-draft')
    }
    expect(orphanedHashes(['h-draft'], [], draftPinnedHashes())).toEqual(['h-draft'])
  })

  it('counts pins, so one draft closing does not expose another still open', () => {
    // Content-addressed storage: two drafts can hold the same image.
    pinDraft('h-shared')
    pinDraft('h-shared')

    unpinDraft('h-shared')
    expect(draftPinnedHashes().has('h-shared')).toBe(true)

    unpinDraft('h-shared')
    expect(draftPinnedHashes().has('h-shared')).toBe(false)
  })

  it('tolerates an unpin for a hash that was never pinned', () => {
    expect(() => unpinDraft('h-unknown')).not.toThrow()
  })
})
