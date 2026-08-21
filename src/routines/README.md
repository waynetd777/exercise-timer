# routines

The `.tabata` importer, the seeded routines and the image catalogue.

## The `.tabata` format, decoded

Exports from the Tabata Timer app (`com.alexandersergienko.TabataTimer`).
`workout.intervals` is the **fully expanded** sequence; each interval has a `type`
(0 = prepare or transition, 1 = work, 2 = rest, 3 = the long recovery between
exercises), a `time` in seconds, and optional `description` and `url`.

The trap: the sibling fields — `cycles`, `work`, `rest`, `prepare`,
`restBetweenTabatas` — are the **template defaults the routine was generated
from, not multipliers**. Honouring `cycles: 3` would have turned a 42-minute
workout into 126 minutes. They are ignored deliberately.

Type 3 was confirmed rather than assumed: 60 seconds, no description, appearing
after each exercise's sets, and matching the file's own `restBetweenTabatas: 60`.

The import is **flat** — no rounds are inferred. The shape is recoverable later,
but a wrong guess would silently alter someone's workout.

## The seeded routines

Wayne's three real routines, committed so they double as test fixtures. Their ids
are stable and deliberate, because seeding is keyed on them: a routine is offered
once and stays deleted if deleted.

## The image catalogue

29 URLs mirrored from the vault note `Fitness. Workouts.md`, in its own order and
grouping. Every one was verified to resolve when the file was written — and one
returned a transient connection error on the first attempt, so retry before
concluding a link is dead.

**The app does not read the vault at runtime.** If images are added to the note,
this file needs regenerating.

Only URLs are stored; labels are derived from the filename by `labelFromUrl()`, so
there is no parallel list to keep in sync — the filenames are already the exercise
names. A few names repeat (two Tricep Press machines, two Standing Arm Curl):
those are genuinely different images, so the duplicate labels are honest.
