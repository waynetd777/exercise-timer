import type { CueKind } from '../engine'

import beep from './cues/beep.mp3?url'
import bell from './cues/bell.mp3?url'
import click from './cues/click.mp3?url'
import dingDong from './cues/ding-dong.mp3?url'
import electronicStab from './cues/electronic-stab.mp3?url'
import fingerSnap from './cues/finger-snap.mp3?url'
import tenSecondsLeft from './cues/ten-seconds-left.mp3?url'
import waterDrop from './cues/water-drop.mp3?url'
import win from './cues/win.mp3?url'
import xylophone from './cues/xylophone.mp3?url'

/**
 * Cue sounds taken from the Tabata Timer app (com.alexandersergienko.TabataTimer)
 * so this timer sounds like the one Wayne already trains to.
 *
 * Imported as modules rather than read from `public/`, so a missing or renamed
 * file breaks the BUILD instead of going silent at runtime, and each file gets
 * a content-hashed URL for free.
 *
 * NOTE ON REUSE: these are third-party assets from a commercial app. Fine on a
 * private page for personal use; do not publish the site publicly with them
 * still in place. That interacts with the hosting decision — GitHub Pages on a
 * private repo publishes a PUBLIC site, an access-controlled host does not.
 * Replacing them is a matter of swapping the files: the synthesised fallback in
 * `tones.ts` covers every cue on its own.
 */
export const CUE_SOUND_URLS = {
  // Short, for countdown ticks.
  click,
  beep,
  'water-drop': waterDrop,
  'finger-snap': fingerSnap,
  // Longer, for a phase change.
  bell,
  'ding-dong': dingDong,
  xylophone,
  'electronic-stab': electronicStab,
  // Finishers and spoken cues.
  win,
  'ten-seconds-left': tenSecondsLeft,
} as const

export type CueSoundName = keyof typeof CUE_SOUND_URLS

/**
 * Which sound plays for which cue. The whole feel of the timer is this object,
 * so changing it is a one-line edit.
 *
 * All three countdown blips use the SAME sound, as the app does — the earlier
 * synthesised version rose in pitch, which was a nicer idea but not the ask.
 */
export const CUE_SOUNDS: Record<CueKind, CueSoundName> = {
  countdown: 'beep',
  'phase-change': 'bell',
  'workout-complete': 'win',
}

/** Per-cue level: the source files are not mastered against each other. */
export const CUE_GAIN: Record<CueKind, number> = {
  countdown: 0.7,
  'phase-change': 0.9,
  'workout-complete': 1,
}

export function cueSoundUrl(name: CueSoundName): string {
  return CUE_SOUND_URLS[name]
}
