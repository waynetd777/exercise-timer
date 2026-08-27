# Exercise Timer

An interval timer for gym routines. Runs in the browser, installs to a phone home
screen, and works offline.

**Live: https://waynetd777.github.io/exercise-timer/**

To use the app, open that link. There is nothing to clone, install or build. It
runs entirely in the browser, and on a phone you can add it to the home screen
from the browser's share menu and it will work offline after that. The
instructions further down are for working on the code, not for using the app.

Built for one job: telling someone mid-effort how much longer to keep going, from
across a gym, with the phone propped against a rack.

## What it looks like

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/run-timed.webp" width="420" alt="A timed step running: a large red 9:45 countdown above the step name Warm Up, the time left and step number, the exercise illustration below it, and the next step named underneath." />
      <br /><b>A timed step.</b> The number is sized to be read from across a room,
      and the illustration says which machine without a word.
    </td>
    <td width="50%">
      <img src="docs/screenshots/run-list.webp" width="420" alt="A rep-based round shown as a list: Set 4 of 9, 12 reps, five exercises each with its count, one carrying a lower-impact alternative, and a full-width Next button." />
      <br /><b>A rep-based round.</b> The whole set is on screen at once and one Next
      clears it, because you do not tap through a round with your hands full.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/library.webp" width="420" alt="The routine library: a search box, sort and routines menus, and rows showing each routine's name, total time, step count and last run, with a star on the favourite and a colour tint per routine." />
      <br /><b>The library.</b> Favourites pin to the top, and a routine's own colour
      makes it findable at a glance.
    </td>
    <td width="50%">
      <img src="docs/screenshots/editor.webp" width="420" alt="The editor: rows of steps with a type, a name and a duration, a group holding two of them, the per-row controls panel open showing an image thumbnail and a note button, and coloured add buttons along the bottom." />
      <br /><b>The editor.</b> Steps, sets, ladders and sections, with undo. The
      coloured edge on each row is the step type, and the add buttons match it.
    </td>
  </tr>
</table>

---

## What it does

- **Runs a timed routine.** A big countdown, a colour-coded phase, the exercise
  illustration beside it, and audio cues that stay on the beat even after the
  phone has been in a pocket.
- **Runs a rep-based one too.** A strength session is mostly not timed, so a step
  can wait for you. The whole round or ladder rung is on screen at once and one
  Next clears it. Timed steps mixed in, like a 45-second rest or a 30-second
  plank, still count themselves down.
- **Holds a library** of routines in the browser, searchable, with favourites and
  a colour per routine.
- **Takes a routine as pasted text,** which is how they arrive. An email from a
  gym instructor is parsed into sections, rounds, ladders, EMOM minutes, 30/30
  intervals and AMRAPs, and any line it could not place is reported before
  anything is saved. See [the paste format](docs/paste-format.md) for what it
  reads, with an example using every part of it.
- **Imports** the `.tabata` exports of the Tabata Timer app, its own backups, and
  plain-text routines.
- **Edits** routines: steps, durations, sets, ladders, sections and images, with
  undo.
- **Sends** a routine three ways: a link, plain text, or a `.txt` in the format it
  can paste back. None of them carries a picture, so each says what it had to
  leave behind rather than dropping it quietly.
- **Backs up** one routine or the whole library to a `.json`, images included.
  It is the only format that carries everything, so it is the one to keep.
- **Owns its images.** It stores local copies, so a routine survives gym wifi and
  the image host eventually losing a file.

## Running it locally

Only needed if you want to change the code. To just use the timer, use the live
link above.

```bash
npm install
npm run dev        # http://localhost:35173
npm test           # 637 tests, no browser needed
npm run typecheck
npm run build
```

`npm run dev` also unlocks the sound bench, at Routines then Sounds. It plays
every cue as the full figure and as its terminal sound alone, with the parameters
printed beside it. It is dev-only and compiled out of a production build.

