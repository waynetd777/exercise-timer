# storage

IndexedDB, the routine library, the export format, share links, and the small
things kept per device: your weights, your exercise pictures, your pace, and the
exercises you added yourself.

## Why IndexedDB, not localStorage

localStorage's 5MB quota plus base64's 33% inflation cannot hold images. Two stores
were created at version 1, `workouts` keyed by id and `media` keyed by content
hash, so the media work was an addition rather than a schema migration.

A few small things live in localStorage, on purpose: the seeded-routine marker
(`seeded.ts`), the mute switch, and `weights.ts` and `paces.ts`. The last two are
per-device, and neither belongs inside a routine: what you lift is a
property of your gym, and how fast you work is a property of you. A new IndexedDB
store would mean a version bump and a migration on every install for a handful of
strings. Both read synchronously, which is what lets every render ask.

`requestPersistence()` asks the browser not to evict the origin. Without it, a
routine's saved images can simply disappear under storage pressure.

## Pure rules, thin IO

`library.ts` holds the ordering and naming rules and is fully tested. `workouts.ts`
is deliberately dumb IndexedDB access, and `useLibrary.ts` only wires them to
React. `db.test.ts` carries a hundred-line sliver of IndexedDB, scripted opens and
one-request transactions, enough to prove the self-healing paths (a failed or
throwing open is not cached, a dead connection is reopened) and add-only seeding.
Keep it to that; the rules live in `library.ts` and need no fake at all.

The rules that earned tests:

- **Favourites pin above every sort mode.**
- **A never-run routine sorts *below* one that has run**, rather than reading as
  timestamp zero and jumping to the top.
- **Copy numbering does not stack suffixes:** "Leg day (copy 2)", never
  "Leg day (copy) (copy)".
- **`markRun` must not touch `updatedAt`.** Running a routine is not editing it.

## Migration happens on read, not in place

`migrate.ts` applies forward-only fixes as a routine *enters* the app, at all three
entry points: IndexedDB, an imported bundle and a share link. Nothing is rewritten
in place, so an export opened next year is fixed exactly the way today's stored
routines are, and no schema step has to run before anything can be read. It returns
its input unchanged when there is nothing to fix, so React sees no needless new
objects.

Five fixes exist today: repeat labels, ladder labels ("Set" to "Rung"), rehosted
images, the AMRAP note split, and the trailing load lifted out of a name.

**Repeat labels.** Groups were called "rounds", and every one the editor created
stored the literal label `'Round'`. The label is **data**, so a code-only rename
would have left existing routines saying "Round 2 of 3" forever. Only the exact
former defaults are renamed, so a group someone deliberately called "Round 1" keeps
its name. Any future rename of a stored label needs the same treatment.

**Rehosted illustrations.** The catalogue was 27 postimages links and is now 43
images that ship with the app, so `REHOSTED` maps every URL it ever held onto a
bundled path. That includes the two duplicate uploads and the four whose filenames
changed. A pinned copy is dropped with the link, which costs nothing, because a
bundled image is precached. This is not a repair of something broken: the old links
still work. It is how the dependency gets cut without anyone losing a picture.

Both walk **every** group, not just repeats. That was a real gap. The walk used to
return a section or a ladder untouched, so a nested repeat never had its label
fixed, and since a pasted routine is nothing but sections, the image rewrite would
have missed exactly the routines that matter most.

## Seeding is once per id

Tracked in `seeded.ts` rather than "seed when the library is empty". That way a
newly added seed reaches an existing install, and a seeded routine that gets
deleted stays deleted.

The write itself is **add-only** (`addWorkoutIfMissing`): the marker lives in
localStorage while the routines live in IndexedDB, the two evict independently,
and a lost marker used to lay the pristine seed over an edited copy of the same
id. Losing the marker may re-offer a deleted seed, which is harmless; overwriting
an edit is not.

## What you lift

