/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { HelpSection } from './HelpTray'
import { EXERCISES } from '../routines/exercises'

/** How many multi-gym exercises the guide illustrates. Counted, not typed: the typed count drifted twice. */
const DRAWN = EXERCISES.filter((exercise) => exercise.equipment === 'machine' && exercise.media !== undefined).length

/**
 * The help text, kept out of the screens that show it.
 *
 * Data, not markup. A point can be added without touching a component, and the
 * three trays cannot drift into three different voices.
 *
 * House style: short bullets, plain words, one idea per line. Help is read
 * mid-task, standing up, looking for one answer. Every line must describe
 * something the app really does, because help that overstates is believed.
 */
export const LIBRARY_HELP: readonly HelpSection[] = [
  {
    heading: 'Your routines',
    points: [
      'Tap a routine to open it, then Start.',
      'Preview reads a routine out before you run it. Every round in order, with the pictures, weights and how-to. The list button in the top corner opens and closes it.',
      'The pencil opens the routine in the editor.',
      'The star pins a favourite to the top.',
      'Search by name. Sort by Recent, Name or Longest.',
      'Each row can preview, edit, duplicate, send or delete. Delete always asks first.',
    ],
  },
  {
    heading: 'Adding a routine',
    points: [
      'New: build one step at a time.',
      'Paste: paste or type a routine as plain text. It reads sections, rounds, ladders, EMOM minutes, 30/30 intervals and AMRAPs, and lists any line it could not place.',
      'Copy template, in the paste box, puts an example on your clipboard using every shape it understands. Easier than reading the rules.',
      'Generate: answer a few questions and it builds one for you.',
      'Import: a .tabata file, a backup .json, or a .txt written as text. Dropping a file on this screen does the same.',
      'Paste, Generate and Import all open in the editor. Nothing joins your library until you tap Save there.',
      'Tidy exercise names, in the ⋯ menu, puts step names back to the ones the app knows, so weights and pictures can find them. Counts, weights and brackets are left alone. It only appears when there is something to fix.',
    ],
  },
  {
    heading: 'Generating one',
    points: [
      'Shape comes first. Circuit is one exercise at a time, all on a clock. Sections is the usual written routine: a warm-up, named sections of rounds and ladders, a finisher.',
      'Then choose how long, what to work, and what kit you have. It shows what it will make as you answer.',
      'Warm up with, Moving how and Cool down with are picked separately, each with its own length. They start at 10 min, 60s and 2 min.',
      'Moving how can be one thing throughout, or Random for a different exercise every minute between sets. Random lets you turn off anything you would rather not see.',
      'Choosing to rest between sets instead replaces all three with a single rest length.',
      'It leaves out any weight your Exercises page can supply, so the routine follows what you lift today.',
      'Leave the name blank and it names itself after what you asked for, like “Full-Body Circuit, 45 min”. The box shows what that would be while you choose.',
      'A generated routine announces the next exercise and its weight before the gap, so you can set the machine up. 30 seconds for a multi-gym exercise, 15 for anything else.',
      'The get-ready before a set is 20 seconds where something has to go on, a band or the ankle cuff, and 15 where it does not.',
    ],
  },
  {
    heading: 'Exercises',
    points: [
      'Routines › Exercises holds one picture and one weight per exercise.',
      'Any step that gives neither of its own uses them. So moving up a plate is one edit, and a photo taken once shows up in every routine that names the exercise.',
      'That page has its own help.',
    ],
  },
  {
    heading: 'While it runs',
    points: [
      'Space starts and pauses, and so does K. ← and → step back and forward. M mutes.',
      'Three beeps lead every change: a whistle into work, a bell out of it.',
      'A counted step waits for Next, and shows its whole group so you can see what is coming.',
      'The clock in the header is time since you started, pauses left out.',
      'The screen stays awake while a routine runs, where the browser allows it.',
      'A routine of counted reps has no fixed length, so it says “about 35 min” rather than an exact time. It learns your real pace after a few sets, and ignores you tapping quickly through to see what is in it.',
    ],
  },
  {
    heading: 'Sending and backing up',
    points: [
      'Send offers four ways: a share link, plain text, a .txt file, or a backup.',
      'A backup carries everything: steps, weights and pictures. It is the one to keep, and the way to move a routine between devices. Back it up, AirDrop it, then Import on the other one.',
      'A share link carries the steps and the app’s own drawings, but not a photo you added. A picture will not fit in a link.',
      'Copy as text writes the routine in the same format Paste reads, so you can email it. It carries no pictures, and it tells you what it left out.',
      'Backup all incl. images, in the ⋯ menu, saves your whole library and your whole Exercises page in one file.',
    ],
  },
  {
    heading: 'Offline and storage',
    points: [
      'Your routines live on this device. Nothing is uploaded and there is no account.',
      'Add the app to your home screen and it works with no signal.',
      'The exercise drawings come with the app, so they need no connection at all.',
    ],
  },
]

