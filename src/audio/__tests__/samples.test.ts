import { describe, expect, it } from 'vitest'
import { CUE_GAIN, CUE_SOUND_URLS, CUE_SOUNDS, cueSoundUrl } from '../samples'

const CUE_KINDS = ['countdown', 'phase-change', 'workout-complete'] as const

describe('cue sound mapping', () => {
  it('maps every cue kind to a sound and a sane level', () => {
    for (const kind of CUE_KINDS) {
      expect(CUE_SOUNDS[kind]).toBeDefined()
      expect(CUE_GAIN[kind]).toBeGreaterThan(0)
      expect(CUE_GAIN[kind]).toBeLessThanOrEqual(1)
    }
  })

  it('only maps sounds that exist in the registry', () => {
    for (const name of Object.values(CUE_SOUNDS)) {
      expect(CUE_SOUND_URLS).toHaveProperty(name)
    }
  })

  it('resolves every registered sound to a url', () => {
    // The files are imported as modules, so a missing one fails the build
    // rather than reaching here — this guards the lookup, not the files.
    for (const name of Object.keys(CUE_SOUND_URLS) as (keyof typeof CUE_SOUND_URLS)[]) {
      expect(cueSoundUrl(name)).toBeTruthy()
      expect(cueSoundUrl(name)).toContain('.mp3')
    }
  })

  it('keeps the countdown on a distinct sound from the phase change', () => {
    // Three ticks then a different tone is what makes an approaching
    // transition audible rather than just louder.
    expect(CUE_SOUNDS.countdown).not.toBe(CUE_SOUNDS['phase-change'])
  })
})
