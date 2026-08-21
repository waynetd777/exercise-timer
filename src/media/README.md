# media

Images: stored by content, downscaled on the way in, and pinned locally so a
routine keeps its pictures without the network.

## Content-addressed

Blobs are keyed by their sha256, not by a name. The same illustration used across
eight steps and three routines is therefore stored exactly once, and re-adding a
file you already have costs nothing. `hash.ts` has a test asserting the known
digest of `"abc"`, so the algorithm cannot change silently.

The consequence is that **deleting a routine cannot simply delete its images** —
another routine may point at the same bytes. `gc.ts` computes the live set across
the *whole remaining library* and deletes only the orphans. It is pure set
arithmetic, which is the only safe way to decide it.

## Downscaling is not optional

A phone camera file is 3–5MB, and a handful would exhaust the origin's storage
quota. `downscale.ts` re-encodes to WebP at a 1024px edge — but skips files already
under 300KB, where re-encoding costs more than it saves, and keeps whichever
result is smaller, since re-encoding an already-optimised PNG can grow it.

Failures return the original rather than losing the image: HEIC does not decode
outside Safari, and storing an oversized file beats storing nothing.

## Pinning, and why it is possible

`i.postimg.cc` sends `access-control-allow-origin: *`. That is what makes pinning
possible at all — the bytes can be *read*, not merely displayed — and it is why
a routine can survive both gym wifi and the host eventually losing a file.

A pinned image resolves from its local copy, and falls back to the network if the
blob is ever evicted. A local image has no fallback: better nothing than a broken
image icon.

## Resolution, in two passes

`resolvePlan` is pure and decides *what* a ref resolves to. `resolveMedia` then
reads the blob if needed. `useMediaUrl` calls the synchronous path first and the
asynchronous one second — without that first pass, every image flashes blank on a
step change while IndexedDB is read.

Object URLs are cached per hash and not revoked while the app lives: a routine
shows the same image many times, and revoking on unmount would break a step still
on screen. The cache is bounded by the number of distinct images in a routine.

## Files

| | |
|---|---|
| `hash.ts` | sha256 of a blob |
| `gc.ts` | `liveHashes` / `orphanedHashes` — pure |
| `resolve.ts` | `resolvePlan` — pure resolution rules |
| `resolveMedia.ts` | Blob reads and the object URL cache |
| `store.ts` | IndexedDB blob access |
| `downscale.ts` | Canvas → WebP |
| `pin.ts` | `pinRemote` and `storeFile` |
