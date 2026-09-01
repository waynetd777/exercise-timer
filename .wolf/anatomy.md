# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-09-01T02:43:09.657Z
> Files: 249 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `.DS_Store` (~2184 tok)
- `.gastown-ignore` (~0 tok)
- `.gitignore` — Git ignore rules (~177 tok)
- `.oxlintrc.json` (~300 tok)
- `CLAUDE.md` — OpenWolf (~34 tok)
- `index.html` — Exercise Timer (~440 tok)
- `LICENSE` — Project license (~478 tok)
- `package-lock.json` — npm lock file (~80652 tok)
- `package.json` — Node.js package manifest (~248 tok)
- `README.md` — Project documentation (~2764 tok)
- `tsconfig.app.json` (~201 tok)
- `tsconfig.json` — TypeScript configuration (~47 tok)
- `tsconfig.node.json` (~111 tok)
- `tsconfig.scripts.json` (~113 tok)
- `vite.config.ts` — Vite build configuration (~1635 tok)
- `vitest.harvest.config.ts` — Exercise Timer (~167 tok)

## .claude/

- `settings.json` (~665 tok)

## .claude/commands/

- `designqc.md` (~343 tok)
- `reframe.md` — Mode: migrate [framework] (~551 tok)
- `security-audit.md` — Layer 1: Dependencies (~508 tok)

## .claude/rules/

- `openwolf.md` (~250 tok)

## .github/workflows/

- `deploy.yml` — CI: Deploy to GitHub Pages (~337 tok)

## docs/

- `.DS_Store` (~1640 tok)
- `paste-format.md` — Pasting a routine as text (~2706 tok)

## docs/screenshots/

- `editor.webp` (~13353 tok)
- `exercises.webp` (~10635 tok)
- `generator.webp` (~14438 tok)
- `library.webp` (~16917 tok)
- `paste.webp` (~15736 tok)
- `preview.webp` (~10684 tok)
- `run-list.webp` (~11316 tok)
- `run-timed.webp` (~10740 tok)

## public/

- `.DS_Store` (~1640 tok)

## scripts/

- `exercise_metadata.py` — Exercise Timer (~2649 tok)
- `exercise_plates.py` — Exercise Timer (~1703 tok)
- `fold.ts` — Exercise Timer (~72 tok)
- `harvest-exercises.test.ts` — Exercise Timer (~3220 tok)
- `harvest-prescription.test.ts` — Exercise Timer (~2158 tok)
- `harvest-shapes.test.ts` — Exercise Timer (~3050 tok)

## src/

- `build.d.ts` — Exercise Timer (~63 tok)
- `id.ts` — Exercise Timer (~446 tok)
- `main.tsx` — Exercise Timer (~210 tok)
- `version.ts` — Exercise Timer (~193 tok)

## src/__tests__/

- `id.test.ts` — Exercise Timer (~343 tok)

## src/audio/

- `engine.ts` — Exercise Timer (~3080 tok)
- `README.md` — Project documentation (~2218 tok)
- `referee-whistle-cc0.wav` (~11396 tok)
- `samples.ts` — Exercise Timer (~1391 tok)
- `schedule.ts` — Exercise Timer (~801 tok)
- `speech.ts` — Exercise Timer (~712 tok)
- `tones.ts` — Exercise Timer (~1547 tok)
- `useCueScheduler.ts` — Exercise Timer (~2096 tok)
- `useMuted.ts` — Exercise Timer (~248 tok)
- `useSpokenCues.ts` — Exercise Timer (~1455 tok)

## src/audio/__tests__/

- `engine.test.ts` — Exercise Timer (~1126 tok)
- `schedule.test.ts` — Exercise Timer (~2715 tok)
- `speech.test.ts` — Exercise Timer (~588 tok)
- `tones.test.ts` — Exercise Timer (~1822 tok)
- `useCueScheduler.test.ts` — Exercise Timer (~2488 tok)
- `useSpokenCues.test.ts` — Exercise Timer (~1288 tok)

## src/editor/

- `blocks.ts` — Exercise Timer (~6893 tok)
- `dirty.ts` — Exercise Timer (~1084 tok)
- `history.ts` — Exercise Timer (~1090 tok)
- `images.ts` — Exercise Timer (~1445 tok)
- `README.md` — Project documentation (~5364 tok)