export const EDITOR_HELP: readonly HelpSection[] = [
  {
    heading: 'Steps',
    points: [
      'Add a step with Get ready, Work, Rest or Recover. Each type has its own colour and its own cue, and the bar on an add button matches the row it makes.',
      'The unit beside the number: s counts seconds, × waits for Next, × each side counts per side, and × in does both.',
      'A Work step’s name suggests exercises the app knows. Type to search, or tap the arrow for the full list.',
      'Picking one off the list spells the name the app’s way, so the step gets that exercise’s picture and weight. One undo takes the whole thing back.',
      'Typing your own name is always fine. Warm Up is not an exercise and never will be.',
      'Drag a row by its grip to move it, or focus it and use the arrow keys.',
      'Each row can also duplicate itself, add a step below, or delete.',
      'On a narrow screen, ⋯ opens the rest of a row’s controls. On a wide one they are all there already.',
    ],
  },
  {
    heading: 'Weights, notes and pictures',
    points: [
      'The note button adds a note, an easier alternative, or a weight. An alternative reads “or …” beside the step.',
      'Weight is free text: 65kg, 30kg each side, red band, bodyweight. It reads after the name while you run, so “Leg Press 65kg”.',
      'An empty weight does not mean unloaded. It means “whatever I lift for this”, and comes from Routines › Exercises. The hint shows what that would be.',
      'Typing a weight here overrides that page, for this routine only.',
      'The image button gives a step a picture: one that ships with the app, a photo from this device, or an image you have copied.',
      'A step with no picture shows the Exercises page’s, faintly. Tap it to see where it came from, or to give this step one of its own.',
      'Once a step has a picture, that button becomes the picture. Tap it to see it full size or remove it.',
      'Steps inside a section get no picture. A list has no room for one.',
    ],
  },
  {
    heading: 'Groups',
    points: [
      'Sets repeats everything inside it. It reads “Set 3 of 8” while running, or the name you give it.',
      'Ladder changes the count each time round: 5-10-15. A step set to rung takes its number from the ladder, and it reads “Rung 2 of 3”.',
      'Section is a named part of the routine, shown as a list while running.',
      'The sets button on a step wraps just that step in a group.',
      'A row’s buttons always read the same way: add, group or ungroup, duplicate, delete.',
      'Ungroup keeps the steps and drops the group.',
      'A rest inside a group does not run after the last set. Put a rest after the group to rest at the end too.',
    ],
  },
  {
    heading: 'Reading it back',
    points: [
      'The list button in the top corner reads your draft end to end, the same way Preview reads a saved routine. It reads what is on screen, unsaved changes included.',
      'The same button, now a ×, takes you back to editing. Nothing is saved or lost on the way in or out.',
    ],
  },
  {
    heading: 'Colour',
    points: [
      'The swatch tints this screen as you pick, and tints the routine’s row in your library.',
      'The circle with a line through it clears the colour.',
    ],
  },
  {
    heading: 'Saving',
    points: [
      'Save keeps your changes and goes back to your routines.',
      'Back asks first, and only when there is something to lose.',
      'Undo and redo, or Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. Typing counts as one step, not one per letter.',
      'The bar shows the total time and step count as you edit.',
    ],
  },
]

/**
 * The exercises page.
 *
 * Its own tray rather than a section of the library's, because the page is the
 * one place in the app where an EMPTY field means something, and that is not a
 * detail to bury deep in someone else's list.
 */
export const EXERCISES_HELP: readonly HelpSection[] = [
  {
    heading: 'What this is',
    points: [
      'Every exercise the app knows, with its picture and what you lift for it.',
      'Both belong to your gym, not to one routine. Kept in each routine instead, a new plate or a better photo would mean editing every routine that names the exercise.',
      `All ${EXERCISES.length} are listed, because a press-up has no weight and still has a picture. The weight field only shows on a row with something to weigh.`,
      'A weight is free text, so a band can be “red” and a dumbbell exercise “5kg each hand”.',
    ],
  },
  {
    heading: 'How a routine uses them',
    points: [
      'A step with no weight of its own is not unloaded. It means “whatever I lift for this”, and it reads this page every time the routine opens. Change a number here and every routine that does not disagree changes with it.',
      'Pictures work the same way. A photo taken once appears in every routine that uses the exercise, including ones you wrote before you took it.',
      'A step that does state a weight, or carry a picture, keeps it. That is a deliberate override: this routine saying today is not the usual.',
      'Older routines state a weight on every step, so they override everything. “Let n routines follow these” clears the ones this page can answer for, in one go. Anything with nothing set here is left alone.',
    ],
  },
  {
    heading: 'Pictures',
    points: [
      `The multi-gym exercises start with the drawing from the manufacturer’s guide, ${DRAWN} of them, and the bike has a photo.`,
      'Everything else starts with an empty frame, because the guide only draws the machine.',
      'Tap a picture to see it full size. It is the quickest way to find out what an exercise actually is.',
      'Tap an empty frame to add one.',
      'Change offers three ways: a drawing that ships with the app, a photo from this device, or an image you have copied. Photos are scaled down first, so a full page of them is a few megabytes.',
      'Removing your photo puts the guide’s drawing back, where there is one. Otherwise the frame goes empty again.',
    ],
  },
  {
    heading: 'Filling in the weights',
    points: [
      'Every field starts blank on purpose. An empty field asks the question. A guessed one answers it wrongly and gets loaded onto the bar.',
      'Fill from my routines takes the weights your saved routines already use for anything still blank. It shows you what it would take before you tap it.',
    ],
  },
  {
    heading: 'Keeping them',
    points: [
      'They live on this device, like your sound and pace settings, not inside a routine.',
      'They ride along in a backup, photos included, and merge back in on restore. Where both say something, the file wins.',
      'They are not in a share link or a text file. A link cannot carry a photo, and text carries whatever weight applied when it was written.',
    ],
  },
]
