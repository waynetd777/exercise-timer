# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-08-28

## User Preferences

- [2026-08-28] **Review and analysis output goes to a scratchpad markdown file, not an Artifact.** Wayne treats a review as a backlog to fix from in the same session ("don't bother with an artefact. scratchpad is fine. we're going to go on to fixing the issues"). Summarise in the terminal, keep the full list in a file.
- [2026-08-22] **No em dashes, anywhere.** Not in prose, comments, READMEs, or user-facing strings. Use a colon when the second half explains the first, a comma when it qualifies, a full stop when it stands alone, or parentheses for a true aside. The three survivors in the repo are functional and must stay: `DASH_CHARS` in `routines/pasteFormat.ts`, the `[\s:–—-]` class in its `.replace`, and the `[\s[-–—]]` pattern quoted in a comment and in `routines/README.md`. En dashes inside the email fixtures and `strength-training.routine.json` are verbatim source data and also stay.
- [2026-08-22] **Documentation is written short.** One idea per sentence. Prefer a full stop to a subordinate clause, and plain words over clever ones. The in-app help is bullets because help is read mid-task, standing up, looking for one answer.

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- [2026-08-20] Wants apps to work across **all three of his devices** — phone, iPad, and laptop — not phone-only. Treat responsive/multi-device as a default requirement, not a nice-to-have.
- [2026-08-20] Asks "how would you suggest we go about that?" before coding — prefers a proposed approach + explicit decisions up front over immediate code.

## Key Learnings

- [2026-08-28] **a gym instructor is a woman: she/her.** Wayne's correction after a day of "he" in comments, docs and
  test names, all fixed. Nothing in the emails names her; do not guess a pronoun from a role.

