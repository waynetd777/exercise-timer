# STATUS — exercise-timer

> Single source of truth for resuming work. Read this FIRST when starting a session.
> Update this file at the end of every work phase so the next `/clear` resumes in 1 read.
> Last updated: 2026-08-20

---

## ✅ Done

- Created blank private GitHub repo: https://github.com/waynetd777/exercise-timer (empty; local dir not yet `git init`-ed)
- Agreed product shape + architecture (see Closed decisions)

---

## 🚀 Next phase — Phase 1: engine

**Goal:** Build `src/engine/` — the pure, DOM-free interval-timer core plus its test suite.

### Acceptance criteria
1. `compile(workout)` flattens a recursive `Block[]` (segments + nested `repeat` groups) into a flat `TimelineEntry[]` with absolute `startMs`/`endMs` and a `path` for "Round 3 of 8" labels.
2. `TimelineEntry` carries the segment's optional `media?: MediaRef` through, so `RunScreen` reads it directly off the current entry.
3. `position(timeline, elapsedMs)` returns `{ entry, nextEntry, remainingMs, totalRemainingMs }` — pure, binary search, correct at every boundary (0ms and exact end). `nextEntry` exists so the UI can preload the next image.
4. `cues(timeline)` returns absolute-time cue points (3-2-1 countdown, phase change, workout complete).
5. Vitest suite covers: classic Tabata (20/10 ×8), a named circuit, 2-level nested repeats, `times: 1`, empty workout, boundary-exact `elapsedMs`, media passthrough.
6. `totalDurationMs(workout)` exposed so the Library can show a routine's length without a full run.
7. Zero imports from React/DOM in `engine/`.

### Files to create / edit
| Type | File | Content |
|---|---|---|
| new | `package.json`, `tsconfig.json`, `vite.config.ts` | Vite + React + TS + vitest scaffold |
| new | `src/engine/types.ts` | `Block`, `Workout`, `TimelineEntry`, `SegmentRole`, `CuePoint`, `MediaRef` (3-source union) |
| new | `src/engine/compile.ts` | `Workout` → `TimelineEntry[]` (flatten repeats, accumulate offsets, build path, carry media) |
| new | `src/engine/runtime.ts` | `position(timeline, elapsedMs)` — pure lookup |
| new | `src/engine/cues.ts` | `TimelineEntry[]` → `CuePoint[]` |
| new | `src/engine/__tests__/*.test.ts` | Fake-clock unit tests |

