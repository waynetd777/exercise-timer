# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-08-21T18:55:52.997Z
> Files: 21 tracked | Anatomy hits: 0 | Misses: 0

> Project structure index. Auto-maintained by OpenWolf hooks and daemon.
> Run `openwolf scan` to generate, or wait for the first Claude Code session.
> Status: Pending initial scan

## ./

- `AGENTS.md` — OpenWolf (~75 tok)
- `CLAUDE.md` — OpenWolf (~34 tok)

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

- `exercise_plates.py` — page_text, exercise_names, slug, plate (~1651 tok)

## src/editor/

- `images.ts` — An image a step can be given, whether it ships with the app or a routine (~1416 tok)

## src/routines/

- `imageCatalogue.ts` — Exercise illustrations available to every routine. (~1025 tok)
- `pasteTemplate.ts` — A routine written in every part of the grammar the paste parser understands, (~569 tok)

## src/routines/__tests__/

- `pasteTemplate.test.ts` — The template is shipped help: the app offers it as the example of what it can (~1177 tok)

## src/storage/__tests__/

- `migrate.test.ts` — Declares workout (~1336 tok)

## src/ui/

- `help.ts` — The help text, kept out of the screens that show it. (~1154 tok)
- `HelpTray.tsx` — One line each. If a point needs a paragraph it belongs somewhere else. (~713 tok)
- `keys.ts` — Whether the run screen's shortcuts should act on a key, given what has focus. (~422 tok)
