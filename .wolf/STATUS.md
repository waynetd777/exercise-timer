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
- **Phase 2 sizing fix** (user-reported: countdown and panel tiny on a laptop) — both were capped in `rem`. Now sized against BOTH axes: named containers (`shell` / inline-size, `body` / size), countdown `max(3rem, min(calc(84cqi / var(--chars)), 52cqh))` with `--chars` from the string's em width, columns `minmax(0, 3fr) minmax(0, 2fr)`, panel frame stretches to the row on wide layouts. See buglog `bug-005`.
- **Phase 3 COMPLETE** — audio cues
  - `src/audio/engine.ts` — AudioContext lifecycle, gesture unlock (idempotent, wired to every control), `resume()` for iOS, click-free ramped envelopes, and `cancelPending()` tracking scheduled oscillators so pause/seek leaves no orphaned beeps.
  - `src/audio/tones.ts` — synthesised specs (no files to ship or cache). Countdown blips RISE (F#5/A♭5/B♭5) and the phase change resolves above them (D#6), so an approaching transition is audible as shape. Completion is a two-note figure. Plus `audioTimeFor()`, the one pure subtraction bridging run time to the audio clock.
  - `src/audio/useCueScheduler.ts` — 30s rolling lookahead, re-armed every 10s, on every clock mutation (via `timer.generation`), and on `visibilitychange` (resuming the context first, since iOS suspends it while hidden). Cancels pending before each arm.
  - `src/audio/useMuted.ts` — mute persisted to localStorage (right home for a UI flag; the IndexedDB decision was about routines and images).
  - `useTimer` now exposes `readElapsed` (live, not a snapshot) and `generation`.
- **`.tabata` importer + real routine mounted**
  - `src/routines/tabataFormat.ts` — imports the Tabata Timer app's export format. Decoded from Wayne's real file; `workout.intervals` is fully expanded and the sibling `cycles`/`work`/`rest` fields are template defaults, NOT multipliers (honouring `cycles: 3` would have made a 42-minute workout 126 minutes). Flat import, no repeat-group inference — a wrong guess would silently alter someone's workout.
  - `src/routines/beginner-mixed-cardio.tabata.json` — Wayne's routine, committed so it drives both the demo and the tests. 86 steps, 42:09, 10 postimages illustrations, several exercises with no image.
  - **80 tests green**, typecheck + build clean.
- **Real cue sounds** (user request: "use the same sounds tabata uses")
  - Located the source app installed on this Mac: `/Applications/Tabata Timer.app/Wrapper/TabataTimer.app/` — 110 audio files. Copied a 10-sound palette (248KB) into `src/audio/cues/`.
  - `src/audio/samples.ts` — sounds imported as MODULES (`?url`), so a rename breaks the build rather than going silent, and each gets a content-hashed URL. Mapping and per-cue gain live in one object: countdown → `beep`, phase change → `bell`, complete → `win`. Alternates shipped: `click`, `water-drop`, `finger-snap`, `ding-dong`, `xylophone`, `electronic-stab`, `ten-seconds-left` (spoken).
  - `src/audio/engine.ts` — `preload()` fetches and decodes buffers; `scheduleSample()` queues `AudioBufferSourceNode.start(at)` on the audio clock exactly as the oscillator path did. Returns false when a buffer is not ready, so `tones.ts` covers the gap and no cue is ever silent.
  - All three countdown blips now use the SAME sound, as the app does (the rising-pitch idea was nicer but not the ask).
  - ⚠️ The app stores no sound choice in its export and had no prefs plist here, so **this mapping is a sensible default, not a verified match** to what Wayne actually hears.
  - ⚠️ **Licensing:** third-party assets from a commercial app. Fine privately; do not publish the site publicly with them in place. Concrete reason to prefer an access-controlled host over GitHub Pages.
  - **84 tests green**, typecheck + build clean; all 10 mp3s emitted with content hashes.
- **Type scale fix** (user-reported: "make all the small text much bigger") — `--label-size` is now `clamp(1rem, 1.6cqi, 1.6rem)`, taking labels from ~11px to 16px on a phone and 23px on a laptop; tracking eased 0.16em → 0.11em. Exercise name floor 1.25→1.75rem, stat figures fluid, primary button and chevrons on their own larger scales, targets 56→64px (primary 76px). Control row now wraps, and the primary button uses `min(12rem, 100%)`, fixing a latent phone overflow the larger text would have triggered. See buglog `bug-006`, `bug-007`.
- **Type scale raised again + empty-panel redesign** (user-reported)
  - `--label-size` → `clamp(1.25rem, 2.4cqi, 2.4rem)`: labels now 20px on a phone, 34.6px on a laptop (from 16/23). Stat figures `clamp(2rem, 5cqi, 4rem)`. "Next up" exercise name `clamp(1.4rem, 2.9cqi, 2.9rem)` so it stays above the label scale, and the line wraps.
  - **Controls held at their previous size** via a second token, `--label-size-control`, which `.controls` assigns to `--label-size` so the buttons inherit it. Body text can grow again without regrowing the bottom bar.
  - Empty media panel now shows the **step name** ("GET READY", "REST") instead of "No image" — 46 of the 86 steps in Wayne's routine have no illustration, so this is the normal state. Set in the phase colour, sized by `fitCqi()` off the longest word (capped at 7rem), with `.panel__frame` made an inline-size container so long names are measured against the frame rather than the body.
  - **89 tests green**, typecheck + build clean.
- **Type scale raised a third time** (user-reported: "another couple of notches") — `--label-size` → `clamp(1.6rem, min(3.2cqi, 6.5cqh), 3.4rem)`: labels 25.6px phone / 29.7px iPad / 43px laptop (from 20 / 24.6 / 34.6). Exercise name `max(2.25rem, min(10cqi, 10cqh))`, stat figures `clamp(2.5rem, 6.5cqi, 5.5rem)`, next-up name `clamp(1.8rem, 3.8cqi, 3.8rem)`. Controls untouched (still on `--label-size-control`). **The token is now height-aware**, because at this size the meta row wraps to two lines and would have overflowed a short laptop window; verified the vertical stack fits at 390x844, 1024x768, 1440x900, 1440x700 and 1440x600.
- **Controls reverted to their original scale** (user-reported) — `--label-size-control: 0.7rem` with `--label-tracking-control: 0.16em`, `.btn` back to 56px / `--step-4` padding, primary back to 64px / `min(10rem, 100%)`, and the chevron font-size override removed. Body text keeps its enlarged scale, so the contrast between a large countdown area and a quiet compact bottom bar is intentional. **Two guards kept deliberately:** `flex-wrap` on `.controls` and `min(10rem, 100%)` on the primary button — at 0.7rem the five buttons still total ~508px against a 390px phone, so the original row overflowed; the guards are invisible when things fit.
- **Traffic-light phase colours** (user decision, supersedes the warm/cool scheme) — prepare `#4FD07E` green, work `#EF4A3F` red, rest `#4A93F5` blue, recover `#9080E8` violet unchanged. Values chosen so the three separate by LIGHTNESS as well as hue (0.48 / 0.24 / 0.29 relative luminance) and each clears 4.5:1 against the dark primary-button text (9.6 / 5.2 / 6.1). Re-check that ratio if a role colour changes.
- **Duration units stay lowercase** — new `.unit` class opts out of the surrounding `text-transform: uppercase`, which was rendering "20s" as "20S". Applied to the next-up line and the meta row.
- **Routine name reduced** (user-reported) — idle title `max(1.75rem, min(9cqi, 5.5rem))` with `text-wrap: balance` (128 → 88px on a laptop). The running eyebrow falls back to `workout.name` whenever a routine has no repeat groups, which every imported flat routine does, so that case got its own `.count__routine` class: 46 → 24.5px, quieter colour. "Round 3 of 8" keeps the full label scale.
- **Neutral grey ground** (user-reported: brown tint disliked) — `--ink-900 #121314`, `--ink-800 #1A1C1D`, `--ink-700 #242628`, `--ink-600 #34373A`, `--bone #F1F2F3`, `--bone-dim #9BA0A6`, `--bone-faint #7E838A`. All phase colours still clear 4.5:1 against the dark button text (green 9.4, red 5.1, blue 6.0, violet 5.7); `--bone-faint` was lightened from my first pick because that only reached 3.41:1 on grey.
- **Effort strip no longer goes brown** (user-reported) — replaced per-state `opacity` over the near-black ground with explicit backgrounds. Upcoming steps are neutral `--ink-600` (height already encodes work vs rest, so hue was redundant); completed steps keep hue but mix toward a light grey, `color-mix(in oklab, var(--step-colour) 55%, var(--bone-dim))`, landing on `#C9716D` for red instead of `#802E2A`; only the current step is full strength. See buglog `bug-008`.
- **Meta row tidy** (user-reported) — "Step 3 of 86" → "Step 3 / 86", and the column gap between "time left" and the step counter is now `1.75em` rather than a fixed `1.5rem`, so it scales with the label size (24px → 45/52/75px on phone/iPad/laptop).
- **Countdown enlarged, meta moved to the bottom, "Paused" removed** (user-reported)
  - `.count` is now `grid-template-rows: 1fr auto` with a `.count__lead` wrapper holding eyebrow + clock + name (vertically centred), so the meta row sits on the bottom edge of the column.
  - Countdown height term 52cqh → 65cqh, and the width coefficient became layout-dependent (`--clock-coef`: 140 stacked, 92 beside the panel) because `cqi` measures the body, not the 3fr column. Result: **+67% on a phone, +25% on iPad/laptop** (367 → 459px on a laptop). Verified the width fits the column and the vertical stack fits body height at 390x844, 1024x768, 1440x900, 1440x700 and 1440x600.
  - "Paused" chip gone — the primary button already reads "Resume".
- **Effort strip removed, header added, elements grown** (user request: "nuke the progress bars… place the routine name up there")
  - `src/ui/EffortStrip.tsx` deleted along with its CSS. The signature element is gone by request — progress still reads from "Step n / m" and time remaining. `--effort-*` tokens left in theme.css, unused.
  - New `.run__header` holds the routine name (`clamp(1rem, 1.9cqi, 2rem)`, uppercase, dim).
  - Name de-duplicated: the countdown eyebrow now carries only "Round 3 of 8" and is omitted for a flat routine so the row collapses; idle and complete screens lead with "Ready" / "Done" rather than repeating the name.
  - Reclaimed space spent on: countdown height term 65cqh → **74cqh** (489 → 556px on a laptop, +14%), exercise name `max(2.5rem, min(11cqi, 11cqh))`, idle/complete title `max(2.5rem, min(14cqi, 9rem))`. The media panel grows on its own, since it stretches to the row.
  - Wide clock coefficient trimmed 92 → 88: at 92 an iPad hit 97% of the column width, inside the error bar of the glyph-width estimate. Fit verified at 5 viewports (82-92% vertical use).
- **Centred routine name, icon-only controls** (user-reported)
  - `.run__header` centres the title.
  - New `src/ui/icons.tsx` — inline SVG (play, pause, reset, prev, next, sound on/off), inheriting `currentColor`, no font or extra request. Transport filled, utilities stroked.
  - Buttons are square and text-free: 56px, primary 68px. Row width **508px → 372px**, so it now fits one line at 390px phone width instead of always wrapping; `flex-wrap` kept for narrower devices. The primary button's action and name are derived from `status`, and every control carries both `aria-label` and `title`.
  - Removed as dead code: `.btn` text styling, the `.btn[aria-label]` tracking rule, and the `--label-size-control` / `--label-tracking-control` tokens.
- **Phase 5 COMPLETE — routine library + `.tabata` import** (built ahead of phase 4 by choice)
  - `src/storage/db.ts` — IndexedDB opened once; `workouts` and `media` stores both created at v1 so phase 4 is an addition, not a migration. Plus `requestPersistence()` so the browser does not evict saved routines.
  - `src/storage/library.ts` — PURE logic: `stamp`, `summary`, `filterWorkouts`, `sortWorkouts` (favourites pinned, never-run sorts below run, falls back to recently-edited), `copyName` (numbers copies without stacking suffixes), `duplicate`, `rename` (rejects blank), `markRun`, `toggleFavourite`. **23 new tests, no DOM.**
  - `src/storage/workouts.ts` — thin IndexedDB CRUD. `src/storage/useLibrary.ts` — React wiring, seeds on first run so the library is never empty.
  - `src/routines/importFiles.ts` — multi-file `.tabata` import; every file attempted and failures collected, so one bad file does not lose the rest. Fresh uuid per file (the importer's timestamp id would collide across a drop).
  - `src/ui/LibraryScreen.tsx` + `library.css` — search, three sort modes, favourite star, run/rename/duplicate/delete per row, whole-screen drag-and-drop with a drop overlay, and a file picker. Rename is inline; delete is a two-step confirm rather than a blocking dialog.
  - `src/ui/App.tsx` — shell routing library ↔ run. The running routine is held in state, not looked up by id, so library metadata writes cannot recompile the timeline mid-workout.
  - `RunScreen` gained `onExit` (back button, header now a 3-column grid so the title stays centred) and `onStarted` (stamps `lastRunAt`).
  - 8 new icons. **112 tests green**, typecheck + build clean.
- **Column contents centred** (user-reported) — countdown, exercise name, meta row, next-up line, and the idle/complete screens.
- **Named the app, made cards clickable** (user-reported) — home heading and document title are now "DavShack Gym Timer" (the latter becomes the PWA install name in phase 7). The per-card play button is gone; the whole card opens the routine via a stretched `<button>` overlay, layered above the name/stats but below the star and action buttons, and rendered only in idle mode so it cannot cover the rename input or delete confirmation. Cards get a hover state.
- **Three countdown/layout fixes** (user-reported with screenshot) — see buglog `bug-009`..`bug-011`
  - **Off-centre digits:** letter-spacing applies after the last glyph, so a centred line sits half the tracking off-centre. Now `--tracking` plus `padding-right: calc(-1 * var(--tracking))`.
  - **Size jump on digit change:** `clockWidth` returned 1 for a single digit while the coefficient was calibrated for 2, so "9" rendered up to **100% larger** than "10". Floored at 2 — size now only ever steps down. The old test asserted `clockWidth('8') === 1` under the name "does not jump", so it guaranteed the jump; corrected and a monotonicity test added.
  - **Panel pushed off-screen:** the frame had `aspect-ratio: 4/3`, demanding height from its width no matter what was left. Now `height: 100%` with `.run__body` stacked as `grid-template-rows: auto minmax(0, 1fr)`, so the panel absorbs the remainder. Clock height term split per layout: `--clock-height` 40cqh stacked, 74cqh beside the panel. Verified the panel keeps 137-432px across five stacked window sizes.
  - **113 tests green**, typecheck + build clean.
- **One type scale, and the card hierarchy fixed** (user-reported) — see buglog `bug-012`, `bug-013`
  - **Cards were inverted:** `.label` used the `font:` SHORTHAND (which resets font-size) and lived in run-screen.css; App.tsx imports LibraryScreen first, so run-screen.css loaded last and clobbered the cards' meta size. Card meta rendered at 44.5px against a 30.4px name on a laptop — inverted at every width. `.label`/`.unit` moved to theme.css in longhand; `.row__meta` steps down via `--label-size`. Name/meta ratio now 1.5-2.07x.
  - **Screens read as different apps** because there was no shared scale: 11 ad-hoc font sizes and 5 letter-spacing values across the two stylesheets. Now one scale in theme.css keyed to role — `--track-display`/`--track-name`/`--label-tracking`, and `--size-display`/`--size-title`/`--size-name`/`--label-size`/`--label-size-sm`. Both stylesheets reference tokens only.
  - **113 tests green**, typecheck + build clean.
- **Renamed to "DavShack Timer"** and centred the home heading (user-reported). Applied in `LibraryScreen.tsx` and `index.html` (the document title carries through to the PWA install name).
- **Cleared the "Next …" line off the divider** (user-reported twice). The real cause was that the STACKED `.run__body` had zero bottom padding, so the panel met the controls' border directly and a 3px nudge was the whole clearance. Now `padding-bottom: var(--step-4)` and the nudge removed as redundant; the wide layout always had 24px. See buglog `bug-014`.
- **Fallback step name now shrinks with the frame** (user-reported) — it was sized only in `cqi` (frame WIDTH), so a shorter frame kept a width-derived size and overflowed. `.panel__frame` became `container-type: size` so the block axis is queryable, and the text is `clamp(1rem, min(--fit * 1cqi, 72cqh / --lines), 7rem)` where `--lines` is the word count (an upper bound on line count, so dividing by it errs toward fitting). Vertical padding also went proportional (`4cqh`) — a fixed 16px was 29% of a 110px frame and clipped on its own. Verified "REST", "GET READY" and "SEATED ABDOMINAL CRUNCH" all fit at frame heights of 500 / 300 / 180 / 110 / 70px. **116 tests green.**
- **Phase 7 (partly) COMPLETE — LIVE at https://waynetd777.github.io/exercise-timer/**
  - Cues **synthesised from measurements** of the Tabata Timer app; no bundled audio, so the repo could go public. Countdown 523Hz sine; phase change 2659Hz + inharmonic partial x2.578; completion a transcription over G5/F5/C6/F6.
  - **Bell fix** (user-reported it sounded like a click): envelope is now STRIKE + RING (`sustain`, `strikeMs`) — the real bell falls to 0.33 of peak in 25ms and rings to 1.2s, where a single exponential is dead by 500ms. AND `cancelPending()` was stopping sounding oscillators on every 10s re-arm, truncating cues mid-ring. See buglog `bug-015`, `bug-016`.
  - **PWA**: vite-plugin-pwa manifest + Workbox service worker, precaching the shell and cache-first runtime caching for `i.postimg.cc` — which covers offline images far more cheaply than the full media pipeline. Icons generated (segmented ring, incl. maskable); `start_url`/`scope` relative so a subpath install behaves the same.
  - **Deploy**: `.github/workflows/deploy.yml` builds with `VITE_BASE=/exercise-timer/` and deploys to Pages, gated on typecheck + tests.
  - **Repo is PUBLIC.** History rewritten with `git filter-repo` to purge `src/audio/cues` first (backup bundle taken; all 26 commits kept, hashes changed, force-pushed). Verified zero mp3 objects in the remote before flipping visibility.
  - **Other two routines imported** and committed; seeding is now once-per-id via localStorage, so new seeds reach existing installs and deleted ones stay deleted. Interval **type 3 = 60s recovery between exercises** (confirmed against `restBetweenTabatas`).
  - **App mark**: blue stopwatch, used everywhere — `favicon.svg` + 32/64px PNGs, `icon-192/512`, maskable, apple-touch, and a matching `StopwatchIcon` beside the home title. Title and mark share the blue via `currentColor`. Maskable/apple-touch are full-bleed with the artwork in the safe zone (launchers crop them); the rest carry a 20% corner radius.
  - **122 tests green.**
- **Home screen header frozen** (user-reported) — title, search, sorts and Import stay put; only the routine list scrolls. `.library` is `grid-template-rows: auto minmax(0, 1fr)` with `overflow: hidden`, and everything below the header sits in a `.library__scroll` wrapper. A wrapper rather than one grid row per element, because the number of notices varies and the scroll region must not depend on it. `overscroll-behavior: contain` stops a rubber-band scroll dragging the page behind it.
- **Title uses the mark's blue** — set once on `.library__title`, with `.mark` on `currentColor` so the two cannot drift apart.

---

## 🚀 Next phase — Phase 4: media pipeline + IndexedDB

**Goal:** Replace the phase-2 stopgap resolver with the real thing, so images survive gym wifi and postimages link-rot.

### Acceptance criteria
1. `src/media/resolveMedia(ref)` handles all three sources; `local` returns a cached objectURL from IndexedDB. Replaces and deletes `src/ui/media.ts`. Import the DB from `src/storage/db.ts` (already has the `media` store).
2. IndexedDB store `media`, keyed by sha256 of the blob (`crypto.subtle.digest`). Content-addressed, so an image reused across steps or routines is stored once.
3. Import pipeline for own photos: decode → canvas resize to 1024px long edge → WebP q0.8 → hash → store. Never store a 3-5MB original.
4. postimages URL normaliser: `postimg.cc/<id>` → `https://i.postimg.cc/<id>/img.png` (VERIFIED: the filename segment is ignored). Accept either form.
5. "Pin for offline" on a remote ref: `fetch` → Blob → hash → store → set `cachedHash`; resolver then prefers the local copy. Works because `i.postimg.cc` sends `access-control-allow-origin: *` (VERIFIED). Skip downscaling below 300KB — his images are ~31KB.
6. objectURL cache keyed by media id, revoked on unmount, or blobs leak.
7. ~~`navigator.storage.persist()`~~ — DONE in phase 5 (`requestPersistence()` in `src/storage/db.ts`).
8. Media GC on routine delete: `useLibrary.remove` has the hook point marked with a comment.
8. Graceful failure for a HEIC that will not decode outside Safari — a clear message, not a broken image.

### Files to create / edit
| Type | File | Content |
|---|---|---|
| ~~new~~ | ~~`src/media/db.ts`~~ | **DONE in phase 5** as `src/storage/db.ts` — both stores exist at v1 |
| new | `src/media/hash.ts` | sha256 of a Blob via `crypto.subtle` |
| new | `src/media/downscale.ts` | canvas resize → WebP encode |
| new | `src/media/postimages.ts` | URL normaliser (pure — test it) |
| new | `src/media/resolveMedia.ts` | Three-source resolver + objectURL cache |
| new | `src/media/pin.ts` | Fetch a remote ref into local storage |
| del | `src/ui/media.ts` | Stopgap, superseded |

### Notes for phase 4
- Keep the pure parts pure (`postimages.ts`, `hash.ts`) so they test without a DOM, as with `clock.ts`.
- Wayne's routine has 10 distinct remote images — a good real fixture for pinning.

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
- **RESOLVED — hosting: GitHub Pages, repo goes PUBLIC once complete.** Pages is free for public repos, so the earlier Pro caveat falls away; `VITE_BASE=/exercise-timer/` is already wired. ⚠️ **PRE-PUBLIC CHECKLIST:** remove `src/audio/cues/*.mp3` (Tabata Timer's commercial assets) in favour of the synthesised fallback in `tones.ts`, and note that the postimages URLs become public too.
- **(superseded) Hosting deliberately left open.** All bundled asset paths go through `import.meta.env.BASE_URL` from phase 1, so a root-domain host and a subpath host (GitHub Pages `/exercise-timer/`) both work with no retrofit. Recommendation on record for phase 7: Cloudflare Pages — free tier deploys private repos, serves from the root, good SW caching. GitHub Pages needs Pro for a private repo and publishes a public site.
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
- _(none open)_ — **RESOLVED: no browser driver.** User reviews UI in the browser himself; keep a dev server running and hand over the URL.
- Wake-lock fallback: silent looping audio, or accept Screen Wake Lock API support only? Decide at phase 7.

---

## 📁 Active architecture

- **Stack:** React + TypeScript + Vite, vitest. IndexedDB for persistence. PWA (service worker) from phase 6. No backend.
- **Key modules:**
  - `src/engine/` — pure interval-timer core (compile / position / cues). DOM-free, unit-tested.
  - `src/audio/` — `engine.ts` (context lifecycle, scheduling, cancellation), `tones.ts` (synthesised specs + `audioTimeFor`), `useCueScheduler.ts` (rolling lookahead), `useMuted.ts`.
  - `src/media/` — `resolveMedia` (remote/bundled/local), postimages URL normaliser, import pipeline (downscale + hash), IndexedDB blob store, objectURL cache, offline pinning.
  - `src/state/` — `clock.ts` (pure run clock), `useTimer` (timeout-scheduled, derives Position), `useWakeLock`; `storage` (IndexedDB workouts, versioned schema, export/import) lands phase 4.
  - `src/routines/` — `tabataFormat.ts` (.tabata importer), `samples.ts`, Wayne's real routine as JSON.
  - `src/ui/` — `RunScreen`, `EffortStrip`, `theme.css`/`run-screen.css`, `format.ts`, `media.ts` (stopgap). Still to come: `LibraryScreen` (phase 5), `WorkoutEditor`/`BlockRow`/`ImagePicker` (phase 6).
- **Patterns:** engine stays pure and DOM-free; all time derived from timestamps, never accumulated; audio scheduled ahead on the audio clock, not fired from JS ticks; images content-addressed and always downscaled before storage.

### Build order
| Phase | Deliverable |
|---|---|
| 1 | ✅ `engine/` + tests |
| 2 | ✅ RunScreen + pure run clock + effort strip |
| 3 | ✅ audio cues (pre-scheduled Web Audio, mute) |
| 4 | ◀ **NEXT** — Media pipeline — `resolveMedia` over all 3 sources, postimages URL normaliser, IndexedDB blob store, downscale, content-hash, objectURL cache, pin-for-offline, next-image preload |
| 5 | ✅ LibraryScreen + `.tabata` import + IndexedDB storage |
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
