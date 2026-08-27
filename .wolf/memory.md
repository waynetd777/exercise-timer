# Memory

> Chronological action log. Hooks and AI append to this file automatically.
> Old sessions are consolidated by the daemon weekly.

## Session: 2026-08-20 22:42

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 23:12 | Phase 1: scaffolded Vite+React+TS+vitest and built the DOM-free interval-timer engine (compile/position/cues + 41 tests); git init + initial push to private repo | src/engine/*, package.json, tsconfig*.json, vite.config.ts | 41/41 tests pass, typecheck + build clean, pushed as 50e8ea7 | ~50k |
| 23:45 | Phase 2: RunScreen + pure run clock (clock.ts) + effort strip signature element; plain CSS token system; 3 bugs caught in self-review | src/state/*, src/ui/*, src/routines/samples.ts | 52/52 tests pass, typecheck + build clean, dev server up on :5173, NOT visually verified | ~75k |
| 00:10 | Fixed user-reported tiny countdown/panel (rem caps -> two-axis cq sizing); phase 3 audio (pre-scheduled Web Audio cues, mute); wrote .tabata importer + mounted Wayne's real 86-step routine | src/ui/run-screen.css, src/audio/*, src/routines/tabataFormat.ts | 80/80 tests pass, typecheck + build clean | ~65k |
| 00:35 | Swapped synthesised cues for the real Tabata Timer sounds (found app bundle on disk, 110 files); sample playback via AudioBufferSourceNode with tone fallback; moved assets into the module graph | src/audio/samples.ts, engine.ts, useCueScheduler.ts, src/audio/cues/*.mp3 | 84/84 tests pass, build emits hashed mp3s | ~40k |
| 00:58 | Enlarged all small text (fluid --label-size, names, stats, buttons, chevrons); fixed latent control-row overflow it would have triggered | src/ui/theme.css, src/ui/run-screen.css | 84/84 tests pass, build clean | ~20k |
| 01:15 | Raised label scale again (controls held via second token); empty media panel now shows the step name, sized by fitCqi off the longest word | src/ui/theme.css, run-screen.css, format.ts, RunScreen.tsx | 89/89 tests pass, build clean | ~25k |
| 01:30 | Raised label scale a third time and made it height-aware so the taller stack cannot overflow short windows; verified fit at 5 viewport sizes | src/ui/theme.css, run-screen.css | 89/89 tests pass, build clean | ~15k |
| 01:40 | Reverted bottom controls to original scale (own tokens), keeping the wrap/min-width overflow guards; body text unchanged | src/ui/theme.css, run-screen.css | 89/89 tests pass, build clean | ~12k |
| 01:55 | Traffic-light phase colours (green/red/blue) chosen for contrast + lightness separation; .unit class so duration suffixes stay lowercase under uppercase labels | src/ui/theme.css, run-screen.css, RunScreen.tsx | 89/89 tests pass, build clean | ~15k |
| 02:10 | Shrank routine name (idle title + running eyebrow, which falls back to it on flat routines); swapped warm/brown ground for a neutral grey ramp, re-verified all contrast ratios | src/ui/theme.css, run-screen.css, RunScreen.tsx | 89/89 tests pass, build clean | ~18k |
| 02:25 | Fixed brown effort-strip bars: dropped opacity-over-black for explicit state colours (neutral upcoming, hue mixed toward light grey when done) | src/ui/run-screen.css | 89/89 tests pass, build clean | ~12k |
| 02:35 | 'Step n of n' -> 'Step n / n'; meta row column gap switched to em so it scales with the fluid label size | src/ui/RunScreen.tsx, run-screen.css | 89/89 tests pass, build clean | ~8k |
| 02:50 | Removed Paused chip; pinned meta row to bottom via count__lead wrapper; countdown +25%/+67% with layout-dependent width coefficient | src/ui/RunScreen.tsx, run-screen.css | 89/89 tests pass, build clean, fit verified at 5 viewports | ~20k |
| 03:10 | Removed effort strip, added header with routine name, de-duplicated the name, spent reclaimed space on a 14% bigger countdown + larger name/title | src/ui/RunScreen.tsx, run-screen.css, deleted EffortStrip.tsx | 89/89 tests pass, build clean, fit verified at 5 viewports | ~22k |
| 03:25 | Centred routine name; replaced control text with inline SVG icons and made buttons square (row 508->372px, fits a phone on one line) | src/ui/icons.tsx, RunScreen.tsx, run-screen.css, theme.css | 89/89 tests pass, build clean | ~18k |
| 03:55 | Phase 5: routine library (IndexedDB + pure library logic + 23 tests), multi-file .tabata drag-drop import, App shell with library<->run routing, RunScreen back button; centred column contents | src/storage/*, src/ui/LibraryScreen.tsx, App.tsx, library.css, icons.tsx, importFiles.ts | 112/112 tests pass, typecheck + build clean | ~90k |
| 04:05 | Named the app DavShack Gym Timer (heading + document title); replaced per-card play button with a stretched-button whole-card click target | src/ui/LibraryScreen.tsx, library.css, index.html | 112/112 tests pass, build clean | ~10k |
| 04:35 | Fixed 3 reported countdown/layout bugs: off-centre digits (letter-spacing), +100% size jump on digit change (clockWidth floor), panel pushed off-screen (aspect-ratio -> absorb remainder) | src/ui/format.ts, run-screen.css, format.test.ts | 113/113 tests pass, build clean | ~25k |
| 05:00 | Root-caused card text inversion to `font:` shorthand in a shared .label clobbering library.css by import order; built one role-keyed type scale in theme.css and pointed both screens at it | src/ui/theme.css, library.css, run-screen.css | 113/113 tests pass, build clean | ~30k |
| 05:10 | Renamed app to DavShack Timer (heading + document title) and centred the home heading | src/ui/LibraryScreen.tsx, library.css, index.html | 113/113 tests pass, build clean | ~5k |
| 05:15 | Lifted the panel's "Next ..." line 3px off the divider below it | src/ui/run-screen.css | build clean | ~4k |
| 05:30 | Root-caused the flush next-up line to zero bottom padding on the stacked .run__body (not the nudge); added 16px padding, removed the 3px margin, verified in built CSS | src/ui/run-screen.css | 113/113 tests pass, build clean | ~10k |
| 05:45 | Bounded the empty-panel step name by frame HEIGHT as well as width (size container + --lines word count) and made its padding proportional; verified fit down to a 70px frame | src/ui/run-screen.css, format.ts, RunScreen.tsx | 116/116 tests pass, build clean | ~15k |
| 05:35 | Shipped it live: synthesised cues from measured audio, fixed bell-as-click (strike+ring envelope + stop truncating sounding notes), PWA + Pages deploy, purged audio from git history, repo public, imported 2 more routines, blue stopwatch mark | src/audio/*, vite.config.ts, .github/workflows/deploy.yml, public/*, src/routines/* | 122/122 tests pass, LIVE at waynetd777.github.io/exercise-timer/ | ~140k |
| 05:40 | Froze the home-screen header (scroll region wrapper) and made the wordmark share the mark's blue | src/ui/LibraryScreen.tsx, library.css | 122/122 tests pass, build clean | ~12k |
| 05:55 | Removed the synthetic Classic Tabata seed; only the 3 real imported routines seed now | src/routines/samples.ts, tabataFormat.test.ts | 122/122 tests pass, build clean | ~8k |
| 06:20 | Phase 6: workout editor (pure block-tree ops + postimages normaliser + EditorScreen, 36 new tests); blue wash on home/editor; run-screen progress bar | src/editor/*, src/ui/EditorScreen.tsx, editor.css, App.tsx, LibraryScreen.tsx | 158/158 tests pass, build clean | ~120k |
| 06:40 | Fixed countdown resizing at 1:00->59 (size from step's longest string, not live value) and the image squashing (fixed 56/44 stacked split) | src/ui/RunScreen.tsx, run-screen.css | 158/158 tests pass, fit verified at 6 viewports | ~15k |
| 07:00 | Measured the images as near-square (876x800) and added two short-screen tiers so the panel gets more of the space; image 19-47% larger on small windows | src/ui/run-screen.css | 158/158 tests pass, fit verified at 7 viewports | ~20k |
| 07:20 | Fixed the truncated exercise image: img height:100% was resolving to auto so the box outgrew the frame and got clipped; absolute inset:0 makes the box definite | src/ui/run-screen.css | 158/158 tests pass, verified in built CSS | ~12k |
| 07:35 | New-routine template (prepare + round x3 of work/rest + prepare), defaults matched to real routines, labelled the editor Save button | src/editor/blocks.ts, src/ui/App.tsx, EditorScreen.tsx, editor.css | 161/161 tests pass, build clean | ~14k |
| 07:50 | Fixed new-round defaults (was work-only), invisible Save button (--phase root default), merged pencil/edit-steps, added dirty guard with in-place discard prompt; moved shared btn/chip CSS to theme | src/editor/*, src/ui/* | 170/170 tests pass, build clean | ~55k |
| 08:05 | Added editor undo/redo (pure History with text-edit coalescing, 9 tests, keyboard shortcuts) and a recover step at the end of the new-routine template | src/editor/history.ts, blocks.ts, src/ui/EditorScreen.tsx, editor.css, icons.tsx | 179/179 tests pass, build clean | ~45k |
| 08:20 | Strengthened the delete-confirm state to be unmistakably red (row border/tint, name, label, tick); confirmed the live CSS already had red, so likely a stale SW cache | src/ui/library.css, LibraryScreen.tsx, main.tsx | 179/179 tests pass, build clean | ~18k |
| 08:30 | Hid the number-input spinner arrows on the editor's duration and round-count fields, keeping type=number for arrow keys and the mobile numeric keypad | src/ui/editor.css | 179/179 tests pass, verified in built CSS |  ~6k |
| 08:40 | Added duplicate to editor rows (steps and rounds) via duplicateAt with deep fresh-id copying; 7 new tests | src/editor/blocks.ts, src/ui/EditorScreen.tsx | 186/186 tests pass, build clean | ~15k |
| 08:45 | Editor image thumbnails 44px -> 66px | src/ui/editor.css | build clean, verified in dist | ~4k |
| 09:00 | Reverted thumbs to 44px as clickable buttons opening a full-size lightbox; added a searchable picker of all images used across the library (collectImages, 8 tests) | src/editor/images.ts, src/ui/EditorScreen.tsx, editor.css, icons.tsx, App.tsx | 194/194 tests pass, build clean | ~50k |
| 09:20 | moveStep lets rows cross round boundaries (11 tests); imported the 29-image catalogue from the Fitness. Workouts vault note with derived labels (10 tests) | src/editor/blocks.ts, images.ts, src/routines/imageCatalogue.ts, src/ui/EditorScreen.tsx, App.tsx | 214/214 tests pass, all 29 urls verified | ~60k |
| 09:50 | Export/import/share links (29 tests); polish: keyboard control, spoken 10-seconds cue; pull-to-update that drops only the precache and never IndexedDB | src/storage/bundle.ts, shareLink.ts, download.ts, src/audio/speech.ts, useSpokenCues.ts, src/state/updateApp.ts, usePullToRefresh.ts | 243/243 tests pass, build clean | ~95k |
| 10:20 | Phase 4 media pipeline (own photos, offline pinning, GC, real resolver; 18 tests); removed .codex/; wrote root + 8 folder READMEs | src/media/*, src/ui/*, README.md, src/*/README.md | 261/261 tests pass, build clean | ~110k |
| 10:30 | Reordered library header chips to New/Import/Export/Save images; file picker now accepts .json bundles | src/ui/LibraryScreen.tsx | 261/261 tests pass, build clean | ~8k |
| 10:50 | Collapsed the library toolbar into a menu + select (8 controls -> 3); fixed the truncated completion figure (cancel per cue, not per note) and audited all cues with a rolling-window replay test | src/ui/Menu.tsx, LibraryScreen.tsx, theme.css, src/audio/engine.ts, useCueScheduler.ts, schedule.ts | 273/273 tests pass, build clean | ~60k |
| 11:00 | Outcome notices moved into a dismissible NoticeDialog modal (progress while busy, Close when done) | src/ui/NoticeDialog.tsx, LibraryScreen.tsx, library.css | 273/273 tests pass, build clean | ~12k |
| 11:10 | Sort control renamed: select -> a Sort menu matching Routines, with a tick on the active mode; removed the dead select styles | src/ui/Menu.tsx, LibraryScreen.tsx, theme.css, library.css | 273/273 tests pass, build clean | ~10k |
| 11:20 | Dropped trailing periods from all UI messages; rewrote two-sentence ones as single em-dashed phrases | src/ui/LibraryScreen.tsx, EditorScreen.tsx | 273/273 tests pass, build clean | ~8k |
| 11:35 | Fixed placeholder-text truncation on portrait iPad: proportional padding both axes, explicit budget/advance with real slack, break-as-last-resort, tests against a pessimistic advance | src/ui/format.ts, run-screen.css, format.test.ts | 285/285 tests pass, build clean | ~25k |
| 11:55 | Split boundary cues into work-start (whistle) / work-end (bell) + three-ding finish; added warble/tremolo/noise to the audio engine; built the Sounds bench with parameters shown | src/engine/{types,cues}.ts, src/audio/{tones,engine}.ts, src/ui/SoundsScreen.tsx, sounds.css, App.tsx, LibraryScreen.tsx | 289/289 tests pass, dev server up | ~70k |
| 11:26 | reps rename + rest-between-reps + colours + CC0 whistle + scrollbars + dupes + voice + add-below | src/{engine,audio,ui,storage,editor,routines}, scripts/ | 303 tests green, nothing committed | ~150k |

