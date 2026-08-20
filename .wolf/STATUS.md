# STATUS — exercise-timer

> Single source of truth for resuming work. Read this FIRST when starting a session.
> Update this file at the end of every work phase so the next `/clear` resumes in 1 read.
> Last updated: 2026-08-20

---

## ✅ Done

- Created private GitHub repo: https://github.com/waynetd777/exercise-timer — local repo initialised, `main` pushed
- Agreed product shape + architecture (see Closed decisions)
- **Phase 1 COMPLETE (commit `50e8ea7`)** — scaffold + interval-timer engine
  - Scaffold: Vite 8 + React 19 + TS 7 + Vitest 4. `npm run dev / test / typecheck / build` all working.
  - `src/engine/types.ts` — authoring model (`Segment` | `Repeat`), runtime model (`Timeline`/`TimelineEntry`), `MediaRef` 3-source union, `Position`, `CuePoint`.
  - `src/engine/compile.ts` — `compile()` flattens repeats to an absolute-time timeline (records `path` for "Round 3 of 8", carries media through, drops non-positive durations and repeat counts < 1, rounds fractional ms, throws `TimelineTooLargeError` above 10k steps). Plus `totalDurationMs()` and `stepCount()` for library rows without compiling.
  - `src/engine/runtime.ts` — `position()` binary search; steps own `[startMs, endMs)`; exposes `nextEntry` for image preload. Seek helpers `elapsedAtStepStart` / `skipForward` / `skipBack` (music-player convention, 1.5s restart threshold).
  - `src/engine/cues.ts` — `cues()` precomputed absolute-time cues (phase change, 3-2-1 countdown suppressed when it would collide with a step start, completion) and `cuesBetween()` half-open window for the rolling audio lookahead.
  - **41 tests green**, typecheck + production build clean. Covers Tabata, named circuits, 2-level nesting, degenerate durations/repeat counts, every timeline boundary, non-finite input, cue windowing, and `totalDurationMs`/`stepCount` agreement with `compile()`.
  - `vite.config.ts` `base` reads `VITE_BASE` so root-domain and subpath hosts both work with no retrofit.
- **Phase 2 COMPLETE** — RunScreen, run clock, effort strip
  - `src/state/clock.ts` — the run clock as PURE data + transitions (`Clock` = `{ startedAt, pausedTotalMs, pausedAt }`; `elapsed/started/paused/resumed/seeked`). Extracted from the hook because this arithmetic is the most bug-prone part of the app; 11 DOM-free tests.
  - `src/state/useTimer.ts` — thin React wrapper. **Schedules ONE `setTimeout` to the exact instant the display next changes** (`entry.endMs - (secondsShown - 1) * 1000`), not a 60fps rAF loop: ~1 callback/sec, same precision. Resyncs immediately on `visibilitychange`.
  - `src/state/useWakeLock.ts` — pulled forward from phase 7 (a timer whose screen sleeps is useless). Feature-detected, re-acquires on visibility return.
  - `src/ui/RunScreen.tsx` — idle / running / paused / complete states, countdown, phase colour, path label ("Circuit 2 of 3"), total remaining, step N of M, controls (start/pause/resume/reset/skip both ways).
  - `src/ui/EffortStrip.tsx` — **the signature element.** One sliver per step, width ∝ duration, height ∝ effort (work tall, rest short), so a routine's shape is visible at a glance; doubles as the progress bar.
  - `src/ui/theme.css` + `run-screen.css` — plain CSS + custom properties, container queries. Warm-neutral dark ground; phases coded WARM vs COOL (work amber / rest steel-blue / recover violet / prepare neutral) so they survive colour-vision deficiency and read peripherally. Background carries a faint wash of the phase colour.
  - `src/ui/media.ts` — **PHASE 2 STOPGAP** resolving `remote` + `bundled` only, so real images show now. Phase 4 replaces it with `src/media/resolveMedia`.
  - `src/ui/format.ts`, `src/routines/samples.ts` (Tabata + Upper body circuit using the real Cable-Fly postimages URL).
  - **52 tests green**, typecheck + build clean. 3 bugs found in self-review and fixed before first render — see buglog `bug-002`..`bug-004`.
  - ⚠️ **Not visually verified.** No browser driver installed, so the rendering has never been looked at. Criteria 5 (background 2 min) and 6 (responsive) still need eyes on a device.

---

## 🚀 Next phase — Phase 3: audio cues

**Goal:** Beeps that land on time, including after the tab has been backgrounded.

### Acceptance criteria
1. `AudioContext` unlocked on the first user gesture (the Start tap) — mobile browsers block autoplay, so this cannot be deferred.
2. Cues pre-scheduled on `AudioContext.currentTime`, never fired from a JS tick. Rolling lookahead window (~30s) re-armed on a timer and on `visibilitychange`, using `cuesBetween()` from the engine.
3. Distinct tones: 3-2-1 countdown (short, rising), phase change (firmer), workout complete (a resolved two-note figure). Synthesised with oscillators — no audio files to ship or cache.
4. Pause/resume/seek re-arm the window correctly; no orphaned beeps from the abandoned position.
5. Mute toggle, persisted.
6. Verified: start a routine, background the tab 10 minutes, and the beeps are still on the beat.

### Files to create / edit
| Type | File | Content |
|---|---|---|
| new | `src/audio/engine.ts` | AudioContext lifecycle, unlock, `scheduleTone(atAudioTime, spec)` |
| new | `src/audio/tones.ts` | Tone specs per `CueKind` |
| new | `src/audio/useCueScheduler.ts` | Maps run clock → audio clock, arms the rolling window |
| edit | `src/state/useTimer.ts` | Expose the clock offset the scheduler needs |
| edit | `src/ui/RunScreen.tsx` | Mute toggle |

