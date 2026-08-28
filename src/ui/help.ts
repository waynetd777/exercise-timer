/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

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
      'Preview, in the row or on the Ready card, reads the whole routine end to end before you start it. Every round is written out in the order it will run, with the pictures, the weights and the how-to for each step. The list button in the top corner opens and closes it.',
      'The pencil beside it opens the routine in the editor, from the Ready card or from the reading. It goes once a routine is running: the way out then is Back, which pauses and asks first.',
      'The star pins a favourite to the top of the list.',
      'Exercises, in the ⋯ menu, is where each exercise’s picture and weight live. A step that carries neither takes both from there, so a photo taken once shows up in every routine that names the exercise.',
      'Paste and Generate both open in the editor rather than saving. Nothing is in your library until you save it there, so a routine you do not like costs you a Back.',
      'Each row also previews, edits, duplicates, sends itself, and deletes. Send offers all four ways: a share link, plain text, a text file, or a backup including images.',
      'Delete asks first, in the row itself. Nothing goes without a second tap.',
      'Search filters by name. Sort by Recent, Name or Longest.',
    ],
  },
  {
    heading: 'Adding a routine',
    points: [
      'New: build one step at a time.',
      'Paste: write or paste a routine as plain text. It reads sections, rounds, ladders, EMOM minutes, 30/30 intervals and AMRAPs, and lists any line it could not place. It then opens in the editor, so you can fix what it missed before keeping it.',
      'A generated routine announces the next exercise and its weight before the gap, so you can set the machine up. That announcement is 30 seconds for a multi-gym exercise and 15 for anything else, because a press-up has nothing to rig.',
      'The get-ready just before a set is 20 seconds where something has to be put on, a band or the ankle cuff, and 15 where it does not.',
      'A multi-gym set asks for 12 reps inside 20 seconds, so the clock paces you and the count is the target. It reads as “12 × Leg Press 65kg” while you work out.',
      'A routine of counted reps has no fixed length, so it says “about 35 min” where a timed routine gives an exact time. The library row, the editor and the Ready card all say it. The estimate starts from a built-in pace for each exercise, read off routines that write it both ways: a 30-second Plank in one, 20 × Plank in another.',
      'It then learns your pace. Every self-paced step already times itself while you work out, so after three sets of something the estimate uses your own time for it rather than the average. Tapping quickly through a routine to see what is in it is ignored, so a dry run does not teach it that a set takes two seconds.',
      'Leave the name empty and it is called after what you asked for: “Full-Body Circuit, 45 min”, “Bodyweight Legs & Core, 6 sections”. The box shows what it would be while you are still choosing.',
      'Shape decides the rest of the questions. Circuit is one exercise at a time with everything on a clock, so it can be asked how long. Sections is the shape a written-out routine usually takes: a warm-up, named sections of ladders and rounds, a finisher. Those end when you tap through them, so the length is an estimate: whole sections are fitted to the minutes asked, and the ones that did not fit are named.',
      'Generate: answer a few questions and it builds a routine. How long, what to work, whether to keep moving between sets and how, and what equipment. It shows what it will make as you answer, and opens in the editor.',
      'Warm up with, Moving how and Cool down with are each chosen separately, so the ten minutes at the start need not be the same thing as the minutes between sets. Each has its own length in seconds beside it, starting at 600, 60 and 120. All three go when you choose to rest between sets instead, leaving just how long to rest for.',
      'Moving how can be one thing throughout, cycling or the trampoline, or Random, which puts a different exercise in every minute between sets. Random then offers the whole list to choose from, all on, so you can turn off anything you do not want coming up. The warm-up and the cool down stay as they are: ten minutes of one thing is what a warm-up is.',
      'Copy template, in the paste box, puts an example routine on the clipboard using every shape it understands. Easier than being told the rules.',
      'Import: a .tabata file, an exported .json, or a .txt or .md written as text. Dropping a file anywhere on this screen does the same. A .tabata routine picks up the app’s own illustrations as it comes in.',
      'Tidy exercise names renames steps to the names the app knows an exercise by, so “Seated Ab Crunch” becomes “Seated Abdominal Crunch” and the weights page can answer for it. Counts, weights and anything in brackets are kept exactly as they are, and a name it cannot place is left alone. It appears only when there is something to fix.',
      'Backup all incl. images: every routine in one file, with the images you uploaded inside it, and the whole Exercises page: every weight and every picture. A backup is the only one that carries everything, so it is the one to keep.',
      'Send › Backup incl. images backs up one routine. That file is how a routine moves between devices intact: back it up, AirDrop it, then Import on the other one. It carries the weights, and the exercise pictures that routine actually uses, rather than every photo on the page.',
      'A share link carries the steps and the app’s own illustrations. It cannot carry an image you uploaded, because a picture will not fit in a link. Send a backup for that.',
      'Send › Copy as text writes the routine out in the same format Paste reads, so you can put it in an email. It carries no pictures at all, and it says what it had to leave behind. Text is for sending to a person; a backup is for keeping.',
    ],
  },
  {
    heading: 'Exercises',
    points: [
      'Routines › Exercises is where each exercise’s picture and weight are written down, one of each per exercise. A routine that states neither of its own uses them, so moving up a plate is one edit rather than seven, and a photo taken once appears everywhere. That page has its own help.',
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
      'The unit beside the number: s counts seconds, × waits for Next, × each side counts per side, and × in does both, for a minute that also has a target.',
      'A Work step’s name offers the exercises the app knows, illustrated where the guide draws them. The arrow beside the field opens the list on the exercise the step is already on, ticked, so you can see which one it is. Type to search it instead: names, part-names and the app’s own spellings all find their exercise.',
      'On an empty step, or one named something the table does not hold, the same arrow shows the whole list grouped by kit. Typing your own name is always fine — Warm Up is not an exercise and never will be.',
      'Picking one off the list brings its picture and, where the exercise is worked one side at a time, sets the count to each side. It also spells the name the way the weights page and the pace estimate know it, so both can answer for the step. One undo takes the whole pick back.',
      'On a narrow screen a step shows its fields and one ⋯ button, which opens the rest of its controls. On a wide screen they are all on the row already.',
      'Each row can be dragged by its grip to reorder, or focused and moved with the arrow keys. It can also duplicate itself, add a step below, or delete.',
      'The note button adds a note, an alternative exercise, or a weight. In a list, the alternative reads “or …” beside the step, and the note shows on the step you are on.',
      'Weight is free text: 65kg, 30kg each side, red band, bodyweight. It reads after the exercise while you work out, so “Leg Press” loaded to “65kg” shows as “Leg Press 65kg”. Weights that used to be typed into the step name are moved into the field for you.',
      'Leaving it empty does not mean unloaded. It means “whatever I lift for this”, and the weight comes from Routines › Exercises when the routine runs. The placeholder shows what that would be. Typing here overrides it, for this routine only.',
      'The image button gives a step its picture: one of the illustrations that come with the app, a photo on this device, or an image you have copied.',
      'A step that has none shows what Routines › Exercises holds for the exercise it names, faintly, marked “from the Exercises page”. Tap it to see where it comes from, or to give this step a picture of its own instead. That override is this routine’s alone, exactly like a weight typed into the step.',
      'Paste from clipboard is greyed out when there is nothing to paste. On iPhone and iPad it stays available, because Safari will not say what is on the clipboard until you tap. Tap it, and it will tell you if it finds nothing.',
      'Once a step has a picture, that button becomes the picture. Tap it to see it full size, or to remove it.',
      'Steps listed inside a section get no image. A list has no room for a picture, so only steps that run as a countdown have one.',
    ],
  },
  {
    heading: 'Groups',
    points: [
      'Sets repeats everything inside it. While running it reads “Set 3 of 8”, or the name you give the group.',
      'A row’s buttons always read the same way: add, group or ungroup, duplicate, delete.',
      'The sets button on a step wraps that one step in a group of its own.',
      'Ladder changes the count each time round: 5-10-15. A step set to rung takes its number from the ladder. While running it reads “Rung 2 of 3”.',
      'Section is a named part of the routine, shown as a list while running.',
      'Ungroup, on a sets group, keeps the steps and drops the group.',
      'A rest inside a group does not run after the last set. To rest at the end too, put a rest step after the group.',
    ],
  },
  {
    heading: 'Reading it',
    points: [
      'The list button in the top corner reads the draft end to end, the same way Preview reads a saved routine: every round written out, with the pictures, the weights and the how-to. It reads what is on screen, unsaved changes included.',
      'The same button, now a ×, goes back to editing. Nothing is saved or discarded on the way in or out.',
      'On the Ready card, the pencil beside Preview opens the routine you are about to run in the editor.',
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
      'Every exercise the app knows, with what it looks like and what you lift for it. Both belong to your gym rather than to a routine: written into each routine instead, moving up a plate or taking a better photo means editing every routine that names the exercise.',
      'All 147 are listed, not only the ones you can put a number against, because a press-up has no weight and still has a picture. The weight field simply does not appear on a row with nothing to weigh.',
      'A weight is free text, so a band can be “red” and a dumbbell exercise “5kg each hand”. Anything you would write on a step, you can write here.',
    ],
  },
  {
    heading: 'How a routine uses them',
    points: [
      'A step that states no weight of its own is not unloaded. It means “whatever I lift for this”, and it reads this page every time the routine is opened, so changing a number here changes every routine that does not disagree.',
      'A step with no picture of its own works the same way: it shows whatever this page has for the exercise it names. So a photo taken once appears in every routine that uses that exercise, including the ones you wrote before you took it.',
      'A step that DOES state a weight, or carry a picture, keeps it. That is an override, and a deliberate one: it is the routine saying that today, on purpose, this is not the usual.',
      'So in the editor, the Weight field is empty by default and its hint shows what this page would supply, and a step with no picture shows this page’s, faintly, with “from the Exercises page” on it. Both are followed until the step says otherwise.',
      'Routines written before this page state a weight on every step, so they override it. “Let n routines follow these” clears the ones this page can answer for, in one go. A step for an exercise with nothing set here keeps what it has, since the routine is then the only record of it.',
    ],
  },
  {
    heading: 'Pictures',
    points: [
      'The multi-gym exercises start with the illustration from the manufacturer’s guide, 41 of them, and the bike has a photo of its own. Everything else starts with an empty frame: the guide only draws the machine.',
      'Tap a picture to see it full size, which is the quickest way to find out what an exercise you have not done before actually is. Tap an empty frame to add one.',
      'Change offers the same three ways the editor does: an illustration that ships with the app, a photo from this device, or an image you have copied. A photo is scaled down before it is stored, so a page of them is a few megabytes rather than a few hundred.',
      'On an exercise the guide draws, removing your photo puts the guide’s drawing back. On one it does not, removing leaves an empty frame again.',
    ],
  },
  {
    heading: 'Filling in the weights',
    points: [
      'Every field starts blank on purpose. An empty field asks the question; a guessed one answers it wrongly and gets loaded on.',
      'Fill from my routines takes the weight your saved routines already use for anything still blank. Better evidence than any website, and it shows you what it would take before you tap it.',
    ],
  },
  {
    heading: 'Keeping them',
    points: [
      'They live on this device, like the sound and pace settings, not inside a routine.',
      'They ride along in a backup, photos included, and are merged back in on restore, with the file winning where both say something.',
      'They are not in a shared link or a text file. A link carries the app’s own illustrations but not a photo, and text carries the weight in force at the moment it was written, since there is no way to write “whatever I lift” into a routine someone else is going to read.',
    ],
  },
]
