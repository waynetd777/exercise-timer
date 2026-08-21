# Exercise Timer

An interval timer for gym routines. Runs in the browser, installs to a phone home
screen, and works offline.

**Live: https://waynetd777.github.io/exercise-timer/**

Built for one specific job: telling someone mid-effort how much longer to keep
going, from across a gym, with the phone propped against a rack.

---

## What it does

- **Runs a timed routine** — big countdown, colour-coded phase, the exercise
  illustration beside it, audio cues that stay on the beat even after the phone
  has been in a pocket.
- **Runs a rep-based one too** — a strength session is mostly not timed, so a
  step can wait for you. The whole round or ladder rung is on screen at once and
  one Next clears it, while the timed steps mixed in — a 45-second rest, a
  30-second plank — still count themselves down.
- **Holds a library** of routines in the browser, searchable, with favourites and
  a colour per routine.
- **Takes a routine as pasted text**, which is how they arrive: an email from a
  gym instructor, parsed into sections, rounds and ladders, reporting any line it
  could not place before saving anything.
- **Imports** the `.tabata` exports of the Tabata Timer app, its own bundles, and
  plain-text routines.
- **Edits** routines: steps, durations, reps, ladders, sections, images — with
  undo.
- **Shares** a routine as a URL, or exports the whole library as one file.
- **Owns its images** — stores local copies so a routine survives gym wifi and
  the image host eventually losing a file.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 441 tests, no browser needed
npm run typecheck
npm run build
```

`npm run dev` also unlocks the sound bench, at Routines → Sounds: every cue as
the full figure and as its terminal sound alone, with the parameters printed
beside it. It is dev-only and compiled out of a production build.

Deployment is automatic: a push to `main` builds and publishes to GitHub Pages,
gated on typecheck and tests, because a broken timer is worse than a stale one.
Pages serves from a subpath, so `VITE_BASE` is set in the workflow and every
bundled asset path goes through `import.meta.env.BASE_URL`.

## How it is put together

One principle runs through the whole codebase: **the difficult logic is pure, and
React is a thin shell over it.** Anything with rules worth arguing about — the run
clock, the timeline compiler, the block tree, undo, the library ordering, the
orphan sweep — is a plain function over plain data, tested without a DOM. The
components wire those functions to state and markup and little else.

That is not architectural taste for its own sake. Every hard bug in this project
lived in exactly those rules, and they are only cheap to test when they are not
tangled up in a component.

```
src/
  engine/     The timer core: routine -> runs -> position. No React, no DOM.
  state/      The run clock, and the React hooks that drive a workout.
  audio/      Cues, pre-scheduled on the Web Audio clock.
  editor/     Pure operations on a routine's block tree, plus undo.
  media/      Images: content-addressed storage, downscaling, offline pinning.
  storage/    IndexedDB, the library, the export format, share links, read-time migration.
  routines/   The .tabata importer, the paste parser, the seed, the image catalogue.
  ui/         Screens, the type scale, the design tokens.
```

Each folder has its own README covering the decisions behind it.

## The decisions that matter

**Time is derived, never counted.** The clock stores `{ startedAt, pausedTotalMs }`
and computes elapsed from `performance.now()`. Nothing accumulates ticks, so a
throttled tab, a backgrounded phone or a ten-minute pocket cannot cause drift —
coming back simply tells the truth.

**A routine compiles to a flat timeline once.** `compile()` expands the recursive
tree of steps, rounds and ladders into absolute-time entries; the runner is then
a pure binary search over it. That makes seeking and skipping trivial and the
whole engine testable against a fake clock.

**A routine that waits is a sequence of timed runs separated by gates.** Not
every step has a duration: a rep-based one ends when you tap Next. Inside a run
nothing changes — absolute timeline, binary search, pre-scheduled cues, a
pocketed phone catching up — and at a gate the clock parks until you tap. A fully
timed routine compiles to exactly one run and behaves as it always did.

**Cues are scheduled ahead on the audio clock**, never fired from a JavaScript
tick, because the audio thread keeps time when the main thread is throttled. Each
boundary sounds like what it means: three beeps then a **whistle** into work,
three beeps then a **bell** out of it, three beeps then a triple **ding** at the
end. Everything but the whistle is synthesised from measurements of the app Wayne
already trains to; the whistle is a CC0 recording, which measurement showed is
the very recording that app plays.

**The UI is sized for viewing distance, not convention.** Secondary text starts
around 1rem and scales with the container; the countdown fills its box on both
axes and is sized from the longest value a step will show, so it never changes
size mid-step.

**Everything is local.** No accounts, no server, no telemetry. Routines live in
IndexedDB; images live beside them once pinned. Export, share links and the
`.tabata` importer are how data moves.

## Testing

441 tests, all of which run in Node in under a second — there is no browser in
the test setup and none is needed, because the parts worth testing do not touch
the DOM. IndexedDB access, canvas encoding and Web Audio are deliberately thin
wrappers around tested pure logic rather than being mocked.

Several tests are named after the bug they exist to prevent. That is on purpose:
`.wolf/buglog.json` records every one, and the interesting ones earned a test.
