# state

The run clock and the hooks that drive a workout.

## The clock is derived, never counted

`clock.ts` holds `{ startedAt, pausedTotalMs, pausedAt }` and computes elapsed from
`performance.now()`. Nothing accumulates ticks.

This is the single most important decision in the project. A timer built on
`setInterval(() => remaining--, 1000)` drifts, and is frozen outright by a
backgrounded tab, so a phone in a pocket would come back minutes behind. Deriving
elapsed from a monotonic timestamp means the timer is always simply correct, and
returning to a hidden tab needs almost no correction.

`performance.now()` rather than `Date.now()` because it is monotonic: changing the
system clock or crossing a timezone mid-workout cannot corrupt a run.

The "almost": iOS freezes the whole WebContent process while the app is
backgrounded, and `performance.now()` excludes the frozen stretch, so subtraction
alone under-counts exactly the time spent away. On every return to visible, the
wall clock is compared against a wall/monotonic pair captured while awake, and any
missing stretch is credited to the running clocks (`suspendedMs` and `credited` in
`clock.ts`). The credit is one-way: a wall clock set backwards can never rewind a
run, so the monotonic property above still holds.

The clock is pure data with pure transitions, tested with a fake clock. That is not
fussiness: a real bug lived here. Seeking while paused used to leave the clock
running, so the next resume credited a huge bogus pause and jumped the workout
forward. There is a test named after it.

## One clock per run, not per routine

A routine can wait for the user: a strength session is mostly rep-based, and a
self-paced step ends only when Next is tapped. So the clock measures **one run**, a
maximal span of consecutive timed steps, and is re-anchored every time the cursor
crosses into another. See `engine/README.md` for the runs-and-gates shape. What
matters here is that the property above survives it: inside a run, elapsed is still
a subtraction against a monotonic timestamp.

Run state is therefore a `Cursor` (`{ runIndex, elapsedInRunMs }`) rather than a
bare elapsed, and every jump goes through one `moveTo`: tick, skip and seek alike.
The clock and the cursor drifting apart is precisely the bug class this module
exists to prevent.

`tick.ts` holds the decision itself, out of the hook and tested without a DOM.
Given a routine, a run and an elapsed reading: does the tick stay, move to the next
run, or complete, and when does the display next change? The rule worth knowing is
that **crossing a gate is derived, not walked**. A tab that slept for ten minutes
lands on the step after the run that expired, in one move, rather than taking one
step per tick until it catches up. There is a test named after it.

## Two clocks, two questions

The run clock answers "how long is left on this step", and to do that it is
re-anchored at every gate and every skip. That makes it the wrong instrument for
"how long have I been training". A gated routine can answer that question no other
way, since the routine has no total length to subtract from.

So `useTimer` keeps a **second clock of the same type**, started with the workout,
paused with it, stopped at the finish, and deliberately untouched by `moveTo`: a
skip changes where you are, not how long you have been at it. It surfaces as
`sessionMs`, drives the stopwatch in the run screen's header, and is what the
finished screen reports as Elapsed. That used to be the routine's *scheduled*
length, and was hidden entirely for a gated routine.

The two are different axes and will disagree after a skip. That is correct: one is
a position in the routine, the other is time spent.

## No animation loop

`useTimer` schedules **one timeout for the exact moment the display next changes**,
which is the next whole second or the end of the step, whichever comes first. That
is roughly one callback per second instead of sixty, with identical precision, and
it stays correct through backgrounding because elapsed is derived rather than
counted. Timeout throttling in a hidden tab is therefore harmless.

## Files

| | |
|---|---|
| `clock.ts` | Pure clock: `elapsed`, `started`, `paused`, `resumed`, `seeked`, and the suspension credit (`suspendedMs`, `credited`) |
| `tick.ts` | Pure: stay / move / complete, and when the display next changes |
| `useTimer.ts` | Run state as a cursor, the session clock, the self-scheduling tick, and the seek controls |
| `useWakeLock.ts` | Holds the screen awake while running. Re-acquires on return, since the browser releases it when the page hides |
| `updateApp.ts` | Pull-to-update. Asks the service worker for the newer version and reloads onto it. Deletes **nothing**: the precache is only written during an install, so dropping it destroyed offline until the next deploy, and IndexedDB holds the only copy of anything authored |
| `usePullToRefresh.ts` | The gesture. Listeners are attached natively with `{ passive: false }`, because React registers `touchmove` as passive and would ignore `preventDefault` |
