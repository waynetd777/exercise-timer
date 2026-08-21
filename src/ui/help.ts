import type { HelpSection } from './HelpTray'

/**
 * The help text, kept out of the screens that show it.
 *
 * Data, not markup, so a point can be added without touching a component, and
 * so the two trays cannot drift into two different voices. Every line describes
 * something the app actually does — a help tray that overstates is worse than
 * none, because it is believed.
 *
 * Written as bullets on purpose. Help is read mid-task, standing up, looking for
 * one answer: a paragraph has to be finished before it pays out, and a bullet
 * does not.
 */
export const LIBRARY_HELP: readonly HelpSection[] = [
  {
    heading: 'Your routines',
    points: [
      'Tap a routine to open it, then Start.',
      'The star pins a favourite to the top of the list.',
      'Each row also edits, duplicates, copies a share link, and deletes.',
      'Delete asks first, in the row itself — nothing goes without a second tap.',
      'Search filters by name. Sort by Recent, Name or Longest.',
    ],
  },
  {
    heading: 'Adding a routine',
    points: [
      'New — build one step by step.',
      'Paste — write or paste a routine as plain text; it opens with five seconds to get ready.',
      'Import — a .tabata file, an exported .json, or a plain-text routine. Dropping a file anywhere on this screen does the same.',
      'Export — every routine in one file, images included. That file is how a routine moves between devices intact.',
      'A share link carries the steps but not the images, so it stays short enough to send.',
    ],
  },
  {
    heading: 'While it runs',
    points: [
      'Space starts and pauses. ← and → step back and forward. M mutes. K works like Space.',
      'Three beeps lead every boundary: a whistle into work, a bell out of it.',
      'A counted step waits for Next, and shows its whole group so you can see what is coming.',
      'The clock in the header is time since you started, pauses excluded.',
      'The screen is kept awake while a routine runs, where the browser allows it.',
    ],
  },
  {
    heading: 'Offline and storage',
    points: [
      'Routines live on this device. Nothing is uploaded and there is no account.',
      'Installing the app to the home screen makes it work with no signal.',
      'Save images stores a copy of every linked illustration here, for a gym with no reception.',
    ],
  },
]

export const EDITOR_HELP: readonly HelpSection[] = [
  {
    heading: 'Steps',
    points: [
      'Add a step with Get ready, Work, Rest or Recover. The type sets its colour and which cue it sounds.',
      'Every kind has its own colour: the bar on an add button matches the edge of the row it makes.',
      'The unit beside the number: s times the step, × waits for Next, × each side counts per side.',
      'The note button, beside a step’s reps or seconds, adds a note or an alternative exercise. In a list, the alternative reads “or …” beside the step and the note shows on the step you are on.',
      'Each row can move up or down, duplicate itself, add a step below, or delete.',
      'A step carries one image: paste a link, pick one already used in your routines, or upload a photo.',
      'Steps listed inside a section have no image field — a list has no room for a picture, so only steps that run as a countdown offer one.',
    ],
  },
  {
    heading: 'Groups',
    points: [
      'Reps repeats everything inside it, captioned “Reps 3 of 8” while running — or whatever you name the group.',
      'A row’s buttons always read the same way: add, move up, move down, group or ungroup, duplicate, delete.',
      'The reps button on a step wraps that one step in a group of its own.',
      'Ladder changes the count each time round: 5-10-15. A step set to rung takes its number from the ladder.',
      'Section is a named part of the routine, shown as a list while running.',
      'Ungroup, on a reps group, keeps the steps and drops the repeat.',
      'A rest inside a group does not run after the last round. To rest at the end too, put a rest step after the group.',
    ],
  },
  {
    heading: 'Colour',
    points: [
      'The swatch tints this screen as you pick, and the routine’s row in the library.',
      'The circle with a line through it clears the colour.',
    ],
  },
  {
    heading: 'Saving',
    points: [
      'Save keeps the changes and returns to your routines.',
      'Back asks before discarding them, and only when there is something to lose.',
      'Undo and redo, or Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. Typing counts as one step, not one per letter.',
      'The bar shows the routine’s total time and step count as you edit.',
    ],
  },
]