### Closed decisions
- **Platform: installable web PWA** (React + TypeScript + Vite), responsive across phone / iPad / laptop. Chosen over native for iteration speed and no App Store. Accepted tradeoff: will not run reliably with an iPhone screen locked / in pocket.
- **Scope: full interval builder**, not fixed Tabata. Arbitrary named segments in arbitrary sequences.
- **Authoring model: recursive block tree** — `segment | repeat{times, children}`. One primitive yields Tabata, circuits, pyramids, nested sets. Data model nests arbitrarily; editor UI capped at 2 levels for the first editor pass.
- **Runtime model: compile-to-flat-timeline.** Compile once on start; runtime is a pure `(timeline, elapsedMs) → position` binary search. Makes skip/seek trivial and the engine testable with a fake clock.
- **Clock: timestamp-derived, never tick-accumulated.** State is `{ startedAt, pausedTotalMs, status }`; `elapsed = now - startedAt - pausedTotalMs`. Avoids drift and background throttling.
- **Audio: Web Audio pre-scheduling** on `AudioContext.currentTime`, rolling ~30s lookahead re-armed on `visibilitychange`. Unlock AudioContext on first user gesture (mobile autoplay policy).
- **Steps can have images.** One optional static image per segment (`media?: MediaRef`).
- **Media type: static images only.** JPEG/PNG/WebP in. No GIF (can't downscale without losing animation; 5-10MB per clip), no video for now — `MediaRef` can gain a video source later without a migration.
- **Three media sources, one resolver.** `MediaRef` is a discriminated union:
  - `{ source: 'remote', url, cachedHash?, w?, h? }` — **the primary source.** User already hosts Tabata exercise images on postimages (e.g. `https://i.postimg.cc/jCGnZ34t/Cable-Fly.png`) and wants to keep using them.
  - `{ source: 'bundled', path, w, h }` — curated set committed to `public/exercises/`, served same-origin. Exports as a short path, so routines using only bundled images fit in a URL share link.
  - `{ source: 'local', hash, mime, w, h }` — own photos via the downscale → content-hash → IndexedDB pipeline.
  `resolveMedia(ref) → url` hides the difference from all UI.
- **VERIFIED 2026-08-20 (curl):** `i.postimg.cc` returns `access-control-allow-origin: *` and `cache-control: max-age=315360000`. Remote images can therefore be fetched, read as Blobs, canvas-processed and pinned locally — remote is not a one-way door. Existing images are ~31KB, so no downscale needed (only downscale a remote fetch if >300KB).
- **VERIFIED 2026-08-20 (curl):** the filename segment of an `i.postimg.cc/<id>/<name>.<ext>` URL is ignored — any name or extension returns the image; only a bare trailing slash 404s. So paste-normalise `postimg.cc/<id>` → `https://i.postimg.cc/<id>/img.png` and accept either URL form in the picker. The `postimg.cc` *page* has no CORS, but it never needs to be read. Caveat: a share-link id may map to a resized variant (one page exposed 3 ids for the same image); if quality is off, paste the direct link.
- **"Pin for offline" on remote refs.** Best-effort `fetch` → Blob → hash → IndexedDB, then set `cachedHash`; the resolver prefers the local copy and falls back to the network. Makes routines survive both gym wifi and postimages link-rot. Non-blocking; triggered per-routine or on first successful run.
- **Storage: IndexedDB from the start**, not localStorage. localStorage's ~5MB quota plus base64's 33% inflation cannot hold images. Two stores: `workouts` (JSON, keyed by workout id) and `media` (Blob, **keyed by sha256 content hash**). Content-addressing dedupes an image reused across many segments for free.
- **Mandatory downscale pipeline on import:** decode → canvas resize to 1024px long edge → WebP q0.8 → ~100KB Blob → hash → store. Never store the original phone photo (3-5MB). All input sources (photo picker, camera capture, drag-drop, clipboard paste) are just `Blob`s and feed this one path.
- **Portability: export/import a single `.json` bundle** with images inline as base64 (~1-1.5MB for a 10-step workout), moved by AirDrop / Files. **No backend, no sync** — judged unjustified for a single-user timer, and a server would make the app offline-breakable.
- **Share links now mostly work:** remote and bundled refs export as short strings, so only `local` photos force a large bundle. A routine built from postimages or bundled images fits in a URL.
- **Hosting deliberately left open.** All bundled asset paths go through `import.meta.env.BASE_URL` from phase 1, so a root-domain host and a subpath host (GitHub Pages `/exercise-timer/`) both work with no retrofit. Recommendation on record for phase 7: Cloudflare Pages — free tier deploys private repos, serves from the root, good SW caching. GitHub Pages needs Pro for a private repo and publishes a public site.
- **Responsive = layout only.** One component set; phone portrait is fullscreen countdown, iPad/laptop adds upcoming-segment rail + editor via container queries.
- **Routine library is first-class: build / save / load any number of routines.** The `workouts` store is keyed by id, so unbounded count is free — what this adds is a Library screen as the app's home: list, create, duplicate, rename, delete, and load into either the runner or the editor.
- **`Workout` carries library metadata:** `createdAt`, `updatedAt`, `lastRunAt`, `favourite`, `estimatedTotalMs` (derived at save time so the list can show durations without compiling every routine).
- **Library UI: flat searchable list**, not folders. Sorted by recently-run with favourites pinned, plus a name filter. Folders/tags are deferred until a flat list actually hurts.
- **Media garbage collection on delete.** Because media is content-addressed and shared across routines, deleting a routine must not delete images another routine still uses. On delete: collect the hashes still referenced across all remaining workouts, drop the orphans. Run the same sweep on app start to catch interrupted deletes.
- **Export at two scopes:** a single routine (`.json` bundle, AirDrop-sized) and a whole-library backup (all routines + deduped media). Import merges by id, prompting on collision.
- **Deferred:** workout history/logging, voice announcements, sound packs, Apple Watch, video media, folders/tags, any server.

### Open decisions
- Styling approach (plain CSS + custom properties vs Tailwind) — decide at phase 2.
- Run-screen image treatment: fullscreen behind the countdown, or a bounded panel beside/above it? Decide at phase 2 with something on screen to look at.
- Wake-lock fallback: silent looping audio, or accept Screen Wake Lock API support only? Decide at phase 7.

---

## 📁 Active architecture

- **Stack:** React + TypeScript + Vite, vitest. IndexedDB for persistence. PWA (service worker) from phase 6. No backend.
- **Key modules:**
  - `src/engine/` — pure interval-timer core (compile / position / cues). DOM-free, unit-tested.
  - `src/audio/` — AudioContext unlock + `scheduleAt(time, tone)`.
  - `src/media/` — `resolveMedia` (remote/bundled/local), postimages URL normaliser, import pipeline (downscale + hash), IndexedDB blob store, objectURL cache, offline pinning.
  - `src/state/` — `useTimer` (rAF loop, wake lock), `storage` (IndexedDB workouts, versioned schema, export/import).
  - `src/ui/` — `LibraryScreen` (home), `RunScreen`, `SegmentRail`, `WorkoutEditor`, `BlockRow`, `ImagePicker`.
- **Patterns:** engine stays pure and DOM-free; all time derived from timestamps, never accumulated; audio scheduled ahead on the audio clock, not fired from JS ticks; images content-addressed and always downscaled before storage.

### Build order
| Phase | Deliverable |
|---|---|
| 1 | `engine/` + tests (types include `MediaRef`) |
| 2 | RunScreen — countdown, phase colour, start/pause/reset/skip; image slot stubbed |
| 3 | Audio cues |
| 4 | Media pipeline — `resolveMedia` over all 3 sources, postimages URL normaliser, IndexedDB blob store, downscale, content-hash, objectURL cache, pin-for-offline, next-image preload |
| 5 | LibraryScreen — list / create / duplicate / rename / delete / load routines, search + sort, media GC |
| 6 | WorkoutEditor — block tree editing + image picker (photo/camera/drag/paste) |
| 7 | PWA install, wake lock, offline, export/import (routine + library backup), share links, design pass |

---

## ⚠️ External blockers (don't block coding)

- Local dir is not yet a git repo. To wire up: `git init && git remote add origin https://github.com/waynetd777/exercise-timer.git`

---

## 🔧 Useful commands

```bash
# (fill in once scaffolded)
# npm run dev     — Vite dev server
# npm test        — vitest engine suite
```

---

## 📚 References (read IF needed)

- `.wolf/cerebrum.md` — User Preferences + Do-Not-Repeat + Decision Log
- `.wolf/anatomy.md` — token-efficient file index
- `.wolf/buglog.json` — known bugs + fixes