## Session: 2026-08-21 11:53

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-21 17:52

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 19:06 | Created src/ui/HelpTray.tsx | — | ~713 |
| 19:07 | Created src/ui/help.ts | — | ~1154 |
| 19:11 | Created src/routines/pasteTemplate.ts | — | ~569 |
| 19:11 | Created src/routines/__tests__/pasteTemplate.test.ts | — | ~1177 |
| 19:19 | Whistle fallback fix (eager fetch + re-arm on decode), stronger gradients, session elapsed clock, help trays + paste template, image controls hidden for listed steps | src/audio/*, src/state/useTimer.ts, src/ui/* | all green: 473 tests, typecheck, build | ~180k |
| 20:28 | Created scripts/exercise_plates.py | — | ~1651 |
| 20:29 | Created src/routines/imageCatalogue.ts | — | ~1025 |
| 20:30 | Created src/editor/images.ts | — | ~1416 |
| 20:33 | Created src/storage/__tests__/migrate.test.ts | — | ~1336 |
| 20:35 | Rehosted all 43 exercise illustrations into the app (extracted from the Torus PDF, 881px, precached), catalogue holds paths, migrate-on-read rewrites the old postimages URLs | scripts/exercise_plates.py, public/exercises/*, src/routines/imageCatalogue.ts, src/editor/images.ts, src/storage/migrate.ts, vite.config.ts | 495 tests green, precache 372KB -> 3.6MB | ~120k |
| 20:55 | Created src/ui/keys.ts | — | ~422 |
| 21:25 | Created src/media/dataUrl.ts | — | ~630 |
| 21:26 | Created src/storage/bundleMedia.ts | — | ~890 |
| 21:27 | Created src/storage/__tests__/bundleMedia.test.ts | — | ~1635 |
| 23:32 | Created src/version.ts | — | ~161 |
| 00:17 | iOS pass on the device: safe areas, dialog structure (sheet+panel), lvh shell, no document scroll, newId for insecure contexts, version badge, touch scrollbars, iOS zoom | src/ui/*, src/id.ts, src/version.ts, index.html | 13 commits, 511 tests green | ~200k |
| 00:35 | Primed speech from the gesture so the first "Let's go!" plays; confirmed on the device from a cold start | src/audio/speech.ts, src/ui/RunScreen.tsx | bug-042 fixed, v1.4 deployed | ~15k |
| 01:43 | Session end: 13 writes across 13 files (HelpTray.tsx, help.ts, pasteTemplate.ts, pasteTemplate.test.ts, exercise_plates.py) | 6 reads | ~12779 tok |

## Session: 2026-08-21 01:43

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 17:32 | Created src/ui/useDismiss.ts | — | ~448 |
| 18:53 | Session end: 1 writes across 1 files (useDismiss.ts) | 5 reads | ~448 tok |

## Session: 2026-08-22 18:53

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 19:17 | Edited vite.config.ts | 4→6 lines | ~53 |
| 19:25 | Edited src/audio/engine.ts | 3→4 lines | ~56 |
| 19:25 | Edited src/audio/engine.ts | modified if() | ~136 |
| 19:25 | Edited src/audio/engine.ts | added 1 condition(s) | ~288 |
| 19:25 | Edited src/audio/engine.ts | 6→11 lines | ~107 |
| 19:25 | Edited src/audio/useCueScheduler.ts | 8→8 lines | ~111 |
| 19:26 | Edited src/audio/useCueScheduler.ts | modified if() | ~820 |
| 19:26 | Edited src/audio/useCueScheduler.ts | added 1 condition(s) | ~96 |
| 19:26 | Edited src/audio/useSpokenCues.ts | expanded (+11 lines) | ~160 |
| 19:26 | Edited src/audio/useSpokenCues.ts | modified if() | ~82 |
| 19:26 | Edited src/audio/useSpokenCues.ts | added 2 condition(s) | ~180 |
| 19:26 | Edited src/audio/useSpokenCues.ts | 2→2 lines | ~38 |
| 19:26 | Created src/audio/__tests__/useCueScheduler.test.ts | — | ~1563 |
| 19:27 | Created src/audio/__tests__/useSpokenCues.test.ts | — | ~1256 |
| 19:28 | Edited src/audio/__tests__/useCueScheduler.test.ts | modified renderScheduler() | ~155 |
| 19:30 | Full quality review (36 findings, artifact report) then wave-1 fixes: editor dirty/moveStep done, engine/audio/state/parsers/storage in flight | src/editor/*, src/audio/*, vite.config.ts, .wolf/STATUS.md | review published, fixes landing | ~120k |
| 19:29 | Created src/state/__tests__/useTimer.test.tsx | — | ~1790 |
| 19:30 | Edited src/state/clock.ts | expanded (+8 lines) | ~242 |
| 19:30 | Edited src/state/clock.ts | added 1 condition(s) | ~356 |
| 19:30 | Edited src/state/useTimer.ts | 2→2 lines | ~42 |
| 19:30 | Edited src/state/useTimer.ts | expanded (+6 lines) | ~88 |
| 19:30 | Edited src/state/useTimer.ts | expanded (+8 lines) | ~212 |
| 19:30 | Edited src/state/useTimer.ts | added 2 condition(s) | ~720 |
| 19:31 | Edited src/state/__tests__/clock.test.ts | 2→2 lines | ~43 |
| 19:31 | Edited src/state/__tests__/clock.test.ts | expanded (+35 lines) | ~448 |
| 19:31 | Created src/state/updateApp.ts | — | ~680 |
| 19:32 | Created src/state/__tests__/updateApp.test.ts | — | ~1121 |
| 21:31 | Created src/state/__tests__/useWakeLock.test.tsx | — | ~887 |
| 21:31 | Created src/state/__tests__/usePullToRefresh.test.tsx | — | ~864 |
| 21:32 | Created src/storage/__tests__/db.test.ts | — | ~1629 |
| 21:33 | Created src/media/__tests__/resolveMedia.test.ts | — | ~657 |
| 21:33 | Created src/media/__tests__/pin.test.ts | — | ~334 |
| 21:41 | Created src/ui/__tests__/EditorScreen.test.tsx | — | ~1052 |
| 21:50 | Fixed all 36 review findings + hook-layer test gap (engine gates/guards, iOS audio lifecycle, timer chain, SW precache, IDB self-heal, import validation, editor dirty/move/undo) | src/** (39 files), .wolf/* | 617 tests green, typecheck+build clean | ~350k |
| 21:52 | Session end: 32 writes across 18 files (vite.config.ts, engine.ts, useCueScheduler.ts, useSpokenCues.ts, useCueScheduler.test.ts) | 25 reads | ~65404 tok |

## Session: 2026-08-22 21:52

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-22 21:53

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 22:14 | Created src/ui/__tests__/RunScreen.test.tsx | — | ~1010 |
| 22:33 | Session end: 1 writes across 1 files (RunScreen.test.tsx) | 1 reads | ~1031 tok |

## Session: 2026-08-22 22:33

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 17:44 | Created src/media/clipboard.ts | — | ~1141 |
| 17:44 | Edited src/ui/EditorScreen.tsx | added error handling | ~751 |
| 17:44 | Edited src/ui/EditorScreen.tsx | expanded (+23 lines) | ~439 |
| 17:44 | Edited src/ui/EditorScreen.tsx | added 2 import(s) | ~62 |
| 17:44 | Edited src/ui/EditorScreen.tsx | 2→3 lines | ~11 |
| 17:44 | Edited src/ui/EditorScreen.tsx | 2→3 lines | ~41 |
| 17:45 | Edited src/ui/EditorScreen.tsx | CSS: File | ~148 |
| 17:45 | Created src/media/__tests__/clipboard.test.ts | — | ~1242 |
| 17:45 | Edited src/ui/__tests__/EditorScreen.test.tsx | 7→7 lines | ~93 |
| 17:45 | Edited src/ui/__tests__/EditorScreen.test.tsx | added 1 condition(s) | ~419 |
| 17:46 | Edited src/ui/__tests__/EditorScreen.test.tsx | 7→6 lines | ~90 |
| 17:46 | Edited src/ui/__tests__/EditorScreen.test.tsx | expanded (+7 lines) | ~64 |
| 17:46 | Edited src/ui/__tests__/EditorScreen.test.tsx | expanded (+66 lines) | ~832 |
| 17:46 | Edited src/media/__tests__/clipboard.test.ts | added nullish coalescing | ~25 |
| 17:46 | Edited src/ui/help.ts | 1→2 lines | ~112 |
| 17:47 | Edited src/editor/README.md | 3→3 lines | ~62 |
| 17:47 | Edited src/editor/README.md | expanded (+20 lines) | ~334 |
| 17:47 | Edited src/media/README.md | 4→4 lines | ~91 |
| 17:47 | Edited src/media/README.md | 1→2 lines | ~47 |
| 17:47 | Edited src/version.ts | "2.7" → "2.8" | ~10 |
| 17:50 | Paste-from-clipboard in the Add-an-image dialog, enabled only where an image is known to be there | media/clipboard.ts, ui/EditorScreen.tsx, help.ts, 2 test files, 2 READMEs, cerebrum, STATUS, version 2.8 | 637 tests green, typecheck + build clean | ~28k |

## Session: 2026-08-23 17:56

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-23 17:56

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-23 17:57

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-23 23:40

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-24 09:57

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 09:23 | Created src/ui/useRowDrag.ts | — | ~2422 |
| 13:49 | Session end: 1 writes across 1 files (useRowDrag.ts) | 0 reads | ~2422 tok |

## Session: 2026-08-26 13:49

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 18:49 | Created src/routines/writeRoutine.ts | — | ~2698 |
| 19:53 | Session end: 1 writes across 1 files (writeRoutine.ts) | 3 reads | ~2698 tok |

## Session: 2026-08-27 19:53

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-08-27 19:53

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 20:13 | Created scripts/exercise_metadata.py | — | ~2649 |
| 20:15 | Created src/routines/exercises.ts | — | ~1064 |
| 20:18 | Guide-derived exercise metadata: scripts/exercise_metadata.py + exercises.machine.ts, 41 rows, 10 tests | scripts/exercise_metadata.py, src/routines/exercises*.ts | phase 1 of the generator complete, 778 tests green | ~46000 |
| 20:20 | Created src/routines/exercises.other.ts | — | ~2802 |
| 20:21 | Authored the non-machine exercise table from the corpus: exercises.other.ts, 86 rows, use field | src/routines/exercises.other.ts | phase 2 done, 127 exercises, 787 tests green | ~28000 |
| 20:25 | Created src/routines/generate.ts | — | ~4235 |
| 20:28 | The routine generator: pure, budget solve, area rotation, weights from history | src/routines/generate.ts | phase 3 done, 816 tests green | ~34000 |
| 20:30 | Created src/ui/GenerateDialog.tsx | — | ~2855 |
| 20:32 | Generate dialog with live preview; paste now opens in the editor too | src/ui/GenerateDialog.tsx, LibraryScreen, App | phase 4 done, 824 tests green, v4.0 | ~30000 |
| 21:56 | Created scripts/harvest-prescription.test.ts | — | ~1861 |
| 22:41 | Created scripts/harvest-exercises.test.ts | — | ~2319 |
| 22:52 | Created scripts/harvest-shapes.test.ts | — | ~1829 |
| 23:15 | Created src/routines/estimate.ts | — | ~1283 |
| 23:21 | Created src/storage/paces.ts | — | ~1674 |
| 23:25 | Created src/storage/__tests__/paces.test.ts | — | ~1540 |
| 23:35 | Estimate a rep-based routine everywhere, and measure your own pace | estimate.ts, paces.ts, format.ts, EditorScreen, RunScreen, LibraryScreen, GenerateDialog, help.ts | v6.3, 939 tests green | ~95k |
| 23:42 | Hyphenate Full-Body in generated routine names | generate.ts, help.ts, 2 tests | v6.4, 939 green | ~6k |
| 23:35 | Created src/storage/weights.ts | — | ~1404 |
| 23:36 | Created src/routines/loads.ts | — | ~820 |
| 23:38 | Created src/ui/WeightsScreen.tsx | — | ~2026 |
| 23:39 | Created src/ui/weights.css | — | ~914 |
| 23:43 | Created src/storage/__tests__/weights.test.ts | — | ~1395 |
| 23:44 | Created src/ui/__tests__/WeightsScreen.test.tsx | — | ~970 |
| 23:58 | The weights settings page: one weight per exercise, resolved live | weights.ts, loads.ts, WeightsScreen, App, LibraryScreen, generate.ts, bundle.ts | v6.5, 965 green | ~120k |
| 00:12 | Thumbnails and a full-size viewer on the weights page | WeightsScreen, weights.css, help.ts | v6.6, 968 green | ~18k |
| 00:20 | Wayne's own weights replace four looked-up seeds | weights.ts, help.ts | v6.7, 968 green | ~9k |
| 00:40 | Clear-× on the weight field, bulk follow button, weights help tray | EditorScreen, WeightsScreen, loads.ts, help.ts | v6.8, 978 green | ~40k |
| 00:48 | Drop the weights page lede; the help tray carries it | WeightsScreen, weights.css | v6.9, 978 green | ~5k |
| 00:55 | Fix weights not matching a routine's shorthand names | loads.ts, weights.ts, tests | v7.0, 984 green | ~25k |
| 01:10 | Audit routines 2 and 3; seed weights from what Wayne actually lifts | weights.ts, help.ts, tests | v7.1, 984 green | ~35k |
| 01:22 | Add Low Pulley Squat; last looked-up weight corrected away | exercises.other.ts, weights.ts, help.ts | v7.2, 984 green | ~15k |
| 00:25 | Created src/routines/rename.ts | — | ~1930 |
| 00:27 | Created src/routines/__tests__/rename.test.ts | — | ~1224 |
| 01:38 | Tidy exercise names across the library | rename.ts, LibraryScreen, help.ts | v7.3, 995 green | ~30k |
| 01:52 | Bring every README up to date: weights, paces, estimate, rename, harvests | 6 READMEs, docs/paste-format.md, README.md | v7.4, 995 green | ~30k |
| 02:05 | Hide the tidy menu item when there is nothing to tidy | LibraryScreen, help.ts | v7.5, 995 green | ~5k |
| 00:37 | Session end: 19 writes across 19 files (exercise_metadata.py, exercises.ts, exercises.other.ts, generate.ts, GenerateDialog.tsx) | 0 reads | ~34794 tok |
| 00:38 | Session end: 19 writes across 19 files (exercise_metadata.py, exercises.ts, exercises.other.ts, generate.ts, GenerateDialog.tsx) | 0 reads | ~34794 tok |

## Session: 2026-08-27 00:38

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
