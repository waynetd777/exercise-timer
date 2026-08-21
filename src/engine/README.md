# engine

The timer core. No React, no DOM, no storage — a routine goes in, a timeline comes
out, and a moment in time resolves to a position.

## Two models, on purpose

**Authoring** (`Workout`, `Block`) is a recursive tree: a step, or a round that
repeats a list of children. One primitive covers classic Tabata, named circuits,
pyramids and nested sets — `repeat×8 [work 20s, rest 10s]` is Tabata, and a
circuit is the same shape with named steps.

**Runtime** (`Timeline`, `TimelineEntry`) is a flat array of absolute-time
entries, produced once by `compile()`.

Keeping them separate is what makes everything downstream easy. `position()` is a
binary search over `startMs`, so seeking, skipping and rewinding are all the same
operation, and the entire engine can be tested against a fake clock. A stateful
step-through machine would have made each of those a special case.

## Rules encoded here

- **Entries own `[startMs, endMs)`.** At exactly `entry.startMs` you are at the
  top of that step; at exactly `timeline.totalMs` the workout is complete.
- **`compile()` drops degenerate input silently** — non-positive durations, rounds
  that run fewer than once, fractional values rounded or floored. Validation
  belongs in the editor; the engine must never crash on a half-typed routine.
  The one thing it *does* throw for is a tree that expands past 10,000 steps,
  which would lock up the tab.
- **All non-finite `elapsedMs` clamps to 0.** `+Infinity` is not treated as "past
  the end" — one rule for invalid input beats two special cases, and a real
  monotonic clock never produces it.
- **`position()` returns `nextEntry`** so the UI can decode the next step's image
  before the transition, rather than flashing blank at exactly the wrong moment.
- **Countdown cues that would collide with a step's own start are suppressed**, so
  a 3-second step beeps "2, 1" rather than firing "3" on top of its phase change.
- **`totalDurationMs()` and `stepCount()` duplicate `compile()`'s arithmetic** so
  the library can draw a row without compiling every routine. A parametrised test
  asserts they agree — keep it if either changes.

## Files

| | |
|---|---|
| `types.ts` | Both models, plus `MediaRef`, `Position` and `CuePoint` |
| `compile.ts` | Tree → timeline, and the cheap whole-routine measures |
| `runtime.ts` | `position()`, and the seek helpers behind skip forward/back |
| `cues.ts` | Absolute-time cue points, and the half-open window the audio scheduler arms |