Deployment is automatic. A push to `main` builds and publishes to GitHub Pages,
gated on typecheck and tests, because a broken timer is worse than a stale one.
Pages serves from a subpath, so `VITE_BASE` is set in the workflow and every
bundled asset path goes through `import.meta.env.BASE_URL`.

## How it is put together

One principle runs through the whole codebase: **the difficult logic is pure, and
React is a thin shell over it.** Anything with rules worth arguing about is a
plain function over plain data, tested without a DOM. That covers the run clock,
the timeline compiler, the block tree, undo, the library ordering and the orphan
sweep. The components wire those functions to state and markup and do little
else.

This is not architectural taste for its own sake. Every hard bug in this project
lived in exactly those rules, and they are only cheap to test when they are not
tangled up in a component.

```
src/
  engine/     The timer core: routine -> runs -> position. No React, no DOM.
  state/      The run clock, and the React hooks that drive a workout.
  audio/      Cues, pre-scheduled on the Web Audio clock.
  editor/     Pure operations on a routine's block tree, plus undo.
  media/      Images: content-addressed storage, downscaling, offline pinning.
  storage/    IndexedDB, the library, the backup format, share links, read-time migration.
  routines/   The .tabata importer, the paste parser, the seed, the image catalogue.
  ui/         Screens, the type scale, the design tokens.
```

Each folder has its own README covering the decisions behind it.

## The decisions that matter

**Time is derived, never counted.** The clock stores `{ startedAt, pausedTotalMs }`
and computes elapsed from `performance.now()`. Nothing accumulates ticks, so a
throttled tab, a backgrounded phone or a ten-minute pocket cannot cause drift.
Coming back simply tells the truth.

**A routine compiles to a flat timeline once.** `compile()` expands the recursive
tree of steps, rounds and ladders into absolute-time entries, and the runner is
then a pure binary search over it. That makes seeking and skipping trivial, and
the whole engine testable against a fake clock.

**A routine that waits is a sequence of timed runs separated by gates.** Not every
step has a duration: a rep-based one ends when you tap Next. Inside a run nothing
changes, so an absolute timeline, a binary search, pre-scheduled cues and a
pocketed phone catching up all still apply. At a gate the clock parks until you
tap. A fully timed routine compiles to exactly one run and behaves as it always
did.

**Cues are scheduled ahead on the audio clock,** never fired from a JavaScript
tick, because the audio thread keeps time when the main thread is throttled. Each
boundary sounds like what it means: three beeps then a **whistle** into work,
three beeps then a **bell** out of it, three beeps then a triple **ding** at the
end. Everything but the whistle is synthesised from measurements of the app Wayne
already trains to. The whistle is a CC0 recording, which measurement showed to be
the very recording that app plays.

**The UI is sized for viewing distance, not convention.** Secondary text starts
around 1rem and scales with the container. The countdown fills its box on both
axes and is sized from the longest value a step will show, so it never changes
size mid-step.

**Everything is local.** No accounts, no server, no telemetry. Routines live in
IndexedDB, and images live beside them once pinned. Backups, share links and the
`.tabata` importer are how data moves.

## Testing

637 tests, all of which run in Node in a couple of seconds. There is no browser in
the test setup and none is needed. The parts with rules in them are pure and
tested directly; the hooks that own timers, listeners and external handles (the
tick chain, the cue scheduler, the wake lock, IndexedDB's connection) are tested
in jsdom, because that seam is where a full review found every serious bug hiding.
IndexedDB access, canvas encoding and Web Audio stay thin wrappers around tested
pure logic rather than being mocked wholesale.

Several tests are named after the bug they exist to prevent. That is on purpose:
`.wolf/buglog.json` records every one, and the interesting ones earned a test.

## Licence

MIT. See [LICENSE](LICENSE). Use the code for anything, including commercially,
as long as the copyright notice and licence text come along with it.

Two things the licence does not cover. The exercise illustrations in
`public/exercises/` are crops of the Horizon Torus 5 Exercise Guide, kept here
for personal use, so bring your own images if you reuse this. The whistle is a
CC0 public domain recording and needs no attribution. `LICENSE` has the detail.