## src/editor/__tests__/

- `blocks.test.ts` — Exercise Timer (~11192 tok)
- `dirty.test.ts` — Exercise Timer (~2330 tok)
- `history.test.ts` — Exercise Timer (~1473 tok)
- `images.test.ts` — Exercise Timer (~2835 tok)

## src/engine/

- `compile.ts` — Exercise Timer (~4221 tok)
- `cues.ts` — Exercise Timer (~1151 tok)
- `index.ts` — Exercise Timer (~168 tok)
- `navigate.ts` — Exercise Timer (~3120 tok)
- `README.md` — Project documentation (~2066 tok)
- `runtime.ts` — Exercise Timer (~950 tok)
- `types.ts` — Exercise Timer (~4477 tok)

## src/engine/__tests__/

- `compile.test.ts` — Exercise Timer (~1840 tok)
- `cues.test.ts` — Exercise Timer (~1555 tok)
- `fixtures.ts` — Exercise Timer (~1235 tok)
- `gates.test.ts` — Exercise Timer (~4528 tok)
- `navigate.test.ts` — Exercise Timer (~2692 tok)
- `runtime.test.ts` — Exercise Timer (~1638 tok)

## src/media/

- `clipboard.ts` — Exercise Timer (~1171 tok)
- `dataUrl.ts` — Exercise Timer (~726 tok)
- `downscale.ts` — Exercise Timer (~610 tok)
- `gc.ts` — Exercise Timer (~1334 tok)
- `hash.ts` — Exercise Timer (~166 tok)
- `pin.ts` — Exercise Timer (~728 tok)
- `README.md` — Project documentation (~1089 tok)
- `resolve.ts` — Exercise Timer (~364 tok)
- `resolveMedia.ts` — Exercise Timer (~931 tok)
- `store.ts` — Exercise Timer (~419 tok)

## src/media/__tests__/

- `clipboard.test.ts` — Exercise Timer (~1275 tok)
- `media.test.ts` — Exercise Timer (~1612 tok)
- `pin.test.ts` — Exercise Timer (~543 tok)
- `resolveMedia.test.ts` — Exercise Timer (~1273 tok)

## src/routines/

- `beginner-full-body.routine.json` (~2547 tok)
- `beginner-full-body.tabata.json` (~6265 tok)
- `beginner-mixed-cardio-1.tabata.json` (~7531 tok)
- `beginner-mixed-cardio-2.tabata.json` (~7855 tok)
- `estimate.ts` — Exercise Timer (~1475 tok)
- `exerciseOptions.ts` — Exercise Timer (~3339 tok)
- `exercises.harvested.ts` — Exercise Timer (~592 tok)
- `exercises.machine.ts` — Exercise Timer (~2117 tok)
- `exercises.other.ts` — Exercise Timer (~3130 tok)
- `exercises.prescription.ts` — Exercise Timer (~4048 tok)
- `exercises.shapes.ts` — Exercise Timer (~1548 tok)
- `exercises.ts` — Exercise Timer (~2047 tok)
- `foldName.ts` — Exercise Timer (~886 tok)
- `generate.ts` — Exercise Timer (~15912 tok)
- `imageCatalogue.ts` — Exercise Timer (~1055 tok)
- `importFiles.ts` — Exercise Timer (~2606 tok)
- `loads.ts` — Exercise Timer (~2417 tok)
- `pasteFormat.ts` — Exercise Timer (~15314 tok)
- `pasteTemplate.ts` — Exercise Timer (~997 tok)
- `README.md` — Project documentation (~7542 tok)
- `rename.ts` — Exercise Timer (~3062 tok)
- `samples.ts` — Exercise Timer (~979 tok)
- `similar.ts` — Exercise Timer (~2040 tok)
- `strength-training.routine.json` (~3524 tok)
- `tabataFormat.ts` — Exercise Timer (~1187 tok)
- `writeRoutine.ts` — Exercise Timer (~5959 tok)

## src/routines/__tests__/

