# engine

The timer core. No React, no DOM, no storage — a routine goes in, a timeline comes
out, and a moment in time resolves to a position.

## Runs and gates

Read this first; everything else here assumes it.

A step either has a duration and advances itself, or is **self-paced** and waits
for the user to tap Next. Not every routine is a timer — a strength session is
mostly rep-based, with timed steps (a 45s rest, a 30s plank) mixed in.

So a routine compiles to a sequence of **runs**. A run is a maximal span of
consecutive timed steps, and it is an ordinary absolute-time timeline: inside one,
everything works exactly as it always has — `position()` is a binary search, cues
pre-schedule on the audio clock, and a phone that spent ten minutes in a pocket
lands on the right step rather than the next one. Between runs sit **gates**:
single self-paced steps where the clock parks until Next, and the following run is
rebased from that moment.

A fully timed routine compiles to exactly **one** run and behaves identically to
before any of this existed. That is the point of the shape: the tested core is
untouched, and `runtime.ts` and `cues.ts` never learned that gates exist.

A gate usually holds one step. The exception is a group that advances as a
whole — a **ladder rung** — where one Next clears every rep-based step in it,
because the rung is the unit of work: "20 goblet squats, then 10 lateral walks
and 10 kickbacks" is one thing you do and tick off, not three prompts to tap
through with your hands full. A timed step inside the rung still gets its own
run, so a 10-second wall sit counts itself down and flows on without a tap.
`Ladder.advance: 'step'` opts out.

Two consequences:

- **`startMs`/`endMs` are relative to the entry's RUN**, not the routine. With one
  run they are the same thing. There is no routine-wide time axis once a routine
  can wait for a tap, and pretending otherwise would be a lie the UI would render.
- **Overshoot is discarded at a gate.** `nextRun()` starts the next run at zero
  however late the tick was. The step after a timed run is always a gate — runs
  are maximal — so there is nothing to carry it into anyway.

## Two models, on purpose

**Authoring** (`Workout`, `Block`) is a recursive tree of steps and groups. There
are three group kinds, and each earns its place:

| | |
|---|---|
| `repeat` | The same children N times. `repeat×8 [work 20s, rest 10s]` is Tabata; a circuit is the same shape with named steps |
| `ladder` | A repeat whose rep count changes each iteration: `2-4-6-8-10-8-6-4-2`. Children marked `reps: {kind:'rung'}` take the rung; children with a fixed count keep it, which is how "after every set: 10 × Walking Lunges" works. The rung advances as a whole |
| `section` | A named part of a routine with its own display mode — what the run screen shows whole |

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
- **An absent duration is self-paced; a present non-positive one is dropped.**
  Those are not the same thing, and the difference is deliberate: a mistyped `0`
  must not quietly become a step that waits forever for a tap.
- **A ladder runs everything on its final rung**, accessories included — "after
  every set" includes the last set. Deliberately the opposite of the trailing-rest
  rule below. Two similar-looking rules, opposite answers, both by decision.
- **A group's trailing rest does not run after the final rep.** A rest belongs
  *between* reps: three reps of work-then-rest is work rest work rest work, five
  steps, not six. Only the last child, and only the `rest` role — `recover` is a
  long interval someone put there on purpose. To rest after the last rep too, put
  the rest step *after* the group; that reads as what it is and survives a change
  to the rep count. `totalDurationMs()` and `stepCount()` subtract it as well.
- **`compile()` drops degenerate input silently** — non-positive durations, groups
  that run fewer than once, fractional values rounded or floored. Validation
  belongs in the editor; the engine must never crash on a half-typed routine.
  The one thing it *does* throw for is a tree that expands past 10,000 steps,
  which would lock up the tab.
- **All non-finite `elapsedMs` clamps to 0.** `+Infinity` is not treated as "past
  the end" — one rule for invalid input beats two special cases, and a real
  monotonic clock never produces it.
- **`position()` returns `nextEntry`** so the UI can decode the next step's image
  before the transition, rather than flashing blank at exactly the wrong moment.
- **Every boundary is keyed on the step being *entered*.** There is no single
  "phase change" cue: `CueKind` is `countdown | work-start | work-end |
  workout-complete`, because entering work and leaving it mean opposite things
  mid-effort and must not sound alike. Anything that is not work starts a
  `work-end`.
- **Countdown cues that would collide with a step's own start are suppressed**, so
  a 3-second step beeps "2, 1" rather than firing "3" on top of its boundary cue.
  Cues landing on the same millisecond are ordered by kind, completion first.
- **`totalDurationMs()` and `stepCount()` duplicate `compile()`'s arithmetic** so
  the library can draw a row without compiling every routine. A parametrised test
  asserts they agree — keep it if either changes.

## Files

| | |
|---|---|
| `types.ts` | Both models, plus `MediaRef`, `Position`, `CuePoint`, `ROUTINE_COLOURS` and `SCHEMA_VERSION` |
| `compile.ts` | Tree → timeline, and the cheap whole-routine measures |
| `runtime.ts` | `position()`, and the seek helpers behind skip forward/back |
| `cues.ts` | Absolute-time cue points, and the half-open window the audio scheduler arms |
| `navigate.ts` | The layer above runs: `locate`, `advance`, `retreat`, and `groupEntries` — what list mode draws |
| `index.ts` | The package surface — import from `'../engine'`, not from a file inside it |

`runtime.ts` and `cues.ts` work on one run and know nothing about gates. Keep it
that way: anything that has to reason about crossing a run belongs in
`navigate.ts`.
