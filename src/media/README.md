# media

Images: the illustrations that ship with the app, and photos stored by content and
downscaled on the way in. Either way a routine keeps its pictures without the
network.

## Content-addressed

Blobs are keyed by their sha256, not by a name. The same illustration used across
eight steps and three routines is therefore stored exactly once, and re-adding a
file you already have costs nothing. `hash.ts` has a test asserting the known
digest of `"abc"`, so the algorithm cannot change silently.

The consequence is that **deleting a routine cannot simply delete its images,**
because another routine may point at the same bytes. `gc.ts` computes the live set
across the *whole remaining library* and deletes only the orphans. It is pure set
arithmetic, which is the only safe way to decide it.

The sweep also respects **draft pins** (`pin.ts`): a blob held by an unsaved
editor draft, or one just written during an import before its routine lands, is
referenced by nothing persisted yet, and without a pin a concurrent delete would
collect the bytes a routine is about to point at. Pins are counted, not boolean,
because storage is content-addressed and two drafts can hold the same image.

## Downscaling is not optional

A phone camera file is 3 to 5MB, and a handful would exhaust the origin's storage
quota. `downscale.ts` re-encodes to WebP at a 1024px edge. It skips files already
under 300KB, where re-encoding costs more than it saves, and keeps whichever result
is smaller, since re-encoding an already-optimised PNG can grow it.

Failures return the original rather than losing the image. HEIC does not decode
outside Safari, and storing an oversized file beats storing nothing.

## Three sources, one of which is history

- **`bundled`** is the illustration catalogue, served from the app's own origin out
  of `public/exercises/`. Precached by the service worker, so it needs no network
  and no pinning: it is there the moment the app installs.
- **`local`** is a photo from this device: picked with the file button, or pasted off
  the clipboard. Downscaled on the way in and stored by content hash in IndexedDB.
  It reaches another device only inside an export file, which carries the bytes as a
  data URL. See `storage/bundleMedia.ts`. A share link cannot take one, and says so.
- **`remote`** is a link, and **nothing creates one any more.** The editor's link
  field and `pinRemote` are gone, and `.tabata` imports have their URLs rewritten
  to bundled paths on the way in (`storage/migrate.ts`). The branch stays in
  `resolvePlan` because a routine saved before the move may still carry one, and
  `gc.ts` still counts a pinned copy as live.

Pasting a URL only made sense while the pictures lived on someone else's server.
Getting an image *to* a URL is the painful half of that arrangement, and the host
that served the old catalogue blocks automated uploads outright. Every axis that
matters here favours the two that are left: no account, no third party, nothing to
fetch, and a downscale you cannot forget.

## Resolution, in two passes

`resolvePlan` is pure and decides *what* a ref resolves to. `resolveMedia` then
reads the blob if needed. `ui/useMediaUrl.ts`, which lives with the components that
use it rather than here, calls the synchronous path first and the asynchronous one
second. Without that first pass, every image flashes blank on a step change while
IndexedDB is read.

Object URLs are cached per hash and not revoked while the app lives. A routine shows
the same image many times, and revoking on unmount would break a step still on
screen. The cache is bounded by the number of distinct images in a routine.

## Files

| | |
|---|---|
| `hash.ts` | sha256 of a blob |
| `gc.ts` | `liveHashes`, `orphanedHashes` and `hashesIn` (the refs in a record of unknown shape, for the routines `readWorkouts` cannot read), all pure |
| `resolve.ts` | `resolvePlan`, the pure resolution rules |
| `resolveMedia.ts` | Blob reads and the object URL cache |
| `store.ts` | IndexedDB blob access |
| `downscale.ts` | Canvas to WebP |
| `pin.ts` | `storeFile`, the one way an image now enters storage, and the draft pins the sweep respects |
| `dataUrl.ts` | Blob to data URL and back, so a photo can travel inside an export file |
| `clipboard.ts` | Whether the clipboard holds an image, and the blob when it does |