`weights.ts` holds one weight per exercise, keyed by folded name. It starts EMPTY.
It used to ship one person's numbers as seeds, which put weights that were not the
owner's on every other install; a looked-up number before that was wrong in every
case (strengthlevel said 30kg for a shoulder press against a real 10, because a
home stack is not the machine that site measures). An empty field asks the
question, and "Fill from my routines" answers it from the device's own evidence.

Rules that are not obvious:

- **An empty value removes the key**, so the store holds only what has a number.
  Older stores recorded a cleared field as an empty string, to override a seed
  that no longer exists; those read as absent.
- **The parsed table is cached and dropped on save.** The library asks once per
  row.

The resolution rule lives in `routines/loads.ts`, not here. See that README.

## What an exercise looks like

`customExercises.ts` is the fourth table keyed by folded exercise name, and the
only one holding the exercise ITSELF rather than something about it. The shipped
table (`routines/exercises.ts`) is a build-time constant and read-only; this is
what makes a typed name into an exercise the app knows, with the area, the
push-or-pull and the `use` the generator needs to programme it. Two consequences
worth knowing:

- it needs no `refold.ts` pass, unlike the other three: the record carries its own
  name, so every read re-keys from that.
- a name the shipped table has since acquired is DROPPED on read. Two rows under
  one key would fight over one weight and one picture, and the app's own record
  wins. Nothing is lost: the weight and picture were never keyed to this table.

`pictures.ts` is the same idea as `weights.ts`, one `MediaRef` per exercise, keyed
the same way, and it exists because 105 of the 147 exercises had no picture
anywhere: the guide only draws the machine, so the only way to see a press-up was
to attach a photo to a step, in every routine that used it, one at a time.

Three things about it that the weights table does not have to think about:

- **The guide is the floor.** `currentPictures()` starts from the illustrations
  that ship with the app and lets the stored table override them, so the table
  holds only what it ADDS, and a routine typed by hand still shows the machine it
  names.
- **The blob sweep needs it as a root.** These photos are referenced by no step,
  so the walk over the routines in `gc.ts` cannot see them; without the extra root
  the first delete of any routine would collect them. `useLibrary` passes
  `pictureHashes(loadPictures())` into `orphanedHashes` (through `sweep.ts`).