- `burnout.test.ts` — Exercise Timer (~707 tok)
- `estimate.test.ts` — Exercise Timer (~1175 tok)
- `exerciseOptions.test.ts` — Exercise Timer (~2764 tok)
- `exercises.test.ts` — Exercise Timer (~2630 tok)
- `fixtures.ts` — Exercise Timer (~368 tok)
- `generate.test.ts` — Exercise Timer (~14585 tok)
- `imageCatalogue.test.ts` — Exercise Timer (~876 tok)
- `importFiles.test.ts` — Exercise Timer (~1618 tok)
- `importPictures.test.ts` — Exercise Timer (~664 tok)
- `pasteFormat.test.ts` — Exercise Timer (~12102 tok)
- `pasteTemplate.test.ts` — Exercise Timer (~1564 tok)
- `rename.test.ts` — Exercise Timer (~2258 tok)
- `similar.test.ts` — Exercise Timer (~1322 tok)
- `tabataFormat.test.ts` — Exercise Timer (~2248 tok)
- `writeRoutine.test.ts` — Exercise Timer (~5018 tok)

## src/routines/__tests__/emails/

- `2026-04-16-trampoline.txt` (~282 tok)
- `2026-04-23-trampoline.txt` (~147 tok)
- `2026-05-04-trampoline.txt` (~153 tok)
- `2026-05-11-tabata.txt` — Warmup (~224 tok)
- `2026-05-18-trampoline.txt` (~201 tok)
- `2026-05-26-trampoline.txt` (~284 tok)
- `2026-06-01-tabata.txt` (~229 tok)
- `2026-06-22-trampoline.txt` (~193 tok)
- `2026-06-29-tabata.txt` (~202 tok)
- `2026-07-06-tabata.txt` (~254 tok)
- `2026-07-13-trampoline.txt` (~373 tok)
- `2026-07-20-general.txt` (~461 tok)
- `2026-07-27-trampoline.txt` (~579 tok)
- `2026-08-03-trampoline.txt` (~373 tok)
- `2026-08-17-bands.txt` (~490 tok)
- `2026-08-25-emom.txt` — 1 GENERAL BODY (~439 tok)
- `README.md` — Project documentation (~777 tok)

## src/state/

- `clock.ts` — Exercise Timer (~1032 tok)
- `README.md` — Project documentation (~1296 tok)
- `tick.ts` — Exercise Timer (~678 tok)
- `updateApp.ts` — Exercise Timer (~744 tok)
- `usePullToRefresh.ts` — Exercise Timer (~1075 tok)
- `useTimer.ts` — Exercise Timer (~3791 tok)
- `useWakeLock.ts` — Exercise Timer (~618 tok)

## src/state/__tests__/

- `clock.test.ts` — Exercise Timer (~1222 tok)
- `tick.test.ts` — Exercise Timer (~1154 tok)
- `updateApp.test.ts` — Exercise Timer (~1100 tok)
- `usePullToRefresh.test.tsx` — Exercise Timer (~896 tok)
- `useTimer.test.tsx` — Exercise Timer (~1820 tok)
- `useWakeLock.test.tsx` — Exercise Timer (~919 tok)

## src/storage/

- `bundle.ts` — Exercise Timer (~4164 tok)
- `bundleMedia.ts` — Exercise Timer (~1033 tok)
- `customExercises.ts` — Exercise Timer (~2588 tok)
- `db.ts` — Exercise Timer (~1397 tok)
- `download.ts` — Exercise Timer (~452 tok)
- `library.ts` — Exercise Timer (~1316 tok)
- `migrate.ts` — Exercise Timer (~2888 tok)
- `paces.ts` — Exercise Timer (~2228 tok)
- `pictures.ts` — Exercise Timer (~2050 tok)
- `README.md` — Project documentation (~3385 tok)
- `refold.ts` — Exercise Timer (~735 tok)
- `seeded.ts` — Exercise Timer (~277 tok)
- `shareLink.ts` — Exercise Timer (~1288 tok)
- `sweep.ts` — Exercise Timer (~484 tok)
- `tables.ts` — Exercise Timer (~255 tok)
- `useLibrary.ts` — Exercise Timer (~1772 tok)
- `weights.ts` — Exercise Timer (~1424 tok)
- `workouts.ts` — Exercise Timer (~1039 tok)

## src/storage/__tests__/

