# STATUS — exercise-timer

> Single source of truth for resuming work. Read this FIRST when starting a session.
> Update this file at the end of every work phase so the next `/clear` resumes in 1 read.
> Last updated: 2026-08-28

---

## ✅ Done: the review backlog, top to bottom (2026-08-28)

A full code review (six parallel reviewers, findings verified by reading or by executed probes) produced a ranked
backlog; the full list is in the session scratchpad `review.md` (session-specific). Every high and the mediums
below are fixed and committed, one commit per group:

- `930c4de` Audio: the @0 opening cue of every run now sounds (window looks back CANCEL_GRACE_MS; dedup set cleared per run).
- `bba7125` Storage: writes report failure through `library.error` and Save waits; a corrupt IDB record no longer bricks the library;
  favourite does not re-stamp; `openDb` un-caches any rejection; share links get full `isWorkout` validation and say when photos drop;
  block ids required; duration sort uses timed + estimated; duplicate names read from the store.
- `82e73b2` Help text made generic (no "your routines", weights section rewritten, em dashes out).
- `f3610d7` Editor: two drags are two undo steps; Escape leaves nothing to undo; Cmd+Z stays with an uncommitted note;
  `.efield--note` no longer zooms iOS; custom role shown; Recover default on retarget.
- `6c4a256` Engine: a group collapses into one gate only inside a list section; imports and the editor refuse >10k steps;
  new `ui/ErrorBoundary.tsx` around the screens.
- `339a24c` Routines: Tidy keeps side/limb/count qualifiers; text export re-parses each line and drops a note that would misread;
  an empty heading at the end of the text is reported (surfaced one lost line in the 2026-07-13 email).
- `8775c9b` Dead code: synth-whistle machinery, hasGates(), KIND_RANK, COMPLETE_INDEX_OFFSET, tick's nextRun copy, cache stubs,
  UpIcon/SpeakerIcon, --effort-* tokens, Exercise.load, ~20 un-exports. knip clean in src.
- `1ec0b1e` Docs pass: every README/comment contradiction the review listed; em dashes gone.
- Earlier: generated sections routines open on the parser's 5s Get ready (bug-074).

- `d92be5f` Smaller fixes: run workout memoised (no recompile per render); paused cues not queued twice; `event.repeat` guard;
  beforeunload during a run; SECTIONS_FEWEST used everywhere; two-digit ladder rungs (dates are not ladders); landscape safe-area
  padding; wake-lock sentinel check; `tsconfig.scripts.json` typechecks scripts/ and the harvest config.

