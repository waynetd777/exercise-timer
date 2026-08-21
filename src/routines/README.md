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

`importFiles.ts` sits above all three readers: it takes the dropped or picked
files, tries this app's own bundle first (it identifies itself with a marker, so
there is no guessing), the `.tabata` reader second, and the paste parser last,
when the file turns out not to be JSON at all. It **collects failures instead of
throwing**, so one bad file in a drop of ten does not lose the other nine.

Plain text is accepted because the routines arrive as email, and saving one to a
file is often easier than getting at its text to copy — particularly on a phone.
The file's own name becomes the routine's.

## The paste parser

`pasteFormat.ts` reads a strength routine pasted as text. The source is the
weekly email in `__tests__/emails/`; paste rather than an `.eml` importer,
because the same grammar arrives by WhatsApp and Notes too.

Two rules govern it:

1. **Never guess silently.** A line it cannot place goes into `skipped`, with its
   number, rather than being dropped or approximated. Same principle as the
   `.tabata` importer refusing to infer reps.
2. **The result is a draft** for review in the editor, which is what makes rule 1
   affordable — an imperfect parse costs a correction, not a bad workout.

The test that matters asserts `skipped` is empty for all three routines. It is
the first thing to fail when the instructor writes something new, and that is
the point.

**One rule covers every ladder in the source material:** inside a ladder, an item
with no count of its own scales with the rung, and an item that states a count
keeps it. That is "#1 General Body" (every exercise scales) and "#3 Legs" (main
lift scales, accessories fixed) with no special case for either.

Decisions the grammar encodes, each because the emails are inconsistent:

- **A range takes its upper bound.** "3–5 Rounds" stores 5 and "Rest: 30–45
  seconds" stores 45 — a runner can always end a section early, but cannot invent
  a round that was never authored.
- **A per-side count is the smaller, truer one.** "10 × Walking Lunges (5 each
  leg)" is five a side, in either the bracketed or the dashed notation.
- **A duration is looked for before a count**, because "30-second Plank" starts
  with a number that is not a rep count.
- **A line is split only when both halves state a count.** "20 × Front Punches +
  20 × Uppercuts" is two movements; "Squat + Shoulder Press" is one.
- **A long trailing parenthetical is a description, not part of the name.** One
  step arrived as 159 characters — "Side-to-Side Squats with a Reach (start
  standing, step out to one side, …)" — which no amount of sizing renders legibly
  across a gym. Over 24 characters it moves to the step's `note`; shorter ones
  like "(basic)" are part of what the exercise *is*, and only a TRAILING one
  counts, since "RB (resistance band) Lateral Walks" glosses a term mid-name.
- **A bracketed per-side note is dropped from the name**, because the effort
  column already says "each side" and it would otherwise print twice. Only the
  bracketed form: cutting "– each side" would leave a dangling dash.
- **A section shows as a timer only when every step in it is timed**, which is
  derived rather than guessed — the warm-up qualifies, nothing else does.

A trap worth knowing: the dash characters are built into patterns two ways, as
`DASH` (a complete class) and `DASH_CHARS` (the bare characters). Nesting the
first inside another class silently yields `[\s[-–—]]`, which is what stopped
"30-second Plank" reading as a duration for an afternoon.

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
| `pasteFormat.ts` | The pasted-text parser: `parseRoutine`, `parseItem` |
| `importFiles.ts` | Bundle-or-tabata dispatch over dropped files, failures collected |
| `samples.ts` | The seeded routine, loaded from `beginner-full-body.routine.json` |
| `imageCatalogue.ts` | The 27 URLs, in the note's own order and grouping |
| `*.tabata.json` | Importer fixtures — not imported by the app |