### Notes for phase 3
- The bridge is one subtraction: `audioTime = ctx.currentTime + (cue.atMs - elapsedNow) / 1000`. Recompute the offset on every re-arm rather than caching it — pause/seek invalidate it.
- iOS suspends the context when the page hides; on return, resume it and re-arm from the current position.

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
- **RESOLVED phase 2 — styling: plain CSS + custom properties.** No Tailwind. A handful of screens, one token file, container queries for layout. CSS ships at ~1.7kB gzipped.
- **RESOLVED phase 2 — images: bounded panel beside the countdown** on wide layouts, stacked below on phone portrait (a bounded panel is impossible "beside" a 390px-wide column).
- **Phase colours are coded warm vs cool, not red vs green** — temperature survives every colour-vision deficiency and is what makes a phase readable peripherally, mid-effort, at three metres. Work amber `#FF7A2F`, rest steel-blue `#52A8CE`, recover violet `#9080E8`, prepare neutral bone (prepare is the absence of effort).
- **`SegmentRail` was cut.** The effort strip plus a single "Next · Rest 20s" line does its job with less furniture.
- **Responsive = layout only.** One component set; phone portrait is fullscreen countdown, iPad/laptop adds upcoming-segment rail + editor via container queries.
- **Routine library is first-class: build / save / load any number of routines.** The `workouts` store is keyed by id, so unbounded count is free — what this adds is a Library screen as the app's home: list, create, duplicate, rename, delete, and load into either the runner or the editor.
- **`Workout` carries library metadata:** `createdAt`, `updatedAt`, `lastRunAt`, `favourite`, `estimatedTotalMs` (derived at save time so the list can show durations without compiling every routine).
- **Library UI: flat searchable list**, not folders. Sorted by recently-run with favourites pinned, plus a name filter. Folders/tags are deferred until a flat list actually hurts.
- **Media garbage collection on delete.** Because media is content-addressed and shared across routines, deleting a routine must not delete images another routine still uses. On delete: collect the hashes still referenced across all remaining workouts, drop the orphans. Run the same sweep on app start to catch interrupted deletes.
- **Export at two scopes:** a single routine (`.json` bundle, AirDrop-sized) and a whole-library backup (all routines + deduped media). Import merges by id, prompting on collision.
- **Deferred:** workout history/logging, voice announcements, sound packs, Apple Watch, video media, folders/tags, any server.

### Open decisions
- Whether to install a browser driver (Playwright) so UI work can be screenshotted and self-reviewed. Currently none, so phase 2 shipped visually unverified. Decide before phase 5/6 (library + editor) — those are much more layout-heavy.
- Wake-lock fallback: silent looping audio, or accept Screen Wake Lock API support only? Decide at phase 7.

---

## 📁 Active architecture

- **Stack:** React + TypeScript + Vite, vitest. IndexedDB for persistence. PWA (service worker) from phase 6. No backend.
- **Key modules:**
  - `src/engine/` — pure interval-timer core (compile / position / cues). DOM-free, unit-tested.
  - `src/audio/` — AudioContext unlock + `scheduleAt(time, tone)`.
  - `src/media/` — `resolveMedia` (remote/bundled/local), postimages URL normaliser, import pipeline (downscale + hash), IndexedDB blob store, objectURL cache, offline pinning.
  - `src/state/` — `clock.ts` (pure run clock), `useTimer` (timeout-scheduled, derives Position), `useWakeLock`; `storage` (IndexedDB workouts, versioned schema, export/import) lands phase 4.
  - `src/ui/` — `RunScreen`, `EffortStrip`, `theme.css`/`run-screen.css`, `format.ts`, `media.ts` (stopgap). Still to come: `LibraryScreen` (phase 5), `WorkoutEditor`/`BlockRow`/`ImagePicker` (phase 6).
- **Patterns:** engine stays pure and DOM-free; all time derived from timestamps, never accumulated; audio scheduled ahead on the audio clock, not fired from JS ticks; images content-addressed and always downscaled before storage.

### Build order
| Phase | Deliverable |
|---|---|
| 1 | ✅ `engine/` + tests |
| 2 | ✅ RunScreen + pure run clock + effort strip |
| 3 | ◀ **NEXT** — audio cues |
| 4 | Media pipeline — `resolveMedia` over all 3 sources, postimages URL normaliser, IndexedDB blob store, downscale, content-hash, objectURL cache, pin-for-offline, next-image preload |
| 5 | LibraryScreen — list / create / duplicate / rename / delete / load routines, search + sort, media GC |
| 6 | WorkoutEditor — block tree editing + image picker (photo/camera/drag/paste) |
| 7 | PWA install, wake lock, offline, export/import (routine + library backup), share links, design pass |

---

## ⚠️ External blockers (don't block coding)

- Hosting account not yet chosen (Cloudflare Pages recommended). Not blocking until phase 7 — `VITE_BASE` keeps both host shapes buildable.

---

## 🔧 Useful commands

```bash
npm run dev          # Vite dev server
npm test             # vitest, single run
npm run test:watch   # vitest, watch mode
npm run typecheck    # tsc -b --noEmit
npm run build        # tsc -b && vite build
VITE_BASE=/exercise-timer/ npm run build   # subpath build (GitHub Pages)
```

---

## 📚 References (read IF needed)

- `.wolf/cerebrum.md` — User Preferences + Do-Not-Repeat + Decision Log
- `.wolf/anatomy.md` — token-efficient file index
- `.wolf/buglog.json` — known bugs + fixes
