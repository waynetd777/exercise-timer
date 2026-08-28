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

The import is **flat**, so no groups of sets are inferred. The shape is recoverable
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

The test that matters asserts `skipped` is empty for every routine in
`__tests__/emails/`. It is the first thing to fail when the instructor writes
something new, and that is the point: the 25 Aug email arrived on a second
template and failed it on 28 lines.

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
  with a number that is not a rep count. Minutes work anywhere seconds do:
  "1 minute", "2 min", "1.5 minutes".
- **"N sec each" retimes the list only on a line of its own.** A bulleted
  "Side Plank - 30 seconds each side" is a step stating its own per-side time,
  not a directive; reading it as one used to delete the step silently and retime
  everything after it.
- **A line is split only when both halves state a count.** "20 × Front Punches +
  20 × Uppercuts" is two movements, with or without the ×. "Squat + Shoulder
  Press" is one.
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

The 25 Aug email brought a second template, whose forms name no exercise on the
line that times them. That needs one idea the rest of the grammar does not have:

- **A directive can license the line below it.** "30 sec WORK", "Minute 4",
  "LAST 20 SECONDS" and "Every time you finish a round:" all state a step without
  naming one, so the next BARE line becomes that step. Bare lines are otherwise
  still reported, because once the bullet is gone a heading, an instruction and an
  exercise look alike. Read as steps in their own right, the five "30 sec WORK"
  lines of a 30/30 block produced five steps called "WORK" and lost all five
  exercises.
- **An EMOM's minute is the unit, and it is an ordinary timed step.** "Minute 1:
  12 × Bicep Curls" is sixty seconds labelled twelve reps, so an EMOM needs no
  primitive of its own. A minute whose step states a SHORTER time of its own gets
  the balance back as rest, since the minute is fixed. A joined pair inside a
  minute is NOT split the way a bulleted line is: that would run the minute twice.
- **"Repeat 2 rounds" may come after the steps it repeats.** One email states the
  round count above the block and the next states it below. Read after a run of
  loose steps it wraps them, but only where the section is still a plain list: a
  section that has already stated a ladder or a round keeps it.
- **An AMRAP is the clock, so it becomes one.** The ten minutes is stated, so it
  is read: a single timed step of that length, named "As many rounds as possible",
  with the round as its `note` so the panel beside the countdown shows it for the
  whole ten minutes. What the text does not say is HOW MANY rounds, and nothing
  invents one: that number is the person's to make, live. An AMRAP with no stated
  length has no clock to build and stays a note.

  The first attempt kept the exercises as steps and the cap as a note. That was
  worse than a skipped line: with no clock and one pass through the list, the app
  quietly turned a ten-minute block into a single round and said nothing. Refusing
  to invent a round count was right; letting the stated ten minutes go with it was
  not. **Read what the text states, and leave only what it does not.**
- **A marker in front of a heading is read past and then kept.** "(Optional) 🔥
  Final Burnout" is the Final Burnout section, named "(Optional) Final Burnout":
  whether a block is optional is the reader's to know.

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
`.tabata` file put through the importer, because its exercise runs are groups of sets
and the importer deliberately never infers those. The `.tabata` files still in this
folder are importer test fixtures now. They are not in the app's import graph, so
they cost nothing in the bundle.

Their ids are stable and deliberate, because seeding is keyed on them and recorded
as "once, ever": the routine is offered a given install one time, and stays deleted
if deleted. Keeping the *old* id through the reps rewrite means an install that
already has it is not offered the new version. Nothing about what plays changed, and
quietly replacing a routine someone may have edited is the worse trade.

## The image catalogue

The illustrations that **ship with the app**, under `public/exercises/`. Each entry is
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
| `foldName.ts` | The ONE way to ask whether two written names are the same exercise |
| `loads.ts` | Filling a step's empty weight in from the weights page, and taking a stated one back off |
| `rename.ts` | Putting a step's exercise back under the name the table knows it by |
| `estimate.ts` | Roughly how long a routine takes, including the parts that have no length |
| `exercises.harvested.ts` | GENERATED. Movements the authored tables never named |
| `exercises.prescription.ts` | GENERATED. How each movement is prescribed: reps, seconds, seconds-per-rep |
| `exercises.shapes.ts` | GENERATED. The ladders and section themes the instructor actually writes |

