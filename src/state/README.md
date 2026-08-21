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
| `useTimer.ts` | Run state, the self-scheduling tick, and the seek controls |
| `useWakeLock.ts` | Holds the screen awake while running; re-acquires on return, since the browser releases it when the page hides |
| `updateApp.ts` | Pull-to-update. Drops only the precached shell — **never IndexedDB**, which holds the only copy of anything authored in the editor |
| `usePullToRefresh.ts` | The gesture. Listeners are attached natively with `{ passive: false }`, because React registers `touchmove` as passive and would ignore `preventDefault` |
