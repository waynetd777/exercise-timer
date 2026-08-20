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
