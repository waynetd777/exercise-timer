# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-08-28T21:04:01.730Z
> Files: 84 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `AGENTS.md` — OpenWolf (~75 tok)
- `CLAUDE.md` — OpenWolf (~34 tok)
- `vite.config.ts` — /*.test.{ts,tsx}'], (~791 tok)

## .claude/

- `settings.json` (~665 tok)

## .claude/commands/

- `designqc.md` (~343 tok)
- `reframe.md` — Mode: migrate [framework] (~551 tok)
- `security-audit.md` — Layer 1 — Dependencies (~510 tok)

## .claude/rules/

- `openwolf.md` (~251 tok)

## .codex/

- `config.toml` (~7 tok)
- `hooks.json` (~677 tok)

## .codex/prompts/

- `designqc.md` (~343 tok)
- `reframe.md` — Mode: migrate [framework] (~551 tok)
- `security-audit.md` — Layer 1 — Dependencies (~510 tok)

## scripts/

- `exercise_metadata.py` — Exercise Timer (~2649 tok)
- `exercise_plates.py` — page_text, exercise_names, slug, plate (~1651 tok)
- `harvest-exercises.test.ts` — Exercise Timer (~2319 tok)
- `harvest-prescription.test.ts` — Exercise Timer (~1861 tok)
- `harvest-shapes.test.ts` — Exercise Timer (~1829 tok)

## src/

- `version.ts` — What the home screen shows beside the help button. (~161 tok)

## src/audio/

- `engine.ts` — Web Audio wrapper. (~4038 tok)
- `useCueScheduler.ts` — Which run the clock is measuring. Cues are armed one run at a time. (~1542 tok)
- `useSpokenCues.ts` — Steps shorter than this never announce: the countdown beeps cover them. (~1416 tok)

## src/audio/__tests__/

- `useCueScheduler.test.ts` — The hook against a hand-driven engine: what these tests pin down is WHEN the (~1625 tok)
- `useSpokenCues.test.ts` — One 25s work step: long enough (over 20s) to earn an announcement. (~1256 tok)

## src/editor/

- `blocks.ts` — Exercise Timer (~6720 tok)
- `images.ts` — An image a step can be given, whether it ships with the app or a routine (~1416 tok)
- `README.md` — Project documentation (~4492 tok)

## src/media/

- `clipboard.ts` — The clipboard as a source of images. (~1141 tok)
- `dataUrl.ts` — Blobs as text, so an image can travel inside an export file. (~630 tok)
- `README.md` — Project documentation (~1065 tok)

## src/media/__tests__/

- `clipboard.test.ts` — One clipboard entry, shaped like the real ClipboardItem in the ways we use. (~1244 tok)
- `pin.test.ts` (~334 tok)
- `resolveMedia.test.ts` — The store is mocked with a live listener registry, because the behavior (~657 tok)

## src/routines/

- `estimate.ts` — Exercise Timer (~1283 tok)
- `exerciseOptions.ts` — Exercise Timer (~2666 tok)
- `exercises.other.ts` — Exercise Timer (~2802 tok)
- `exercises.ts` — Exercise Timer (~1064 tok)
- `generate.ts` — Exercise Timer (~4235 tok)
- `imageCatalogue.ts` — Exercise illustrations available to every routine. (~1025 tok)
- `loads.ts` — Exercise Timer (~820 tok)
- `pasteTemplate.ts` — A routine written in every part of the grammar the paste parser understands, (~569 tok)
- `rename.ts` — Exercise Timer (~1930 tok)
- `writeRoutine.ts` — Exercise Timer (~2698 tok)

## src/routines/__tests__/

- `exerciseOptions.test.ts` — Exercise Timer (~1578 tok)
- `pasteTemplate.test.ts` — The template is shipped help: the app offers it as the example of what it can (~1177 tok)
- `rename.test.ts` — Exercise Timer (~1224 tok)

## src/state/

- `clock.ts` — The run clock, as pure data plus transitions. (~1000 tok)
- `updateApp.ts` — Fetches the latest app from the host, then reloads onto it. (~680 tok)
- `useTimer.ts` — The run the clock is currently measuring. The cue scheduler arms against it. (~3238 tok)

## src/state/__tests__/

- `clock.test.ts` — Declares clock (~1190 tok)
- `updateApp.test.ts` — FakeWorker: fakeWorker, fakeRegistration, stubEnvironment (~1121 tok)
- `usePullToRefresh.test.tsx` — Puller (~864 tok)
- `useTimer.test.tsx` — renderTimer (~1790 tok)
- `useWakeLock.test.tsx` — Holder (~887 tok)

## src/storage/

- `bundleMedia.ts` — The photos in an export file. (~890 tok)
- `paces.ts` — Exercise Timer (~1674 tok)
- `pictures.ts` — Exercise Timer (~1842 tok)
- `weights.ts` — Exercise Timer (~1404 tok)

## src/storage/__tests__/

- `bundleMedia.test.ts` — Declares photo (~1635 tok)
- `db.test.ts` — A hand-rolled sliver of IndexedDB: open with scripted outcomes, one-request (~1629 tok)
- `migrate.test.ts` — Declares workout (~1336 tok)
- `paces.test.ts` — Exercise Timer (~1540 tok)
- `pictures.test.ts` — Exercise Timer (~1118 tok)
- `weights.test.ts` — Exercise Timer (~1395 tok)

## src/ui/

- `EditorScreen.tsx` — One undo step: name, colour and steps together, so they cannot drift apart. (~16521 tok)
- `GenerateDialog.tsx` — Exercise Timer (~2855 tok)
- `help.ts` — The help text, kept out of the screens that show it. (~1562 tok)
- `HelpTray.tsx` — One line each. If a point needs a paragraph it belongs somewhere else. (~713 tok)
- `keys.ts` — Whether the run screen's shortcuts should act on a key, given what has focus. (~422 tok)
- `preview.css` — Exercise Timer (~1541 tok)
- `preview.ts` — Exercise Timer (~674 tok)
- `PreviewList.tsx` — Exercise Timer (~1204 tok)
- `useDismiss.ts` — Closes a transient overlay — a menu, a popover — on Escape or a press outside (~448 tok)
- `useRowDrag.ts` — Exercise Timer (~2422 tok)
- `weights.css` — Exercise Timer (~914 tok)
- `WeightsScreen.tsx` — Exercise Timer (~2026 tok)

## src/ui/__tests__/

- `EditorScreen.test.tsx` — A step that runs as its own countdown, so it gets an image button. (~2424 tok)
- `ExerciseField.test.tsx` — Exercise Timer (~1859 tok)
- `preview.test.ts` — Exercise Timer (~1318 tok)
- `PreviewList.test.tsx` — Exercise Timer (~1394 tok)
- `RunScreen.test.tsx` — The audio layer is exercised by its own hook tests; here it would only try (~1010 tok)
- `WeightsScreen.test.tsx` — Exercise Timer (~970 tok)

## src/ui/editor/

- `ExerciseField.tsx` — Exercise Timer (~3350 tok)
- `rows.tsx` — Exercise Timer (~8487 tok)
