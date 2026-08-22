# routines

The `.tabata` importer, the paste parser, the seeded routines and the image
catalogue.

## The `.tabata` format, decoded

Exports from the Tabata Timer app (`com.alexandersergienko.TabataTimer`).
`workout.intervals` is the **fully expanded** sequence; each interval has a `type`
(0 = prepare or transition, 1 = work, 2 = rest, 3 = the long recovery between
exercises), a `time` in seconds, and optional `description` and `url`.

The trap is the sibling fields: `cycles`, `work`, `rest`, `prepare` and
`restBetweenTabatas` are the **template defaults the routine was generated from,
not multipliers**. Honouring `cycles: 3` would have turned a 42-minute workout into
126 minutes. They are ignored deliberately.

Type 3 was confirmed rather than assumed. It is 60 seconds, has no description,
appears after each exercise's sets, and matches the file's own
`restBetweenTabatas: 60`.

The import is **flat**, so no reps groups are inferred. The shape is recoverable
later, but a wrong guess would silently alter someone's workout.

`importFiles.ts` sits above all three readers. It takes the dropped or picked files
and tries this app's own bundle first, since it identifies itself with a marker and
there is no guessing, then the `.tabata` reader, and finally the paste parser when
the file turns out not to be JSON at all. It **collects failures instead of
throwing**, so one bad file in a drop of ten does not lose the other nine.

It is also where two things happen to a routine on the way in. Every reader's output
goes through `migrateWorkout`, which is what turns a `.tabata` file's image URLs
into the illustrations the app ships. And a bundle's photos are written to the blob
store first, so no step renders looking for bytes that have not landed. A photo the
store already has is skipped, because the key is the hash of the contents, so
importing the same file twice cannot duplicate an image.

Plain text is accepted because the routines arrive as email, and saving one to a
file is often easier than getting at its text to copy, particularly on a phone. The
file's own name becomes the routine's.

## The paste parser

`pasteFormat.ts` reads a strength routine pasted as text. The source is the weekly
email in `__tests__/emails/`. It is a paste box rather than an `.eml` importer,
because the same grammar arrives by WhatsApp and Notes too.

`docs/paste-format.md` is the user-facing description of the grammar. Its example
block IS `PASTE_TEMPLATE`, asserted by a test, so the doc cannot drift into
describing a grammar the parser no longer reads.

The one thing it ADDS to the text is **five seconds to get ready** at the start:
long enough to prop the phone up and step back, short enough that nobody waits
through it twice. The emails never mention it because a person reading one is
already standing there. It goes at the top level rather than inside the first
section, because it is not part of the warm-up but the moment before it. It is
skipped when the text already opens with a prepare step, so a routine that says
"30 sec to get set" is not made to wait twice.

Two rules govern everything else:

1. **Never guess silently.** A line it cannot place goes into `skipped`, with its
   number, rather than being dropped or approximated. Same principle as the
   `.tabata` importer refusing to infer reps.
2. **The result is a draft** for review in the editor, which is what makes rule 1
   affordable. An imperfect parse costs a correction, not a bad workout.

The test that matters asserts `skipped` is empty for all three routines. It is the
first thing to fail when the instructor writes something new, and that is the
point.

**One rule covers every ladder in the source material:** inside a ladder, an item
with no count of its own scales with the rung, and an item that states a count
keeps it. That is "#1 General Body" (every exercise scales) and "#3 Legs" (main
lift scales, accessories fixed) with no special case for either.

Decisions the grammar encodes, each because the emails are inconsistent:

- **A range takes its upper bound.** "3-5 Rounds" stores 5 and "Rest: 30-45
  seconds" stores 45. A runner can always end a section early, but cannot invent a
  round that was never authored.
- **A per-side count is the smaller, truer one.** "10 × Walking Lunges (5 each
  leg)" is five a side, in either the bracketed or the dashed notation.
- **A duration is looked for before a count**, because "30-second Plank" starts
  with a number that is not a rep count.
- **A line is split only when both halves state a count.** "20 × Front Punches +
  20 × Uppercuts" is two movements. "Squat + Shoulder Press" is one.
- **A long trailing parenthetical is a description, not part of the name.** One step
  arrived as 159 characters, "Side-to-Side Squats with a Reach (start standing, step
  out to one side, …)", which no amount of sizing renders legibly across a gym. Over
  24 characters it moves to the step's `note`. Shorter ones like "(basic)" are part
  of what the exercise *is*. Only a TRAILING one counts, since "RB (resistance band)
  Lateral Walks" glosses a term mid-name.
- **A bracketed per-side note is dropped from the name,** because the effort column
  already says "each side" and it would otherwise print twice. Only the bracketed
  form: cutting a dashed "each side" would leave a dangling dash.
- **A step named "Get ready", "Get set" or "Prepare" takes the prepare role**, so
  it reads as green rather than as work. Everything else is work, or rest if it
  says "rest".
- **A section shows as a timer only when every step in it is timed,** which is
  derived rather than guessed. The warm-up qualifies, nothing else does.