- v8.1 (2026-08-28): the routines mediums (AMRAP rounds/Then, bulleted duration ladders, bare Rest, Minute N pairs, -ss folding
  with a re-harvest, shared blocksDurationMs, all 19 ladders weighted by `seen`, torso warm-ups), resolveMedia in-flight map,
  db.run resolves on transaction completion, hardware Back routed through the screens' own exit handlers, and the countdown
  re-measured at the minute marks (Wayne's pick).

- 2026-08-28 (later): the lows, all of them (commits 10f1185 and the one after): editor focus/redo/empty fields, menu roles,
  drop overlay, done-row contrast, download revoke, all-rejected bundles report names, cross-tab cache invalidation,
  pull-to-refresh busy reset, data-URL cap, AudioContext guards, parser/generator/writer lows, shared closestKey matcher.

Still open (quality only): split EditorScreen.tsx (seams in the review); one useModal() for the 8 dialog copies; CountField shared
with GenerateDialog; add a linter; tests for LibraryScreen/App/audio engine.
Decided: per-side exercises in the circuit stay as two groups of sets around "Change Sides", unnamed (Wayne: leave it).
v8.2 pushed 2026-08-28 with the lows.
- Ladders are labelled Rung (with a migration for stored Set), group rows carry a kind badge, generated/pasted drafts are migrated into the editor so sets read Set not Round (bug-109). v8.3 pushed 2026-08-28.

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
- **Removed "Classic Tabata" from the seed set** (user-reported) — only Wayne's three real routines seed now. Existing libraries keep their copy until deleted in the UI; no auto-delete migration, since that would destroy a routine the user may have edited.
- **Phase 6 COMPLETE — workout editor**
  - `src/editor/blocks.ts` — PURE tree ops on `Block[]` addressed by a `Path` (index chain): `insertAfter`, `appendTo`, `removeAt`, `moveBy`, `updateSegment`, `updateRepeat`, `clearMedia`, `wrapInRepeat`, `unwrapRepeat`, `flatten`, plus `newSegment`/`newRepeat` with per-role defaults. Immutable throughout. **29 tests.**
  - `src/editor/postimages.ts` — accepts a direct link, a `postimg.cc/<id>` share link, or a bare id, and passes any other https URL through. **7 tests.**
  - `src/ui/EditorScreen.tsx` + `editor.css` — per-step role select, name, seconds, image link with thumbnail; move up/down, repeat-this-step, delete; repeat rows with label, count, add-step-inside, ungroup; live total and step count; add buttons per role plus Rounds. Rows carry a left border in the step's phase colour.
  - Library gained **New** and per-row **Edit steps**; `App` routes library ↔ run ↔ edit.
  - **158 tests green.**
- **Blue wash on the home and editor screens** (user-reported) — same radial gradient as the run screen, in `--role-rest`.
- **Run-screen progress bar** (user-reported) — 3px, edge to edge under the header rule, in the phase colour. Driven by `transform: scaleX()` on an inner element rather than a gradient stop, since gradients do not transition and the value updates once a second.
- **Countdown no longer resizes mid-step** (user-reported) — `--chars` now comes from the step's longest string rather than the live value, so a step crossing 1:00 → 59 no longer jumps ~75%; and the stacked layout uses fixed 56fr/44fr proportions instead of `auto` + remainder, so the image never resizes with it. `--clock-height` tightened 40cqh → 34cqh accordingly, fit verified at six window sizes. See buglog `bug-017`.
- **Image gets more room on short screens** (user-reported) — the illustrations are near-square (876x800), so a short wide frame fitted them to its height and wasted the width, rendering at 0.13x on a small window. Two viewport-height tiers now hand space to the panel: `<=700px` 50/50 with `--clock-height: 28cqh`, `<=540px` 46/54 with 22cqh and lower name/label floors. Image renders **19-47% larger**; a normal phone portrait is unchanged. See buglog `bug-018`.
- **Image no longer truncated** (user-reported with screenshot) — `object-fit: contain` was not the safeguard I assumed: the `<img>`'s `height: 100%` resolved to auto as a grid item, so the box took the natural aspect at full width, exceeded the frame, and `overflow: hidden` clipped the bottom. Contain only constrains the picture WITHIN the box. Now `position: absolute; inset: 0` inside a `position: relative` frame, so the box is definite regardless of the grid. See buglog `bug-019`.
- **New routines start from a template, and Save is labelled** (user-reported: could not find how to save). A new routine now opens as 30s prepare + `Round` x3 of [20s work, 10s rest] + 30s prepare (8 steps, 2:30), mirroring how the real routines are built. `newSegment` defaults also matched to them (prepare 30s, work 20s, rest 10s). The editor's Save button carries the word rather than a bare tick — icon-only suits frequent transport controls, not a consequential infrequent action. **161 tests green.**
- **Editor defaults, the invisible Save button, merged edit action, and a dirty guard** (all user-reported)
  - `newRepeat()` now defaults to **3 reps of 20s work + 10s rest** — the "+ Rounds" button was creating a round containing only a work step. `newRoutineBlocks()` is the single source of truth for a new routine's shape, shared by `App` and the tests.
  - **Save was invisible:** `.btn--primary` uses `background: var(--phase)`, set only on `.run`, and an undefined custom property invalidates the declaration — dark text on a dark ground. `--phase` now has a root default of `--role-rest`. See buglog `bug-020`.
  - Moved `.btn*` and `.chip*` into `theme.css` alongside `.label` — three screens use them, and they only worked from a screen-specific file because the bundler concatenates all CSS.
  - **Pencil now opens the editor**; the separate edit-steps button and the inline rename are gone, and `rename` was deleted from `library.ts`/`useLibrary` as dead code.
  - **Back guards unsaved work:** `src/editor/dirty.ts` compares field by field (not `JSON.stringify`, whose result depends on key order), the header becomes an in-place "Discard your changes?" prompt, and `beforeunload` covers reloads. **9 tests** for the dirty check.
  - **170 tests green.**
- **Undo/redo in the editor, and a recover step in the template** (user-reported)
  - `src/editor/history.ts` — pure `History<T>`, capped at 60 entries. **A run of text edits coalesces into one undo step**; discrete changes (add/delete/reorder/change type) each get their own; undo ends a run so later typing does not overwrite the restored state. **9 tests.**
  - Name and steps share one history entry (`Draft`), so undo restores a consistent draft. All mutations go through `edit()`/`editBlocks()` — `setBlocks` no longer exists, so a new mutation cannot silently bypass undo.
  - Undo/redo buttons sit in a toolbar row with the running totals; Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z work, deliberately overriding native text-field undo.
  - New routines now end with a **60s recover** step: prepare 30 → Round ×3 [20 work, 10 rest] → prepare 30 → recover 60. 9 steps, 3:30.
  - **179 tests green.**
- **Delete confirmation is emphatically red** (user-reported) — red row border and tinted background, red routine name, bold red "Delete?", filled-red tick. Worth noting: the rules were **already red in the deployed CSS**, verified by fetching it, so the report was most likely a stale service-worker cache; the state was strengthened rather than just re-applied. Also made `theme.css` explicitly the first CSS import so the base layer always precedes its modifiers.
- **Duration and round-count fields lost their spinner arrows** (user-reported). `appearance: textfield` plus the WebKit spin-button pseudo-elements. `type="number"` kept deliberately, so arrow keys still nudge the value and mobile still gets a numeric keypad — only the arrows are hidden.
- **Duplicate buttons on editor rows** (user-reported) — on both steps and rounds; a round copies with all its children. `duplicateAt` deep-copies with **fresh ids**, since the editor keys its rows by `block.id`. The copy lands directly after the original, so duplicating repeatedly stacks. **7 new tests, 186 green.**
- **Editor image previews 50% bigger** (user-reported) — `.erow__thumb` 44px → 66px.
- **Image previews are clickable, and the field is now a selector** (user-reported)
  - Thumbnails reverted to 44px and turned into buttons that open a **full-size lightbox** (native `<dialog>` + `showModal()`, so Escape, focus trapping and the backdrop are the browser's). The lightbox image uses `max-*: 100%` so a small source is not upscaled into a blur.
  - New **"Choose" picker**: a searchable visual grid of every image already used across the library. `collectImages()` in `src/editor/images.ts` is pure — distinct urls, labelled with the step name they appear under most often, ties broken alphabetically for stability. **8 tests.** Wayne's routines yield 13 distinct images, several used 9 times.
  - The image row became a `<div>`: a `<label>` wrapping a button forwards the click to its input.
  - **194 tests green.**
- **Rows can move in and out of rounds, and the picker offers the whole image catalogue** (user-reported)
  - `moveStep` replaces `moveBy` in the editor: a step moves into an adjacent round (first child going down, last going up), swaps with an adjacent step, or steps out of a round at its edge. Rounds only ever swap — nesting stays refused. Up/down now disable only at `depth === 0`, since a nested step at an edge can always move out. An emptied round is left in place on purpose. **11 tests**, including reversibility and the fact that moving a step into a ×3 round triples its contribution.
  - `src/routines/imageCatalogue.ts` — the **29 URLs from the `Fitness. Workouts` vault note**, in its original order and grouping, all verified to resolve. Labels are derived by `labelFromUrl()` so there is no parallel list to maintain; a catalogue image keeps its filename label even where a routine uses it under a different step name. The picker now offers all 29 whether or not a routine uses them.
  - **214 tests green.**
- **Export, import and share links** (first of three requested in parallel)
  - `src/storage/bundle.ts` — versioned export format (`davshack-timer-bundle` v1) with a **`media` map declared but empty**, so the phase-4 media work fills it in without a format change. Validation is forgiving about missing metadata and strict about what would crash the app; one corrupt routine no longer loses the rest of the file. **16 tests.**
  - `src/storage/shareLink.ts` — a routine gzipped and base64url'd into a URL fragment. An 86-step routine compresses to **under 4000 characters**. Local blobs are dropped (a link cannot carry them) and counted; the recipient gets a fresh id and none of the sender's run history. **13 tests.**
  - Library: **Export** downloads the whole library; each row has a **Share** button that copies a link. Import now accepts both `.tabata` files and exported bundles, distinguished by the bundle's own marker rather than by guessing.
  - Opening a share link imports the routine, clears the fragment so a reload does not duplicate it, and drops you into the editor.
  - **243 tests green.**
- **Polish pass + pull-to-update** (second of three)
  - **Keyboard control** on the run screen: space/`k` start-pause-resume, arrows skip, `m` mutes. Shortcuts shown in the button tooltips. Handler in a ref with the listener registered once, so it neither re-attaches every render nor every tick.
  - **Spoken "ten seconds left"** on steps of 20s or more, via the browser's own voice. Kept out of the scheduled cue system on purpose — speech cannot be queued on the audio clock — and keyed on step index so a pause or seek cannot repeat it. Respects mute.
  - **Pull down on the home screen to update the app** (user-reported). `updateApp()` deletes only the `precache` caches, leaving **IndexedDB untouched** (the only copy of authored routines) and the `exercise-images` runtime cache intact. Touch listeners are attached natively with `{ passive: false }`, since React's `touchmove` is passive and would ignore `preventDefault`.
- **Phase 4 COMPLETE — media pipeline** (third of three)
  - `src/media/hash.ts` sha256 content addressing; `gc.ts` pure `liveHashes`/`orphanedHashes`; `resolve.ts` pure `resolvePlan` (a pinned remote prefers its local copy, and falls back to the network if the blob was evicted); `store.ts` IndexedDB blobs; `downscale.ts` canvas → WebP at 1024px, skipping files already under 300KB and keeping whichever is smaller; `pin.ts` `pinRemote` + `storeFile`; `resolveMedia.ts` objectURL cache. **18 tests** on the pure parts, including the known sha256("abc") digest so the algorithm cannot change silently.
  - **The phase-2 stopgap `src/ui/media.ts` is deleted.** `useMediaUrl` resolves synchronously first so a remote image paints immediately, then asynchronously for blobs — without that, every image flashes blank on a step change.
  - **Upload your own photo** per step in the editor (downscaled, hashed, stored). **Save images** in the library header pins every linked image locally — possible only because `i.postimg.cc` allows cross-origin reads.
  - **Media GC on delete**, computed against the whole remaining library because storage is content-addressed and a deleted routine may share images with one that stays.
  - **261 tests green.**
- **Removed `.codex/` and documented the repo** (user-reported)
  - Deleted `.codex/` (hooks, config, 3 prompt files) that OpenWolf added for Codex. `AGENTS.md` was LEFT in place — it is the cross-agent convention file rather than Codex-specific, and it is 4 lines pointing at `.wolf/OPENWOLF.md`. Say the word to remove it too.
  - **Root `README.md` plus a README for all 8 source folders** (559 lines total). Each documents the DECISIONS and the traps, not the code: why time is derived rather than counted, why a routine compiles to a flat timeline, why cues are pre-scheduled, why the tones are measured rather than sampled, why storage is content-addressed, and the eight CSS traps that each cost a real bug.
- **Library header buttons reordered** (user-reported) — New, Import, Export, Save images. The file picker's `accept` also now lists `.json`, so exported bundles show in the dialog rather than only working by drag-and-drop.
- **Toolbar collapsed into a menu and a select, and the completion cue fixed** (user-reported)
  - Library toolbar: New/Import/Export/Save images became one **Routines** menu, and the three sort chips a native `<select>`. **8 controls → 3, about 52% narrower.** The menu is positioned from the trigger's bounding rect in viewport coordinates, because the library shell clips its overflow and an absolutely-positioned list would be cut off at the header's edge.
  - **The completion figure was being truncated** — 7 notes over 3.45s, firing at the same instant the workout completes and the scheduler re-runs. Cancellation now reasons per CUE rather than per note, with a 0.15s grace for clock skew and deduplication so a spared cue cannot play twice. See buglog `bug-021`.
  - **Audited every other cue** (`schedule.test.ts`, 12 tests): every cue of all three real routines schedules exactly once and in order, nothing is missed even arming at the full lookahead edge, arming every second never duplicates, every cue kind has a tone, and no two cues share a millisecond. **No other sound is clobbered.**
  - **273 tests green.**
- **Outcome notices are now a dismissible modal** (user-reported) — `NoticeDialog`, a native `<dialog>`. Used for the save-images result, import results and the copied share link. While work is in flight it shows progress with no close affordance and swallows Escape; once there is a result it offers Close. The persistent load error stays inline, being a condition rather than an event.
- **Sort control renamed** (user-reported) — it is now a **Sort** menu matching the Routines one, with a tick on the active mode. It had been a native `<select>`, which can only ever display its selected value; the trade is losing the native mobile picker. The dead `.chip--select` and `.library__sort` rules were removed.
- **No trailing periods in messages** (user-reported for modals; applied to all short status text so the app does not read two ways). Two-sentence messages were rewritten as a single em-dashed phrase rather than keeping an internal period.
- **Placeholder text no longer truncated** (user-reported on portrait iPad) — `fitCqi`'s coefficient was 161 from two compounded optimistic assumptions (a 0.62em advance, and the full width with fixed padding ignored). A portrait iPad puts the panel at ~250px wide, where 24px of padding is a tenth of it, so every fallback name overflowed ~20%. Padding is now proportional on both axes, the coefficient is an explicit 84-of-92 budget over a 0.72em advance, `overflow-wrap: anywhere` is a last-resort net, and the tests assert the fit against a **pessimistic** 0.78em advance. Verified across phone, both iPad orientations, laptop and a short window. See buglog `bug-022`. **285 tests green.**
- **Three distinct cue endings, and a sound bench** (user-specified)
  - `CueKind` split: `work-start` (entering work → whistle) and `work-end` (entering anything else → bell) replace the single `phase-change`. Keyed on the step being ENTERED, since every boundary is both an end and a start.
  - **Whistle** synthesised as a pea whistle: 3800Hz + hard 2nd harmonic, chopped 26Hz in pitch AND level, 5% band-passed breath, held not struck. Needed three new engine capabilities — `warble`, `tremolo`, `noise` — because a whistle without the chop is a test tone. **(Superseded: the whistle is now the CC0 recording, and every synthesised version is deleted — see below.)**
  - **Three dings** for the finish: 3136Hz, inharmonic ×2.74, 520ms, struck at 0/260/520ms — brighter and shorter than the bell, as specified.
  - **Sound bench at Routines → Sounds**: each cue plays as the full beep-beep-beep-X figure and as the terminal sound alone, with its parameters printed beside it so iteration is precise. **(Now dev-only — compiled out of production.)**
  - **289 tests green**, including that the whistle and bell cannot be confused and that every boundary sound fits inside the shortest real step.

- **The whistle is the real thing, and it was CC0 all along** (after five rejected synthesis attempts)
  - Measured CC0 freesound candidates against the Tabata whistle. Sound **218318 "Referee whistle blow, gymnasium" by SpliceSound** matched on every figure — 852ms sounding, 2902Hz peak, 98.4% tonal, 9.9Hz rattle — and **waveform cross-correlation 0.992 at a 0.2ms lag** proves it is the same recording. The Tabata app plays a public-domain file; synthesis was never necessary. Licence confirmed from the `publicdomain/zero` link in the page markup, not a search summary.
  - Ships as `src/audio/referee-whistle-cc0.wav`: the 3.329s original trimmed to the blast plus its gymnasium decay (899ms), peak-normalised, 3ms fades, 22.05kHz mono, **44KB**. WAV because macOS has no mp3 encoder and AAC decode is not universal. `globPatterns` in `vite.config.ts` gained `wav` — without it the sound is fetched at runtime and lost in a gym with no signal.
  - `src/audio/samples.ts` holds provenance + licence reasoning. `Note.sample` + `playbackRate` added; the engine plays a buffer when decoded and **falls back to the synthesised curve** otherwise, so a dead network costs fidelity not silence. Both are on the bench as "Recording" / "Synthesised".
  - `scripts/gen_whistle.py` regenerates `whistleCurve.ts` (the fallback) from analysis arrays; defaults ARE the shipped sound. **`scripts/.analysis/` is gitignored** — full-rate amplitude+frequency of the Tabata mp3 is enough to resynthesise it, so committing it would undo the history purge.
  - **Beep and bell hunted too and NOT found**: 89 CC0 candidates for the beep (best 0.740, inside an 89s file) and 67 for the bell (best **0.147**). Both stay synthesised. Tabata's `sound_ding.mp3` is 300Hz/1715ms — unrelated to our short dings, which are ours to spec.
- **Rounds renamed to Reps** (user: "it's short for repetitions", so always plural)
  - The label is DATA — `newRepeat()` wrote the literal `'Round'` — so a code rename alone would leave saved routines saying "Round 2 of 3". `src/storage/migrate.ts` maps `'Round'` and the interim `'Rep'` to `'Reps'` on READ, wired into all three entry points: `listWorkouts`, `fromBundle`, `decodeRoutine`. A deliberately-named "Round 1" is left alone.
- **A rest runs BETWEEN reps only** (user-specified; behaviour change)
  - `compile()` drops a group's trailing `rest` child on the final iteration, and `totalDurationMs`/`stepCount` match. 3 reps of work+rest is work·rest·work·rest·work — 5 steps. Classic Tabata is now 16 steps / 5:00 (was 17 / 5:10); a new routine is 8 steps / 3:20 (was 9 / 3:30). **Five tests pinned the old behaviour and were updated deliberately.**
  - Made visible rather than documented: the trailing rest carries a **"between reps"** chip and a dashed duration field in the editor, and the chip disappears live if a step is added below it. To rest after the last rep, put a rest step AFTER the group.
- **Routine colours** (user-specified: red, yellow, green, blue, orange, purple)
  - `Workout.colour?: RoutineColour`, `ROUTINE_COLOURS` in spectrum order. Six swatches + "no colour" in the editor toolbar, part of the undo history alongside name and blocks, and compared by `isDirty` (4th arg defaults to the original's, so old 3-arg callers still work).
  - Rendered as a gradient wash: 18% → neutral across the library row, 11% on the editor surface (a whole screen needs less tint than a 72px row). Red/green/blue/purple reuse the phase hues; orange and yellow complete the spectrum.
  - **NOT applied to the run screen** — its green/red/blue *mean* get ready/work/rest, and tinting the countdown would break the one thing readable across a gym.
  - Cascade trap found: the existing hover rule sets a flat `background` and TIES with the tint rule on specificity, so tinted rows would have had no hover feedback. There is now a tinted hover, and delete-confirm is excluded via `:not()` rather than source order.
- **Two duplicate images removed, and a false claim corrected**
  - `imageCatalogue.ts` asserted the repeated Tricep Press and Standing Arm Curl were "genuinely different images". They are not, and it had never been checked. Aligned for a 1px crop they differ 1.8/255 and 3.3/255 where two genuinely different plates differ 16.6/255, and both are visibly the same photograph and station. **27 images now**, two guard tests added.
  - The dropped Tricep Press URL was referenced 6 times across two seeded routines; repointed at the canonical copy so the media store caches one blob, not two near-identical ones.
- **Smaller asks**: dark scrollbars (`scrollbar-color` + `::-webkit-scrollbar`, thumb inset by a transparent border so the hit area stays 10px; iOS overlay scrollbars ignore both and that is fine); opening voice line 900ms after start (**superseded: it is "Let's go!" now**) (clears the whistle, the longest opening cue; once per run, never on resume, and the flag is set even when muted so unmuting cannot fire it late); **+ button on every step row** adding a fresh step of the same type below, distinct from duplicate beside it.
- **One seeded routine, no synthesised whistle, bench out of the build** (commit `657af14`)
  - The synthesised whistle and `scripts/gen_whistle.py` are **deleted**. They existed only because the reference recording could not be shipped, which turned out to be untrue — the recording IS the reference. A failed decode now sounds a plain 2900Hz tone from `WHISTLE`'s own envelope fields, pinned by a test so nobody strips them as decoration. `curve` support left the tone spec and the engine's `setValueCurveAtTime` branch with it.
  - **The sound bench is dev-only.** `App.tsx` loads it through a dynamic import inside an `import.meta.env.DEV` branch, so Vite drops the branch and the chunk together — a *static* import would have kept `sounds.css`, a CSS import being a side effect. Verified absent from `dist` by grepping for bench-only strings.
  - **The library seeds one routine**, the Beginner Full-Body Workout Routine, whose exercise runs are now Reps groups. It ships as an authored `Workout`, not a `.tabata` import, because the importer deliberately never infers reps. Converting it changed nothing about what plays: 69 steps, 24:50, before and after. The two other `.tabata` files stay as importer fixtures — real data no hand-written fixture replaces — and leave the app's import graph, dropping the bundle **295KB → 257KB**.
- **Documentation refreshed to match the code** (2026-08-21)
  - Root `README.md`: test count, reps terminology, routine colours, the three cue figures and the CC0 whistle, the dev-only bench. **"Licence and credits" removed at the user's request.**
  - Folder READMEs: `engine` (the trailing-rest rule, the four `CueKind`s, `index.ts`), `audio` (the three figures, `schedule.ts`/`samples.ts`/the wav, the bench), `routines` (one seeded routine, 27 images and the corrected duplicate claim, `importFiles.ts`), `storage` (`migrate.ts` and read-time migration), `ui` (routine tints, the per-screen CSS split, `Menu`/`NoticeDialog`/`SoundsScreen`/`useMediaUrl`), `editor` and `media` (terminology and `useMediaUrl`'s real home).
  - Stale "round" wording fixed in `engine/types.ts` and `editor/blocks.ts` doc comments; `migrate.ts`'s legacy-label references are deliberate and left alone.
- **301 tests green**, typecheck + build clean. Everything above is committed and pushed through `657af14`.

---

## ✅ Second email template: AMRAP, EMOM and 30/30 intervals (2026-08-25, v2.9)

Wayne pasted the 25 Aug routine and the parser reported **28 skipped lines**, plus
five silent junk steps named "WORK". It arrived on a SECOND template, not a
variation of the first. Now parses with **zero skipped**.

Saved verbatim as `src/routines/__tests__/emails/2026-08-25-emom.txt` and added to
the shared `EMAILS` set, so every existing email assertion covers it too.

**The one new idea in `pasteFormat.ts`: a directive can license the line below it**
(`expectItem` / `pendingMs`). Every earlier form was self-contained on its line, so
there was no way to carry intent forward. Bare lines are still reported by default.

Forms added:

| Form | Read as |
|---|---|
| `30 sec WORK` + exercise below | a 30s step named from the next line (was five steps called "WORK") |
| `30 sec REST` | a 30s rest, needing no line below |
| `Minute 1: 12 × Bicep Curls` | a 60s step labelled 12 reps. An EMOM needs no primitive |
| `Minute 4` over a bullet | the same, heading form |
| `Minute 6: 30-sec Wall Sit` | 30s work then 30s rest: the minute is fixed |
| `Repeat 2 rounds` / `Repeat × 4 rounds` | a round count, readable ABOVE or BELOW its block |
| `3 × 30 seconds` | three rounds, every step in them 30s |
| `15 sec rest between exercises` | spaces the list already read (n-1 rests, not n) |
| `Then:` | ends the block above it |
| `Every time you finish a round:` | the next line closes every round |
| `LAST 20 SECONDS` | 20s for the effort named below |
| `Replace rest with 30-second Squat Hold` | the hold as a step, the line as a note |
| `10-MINUTE AMRAP (…)` | a single 10-minute countdown, round in the note. See below |
| `(Optinal) 🔥 Final Burnout` | the heading, marker kept in the name |

**AMRAP is the clock** (Wayne's correction, mid-session, and he was right). The
first pass kept the exercises as steps and the ten-minute cap as a note, on the
reasoning that no primitive means "as many rounds as possible". That conflated two
things: the ROUND COUNT is genuinely unreadable from the text, but the TEN MINUTES
is stated plainly. Dropping it was not caution, it was data loss, and worse than a
skipped line: with no clock and one pass through the list the app quietly ran a
ten-minute block as a single round.

It is now one timed step of the stated length, named "As many rounds as possible",
with the round as its `note`. The section is all-timed so it runs as the countdown
layout: the big clock, and `MediaPanel` showing the note beside it for the full ten
minutes. An AMRAP with no stated length has no clock to build and stays a note.

**Panel sizing bug found and fixed off the back of it.** Wayne's screenshot showed
the round set at ~16px in a box that could hold eleven lines of 42px.
`.panel__empty` divided its height budget by `wordCount`, which assumes `fitCqi`
puts every word on its own line: 43 words asked for 43 lines, drove the size under
the CSS `1rem` floor, and then used three of them.

The error is that the line count is not independent of the size. Shrinking the
text cuts the line count as well as the line height, so it is a fixed point:
`total·s²·ADVANCE/BUDGET ≤ HEIGHT` gives `s = sqrt(HEIGHT·BUDGET/(ADVANCE·total))`.
New `fitPanel(text)` in `ui/format.ts` returns `{fit, lines}` together, replacing
`wordCount` (now removed, its only caller). `--fit` 12.96/`--lines` 43 becomes
`--fit` 6.79/`--lines` 11: ~16px to ~42px on a 650px panel.

It reproduces the word-count answer EXACTLY for short names ("Rest" 1, "Get ready"
2, "Seated Abdominal Crunch" 3), which is the check that it generalises the old
rule rather than adding a second one. Asserted in `ui/__tests__/format.test.ts`.

A trailing `Repeat 2 rounds` wraps the loose steps above it, but ONLY where the
section is still a plain list. A section that has already stated a ladder or a
round keeps it: swallowing that would rewrite the workout rather than read it.

Also touched: `pasteTemplate.ts` gained three sections and the closing sprint, so
the shipped **Copy template** still demonstrates the whole grammar;
`docs/paste-format.md` mirrors it (test-asserted) and documents the new forms;
`src/routines/README.md` and the emails README record the second template.

Version bumped to **2.9**. Docs updated: `docs/paste-format.md`, the root README,
`src/routines/README.md`, `src/ui/README.md`, the emails README, and the in-app
help tray (the Paste bullet now names the shapes it reads, plus a Copy template
line).

The docs briefly claimed the parser now adds TWO things rather than one, counting
the rest that fills an EMOM minute. Reverted: that conflates SYNTHESISED with
ADDED. The parser has always built steps that appear as no bullet (the rest after
each round, the rest between exercises) because the text STATES them, and a
minute's balance is arithmetic on stated values. The get-ready stays the only
thing the app adds.

**657 tests green** (20 new), typecheck and production build clean. No engine,
storage or UI change: every new form is expressed with the existing `Repeat`,
`Ladder`, `Section` and `Segment` primitives.

---

## ✅ Run screen: section heading, quantities, bulleted round (2026-08-25, v3.1)

Three things Wayne asked for after training with the pasted routine. All in the
countdown layout, which had never had to carry them because a counted step used
to always be self-paced and therefore always drawn as a list.

**The round is bullets, not a paragraph.** `flushAmrap` joins the round with `\n`
instead of ` · `, and `MediaPanel` draws a multi-line note as a `<ul>`. Sizing
needed a new function: `fitPanel`'s closed form works because one blob of text
wraps as one blob, but six items each round UP to a whole line of their own, so
the line count STEPS rather than curves. `fitList` bisects on the one monotonic
thing (taller type needs more lines) with the bullet indent and the inter-item
gaps both charged to the budget, since five gaps would otherwise eat the slack
the height budget keeps for line spacing. Result ~36px, 6 bullets, 11 real lines,
73.7cqh of the 92 available. Left-aligned against the centred `.panel__empty`
beside it, because a list is scanned down a common left edge.

**The section is named above the clock**, in `--group-section` teal: the colour a
section already carries down the left edge of the editor, so the two screens agree
on what teal means, and it does not change hue as work turns to rest. Countdown
only; the list layout has always headed itself with it.

**Every step shows the count it asks for.** `nameWithEffort` puts "12 ×" in front
of the name, because the countdown has no effort column the way a list row does
and an EMOM minute is timed AND counted. Two guards against saying things twice:
the per-side qualifier is added only where the name has not already got it (the
parser leaves a dashed "– 5 each leg" in place, as the only record of WHICH limb),
and where the name already states the count per side the prefix stands down.

**The saved routine needed a migration, not just a parser fix.** The bullets did
not appear on Wayne's phone because a routine is STORED as it was parsed: the note
in IndexedDB still had the ` · ` join, so `fallback.includes('\n')` was false.
Added a `storage/migrate.ts` entry, which `workouts.ts:16` runs on every read
(share links, bundles and file imports too). Its two constants are FROZEN local
copies, deliberately not imported from `pasteFormat`: a migration describes data
that already exists, so it must keep matching if the parser renames the step.
Scoped by step name, so an interpunct in a hand-written note stays punctuation.

**The section heading ended up in the HEADER, once, for both layouts.**
`.label--section` in theme.css; `.sheet__title` and `.count__section` are both
gone, as is the list layout's own `<h2>`.

Two iterations to get there. First it went above the countdown in teal, matching
nothing; then the list heading was made to match it. On Wayne's iPhone in Safari
that clobbered the layout: the section name wrapped to two lines, overflowed
`.count__lead`, and landed on the header AND on the step count. The `.count`
comment had already recorded this exact failure ("the lead outgrew its row and the
step name landed on top of the time remaining") and its budget leaves about 2cqh
of slack, so a variable-height line was never affordable there.

The header row is `auto` and gives way, so the section sits under the routine
name: no budget to re-tune, and ONE location that serves both layouts instead of
the list duplicating it. Clamped to two lines so a long name cannot grow the
header and take the space from the countdown it captions. The tuned count column
is byte-identical to before the whole episode. A test asserts the heading appears
exactly once, inside the `header`, and never inside `.count__lead`.

**676 tests green** (19 new: `fitList`, `nameWithEffort`, the AMRAP note migration,
and five RunScreen component tests). Typecheck and production build clean.

---

## ✅ Drag to reorder, and three editor/run-screen fixes (2026-08-26, v3.5)

**Drag and drop in the editor.** Every row has a grip; drag it, or focus it and
use the arrow keys. `ui/useRowDrag.ts` holds the gesture and nothing else: it
decides the held row has passed its neighbour and calls `onStep(id, ±1)`, which
the editor answers with **`moveStep`**, the same function the old buttons called
and already tested for walking a step into and out of rounds, ladders and
sections. One implementation of reordering, not two.

- Pointer Events, because HTML5 drag-and-drop does not fire at all in iOS Safari.
- The loop is on `requestAnimationFrame`, not `pointermove`: a move goes through
  React so the DOM is a render behind, and auto-scroll must continue while a
  finger is held still at the edge. One frame is skipped after each move or it
  measures against a stale neighbour and moves again.
- Groups take their children (found by `data-depth`), and neighbour-testing skips
  the held block's own subtree.
- `touch-action: none` on the grip ALONE, so the list still scrolls elsewhere.
- The whole drag shares the `'drag'` coalescing key, so undo takes it back in one
  press. Escape restores the tree.

**Move up / Move down are gone from every row.** Wayne's call, in two passes
(steps first, then all rows). The grip answers the arrow keys so nothing became
pointer-only. Cleanup that fell out: `first` left `RowProps` entirely (those
buttons were its only reader) and `last` moved into `SegmentRow`'s own props,
since three components were being handed a prop they ignored.

**`retypeSegment`** (`editor/blocks.ts`): changing a step's type carries its name
when the name is still the old type's default. "Exercise" becomes "Rest"; "Plank"
is left alone; an emptied field is left alone. Coupled by test to `newSegment`,
so a default cannot change in one place only.

**Panel quantity parity**: the media panel's fallback is `nameWithEffort(entry)`,
so it reads "12 × Bicep Curls" like the heading beside it.

**697 tests green** (24 new), typecheck and production build clean.

Testing note worth keeping: jsdom lays nothing out, so the drag tests install a
`getBoundingClientRect` that gives each row a fixed height in its CURRENT order
and adds its parsed `translateY`. The frames run inside `act()`, or a state
update dispatched from an animation frame never commits.

---

## ✅ A repeat group is called Sets, not Reps (2026-08-27)

Wayne's two mixed-cardio routines use a repeat group to count SETS ("3 sets of
12 reps"), but the editor called the group "reps" everywhere: the toolbar chip,
"Number of reps", four group aria-labels, the "between reps" badge, the help
text, and the `'Reps'` label default. Meanwhile the one control that really does
mean reps, the step's `x` unit, used the same word. He had to type "Set" into
each group's label by hand for the run screen to read "Set 1 of 3".

Renamed every user-visible instance on the GROUP to "sets", and the `label`
default in `editor/blocks.ts` from `'Reps'` to `'Set'`, with both `format.ts`
fallbacks (`pathLabel`, `groupCaption`) to match. Left alone where the word is
correct: the step timing field's `Reps` label, the unit tooltips, and a ladder's
"Reps at each rung". `data-kind="reps"`, `data-between-reps`, `RepsIcon` and
`newRepsStep` are CSS hooks and identifiers, not copy, so they did not move.

**The label is DATA, so the rename needed a migration.** Every group already
saved carries the literal `'Reps'` written by the old `newRepeat()`, and the
caption fallback only fires when a label is ABSENT, so a code-only rename would
have left every existing routine reading "Reps 2 of 3". `storage/migrate.ts` now
maps `'Round'`, `'Rep'` and `'Reps'` onto `'Set'` on read, wired through
`listWorkouts`, `fromBundle` and `decodeRoutine` as before. A group someone named
themselves is still left alone. This is the second time this exact trap has been
walked into on this file; see cerebrum.

Docs and in-app help updated: root `README.md`, `src/editor/README.md`,
`src/engine/README.md`, `src/routines/README.md`, `src/ui/README.md`,
`theme.css`'s palette comment, and the Groups section of `ui/help.ts`.

Two stale things fixed while in there, both left behind by the drag-to-reorder
commit rather than by this one: the help said "Each row can move up or down" and
the editor README's button-grammar table still listed `up · down` in every row.
Both now describe the grip.

**700 tests green** (3 new), typecheck and production build clean. Three tests
needed changing rather than fixing, all for the same reason: `dirty.test.ts` used
`{ label: 'Set' }` as its "changed round label" case, and the `bundle` and
`shareLink` round-trip fixtures used `'Reps'`, which the migration now rewrites
so the round trip stopped being identity. **Version bumped 3.5 to 3.6.**

NOT done, and a real gap: **the editor cannot show a step that is both timed and
counted**, though `pasteFormat.ts` builds them for EMOM minutes. `timingOf()`
prefers `reps` and hides the seconds; `setTiming()` then deletes both fields
before writing one, so the next keystroke on that row silently drops the
duration. Supporting it means a second field on the row. See cerebrum.

---

## ✅ Text export, and one Send menu per routine (2026-08-27, v3.7)

Import already handled all three formats Wayne wanted, dispatching by CONTENT
rather than extension: the bundle marker first, then `.tabata`, then anything
that is not JSON goes to the paste parser with the filename as the routine name.
Nothing to build there. The gap was the other direction.

**`routines/writeRoutine.ts`** writes a routine in the paste format. The inverse
of `pasteFormat.ts` and deliberately a narrow one: the parser reads a handout, so
many forms land on the same blocks, and the writer picks exactly one per block.

The property the test pins is NOT `write(read(x)) === x`, which is false. The
parser prepends a five-second get-ready and gathers loose steps into a section
called "Routine", and no writer can express those away. It is that **the second
pass changes nothing**. The shipped template needs two passes, and the test says
why: its AMRAP is inside a rounds group, where the AMRAP heading cannot be
written at all.

Three traps, all now tests:

- **`Then:` closes a rounds group, not an AMRAP.** An AMRAP's round collects
  bullets until a section HEADING, so the AMRAP form is only written where a
  heading or the end of the text follows.
- **A group's children are siblings too**, so the separator rules run inside
  sections and rounds, not only at the top level.
- **The parser's own get-ready is not written back.** It is prepended LOOSE above
  any section; writing it as a bullet would sink the routine a level per trip.

Everything the grammar cannot say is collected in `lost` and shown, because a
share that quietly drops 23 illustrations looks like it worked. On Wayne's
routine 2 that is 23 pictures, the two "Change Sides" steps whose role cannot be
read back off their names, the colour, and the favourite mark.

**UI.** The library row's two send buttons became ONE `Send` menu holding all
four: Copy a share link, Copy as text, Export as a file, Download as text. The
row LOSES a button rather than gaining one, which is the lesson the editor row
already taught. `Menu` grew an optional `className` and `hint` so the same
component is a header chip or a 42px row button, with the caret dropped when
there is no label. `Export all` is now `Export all as JSON`.

**Deliberately NOT built: text export of the whole library.** `parseRoutine`
parses exactly one routine, so a multi-routine text file would be the only export
the app could not read back. Text export is inherently per-routine and lives on
the row.

**725 tests green** (30 new: 25 for the writer, 5 for `Menu`), typecheck and
production build clean. Docs: root `README.md`, `docs/paste-format.md` gained a
"Writing a routine back out" section listing every loss, `src/routines/README.md`
gained the three traps, and the library help covers the new menu.

---

## ✅ The Send menu lands where it should, and Backup is called Backup (2026-08-27, v3.8)

**bug-070, and it was not the arithmetic.** `.library__scroll` carries
`transform: translateY(calc(var(--pull, 0) * 1px))` for pull-to-refresh at ALL
times, and any transform, `translateY(0)` included, makes that element the
containing block for `position: fixed` descendants. The `Menu` list is fixed and
placed from the trigger's viewport rect, so a menu opened from a library ROW was
positioned against the scrolled list and appeared far below its button, further
off the further you had scrolled. The header menus were always fine because they
sit outside the scroller, which is why this only existed once a Menu went into a
row.

Fixed with a **portal to `document.body`** rather than arithmetic against the
offending ancestor, so the rule holds wherever a trigger lives instead of asking
every future ancestor to watch what it does with transforms. `filter`,
`perspective`, `will-change` and `contain` are the same trap. Pinned by a test
that mounts a Menu inside a transformed ancestor.

**Placement rewritten** while in there. It hardcoded `width = 208` to match
`width: 13rem`, true only while the root font size is 16px, and never measured
height at all. It now measures the rendered box in a `useLayoutEffect` (before
paint, so nothing flashes), opens BELOW where there is room and ABOVE where there
is not, takes the roomier side and caps `max-height` when it fits neither, and
right-aligns when a left-aligned list would overrun the screen. Header chips are
unaffected and a test says so. `place()` is exported and unit tested, because
jsdom lays nothing out and the arithmetic is the whole behaviour.

**Wording, all Wayne's.** The Send menu is ordered copy link, copy text, download
text, backup: the three that send a routine to someone, then the one that keeps
it. That is why the JSON export is now called a **BACKUP** rather than an export,
in both menus: `Backup incl. images` on a row, `Backup all incl. images` in the
Routines menu. The notice says "Backed up" to match, and "photos" is gone from
every user-facing string in favour of "images".

**738 tests green** (13 for `Menu`), typecheck and production build clean.

Docs: the containing-block trap is in `src/ui/README.md` under "Traps this
codebase has already hit", the `.menu__list` comment in `theme.css` now states
the condition under which `position: fixed` is viewport-relative, and
`.library__scroll` in `library.css` carries a CAUTION at the source of the
transform. Logged as bug-070.

---

## ✅ A step can be counted AND timed, and a weight is a field (2026-08-27, v3.9)

Two of the same shape: a value that had nowhere to live but the step's name.

**Counted and timed** (Wayne picked option C of four). The unit select gained
`× in` and `× each side in`, and a second number renders after it, so the row
reads `12 × in 20 s`. `Timing`'s `reps` variant carries an optional `durationMs`.
The row survives a phone because `.erow__main` is `flex-wrap: wrap`: the pair
drops to a second line rather than crushing the name field.

The display was the smaller half. **`setTiming` clears both `durationMs` and
`reps` before writing**, so a patch mentioning one deleted the other, and typing
in the count destroyed the clock on the first keystroke. Every commit now writes
both. Going self-paced still drops the duration, which is correct, and undo is
how the old value comes back; remembering it in component state would be state
undo cannot see.

**Weights.** `Segment.load`, FREE TEXT, because half of what a routine loads is
not a number: a band has a colour and a press-up has your own weight. It lives in
`.erow__extras` beside Note and Or, which reveals itself for a step that has one.
This reverses the 2026-08-26 decision to keep weights in the name, at Wayne's
request, now that the row had shown it could carry another value.

Wired into all three registries at once, as cerebrum says a new field must be:
`bundle.ts isBlock`, `dirty.ts sameBlock`, and `compile()` onto `TimelineEntry`.

**`storage/migrate.ts` lifts a trailing weight out of names already saved**, since
a routine is stored as it was authored. Verified against Wayne's routine 2: all 23
weights lifted, `Cycling`, `Rest`, `Change Sides`, `Squat to 90` and
`20kg Goblet Squat` correctly untouched. The pattern takes only a number and a
unit at the very END of a name.

**The run screen is unchanged to look at.** `nameWithLoad` puts the weight back
after the name, so it reads exactly as the hand-typed names did. Deliberate:
`.count__lead` has about 2cqh of slack and has already overflowed twice from this
kind of addition, so the DATA moved out of the name and the READING did not. A
weight on its own line is a change to that tuned budget and wants a phone in hand.

`writeRoutine` writes the load back into the name, since text has no syntax for
one, so it survives the round trip and the migration lifts it out again.

**768 tests green** (30 new), typecheck and production build clean. Docs: root
`README.md`, `docs/paste-format.md`, `src/editor/README.md`, and two help lines.

---

## 📌 Queued after the generator: a weights settings page

Wayne's, 2026-08-27. A settings page listing every applicable exercise with a
weight field, so a routine takes its load from there instead of carrying its own.
Change a weight once and every routine follows, rather than editing each one.

`Segment.load` already exists and `generate.ts` already seeds a weight from the
saved library, so this replaces that lookup with a settings lookup and keeps the
per-step field as an override.

**Seed it from the strengthlevel.com numbers**, worked out 2026-08-27 for male,
55, 88kg, targeting Novice. Those standards are ONE-REP MAXES and Wayne's sets
are twelve reps, so the working weight is about 70% of the standard:

| Exercise | Novice 1RM | 12-rep target | Wayne lifts |
|---|---|---|---|
| Leg Press | 90 | 63 | 65 |
| Chest Press | 46 | 32 | 30 |
| Lat Pulldown | 49 | 34 | 30 |
| Seated Row | 49 | 34 | 30 |
| Calf Press | 67 | 47 | 45 |
| Shoulder Press | 37 | 26 | 10 |
| Seated Leg Extension | 55 | 39 | 15 |
| Hamstring Curl | 45 | 32 | 10 |
| Hip Abductor | 52 | 36 | 15 |
| Cable Fly | 47 | 33 | - |
| Triceps Press | 27 | 19 | - |

His COMPOUNDS are already at Novice; the gap is all in the isolation work. Note
the caveat before using these as gospel: a Horizon stack is not a commercial
machine, and 25 of the 41 exercises have no equivalent on the site at all.

---

## ✅ Done: how long a rep-based routine takes (2026-08-27, v6.3)

A self-paced step ends when you tap Next, so it contributes nothing to
`totalDurationMs` and a whole session of counted work used to read "0s". Two
pieces, and the second is the interesting one.

**`src/routines/estimate.ts`** returns `{knownMs, estimatedMs, rough}`: the timed
steps exactly, the counted ones at a seconds-per-rep rate. The rate is HARVESTED,
not chosen — the instructor writes fourteen exercises both ways ("30-second
Plank" one week, "20 x Plank" another), so `exercises.prescription.ts` carries a
rate for those and the median (2.0s) covers the rest. It runs 1.0 to 6.0, which
is why one flat rate would be wrong by six times at the edges.

**`src/storage/paces.ts`** then measures YOUR pace. Every gate already times
itself; the elapsed was being thrown away. `useTimer` takes an `onGate` callback,
`RunScreen` passes `recordGate`, and after three samples the median beats the
harvested rate for that exercise. In `localStorage` deliberately: per-device,
small, and losing it costs nothing.

**Dry runs are rejected**, which was Wayne's condition. Tapping Next through a
routine to see what is in it produces a gate every few hundred ms; `MIN_GATE_MS`
of 4s throws those away, along with rates outside 0.5–12 s/rep and gates over
eight minutes. Timed steps inside a gate are subtracted from the elapsed rather
than charged to the exercise beside them.

Shown in ALL FOUR places (Wayne asked explicitly): the library row, the editor
header, the generator preview and the Ready card. One formatter, `estimated()` /
`estimatedValue()` in `format.ts` — a guess rounds to whole minutes and says
"about", because "about 35:20" claims a precision it has not got. The Ready card
uses the bare value with "Est. total" as its label, since the figure sits at
title size where "about" reads as part of the number.

`currentRates()` caches the parsed rates, dropped on save: the library asks once
per row and re-parsing storage twenty times a render is work for nothing.

Also v6.3: the generator offers 3 and 4 sections (`SECTIONS_FEWEST = 3`).

---

## ✅ Done: generate the instructor's shape, not just a circuit (v5.0 to v6.2)

The generator builds two circuit shapes. The routines Wayne is actually sent are
a different thing, and the gap was MEASURED on 2026-08-27 rather than guessed.

**The corpus is now SIXTEEN routines, not four** (added 2026-08-27 from
`~/Downloads/routines`, 18 `.eml` files yielding 16 after two re-forwards).
Weekly from 16 April to 25 August 2026.

Extracted by a script validated against the existing fixtures first: it
reproduces three of the four byte for byte. That check is what makes the other
twelve trustworthy.

**But ten of the twelve are on a THIRD, EARLIER template the grammar has never
seen**, and only 53% of their lines parse. See the emails README for the full
list of forms; the short version is bare unbulleted lines, a lowercase `x`,
ladder counts inline with the exercise name, bare `LEGS`/`ARMS`/`ABS` headings,
ladders of DURATIONS, and ranges like `10/12 x` and `1-2mins`.

**PHASE 0 IS DONE** (2026-08-27, v5.0, commits c4f8a48 and ee0b410). The grammar
was widened for the earlier template and the corpus now reads at **94%**, up from
53%, with the four routines the parser was written for still at 100%. Eleven
forms learned; see the emails README for the list and for what the remaining 42
lines are.

**Do not chase the last 6%.** Those lines are mostly not step definitions:
accumulators written down the page (`1 + 2 + 3`), a countdown, a course drawn in
characters, interval pairs on a line shaped like a range. Each needs a decision
about what it MEANS before it can be read, and they sit in finishers rather than
in the body of a routine.

### The gap

| | Generator today | Instructor routines |
|---|---|---|
| Sections | 0 | 7 to 8 each |
| Ladders | 0 | 1 to 3 each |
| Self-paced steps | 0 | 23 to 27 in three of the four |
| Rep counts | 0 | 9 to 20 fixed, 3 to 7 rungs |
| Alternatives, notes | 0 | 1 to 4 each |

Every block kind already exists and the engine runs them, which
`strength-training.routine.json` proves. **This is composition work, not engine
work.**

### They are TWO templates

- **Rep-based**, three of the four (general, trampoline, bands): mostly
  self-paced, ladder-heavy, sections running Warm-up, General Body, Arms &
  Shoulders, Legs, Core, Finisher, Final Burnout. The same skeleton all three
  times, so the skeleton is data.
- **Clock-based**, the 25 Aug EMOM one: 34 timed steps against 3 self-paced.
  EMOM, a 30/30 interval, a counting challenge, a 3-minute challenge.

### The thing that breaks, and it is not small

**"About how long" stops meaning anything.** A self-paced routine has no length:
it is gated on taps, so `totalDurationMs` cannot predict it. The budget solver,
which is the best part of `generate.ts`, does not apply to a shape that is 24
self-paced steps.

DECIDE THIS BEFORE BUILDING. The question becomes advisory, or applies only to
the timed parts, or is replaced by "how many sections". It changes the dialog
either way.

### What needs building

PHASES 1 AND 2's FIRST HALF ARE DONE (v5.5, v5.6). `npm run harvest` runs two
generators: `exercises.prescription.ts` (193 rows, how each movement is
prescribed) and `exercises.harvested.ts` (16 rows, movements the authored tables
never named). The generator reads the prescriptions, so a plank is a held 40
seconds and hammer curls are twelve, rather than everything being a flat 20.

Three traps paid for, all worth remembering:

- **A harvest must not treat its own output as an input.** Comparing against
  `EXERCISES`, which includes the generated file, made the second run see its own
  16 rows as already known, write none, and silently drop them from the table.
  It compares against the AUTHORED tables now.
- **One folding, not two.** `src/routines/foldName.ts` is the single answer to
  "are these two written names the same exercise". It was briefly two, and the
  harvests then disagreed about how much of the same corpus they recognised.
- **Some harvested durations are the FORMAT'S.** An EMOM minute is 60 seconds
  because the EMOM says so, not because a bicep curl takes a minute. Circuit sets
  are capped at 45s for that reason.

PHASE 2 AND PHASE 3 ARE DONE (v5.7). `exercises.shapes.ts` is harvested too:
nineteen ladder pyramids used VERBATIM, the six section themes in the order the
routines use them, and the typical counts (6 sections, 5 to 8; 4 exercises a
section).

`generateRoutine` now takes `style`. `circuit` is unchanged. `sections` builds
the instructor's shape: a timed warm-up, then themed sections that are either a
ladder (a main lift on the rungs, accessories keeping their own counts) or rounds
of counted steps with a rest between. Mostly SELF-PACED, so it has no length, and
`notes` says exactly that rather than the app pretending to a number. `sections`
replaces `totalMs` for that style, which was Wayne's call.

PHASE 4 IS DONE (v5.8). The dialog asks for a SHAPE first, and the shape decides
which other questions apply: a circuit is asked how long, sections is asked how
many, and every question belonging to one is hidden for the other rather than
shown and ignored. The preview says "12 exercises, 6 sections" rather than a
duration it cannot know.

One gap found by its own test: a machine-only sections routine had NO WARM-UP.
Nothing on the multi-gym is a stretch or a jog, so the equipment filter left that
section empty and it was silently dropped. The warm-up ignores the equipment
choice now, because you warm up on the floor or the bike whatever the session is
made of.

**THE QUEST IS COMPLETE.**

---

## ✅ Done: the weights settings page (2026-08-27, v6.5)

Routines › Weights. Sixty-seven rows — the 41 multi-gym exercises, 14 dumbbell,
1 kettlebell, 11 band — searchable, one free-text weight each.

**THE RULE, and it is the whole feature.** An empty `load` on a step does not
mean unloaded: it means "whatever I lift for this". It is resolved from the
settings table on the way INTO a run, a text export or the editor's placeholder,
and never written back. A step that DOES state a load keeps it, because it is
overriding on purpose. So changing one number changes every routine that does
not disagree.

- `src/storage/weights.ts` — the store. localStorage, cached, dropped on save.
  `SEED_WEIGHTS` carries twelve. FOUR are Wayne's own numbers off the machine
  (Standing Shoulder Press 10, Seated Abdominal Crunch 20, Seated Leg Extension
  15, Hip Abductor Leg Raise 20, given 2026-08-27) and they replace the
  looked-up ones outright — the shoulder press estimate was 30kg against a real
  10. The other eight are strengthlevel, rounded UP to the nearest 5kg because
  that is where the pin goes, and are STILL UNCHECKED against the machine. An empty value is RECORDED
  rather than removed, or a cleared field would refill from the seed.
- `src/routines/loads.ts` — `exerciseKey()` and `fillLoads()`, pure. The key
  sees through a count (`12 × Leg Press`) and the announcement wording
  (`Get ready: Leg Press`), so all three spellings of a lift take one weight.
- The generator now writes down NO weight that Settings can supply, and does not
  bake one into an announcement name either. Only an exercise Settings has never
  heard of is stamped from what your last routine said.
- Backups carry the weights (optional field, no version bump) and merge them
  back on restore, file winning. A text export resolves them, since the grammar
  has no way to say "whatever I lift".
- "Fill n from my routines" takes what your saved routines already use for any
  row still blank. The placeholder shows it before you do.
- v6.6: each row carries the manufacturer's illustration, tappable for the full
  size. Bundled paths, so no blob to read; a row without one gets an empty frame
  so the names still line up.

**v6.8 closed the gap.** "Let n routines follow these" runs `stripLoads`, which
takes the stated weight off every step whose exercise the page can answer for,
behind a ConfirmDialog naming the count. A step for an exercise with nothing set
keeps its weight: the routine is then the only record of it. The editor's Weight
field gained an × that clears in one gesture, and the page gained a help tray of
its own (`WEIGHTS_HELP`), because "an empty field means something" is the one
rule that must not be buried in the library's list.

---

## ✅ Done: the weights settings page — the original plan

Every routine carries its weights in the step's `load` field, so changing what
you lift means editing every routine that names it. The settings page holds one
weight per applicable exercise and routines take it from there.

- One row per multi-gym exercise, seeded from the strengthlevel numbers in the
  table above (male, 55, 88kg, Novice, x0.70 for a 12-rep working weight):
  Leg Press 63, Chest Press 32, Lat Pulldown 34, Seated Row 34, Calf Press 47,
  Shoulder Press 26, Leg Extension 39, Hamstring Curl 32, Hip Abductor 36,
  Cable Fly 33, Triceps Press 19.
- Decide where a routine's `load` comes from: read through at run time, or
  stamped in at generate time and editable after. The first keeps every routine
  current; the second keeps a saved routine reproducible. Ask Wayne.
- The caveat from the table stands: a Horizon stack is not a commercial machine,
  and 25 of the 41 exercises have no equivalent on the site at all.

1. **Three fields on the exercise table, all harvestable.** Verified against the
   four: 33 exercises are counted only, 47 timed only, 12 appear both ways; rep
   counts run 5, 6, 8, 10, 12, 15, 20, 30 and durations 10, 15, 20, 30, 40, 45,
   60s; 19 appear as a ladder's main lift. A harvest script the same shape as
   `scripts/exercise_metadata.py`.
2. **Ladder counts, verbatim.** Eight distinct pyramids are already in the
   corpus, all symmetric: `2-4-6-8-10-8-6-4-2`, `20-16-12-8-4-8-12-16-20` and so
   on. Use them rather than generating sequences.
3. **Section composition**, from the skeleton the three rep-based routines share.
4. **New emitters in `generate.ts`**: section, ladder, self-paced rep step,
   rest-between-rounds, and for the clock template EMOM, 30/30 and AMRAP.
5. **A style question** in the dialog: Circuit (what exists), Rep-based,
   Clock-based.

### What to push back on

- **The clock template is a sample of ONE.** Build the rep-based template first,
  from three routines, and treat the clock one as a stretch until more arrive.
- **A wrong ladder is worse than a wrong circuit.** A circuit that misjudges is
  boring; a ladder that misjudges is twenty reps of something you cannot do
  twenty of. The rung counts and the main-lift choice want Wayne's eye before
  they ship.
- The exercise table's non-machine half came from **four routines, one
  instructor, five weeks**. More emails firm up the rep counts, the ladder shapes
  and the clock template at once, which is why phase 1 waits.

---

## ✅ Done: generate a routine (2026-08-27, v4.0 to v4.7)

A generator that asks a few questions and builds a routine from the patterns
already in this repo. Planned 2026-08-27, decisions below are Wayne's and settled.

### The questionnaire

| Question | Drives |
|---|---|
| Approximate total duration | how many exercises fit |
| Body areas to target | which exercises are eligible, and the rotation |
| Recovery: passive or active | pattern A or B |
| Active recovery type (cycling, trampoline, ...) | the recovery step's name and image |
| Equipment: multi-gym / none / mixed | which exercises are eligible |
| Sets per exercise (default 3) | the per-exercise cost |

### The three patterns it generates from

- **A. Passive recovery**, from `beginner-full-body.routine.json`:
  `Get ready 15s -> 3x [work 20s / rest 10s] -> Recover 60s`, per exercise.
- **B. Active recovery**, from Wayne's routines 2 and 3:
  `Get ready: <name> 30s -> cardio 60s -> Get ready 15s -> N x [work 20s / rest 10s]`,
  inside a 10 min cardio warm-up and a cool down.
- **C. Bodyweight**, from `strength-training.routine.json`: sections, ladders,
  self-paced rep steps.

### ONE exercise table, not two pools

Wayne's answer to the torso shortfall (only 5 torso exercises on the machine) is
to supplement from non-machine exercises. So equipment is a FIELD, not a
partition: the choice filters, and a shortfall widens the filter rather than
shortening the routine.

Each row: `file?`, `name`, `group`, `station?`, `attachment?`, `perSide`,
`equipment`, `push|pull` for upper.

### Where the data comes from

**The machine half is fully derivable from the Horizon guide, and none of it is
invented.** Verified 2026-08-27 against
`~/Library/CloudStorage/OneDrive-Personal/Documents/Fitness/Home Gym/Horizon Torus 5 Exercise Guide.pdf`:

| Field | Source in the guide | Result |
|---|---|---|
| Station 1 to 8 | text after `STATION` | all 41 parsed |
| Muscle group | TITLE BAND COLOUR, which the manual's own key defines | yellow `upper` 25, green `torso` 5, blue `lower` 11 |
| Attachment | instruction text ("attach ankle strap") | lat bar, low row bar, ab strap, free-motion, ankle |
| Per side | "one leg", "outside leg", "repeat on opposite side" | 6 exercises |

Cross-checks: Glute Kickback comes out station 7 / ankle / per side, matching what
was read off the plate. Standing Leg Curl is per side but uses a ROLLER PAD, so it
correctly gets no ankle strap and no 20s get-ready.

Two rules that were memory become data: the 5 ankle-strap exercises get 20s
get-readys, and the 6 per-side ones get 2 sets a side plus Change Sides.

Station 7 holds 17 of the 41, so ordering by station mostly means grouping the
free-motion work.

**The non-machine half is authored**, covering bodyweight, dumbbell, kettlebell
and resistance band. Seed from `strength-training.routine.json` (36 distinct
exercises) and the four email fixtures, then extend. No illustrations, which
Wayne accepted: a picture can be uploaded per step later. Same for active
recovery types beyond cycling.

**Push/pull** is the one classification not in the guide, needed for routine 2's
legs/core/push/legs/push/legs/pull/core/pull/legs alternation. Derive it
mechanically from names and show Wayne the ~25 upper-body rows to correct.

**Weights come from history.** Now `Segment.load` is a real field, look through
the saved library for the last load used on that exercise and seed it. Nothing
found leaves the field blank rather than inventing a number.

### The generator

`src/routines/generate.ts`, PURE, no React, testable like the engine:

    generateRoutine(spec, library, rng) -> { workout, notes }

Duration is a solve, not a guess. The skeleton is fixed, so per-exercise cost is
closed form: pattern B with 3 sets is `30 + 60 + 15 + (sets x 30) - 10 = 185s`,
warm-up 615s, cool-down 75s. A 45 minute target leaves 2010s, which is 10
exercises. That IS routine 2, which is the check that the arithmetic matches
reality rather than itself.

`rng` is injected so tests are deterministic and "generate another" differs.

### UI

A `Generate` item in the Routines menu, on the `.modal` plus panel-child pattern
`PasteDialog` uses. It OPENS THE RESULT IN THE EDITOR as a draft rather than
saving to the library, same ending as Paste.

### Phases

1. DONE (commit 7870b1b). `scripts/exercise_metadata.py` generates
   `exercises.machine.ts` from the PDF: 41 rows, every field but `pattern` read
   out of the manual.
2. DONE. `exercises.other.ts`, 86 rows harvested from
   `strength-training.routine.json` and the four emails and canonicalised. The
   corpus held 105 names but spells Mountain Climbers three ways and Bulgarian
   Split Squat four, and carries per-side qualifiers as if they were names.
   Seven rows are marked ADDED where the corpus had one of an obvious pair.
   The `use` field (`strength` / `cardio` / `mobility`) fell out of the data and
   gives the generator its warm-up and active-recovery pools from the same table.
   Push/pull reviewed and accepted by Wayne 2026-08-27.
   **127 exercises total. Torso is machine 5, other 21, so the shortfall that
   prompted the whole one-table design is comfortably covered.**
3. DONE. `src/routines/generate.ts`, pure, 29 tests. `rng` is injected, so a seed
   pins a routine and "generate another" differs.
   **The length is not estimated and hoped for**: exercises are added one at a
   time and each one's real cost is known, so a per-side exercise costing two
   groups and an ankle-strap one costing five more seconds are exact rather than
   averaged. A 45 minute machine routine comes out at 45m 05s.
   Two bugs worth remembering, both found by tests:
   - "never the same area twice" excluded the ONLY area when one was selected, so
     a torso-only routine stopped after one exercise. The rule is about
     alternating, so it only applies when there is something to alternate with.
   - The FIRST exercise gets no announcement, correctly: the announcement is what
     you read while the cardio minute runs, and the first comes off the warm-up.
     A test pins it, since it looks like a bug otherwise.
4. DONE. `ui/GenerateDialog.tsx`, on the `.modal` plus panel-child pattern, with
   a LIVE preview: the generator is pure and fast, so the length, the exercises
   and the notes update as the answers change. You find out a torso-only machine
   routine cannot fill an hour while the answer can still be changed.

   **PASTE now opens in the editor too**, Wayne's call. It used to go straight to
   the library, and the comment explaining why said the editor could show neither
   a section nor a ladder. That has been false since `SectionRow` and `LadderRow`
   landed. Both now go through one `onDraft` prop, so nothing reaches the library
   until it has been looked at.

### Done, v4.0

The whole quest is built. Remaining ideas, none started:

- Ordering by station is only a TIEBREAK today, so a routine can walk between
  stations more than it needs to. Worth watching in use before tuning.
- The generator cannot make a section or a ladder, so it only builds the two
  circuit shapes. Pattern C is unimplemented.
- No routine has been generated and then actually trained with.

### Tests

Total duration lands within tolerance; no area repeats back to back; no exercise
twice; only selected areas appear; per-side exercises get Change Sides;
ankle-strap exercises get 20s; the same seed gives the same routine; the result
compiles.

---

## 📝 Standing items, none blocking

Not a quest. These have been open a while and can only be closed with a phone in
hand:

- **Train with it.** Still the only real unknown: whether the wake lock holds on
  Wayne's iPhone through a full session, and whether the whistle decodes on iOS
  or falls back to the plain tone. Neither can be checked from a desktop browser,
  and the physical interaction changed completely — you now reach for the phone
  once per set. **Listen to the first whistle specifically** — see the fix below;
  it was wrong on every cold start and the correction is unverified on a phone.
- **Eyes on the washes.** The screen and routine-colour gradients were just made
  ~a third more prominent, unverified visually. `npm run dev` → the library, the
  editor with a routine colour set, and a running routine as the phase changes.
- **Portrait iPad** puts the media panel at ~250x773, which renders near-square
  illustrations small. Known, deliberate, unfixed.
- **"Rest 45 seconds after each round" gives three rests for four rounds**, since
  the trailing-rest rule drops the last one. Raised twice and never decided; one
  line in the parser moves the rest outside the group if four is wanted.

### The iOS pass (2026-08-22)
Everything below was found on the device and fixed; the whole class of bug was
invisible in a desktop browser, which is why the workflow changed too.

- **Test on the phone against the LAN dev server**, not the deploy:
  `npm run dev -- --host 0.0.0.0 --port 5180` → `http://<mac-ip>:5180/`, and Add
  to Home Screen from that URL for standalone/notch behaviour with HMR.
- **The version badge** (`src/version.ts`, shown beside the help button) exists
  because an installed PWA keeps its assets until properly relaunched. It caught a
  reported "gap" that had already been fixed. **Bump it every build you test.**
- **Safe-area insets** on every band that holds controls, plus the top layer,
  which is inside no band at all (bug-037). Check the `@container` overrides: a
  bare padding there cancels the inset on an iPhone in landscape.
- **A dialog is two elements** — `.modal` sheet + panel div (bug-041). Never style
  a `<dialog>` as the box: `height: fit-content` does not hug on iOS and its auto
  rows stretch, which pins the title up and draws buttons as slabs.
- **`crypto.randomUUID` is secure-context only** (bug-040), so New / Duplicate /
  paste / import all threw on the plain-HTTP dev origin. Use `newId()` from
  `src/id.ts`. `crypto.subtle` has the same limit, so photo uploads still cannot
  be tested over plain HTTP.
- **Three different causes produced "a gap at the bottom"**: `height: 100%`
  resolving against the safe viewport, a stale PWA build, and a scrolled document
  — then a fourth, `dvh` shrinking for the keyboard and never coming back. The
  shell is `100svh` now (stable — it was `lvh`, see the 2.2 entry), and `.modal`
  alone uses `dvh` (tracks the
  keyboard). The document does not scroll at all.
- **Speech is gesture-gated too** (bug-042): "Let's go!" was silent on the first
  start after opening the app, because it fires from an effect plus a timeout and
  iOS drops a page's first utterance outside a gesture. `unlockSpeech()` now runs
  from every control beside `audio.unlock()`. **Confirmed working on the device**
  from a cold start.
- **Also**: scrollbars hidden on touch, iOS zoom stopped by giving the paste box
  16px, list rows given a width budget, count column tightened, per-kind colours
  on the add buttons, the note toggle moved out of the action cluster, and no more
  white flash on pull-to-refresh (an inline ground in `index.html`).

**Still unverified on a device, and only training with it will answer:** whether
the wake lock holds through a full session, and photo uploads — `crypto.subtle` is
secure-context only, so those need the deployed HTTPS build rather than the LAN
dev server.

### The iPad portrait layout (2026-08-22) — version badge 1.5

On an iPad in portrait the run screen put the countdown and the picture side by
side, where an iPhone stacks them. The cause was the breakpoint reading SIZE when
the layout depends on SHAPE: a portrait iPad is 768–1024px wide, so it passed
`min-width: 46rem` despite having no height to give away.

- `src/ui/run-screen.css` — both blocks that define the two-column layout
  (`.run__body`'s columns, and `.count__clock`'s column-specific `--clock-coef`
  / `--clock-height`) are now `@container shell (min-width: 46rem)` with a nested
  `@media (orientation: landscape)`. A portrait iPad stacks; an iPhone in
  landscape is wide AND landscape, so it keeps the columns; a laptop is
  unaffected.
- It must be a viewport media query, not an aspect-ratio container query: `.run`
  is an `inline-size` container, so it cannot be asked about its height. The
  shell is pinned to the viewport, so the two agree on orientation.
- The two blocks must carry the SAME gate. Gating only the columns would size the
  clock for a column it is no longer in.
- The width-based `46rem` overrides that only widen padding (`.run__header`,
  `.rest-state`, library, editor) were left alone: a portrait iPad can afford the
  wider padding, and those insets still matter in landscape.
- Documented in `src/ui/README.md` ("A wide layout is about shape, not size") and
  cerebrum. Typecheck, build and 513 tests green.

**Unverified on the device** — needs a look on the iPad in portrait, and a check
that landscape iPad and iPhone are unchanged.

### The editor's image control (2026-08-22) — version badge 1.6

The image row under every step is gone. It is one button in the row's control
band now, immediately left of the note button, with two states in one slot:

- **No image** → an image button that opens the chooser. That is the existing
  `ImagePicker` modal, which now also carries **Upload a photo** in a footer row
  (`.picker__actions`, a third `auto` row on `.picker`) — one dialog for one
  question, instead of Choose and Upload as two chips in the row.
- **An image** → the 42px thumbnail itself, which opens `ImageDialog`: the
  picture, the step's name, **Close** and **Remove image**. This replaces the old
  full-bleed `Lightbox`, whose CSS is gone.
- Both dialogs are `.modal` sheet + panel child, and the preview's panel is
  `.notice` verbatim — the layout already proven on iOS. No bespoke boxes, which
  is what cost hours on bug-041.
- The upload error moved from the inline `.editor__error` line in the header (it
  would now be behind the dialog) to a `NoticeDialog` rendered as a SIBLING of the
  chooser — nesting it would fire the chooser's own `onClose` on dismissal. On
  failure the chooser stays open so another file can be tried; on success it
  closes, since a stored photo IS the answer.
- The thumbnail is keyed on `segment.media`, not on the resolved URL: a ref whose
  file is not on this device opens an empty frame with Remove and a line saying
  why. Keying it on the picture would strand the step that most needs clearing.
- A LISTED step (runs as a row of its section's list) gets no button, but keeps
  its thumbnail if it already has an image — the same no-trapped-data rule as
  before, with the "not shown while running" line moved into the dialog.
- Dead code removed: `.lightbox*`, `.erow__unseen`, `.erow__unset`, the
  `.erow__image` row rules, `.editor__error`, and `SegmentRow`'s `onClearImage` /
  `onUpload` props. Help text and `src/editor/README.md` rewritten to match.
- Typecheck, build and 513 tests green.

**Unverified on a device** — needs a pass on the iPhone and the iPad: the chooser,
an upload, the preview, Remove, and a listed step that already has an image.

### The step row's controls (2026-08-22) — version badge 2.4

Three rounds. A step row wants four fields and eight 42px buttons — about 380pt of
buttons against a phone row's ~313pt — and that 70pt gap cannot be closed by
arranging things better. Both attempts to arrange a way out are recorded in
`src/editor/README.md` so nobody retries them:

1. Pair the buttons, keep them loose in the wrap flow → still three and four lines
   with holes.
2. Gather all eight into one `.erow__band` → **worse**, four lines. A flex item is
   placed by its MAX-CONTENT width and only then shrunk, so the ~380pt band could
   never share the phone's line: it took one of its own and split inside it.
   Grouping items can only make them harder to place.

One real waste was found and fixed on its own merits along the way: a native
`<select>` takes the width of its widest option, so the unit select showed `s`
while holding the width of `rung each side` — ~140pt of a 313pt row. It is sized by
the label it shows now (`data-unit` plus three `em` widths in `.efield--unit`),
worth ~50pt.

**What shipped** — the user's suggestion: the buttons leave the row when there is
no room. `.erow__tools` holds all eight and has two jobs, chosen by CSS alone:

| Container | `.erow__tools` | `.erow__more` |
|---|---|---|
| under 64rem | absolutely-positioned panel off the row's bottom-right, hidden until ⋯ opens it | the ⋯ trigger |
| 64rem and over | inline at the trailing edge, always visible | `display: none` |

- Phone: two lines — `[role][name]` then `[secs][unit] … [⋯]`. Narrow laptop
  window: one line. iPad portrait: one line. iPad landscape and up: everything
  inline on one line.
- **64rem, not the true minimum of ~53rem** — the deepest indent takes 48px and the
  name should not sit at its 9rem floor. Even a two-level-nested row has ~44px
  spare at 64rem.
- **No width measured in JS.** The `tools` flag is inert above the breakpoint, so
  nothing needs correcting on a resize and there is one source of truth.
- `[data-open]` is repeated inside the container query — it beats the bare class on
  specificity, and without it a row left open would keep `display: grid` when the
  window grew.
- The panel is `position: absolute` against `.erow`, not viewport-fixed like
  `Menu`, so it travels with its row on a scroll and needs no close-on-scroll. The
  row takes `z-index` while open (`.erow[data-tools]`) or the next row paints over
  it. It closes on any click inside it — every button in it is a deed.
- New `src/ui/useDismiss.ts` (Escape + press-outside), extracted from `Menu` and
  now used by both. New `MoreIcon`.
- Typecheck, build and 513 tests green. Logged on bug-044 (third occurrence).

**Then, badge 2.0 — press-outside did not close the panel** (bug-045, introduced
with the panel). `useDismiss`'s `inside` predicate was the whole `<li>`, so every
press within the step's own row counted as inside — its name field included — and
the panel hung open over the row below. Now scoped to the panel and its trigger.
The trigger has to stay inside: otherwise `pointerdown` closes it and the following
`click` toggles it back open, so it never appears to close at all.

**One row per step: asked, declined.** A phone step row has ~313pt and the fixed
controls come to 370pt before the name field gets a pixel — role select 136,
seconds 72, unit 88, ⋯ 42, four gaps 32. A single row is only reachable by moving
the ROLE select into the panel (the coloured left border already carries it, and the
coloured add buttons already set it at creation) plus trimming the unit and seconds
boxes, which buys the name back to ~127pt — about 15 characters. The two-line row
keeps it at ~169pt. **User chose two lines**, so the layout is unchanged; recorded
in cerebrum's Decision Log so it is not re-proposed.

**Then, badge 2.1 — the panel opens upward when there is no room below**
(bug-046), for the last rows of the list where a downward panel was clipped by the
scroller. A `useLayoutEffect` measures the row's box against `.editor__scroll`'s
visible box plus the panel's own height and sets `data-up`, which swaps `top` for
`bottom`. `useLayoutEffect` rather than `useEffect` so the flip lands in the frame
the panel first paints instead of showing it in the wrong place and jumping. It
flips only when that helps — with too little room either side, downward can at
least be scrolled to, and a first row will not flip up into the scroller's edge.
The gap is `--step-1` in the CSS and 4px in the measurement; they have to agree.

**Then, badge 2.3 — the panel is anchored to the BUTTON, not the row.**
`.erow__menu` wraps the panel and the ⋯ button and is `position: relative`; on a
narrow screen the button is its only in-flow child, so the wrapper's box is the
button's box and `top: 100%` / `right: 0` land the panel directly under it. Under
the row meant under both of a phone row's lines, and under the note fields too when
those were open. The flip measurement moved to the button's rect for the same
reason. The wrapper carries the trailing-edge auto margin in both modes, so
`.erow__tools` no longer needs one. The cluster may now wrap inside the panel
(never in the row) under a `100vw`-based cap, for a phone too narrow for six in a
line — undone above the breakpoint in case a row was opened narrow and then widened.

**Then, badge 2.4 — the panel had collapsed to a vertical column.** Caused by 2.3:
an absolutely positioned box with `width: auto` is shrink-to-fit sized against its
CONTAINING BLOCK, which the re-anchor made the 42px `.erow__menu`. Shrink-to-fit
then falls back to min-content — and the `flex-wrap: wrap` added to the cluster as
insurance had made min-content one button wide, so eight buttons stacked. Fixed with
`width: max-content` on the panel (which does not care what it is anchored to) and
by dropping the wrap and its wide-mode undo. The panel is 288px against a phone's
~361px of list, so the wrap was never needed.

It is two horizontal rows — `[img][note]` above the six actions — not one row of
eight. One row does not fit: eight 42px buttons plus gaps and padding is ~380px
against ~361px of list. Say so if a single row matters more than the panel staying
inside the list.

**Unverified on a device.** Worth checking: the ⋯ panel on an iPhone — press
outside it, press the row's own name field, and open one on a row near the bottom
of the list and on a two-level-nested row; that iPad landscape still shows the
buttons inline; and one step on `× each side` plus one on `rung each side`, to
confirm the select widths do not clip.

### The shell's height (2026-08-22) — version badge 2.2

Reported on the iPhone **in a Safari tab**: the editor's add-button footer sat
partly below the bottom of the screen, and after showing and dismissing the
keyboard the footer became fully visible while the fixed header went off the top,
with no way to scroll back to it and leave the editor.

One cause for both halves. The shell was `100lvh` — the LARGE viewport, which is
the screen with the browser UI **retracted**. In a tab, with Safari's address bar
and toolbar showing, the shell was therefore taller than the screen by their
height, and:

- the bottom band of every screen sat under the toolbar, cut off; and
- content taller than the viewport is scrollable **overflow**, which
  `overflow: hidden` only CLIPS. So the keyboard's focus-reveal scrolled the
  document and left it scrolled — footer in view, header gone, and `hidden` meant
  the user could not scroll back what the browser had scrolled.

`100svh` instead: the small viewport is the screen with that UI **showing**, so the
shell always fits what can be seen and there is no overflow to be left scrolled in.
Nothing here scrolls, so the browser UI never retracts and leaves a gap either.

- **`svh` keeps everything `lvh` was chosen for.** The keyboard bug that motivated
  `lvh` was a `dvh` problem — `svh` and `lvh` are BOTH stable and neither responds
  to the keyboard.
- **The home-screen install is unaffected**: with no browser UI, svh, lvh and dvh
  are the same number.
- `.modal` keeps `100dvh` on purpose — a dialog is the one thing that should track
  the keyboard.
- The lesson, written into theme.css: `overflow: hidden` clips overflow, it does not
  prevent it, and **the browser can still scroll what the user cannot**. The two
  rules — a height the screen can show, and a document that does not scroll — only
  work together.

Logged as bug-047. Typecheck, build and 513 tests green.

**Unverified on a device.** The whole point of this one is the browser tab, so:
in Safari, check the editor's footer is fully visible, then focus the routine name,
dismiss the keyboard, and confirm the header is still there. Then the same on the
home-screen install, which should be unchanged.

### Documentation and help rewrite (2026-08-22) - version badge 2.5

Reworded the documentation and in-app help to be shorter and plainer, and removed
every em dash from the project.

- **In-app help** (`src/ui/help.ts`) rewritten. Long bullets split into sentences,
  the `New / Paste / Import / Export all` bullets now use a colon instead of a
  dash, and the paste bullet's "It opens with five seconds to get ready." was
  removed on request. (The parser still adds those five seconds; only the help
  line went.)
- **Every user-visible string** carrying an em dash was reworded, not just
  repunctuated: option titles, aria-labels, button titles, the upload error, the
  empty-list line, the clipboard failure notice, the sound descriptions.
- **All ten README files** rewritten for concision, including the root one, whose
  test count was stale (451, now 513).
- **Every code comment** in `src/`, plus `index.html`, `vite.config.ts` and
  `scripts/exercise_plates.py`. Roughly 600 em dashes in total.
- Stale documentation found and fixed on the way: the editor README still
  described the reverted "control band" and the removed lightbox, and its undo
  section still listed the lightbox as excluded screen state.
- **Four em dashes remain, all functional and all deliberate:** `DASH_CHARS` in
  `routines/pasteFormat.ts`, the `[\s:–—-]` class in its `.replace`, and the
  `[\s[-–—]]` pattern quoted in a comment there and in `routines/README.md`. En
  dashes inside the email fixtures and `strength-training.routine.json` are
  verbatim source data and stay too.
- Recorded as a standing preference in cerebrum's User Preferences, so it applies
  to everything written from here on.
- Typecheck, build and 513 tests green.

**One mistake worth remembering.** The first pass at the test titles used
`re.match` and rebuilt each line from the captured groups, which silently dropped
the `, () => {` tail and broke 13 files. `re.sub` on the whole line is the right
tool; never reconstruct a line from a partial match. Caught by typecheck, fixed by
reverting the test files and redoing the pass.

### README screenshots (2026-08-22)

Four screenshots added to the root README in a "What it looks like" section, placed
above "What it does" so the pitch is shown before it is described.

- `docs/screenshots/`, **not** `public/`. Anything under `public/` is copied into
  `dist` and precached by the service worker, so these would have bloated every
  offline install. Verified: the build's precache line still reads 63 entries.
- Converted with `cwebp -q 88 -resize 900 0`, taking 3.2MB of PNG to 188KB of
  WebP. Stored at 900px, which is sharp at the ~420px the README renders them at.
- Laid out as a 2x2 HTML table, since markdown has no side-by-side syntax. Each has
  real alt text and a caption naming what it demonstrates.
- Order is deliberate: the timed countdown first, because it is the README's
  one-sentence pitch as a picture, then the rep-based list, then the library, then
  the editor.
- Source files: `~/Downloads/Home.png`, `Workout.png`, `Workout 2.png`,
  `Editor.png`. Re-run the cwebp commands above to replace any of them.

### The paste format doc (2026-08-22)

`docs/paste-format.md`: what the paste parser reads, with one example routine
using every part of the grammar. Linked from the "Takes a routine as pasted text"
bullet in the root README, and cross-referenced from `src/routines/README.md`.

- **The example IS `PASTE_TEMPLATE`,** the routine the paste dialog's Copy template
  already hands out, and a new test asserts the doc's fenced block matches it
  byte for byte. So the doc cannot drift into describing a grammar the parser no
  longer reads, and there is only one example to maintain.
- The test reads the file with `import.meta.glob('/docs/paste-format.md',
  { query: '?raw' })` rather than `node:fs`, the same reason as
  `imageCatalogue.test.ts`: `src` is typechecked with only `vite/client` types,
  and pulling Node's in would let app code reach for `fs` by accident.
- **Verified the guard actually fails on drift** by editing one line of the doc
  and watching it go red, then restoring. A test that cannot fail is worse than no
  test.
- Two prose details corrected against the regexes while writing: `40 sec each`
  does not have to be alone on its line (`EACH_FOR` is unanchored), and the
  parenthetical threshold is 24 characters or more, not over 24
  (`inner.length < DESCRIPTION_CHARS` is the no-split case).
- 514 tests, typecheck and build green.

### Done since the quest closed (2026-08-21, all pushed)
- **The image-link capability is gone.** `.tabata` imports now run through
  `migrateWorkout`, so their URLs — all of which are in `REHOSTED` — become
  bundled paths on the way in. With no producer left, out went the editor's link
  field, `editor/postimages.ts`, `pinRemote`, the Save images menu item and its
  notice, the `i.postimg.cc` runtime-cache rule and `PinIcon`. `remote` stays in
  `MediaRef` as a legacy READ path: routines saved before the move still show
  their pictures, and `gc.ts` still counts a pinned blob as live.
  The gap it left — an uploaded photo could not travel — is closed below.
- **Photos travel in an export file.** `bundleMedia.ts` fills the `media` map
  that the format declared and nothing ever wrote: uploaded photos only, as data
  URLs keyed by content hash, since a bundled illustration is a path the other
  side already has. Every entry is **re-hashed on import** and compared against
  its key, because the store is content-addressed and a key that lied would
  poison it; a bad entry is skipped and counted rather than throwing. Each routine
  row gained a file button beside its share button, and Export all goes through
  the same function so the two cannot diverge. A share link still cannot carry a
  photo and now says so in its title.
- **Seven kinds, seven colours.** Reps was neutral, a ladder was violet like
  Recover, and a section took `--phase` (the Rest blue). Now `--group-reps` /
  `-ladder` / `-section` (orange, yellow, teal), shown as the row's 4px left rule
  and mirrored on each add button's left edge via `data-kind`.
- **The arrows worked only if you started with the spacebar** (bug-036). Clicking
  a control leaves it focused, and the handler ignored every key while a `<button>`
  had focus. `src/ui/keys.ts` names the keys instead: fields take everything, a
  button takes Space and Enter, the arrows are always the screen's.
- **The note toggle moved out of the action cluster** to the end of the field run,
  so all four row types share one button grammar: add · up · down · [wrap or
  ungroup] · duplicate · delete.
- **Two ways to clear a step's image, each where you would look for it.** The ×
  in the link box now clears the TEXT and only appears when there is text; a
  second × sits beside the thumbnail and removes the image itself, whatever its
  source. It is keyed on the ref rather than the thumbnail, so an image whose
  local copy has gone can still be removed. Not committed yet.
- **The illustrations ship with the app.** 43 images in `public/exercises/` (41
  regenerated from the Torus guide PDF by `scripts/exercise_plates.py` at 881px /
  ~65KB, plus the two cardio photos), precached — the build's precache went from
  20 entries / 372KB to 63 / 3.6MB. `IMAGE_CATALOGUE` holds PATHS now, resolved
  through `BASE_URL` at render time so a routine survives a change of host;
  `KnownImage` gained `ref` / `id` / `src` because the stored ref and the
  thumbnail src are no longer the same string. `storage/migrate.ts` rewrites all
  29 postimages URLs the catalogue ever held onto bundled paths on read, so saved
  routines and old exports keep their pictures. Postimages is no longer a
  dependency (its runtime-cache rule stays for pasted links). Not committed yet.
- **`migrateBlocks` now walks every group**, not just repeats — it used to return a
  section or ladder untouched, so a nested repeat never had its label fixed and the
  image rewrite would have missed every pasted routine.
- **Undo/redo audit of the edit page.** Nothing bypasses the stack (`setHistory`
  is touched only by undo/redo; every mutation goes through `edit`/`editBlocks`),
  but coalescing was swallowing edits: `history.push` now takes the FIELD being
  typed into rather than a boolean, `isTypedPatch` marks only `name` as
  keystroke-typed, and the timing number box coalesces while its unit select does
  not. Two bugs logged — bug-034 (two image picks shared one undo step) and
  bug-035 (blurring the image field deleted an uploaded photo; unchanged blurs
  left empty undo steps). Not committed yet.
- **An × in the image field clears it** — including an uploaded photo, which had
  no visible way to be removed. `onMouseDown` preventDefault keeps focus so the
  blur cannot commit the link a moment before the click clears it. Not committed
  yet.
- **No image controls for a step that runs as a list row** — only the countdown
  has a media panel, so `shownAsList(blocks, path)` (`editor/blocks.ts`) decides
  whether to offer one. It is the enclosing SECTION's display that decides, not
  the group kind: a ladder or reps group on its own runs as the countdown. A step
  that already HAS an image keeps the row (field to clear it, plus a "not shown"
  line) so no picture gets trapped. `listMode()` stays the authority and a test
  asserts runtime-listed ⊆ editor-listed. Not committed yet.
- **Help trays on the library and the editor** — a `?` beside the Routines menu
  and to the right of Save, both opening `HelpTray`: a modal `<dialog>` pinned to
  the right edge with native `<details>` sections of bullets. The copy lives in
  `ui/help.ts` as data. Not committed yet.
- **Copy template in the paste dialog** — hands over `routines/pasteTemplate.ts`,
  a routine using every part of the grammar, then acknowledges with a
  `NoticeDialog` rendered as a SIBLING (a nested one's `close` would cancel the
  paste). `__tests__/pasteTemplate.test.ts` asserts it parses with nothing
  skipped, and asserts the shape. Not committed yet.
- **An elapsed clock on the run screen** — a second `Clock` in `useTimer`
  (`sessionMs`): wall time since Start, less pauses, stopped at the finish, and
  deliberately NOT re-anchored by `moveTo`, so a skip does not move it. Shown as
  a stopwatch in the header's right slot, which was an empty spacer, so it serves
  the list layout too — a rep-based routine had no clock at all. The finished
  screen's Elapsed stat now reports the real time rather than the routine's
  scheduled length, and shows for gated routines as well. Not committed yet.
- **The first whistle of a cold start was the fallback tone** — the plain 2900Hz
  one, not the recording, on every fresh page load (bug-033). A cue is BUILT when
  it is scheduled, so the whole first 30-second window chose synth-or-recording
  before the decode could land, and dedup never revisited it. Now the bytes
  download at module load (only the DECODE needs a gesture) and
  `engine.onSampleDecoded()` makes the scheduler cancel and queue again;
  `requeueable()` shares `CANCEL_GRACE_MS` with `cancelPending()` so a sounding
  cue is spared rather than played twice. Not committed yet.
- **The colour gradients are ~a third stronger** — the four screen washes
  (run 19%, library 19%, sounds 16%, editor 14%) and the three routine-colour
  washes, all fading out at 78-82% instead of 72-78%. Hierarchy unchanged.
  Not committed yet.
- **Two seeds, one of each kind.** The strength one is GENERATED from the 20 July
  email and a test asserts it still matches a fresh parse.
- **Import reads plain-text routines**, and `bundle.ts`'s `isBlock` whitelist was
  silently dropping every pasted routine on re-import (bug-032).
- **The editor edits a step's note and alternative**, on a line below the step,
  shown only when there is one. `clearText` deletes rather than blanks.
- **A pasted routine opens with five seconds to get ready.** The one thing the
  parser adds; it also learned the `prepare` role, which made the skip condition
  reachable.
- **Rep counts line up down the list** — the per-side qualifier has its own
  column, spaced by padding because an empty column still costs a gap.
- **Space is play/pause again.** It was briefly bound to Next; reverted on
  request, and the arrows keep back/next.
- **"Let's go!"** replaces the longer opening line; the `SPOKEN` key renamed to
  match.

---

## ✅ Done — strength routines: untimed steps, sections, ladders

**COMPLETE. All six steps of the build order are done, green (451 tests,
typecheck + build clean) and pushed.** The app takes a pasted strength routine,
runs it a set at a time, and edits it.

**REVIEWED IN THE BROWSER and signed off** — "looking very good now" after a
round of run-screen fixes: one tap per round / rung / burnout block, a timed step
always taking the countdown, long text sized to fit, the list growing to fill the
sheet, cues rearmed per run, and a pause-and-confirm on Back.

⚠️ **23 commits sit on `main`, UNPUSHED.** Standing instruction is not to push
while iterating; the live site is therefore several days behind the repo.

### Landed so far
- **Step 1** — the three routines are saved verbatim as parser fixtures in
  `src/routines/__tests__/emails/`, with a README. Only the CAUTION banner and
  "Sent from my iPhone" were stripped; en-dashes, `×`, `→` and emoji are left as
  they arrived, because the parser has to cope with the real thing.
- **Step 2** — the engine. `durationMs` is optional (absent = self-paced; a
  present non-positive one is still dropped, so a mistyped `0` cannot become a
  gate), plus `Reps`, `Ladder`, `Section`, `Group`, and `isGroup()`.
  `compile()` now returns a `Routine` — the same entry objects as a flat list and
  partitioned into runs. `runtime.ts` and `cues.ts` were **not touched**: a `Run`
  is structurally a `Timeline`, so the tested core still does all the work inside
  a run. New `navigate.ts` holds everything that crosses one: `locate`, `advance`,
  `retreat`, `runIsOver`, `nextRun`, `cursorForStep`, `groupEntries`, `sectionOf`.
  **46 new tests** in `gates.test.ts` and `navigate.test.ts`.
- The type change found every tree walker that assumed `kind === 'repeat'` meant
  "group" — `media/gc.ts` most importantly, where missing a group kind would have
  orphaned live images and deleted them. All now recurse on `!== 'segment'`.
- **Step 3** — `useTimer` holds a `Cursor` and re-anchors the clock on every run
  change; the tick decision is pure in `state/tick.ts`. `RunScreen` follows the
  cursor: progress is by time while a routine is fully timed and by STEP once it
  has gates, "time left" is hidden when gates make it unknowable, and a
  self-paced step shows its rep target where the countdown would be.
  **A run-local trap found on the way:** `useSpokenCues` keyed its
  already-announced ref on `entry.index`, which is now run-local — every run's
  first step is index 0, so each would have suppressed the next one's
  announcement. It keys on `entry.step` now.

Source material: three emails forwarded (20 Jul, 3 Aug, 17 Aug 2026),
in `~/Downloads/*.eml`. **Written by her gym instructor, not by her** — so the
wording is a class handout's shorthand, and neither the sender nor Wayne is the
authority on an ambiguous line. They arrive on one template every week or two,
which is what makes a parser worth building rather than hand-entering three
routines. Copies of the text should be saved into the repo as parser fixtures
before any code is written — Downloads is not a source of truth.

### The problem
The routines are mostly **rep-based, not timed**: the user must tap Next to
advance. But they MIX — a 45s rest sits inside a rounds section, a `30-second
Plank` sits inside a rep list, and the warm-up is fully timed. And the user must
see **a whole section's instructions on screen at once**, not one step at a time.

### The idea that preserves the engine
**A routine is a sequence of timed RUNS separated by manual GATES.** Inside a run
nothing changes: absolute timeline, `position()` binary search, pre-scheduled
cues, drift immunity, a pocketed phone catching up across several auto-advancing
steps. At a gate the clock parks until Next, and the next run is rebased from the
tap. `compile()` emits runs; run state gains a gate index; `clock.ts` is untouched.

### The six shapes in the source material
| Shape | Example | Timing |
|---|---|---|
| Timed list | Warm-up: "40 sec each" ×6, then "30 sec each" ×4 | fully timed — works today |
| Rounds | #2 Arms: 4 rounds of `12 × Hammer Curls`… | reps + a timed 45s rest per round |
| Ladder | #1: `2-4-6-8-10-8-6-4-2` | reps, untimed |
| Ladder + accessories | #3 Legs: Sumo Squats at each rung, fixed accessory list after every set | reps, untimed |
| Burnout | "Complete without stopping: 20 × Sumo Squat Pulses…" | reps, untimed |
| Timed step inside a rep list | `30-second Plank`, `10-second Wall Sit` | timed, mixed in |

### Model changes
```ts
// Duration becomes OPTIONAL. No duration = self-paced, ends on Next.
type Segment = { …; durationMs?: number; reps?: { count: number; perSide?: boolean }
                 alternative?: string }   // "knees or toes", "step-back option"

// A ladder is a repeat whose rep count varies per iteration.
type Ladder = { kind: 'ladder'; counts: number[]; children: Block[] }

// A section is a named top-level group with a display mode.
type Section = { kind: 'section'; name: string; note?: string
                 display: 'timer' | 'list'; children: Block[] }
```
Old routines need **no migration**: no sections = one implicit timer-mode section,
and every existing step already has a duration.

### Decisions taken (do not re-litigate)
- **A ladder is a PER-RUNG CIRCUIT**, not a per-exercise ladder. Rung 2 = 2 reps of
  every exercise, then rung 4 = 4 of every exercise. Confirmed by Wayne, and it is
  the better reading of the emails' own note: "complete the full count of one
  exercise before moving to the next" means finish your SET before starting the
  next exercise — "the full count" is the count for that rung, not the whole
  ladder. It is also the common convention for this kind of ladder.
  One primitive covers #1 and #3: children either take the rung count (the main
  lift) or carry a fixed count (the accessories).
- **Accessories run after the FINAL rung too.** "After every set" includes the last
  one. Deliberately unlike the trailing-rest rule, where a rest between reps is
  dropped at the end.
- **"3–5 Rounds" stores the MAX (5)**, with an "End section" control so Next past
  the intended round finishes early. Nothing is asked before the run.
- **Next is a big full-width button plus the spacebar.** Not tap-anywhere: a stray
  touch skipping a set is worse than reaching for the phone. Existing keyboard
  control maps onto it for free.
- **Import is a PASTE BOX, not an `.eml` importer.** The grammar is consistent
  enough to parse, paste also covers WhatsApp and Notes, and a dropped `.eml`/`.txt`
  is sugar (take `text/plain`, strip the CAUTION banner and "Sent from my iPhone").
  The parse lands in the EDITOR for review — never applied silently, same principle
  as the `.tabata` importer refusing to infer reps.

### Parser rules needed
Section header (`#N Name`, `WARM-UP – ±8 MINUTES`, `FINAL BURNOUT – NO STOPPING`),
counting line (`2-4-6-8-…`, hyphen or en-dash), `N Rounds` / `3–5 Rounds`,
`40 sec each` applying to the list that follows, list items (`* 12 × Hammer Curls`,
`1. March → Jog`, `* 30-second Plank`, `(5 each leg)`), `Main Exercise:`,
`After every set:`, `After Round N:`.

### Run screen, two modes
- **Timer mode** — today's screen, unchanged, for the warm-up and all-timed sections.
- **List mode** — the section's steps on screen at once, current row highlighted,
  done rows ticked and dimmed, header showing "Round 2 of 4" / "Set 5 of 9 · 15
  reps", full-width NEXT pinned at the bottom. A row WITH a duration runs an inline
  countdown when it becomes current and auto-advances itself. Five or six rows is
  the realistic maximum, which is what keeps it legible at gym distance.

### Known consequences
- **Cue scheduling narrows** from whole-routine to per-run: a countdown cannot be
  pre-armed across a gate. `audio/README.md` says "scheduled ahead on the audio
  clock" — that claim needs narrowing when this lands.
- **Total duration becomes an estimate** for any routine with gates. The library row
  should show steps/sections, and only show a time when everything is timed.
- **The wake lock now matters much more** — the user must reach the phone — and it
  has still never been verified on Wayne's iPhone.
- The 27-image catalogue is machine-based and covers almost none of these
  exercises. Steps import image-less; list mode must look right with no pictures.

### Build order
1. ✅ Save the three routines as text fixtures in the repo.
2. ✅ `engine`: optional `durationMs`, `reps`, `Ladder`, `Section`; `compile()` →
   runs and gates. Pure, tested, no UI.
3. ✅ `state`: gate handling in `useTimer`. Run state is a `Cursor`; every jump
   goes through one `moveTo` that re-anchors the clock; `next`/`previous` call
   `advance`/`retreat`. The decision itself is pure in the new `state/tick.ts`
   (stay / move / complete + when the display next changes), tested without a
   DOM — including that ten minutes asleep JUMPS to the gate in one move rather
   than walking a step per tick.
4. ✅ `ui`: list mode. The section decides the mode, not the step; the list is the
   innermost group; NEXT is a slab across the bottom. Steps 4 and 5 were SWAPPED
   — the parser went first, because list mode had nothing to render until a
   rep-based routine could get into the app.
5. ✅ The paste parser (`routines/pasteFormat.ts`) plus a paste dialog in the
   Routines menu. Understands every line of all three emails; a line it cannot
   place is listed with its number before anything is saved.
6. ✅ `editor`: sections, ladders, rep fields, self-paced steps. The tree
   operations recurse on `isGroup`; `setTiming` makes timed-or-counted one
   exclusive choice; a ladder's rungs are edited as the text they are written as;
   a section carries its instruction as a field. The step row's UNIT is the mode.

### Found while building step 2
- **"Rest 45 seconds after each round" meets the trailing-rest rule.** A rest as
  the last child of a reps group is dropped on the final iteration, so four rounds
  give three rests. If the instructor means four, the parser must emit the rest
  AFTER the group. Currently it drops — asserted in `gates.test.ts`, so whichever
  way it is decided, the test says which was chosen.
- A `reps: {kind:'rung'}` step outside a ladder resolves to NO count rather than
  zero. Half-authored beats "0 ×".

### Landed in steps 4–5
- `ui/PasteDialog.tsx` + `PasteIcon`, wired into the Routines menu. Parses as you
  type; adds to the LIBRARY, not the editor, since the editor cannot show a
  section or ladder yet.
- `ui/RunScreen.tsx` gained `SectionList`, and `format.ts` gained `effortLabel`
  and `groupCaption`. Styles in `run-screen.css` (`.run__sheet`, `.sheet__*`,
  `.btn--next`) and `library.css` (`.paste*`).
- Parser decisions are documented in `routines/README.md`. The regex trap worth
  remembering: `DASH` is a complete character class and `DASH_CHARS` is the bare
  characters — nesting the first inside another class yields `[\s[-–—]]`, which
  is what stopped "30-second Plank" parsing as a duration.

### Resolved from the run-screen review
- **Rounds collapse too.** Asked for after ladders: `advance` is now shared by
  `Repeat` and `Ladder`, defaulting to `'set'` on both. Every group ITERATION is
  one tap, and a section's loose steps collapse too ("complete without stopping").
  `advance` lives on `Repeat`, `Ladder` and `Section`, defaulting to `'set'`.
  Taps across the three real routines: 37 / 35 / 38, down from ~155 each.

### Landed after the review
- Space follows the big button: on a self-paced step it is Next, while `k` and
  the on-screen button keep pause.
- Import accepts plain-text routines, and `bundle.ts`'s `isBlock` whitelist was
  silently dropping every pasted routine on re-import (bug-032) — an export that
  wrote perfectly and restored nothing.
- A pile of run-screen layout fixes, all the same class and all in the buglog:
  auto grid tracks and flex children stretch by default (bug-028/029/030), and
  two things sharing a column must be sized against each other (bug-031).

### Still open
- Trampoline warm-up (3 Aug) has a "Sprint Finish – Fast feet for 15 seconds"
  hanging off the timed list. Trivial, just noting it is a step not a section.
- Whether a section can be re-entered / repeated. Nothing in the source needs it.

### Open decisions
- Whether to keep the editor capped at two levels of nesting. `wrapInRepeat`
  currently refuses to nest a repeat in a repeat; the DATA MODEL supports any
  depth, so lifting the cap is a UI question, not a schema one.

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
- **RESOLVED — hosting: GitHub Pages, repo goes PUBLIC once complete.** Pages is free for public repos, so the earlier Pro caveat falls away; `VITE_BASE=/exercise-timer/` is already wired. ✅ **PRE-PUBLIC CHECKLIST DONE:** `src/audio/cues/*.mp3` (Tabata Timer's commercial assets) were removed and purged from history; the only shipped recording is the CC0 whistle. The postimages URLs are public, which was accepted.
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

- **Stack:** React 19 + TypeScript + Vite, vitest. IndexedDB for persistence. Installable PWA with a service worker. No backend.
- **Key modules** (each folder has a README covering its decisions):
  - `src/engine/` — pure interval-timer core: `compile` / `position` / `cues`, plus the authoring and runtime types. DOM-free, unit-tested.
  - `src/audio/` — `engine.ts` (context lifecycle, sample decode, scheduling, per-cue cancellation), `tones.ts` (measured specs + the three figures + `audioTimeFor`), `schedule.ts` (window arithmetic), `useCueScheduler.ts`, `samples.ts` + `referee-whistle-cc0.wav`, `useMuted.ts`, `speech.ts`/`useSpokenCues.ts`.
  - `src/media/` — content-addressed blobs: `hash`, `gc`, `resolve`/`resolveMedia`, `store`, `downscale`, `pin`.
  - `src/state/` — `clock.ts` (pure run clock), `useTimer` (self-scheduling timeout), `useWakeLock`, `updateApp`, `usePullToRefresh`.
  - `src/editor/` — pure block-tree operations, undo with coalescing, dirty detection, the image sources.
  - `src/storage/` — `db`, `workouts`, `library` (pure rules), `migrate` (forward-only, on read), `useLibrary`, `seeded`, `bundle`, `shareLink`, `download`.
  - `src/routines/` — `tabataFormat.ts` (.tabata importer), `importFiles.ts`, the one seeded routine, the 27-image catalogue.
  - `src/ui/` — `App`, `LibraryScreen`, `RunScreen`, `EditorScreen`, dev-only `SoundsScreen`, `Menu`, `NoticeDialog`, `useMediaUrl`, `theme.css` + one stylesheet per screen, `format.ts`, `icons.tsx`.
- **Patterns:** engine stays pure and DOM-free; all time derived from timestamps, never accumulated; audio scheduled ahead on the audio clock, not fired from JS ticks; images content-addressed and always downscaled before storage; stored-data fixes applied on read rather than migrated in place.

### Build order
| Phase | Deliverable |
|---|---|
| 1 | ✅ `engine/` + tests |
| 2 | ✅ RunScreen + pure run clock + effort strip |
| 3 | ✅ audio cues (pre-scheduled Web Audio, mute) |
| 4 | ✅ Media pipeline — resolver over all 3 sources, IndexedDB blob store, downscale, content-hash, objectURL cache, pin-for-offline, next-image preload, GC on delete |
| 5 | ✅ LibraryScreen + `.tabata` import + IndexedDB storage |
| 6 | ✅ Editor — block tree editing, image picker, undo, routine colours |
| 7 | ✅ PWA install, wake lock, offline, export/import, share links, design pass, GitHub Pages |

All seven phases are shipped. Work is now user-requested rather than plan-driven.

---|---|
| 1 | ✅ `engine/` + tests |
| 2 | ✅ RunScreen + pure run clock + effort strip |
| 3 | ✅ audio cues (pre-scheduled Web Audio, mute) |
| 4 | ◀ **NEXT** — Media pipeline — `resolveMedia` over all 3 sources, postimages URL normaliser, IndexedDB blob store, downscale, content-hash, objectURL cache, pin-for-offline, next-image preload |
| 5 | ✅ LibraryScreen + `.tabata` import + IndexedDB storage |
| 6 | WorkoutEditor — block tree editing + image picker (photo/camera/drag/paste) |
| 7 | PWA install, wake lock, offline, export/import (routine + library backup), share links, design pass |

---

## ⚠️ External blockers (don't block coding)

- _(none)_ — hosting resolved: GitHub Pages, public repo, deployed by workflow on push to `main` with `VITE_BASE=/exercise-timer/`.

---

## 🔧 Useful commands

```bash
npm run dev          # Vite dev server -> http://localhost:35173 (strictPort)
npm test             # vitest, single run
npm run test:watch   # vitest, watch mode
npm run typecheck    # tsc -b --noEmit
npm run build        # tsc -b && vite build
VITE_BASE=/exercise-timer/ npm run build   # subpath build (GitHub Pages)
npm run preview      # built app -> http://localhost:35174 (strictPort)
```

---

## 📚 References (read IF needed)

- `.wolf/cerebrum.md` — User Preferences + Do-Not-Repeat + Decision Log
- `.wolf/anatomy.md` — token-efficient file index
- `.wolf/buglog.json` — known bugs + fixes

---

## ✅ MIT licence + per-file headers (2026-08-23)

The repo was PUBLIC with no licence, which grants nobody any rights. Now `LICENSE`
holds MIT, `Copyright (c) 2026 Wayne Davies`. **Confirm the name is how Wayne wants
it in a legal notice**; it was derived from the git email, not asked. One sed over
`LICENSE`, 119 source files and `index.html` fixes it if not.

- A four-line header on **every** source file: 112 `.ts`/`.tsx`, 5 `.css`,
  `vite.config.ts`, `scripts/exercise_plates.py` (after the shebang), and
  `index.html` (after the doctype, so no quirks mode). Idempotent script in the
  session scratchpad; re-runnable and skips files that already carry it.
- `package.json` gains `"license": "MIT"`. `private: true` stays: it blocks an
  accidental npm publish and says nothing about the licence.
- **The licence is scoped, and this matters.** `public/exercises/` is 43 crops of
  the Horizon Torus 5 Exercise Guide (see `scripts/exercise_plates.py`), so a
  repo-wide MIT would have been Wayne granting rights he does not hold. `LICENSE`
  and the README both say the illustrations are excluded and a reuser brings their
  own. The whistle is genuinely CC0 and needs no attribution.
- README: a note under the live link saying there is nothing to clone, install or
  build to USE the app, "Running it" renamed "Running it locally", and a Licence
  section. Stale test count 617 corrected to 637 while in there.
- **The notice now reaches the deployed bundle too.** `licenceNotice()` in
  `vite.config.ts` prepends a `/*!` block to every built chunk and stylesheet. It
  had to go in `generateBundle`, NOT in `output.banner` or `renderChunk`: both run
  before Vite minifies, and Vite drives esbuild with `legalComments: 'none'`, which
  deleted the banner silently on the first attempt (the build passed and the JS came
  out bare). The filename content hash is computed before the hook, so it does not
  cover the notice; harmless, as the notice is constant. `dist/sw.js` and the
  workbox runtime are generated later and stay uncovered, correctly.
- 637 tests green, typecheck and build clean after the sweep.

---

## ✅ Paste from clipboard in the Add-an-image dialog (2026-08-23, v2.8)

The chooser's footer now has **Paste from clipboard** beside Upload a photo. A pasted
Blob goes straight into `storeFile`, so it takes the same downscale → hash → store
path as a picked file; `upload()` widened from `File` to `Blob` (a clipboard image has
no filename and nothing downstream wanted one).

- New `src/media/clipboard.ts` — `canReadClipboard`, `probeClipboardImage`,
  `imageFromClipboard`, and a four-valued `ClipboardImage` state.
- **The button is disabled only on `none` and `unsupported`.** The probe reads the
  clipboard ONLY where `clipboard-read` is already granted (Chromium), because Safari
  and Firefox will not answer outside user activation and asking anyway would show
  Safari's native paste confirmation unbidden. Elsewhere the state is `unknown`, the
  button stays enabled, and the tap is the gesture that gets the answer — **the user
  chose this over a button permanently grey on iOS.** A tap finding only text says so
  and disables itself; a refused read reports differently and does not, since refusal
  is not evidence about the contents.
- Re-probed on window `focus` and `visibilitychange`, so copying an image in another
  app and coming back lights the button up. Racing probes are token-guarded.
- 16 new tests (9 on the module, 7 on the dialog's states). **637 green**, typecheck
  and build clean. Docs: `editor/README.md`, `media/README.md`, editor help, cerebrum.

**Untested on a device, and cannot be from the LAN dev server:** `navigator.clipboard`
is secure-context only, exactly like `crypto.subtle`, so on plain HTTP the button
reads `unsupported` and greys out. Needs the deployed HTTPS build on the iPhone: copy
a screenshot, open a step's image button, and check Safari's paste confirmation
appears and the picture lands.

---

## ✅ Reset confirmation (2026-08-22, v2.7, commit ce3a790)

The run screen's Reset now pauses and asks ("Start this workout over?") exactly like Back does, resumes on cancel, and resets a complete workout without asking. First RunScreen component tests (5) cover the flow. 622 tests green. Pushed and deployed.

---

## ✅ Review findings ALL FIXED (2026-08-22, same session)

Every finding from the review below (8 high, 13 medium, 15 low) is fixed, plus the systemic test gap: the hook/effect layer now has jsdom tests (useTimer wiring, useCueScheduler lifecycle, useSpokenCues, useWakeLock, usePullToRefresh, updateApp, EditorScreen dirty/undo/number-field integration). Suite grew 514 -> 617 tests; typecheck and production build green. New devDeps: jsdom, @testing-library/react, @testing-library/dom. Consolidated buglog entries: bug-058..bug-066. Review report artifact: https://claude.ai/code/artifact/d37f558a-5338-44a1-8900-8a5fbd433775

Next quest: nothing queued. Candidates: on-device pass of the iOS audio/suspension fixes (bug-057 area), then consider surfacing rejected/skipped import detail in a richer dialog than the notice line.

---

## 🔍 Full quality/reliability review (2026-08-22)

Five-subsystem audit; top claims re-verified by trace or execution. Full report: https://claude.ai/code/artifact/d37f558a-5338-44a1-8900-8a5fbd433775

**High (fix first, all verified):**
1. `useTimer.ts:135-141` tick chain dies on any automatic run crossing (gated routines freeze; masked by visibility/pause restarts). Reproduced in a harness.
2. `updateApp.ts:21-26` pull-to-refresh deletes the Workbox precache with nothing to repopulate it: offline shell gone until a new SW version ships.
3. `compile.ts:158-168` `gateKey` uses only the innermost path level, so gates from different outer rounds merge; one tap skips whole rounds.
4. `dirty.ts:23-31` segment compare misses `reps`/`perSide`/`alternative`: Back silently discards those edits. Also no section/ladder branch (`:40`), so those routines are permanently "dirty".
5. `blocks.ts moveStep` ejects a step out of a section/ladder instead of reordering (siblings resolved only for repeat parents).
6. `pasteFormat.ts:487` unanchored `EACH_FOR` runs before the bullet handler: `* Side Plank – 30 seconds each side` is silently dropped and poisons later durations.
7. `useCueScheduler.ts:99-105` visibility return never cancels stale pending cues (late beep burst on iOS); `:62` + `engine.ts:109-114` nothing re-arms when the context actually resumes (up to 10s of cues dropped; `interrupted` state never handled).

**Systemic gap:** the hook/effect layer (useTimer wiring, useCueScheduler lifecycle, the big screens) has zero test coverage; every high finding except the parser lives there. Mediums and lows are in the report.
