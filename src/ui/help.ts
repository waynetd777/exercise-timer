import type { HelpSection } from './HelpTray'

/**
 * The help text, kept out of the screens that show it.
 *
 * Data, not markup. A point can be added without touching a component, and the
 * two trays cannot drift into two different voices. Every line describes
 * something the app actually does. A help tray that overstates is worse than no
 * help at all, because it is believed.
 *
 * Written as bullets on purpose. Help is read mid-task, standing up, looking for
 * one answer. A paragraph has to be finished before it pays out. A bullet does
 * not.
 */
export const LIBRARY_HELP: readonly HelpSection[] = [
  {
    heading: 'Your routines',
    points: [
      'Tap a routine to open it, then Start.',
      'The star pins a favourite to the top of the list.',
      'Each row also edits, duplicates, copies a share link, exports itself as a file, and deletes.',
      'Delete asks first, in the row itself. Nothing goes without a second tap.',
      'Search filters by name. Sort by Recent, Name or Longest.',
    ],
  },
  {
    heading: 'Adding a routine',
    points: [
      'New: build one step at a time.',
      'Paste: write or paste a routine as plain text.',
      'Import: a .tabata file, an exported .json, or a plain-text routine. Dropping a file anywhere on this screen does the same. A .tabata routine picks up the app’s own illustrations as it comes in.',
      'Export all: every routine in one file, with the photos you uploaded inside it.',
      'A routine’s own file button exports just that one, photos included. That file is how a routine moves between devices intact: export, AirDrop, then Import on the other one.',
      'A share link carries the steps and the app’s own illustrations. It cannot carry a photo you uploaded, because a picture will not fit in a link. Send the file for that.',
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
      'The exercise illustrations come with the app, so they need no connection at all.',
    ],
  },
]

export const EDITOR_HELP: readonly HelpSection[] = [
  {
    heading: 'Steps',
    points: [
      'Add a step with Get ready, Work, Rest or Recover. The type sets its colour and which cue it sounds.',
      'Every kind has its own colour. The bar on an add button matches the edge of the row it makes.',
      'The unit beside the number: s counts seconds, × waits for Next, × each side counts per side.',
      'On a narrow screen a step shows its fields and one ⋯ button, which opens the rest of its controls. On a wide screen they are all on the row already.',
      'Each row can move up or down, duplicate itself, add a step below, or delete.',
      'The note button adds a note or an alternative exercise. In a list, the alternative reads “or …” beside the step, and the note shows on the step you are on.',
      'The image button gives a step its picture: one of the illustrations that come with the app, a photo on this device, or an image you have copied.',
      'Paste from clipboard is greyed out when there is nothing to paste. On iPhone and iPad it stays available, because Safari will not say what is on the clipboard until you tap — so tap it, and it will tell you if it finds nothing.',
      'Once a step has a picture, that button becomes the picture. Tap it to see it full size, or to remove it.',
      'Steps listed inside a section get no image. A list has no room for a picture, so only steps that run as a countdown have one.',
    ],
  },
  {
    heading: 'Groups',
    points: [
      'Reps repeats everything inside it. While running it reads “Reps 3 of 8”, or the name you give the group.',
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
      'The swatch tints this screen as you pick, and tints the routine’s row in the library.',
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
