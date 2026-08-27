# engine

The timer core. No React, no DOM, no storage. A routine goes in, a timeline comes
out, and a moment in time resolves to a position.

## Runs and gates

Read this first; everything else here assumes it.

A step either has a duration and advances itself, or is **self-paced** and waits
for the user to tap Next. Not every routine is a timer: a strength session is
mostly rep-based, with timed steps such as a 45s rest or a 30s plank mixed in.

So a routine compiles to a sequence of **runs**. A run is a maximal span of
consecutive timed steps, and it is an ordinary absolute-time timeline. Inside one,
everything works exactly as it always has: `position()` is a binary search, cues
pre-schedule on the audio clock, and a phone that spent ten minutes in a pocket
lands on the right step rather than the next one. Between runs sit **gates**,
single self-paced steps where the clock parks until Next, and the following run is
rebased from that moment.

A fully timed routine compiles to exactly **one** run and behaves identically to
before any of this existed. That is the point of the shape: the tested core is
untouched, and `runtime.ts` and `cues.ts` never learned that gates exist.

A gate usually holds one step. The exception is a **group inside a list
section**, meaning a round, a ladder rung, or the loose steps of the section.
There, one Next clears every rep-based step in it, because the group is the unit
of work. "12 curls, 10 press, 12 flyes" is one round you do and tick off, not
three prompts to tap through with your hands full, and a burnout block says
"complete without stopping" in as many words. `advance: 'step'` opts one out, and
an inner opt-out beats an outer group's default.

Nothing is hidden by this, and that is why it is confined to list sections. The
list draws every step of the gate, all marked as being worked, so the only thing
given up is per-exercise progress, and that is not progress anyone tracks
mid-set. The countdown view shows one step, so a group anywhere else advances a
step at a time: collapsed there, it showed its first step and a tap skipped the
rest unseen. `listMode()` in `navigate.ts` decides the view; `gateKey()` in
`compile.ts` asks the same question of the nearest section.

A TIMED step is never swallowed by the tap. It keeps its own run, so the
45-second rest after a round, the wall sit after a rung and the one in the middle
of a burnout all count themselves down. That is why a burnout containing a wall
sit is two taps rather than one: the clock has to start when you reach the hold,
and your tap is what says you have.

Two consequences:

- **`startMs` and `endMs` are relative to the entry's RUN**, not the routine. With
  one run they are the same thing. There is no routine-wide time axis once a
  routine can wait for a tap, and pretending otherwise would be a lie the UI would
  render.
- **Overshoot is discarded at a gate.** `nextRun()` starts the next run at zero
  however late the tick was. The step after a timed run is always a gate, because
  runs are maximal, so there is nothing to carry it into anyway.

## Two models, on purpose

**Authoring** (`Workout`, `Block`) is a recursive tree of steps and groups. There
are three group kinds, and each earns its place:

| | |
|---|---|
| `repeat` | The same children N times. `repeat×8 [work 20s, rest 10s]` is Tabata; a circuit is the same shape with named steps |
| `ladder` | A repeat whose rep count changes each iteration: `2-4-6-8-10-8-6-4-2`. Children marked `reps: {kind:'rung'}` take the rung; children with a fixed count keep it, which is how "after every set: 10 × Walking Lunges" works |
| `section` | A named part of a routine with its own display mode. This is what the run screen shows whole |

**Runtime** (`Routine`, `Run`, `TimelineEntry`) is the same steps seen two ways:
`routine.entries` in order for display, and `routine.runs` partitioned for the
clock. The entry objects are shared between them, never copied.

Keeping them separate is what makes everything downstream easy. `position()` is a
binary search over `startMs`, so seeking, skipping and rewinding are all the same
operation, and the entire engine can be tested against a fake clock. A stateful
step-through machine would have made each of those a special case.

## Rules encoded here

- **Entries own `[startMs, endMs)`**, within their run. At exactly `entry.startMs`
  you are at the top of that step; at exactly `run.totalMs` the run is over.
- **An absent duration is self-paced. A present non-positive one is dropped.**
  Those are not the same thing, and the difference is deliberate: a mistyped `0`
  must not quietly become a step that waits forever for a tap.
- **`load` is carried, never interpreted.** `compile()` copies it onto the entry
  and that is all the engine knows about weights. An absent one means "whatever I
  lift for this" and is resolved by `routines/loads.ts` before a routine gets
  here, so the engine has no idea the weights page exists.
- **A ladder runs everything on its final rung**, accessories included, because
  "after every set" includes the last set. This is deliberately the opposite of the
  trailing-rest rule below. Two similar-looking rules, opposite answers, both by
  decision.
- **A group's trailing rest does not run after the final set.** A rest belongs
  *between* sets: three sets of work-then-rest is work rest work rest work, five
  steps, not six. Only the last child, and only the `rest` role, since `recover` is
  a long interval someone put there on purpose. To rest after the last set too, put
  the rest step *after* the group. That reads as what it is and survives a change to
  the rep count. `totalDurationMs()` and `stepCount()` subtract it as well.
- **`compile()` drops degenerate input silently:** non-positive durations, groups
  that run fewer than once, fractional values rounded or floored. Validation
  belongs in the editor, and the engine must never crash on a half-typed routine.
  The one thing it *does* throw for is a tree that expands past 10,000 steps, which
  would lock up the tab.
- **All non-finite `elapsedMs` clamps to 0.** `+Infinity` is not treated as "past
  the end". One rule for invalid input beats two special cases, and a real
  monotonic clock never produces it.
- **`position()` returns `nextEntry`** so the UI can decode the next step's image
  before the transition, rather than flashing blank at exactly the wrong moment.
- **Every boundary is keyed on the step being *entered*.** There is no single
  "phase change" cue: `CueKind` is `countdown | work-start | work-end |
  workout-complete`, because entering work and leaving it mean opposite things
  mid-effort and must not sound alike. Anything that is not work starts a
  `work-end`.
- **Countdown cues that would collide with a step's own start are suppressed,** so
  a 3-second step beeps "2, 1" rather than firing "3" on top of its boundary cue.
  So no two cues ever share a millisecond, and the sort needs no tie-break.
- **`totalDurationMs()` and `stepCount()` duplicate `compile()`'s arithmetic** so
  the library can draw a row without compiling every routine. A parametrised test
  asserts they agree. Keep it if either changes.

## Files

| | |
|---|---|
| `types.ts` | Both models, plus `MediaRef`, `Position`, `CuePoint`, `ROUTINE_COLOURS` and `SCHEMA_VERSION` |
| `compile.ts` | Tree to timeline, and the cheap whole-routine measures |
| `runtime.ts` | `position()`, and the seek helpers behind skip forward/back |
| `cues.ts` | Absolute-time cue points, and the half-open window the audio scheduler arms |
| `navigate.ts` | The layer above runs: `locate`, `advance`, `retreat`, and `groupEntries`, which is what list mode draws |
| `index.ts` | The package surface. Import from `'../engine'`, not from a file inside it |

`runtime.ts` and `cues.ts` work on one run and know nothing about gates. Keep it
that way: anything that has to reason about crossing a run belongs in
`navigate.ts`.
