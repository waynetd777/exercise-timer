# storage

IndexedDB, the routine library, the export format and share links.

## Why IndexedDB, not localStorage

localStorage's ~5MB quota plus base64's 33% inflation cannot hold images. Two
stores were created at version 1 — `workouts` keyed by id, `media` keyed by
content hash — so the media work was an addition rather than a schema migration.

`requestPersistence()` asks the browser not to evict the origin. Without it, a
routine's saved images can simply disappear under storage pressure.

## Pure rules, thin IO

`library.ts` holds the ordering and naming rules and is fully tested;
`workouts.ts` is deliberately dumb IndexedDB access; `useLibrary.ts` only wires
them to React. IndexedDB itself is not tested and does not need to be — keep it
that way rather than adding a fake.

The rules that earned tests:

- **Favourites pin above every sort mode.**
- **A never-run routine sorts *below* one that has run**, rather than reading as
  timestamp zero and jumping to the top.
- **Copy numbering does not stack suffixes** — "Leg day (copy 2)", never
  "Leg day (copy) (copy)".
- **`markRun` must not touch `updatedAt`.** Running a routine is not editing it.

## Migration happens on read, not in place

`migrate.ts` applies forward-only fixes as a routine *enters* the app, at all
three entry points — IndexedDB, an imported bundle, a share link. Nothing is
rewritten in place, so an export opened next year is fixed exactly the way today's
stored routines are, and no schema step has to run before anything can be read. It
returns its input unchanged when there is nothing to fix, so React sees no
needless new objects.

Two fixes exist today.

**Repeat labels.** Groups were called "rounds", and every one the editor created
stored the literal label `'Round'`. The label is **data**, so a code-only rename
would have left existing routines saying "Round 2 of 3" forever. Only the exact
former defaults are renamed — a group someone deliberately called "Round 1" keeps
its name. Any future rename of a stored label needs the same treatment.

**Rehosted illustrations.** The catalogue was 27 postimages links and is now 43
images that ship with the app, so `REHOSTED` maps every URL it ever held — the two
duplicate uploads included, and the four whose filenames changed — onto a bundled
path. A pinned copy is dropped with the link, which costs nothing: a bundled image
is precached. This is not a repair of something broken; the old links still work.
It is how the dependency gets cut without anyone losing a picture.

Both walk **every** group, not just repeats. That was a real gap: the walk used to
return a section or a ladder untouched, so a nested repeat never had its label
fixed — and since a pasted routine is nothing but sections, the image rewrite
would have missed exactly the routines that matter most.

## Seeding is once per id

Tracked in `seeded.ts` rather than "seed when the library is empty". That way a
newly added seed reaches an existing install, and a seeded routine that gets
deleted stays deleted.

## The export format

One JSON file, versioned from the start: `{ kind, version, exportedAt, workouts,
media }`. `kind` is a marker so the importer never has to guess, and a file from a
*newer* version is refused rather than half-read.

**`media` carries the photos**, keyed by content hash, as data URLs
(`bundleMedia.ts`). The split is the point:

- A **bundled** illustration needs no bytes — it is a short path, and the app on
  the other side already has the picture. This is what keeps an export small.
- An **uploaded** photo exists nowhere but the device that took it, so it has to
  travel in the file or it does not travel at all. Since the image-link field was
  removed, this is the only route to another device.

Base64 costs a third, so a photo lands at 80–130KB and a library of them is a
couple of megabytes — an AirDrop, not an email. Photos are always included: an
export that quietly loses a picture is the worse failure.

Every entry is **re-hashed on the way in** and compared against its key. Storage
is content-addressed, so a key that lied would poison the store for every routine
sharing that hash, and re-hashing a file just read off disk costs a millisecond. A
bad entry is skipped and counted, never thrown: the routines still import and the
notice says how many pictures were dropped.

Both exports go through one function in `LibraryScreen`, so **Export all** and a
routine's own file button cannot drift into carrying different things.

## Share links

`shareLink.ts` gzips a routine into a URL fragment, which takes a real 86-step
routine under 4,000 characters. Local blobs are dropped, since a link cannot carry
them, and counted so the sender can be told — the routine's own **file** export is
the one that takes photos, which is why the two buttons sit side by side on a row
and their titles say which is which. The app's own illustrations travel fine in a
link: they are a short path, not bytes. The recipient gets a fresh id and none of
the sender's favourites or run history: it is their copy now.

## Files

| | |
|---|---|
| `db.ts` | Connection, stores, persistence request |
| `library.ts` | Pure ordering, naming and stamping rules |
| `migrate.ts` | Forward-only fixes applied on read |
| `workouts.ts` | IndexedDB CRUD |
| `useLibrary.ts` | React wiring, seeding, and the orphan sweep on delete |
| `seeded.ts` | Which seeds have been offered |
| `bundle.ts` | The versioned export format |
| `bundleMedia.ts` | The photos in an export: collected on the way out, re-hashed on the way in |
| `shareLink.ts` | Routine ↔ URL |
| `download.ts` | Handing the user a file, and the clipboard |