## Writing text back out

`writeRoutine.ts` is the inverse of `pasteFormat.ts`, and deliberately a NARROW
one. The parser reads a handout, so many surface forms land on the same blocks;
the writer picks exactly one form per block and the round-trip test proves the
choice reads back.

Three rules earned the hard way, all pinned by tests:

- **`Then:` closes a rounds group, not an AMRAP.** An AMRAP's round collects
  bullets until a section HEADING arrives, so the AMRAP form is only written
  where a heading or the end of the text follows it. Anywhere else it is written
  as the plain countdown it is, and the round is reported as lost.
- **A group's children are siblings too.** The separator rules have to run inside
  a section and inside a rounds group, not only at the top level, or a step after
  a nested group is read into it.
- **The parser's own five-second get-ready is not written back.** It is prepended
  LOOSE, above any section, and writing it as a bullet would put it inside the
  first section instead, so the routine would sink one level on every trip.

The property the tests hold is not `write(read(x)) === x`, which is false: the
parser normalises, and no writer can undo that. It is that **the second pass
changes nothing**. Everything the format cannot say is collected in `lost` and
shown to the user, because a share that quietly drops 23 illustrations looks
like it worked.

## Generating a routine

`exercises.ts` is one table of 147 movements, in three parts that are trustworthy
in different ways. `exercises.machine.ts` is GENERATED from the Horizon Torus
guide by `scripts/exercise_metadata.py`: station, muscle group, attachment and
per-side are all read out of the manual, the muscle group being the colour of
each page's title band. `exercises.other.ts` is hand-authored from
`strength-training.routine.json` and the email fixtures, so the vocabulary is
the one these routines are actually written in. `exercises.harvested.ts` is
GENERATED by `npm run harvest` from the instructor routines in `__tests__/emails`, and holds
what the other two never named.

`exercises.other.ts` is defined by the guide having no PICTURE of a movement,
not by the multi-gym being unable to do it. A machine exercise the guide leaves
out — the Low Pulley Squat — lives there, because the generated table can only
hold what the guide draws.

Two more tables come out of the same harvest. `exercises.prescription.ts` says how
each movement is prescribed, including a seconds-per-rep rate for the ones the
instructor has written both ways. `exercises.shapes.ts` holds the ladder
pyramids he actually writes, used VERBATIM, and the section themes in the
order his routines use them.

Equipment is a FIELD, not a partition. Asking for a multi-gym routine filters;
it does not select a different table. That matters because the machine has five
torso exercises, so a torso-focused session needs somewhere to go.

`generate.ts` is pure and builds two shapes. A **circuit** is timed throughout, so
its length is SOLVED rather than estimated: exercises are added one at a time and
each one's real cost is known, so a per-side exercise costing two groups and a
band or ankle-strap one costing five more seconds are exact. **Sections** is the
shape the instructor's routines arrive in — named sections, ladders, counted reps
— and it has no length at all, because a self-paced step ends when you tap Next.
That shape is asked how many SECTIONS instead of how many minutes. Both shapes
open on a get-ready. The circuit's is the fifteen seconds before its first set.
The sections one gets the parser's five seconds, loose and above the warm-up,
so a generated routine and a pasted one start the same way and Send as text
treats them alike.

`rng` is injected, so a seed pins a routine and "Try another" differs.

The generator writes down no weight the weights page can supply. An empty load
reads that page every time the routine is opened, so changing a number there
changes every routine at once; stamping it in would freeze it at what you lifted
the day it was generated. Only an exercise the page has never heard of takes its
weight from what your last routine said.

Three rules worth knowing, all pinned by tests:

- **Areas alternate**, which is what makes the output read like the routines it
  learned from. "Never the same area twice" applies only where there is another
  area to alternate with, or asking for the torso alone stops after one exercise.
- **The first exercise gets no announcement.** The announcement is what you read
  while the cardio minute runs, and the first comes straight off the warm-up.
- **A filter the user set is never widened quietly.** Multi-gym only reports a
  shortfall rather than supplementing; only `mixed` supplements.

## One name, many spellings

