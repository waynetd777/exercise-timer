# routines

The `.tabata` importer, the seeded routine and the image catalogue.

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

The import is **flat** — no reps groups are inferred. The shape is recoverable
later, but a wrong guess would silently alter someone's workout.

`importFiles.ts` sits above both readers: it takes the dropped or picked files,
tries this app's own bundle first (it identifies itself with a marker, so there is
no guessing) and the `.tabata` reader second, and **collects failures instead of
throwing**, so one bad file in a drop of ten does not lose the other nine.

## The seeded routine

One routine, `beginner-full-body`, committed as an authored `Workout` rather than
as a `.tabata` file put through the importer — its exercise runs are Reps groups,
and the importer deliberately never infers those. The `.tabata` files still in
this folder are importer test fixtures now; they are not in the app's import
graph, so they cost nothing in the bundle.

Its id is stable and deliberate, because seeding is keyed on it and recorded as
"once, ever": the routine is offered a given install one time and stays deleted if
deleted. Keeping the *old* id through the reps rewrite means an install that
already has it is not offered the new version — nothing about what plays changed,
and quietly replacing a routine someone may have edited is the worse trade.

## The image catalogue

27 URLs mirrored from the vault note `Fitness. Workouts.md`, in its own order and
grouping. Every one was verified to resolve when the file was written — and one
returned a transient connection error on the first attempt, so retry before
concluding a link is dead.

The note lists 29. Two were dropped as duplicate re-uploads — a second Tricep
Press and a second Standing Arm Curl. The file used to claim they were "genuinely
different images"; they are not, and the claim had never been checked. Aligned for
a 1px crop they differ by 1.8/255 and 3.3/255 mean, where two genuinely different
plates in this set differ by 16.6/255. The dropped URLs still work, so a routine
already pointing at one keeps loading it — steps store a URL, not a catalogue
index.

**The app does not read the vault at runtime.** If images are added to the note,
this file needs regenerating.

Only URLs are stored; labels are derived from the filename by `labelFromUrl()` in
`editor/images.ts`, so there is no parallel list to keep in sync — the filenames
are already the exercise names.

## Files

| | |
|---|---|
| `tabataFormat.ts` | The `.tabata` reader and its `TabataImportError` |
| `importFiles.ts` | Bundle-or-tabata dispatch over dropped files, failures collected |
| `samples.ts` | The seeded routine, loaded from `beginner-full-body.routine.json` |
| `imageCatalogue.ts` | The 27 URLs, in the note's own order and grouping |
| `*.tabata.json` | Importer fixtures — not imported by the app |
