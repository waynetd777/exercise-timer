# state

The run clock and the hooks that drive a workout.

## The clock is derived, never counted

`clock.ts` holds `{ startedAt, pausedTotalMs, pausedAt }` and computes elapsed from
`performance.now()`. Nothing accumulates ticks.

This is the single most important decision in the project. A timer built on
`setInterval(() => remaining--, 1000)` drifts, and is frozen outright by a
backgrounded tab — so a phone in a pocket would come back minutes behind. Deriving
elapsed from a monotonic timestamp means the timer is always simply correct, and
returning to a hidden tab needs no correction at all.

`performance.now()` rather than `Date.now()` because it is monotonic: changing the
system clock or crossing a timezone mid-workout cannot corrupt a run.

The clock is pure data with pure transitions, tested with a fake clock. That is
not fussiness — a real bug lived here. Seeking while paused used to leave the
clock running, so the next resume credited a huge bogus pause and jumped the
workout forward. There is a test named after it.

## One clock per run, not per routine

A routine can now wait for the user: a strength session is mostly rep-based, and
a self-paced step ends only when Next is tapped. So the clock measures **one
run** — a maximal span of consecutive timed steps — and is re-anchored every time
the cursor crosses into another. See `engine/README.md` for the runs-and-gates
shape; what matters here is that the property above survives it. Inside a run,
elapsed is still a subtraction against a monotonic timestamp.

Run state is therefore a `Cursor` (`{ runIndex, elapsedInRunMs }`) rather than a
bare elapsed, and every jump — tick, skip, seek — goes through one `moveTo`,
because the clock and the cursor drifting apart is precisely the bug class this
module exists to prevent.

`tick.ts` holds the decision itself, out of the hook and tested without a DOM:
given a routine, a run and an elapsed reading, does the tick stay, move to the
next run, or complete — and when does the display next change? The rule worth
knowing is that **crossing a gate is derived, not walked**. A tab that slept for
ten minutes lands on the step after the run that expired, in one move, rather
than taking one step per tick until it catches up. There is a test named after it.

## No animation loop

`useTimer` schedules **one timeout for the exact moment the display next changes**
— the next whole second, or the end of the step, whichever comes first. That is
roughly one callback per second instead of sixty, with identical precision, and it
stays correct through backgrounding because elapsed is derived rather than
counted. Timeout throttling in a hidden tab is therefore harmless.

## Files

| | |
|---|---|
| `clock.ts` | Pure clock: `elapsed`, `started`, `paused`, `resumed`, `seeked` |
| `tick.ts` | Pure: stay / move / complete, and when the display next changes |
| `useTimer.ts` | Run state as a cursor, the self-scheduling tick, and the seek controls |
| `useWakeLock.ts` | Holds the screen awake while running; re-acquires on return, since the browser releases it when the page hides |
| `updateApp.ts` | Pull-to-update. Drops only the precached shell — **never IndexedDB**, which holds the only copy of anything authored in the editor |
| `usePullToRefresh.ts` | The gesture. Listeners are attached natively with `{ passive: false }`, because React registers `touchmove` as passive and would ignore `preventDefault` |