- A record `readWorkouts` cannot read is left in the store WITH its photos: its
  `heldHashes` (found by `media/gc.ts`'s `hashesIn`, a walk over the raw record)
  go into the same sweep as a further root. Without them the first delete of any
  other routine took those photos for orphans.
- **Values are checked on the way OUT**, not only in. What is here is rendered on
  every step of every run, and a hand-edited entry would throw in React rather
  than showing no picture.

## How fast you work

`paces.ts` records the real length of a self-paced step so `routines/estimate.ts`
can stop guessing. Every gate already times itself; the elapsed was being thrown
away.

What it refuses is the interesting half. A gate under four seconds is a DRY RUN,
tapping Next through a routine to see what is in it, and would otherwise teach it
that a twelve-rep set takes half a second. Rates outside 0.5 to 12 seconds a rep
go too, as do gates over eight minutes. Timed steps inside a gate are subtracted
from the elapsed rather than charged to the counted exercise beside them. Three
samples minimum, then the median of the last eight.

## The export format

One JSON file, versioned from the start: `{ kind, version, exportedAt, workouts,
media, weights, pictures, exercises }`. `kind` is a marker so the importer never has to guess, and a file from a
*newer* version is refused rather than half-read.

Every block field is type-checked on the way in (`isBlock` in `bundle.ts`), and
share links pass through the same validation and version gate, because whatever is
accepted is persisted and then rendered on every open: a hand-edited `name: {}` or
`durationMs: "60"` used to import cleanly and crash the routine until deleted.
Routines a bundle carries but that fail validation are reported by name, never
silently filtered.

**`media` carries the photos**, keyed by content hash, as data URLs
(`bundleMedia.ts`). The split is the point:

- A **bundled** illustration needs no bytes. It is a short path, and the app on the
  other side already has the picture. This is what keeps an export small.
- An **uploaded** photo exists nowhere but the device that took it, so it has to
  travel in the file or it does not travel at all. Since the image-link field was
  removed, this is the only route to another device.

Base64 costs a third, so a photo lands at 80 to 130KB and a library of them is a
couple of megabytes. That is an AirDrop, not an email. Photos are always included,
because an export that quietly loses a picture is the worse failure.

Every entry is **re-hashed on the way in** and compared against its key. Storage
is content-addressed, so a key that lied would poison the store for every routine
sharing that hash, and re-hashing a file just read off disk costs a millisecond. A
bad entry is skipped and counted, never thrown. The routines still import, and the
notice says how many pictures were dropped.

**`weights` carries the settings page**, optional and added without a version
bump: an older reader ignores a field it does not know, and a file with no weights
looks exactly like one written before the field existed. It rides along because
most routines now state no weight of their own and read the page instead, so a
restore without it would put back every routine with the numbers missing from all
of them. On the way in they are MERGED over what is already here, the file winning
where both say something, so a restore does not silently drop weights the file has
never heard of.

**`pictures` carries the exercises page's photos**, optional in the same way and
merged in the same way. A whole-library backup carries the WHOLE table, because
that file is the restore; a single routine's backup carries only the entries its
own steps can use (`picturesFor`), because that file is something you send and
sending one routine should not post every photo you own. The weights ride whole
either way: sixty-seven short strings are not a payload. Their BYTES ride in `media` beside a step's own, keyed by
the same content hash, so a photo used both on the page and on a step travels
once; `collectMedia` takes them as its `alsoLocal` argument, since walking the
routines cannot find a photo no step references.

Both exports go through one function in `LibraryScreen`, so **Export all** and a
routine's own file button cannot drift into carrying different things.

## Share links

`shareLink.ts` gzips a routine into a URL fragment, which takes a real 86-step
routine under 4,000 characters. Local blobs are dropped, since a link cannot carry
them, and counted so the sender can be told. The routine's own **file** export is
the one that takes photos, which is why the two buttons sit side by side on a row
and their titles say which is which. The app's own illustrations travel fine in a
link, because they are a short path and not bytes. The recipient gets a fresh id
and none of the sender's favourites or run history: it is their copy now.

## Files

| | |
|---|---|
| `db.ts` | Connection, stores, persistence request |
| `library.ts` | Pure ordering, naming and stamping rules |
| `migrate.ts` | Forward-only fixes applied on read |
| `workouts.ts` | IndexedDB CRUD |
| `useLibrary.ts` | React wiring and seeding. `error` is a failed write; `notice` is the routines this build could not read, kept apart so a successful write does not erase it |
| `sweep.ts` | `sweepOrphans`: the one blob sweep, run after a routine is deleted and after a picture is removed or replaced on the exercises page. Roots: the readable routines, draft pins, the exercises page's pictures, and the photos of unreadable records |
| `refold.ts` | Moves the weights, paces and pictures keys written under an older `foldName` to the current one, once, on first read |
| `seeded.ts` | Which seeds have been offered |
| `bundle.ts` | The versioned export format |
| `bundleMedia.ts` | The photos in an export: collected on the way out, re-hashed on the way in |
| `shareLink.ts` | Routine to URL and back |
| `download.ts` | Handing the user a file, and the clipboard |
| `weights.ts` | One weight per exercise. localStorage |
| `pictures.ts` | One picture per exercise, over the guide's illustrations. localStorage, with the bytes in IndexedDB. A second root for the blob sweep |
| `paces.ts` | How long a rep of each exercise actually takes you. localStorage |
| `customExercises.ts` | The exercises you added yourself: full records, keyed by folded name. localStorage, validated on every read, and merged over the shipped table wherever the app reads it |
