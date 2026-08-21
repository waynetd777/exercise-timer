import { describe, expect, it } from 'vitest'
import { shortcutApplies } from '../keys'

describe('shortcutApplies — which keys the run screen may take', () => {
  it('takes everything when nothing is focused', () => {
    for (const key of [' ', 'k', 'm', 'ArrowRight', 'ArrowLeft', 'Enter']) {
      expect(shortcutApplies(undefined, key), key).toBe(true)
      expect(shortcutApplies('BODY', key), key).toBe(true)
    }
  })

  it('still takes the arrows while a button has focus', () => {
    /*
     * The bug this exists for: clicking Play leaves the button focused, and the
     * old rule ignored EVERY key while a button had focus — so skipping silently
     * stopped working unless the routine had been started with the spacebar.
     */
    expect(shortcutApplies('BUTTON', 'ArrowRight')).toBe(true)
    expect(shortcutApplies('BUTTON', 'ArrowLeft')).toBe(true)
    expect(shortcutApplies('BUTTON', 'm')).toBe(true)
    expect(shortcutApplies('BUTTON', 'k')).toBe(true)
  })

  it('leaves Space and Enter to the button they would activate', () => {
    // Or the press does two things: the button's action and play/pause.
    expect(shortcutApplies('BUTTON', ' ')).toBe(false)
    expect(shortcutApplies('BUTTON', 'Enter')).toBe(false)
  })

  it('leaves every key to a field or a select', () => {
    // Typing must not fire a shortcut, and a select's arrows change its value.
    for (const tag of ['INPUT', 'SELECT', 'TEXTAREA']) {
      for (const key of [' ', 'm', 'ArrowRight', 'Enter']) {
        expect(shortcutApplies(tag, key), `${tag} ${key}`).toBe(false)
      }
    }
  })
})