- `bundle.test.ts` — Exercise Timer (~5956 tok)
- `bundleMedia.test.ts` — Exercise Timer (~1938 tok)
- `customExercises.test.ts` — Exercise Timer (~1665 tok)
- `db.test.ts` — Exercise Timer (~2374 tok)
- `library.test.ts` — Exercise Timer (~2008 tok)
- `migrate.test.ts` — Exercise Timer (~2479 tok)
- `paces.test.ts` — Exercise Timer (~1810 tok)
- `pictures.test.ts` — Exercise Timer (~1385 tok)
- `refold.test.ts` — Exercise Timer (~868 tok)
- `shareLink.test.ts` — Exercise Timer (~1842 tok)
- `weights.test.ts` — Exercise Timer (~3186 tok)

## src/ui/

- `App.tsx` — Exercise Timer (~3081 tok)
- `ConfirmDialog.tsx` — Exercise Timer (~508 tok)
- `CountField.tsx` — Exercise Timer (~523 tok)
- `editor.css` — Exercise Timer (~9874 tok)
- `EditorScreen.tsx` — Exercise Timer (~7050 tok)
- `ErrorBoundary.tsx` — Exercise Timer (~546 tok)
- `ExerciseDialog.tsx` — Exercise Timer (~4095 tok)
- `exercises.css` — Exercise Timer (~2874 tok)
- `ExercisesScreen.tsx` — Exercise Timer (~11555 tok)
- `format.ts` — Exercise Timer (~5054 tok)
- `GenerateDialog.tsx` — Exercise Timer (~5749 tok)
- `help.ts` — Exercise Timer (~4361 tok)
- `HelpTray.tsx` — Exercise Timer (~794 tok)
- `icons.tsx` — Exercise Timer (~2505 tok)
- `keys.ts` — Exercise Timer (~454 tok)
- `library.css` — Exercise Timer (~5293 tok)
- `LibraryScreen.tsx` — Exercise Timer (~8370 tok)
- `Menu.tsx` — Exercise Timer (~2398 tok)
- `NoticeDialog.tsx` — Exercise Timer (~490 tok)
- `PasteDialog.tsx` — Exercise Timer (~1897 tok)
- `preview.css` — Exercise Timer (~1683 tok)
- `preview.ts` — Exercise Timer (~668 tok)
- `PreviewList.tsx` — Exercise Timer (~1832 tok)
- `README.md` — Project documentation (~7163 tok)
- `run-screen.css` — Exercise Timer (~8431 tok)
- `RunScreen.tsx` — Exercise Timer (~8320 tok)
- `sounds.css` — Exercise Timer (~596 tok)
- `SoundsScreen.tsx` — Exercise Timer (~1934 tok)
- `theme.css` — Exercise Timer (~9396 tok)
- `useDismiss.ts` — Exercise Timer (~496 tok)
- `useMediaUrl.ts` — Exercise Timer (~333 tok)
- `useModal.ts` — Exercise Timer (~354 tok)
- `useRowDrag.ts` — Exercise Timer (~2423 tok)

## src/ui/__tests__/

- `App.test.tsx` — Exercise Timer (~864 tok)
- `EditorScreen.test.tsx` — Exercise Timer (~10207 tok)
- `ErrorBoundary.test.tsx` — Exercise Timer (~378 tok)
- `ExerciseDialog.test.tsx` — Exercise Timer (~2876 tok)
- `ExerciseField.test.tsx` — Exercise Timer (~3904 tok)
- `ExercisesScreen.test.tsx` — Exercise Timer (~8132 tok)
- `format.test.ts` — Exercise Timer (~5383 tok)
- `GenerateDialog.test.tsx` — Exercise Timer (~3592 tok)
- `keys.test.ts` — Exercise Timer (~489 tok)
- `LibraryScreen.test.tsx` — Exercise Timer (~1434 tok)
- `Menu.test.tsx` — Exercise Timer (~1492 tok)
- `preview.test.ts` — Exercise Timer (~1318 tok)
- `PreviewList.test.tsx` — Exercise Timer (~2600 tok)
- `RunScreen.test.tsx` — Exercise Timer (~3666 tok)

## src/ui/editor/

- `ExerciseField.tsx` — Exercise Timer (~5278 tok)
- `ImageDialogs.tsx` — Exercise Timer (~3395 tok)
- `rows.tsx` — Exercise Timer (~9146 tok)
- `TimingField.tsx` — Exercise Timer (~1869 tok)
- `useDraftDrag.ts` — Exercise Timer (~968 tok)
- `useDraftHistory.ts` — Exercise Timer (~1866 tok)