A trap worth knowing: the dash characters are built into patterns two ways, as
`DASH` (a complete class) and `DASH_CHARS` (the bare characters). Nesting the
first inside another class silently yields `[\s[-–—]]`, which is what stopped
"30-second Plank" reading as a duration for an afternoon.

## The template is part of the parser

`pasteTemplate.ts` is a routine written in every part of the grammar above, handed
to the clipboard by the paste dialog's **Copy template**. It teaches by example
rather than by a syntax table, which is the only honest way to describe a parser
whose input is a human's handout. Two rules interacting is exactly what a table
cannot show.

`__tests__/pasteTemplate.test.ts` parses it and asserts `skipped` is empty, then
asserts the shape it produced: the ladder's main lift scaling while its
accessories stay fixed, the bonus landing after the ladder, the rest inside the
rounds group, the alternative from a lone "or" line, and the long parenthetical
becoming a note. Deliberately coupled: if the grammar moves, the one example the app
offers must not become the one thing the app cannot read.

## The seeded routines

Two, and deliberately one of each KIND: `beginner-full-body`, a fully timed
interval routine, and `strength-training`, a rep-based session. They are the two
things the app does, and an install that only ever saw a countdown would never
discover that a step can wait for you.

The strength one is **generated**, by running `pasteFormat.ts` over
`__tests__/emails/2026-07-20-general.txt` and committing the result, so it cannot
drift from what the parser actually produces. It is the app's own worked example of
a pasted routine, and one that no longer matched the parser would be worse than
none. A test asserts they still agree, ignoring ids. That email of the three because
it needs the least equipment: the others want a trampoline and a set of resistance
bands.

`beginner-full-body` is committed as an authored `Workout` rather than as a
`.tabata` file put through the importer, because its exercise runs are Reps groups
and the importer deliberately never infers those. The `.tabata` files still in this
folder are importer test fixtures now. They are not in the app's import graph, so
they cost nothing in the bundle.

Their ids are stable and deliberate, because seeding is keyed on them and recorded
as "once, ever": the routine is offered a given install one time, and stays deleted
if deleted. Keeping the *old* id through the reps rewrite means an install that
already has it is not offered the new version. Nothing about what plays changed, and
quietly replacing a routine someone may have edited is the worse trade.

## The image catalogue

43 illustrations that **ship with the app**, under `public/exercises/`. Each entry is
a path, which `resolvePlan` turns into `${BASE_URL}${path}` at render time. The base
is applied late and never stored, so one routine works on a root domain, on a
subpath host, and inside an export opened on another device.

They were 27 postimages links until 2026-08-21, mirrored by hand from the vault note
`Fitness. Workouts.md`. That worked, but it made the pictures depend on a third
party, needed a screenshot-and-upload for every addition, and left a routine one
dead host away from having none. The set now comes from the Horizon Torus guide by
way of `scripts/exercise_plates.py`, so it is reproducible: 41 plates, one per
exercise page, at 881px wide and about 65KB each, plus the two cardio photos that
are not from the guide.

What the rehosting had to get right, all of it verified rather than assumed:

- **The framing matches the old screenshots,** to a 4 to 6 out of 255 mean
  difference against three originals, where two genuinely different plates differ by
  22 to 68. The crop is anchored on the grey strip above the title band, not on the
  band itself: the band's colour codes the muscle group, and anchoring on yellow
  produced a plate with the Horizon logo in it.
- **Four filenames changed,** because the guide's own wording won: Seated Ab Crunch
  became Seated Abdominal Crunch, Tricep Dip became Tricep Dips, Tricep Press became
  Triceps Press, and Cable Row became Seated Cable Row. Labels come from filenames,
  so this is what the picker now says.
- **Every old URL still resolves to its picture.** `storage/migrate.ts` maps all 29
  links the catalogue ever held onto these paths, on read, including the two
  duplicate uploads. So a routine saved on a phone last week and an export made last
  year both come back with illustrations.
- **The note is no longer the master list.** The guide is, and the script reads it.

Two guards the old URL list could not have: every entry must name a file that
exists, and every file in `public/exercises` must be named by an entry. A typo
used to be a broken image nobody noticed until they scrolled the picker.

Labels are still derived by `labelFromUrl()` in `editor/images.ts`, so there is no
parallel list of names to keep in sync. The filenames are the exercise names.

## Files

| | |
|---|---|
| `tabataFormat.ts` | The `.tabata` reader and its `TabataImportError` |
| `pasteFormat.ts` | The pasted-text parser: `parseRoutine`, `parseItem` |
| `pasteTemplate.ts` | The example routine the paste dialog copies out. A test keeps it parseable |
| `../../scripts/exercise_plates.py` | Regenerates `public/exercises/` from the Torus guide PDF |
| `importFiles.ts` | Bundle-or-tabata-or-text dispatch, migration, and a bundle's photos into the store |
| `samples.ts` | The two seeds, loaded from `*.routine.json` |
| `strength-training.routine.json` | The generated strength seed. Regenerate with the parser, never edit by hand |
| `imageCatalogue.ts` | The 43 bundled illustration paths, in the note's original order and grouping |
| `*.tabata.json` | Importer fixtures, not imported by the app |