`foldName.ts` is the ONE answer to "are these two written names the same
exercise". It was briefly two, and the harvests then disagreed about how much of
the same corpus they recognised, which reads as data rather than as a bug. It
drops brackets, counts, per-side qualifiers, the side itself, hyphens and a
plural, so "10x Bicycle Crunches (per leg)" and "Bicycle-Crunch" arrive as
`bicycle crunch`.

Folding alone is not enough to match a step to an exercise. The table takes its
names from the manufacturer's guide; a routine is written by a person in a hurry.
"Seated Ab Crunch" and "Seated Abdominal Crunch" are the same machine and fold
differently, and that difference cost the weights page a whole exercise until it
was found. So two lookups sit on top of the fold, and they use the same two
passes on purpose:

- `findLoad()` in `loads.ts`, for a weight.
- `canonicalName()` in `rename.ts`, for the name itself.

Both try the exact fold, then match word by word with a shorter word allowed to
start a longer one — `ab` finds `abdominal`. The shape has to line up exactly,
same number of words in the same order, which keeps `Incline Chest Press` away
from `Incline Cable Converging Chest Press` and `abductor` away from `adductor`,
since neither of those starts the other. **Two candidates return nothing.** A
wrong number gets loaded onto a stack.

Keep the two in step. A step the weights page can answer for is exactly a step
the rename can fix, and a rule that held in one and not the other would be a bug
waiting to be found in the gap.

## Weights a routine does not state

`loads.ts` is the rule that makes the weights page work: **an empty `load` does
not mean unloaded**, it means "whatever I lift for this". It is filled in on the
way into a run, a text export and the editor's placeholder, and never written
back, so one number on the page changes every routine that does not disagree. A
step that DOES state a load keeps it, because it is overriding on purpose.

`stripLoads()` is the other direction and the destructive one. Routines written
before the page carry their own weight on every step, so they override it
forever; this is how they let go. A step whose exercise the page cannot answer
for keeps its weight, since the routine is then the only record of it.

## How long a rep-based routine takes

`estimate.ts` returns both halves — the timed steps exactly, the counted ones at
a seconds-per-rep rate — and the caller says which it has. `totalDurationMs`
alone reads zero for a routine of counted exercises, which is truthful and
useless.

The rate is harvested, not chosen: the instructor writes fourteen exercises both
ways, a 30-second Plank one week and 20 × Plank another. It runs from one second
to six, which is why a single flat rate would be wrong by six times at the edges.
A rate measured from your own runs (`storage/paces.ts`) beats it.

What no rate will ever know is how long you rest. So the answer is "about 35
minutes", never "35:20", which is a promise only the timed shapes can keep.

## Renaming steps

`rename.ts` puts a step's exercise back under the table's name, behind
**Routines › Tidy n exercise names**.

What it will not do matters more than what it will. A step is called far more
than its exercise: "Get ready: 12 × Seated Ab Crunch 15kg (bodyweight)" is an
announcement, a count, an exercise, a weight and a note. Only the exercise is
touched and everything else is put back exactly where it was — a rename that
quietly dropped "(knees or toes)" would be deleting the only record of the easier
option. A name matching two exercises is left alone, and so is one matching none:
renaming "Squat + Shoulder Press" to whichever half came first would be worse
than leaving it unreadable.

`ALIASES` is a short list of bare names with one obvious owner, and holds exactly
one entry — "Chest Press" is the standard one, since the table has five and no
plain one. "Shoulder Press" is deliberately absent: a dumbbell exercise already
owns that exact name, and nothing in a step can tell the two apart.

## The harvests

`npm run harvest` runs the scripts in `scripts/` over the instructor routines in
`__tests__/emails` and rewrites three generated tables. Three traps
paid for, all worth remembering:

- **A harvest must not treat its own output as an input.** Comparing against
  `EXERCISES`, which includes the generated file, made the second run see its own
  rows as already known, write none, and silently drop them from the
  table. It compares against the authored tables only.
- **One folding, not two.** See above.
- **Some harvested durations are the FORMAT's.** An EMOM minute is sixty seconds
  because the EMOM says so, not because a bicep curl takes a minute. Sets are
  capped at 45s for that reason, and 60s is excluded from the rate derivation.