- [2026-08-28] **The project is on TypeScript 7; typescript-eslint's peer range stops at 6.1, so ESLint cannot be installed cleanly.** The linter is oxlint (`npm run lint`, `.oxlintrc.json`): correctness + suspicious + rules-of-hooks as errors, exhaustive-deps as a warning with `// eslint-disable-next-line react-hooks/exhaustive-deps` where an omission is deliberate. The React Compiler style rules (refs, immutability, set-state-in-effect) are OFF because the code uses the "latest ref" pattern on purpose.
- [2026-08-28] **`npm install` needs `--cache <scratchpad>/npm-cache`** in this environment: the default /tmp/npm-cache is not writable.
- [2026-08-28] **Generator reachability check:** probe 600 seeds and list catalogue exercises never drawn. Filling a quota "area by area" silently starves the last area; draw across areas in turn (bug-110).
- [2026-08-28] **`opening ??= new Promise(executor)` cannot un-cache itself from inside the executor.** The executor runs before the assignment, so a `forget()` inside it clears nothing. Assign first, then `promise.catch(forget)`. (db.ts, bug-080)
- [2026-08-28] **A rolling cue window must open BEHIND the clock.** The first arm runs after React commits, so `elapsed` is already >0 and a cue at 0 is outside `[elapsed, elapsed+lookahead)`. Look back by the shared grace and let the engine play a cue that late. (bug-075)
- [2026-08-28] **A gate collapses a group only where the list view can draw it.** `gateKey` and `listMode` must ask the same question of the nearest section; the countdown view shows one step. (bug-086)
- [2026-08-28] **A serializer without escaping must read back what it writes.** `writeRoutine.stepLines` re-parses each emitted line; anything the parser reads differently is dropped and reported. Add the check before adding grammar. (bug-089)
- [2026-08-28] **When appending to `.wolf/buglog.json` with Python, use `json.dumps(indent=2)` with default `ensure_ascii`.** The file escapes non-ASCII as `\uXXXX`; `ensure_ascii=False` rewrites every line and buries the real change.
- [2026-08-28] **Review workflow that worked:** six module reviewers in parallel, each reading every file in scope; the lead re-reads every high and runs the reviewers' probe tests before accepting; fixes go one group per commit with a failing-before/passing-after check (`git stash` the source files, run the new tests, pop).
- [2026-08-27] **A `<dialog>` has `height: fit-content` from the UA stylesheet, and it BEATS `top: 0; bottom: 0`.** The help tray was pinned to all four edges and still grew past the viewport, because an explicit height over-constrains the box and `bottom` is the one dropped. Its body then had no definite height to scroll inside, so long help just ran off the screen with nothing to drag; the grid rows, the `min-height: 0` and the `overflow-y: auto` were all already correct. `.modal` sets `height: 100dvh` for exactly this reason, which is how the cause was found: two dialogs differing in one property, and only one of them scrolling. **Any `<dialog>` meant to fill the viewport needs an explicit height, not insets.** It hid for months because it only shows once the content exceeds one screen. (bug-071)
- [2026-08-27] **The Horizon guide is a DATA SOURCE, not just a source of pictures.** `exercise_plates.py` had been cropping images out of it for months while the muscle group sat in plain sight as the colour of each page's title band, the manual's own key saying so. `scripts/exercise_metadata.py` now reads station, muscle group, attachment and per-side out of it for all 41 exercises, so the routine generator classifies nothing. **Before hand-authoring metadata about someone else's product, look at what the manufacturer already published.** The per-side count is the cautionary half: reading only for a named limb ("right ankle") found 6, and the guide's actual phrase, "complete repetitions and repeat on opposite side", found 11. The five missed included Side Cable Bends, which Wayne's own routine already runs two sets a side.
- [2026-08-27] **A generated routine's LENGTH must be solved, not estimated.** The tempting shape is `n = budget / averageCost`, which is wrong the moment a per-side exercise costs two groups or an ankle-strap one costs five more seconds. `generate.ts` adds exercises one at a time and costs each one exactly, so a 45 minute request comes out at 45m 05s rather than near it. Same principle as `totalDurationMs` mirroring `compile()`: if two things must agree about arithmetic, make one of them do the arithmetic.
- [2026-08-27] **"Never the same twice in a row" excludes the only option when there is one.** The area rotation that makes a generated routine read like Wayne's stopped a torso-only routine after ONE exercise, because the rule filtered out the single area available. A rule about alternating applies only where there is something to alternate with. Cheap to get wrong and invisible until a test asks for one area.
- [2026-08-27] **Do not widen a filter the user set, even to be helpful.** Wayne asked for a "multi-gym / no multi-gym / mixed" question AND for the torso to be supplemented from non-machine exercises when the machine runs short. Those pull against each other: silently supplementing a multi-gym routine overrides the answer he just gave. Challenged it, and he agreed: multi-gym reports the shortfall, only `mixed` supplements. **When two requirements conflict, say so rather than picking one.**
- [2026-08-27] **A stale comment justified a stale behaviour for months.** Paste went straight to the library, explained by "the editor cannot show a section or a ladder yet, so it would open on a blank screen". `SectionRow` and `LadderRow` had existed since the sections work landed. The comment was right when written and nobody re-read it when the reason expired. **When a comment gives a REASON for a behaviour, the reason is a claim about the code and can rot like any other.**
- [2026-08-27] **SUPERSEDED by user decision: weights are now a FIELD, `Segment.load`, free text.** The 2026-08-26 entry below says weights go in the step name and not to propose a schema field again. Wayne reversed that once the editor row had shown it could carry a second value. Free text, not a number and a unit, which was his original reason for refusing the field: a band has a colour, a machine has a stack position, a press-up has your own weight. It lives in `.erow__extras` beside Note and Or, not on the row, because it is content and the row has no width. `nameWithLoad` renders it after the name so the run screen reads exactly as the hand-typed names did, which keeps it out of `.count__lead`'s two points of slack. `storage/migrate.ts` lifts a trailing weight out of names already saved, and `writeRoutine` writes it back into the name because text has no syntax for one.
- [2026-08-27] **The editor's timing control was DESTRUCTIVE, and that mattered more than what it displayed.** `setTiming` deletes both `durationMs` and `reps` before writing whichever the unit names, so a patch mentioning only one deleted the other: typing in the count of a counted-and-timed step destroyed its clock on the first keystroke. Fixing the display without fixing that would have made the loss more visible, not less. Now `Timing`'s `reps` variant carries an optional `durationMs` and every commit writes both. The row fits because `.erow__main` is `flex-wrap: wrap`, so an extra field wraps rather than crushing the name: the 2026-08-22 lesson was about an UNSPLITTABLE 380pt band, not about field count.
- [2026-08-27] **A `transform` on ANY ancestor breaks `position: fixed`, and `translateY(0)` counts.** `.library__scroll` carries `transform: translateY(calc(var(--pull, 0) * 1px))` for pull-to-refresh at all times, which makes it the containing block for fixed descendants. The `Menu` list is fixed and placed from the trigger's viewport rect, so a menu opened from a library ROW was positioned against the scrolled list and appeared far below its button, further off the further down you had scrolled. The header menus were fine and always had been, because they sit outside the scroller: the bug only existed once a Menu went inside a row. **Fix is a portal to `document.body`**, not arithmetic against the offending ancestor, because that makes the rule hold wherever the trigger lives instead of asking every future ancestor to watch what it does with transforms. Same trap applies to `filter`, `perspective`, `will-change` and `contain`. (bug-070)
- [2026-08-27] **Measure a popover, do not assume its size.** `Menu` hardcoded `width = 208` to match `width: 13rem` in the stylesheet, true only while the root font size is 16px, and never considered height at all, so it could not know whether it fitted below the trigger. It now measures the rendered list in a `useLayoutEffect` (before paint, so nothing flashes), flips above when there is no room below, caps `max-height` to the room actually available, and right-aligns when a left-aligned list would overrun the screen. `place()` is exported and unit tested, because jsdom lays nothing out and the arithmetic IS the behaviour.
- [2026-08-27] **Text export is a FIXED POINT, not a round trip, and the test has to say so.** `write(read(x)) === x` is false and no writer can make it true: `parseRoutine` prepends a five-second get-ready when a routine does not open on one, and gathers loose top-level steps into a section called "Routine". Both are normalisations the grammar cannot express away. The property that does hold, and the one `writeRoutine.test.ts` pins, is that the SECOND pass changes nothing. The template needs two passes rather than one, and that is not a bug: its AMRAP sits inside a rounds group where the AMRAP heading cannot be written, so the round is dropped on the first pass and nothing moves after that.
- [2026-08-27] **Three traps in writing the paste format back out, all paid for.** (1) `Then:` closes a rounds group but NOT an AMRAP: an AMRAP's round collects bullets until a section HEADING, so the AMRAP form is only safe where a heading or the end of the text follows it. (2) The separator rules must run over a group's children too, not just the top level, or a step after a nested group is read into it. (3) The parser's own get-ready is prepended LOOSE, above any section, so writing it as a bullet puts it inside the first section and the routine sinks a level on every trip; leave it out and let the parser put it back. Also: `12 × Curls - 60 seconds` reads as a step CALLED "12 × Curls", so a count and a time cannot be written on one step, and a per-side count needs the doubled form `10 × Lunges (5 each side)` rather than a `- 5 each side` tail.
- [2026-08-27] **Probe the parser before writing a serializer for it.** Half an hour of throwaway `parseRoutine` calls printing what each candidate line becomes settled six design questions that guessing had got wrong, including both of the count forms above. The grammar is a reader of handouts, so what it accepts and what it MEANS by what it accepts are different questions, and only the second one matters to a writer.
- [2026-08-27] **A group's LABEL is data, so renaming the group is always two changes.** `newRepeat()` writes the default into every group it makes, and `format.ts`'s fallback only fires when a label is ABSENT, so routines already in IndexedDB keep saying the old word forever. `storage/migrate.ts` holds the remap and is wired into `listWorkouts`, `fromBundle` and `decodeRoutine`; `LEGACY_REPEAT_LABELS` is now `['Round', 'Rep', 'Reps']` onto `'Set'`. This is the SECOND rename to hit it (Round to Reps, then Reps to Set), and the second time the round-trip fixtures in `bundle.test.ts` and `shareLink.test.ts` broke, because they carried the old default and the migration made export-then-import stop being identity. When changing any stored default, grep the test fixtures for it in the same pass.
- [2026-08-27] **A repeat group counts SETS, and the UI now says so.** Every user-visible "reps" on the group primitive became "sets": the toolbar chip, the four group aria-labels and titles, "Number of sets", the "between sets" badge, the help text, and the `label` default in `blocks.ts` (`'Reps'` to `'Set'`) with both `format.ts` fallbacks to match. The word "reps" survives ONLY where it means reps: the step timing field's `Reps` label, the `x` unit's tooltips, and a ladder's "Reps at each rung". The old naming had the editor asking for "Number of reps: 3" on a group that was three sets of twelve, while the one control that did mean reps sat on the step row using the same word. `data-kind="reps"`, `data-between-reps`, `RepsIcon` and `newRepsStep` are unchanged: they are CSS hooks and identifiers, not copy. Gotcha paid for: `dirty.test.ts` used `{ label: 'Set' }` as its "changed round label" case, which became a no-op the moment 'Set' was the default.
- [2026-08-27] **The editor cannot represent a step that is both timed and counted, but the parser can build one.** `timingOf()` prefers `reps` over `durationMs`, so such a step shows its count and hides its seconds, and `setTiming()` deletes BOTH fields before writing whichever one the unit select names. So one keystroke on that row destroys the duration silently. `pasteFormat.ts` makes them on purpose ("a minute of curls is both twelve reps and sixty seconds"), and `nameWithEffort` exists to render them. No shipped routine currently contains one, so nothing is broken today. Wayne hit this when a hand-authored routine carried both: the fix was to put the count in the step NAME ("12 x Leg Press 65kg") and keep the step plain timed. **Never hand-author `reps` alongside `durationMs` in a routine that will be opened in the editor.** If the editor should support it, the row needs a second field, and that is a real design change rather than a copy fix.
- [2026-08-25] **The gym instructor writes on MORE THAN ONE template, and the second one is not a variation of the first.** The 25 Aug email reported 28 skipped lines. Its forms are structurally new: AMRAP, EMOM ("Minute 1: 12 × Bicep Curls"), a 30/30 interval, `Repeat 2 rounds` written BELOW the block it repeats, `Then:`, `3 × 30 seconds`, and "(Optinal)" in front of a heading. Assume a third template is coming; the "understands every line" test over `__tests__/emails/` is the tripwire and it worked exactly as designed.
- [2026-08-25] **The idea the paste grammar was missing: a directive can license the line below it.** "30 sec WORK", "Minute 4", "LAST 20 SECONDS" and "Every time you finish a round:" all state a step without naming one. Every earlier form was self-contained on its line, so the parser had no way to carry intent forward, and read in isolation "30 sec WORK" became a 30-second step called WORK while the real exercise below it fell through to `skipped`. Five exercises lost per section, and worse than a skip because the junk step looked like a parse. When a new form loses data rather than reporting it, look for cross-line intent before adding another regex.
- [2026-08-25] **An EMOM needs no primitive: the minute IS an ordinary timed step.** `Segment` carries `durationMs` and `reps` independently, so "Minute 1: 12 × Bicep Curls" is 60_000ms labelled twelve reps and the run screen already does the right thing. A minute whose step states a shorter time of its own ("Minute 6: 30-sec Wall Sit") gets the balance back as a rest, because the minute is fixed. Reach for the existing three group kinds before adding a fourth: `Repeat`, `Ladder` and `Section` covered every new form except AMRAP.
- [2026-08-25] **AMRAP is a CLOCK: one timed step of the stated length, round in the note.** Wayne's correction, and he was right. My first pass kept the exercises as steps and the ten-minute cap as a section note, reasoning that no primitive means "as many rounds as possible". But that conflated two different things: the ROUND COUNT is genuinely unreadable from the text, while the TEN MINUTES is stated plainly. Refusing to invent the first is rule 1; dropping the second is just data loss, and worse than a skipped line because the app then quietly ran a ten-minute block as a single pass through the list and said nothing. **Read what the text states and leave only what it does not.** Check this whenever "there is no primitive for X" is the reasoning: usually part of X is stated and only part is not.
- [2026-08-25] **In the paste docs, SYNTHESISED is not ADDED.** Wayne's correction. I changed "the one thing it ADDS to the text is five seconds to get ready" to "two things", counting the rest that fills the balance of an EMOM minute. Wrong: the parser has always materialised steps that appear as no bullet ("Rest 45 seconds after each round" makes a Rest step inside the round, "15 sec rest between exercises" makes several), and the claim never counted those, because the TEXT STATES THEM. A minute's balance is arithmetic on stated values, so it is read, not invented, and my own replacement wording said "not invented" while filing it under what the app adds. Same error on the AMRAP step's name: the parser has always named the steps it synthesises ("Rest", "Get ready"). The get-ready is the only thing genuinely different in kind, because nothing in any email implies it. Before "correcting" a claim in this repo, work out which standard it is using; these docs are precise on purpose.
- [2026-08-26] **HTML5 drag-and-drop does not fire AT ALL in iOS Safari.** `draggable`, `dragstart`, `drop`: none of it. Any drag feature in this app has to be Pointer Events, since the phone is where the routine is edited. `ui/useRowDrag.ts` is the working pattern.
- [2026-08-26] **A drag loop belongs on `requestAnimationFrame`, not on `pointermove`.** Two reasons, both load-bearing. A move dispatched to React leaves the DOM a render behind, so a burst of pointer events applies the same step several times before any of it lands; and auto-scroll has to keep going while a finger is held still at the edge of a list, when no pointer events arrive at all. Skip ONE frame after each move (`settling`) or the next measurement compares the new position against a stale neighbour and moves again immediately.
- [2026-08-26] **Reuse `moveStep` for drag rather than writing a second reorderer.** `useRowDrag` only decides that the held row has passed its neighbour and calls `onStep(id, ±1)`; the editor answers with `moveStep`, the same function the old buttons called, already tested for walking a step into and out of rounds, ladders and sections. A drag therefore cannot put a step anywhere the buttons could not, and there is one implementation of reordering, not two. **And the whole drag shares the `'drag'` coalescing key from `history.push`, so undo takes it back in one press** rather than one per row crossed. That key is the same mechanism a run of keystrokes uses.
- [2026-08-26] **jsdom lays nothing out, so give it a layout when testing geometry.** Stub `Element.prototype.getBoundingClientRect` to assign each row a fixed height IN ITS CURRENT ORDER and add its parsed `translateY`, exactly as a browser would. The geometry under test is then the real geometry. Two gotchas paid for: jsdom implements neither `setPointerCapture` nor `releasePointerCapture` (stub both), and a state update dispatched from an animation frame is not a React event, so **the frame callbacks must be run inside `act()`** or nothing is committed and the next frame measures the old order.
- [2026-08-26] **Removing a control means checking what it was the only path to.** The drag grip was `aria-hidden` and out of the tab order BECAUSE Move up and Move down existed. Deleting those buttons without making the grip answer the arrow keys would have made reordering pointer-only. Deleting them also stranded `first` in `RowProps` (read by nobody) and left `last` read only by `SegmentRow` while three other components were handed it; both were cleaned up. Ask what a deleted control was carrying before deleting it.
- [2026-08-26] **Weights go IN THE STEP NAME. There is deliberately no `load` field.** Wayne's decision, after being given the options (name / note convention / `Segment.load` / inside `Reps` / per-rung `Ladder.loads` / routine-level kit list). "Bicep Curls @ 8kg" costs nothing, works today in paste, share, export and both run layouts, and handles bands as well as dumbbells. Do not propose a schema field again unless the goal changes to PROGRESSION or logging what was actually lifted, which is a different feature needing per-session storage. Caveat worth repeating to him if it bites: `nameWithEffort` prefixes the rep count, so the count belongs in the reps field and only the weight in the name, or the heading reads "12 × 12 × Bicep Curls @ 8kg". The stand-down guard only fires on a per-side count in the name ("5 each side"), not a plain leading "12 ×".
- [2026-08-25] **`.count__lead` has about 2cqh of slack. Do not put anything new in it.** The budget is written out in the `--clock-max` comment: meta 20 + label 12 + name 14 + clock 52 = 98cqh. A section heading added there wrapped to two lines on an iPhone and, because the lead is `align-content: center` in a `minmax(0, 1fr)` row, the overflow spilled BOTH ways, over the header above and the step count below. The `.count` comment already recorded the same failure from a previous occasion. **When a run-screen element needs a home, prefer the header**: that row is `auto` and gives way, so the body's `1fr` absorbs it and no tuned budget has to move.
- [2026-08-25] **A parser change does not touch routines already saved.** A routine is stored as it was PARSED, so fixing `pasteFormat.ts` fixes nothing in IndexedDB and reloading does not re-parse. When the AMRAP round changed from a ` · ` join to one item per line, the bullets did not appear on Wayne's phone at all, and the diagnosis came from the separator still being visible in his screenshot: the new parser cannot emit one. The fix belongs in `storage/migrate.ts`, which `workouts.ts:16` runs on every read and which also covers share links, bundles and file imports. **Constants in a migration must be FROZEN LOCAL COPIES, never imported from the live module**: a migration describes data that already exists, so it has to keep matching if the parser renames the thing tomorrow.
- [2026-08-25] **Sizing text to FILL a box on both axes is a fixed point, and the answer is a square root.** `.panel__empty` divided its height budget by `wordCount`, on the reasoning that `fitCqi` may put every word on its own line. Right for a three-word exercise name; for a 30-word AMRAP round it asked for 43 lines, bottomed out on the CSS `1rem` floor, and then used three of them, leaving the panel four fifths empty (Wayne's screenshot). The error is that line count is not independent of size: shrinking the text cuts the line count AND the line height, so `total·s²·ADVANCE/BUDGET ≤ HEIGHT` gives `s = sqrt(HEIGHT·BUDGET/(ADVANCE·total))`. New `fitPanel(text)` in `ui/format.ts` returns `{fit, lines}` together and reproduces the word-count answer EXACTLY for short names, which is the check that it is the right generalisation rather than a second rule. Whenever a `--lines` style variable is estimated independently of the size it will divide, suspect this.
- [2026-08-25] **A timed step's `note` is displayed, and where depends on the layout.** `RunScreen.tsx:157` MediaPanel shows `entry.note ?? entry.name` as the big fallback text when a step has no image, so a note is the way to put a reference card beside a countdown. But `section.note` renders ONLY in list mode (`RunScreen.tsx:96`), so it is invisible in an all-timed section. Sizing caveat: the panel is uppercase/bold and `--lines` comes from `wordCount`, so a 30-word note bottoms out at the 1rem clamp floor. Fine for a glanceable round, wrong for prose.
- [2026-08-25] **A trailing "Repeat 2 rounds" wraps the steps above it, but only a plain list.** One email states the round count above the block and the next states it below, so the rounds handler wraps the section's existing loose children when they are all segments and no group is open. The guard matters: a section that has already built a ladder or a round has stated its structure, and swallowing it would rewrite the workout rather than read it.

- [2026-08-23] **A Rollup banner cannot survive Vite's minifier.** Vite drives esbuild with `legalComments: 'none'`, so `build.rollupOptions.output.banner` and any user `renderChunk` hook are both wiped: Vite's own `vite:esbuild-transpile` runs after even `enforce: 'post'` user plugins. It fails silently, with a green build and a bare bundle. Anything that must appear in built output goes in `generateBundle`, which runs after every chunk is rendered and minified and before the files are written (so vite-plugin-pwa still precaches what is on disk). CSS is an `asset` with `.source`, JS is a `chunk` with `.code`.
- [2026-08-23] **The exercise illustrations are not ours to license.** `public/exercises/` holds 43 crops of the Horizon Torus 5 Exercise Guide PDF, produced by `scripts/exercise_plates.py`. The repo is public and MIT licensed, so `LICENSE` and the README both carve them out explicitly. Never widen the licence to cover `public/`, never suggest publishing the images as part of the project, and if a reuse question comes up the answer is that they bring their own illustrations. The whistle is the opposite case: `src/audio/referee-whistle-cc0.wav` is verified CC0 and safe to ship.
- [2026-08-23] **Every source file carries a four-line MIT header** (`.ts`, `.tsx`, `.css`, `vite.config.ts`, `scripts/*.py` after the shebang, `index.html` after the doctype). New files must get it too. The built bundle gets its own notice from `licenceNotice()` in `vite.config.ts`.
- [2026-08-22] **The hook/effect seam is where this codebase's bugs live.** The 2026-08-22 full review found all eight high-severity bugs (except one parser bug) in the React-effect/lifecycle layer (useTimer's timeout chain, useCueScheduler's AudioContext lifecycle, updateApp's service worker, db.ts's connection cache) while the pure layers were near-flawless. When adding any effect that owns a timer, listener, or external handle, write a jsdom hook test alongside it; the infrastructure now exists (`// @vitest-environment jsdom` pragma, jsdom + @testing-library/react installed, examples in src/state/__tests__/useTimer.test.tsx and src/audio/__tests__/useCueScheduler.test.ts).
- [2026-08-22] **New block kinds and fields must be added to three registries at once:** dirty.ts sameBlock, bundle.ts isBlock, and (for groups) blocks.ts isGroup-driven code. Sections/ladders and the reps/alternative fields missed the first two and caused silent data loss and permanent-dirty bugs.
- [2026-08-22] **jsdom does not implement HTMLDialogElement.showModal/close**; component tests stub them onto the prototype (see src/ui/__tests__/EditorScreen.test.tsx).

- [2026-08-22] **README screenshots live in `docs/screenshots/`, never in `public/`.** Anything under `public/` is copied into `dist` and precached by the PWA service worker, so four screenshots would have added megabytes to every offline install for no benefit. Verify after adding any asset: `npm run build` prints the precache count and size, and it must not move. Store them downscaled to 900px and converted with `cwebp -q 88 -resize 900 0`, which took these four from 3.2MB to 188KB. Git keeps every version forever, so size discipline matters more here than for a served asset.
- [2026-08-22] **GitHub markdown needs an HTML `<table>` for side-by-side images.** There is no markdown syntax for it. Use `<td width="50%">` with `<img width="420">` (the README column is about 900px), and give every image real alt text.

- [2026-08-22] **An absolutely positioned box with `width: auto` is shrink-to-fit sized against its CONTAINING BLOCK, not the viewport.** Anchoring the editor row's controls panel to a 42px wrapper made its available width 42px, so shrink-to-fit fell back to min-content — and because the button cluster had been allowed to wrap, min-content was one button and the panel collapsed into a vertical column of eight. Give a popover `width: max-content` and keep its widest child `nowrap`: that states the intent and is independent of whatever it is anchored to. (bug-046)

- [2026-08-22] **A full-screen app shell wants `svh`, not `lvh` or `dvh`.** All three are equal on a home-screen install (no browser UI), so a bug here only shows in a browser TAB. `dvh` reflows for the keyboard and iOS does not always report the dismissal. `lvh` is the screen with the browser UI RETRACTED, so with Safari's bars showing the shell is taller than the screen — the bottom band is cut off, and the excess is scrollable overflow. `svh` is the only one that always fits what can be seen, and it is just as keyboard-stable as `lvh`. A dialog is the exception: `.modal` uses `dvh` on purpose. (bug-047)
- [2026-08-22] **`overflow: hidden` clips overflow, it does not prevent it — and the browser can still scroll what the user cannot.** With a shell taller than the viewport, iOS's focus-reveal scrolled the document when the keyboard opened and left it scrolled: header off the top, and `hidden` meant there was no way to drag it back. "The document never scrolls" needs BOTH the hidden overflow and a height the screen can actually show; either alone is a trap.

- [2026-08-22] **A native `<select>` is as wide as its WIDEST option, not the one it shows.** The editor's unit select showed `s` while holding the width of `rung each side` — ~140pt of a phone's 311pt row, nearly all empty, and the whole reason the row could not fit its buttons. Fix: `data-unit` on the element plus per-label widths in `em` (so they track the type scale) — see `.efield--unit`. Check this before blaming the layout whenever a select looks too wide.

- [2026-08-22] **Flexbox places items by MAX-CONTENT, then shrinks — so grouping items can only make them harder to place.** Gathering the editor row's 8 buttons into one wrapping `.erow__band` made a ~380pt item that could never share a phone's ~311pt line, so it took a line and split inside it: 4 lines where 3 had been. Built, reverted, do not retry. Pair only what must not split (`.erow__own` = image + note, since two loose 42px buttons split and one gets stranded), and leave the pair loose in the flow so it rides along with whatever line has room.
- [2026-08-22] **When the controls do not fit, take them out of the row — do not rearrange them.** A step row wants 4 fields plus 8 42px buttons (~380pt of buttons against a phone row's ~313pt). Two attempts to arrange a way out failed (pair-and-keep-loose, then one grouped band) before the answer: `.erow__tools` is an absolutely-positioned panel behind a ⋯ button under 64rem, and laid out inline above it — chosen by CSS alone, so no width is measured in JS and there is nothing to fix on a resize. Grouping is only safe above the breakpoint because the row fits on one line there BY CONSTRUCTION. Repeat `[data-open]` inside the container query or a row left open keeps its panel `display` when the window grows.

- [2026-08-22] **Two dialog gotchas, both already paid for.** (1) A `<dialog>` styled as the box does not hug its content on iOS — always the `.modal` sheet plus a panel child (`.notice`, `.picker`, `.paste`), never `height: fit-content` on the dialog. (2) React simulates bubbling for `close`, so a dialog rendered INSIDE another fires the outer one's `onClose` on dismissal. Render it as a SIBLING, after the one it sits above. Both are why the editor's image chooser and preview reuse `.modal` + `.notice` verbatim rather than getting bespoke boxes.
- [2026-08-22] **A control that can be a thumbnail should occupy ONE slot in both states.** The editor's image row became a single button left of the note button: no image → an image button that opens the chooser, an image → the 42px thumbnail that opens the preview (where Remove lives). Same slot, same 42px as its neighbours, so the control band never reflows when a picture arrives.
- [2026-08-22] **Key a remove affordance on the stored REF, not on the resolved URL.** `useMediaUrl` returns null for a ref whose blob is not on this device (an export that travelled without it). Gating the thumbnail on the URL would strand exactly the step that most needs clearing, so it is gated on `segment.media !== undefined` and opens an empty frame with Remove and an explanation.

- **Project:** exercise-timer — an interval/Tabata-style exercise timer, built as an installable web PWA (React + TS + Vite), no backend.
- [2026-08-20] Interval-timer correctness gotchas, decided up front: (1) never accumulate `setInterval` ticks — derive elapsed from `Date.now() - startedAt - pausedTotalMs`, since background tabs throttle/freeze timers; (2) never fire beeps from a JS tick — pre-schedule them on `AudioContext.currentTime` with a rolling lookahead, so a stalled main thread still cues on time; (3) mobile browsers require a user gesture to unlock `AudioContext`.
- [2026-08-20] Web PWA cannot reliably run a timer with an iPhone screen locked / phone in pocket. User accepted this tradeoff for iteration speed. If it ever becomes a real problem, the escape hatch is Capacitor + a native background-audio plugin, reusing the same engine.
- [2026-08-20] Media-storage gotchas to handle when phase 4 lands: (1) call `navigator.storage.persist()` — without it the browser may evict IndexedDB and silently lose a routine's images; (2) HEIC from an iPhone decodes in Safari but not Chrome/Firefox — the iOS file picker usually converts to JPEG, but handle decode failure with a clear message rather than a broken image; (3) content-addressed media needs GC on routine delete (sweep remaining workouts for live hashes, drop orphans; re-sweep on app start to catch interrupted deletes); (4) cache `URL.createObjectURL` results per media id and revoke on unmount or you leak blobs.
- [2026-08-20] Run-screen image detail: preload and `img.decode()` the *next* segment's image during the current one, otherwise there's a white flash at the exact moment the user looks up. `position()` therefore returns `nextEntry` as well as `entry`.
- [2026-08-20] **User already hosts their Tabata exercise images on postimages** (e.g. `https://i.postimg.cc/jCGnZ34t/Cable-Fly.png`) and wants to keep using them. So `remote` URL is the PRIMARY media source, not an afterthought — don't design as if local uploads are the default path.
- [2026-08-20] **postimages facts, verified by curl (not assumed):** `i.postimg.cc` sends `access-control-allow-origin: *` and `cache-control: max-age=315360000`; images are ~31KB. The filename segment of `i.postimg.cc/<id>/<name>.<ext>` is IGNORED — any name or extension returns the image, only a bare trailing slash 404s. Therefore (a) remote images can be fetched → Blob → canvas-processed → pinned into IndexedDB, so remote is not a one-way door, and (b) a `postimg.cc/<id>` share link can be normalised in-app to `https://i.postimg.cc/<id>/img.png`. The `postimg.cc` HTML page has NO CORS, so never try to scrape it from the browser. Caveat: a share-link id may resolve to a resized variant — one page exposed 3 different ids for the same image.
- [2026-08-20] GitHub account for this project: `waynetd777`. Repo `waynetd777/exercise-timer` exists and is private + empty; local dir is not yet `git init`-ed.

- [2026-08-20] **Toolchain actually installed (phase 1):** Vite 8.2, React 19.2, TypeScript 7.0, Vitest 4.1, Node 22.23. Two gotchas: (1) with Vitest 4, `defineConfig` must be imported from `vitest/config` — not `vite` — or the `test` key isn't typed; (2) tsconfig runs `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`, so build optional props with conditional spread (`...(x ? { x } : {})`) rather than `x: undefined`, and indexed access needs a `!` where provably in range.
- [2026-08-20] **Engine convention: all non-finite `elapsedMs` clamps to 0.** `position()` does NOT treat `+Infinity` as past-the-end. One rule for invalid input beats two special cases, and a real monotonic clock never produces it. A test initially asserted the opposite — see buglog `bug-001`.
- [2026-08-20] **`compile()` silently drops degenerate input** rather than throwing: non-positive/non-finite segment durations and repeat counts < 1 contribute nothing; fractional durations round to whole ms; fractional repeat counts floor. Validation belongs in the editor (phase 6), not the engine — the engine must never crash on a half-typed routine. The one exception that DOES throw is `TimelineTooLargeError` above 10k steps, guarding against nested repeats exploding the tab.
- [2026-08-20] **`totalDurationMs()` / `stepCount()` intentionally duplicate `compile()`'s arithmetic** so the library list can show "18 min · 24 steps" per row without compiling every routine. A parametrised test asserts they agree with `compile()` across all fixtures — keep that test if either function changes.

- [2026-08-20] **User preference confirmed: plain CSS + custom properties, no Tailwind** for this project. Images sit in a bounded panel beside the countdown (stacked on phone portrait).
- [2026-08-20] **`position(timeline, 0)` returns the FIRST entry, not null.** Only completion gives a null entry. So `at.entry` is truthy before a run starts — any "is the workout going" check must be on `status`, never on entry nullness. Cost one bug (`bug-002`).
- [2026-08-20] **Timer UI does NOT need a 60fps rAF loop.** Schedule one `setTimeout` for the exact moment the displayed value next changes: `entry.endMs - (secondsShown - 1) * 1000`. ~1 callback/sec instead of 60, identical precision, much kinder to battery — and still self-correcting because elapsed is derived from `performance.now()`. Timeout throttling in a hidden tab is harmless for the same reason.
- [2026-08-20] **`performance.now()` not `Date.now()`** for the run clock: monotonic, so changing the system clock or timezone mid-workout cannot corrupt a run.
- [2026-08-20] **With `container-type: inline-size`, only `cqi`/`cqw` are meaningful.** `cqh` has no container to resolve against and silently falls back to the viewport. Use `svh` when you mean viewport height. (`bug-004`)
- [2026-08-21] **SUPERSEDED by user decision — phase colours are TRAFFIC LIGHT, not warm/cool.** `--role-prepare: #4FD07E` (green, get ready), `--role-work: #EF4A3F` (red, work), `--role-rest: #4A93F5` (blue, rest), `--role-recover: #9080E8` (violet, unchanged). Do NOT revert these to the warm/cool scheme; it was my rationale, not his requirement. Colour-vision robustness is instead handled by separating the three by LIGHTNESS as well as hue (green 0.48, blue 0.29, red 0.24 relative luminance), and each clears 4.5:1 against the dark primary-button text (green 9.6, blue 6.1, red 5.2) — check that ratio if any role colour changes, since `.btn--primary` puts `--ink-900` text on `--phase`.
- [2026-08-20] **Design direction (historical, colours since superseded above):** warm-neutral dark ground (`--ink-900 #12100E`, not blue-black); phases were coded WARM vs COOL not red vs green (work amber `#FF7A2F`, rest steel-blue `#52A8CE`, recover violet `#9080E8`, prepare neutral bone) so they survive colour-vision deficiency and read peripherally at three metres; no webfonts (must work offline), so the giant tabular numerals ARE the display face, set against small wide-tracked uppercase labels; the signature element is the **effort strip** — one sliver per step, width ∝ duration, height ∝ effort, so the routine's shape is legible at a glance and it doubles as the progress bar.
- [2026-08-20] **User reviews UI in the browser himself — do NOT install Playwright/Puppeteer to self-review.** Asked directly and declined. So: keep a dev server running and hand over a URL rather than adding browser tooling. Practical consequence: describe what to look at and what you are unsure about, since code review catches logic bugs but never a layout that just looks wrong.
- [2026-08-20] **No browser driver in this project** (no Playwright/Puppeteer, and this `openwolf` build has no `designqc` subcommand), so UI work ships visually unverified. Phase 2 was reviewed by reading code only — it caught 3 real bugs, but it cannot catch a layout that looks wrong. Consider installing Playwright before the layout-heavy library/editor phases.

- [2026-08-21] **The `.tabata` file format (Tabata Timer app export), decoded from a real file.** Top level: `fileVersion`, `packageName`, `platform`, `type`, `versionCode`, `versionName`, `workout`. `workout.intervals` is the **FULLY EXPANDED** sequence; each interval has `type` (0 = prepare/transition, 1 = work, 2 = rest), `time` in SECONDS, optional `description` (the exercise name) and optional `url` (a direct `i.postimg.cc` image). **The sibling fields — `cycles`, `work`, `rest`, `prepare`, `restBetweenTabatas`, `tabatasCount` — are the template defaults the routine was generated FROM, not multipliers.** Applying `cycles: 3` would have turned a 42-minute workout into 126 minutes. Ignore them. Importer lives at `src/routines/tabataFormat.ts`.
- [2026-08-21] **Wayne's real routines confirm the media design was right:** his exported routine carries 10 distinct `i.postimg.cc` illustrations referenced by direct URL, and several exercises have NO image. So `remote` really is the primary source, and the empty-panel state is a normal case rather than an edge case.
- [2026-08-21] **Do not cap a hero element's size in rem.** Cost a user-reported bug (`bug-005`): the countdown was `clamp(5rem, 34cqi, 15rem)` and the 15rem ceiling made it tiny on a laptop. Size against BOTH axes with cq units (`min(Xcqi, Ycqh)`) and let content length be the limit, not an arbitrary ceiling. To query the block axis you need `container-type: size`, which needs a definite block size — a `1fr` row of a `100%`-height grid qualifies.
- [2026-08-21] **Name containers once there is more than one.** `container: shell / inline-size` on the outer shell, `container: body / size` on the body, and always write `@container shell (...)`. Unnamed queries silently retarget to the nearest container ancestor when you add a new one.
- [2026-08-21] **Variable-width numerals need a width hint, not a smaller font.** Pass the string's em width as a custom property (`--chars`: digit = 1, colon = 0.5) and divide the width term by it. "8" and "17" then render identically while "4:30" steps down instead of overflowing.

- [2026-08-21] **Wayne's existing app is Tabata Timer by Alexander Sergienko** (`com.alexandersergienko.TabataTimer`, v5.2.11, iOS build wrapped and installed on this Mac). Its assets live at `/Applications/Tabata Timer.app/Wrapper/TabataTimer.app/` — **110 audio files** named `sound_*.mp3` / `music_*.m4a`. Useful cue names: `sound_click` (0.16s), `sound_water_drop` (0.18s), `sound_finger_snap` (0.21s), `sound_beep` (0.78s), `sound_electronic_stab` (1.04s), `sound_boxing_10_seconds_left` (1.33s, spoken), `sound_xylophone` (1.75s), `sound_bell` (1.85s), `sound_ding_dong` (2.04s), `sound_ding` (3.34s), `sound_win_01`/`sound_airhorn` (4.36s, byte-identical), `sound_gong_metal` (5.93s), `sound_fanfare` (7.03s). The app stores no sound choice in its `.tabata` export and had no preferences plist on this Mac, so the user's actual selections are unknown — the mapping in `src/audio/samples.ts` is a reasonable default, not a match.
- [2026-08-21] **Cue sounds are third-party assets from a commercial app.** Fine on a private page for personal use; do NOT publish the site publicly with them in place. This is a concrete reason to prefer an access-controlled host over GitHub Pages, which publishes a public site even from a private repo. `src/audio/tones.ts` keeps a full synthesised fallback, so removing the mp3s degrades rather than breaks.
- [2026-08-21] **Vite: import binary assets as modules (`import x from './x.mp3?url'`), not from `public/`,** when they are fixed assets referenced by code. A missing or renamed file then breaks the BUILD instead of going silent at runtime, and each gets a content-hashed URL. Reserve `public/` for files addressed by data (e.g. `bundled` MediaRef paths). Applied after a runtime existence test proved to be the wrong tool.
- [2026-08-21] **`tsconfig.app.json` has `types: ["vite/client"]` and NO node types — deliberately, so app code cannot reach for `process` or `fs`.** Consequence: never use `node:fs`/`node:path`/`process` in a test under `src/`, because `tsc -b` compiles tests as part of the app project and will fail even though vitest runs them fine. Restructure the test to avoid node APIs rather than adding node types.
- [2026-08-21] **Sample playback keeps the pre-scheduling architecture unchanged** — `AudioBufferSourceNode.start(at)` schedules on the audio clock exactly like an oscillator. Buffers must be fetched and decoded BEFORE scheduling, so `audio.preload()` runs on first arm and the scheduler re-arms after it resolves; `scheduleSample` returns false when a buffer is not ready so the caller falls back to a tone and no cue is ever silent.

- [2026-08-21] **Size type for the VIEWING DISTANCE, not by convention.** This is a gym timer read at 2-3 metres mid-effort, and the label token started at 0.7rem (~11px) because that is what secondary text gets on a dashboard. User asked twice for bigger elements (`bug-005` countdown, `bug-006` labels). Rule for this project: ~1rem is the FLOOR for secondary text, scaled with the container (`clamp(1rem, 1.6cqi, 1.6rem)`), and reduce letter-spacing as size grows — 0.16em tracking that looks right at 11px reads far too wide at 23px.
- [2026-08-21] **A fixed `min-width` inside a `nowrap` flex row is a latent overflow.** The control row's primary button had `min-width: 12rem`; enlarging the labels pushed five buttons to ~550px against a 390px phone. Use `min(target, 100%)` and let the row `flex-wrap`. Check this whenever type sizes go up. (`bug-007`)

- [2026-08-21] **Controls are REVERTED to the original scale by request** (`--label-size-control: 0.7rem`, `--label-tracking-control: 0.16em`, `.btn` 56px, primary 64px / 10rem). Asked for after three rounds of enlarging body text: he wants a big readable countdown area and a quiet, compact bottom bar — not a uniformly large UI. Treat that contrast as intentional.
- [2026-08-21] **The original control row DID overflow a phone** — at 0.7rem the five buttons plus gaps total ~508px against 390px. So `flex-wrap: wrap` on `.controls` and `min(10rem, 100%)` on the primary button were kept through the revert: they are invisible when things fit and prevent a real overflow when they do not. Do not remove them when "reverting" control styling.
- [2026-08-21] **Two label scales, deliberately: `--label-size` (body) and `--label-size-control` (bottom bar).** Wayne asked for everything bigger EXCEPT the controls, which he confirmed were right. `.controls` overrides `--label-size: var(--label-size-control)` and the buttons inherit it, so future size changes to body text cannot silently regrow the control row. Don't collapse these back into one token.
- [2026-08-21] **Empty media panel shows the STEP NAME, not "No image".** 46 of the 86 steps in Wayne's real routine have no illustration (21× "Get ready", 20× "Rest", 3× "Low Pulley Squat", 2× "Change Sides") — over half — so this is the normal state, and it must look designed rather than like a failure.
- [2026-08-21] **`fitCqi(text)` in `src/ui/format.ts` sizes a wrapping headline off its LONGEST WORD** (161 / longest, capped), because that word is what has to fit one line. "REST" then sets ~3x larger than "SEATED ABDOMINAL CRUNCH" and both fill the frame. Requires the frame itself to be `container-type: inline-size`, or cqi measures the whole body and long names overflow. Same family as `clockWidth` for the countdown — prefer extending this pattern over inventing a new fitting trick.

- [2026-08-21] **`--label-size` is height-aware: `clamp(1.6rem, min(3.2cqi, 6.5cqh), 3.4rem)`.** Wayne asked for bigger secondary text three times (`bug-006`, then twice more), and at ~46px the meta row wraps to two lines — combined with a ~300px countdown that would overflow the body row on a short laptop window. The `cqh` term makes labels give way when VERTICAL space is the scarce axis, so the request is honoured wherever there is room. If asked to enlarge again, raise the cqi term and the cap, and re-check the vertical stack (label + clock + name + wrapped meta) against body height at 1440x600 — that is the tightest real case.
- [2026-08-21] **Wayne's instinct on type size runs much larger than a conventional UI scale.** Three separate requests to enlarge. When building new screens for this project, start secondary text around 2.5-3cqi (~30-43px on a laptop), not at a dashboard-like 0.7-1rem, and expect the hero to fill its box.

- [2026-08-21] **`text-transform: uppercase` mangles unit suffixes** — the label transform rendered "20s" as "20S". `.unit` in `run-screen.css` sets `text-transform: none`; wrap any `duration()` output that sits inside an uppercase label in it. Applied to the next-up line and the meta row (the latter only shows a suffix when under a minute remains, so it was a latent version of the same bug).

- [2026-08-21] **Ground is a NEUTRAL grey ramp, faintly cool — the warm/brown cast was rejected.** `--ink-900 #121314`, `--ink-800 #1A1C1D`, `--ink-700 #242628`, `--ink-600 #34373A`, `--bone #F1F2F3`, `--bone-dim #9BA0A6`, `--bone-faint #7E838A`. Do not reintroduce the warm neutrals (`#12100E` / `#F2EDE4` / `#A1988B`) — that was my choice, not his. `--bone-faint` is set light specifically to clear 4.5:1 on the grey ground at phone label sizes; the original grey I picked (`#656A70`) only managed 3.41:1.
- [2026-08-21] **The routine name has TWO homes and both needed shrinking.** The idle title (`.rest-state__title`), and the running eyebrow — which shows "Round 3 of 8" only when a routine HAS repeat groups, and otherwise falls back to `workout.name`. Every imported `.tabata` routine is flat, so the eyebrow always shows the routine name, and these run to 50+ characters. `.count__routine` gives that case its own smaller, quieter treatment while "Round 3 of 8" keeps the full label scale. If either grows again, remember to check both.

- [2026-08-21] **Never fade a saturated colour toward the near-black ground to show an inactive state — that is how you make brown.** Cost a user-reported bug (`bug-008`): the effort strip used `opacity: 0.22/0.5` per state, so red `#EF4A3F` composited to `#431F1D` and `#802E2A`, both simply brown. Fix pattern: mix toward a MID or LIGHT neutral to keep the hue readable (`color-mix(in oklab, var(--step-colour) 55%, var(--bone-dim))` → `#C9716D`), or drop the hue entirely. Wayne has now objected to a brown cast twice, so treat any muddy dark warm tone as a defect in this project.
- [2026-08-21] **The effort strip is REMOVED by request** ("nuke the progress bars at the top"). The top row is now a header carrying the routine name. It was my signature element, not a requirement — do NOT reinstate it. Progress is still legible from "Step n / m" and the time remaining in the meta row. `src/ui/EffortStrip.tsx` and the `.strip` rules are deleted; `--effort-*` tokens remain in theme.css, unused, in case a future visualisation wants them.
- [2026-08-21] **(historical, component since deleted) The effort strip encoded rhythm in HEIGHT, not hue** — work tall, rest short. That makes colour on upcoming steps redundant, which is why they are now plain neutral. Don't re-add hue to the `todo` state to make the strip look richer; it costs legibility and buys nothing.

- [2026-08-21] **Space between fluid text should be in `em`, not `rem`.** The meta row's `1.5rem` column gap looked fine at 11px labels and cramped at 43px. With `--label-size` fluid, any gap separating those items has to scale with them — `1.75em` on the flex container. Check other fixed gaps if the type scale changes again.

- [2026-08-21] **`cqi` measures the CONTAINER, not the column an element occupies.** The countdown sits in a 3fr column of a 3fr/2fr grid inside the `body` size container, so a width coefficient safe when stacked full-width overflows when placed beside the image panel. Handled with `--clock-coef`: 140 stacked, 88 inside the wide-AND-landscape query. Same trap applies to anything sized in cqi inside a multi-column grid — check against the COLUMN width, roughly `(bodyw - gap) * 3/5` here.
- [2026-08-21] **Countdown geometry, for reference when it is next asked to grow:** `max(3rem, min(var(--clock-coef) * 1cqi / var(--chars), 65cqh))`. On a laptop the HEIGHT term governs (65cqh ≈ 459px) with the vertical stack at ~609px of ~706px available; on a phone the WIDTH term governs. To enlarge, raise 65cqh and re-check the stack (eyebrow + clock*0.82 + name*1.15 + meta + gaps) against body height at 1440x600, which is the tightest real case.
- [2026-08-21] **No "Paused" indicator by request** — the primary button reading "Resume" is the only paused affordance. Don't add a chip or badge back.

- [2026-08-21] **The routine name lives in the header only.** It used to be duplicated — header plus the eyebrow above the countdown, plus the idle-screen hero. The eyebrow now carries only "Round 3 of 8" and is omitted entirely for a flat routine so the row collapses; the idle and complete screens lead with "Ready" / "Done" instead of repeating the name. Don't re-add the name to the body.
- [2026-08-21] **Wide clock coefficient is 88, not 92** — at 92 a two-digit countdown reached 97% of the column width on an iPad (1024x768), which is inside the error bar of the ~1.2em glyph-width estimate. 88 gives 93% there and costs nothing on a laptop, where the height term governs anyway.

- [2026-08-21] **Controls are icon-only square buttons** (56px, primary 68px) using inline SVG from `src/ui/icons.tsx` — chosen over an icon font or emoji because SVG inherits `currentColor`, renders identically everywhere and needs no extra request offline. Transport icons filled, utilities stroked. **Every control carries its name in `aria-label` AND `title`**, which is the only thing keeping them discoverable — never add an icon button here without both.
- [2026-08-21] **The control row now fits one line at phone width** (372px vs 390px), where the text version was ~508px and always wrapped. `flex-wrap` stays for narrower devices (a 320px iPhone SE still wraps). If text ever returns to these buttons, the `--label-size-control` / `--label-tracking-control` tokens were deleted as dead code and would need reinstating.
- [2026-08-21] **Routine name is centred in the header** by request.

- [2026-08-21] **Hosting decided: GitHub Pages, and the repo goes PUBLIC once complete.** This resolves the earlier Pro-plan caveat (Pages is free for public repos) and means `VITE_BASE=/exercise-timer/` matters — already wired since phase 1. **PRE-PUBLIC CHECKLIST, must happen before flipping the repo public:** the `src/audio/cues/*.mp3` files are the Tabata Timer app's commercial assets and a public repo redistributes them. Swap to the synthesised fallback (delete the samples; `tones.ts` already covers every cue) or to CC0 replacements. Wayne's postimages URLs also become public at that point — probably fine, but it is his call to make knowingly.
- [2026-08-21] **Storage lives in `src/storage/`, not `src/media/`** as originally planned — the `workouts` store is not media. `db.ts` creates BOTH the `workouts` and `media` stores at version 1, so phase 4's image work is an addition rather than a schema migration. Phase 4 code should import from `src/storage/db.ts`.
- [2026-08-21] **Library pattern mirrors the run clock: pure logic in `library.ts`, IO in `workouts.ts`, React in `useLibrary.ts`.** All the fiddly rules (favourites pinned, never-run sorts below run, `(copy 2)` numbering that does not stack suffixes, blank rename rejected, `markRun` must NOT touch `updatedAt`) are pure and unit-tested without a browser. IndexedDB itself is deliberately dumb and untested — keep it that way rather than adding fake-indexeddb.
- [2026-08-21] **Column contents are centred** — countdown, exercise name, meta row, next-up line, and the idle/complete screens. Left-aligned was the original; don't revert.

- [2026-08-21] **The app is called "Exercise Timer"** (was "DavShack Timer", before that "DavShack Gym Timer"). Shown as the centred home-screen heading and the document title, and carried in the PWA manifest. Five places: `index.html` (`<title>` + `apple-mobile-web-app-title`), `vite.config.ts` (manifest `name`/`short_name`), `public/favicon.svg` (aria-label), `LibraryScreen.tsx`, `README.md`. The library heading is the PRODUCT name, not a "Routines" section label. **The `davshack-timer-bundle` marker in `bundle.ts` is DATA, not branding — renaming it would make every existing export unreadable. Leave it.**
- [2026-08-21] **Library cards open on a whole-card click, via a stretched `<button>` overlay** — not an onClick on the `<li>`, which would not be focusable or announced, and not a wrapping button, which cannot legally contain the star and action buttons. Layering matters: `.row__open` at `z-index: 1` sits ABOVE the name/stats so the whole card is clickable, and `.row__star`/`.row__actions` at `z-index: 2` sit above it so they still work. The overlay is rendered ONLY in idle mode — otherwise it covers the rename input and the delete confirmation.

- [2026-08-21] **Centred text with letter-spacing is ALWAYS off-centre by half the tracking** — CSS applies letter-spacing after the last character too, so the line box and the visible glyphs differ by that amount. Fix: keep the value in one custom property and add `padding-right: calc(-1 * var(--tracking))` to the block. (`bug-009`)
- [2026-08-21] **When a font size divides by a content-derived factor, FLOOR that factor at whatever the coefficient was calibrated for.** `clockWidth` returned 1 for a single digit while the coefficient assumed 2, so "9" rendered up to 100% larger than "10" and shoved the layout off-screen. Now `Math.max(2, units)`, so size only ever steps down. Same trap applies to `fitCqi` if its cap is ever removed. (`bug-010`)
- [2026-08-21] **A test can guarantee the bug it claims to prevent.** `clockWidth('8') === 1` shipped under the name "sizes one and two digits so the countdown does not jump". When writing a test whose name asserts an invariant, check the assertion actually expresses it — and prefer asserting the RELATIONSHIP (monotonic, equal to each other) over the literal values.
- [2026-08-21] **In the stacked layout, the media panel absorbs leftover space** — `.run__body` is `grid-template-rows: auto minmax(0, 1fr)` and `.panel__frame` is `height: 100%` with no aspect-ratio. An `aspect-ratio` demands height proportional to WIDTH regardless of what is left, which silently pushed the panel off a short window. The clock's height term also differs by layout now: `--clock-height` 40cqh stacked, 74cqh beside the panel. (`bug-011`)

- [2026-08-21] **NEVER use the `font:` shorthand in a shared utility class.** It resets font-size and font-family, so any component override becomes silently dependent on CSS import order. `.label { font: var(--label) }` lived in run-screen.css, and because App.tsx imports LibraryScreen before RunScreen it loaded last and clobbered the cards' own meta size — making the card meta BIGGER than the routine name at every width. Shared utilities live in `theme.css` (loaded first by main.tsx), in longhand, parameterised by a custom property. (`bug-012`)
- [2026-08-21] **There is ONE type scale, in `theme.css`, keyed to role.** Tracking: `--track-display: -0.03em`, `--track-name: -0.01em`, `--label-tracking: 0.11em`. Sizes: `--size-display`, `--size-title`, `--size-name`, `--label-size`, `--label-size-sm`. Both screens reference tokens only. Before this there were 11 ad-hoc font sizes and 5 tracking values, which is why the library and run screen read as different apps (`bug-013`). **Do not add a local clamp() for type** — extend the scale instead. The single documented exception is `.count__name`, which needs a `cqh` term the tokens do not carry.
- [2026-08-21] **To step a label down, override the token** (`--label-size: var(--label-size-sm)`), never `font-size` directly. That is what keeps the `.label` treatment intact while changing only the step.

- [2026-08-21] **Verify an edit actually landed before committing it.** A `sed`/python edit whose pattern silently failed to match got committed alongside notes claiming the fix, so the repo recorded a change it did not contain (commit `1bfa498`, corrected by `dccf660`). Assert the match AND that it is unique (`s.count(old) == 1`), check the printed confirmation, and for CSS grep the BUILT `dist/assets/*.css` — that is the only proof the rule survived the bundler.
- [2026-08-21] **The stacked `.run__body` needs bottom padding.** It was `var(--step-5) var(--step-5) 0`, so the panel's next-up line sat flush on the controls divider and a 3px nudge was the entire clearance rather than an adjustment to it. Now `var(--step-4)`. The wide layout always had 24px. (`bug-014`)

- [2026-08-21] **The fallback step name is bounded on BOTH axes.** `.panel__frame` is `container-type: size` (not `inline-size`) so the text can be measured against the frame's height — safe because the frame fills a `1fr` grid row, giving it a definite block size. Size is `clamp(1rem, min(--fit * 1cqi, 72cqh / --lines), 7rem)`, where `--lines` is the word count from `wordCount()`. Word count is an UPPER bound on lines (because `fitCqi` sizes the longest word to the full width, so each word may take its own line), which is what makes dividing the height budget by it safe.
- [2026-08-21] **Padding must scale with a container that can get small.** A fixed 16px was 29% of a 110px frame and clipped the text on its own, even with the font correctly bounded. `.panel__empty` uses `4cqh` vertical padding. Check this on anything inside an element that absorbs leftover space.

- [2026-08-21] **LIVE at https://waynetd777.github.io/exercise-timer/** — repo is PUBLIC, Pages source is GitHub Actions, deploy runs on every push to main gated on typecheck + tests. History was rewritten with `git filter-repo` to purge `src/audio/cues` before going public; a backup bundle was taken first. All 26 commits kept, hashes changed, force-pushed.
- [2026-08-21] **Cues are now SYNTHESISED from measurements, no bundled audio.** Countdown 523Hz sine; phase change 2659Hz with an inharmonic partial at x2.578; completion a transcription of the app's figure over G5/F5/C6/F6. If retuning, the source files are still at `/Applications/Tabata Timer.app/Wrapper/TabataTimer.app/sound_*.mp3`.
- [2026-08-21] **A percussive sound needs a STRIKE + RING envelope, not one exponential.** The app's bell falls to 0.33 of peak in 25ms then rings on, still audible at 1200ms. A single exponential from peak is loud in the middle and dead by 500ms, which sounds like a click regardless of pitch. `Note` therefore carries `sustain` and `strikeMs`, and a partial can carry `decayScale` because high partials die before the body stops ringing. (`bug-015`)
- [2026-08-21] **Never stop a sounding oscillator to re-arm the scheduler.** `cancelPending()` used to stop every tracked node; the window re-arms every 10s, so any cue overlapping a re-arm was truncated mid-ring — an audible click. `pending` is now a `Map<OscillatorNode, startTime>` and only future nodes are cancelled. (`bug-015`)
- [2026-08-21] **When picking spectral peaks, enforce a minimum separation** (40Hz worked here). The first pass reported six "partials" that were adjacent bins of one tone. (`bug-016`)
- [2026-08-21] **The app mark is a blue stopwatch.** `public/favicon.svg` plus 32/64px PNG fallbacks, and `StopwatchIcon` in `icons.tsx` with the SAME geometry — keep the two in sync if either changes. `.mark` is sized in `em` so it tracks adjacent text and left on `currentColor`; the blue is set once on `.library__title` (`--role-rest`), so mark and wordmark match by construction. ALL icons are the stopwatch now — favicon, `icon-192/512`, maskable and apple-touch — generated by one parameterised renderer (art fraction + corner radius). Maskable and apple-touch are FULL BLEED with the artwork inside the safe zone, because launchers and iOS crop them; the others carry a 20% rounded corner. The segmented-ring icon is gone.
- [2026-08-21] **npm's cache is unwritable in this sandbox** (`/tmp/npm-cache` has root-owned files). Install with `--cache <scratchpad>/npm-cache`.

- [2026-08-21] **Only Wayne's three real routines are seeded.** "Classic Tabata" was removed on request — do not re-add a synthetic demo routine to `SEED_ROUTINES`. Consequence: no seeded routine uses repeat groups (imported `.tabata` files are always flat), so the "Round 3 of 8" path is exercised only by the engine and format tests, not by anything in the library.
- [2026-08-21] **Removing a seed does NOT remove it from an existing library** — seeding is once-per-id and the routine is already in IndexedDB. It has to be deleted in the UI. Deliberately no auto-delete-by-id migration: it would destroy a routine the user may have edited or renamed.

- [2026-08-21] **Phase 6 (editor) is built.** Pattern held: pure tree ops in `src/editor/blocks.ts` (Path = index chain, immutable, 36 tests) + `src/editor/postimages.ts` (URL normaliser, 7 tests), with `src/ui/EditorScreen.tsx` as a thin shell. Deliberate constraints: `wrapInRepeat` REFUSES to nest a repeat inside a repeat, because the editor renders only two levels and a deeper tree would be invisible and un-editable; `moveBy` past either end is a no-op so holding a button cannot corrupt the tree; `unwrapRepeat` on an empty repeat drops it entirely.
- [2026-08-21] **`clearMedia` exists because of `exactOptionalPropertyTypes`** — you cannot patch `media: undefined` through `updateSegment`. Clearing an image means DELETING the key so the property is absent, not present-and-undefined. Same will apply to any other optional field the editor learns to clear.
- [2026-08-21] **Library row actions are: star, edit-steps (`StepsIcon`), rename (inline, `PencilIcon`), duplicate, delete.** Inline rename was kept alongside the editor deliberately — it is quicker for the common case, and two paths to a rename is normal (like a file manager). Header has New and Import.
- [2026-08-21] **Both the run and editor screens carry the blue radial wash** (`--role-rest` at 14% / 10%), matching the home screen. A screen without it will look like it belongs to a different app.
- [2026-08-21] **Run-screen progress bar is a scaled inner element, not a gradient stop** — `transform: scaleX(var(--progress))` with a 400ms linear transition, because gradient stops do not transition and the value only changes once a second. Kept thin (3px) and low-contrast on purpose: the countdown should hold the eye.

- [2026-08-21] **The countdown is sized from the STEP'S LONGEST STRING, not the current one.** `--chars = clockWidth(clock(ceil(entry.durationMs / 1000)))`, so it is constant for the whole step. Sizing from the live value made a 90s step jump ~75% larger crossing 1:00 -> 59. Accepted trade: a step over a minute renders smaller throughout (137px vs 239px on a phone) — stability beats peak size, and the long steps are the ones you are not staring at. (`bug-017`)
- [2026-08-21] **The stacked run layout uses FIXED proportions (56fr / 44fr), not `auto` + remainder.** With `auto`, the countdown block took what it needed and the image absorbed the rest — so any change in numeral size visibly squashed the picture. Consequence: `--clock-height` is 34cqh stacked (not 40), because the countdown only has 56% of the body while cqh still measures the whole body. Re-verify the count block fits its row if either number changes; 342x380 is the tightest case checked. (`bug-017`)

- [2026-08-21] **Wayne's exercise images are near-square (876x800, ~460KB).** That matters for layout: `object-fit: contain` fits the SMALLER axis, so a short wide frame wastes its width and renders the picture tiny. When choosing the panel's share of the screen, its ASPECT RATIO matters more than its area.
- [2026-08-21] **Three stacked-layout tiers by viewport height**, handing space to the image as the screen gets shorter: default 56/44 with `--clock-height: 34cqh`; `<=700px` 50/50 with 28cqh; `<=540px` 46/54 with 22cqh plus lower name/label floors (at that height the FLOORS, not the countdown, crowd the row). Declared BEFORE the `@container shell` wide block, because the two-column layout overrides both rows and `--clock-height` and must keep winning. Verified the count block fits down to a 430px viewport; 400px clips by a pixel and is below any real device. (`bug-018`)
- [2026-08-21] **A container cannot query its own size** — `.run__body` sets its own rows, so short-screen tiers have to be viewport `@media` queries, not `@container body` ones.

- [2026-08-21] **`object-fit: contain` does NOT stop an image overflowing — it only constrains the picture inside the element's box.** If the box itself is too big, the picture is clipped and contain never letterboxes. `.panel__frame img` had `height: 100%` resolving to AUTO as a grid item, so the box took the natural aspect at full width and the bottom was cut off. Fix: `position: absolute; inset: 0` inside a `position: relative` frame, which takes the box from the containing block and is immune to percentage-height resolution. **I asserted twice that "contain means it cannot overflow" and was wrong both times** — check the BOX, not just the fit property. (`bug-019`)
- [2026-08-21] **When a visual bug resists explanation, ask for a screenshot early.** Two turns were spent theorising about this one from CSS alone; the screenshot identified it immediately (natural aspect, full width, clipped at the bottom = the box is too tall, not the picture).

- [2026-08-21] **A new routine opens on a template, not an empty list:** 30s prepare, a `Round` repeat x3 of [20s work, 10s rest], then another 30s prepare — 8 steps, 2:30. That mirrors how Wayne's own routines are built (a prepare before each exercise), so adding the next exercise means adding a round after the trailing prepare. Asserted in `blocks.test.ts` so the shape cannot drift; `App.blankRoutine()` is the source.
- [2026-08-21] **`newSegment` defaults match the real routines:** prepare 30s, work 20s, rest 10s, recover 60s. Chosen so an added step usually needs no editing. Don't "tidy" these to round numbers.
- [2026-08-21] **Wayne could not find how to save in the editor** — the icon-only tick was too subtle. The Save button now carries the word. Rule for this project: icon-only is fine for frequent transport controls, but a consequential, infrequent action gets a label.

- [2026-08-21] **`--phase` has a ROOT DEFAULT of `var(--role-rest)`; do not remove it.** `.btn--primary` uses it as a background, and an undefined custom property invalidates the whole declaration — which made the editor's Save button dark-on-dark and invisible. The run screen overrides it per step. Any custom property consumed outside the subtree that sets it needs a root default. (`bug-020`)
- [2026-08-21] **Shared classes now live in `theme.css`: `.label`, `.label--sm`, `.unit`, `.btn*`, `.chip*`.** They used to sit in whichever screen defined them first and worked only because the bundler concatenates all CSS — the same accident that caused `bug-012`. If a class is used by more than one screen, move it.
- [2026-08-21] **Library row actions are now: star, edit (pencil → opens the EDITOR), duplicate, delete.** Inline rename and the separate edit-steps button were both removed on request; the pencil does the editing and the editor names the routine. `rename` was deleted from `library.ts` and `useLibrary` as dead code along with its tests.
- [2026-08-21] **The editor guards unsaved work**: `isDirty(original, name, blocks)` in `src/editor/dirty.ts` compares FIELD BY FIELD, not by `JSON.stringify` — serialising depends on key insertion order, and patching an object reorders keys, which would report false changes. Back turns the header into an in-place "Discard your changes?" prompt (matching the delete pattern rather than adding a dialog), and a `beforeunload` handler covers reloads and closing the tab.

- [2026-08-21] **Editor undo/redo lives in `src/editor/history.ts`** — pure `History<T>` with `past/present/future/coalescing`, capped at 60 entries, 9 tests. The rule worth preserving: **a run of text edits COALESCES into one undo step** (the caller passes `coalesce`, so no timers are needed), and any discrete change — add, delete, reorder, change a step's type — ends the run and gets its own step. Undo also ends a run, so typing after an undo does not overwrite the restored state.
- [2026-08-21] **Name and steps share ONE history entry** (`Draft = { name, blocks }`), so undo restores a consistent draft rather than two states that can drift apart. Every editor mutation goes through `edit()` / `editBlocks()` — there is no `setBlocks` any more, and adding one would silently bypass undo.
- [2026-08-21] **Cmd/Ctrl+Z in the editor deliberately overrides native text-input undo.** The draft history already covers typing, so one stack for the whole editor is less surprising than two that disagree.
- [2026-08-21] **A new routine is: 30s prepare, Round x3 of [20s work, 10s rest], 30s prepare, 60s recover** — 9 steps, 3:30. `newRoutineBlocks()` is the single source of truth and its shape is asserted in tests.

- [2026-08-21] **Import `theme.css` before anything that pulls in a screen stylesheet.** CSS is emitted in module-import order and equal-specificity ties go to the later rule, so the base layer must precede the modifiers. `main.tsx` states this explicitly. (It was already effectively the order — this is insurance, not a fix.)
- [2026-08-21] **The delete confirmation is emphatically red**: red row border, a red-tinted row background, red routine name, red bold "Delete?", and a filled-red tick. `--role-work` throughout. Wayne asked for red when the rules were ALREADY red in the deployed CSS — most likely a stale service-worker cache on his device, so the styling was strengthened rather than merely re-applied.
- [2026-08-21] **Stale-cache check before diagnosing a "styling didn't apply" report:** fetch the live CSS from the deployed URL and grep the rule. Two turns were burnt theorising about cascade order when the live stylesheet already contained the correct declarations.

- [2026-08-21] **`duplicateAt` deep-copies with FRESH IDS all the way down.** The editor keys its rows by `block.id`, so a copy that kept them would give two rows the same React key. Any future "copy a block" operation must do the same.
- [2026-08-21] **Editor row actions** — segment: move up, move down, repeat-this-step, duplicate, delete. Repeat: add step inside, move up, move down, ungroup, duplicate, delete. Duplicate always sits immediately before delete, and inserts the copy directly after the original so repeated duplication stacks.

- [2026-08-21] **The editor's image field is a URL input PLUS a "Choose" picker.** `collectImages(workouts)` in `src/editor/images.ts` gathers every distinct `remote` image across the library, labelling each with the step name it appears under MOST OFTEN (ties broken alphabetically so the order is stable) — a picker showing "Leg Press" is useful where a list of postimages ids is not. Wayne's three routines yield 13 distinct images, several used 9 times, which is exactly why reuse beats re-pasting.
- [2026-08-21] **Both overlays are native `<dialog>` + `showModal()`** — the lightbox and the image picker. Escape, focus trapping and the backdrop come from the browser. A click whose `event.target` IS the dialog element is a backdrop click; children never match. `::backdrop` uses a literal colour, since inheriting a custom property into it is not dependable.
- [2026-08-21] **Editor thumbnails are 44px and are BUTTONS that open the full-size lightbox** — briefly enlarged to 66px, then reverted on request. Their `<img>` uses `max-width/max-height: 100%` in the lightbox rather than `100%`, so a small image is shown at its own size instead of being upscaled into a blur.
- [2026-08-21] **A `<label>` must not wrap a button** — the label forwards the button's click to its input. The editor's image row is a `<div>` with the input naming itself via `aria-label` for exactly this reason.

- [2026-08-21] **The master list of exercise images is a vault note: `Fitness. Workouts.md`** (in `/Users/wayned/Library/CloudStorage/OneDrive-Personal/Notes`). 29 postimages URLs under an "Image links:" heading, grouped by blank lines (one group per machine, unnamed). Mirrored into `src/routines/imageCatalogue.ts` in the note's own order. If Wayne adds images to the note, regenerate that file. All 29 verified to resolve on 2026-08-21 — one returned a transient `000` from curl and was fine on retry, so re-check before concluding a link is dead.
- [2026-08-21] **The catalogue stores URLs ONLY; labels come from `labelFromUrl()`** (filename, minus extension, separators to spaces). Nothing to keep in sync. A catalogue image keeps its filename label even when a routine uses it under a different step name — "Cycling" describes the picture better than the step name "Warm Up" does. Non-catalogue images fall back to their most common step name.
- [2026-08-21] **`moveStep` moves a row through the routine as it READS, crossing round boundaries** — into an adjacent round (first child going down, last going up), swapping with an adjacent step, or stepping out of a round when at its edge. Rounds themselves only swap, never nest. Up/down are disabled only when `first`/`last` AND `depth === 0`, because a nested step at an edge can always step outside. An emptied round is deliberately LEFT in place; a group vanishing under you is worse than an empty one you can delete.

- [2026-08-21] **Pull down on the home screen updates the app.** `usePullToRefresh` + `updateApp()`. What it drops and keeps is the whole point: it deletes only caches whose name contains `precache` (the app shell), and **never touches IndexedDB** — that is the only copy of anything authored in the editor. The `exercise-images` runtime cache is kept too, so an update does not re-download every illustration.
- [2026-08-21] **Touch listeners for a pull gesture must be attached natively with `{ passive: false }`.** React registers `touchmove` as passive, so `preventDefault()` in an `onTouchMove` prop is ignored and the browser scrolls underneath the gesture. The gesture also only starts at `scrollTop === 0`, so it cannot hijack a scroll back up a long list.
- [2026-08-21] **CSS cannot divide one length by another.** `calc(var(--pull) / 60px)` is invalid, so an opacity driven by a pixel distance needs the distance passed in UNITLESS and `* 1px` applied where a length is wanted. Cost one build-and-check cycle.
- [2026-08-21] **Run-screen keyboard control:** space or `k` = start/pause/resume, arrows = skip, `m` = mute. The handler lives in a ref with the listener registered ONCE — an effect with no dependency array re-attaches every render, and listing the dependencies re-attaches every tick. Keys are ignored when an input, button or select is focused.
- [2026-08-21] **The spoken "ten seconds left" cue is deliberately NOT part of the scheduled cue system.** Speech cannot be queued against the audio clock, so it fires from the timer tick and may land slightly late — acceptable for information, not for a beat. It lives in `src/audio/speech.ts` + `useSpokenCues.ts` so nobody mistakes it for a scheduled cue; keyed on step index so a pause or seek cannot repeat it, and only on steps of 20s or more.

- [2026-08-21] **The repo is documented: root `README.md` + one per source folder** (`engine`, `state`, `audio`, `editor`, `media`, `storage`, `routines`, `ui`). They record DECISIONS and traps rather than describing code. **Keep them current when a decision changes** — the `ui` one in particular is the canonical list of CSS traps this project has already paid for.
- [2026-08-21] **`.codex/` was removed on request** (OpenWolf's Codex hooks, config and prompts). `AGENTS.md` was deliberately kept — it is the cross-agent convention file, not Codex-specific.

- [2026-08-21] **Cue cancellation is per CUE, not per note.** Every oscillator is tagged with the moment its cue began; a cue that has begun is spared entirely, remaining notes included. The completion figure is 7 notes over 3.45s and fires at the same instant the workout completes, which re-runs the scheduler — per-note sparing fixed the bell and left the fanfare truncated in exactly the same way (`bug-021`). There is a 0.15s grace for tick-vs-audio-clock skew, and the scheduler DEDUPLICATES by `kind@atMs` so a spared cue cannot be re-queued and played twice. Do not remove the dedup without removing the grace.
- [2026-08-21] **The rolling window is audited end to end in `schedule.test.ts`**: every cue of all three real routines is scheduled exactly once and in order, nothing is missed even when arming at the full lookahead edge (a throttled tab), and arming every second never double-schedules. Also asserted: every cue kind has a tone, no two cues share a millisecond, and the minimum gap between cues in the real routines is >= 1000ms. Re-run this after any change to cues or scheduling.
- [2026-08-21] **Known acoustic limit, not a bug:** the phase-change bell rings 2050ms. Every step in the real routines is >= 10s so it always finishes first, but a step shorter than ~2s authored in the editor would have the bell still ringing under the next cue. Muddy, not broken.

- [2026-08-21] **Outcome reports are a dismissible modal (`NoticeDialog`), not an inline line.** "Saved 24 images" is worth reading once and then clearing; an inline notice just sits there afterwards. While the work is still running there is nothing to dismiss, so no close button is offered and Escape is swallowed via `onCancel` + `preventDefault` — it acts as a progress report until it has a result. The persistent library LOAD ERROR stays inline, because that is a condition rather than an event.

- [2026-08-21] **Both library toolbar controls are `Menu`s — "Sort" and "Routines".** Sort was briefly a native `<select>`, which was replaced because a select can only ever show its selected value, and the control needed to be *named*. The trade accepted: no native mobile picker, in exchange for a matching pair of controls and a tick showing the active sort. The button reads just "Sort", not "Sort: Recent" — say so if the current value should be visible on the button.

- [2026-08-21] **No trailing periods in UI messages** (requested for modals; applied to all short status text for consistency). Where a message needed two sentences it was rewritten as one phrase joined with an em dash — "That image could not be read — try a JPEG, PNG or WebP" — rather than keeping an internal period. Questions keep their question mark, and an ellipsis on a progress message stays.

- [2026-08-21] **`fitCqi` sizing: `FIT_BUDGET` (84) / `FIT_ADVANCE` (0.72), against `FIT_AVAILABLE` (92).** The maths is EXACT by construction — a word sized this way occupies precisely the budget — so all the safety is the gap between 84 and 92. The first version used 161 (100/0.62 with no padding allowance) and truncated every fallback name on a portrait iPad, where the panel is ~250px and fixed padding was a tenth of it. Padding is now proportional on both axes (`4cqh 4cqi`) so the available share is constant at any size. Tests assert the fit against a PESSIMISTIC 0.78em advance — asserting against the assumed advance would prove nothing. (`bug-022`)
- [2026-08-22] **The run screen's two-column layout is gated on SHAPE, not size** — `@container shell (min-width: 46rem)` with a nested `@media (orientation: landscape)`. Width alone put a portrait iPad (768–1024px) in the two-column layout, giving the media panel a ~250x773 slot that rendered near-square illustrations tiny, while an iPhone — same shape, smaller — stacked them correctly. An iPhone in landscape is wide AND landscape, so it still gets the columns. It has to be a viewport media query: `.run` is an `inline-size` container, so it cannot be queried on height or aspect-ratio; the shell is pinned to the viewport, so the two agree. Both blocks that define the column layout (`.run__body` columns and `.count__clock`'s column-specific coefficients) must carry the same gate, or the clock is sized for a column it is not in. (Supersedes the 2026-08-21 note about the portrait-iPad panel aspect.)

- [2026-08-21] **`CueKind` is `countdown | work-start | work-end | workout-complete`** — there is no single "phase change" any more. Every boundary is both an end and a start, so the cue is keyed on the step being ENTERED: entering work is `work-start` (a referee's whistle, play begins), entering anything else is `work-end` (a bell, the round is over). They mean opposite things mid-effort and must not sound alike. Wayne's spec: beep-beep-beep-whistle into work, beep-beep-beep-bell out of work, beep-beep-beep-ding-ding-ding at the end.
- [2026-08-21] **The audio engine supports `warble` (pitch LFO), `tremolo` (level LFO) and `noise` (band-passed breath)**, added while trying to synthesise a pea whistle. **SUPERSEDED for the whistle:** five synthesis attempts were abandoned and the app now plays the CC0 recording (`referee-whistle-cc0.wav`), which measurement proved IS the sound being matched. A failed decode falls back to a plain 2900Hz tone from the note's own envelope fields — there is no second synthesis engine, and `curve` support was removed with it. The LFO capabilities remain available to other notes.
- [2026-08-21] **Undo coalescing is keyed on the FIELD, never on a boolean** (`history.push(history, next, typing)`). A shared "this was text" flag merged unrelated edits and absorbed any non-typing action that rode the same path — see bug-034. When adding a patch route in the editor, ask whether the control fires per keystroke: if it does not (a select, a picker, an upload, anything committed on blur), it is discrete and passes null.
- [2026-08-21] **A blur-committed field must compare against stored state before writing**, or focusing it is itself an edit: it leaves an undo step that undoes nothing and marks the draft touched. Same review question for any "empty means clear" control — the editor's image box is always empty for an UPLOADED photo, so an empty box could only be allowed to clear a remote link (bug-035).
- [2026-08-21] **`height: 100%` lies under `viewport-fit=cover`.** On an iOS home-screen install a percentage height resolves against the SAFE viewport while the page paints the full screen, so the layout ends ~59pt short at the bottom. `#root` uses `100dvh` with `100%` as a fallback line (bug-038). Measure a screenshot before theorising: the band below the controls was exactly the top inset.
- [2026-08-21] **A height-derived font size still needs a width cap** when the element shares a row with em-sized columns: growing the type shrinks its own column. That is bug-039, where the list's rows hit their ceiling and `overflow-wrap: anywhere` shattered "Speed Skaters" into "Spe/ed/Ska/ters" — but only in groups with a per-side row, since that column is otherwise empty. If `overflow-wrap: anywhere` ever fires in normal use, the sizing above it is wrong.
- [2026-08-21] **A cqh type budget belongs to the box it lives in.** The countdown was sized as a fraction of `.run__body` (which includes the media panel) and had to stay "well under the row's share" — it was a few points from overflow and the header's inset tipped it into the step name. `.count` is now its own `size` container. If a size has to be tuned against a sibling's share, the container is in the wrong place.
- [2026-08-21] **Every screen owes a safe-area inset** (`--safe-top/right/bottom/left` in theme.css). The app is `viewport-fit=cover` with a translucent status bar, so a home-screen install paints under the island — and iOS eats touches up there, so a control in that strip is unreachable, not just clipped (bug-037). Inset the BAND that holds controls (header, container padding, bottom bar), never a wrapper, or the phase wash stops short of the edge. And check the `@container (min-width: 46rem)` override: a bare padding there cancels the inset exactly where it is still needed, an iPhone in landscape.
- [2026-08-21] **A keyboard guard must name the keys, not the tag** (`shortcutApplies` in `src/ui/keys.ts`). Ignoring every key while a `<button>` has focus disabled the run screen's arrows for anyone who started the routine with the mouse — clicking leaves the control focused, so every later keydown targets it. A button consumes only Space and Enter; fields and selects consume everything; the arrows are always the screen's. bug-036.
- [2026-08-21] **User correction: a clear button belongs beside the THING, not only inside the field.** An × inside the image link box was the only way to remove a picture — and for a picked or uploaded image that box is empty, so the × sat in an empty field where nobody looks. Now: the in-field × clears the text only (shown only when there is text), and a second × sits beside the thumbnail for the image itself. General rule for this app: put the remove control where the user is looking when they decide to remove it.
- [2026-08-21] **Within one row, an icon means one thing.** The editor row's trash can deletes the whole step, so "remove image" uses a × rather than a second trash, however common the trash-for-image idiom is elsewhere.
- [2026-08-21] **There is no image-link field any more.** An image comes from the bundled catalogue (Choose) or from the device (Upload). `remote` survives in `MediaRef` only as a legacy read path — do not add a UI that creates one. A `.tabata` import is rewritten to bundled paths by `migrateWorkout`, which `importFiles.ts` now applies; every entry point migrates.
- [2026-08-21] **An uploaded photo travels only inside an export file** (`storage/bundleMedia.ts`): `media` holds LOCAL hashes as data URLs, never bundled paths (the other side has those) and never a pinned copy of a link (a cache, not the original). On import every entry is re-hashed and checked against its key — content-addressed storage means a lying key poisons every routine sharing that hash — and a bad entry is skipped and counted, never thrown. A share link cannot carry one; its title says so rather than dropping it silently.
- [2026-08-21] **The exercise illustrations are BUNDLED, not hosted elsewhere.** `IMAGE_CATALOGUE` holds paths under `public/exercises/`; `resolvePlan` applies `BASE_URL` at render time and the ref stays base-less, which is what lets one routine work on a root domain, a subpath host, and an export opened on another device. Regenerate with `python3 scripts/exercise_plates.py <guide.pdf>` — never re-screenshot by hand. Anchor the crop on the GREY strip, not the coloured title band: the band's colour codes the muscle group (yellow upper body, green torso, blue lower body) and anchoring on yellow silently produced a plate with the Horizon logo in it.
- [2026-08-21] **Postimages blocks automated uploads** ("Please use the official API", 403) and the API needs an account key. Do not drive a browser to do it anyway — that is evading the block, not complying with it. This is moot now that images ship with the app, but the same applies to any host: check for a sanctioned API first.
- [2026-08-21] **Changing where stored data POINTS needs a `storage/migrate.ts` entry, not just a code change.** Refs live in IndexedDB on three devices and in old exports; migrate-on-read fixes all of them at once. And when writing one, check the walk actually recurses into every group kind — it only handled repeats, which would have skipped every section-based pasted routine.
- [2026-08-21] **Only the COUNTDOWN layout has a media panel**, so a step drawn as a row of its section's list can never show its image — which is why the editor hides the image controls for those (`shownAsList` in `editor/blocks.ts`, mirroring `listMode` in `engine/navigate.ts`). The display mode is owned by the nearest enclosing SECTION, never by the immediate group: a ladder or reps group outside a section always runs as the countdown, and a TIMED step inside a list section does too. When hiding a control that edits stored data, keep it visible where the data already exists, or the value is trapped with no way to remove it.
- [2026-08-21] **A nested `<dialog>` inside another one is a trap in React.** The `close` event reaches React's handlers on the way up, so a `NoticeDialog` rendered inside `PasteDialog`'s `<dialog>` fires the outer `onClose` too and cancels the whole paste when the notice is dismissed. Render it as a SIBLING in a fragment; opened second, it still sits above in the top layer.
- [2026-08-21] **Help is a right-edge tray of native `<details>`, and its text is DATA in `ui/help.ts`.** Not a page (help that replaces the screen makes you memorise the answer first), not a hand-rolled accordion (`<details>` gets found by in-page search when closed, and needs no state, keyboard code or aria contract). Every bullet must describe something the app actually does. The paste dialog is the exception: its help is `Copy template`, an example routine, because a parser reading a human's handout is described honestly by a handout it accepts — and `routines/__tests__/pasteTemplate.test.ts` keeps that example parseable.
- [2026-08-21] **`position: fixed; inset: 0 0 0 auto` is how to pin a modal dialog to an edge.** Do not rely on `margin`/`align-self`: a dialog is a child of whichever screen opened it, and both screens are full-height grids — see the three defences on `.notice`.
- [2026-08-21] **There are TWO clocks, and they answer different questions.** The run clock (`clock.current`) is re-anchored at every gate and every skip, so it can only speak for the current step; the session clock (`session.current`, surfaced as `timer.sessionMs`) is wall time over the whole workout and is deliberately untouched by `moveTo`. Do not "fix" them disagreeing after a skip — one is a position in the routine, the other is time spent. A gated routine has no total length, so the session clock is the ONLY time it can report, which is why the run screen's stopwatch lives in the header rather than in `count__meta` (the list layout has no meta row).
- [2026-08-21] **A cue is BUILT when it is scheduled, up to 30 seconds before it sounds** — `playNote` picks the recording or the synthesised fallback at that moment and creates the node there and then. So any scheduling INPUT that can change late must announce itself and force a re-arm; a decode finishing changes nothing on its own. This is what made the first whistle of every cold start the plain 2900Hz tone (bug-033): `unlock()` fires the fetch, the first `arm()` runs in the same tick, and dedup never revisits those cues. Fixed by downloading the bytes at module load (`samples.ts` — the fetch needs no AudioContext, only the decode does) plus `engine.onSampleDecoded()` → cancel, forget what `requeueable()` says was dropped, re-arm. Any re-arm that clears the dedup set must respect `CANCEL_GRACE_MS`, the same line `cancelPending()` draws, or a cue that has begun is queued a second time and plays twice.
- [2026-08-21] **The decode is deliberately NOT done eagerly via an `OfflineAudioContext`**, though it would remove the race entirely. Either that context is built at the file's own 22.05kHz and the playback resampler makes up the difference on a whistle that took five attempts to get right, or the real `AudioContext` is created outside a gesture to learn the hardware rate — and gesture-to-audio on iOS is the one path that cannot be checked from a desktop browser. Not worth a few milliseconds of decode.
- [2026-08-21] **There is a sound bench at Routines → Sounds** (`SoundsScreen`), **under `npm run dev` only** — `App.tsx` loads it through a dynamic import inside an `import.meta.env.DEV` branch so Vite drops it, and its CSS, from a production build. Each cue offers the FULL figure (timing is most of how a cue reads) and the terminal sound alone, with **the parameters printed beside it** so a change can be requested in the terms it will be made in — "warble slower", "whistle shorter" — rather than by description. Use it when iterating on any cue.

- [2026-08-22] **Speech is gesture-gated too, not just the AudioContext.** iOS drops a page's first utterance unless `speak()` runs inside the gesture, and the opening line comes from an effect plus a timeout — so it was silent on the first start after opening the app (bug-042). `unlockSpeech()` is called from `withAudio`, beside `audio.unlock()`. General rule: prime from the gesture itself, never from what the gesture eventually causes.
- [2026-08-21] **Never style a `<dialog>` as the panel.** The dialog is the SHEET — transparent, viewport-filling, safe-area padded, `place-items: center`, `overscroll-behavior: contain` — and the box goes in a child div (`.modal` + `.notice` / `.paste` / `.picker` in this app). `height: fit-content` on a dialog does not hug on iOS: the box takes the height available and its auto grid rows stretch, which pins the title to the top and draws the buttons as slabs (bug-041). Corollary: when a layout needs a third round of number-tuning, the structure is wrong.
- [2026-08-21] **`crypto.randomUUID` and `crypto.subtle` are secure-context only** — undefined on the plain-HTTP LAN origin used to test on a phone. Ids now go through `newId()` in `src/id.ts` (bug-040); image hashing still uses `crypto.subtle`, so photo UPLOADS cannot be tested over plain HTTP. Never call `crypto.randomUUID()` directly again.
- [2026-08-21] **A screenshot from an installed PWA may predate the fix.** It keeps its assets until properly relaunched, `skipWaiting` or not. This bit within an hour of the badge existing: a reported home-screen gap had already been fixed by the `dvh` change, and the instinct was to trim padding around a gap that was no longer there. Check the badge before diagnosing anything from a device screenshot.
- [2026-08-21] **Bump `src/version.ts` on every build meant for testing on the phone.** The home screen shows it beside the help button, with the build date stamped by `vite.config.ts` as a backstop. An installed PWA is served by a service worker, so without the badge "did my change reach the device" is unanswerable and you end up debugging a layout that was fixed two deploys ago.

- [2026-08-23] **Never call `navigator.clipboard.read()` to find out what is on the clipboard, unless `navigator.permissions.query({name: 'clipboard-read'})` already says `granted`.** Reading is a privacy operation and the gates differ per browser: Chromium answers silently once granted; Safari and Firefox refuse outside user activation and Safari puts up its own native Paste confirmation. A speculative probe therefore shows a system prompt for a question the user never asked. `media/clipboard.ts` returns a four-valued `ClipboardImage` (`image` / `none` / `unknown` / `unsupported`) for exactly this reason — "there is no image" and "we are not allowed to look" must not collapse into one boolean, because only the first should disable a control. Querying an unknown descriptor name THROWS rather than reporting `denied`, which is how non-Chromium browsers end up on the `unknown` path.
- [2026-08-23] **`navigator.clipboard` is undefined on an insecure origin**, like `crypto.randomUUID` (bug-040) and `crypto.subtle`. So the LAN plain-HTTP dev server cannot test paste OR upload — both need the deployed HTTPS build. Third member of the same family; assume any `crypto`/`clipboard` API is secure-context only until proven otherwise.

- [2026-08-24] **The dev server is on 35173, the preview server on 35174, both `strictPort: true`** (`vite.config.ts` `server` / `preview`). Vite's default 5173 belongs to another local project (sft-hire) and whichever started second drifted silently to 5174, so no URL was dependable. `strictPort` is the point of the change as much as the number is: a clash must fail loudly rather than move. Use `http://localhost:35173` for anything that hands the user a dev URL, and do not reintroduce 5173 in docs or scripts.

## Batch edits: imports in this repo span lines (2026-08-29)

Several files open with a multi-line `import type {\n ... } from`. A script that finds "the last import
line" with `^import .*\n` lands INSIDE that statement and breaks the file (compile.ts, 2026-08-29, seen
as a Vite overlay). Match whole import statements (through `from '...'`), or use the Edit tool with an
explicit anchor. Also: `{ source: 'bundled', path }` (shorthand) exists alongside `path: x`; `bundled()`
in media/resolve.ts is now the only way to write one.

## Two counters on the timer: generation and seeks (2026-08-29)

`Timer.generation` bumps on EVERY clock mutation including pause and resume; `Timer.seeks` bumps only
in `moveTo`. The cue scheduler clears its played-key set on `seeks`, never on `generation`: clearing
on pause re-queues a spared cue (double beep), not clearing on a seek silences the whistle of the step
skipped back to. If a new "position moved" consumer appears, use `seeks`.

## Fields that commit on blur say so (2026-08-29)

The editor's global Cmd+Z leaves a field alone while it holds uncommitted text. Those fields (note,
alternative, weight in `rows.tsx`) carry `data-commits="blur"`; LoadField also `data-committed` since
it is controlled. Do not detect "uncommitted" by `value !== defaultValue`: React does not sync
defaultValue on a focused number input, which swallowed Cmd+Z after typing a count. A new
blur-committed field needs the attribute or undo will stomp it.

## foldName is a storage key, and it is not idempotent (2026-08-29)

Three localStorage tables (weights, paces, pictures) are keyed by `foldName(name)`. Any change to the
fold silently re-keys all three, and folding an already-folded key gives something else again
(`leg pres` folds to `leg pre`), so a migration cannot just re-fold. `storage/refold.ts` is the
pattern: derive the affected vocabulary from EXERCISES and move stale keys on first read, current keys
winning. Add a case there for any future fold change rather than a new migration.

## A pick writes no picture (2026-08-29)

`applyExercise` used to stamp the guide's bundled illustration onto a picked step; that made the
picked steps the only ones deaf to the Exercises page (fill only covers steps with no media). Now a
pick writes the name and the per-side flag only, removes a bundled picture already there, keeps an
uploaded one, and the picker's thumbnails come from `currentPictures()` through `ExerciseOption.picture`
(a `MediaRef`, resolved by `useMediaUrl` in `ExerciseField`'s `Thumb`). Same deferred model as the
weight. Do not reintroduce a `media` path on `ExerciseChoice`/`ExerciseOption`.

## Running /code-review on a large range (2026-08-29)

The skill forks a reviewer that spawns finder agents, then verifier agents, and each time it yields to wait on them
its task ends; the finders' idle notices and result messages route to the MAIN session, and reach the reviewer one at
a time only when something resumes it. Twice it sat stalled after all children had finished. What worked: the finder
and verifier transcripts are on disk at
`~/.claude/projects/-Users-wayned-Projects-exercise-timer/<session>/subagents/agent-afinder-*.jsonl` and
`agent-averify-*.jsonl`; pull the last JSON array out of each into one scratchpad file and SendMessage the reviewer
the path with "do not wait for further deliveries". Also the ten-finding cap cuts confirmed lows and every cleanup;
the verifier verdicts (with the assignment prompt that names each candidate) are the complete list, so build the
report from those, not only from the reviewer's final ten. Review reports go in the scratchpad as .md, no Artifact.

## Reading a test run (2026-08-29)

- **`Tests 1161 passed` is not a green run.** vitest reports unhandled errors on a separate `Errors` line and still
  exits non-zero. Grepping the output for `Tests |FAIL` hid a failure that CI then caught. Read the TAIL of the run,
  or check `$?`.
- **`resolveMedia` can reject, not just resolve null.** `openDb` throws where site data is blocked: a private
  window, a browser refusing storage, and every jsdom test without a fake IndexedDB. Every caller needs a catch;
  the row then shows no picture, which is what it shows for a photo left on another device anyway.

## Sourcing pictures for the app (2026-08-29)

**OUTCOME FIRST: the free line art was rejected and removed.** "These images are not good enough." The app's own
plates are photographs of Wayne's actual machine, and a generic line drawing beside them reads as filler. Do not
offer a free illustration library for this app again without asking first. The lessons below still hold for any
other sourcing job.

- **A repo's LICENSE does not launder someone else's copyright.** `free-exercise-db` is Unlicense and its images are
  bodybuilding.com's photographs. Check what the images ARE, not what the repo says.
- **Wikimedia Commons is the dependable source**, because the licence is per FILE and machine-readable
  (`extmetadata.LicenseShortName`), and its thumbnail API rasterises SVG for you at any width, which removes the need
  for a local renderer.
- **Fetch bigger than you need, and never upscale.** The first batch was fetched at the target width, cropped to the
  subject, then stretched back: soft, and Wayne noticed immediately. Fetch at 1600, cap at 640, resize DOWN only.
- **Line art wants LOSSLESS WebP.** Lossy rings along every edge and, on flat white with hard black lines, comes out
  BIGGER than lossless anyway.
- **A picture of a different exercise is worse than no picture** (Wayne, reversing his own earlier call once he saw
  it): the empty frame asks a question, the wrong picture answers it wrongly. A variant of the same movement is
  fine; a parent exercise standing in for its family is not.
- **Check a contact sheet before shipping a batch.** Everkinetic's two frames per exercise follow no fixed
  convention — the squat's second frame is the squat, the lunge's first is the lunge — and one image read of a grid
  settles thirty decisions.

## The exercises page: pictures beside weights (2026-08-28)

- **The weights page became the EXERCISES page.** All 147 are listed, not the 68 loadable ones, because the 79
  bodyweight/trampoline/bike exercises had nowhere to keep a picture. The weight field is simply absent on a row with
  nothing to weigh; the row keeps the column so the names line up.
- **A picture resolves like a weight: deferred, never written back.** `fillPictures`/`withPictures` in `loads.ts` sit
  beside `fillLoads`/`withWeights`, applied in `App` on the way into a run and in the editor's preview. A step that
  carries `media` overrides, exactly as a stated `load` does.
- **`currentPictures()` starts from the guide.** The stored table only holds what it ADDS, so a routine typed by hand
  still shows the machine it names, and clearing a chosen photo falls back to the illustration.
- **A localStorage table holding blobs needs a GC root.** `liveHashes`/`orphanedHashes` take an `alsoLive` list and
  `useLibrary` passes `pictureHashes(loadPictures())`; without it the first delete of any routine collects a photo only
  the page holds. Any future table that references blobs needs the same.
- **147 rows × `useMediaUrl` is 147 state updates, each re-rendering 147 rows.** The page resolves every image ONCE
  (a sync pass for bundled paths, one effect for blobs) and hands rows a plain `src`. Building a `MediaRef` inline per
  render was worse still: a new object per render re-armed every effect and the page span. Memoise refs.
- **`<label htmlFor>` pointing at nothing is slow as well as invalid.** jsdom resolves a label by walking the
  document, so 79 dangling labels turned one `getByLabelText` into 2.9 seconds. Label only what has a field.
- **A whole-library backup carries the whole table; a single routine's carries only what it uses** (`picturesFor`).
  One is a restore, the other is something you send. The weights ride whole either way; they are strings.

## The exercise name field, and reading a draft (2026-08-28)

- **The editor and the generator now pick from ONE table.** `routines/exerciseOptions.ts` is a view of `EXERCISES`,
  never a second list, and the editor's name field is a text box that GROWS a suggestion list. It cannot be a select:
  "Warm Up" and "Cool Down" are in Wayne's own library and in no table, and two more names there are his wording for
  exercises that are.
- **`foldName` is for a NAME, not for a half-typed query.** It drops a trailing limb, so `foldName('leg')` is `''`.
  Anything that folds user input as it arrives must handle "folded to nothing" as "keep the letters", not as "nothing
  typed". See `needleOf`, and bug-117.
- **A picked exercise is applied in one tree operation** (`applyExercise`), never as three patches. Three would be
  three undo steps, and the middle one a step named for the new exercise wearing the old one's photo. Whatever a
  future pick learns to carry, add it there.
- **`Menu`'s `place()` is the shared popover arithmetic.** The suggestion list portals to the body and calls it, for
  the same two reasons `Menu` does: `.editor__scroll` clips its overflow, and `position: fixed` is only
  viewport-relative while no ancestor is transformed. Do not write a third copy.
- **Previewing a DRAFT has to be a mode of the editor.** Navigating to the run screen and back would either lose the
  unsaved draft or hand it back as the editor's new baseline, which leaves a never-saved routine looking clean.
  `PreviewList` simply replaces the row list in the same grid row.
- **`.editor` names its container `shell`.** `preview.css` asks for `@container shell` by name, so the shared preview
  only gets its wide-screen column inside a container called that. An unnamed `@container` query still matches the
  nearest container whatever it is called, so the editor's own queries were unaffected.
- **The name field's list always filters on what the field SAYS** (Wayne, reversing my first call): the caret beside
  a filled row opens on that exercise, matched, highlighted and ticked. Browsing the whole table is what an EMPTY
  field gets, and what a name the table does not hold falls back to, so the caret can never open onto nothing. The
  tick (`aria-current`) is the step's exercise; the highlight (`data-active`, `aria-selected`) is the arrow keys'
  cursor. They coincide on opening and part company on the first keystroke.
- **A portalled popover must not use the `.label` classes or any `cqi` size.** The type scale is written in container
  units; on the body there is no container, so they fall back to the VIEWPORT and a dropdown comes out set in the
  screen's display scale. Write rem sizes inside a portal. See bug-119.
- **A close-on-scroll listener on the capture phase sees its own list scrolling.** Scroll events do not bubble, which
  is why the listener is on capture in the first place, so it must skip a target inside the popover or the list closes
  the moment you drag it. `Menu` has the same code and never showed it: seven items never scroll. See bug-120.
- **Place a popover from `scrollHeight`, not from its measured box**, once a previous placement has applied a
  `max-height`: the box is then that height, and the side it opens on would depend on which placement ran first.
- **jsdom has no layout, so no `scrollIntoView`.** An effect that calls it unconditionally throws and React tears the
  subtree down, which reads as "the component never renders". Feature-test it. See bug-116.
- **An accessible name computed from adjacent grid spans runs the words together.** "Glute KickbackStation 7". A
  whitespace text node would be an anonymous grid item and would shift the columns, so set an explicit `aria-label`
  instead. See bug-118.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

- [2026-08-22] **One row per step on a phone: considered, declined.** A phone step row has ~313pt. The fixed controls come to 370pt before the name field gets a pixel — role select 136 (`min-width: 8.5rem`, sized for "Get ready"), seconds 72, unit 88, ⋯ 42, four gaps 32. So a single row is only reachable by moving the role select into the ⋯ panel (the one control the coloured left border already carries, and which the coloured add buttons already set at creation), plus trimming the unit and seconds boxes — which buys the name back to ~127pt, about 15 characters. **User chose the two-line row instead**: the name keeps ~169pt, which is what you actually read when scanning a 69-step routine, and the role stays directly editable. Do not re-propose the one-row layout without a reason that beats the name field's width.
- [2026-08-22] **A dismiss predicate scopes to the OVERLAY, never to its container.** Scoping the editor row's panel to the whole `<li>` meant pressing the step's own name field did not close it. And the trigger must count as inside, or `pointerdown` closes and the following `click` toggles it back open — it never appears to close at all.

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

- [2026-08-20] **Web PWA over native iOS / React Native.** Fast iteration, installs to home screen without an App Store, one codebase covers phone + iPad + laptop. Cost: no reliable screen-locked operation.
- [2026-08-20] **Recursive block tree (`segment | repeat{times, children}`) as the authoring model.** One primitive expresses classic Tabata, named circuits, pyramids and nested sets. Rejected a flat "rounds of segments" model — simpler, but cannot nest, and the user wants a full interval builder. Data model nests arbitrarily; editor UI capped at 2 levels initially.
- [2026-08-20] **Compile-to-flat-timeline, pure runtime.** `compile(workout)` produces `TimelineEntry[]` with absolute `startMs`/`endMs`; `position(timeline, elapsedMs)` is a pure binary search. Chosen over a stateful step-through machine because it makes skip/seek/rewind trivial and lets the whole engine be unit-tested with a fake clock, with zero DOM.
- [2026-08-20] **No backend, no sync.** localStorage + versioned schema + JSON export/import + URL-encoded share links to move workouts between devices. A server was judged unjustified for a single-user timer.
- [2026-08-20] **Steps can carry one optional static image; IndexedDB replaces localStorage because of it.** localStorage's ~5MB quota plus base64's 33% inflation cannot hold photos. Stores: `workouts` (JSON by id) + `media` (Blob keyed by sha256 content hash, so an image reused across segments/routines is stored once). Rejected GIF (can't canvas-downscale without losing animation; 5-10MB per clip) and video (needs a separate <video> path — deferred, but `MediaRef.mime` leaves room to add it without a migration).
- [2026-08-20] **All image input goes through one mandatory downscale pipeline:** decode → canvas resize to 1024px long edge → WebP q0.8 → ~100KB → hash → store. Storing original phone photos (3-5MB) would blow the quota inside one workout. Photo picker, camera, drag-drop and clipboard paste are all just Blobs into this one path.
- [2026-08-20] **Portability via export/import `.json` bundle (images inline as base64), AirDropped — still no backend.** Reconsidered when images landed, and held: a server would make a local-first single-user timer offline-breakable for no real gain. Consequence accepted: URL share links carry structure only and degrade to text-only segments.
- [2026-08-20] **Media is a 3-source discriminated union behind one `resolveMedia(ref)`**: `remote` (postimages URL, optional `cachedHash` for a pinned local copy), `bundled` (committed to `public/exercises/`, served same-origin), `local` (own photo → downscale → hash → IndexedDB). Rejected "repo-hosted images only": adding an image would need a git commit + push + deploy, which kills phone-side authoring; and offline still needs a local cache either way, so you don't escape local storage, you just lose control of eviction. Rejected "local only": remote/bundled refs export as short strings, which is what makes URL share links viable.
- [2026-08-20] **Hosting is intentionally undecided; made irrelevant instead.** All bundled asset paths go through `import.meta.env.BASE_URL` from phase 1 so root-domain and subpath hosts both work. GitHub Pages needs Pro for a private repo AND publishes a public site; Cloudflare Pages/Netlify/Vercel deploy private repos free from the root. Recommendation on record: Cloudflare Pages. Decide at phase 7.
- [2026-08-20] **Routine library is first-class — unbounded build/save/load.** Free from the id-keyed store; the work is a Library home screen (list/create/duplicate/rename/delete/load) plus `Workout` metadata (`createdAt`, `updatedAt`, `lastRunAt`, `favourite`, `estimatedTotalMs` denormalised at save so the list needn't compile every routine). Flat searchable list sorted by recently-run with favourites pinned — folders/tags deferred until a flat list actually hurts.
- [2026-08-20] **Build order: engine first (phase 1), UI second.** Correctness lives in the timeline compiler; getting it right and tested before any React removes the hardest class of bug from later phases.

## Preview mode (2026-08-28)

- **A preview is a reading of the COMPILED routine, never of the tree.** `compile()` already drops a group's trailing
  rest on the last iteration and resolves a ladder's rung counts, so reading the tree would show a rest that never
  plays. A test pins this: a two-round circuit stating a 45s rest shows that rest once.
- **Expanded, by Wayne's choice.** Round 3 of 8 prints as round 3 of 8. The collapsed reading already exists twice
  over (the editor tree, `writeRoutine`'s text), and the point of a preview is what the run will actually do.
- **It is a MODE of the run screen's idle state, not a screen of its own.** The header, the progress rule and the
  controls stay where they are, so Start is under your thumb the moment you finish reading, and there was no history,
  back-button or weights-filling wiring to repeat. A toggle that opens a panel must live OUTSIDE that panel, or
  opening it takes its own way out with it: the header's idle slot (empty until the stopwatch needs it) carries it.
- **This list is read in the hand.** Every other list in the app is sized to be read from where a phone is propped,
  and the run sheet grows its rows to fill the screen. A page of text set that way is four rows long. The preview
  holds a reading size and scrolls, which is the one place it deliberately parts company with the run screen.
- **`content-visibility: auto` with `contain-intrinsic-size`** on the rows: a long routine is a few hundred of them.
- **Library row tools read look → change → copy → send → destroy: Preview, Edit, Duplicate, Send, Delete.** Preview
  first because it is the only tool that changes nothing, and it and Edit are the two that OPEN the routine, so they
  sit together nearest the name. Delete stays last. A preview from the row must not stamp Last run: `markRun` is
  wired to `onStarted`, never to the run view opening.
- **Generator vs instructor (2026-08-28):** the shape of a section belongs to its THEME (`THEME_SHAPE` in
  generate.ts), never to its position. Finisher = ladder (14/16), Legs = ladder (6/7 since July), Core = rounds ending
  on a hold (every one since July), General Body = all-climb ladder, Arms = rounds. Ladder mains come from
  `PRESCRIPTIONS[].rung`; warm-up cardio from harvested `WARM_UP_MOVES` (phrase match on folded names, which are
  ragged). Her template routines estimate at 56–91 min: a 45-minute sections routine is 4–5 sections, not her 6.
- **`\bsit\b` matches "Sit-ups".** A hold pattern must say `wall sit` whole. Found when "Sit-ups with a Reach" came
  out as a 30-second hold.
- **When dumping a table for review, print the field you mean.** `reps ?? seconds` printed Bulgarian Split Squats as
  `time:5` and I reported a harvest bug that did not exist. Check a surprising data claim against the source row.
- **Draw across areas only where alternating is the point.** The warm-up's one upper-body cardio move (Front Punches)
  opened every routine because a turn went to each area; a mixed pool is proportional.
- **Short sections routines rotate which body theme is dropped (Wayne's pick, 2026-08-28).** Priority shuffled per
  seed with General Body protected, assembled in her canonical order. Not "drop the largest": that is always the
  Legs ladder, her signature. Not "in order": that is always Core.

## Session 2026-08-21 — terminology, verification, and what shipped

- **"Reps", always plural.** User correction: it is short for repetitions. The
  label is DATA (`newRepeat()` writes it), so renaming in code is not enough —
  `src/storage/migrate.ts` maps legacy labels on read at all three entry points
  (IndexedDB, bundle import, share link). Any future rename of a stored label
  needs the same treatment.
- **A rest belongs BETWEEN reps.** `compile()` drops a group's trailing `rest`
  child on the final iteration. This changed the length of every existing
  routine, so five tests that pinned the old behaviour were updated on purpose.
  To rest after the last rep, put a rest step after the group.
- **Do not tint the run screen.** Its green/red/blue mean get ready/work/rest.
  Routine colours are labels and stop at the library row and the editor.
- **Search results are not evidence.** A freesound search summary claiming CC0
  was confirmed against the `publicdomain/zero` link in the page markup before
  anything was shipped. Similarly, a keyword hit is not a match: the whistle was
  identified by 0.992 waveform cross-correlation, and the beep (0.740) and bell
  (0.147) were REJECTED on the same measure despite ranking well on keywords.
- **Verify before measuring.** A truncated download was briefly treated as a
  smaller image. Decode an image / check a file is complete before comparing
  sizes or hashes.
- **Do not restate an unverified claim as fact in a comment.** `imageCatalogue.ts`
  asserted two duplicate-named images were "genuinely different"; they were the
  same photograph, and the claim had never been checked.
- **CSS specificity ties are decided by source order.** A new `[data-colour]`
  tint rule tied with the existing `:hover` rule and silently killed hover on
  tinted rows. Prefer `:not()` to encode precedence over relying on ordering.
- **`scripts/.analysis/` must stay gitignored.** Full-rate amplitude+frequency of
  the Tabata whistle is enough to resynthesise it; committing it would undo the
  history purge done before the repo went public.

## Session 2026-08-21 — strength routines: the design, before any code

- **Most real routines are NOT timed.** Wayne's strength emails are rep-based with
  timed steps mixed in (a 45s rest inside a rounds section, a `30-second Plank`
  inside a rep list). The model must carry both AT THE STEP LEVEL, not per routine.
- **Timed runs separated by manual gates** is the framing that saves the engine.
  Inside a run, everything works as today — absolute timeline, `position()` binary
  search, pre-scheduled cues, a pocketed phone catching up. At a gate the clock
  parks until Next. Do NOT reach for "make the whole timeline relative"; that
  throws away the tested core and the drift immunity with it.
- **A ladder (`2-4-6-8-10-8-6-4-2`) is a PER-RUNG CIRCUIT.** Rung 2 = 2 reps of
  every exercise, then rung 4 = 4 of every exercise. Confirmed by Wayne. The
  emails' note — "complete the full count of one exercise before moving to the
  next" — reads naturally as "finish your SET before starting the next exercise",
  where "the full count" is that rung's count. **Do not restate that note as
  contradicting the circuit reading; it does not.** The lesson is about the
  flagging, not the routine: an ambiguous sentence was labelled a contradiction
  more confidently than its wording supported, which sent Wayne off to double-check
  something that did not need checking. Weigh how plausible each reading is before
  calling one of them a conflict.
- **Accessories run after the final rung too**, unlike the trailing-rest rule where
  a rest between reps is dropped at the end. Two similar-looking rules, opposite
  answers, both by explicit decision.
- **Next is a big button plus the spacebar, not tap-anywhere.** A stray touch
  skipping a set is worse than reaching for the phone.
- **Import is a paste box, not an `.eml` importer** — paste also covers WhatsApp
  and Notes, and the parse lands in the editor for review rather than being
  applied silently. Same principle as the `.tabata` importer refusing to infer reps.
- The full design, with the model sketch and the build order, is the current quest
  in `.wolf/STATUS.md`. Read it before starting.

- [2026-08-21] **`Run` is structurally a `Timeline`**, which is why adding gates
  cost `runtime.ts` and `cues.ts` exactly zero changes. Anything that reasons
  about crossing a run goes in `engine/navigate.ts`; anything inside one stays in
  `runtime.ts`. Do not blur that line.
- [2026-08-21] **An absent `durationMs` is self-paced; a present non-positive one
  is still dropped.** Not the same thing, and the test says so — otherwise a
  mistyped `0` silently becomes a step that waits forever for a tap.
- [2026-08-21] **Every non-segment block has `children`.** Tree walkers must
  recurse on `block.kind !== 'segment'`, never `=== 'repeat'`. The old form
  silently skipped the new group kinds, and in `media/gc.ts` that would have
  orphaned live images and deleted them. `isGroup()` in `engine/types.ts` exists
  for this.

- [2026-08-21] **A pasted routine goes to the LIBRARY, not the editor.** The
  editor has no row for a section or a ladder yet, so it would open on a blank
  screen. Review happens in the paste dialog, which lists every line the parser
  could not place. Revisit once the editor gains those rows.
- [2026-08-21] **In list mode the SECTION decides the display, not the step.** A
  45s rest inside a rep-based section stays a row in the list; flipping to a
  full-screen countdown for it and back would be disorienting.
- [2026-08-21] **Regex trap in `pasteFormat.ts`:** `DASH` is a complete character
  class, `DASH_CHARS` is the bare characters. Nesting the first inside another
  class silently gives `[\s[-–—]]`, which matches a literal bracket — it is what
  stopped "30-second Plank" being read as a duration.

- [2026-08-21] **`.btn` is an ICON square (56×56), `.chip` is the text button.**
  Putting a word in a `.btn` crams it into a square — it is what made the first
  paste dialog and Next button look wrong. Dialog actions, toolbar words and the
  run screen's Next are all chips; `chip--primary` / `--danger` / `--action` are
  the variants. Every icon component must go through the shared `Svg` wrapper in
  `icons.tsx`, which supplies `className="icon"` that the `.btn`/`.chip` sizing
  rules depend on.

- [2026-08-21] **Every group ITERATION is one gate: one Next clears every
  rep-based step in a round or a ladder rung.** `advance` is shared by `Repeat`
  and `Ladder` and defaults to `'set'`; an inner opt-out beats an outer default.
  A TIMED step inside the iteration keeps its own run, so a 45s rest and a 10s
  wall sit still count down — which is why a burnout containing a wall sit is two
  taps: the clock starts when you reach the hold, and the tap is what says you
  have. A SECTION's loose steps collapse too ("complete without stopping").
  `gateKey()` in `compile.ts` decides all of it. Real effect: the three real
  routines went from ~155 taps each to 37 / 35 / 38.
  **The pattern in Wayne's two corrections: he taps once per chunk of work, never
  per exercise.** Assume that shape for anything similar.

- [2026-08-21] **`listMode()` in `engine/navigate.ts` decides list vs countdown**,
  not the component. A TIMED step is always a countdown, wherever it falls — you
  watch the clock during a hold, you do not read a list — and so is a gate with
  nothing after it in its group, where every other row would be struck through.
  Consequence: the Next slab is needed in BOTH layouts, so it is a shared
  `NextSlab` component, not a child of the list.

- [2026-08-21] **Cues are armed ONE RUN at a time (`runCues`), not per routine.**
  `cues()` describes a whole workout, so feeding it a single run put the finishing
  dings at the end of every run and gave a gate one boundary cue per step, all
  stacked at time zero. A gate gets ONE cue — a whistle as it opens — and no
  countdown, having no end of its own. The finish is fired BY HAND when a routine
  ends on a gate (`finishesOnTap`), because a tap cannot be queued on the audio
  clock ahead of time.

- [2026-08-21] **Adding a block kind means updating every WHITELIST that
  validates one.** `bundle.ts`'s `isBlock` accepted only segment and repeat, so
  pasted routines exported perfectly and were silently filtered out on re-import
  — a backup that restores nothing. `shareLink.ts` has no such list. Grep for
  `kind ===` before shipping a new kind.
- [2026-08-21] **The editor's three levels are `section > round/ladder > step`.**
  Tree walks recurse on `isGroup`, never `kind === 'repeat'`. `setTiming` makes
  timed-or-counted exclusive and DELETES the other key, for the same
  `exactOptionalPropertyTypes` reason as `clearMedia`.

## Estimating a rep-based routine (v6.3, 2026-08-27)

- A self-paced step ends on a tap, so `totalDurationMs` is 0 for it. Anything
  showing a routine's length must add `estimate()` or it lies about counted work.
- The seconds-per-rep rates are HARVESTED, not invented: fourteen exercises the
  instructor writes both ways. Median 2.0s, range 1.0 to 6.0.
- `src/storage/paces.ts` measures the real thing from gate elapsed times.
  `MIN_GATE_MS = 4_000` exists to throw away DRY RUNS — tapping Next through a
  routine would otherwise teach it that a twelve-rep set takes half a second.
  Wayne asked for this explicitly.
- Timed steps inside a gate are subtracted from the elapsed, never charged to the
  counted exercise beside them.
- Three samples minimum before a measured rate is used; the median, not the mean.
- ONE formatter: `estimated()` / `estimatedValue()` in `format.ts`. A guess reads
  "about 35 min", never "about 35:20" — do not hand-roll the hedge at a call
  site. `estimatedValue` is for a stat whose LABEL carries the hedge.
- Wayne's ask was "show it in the generate dialog, editor, library AND run page".
  All four now use the same figure; adding a fifth surface means using it too.
- `currentRates()` caches; `savePaces()` drops the cache. The library calls
  `summary()` once per row.

## The weights settings page (v6.5, 2026-08-27)

- THE RULE: an empty `Segment.load` means "whatever I lift for this", NOT
  unloaded. It is resolved from `storage/weights.ts` at the boundary — run
  start (App.tsx), text export (LibraryScreen), editor placeholder — and never
  written back. A stated load always wins; it is a deliberate override.
- Anything new that DISPLAYS a routine's weights has to call
  `withWeights(workout, currentWeights())` or it will show blanks.
- `routines/loads.ts` owns the key: `exerciseKey()` strips a "Get ready:" prefix
  and folds. The generator must not bake a weight into an announcement NAME, or
  no settings change can ever reach it.
- The seeds are rounded UP to the nearest 5kg: a stack has holes, not a dial.
  Wayne's call, 2026-08-27.
- An empty typed value is STORED, not deleted. Deleting it would let the seed
  refill the field, and a seeded weight could never be cleared.
- Weights ride in the backup as an optional `weights` field — no BUNDLE_VERSION
  bump, since an older reader ignores what it does not know.
- Still open: routines saved before v6.5 carry their own loads and do not follow
  the page. See STATUS for the inverse button.

## The looked-up weights are estimates, and some are badly wrong (2026-08-27)

Wayne gave four real numbers off his machine: Standing Shoulder Press 10kg,
Seated Abdominal Crunch 20kg, Seated Leg Extension 15kg, Hip Abductor Leg Raise
20kg. The strengthlevel estimate for the shoulder press was 30kg — three times
the truth. A Horizon home stack is not a commercial machine. Where Wayne states
a weight it replaces the looked-up one outright, and the remaining eight seeds
in `SEED_WEIGHTS` are still unchecked; do not defend them if he corrects one.

## The weights page, completed (v6.8, 2026-08-27)

- `stripLoads()` in `routines/loads.ts` is the DESTRUCTIVE direction: it takes a
  stated weight off a step whose exercise the page can answer for. Behind a
  confirm, and it deletes the key rather than emptying it — an empty string
  would read as a stated weight.
- A step whose exercise has NO weight on the page keeps its own: the routine is
  the only record of it. Do not "simplify" that away.
- The editor's Weight field is the one CONTROLLED field among the three extras,
  because the × must change the display and commit in the same gesture. It is
  keyed on the committed value like its neighbours, so undo still remounts it.
  `onMouseDown={preventDefault}` on the × or blur commits the old text first.
- Each screen with a rule of its own gets its own HelpTray (`WEIGHTS_HELP`),
  not a section in `LIBRARY_HELP`.

## A routine's names are shorthand; the table's are the guide's (2026-08-28)

`foldName` alone is NOT enough to match a step to an exercise. Routine 2 says
"Seated Ab Crunch"; the table says "Seated Abdominal Crunch". Anything looking an
exercise up from a step name must go through `findLoad()` in `routines/loads.ts`,
which allows a shorter word to start a longer one. Do not call
`weights.get(exerciseKey(name))` directly — that was the bug.

## Wayne's routines are the weight authority (2026-08-28)

Audited routines 2 and 3 against the seeded weights: FIVE disagreed and the
routine was right every time. The looked-up numbers were high, sometimes by
3.5× (hamstring curl 35 vs a real 10). `SEED_WEIGHTS` is now fifteen numbers
read out of his routines plus three he gave; only Triceps Press is still a
guess, and the Cable Fly guess was removed rather than corrected. If a weight
question comes up again, read his routines before reaching for a website.

"Low Pulley Squat" was in routine 2 at 25kg and missing from the table because
the guide does not illustrate it. Added to `exercises.other.ts` (v7.2), which is
therefore no longer "what the multi-gym cannot do" but "what the guide does not
DRAW" — a machine exercise can live there, and the kit invariant in
`exercises.test.ts` was widened to say so. Rigged like the Deadlift: station 5,
low row bar.

Every looked-up weight is now gone. Wayne corrected the last one (triceps press
20 → 15) without ever having loaded it in a routine, which is the final word on
what strengthlevel was worth here: every single estimate was high.

## Renaming steps to the table's names (v7.3, 2026-08-28)

`routines/rename.ts` — `canonicalName()` / `tidyLibrary()`, behind Routines ›
Tidy n exercise names.

- A step name is NOT just an exercise: "Get ready: 12 × Seated Ab Crunch 15kg
  (bodyweight)" is five things. `split()` peels the lead (announcement, count)
  and the trail (weight, bracketed note, dashed qualifier) and puts them back
  untouched. Never widen the rename to swallow those — the bracketed note is
  often the only record of the easier option.
- It uses the SAME two passes as `findLoad` (exact fold, then word-prefix) on
  purpose: a step the weights page can answer for is exactly a step this can
  rename. Keep them in step.
- `ALIASES` holds bare names with one obvious owner — only 'chest pres' →
  'Standard Chest Press' (Wayne confirmed). "Shoulder Press" is deliberately
  NOT aliased: a dumbbell exercise already owns that exact name.
- Audited against his library first: 10 steps across 4 routines, nothing
  meaningful lost. Always preview a bulk edit against the real backups in
  ~/Downloads before shipping it.
