# ui

The screens — library, run, edit, plus a dev-only sound bench — the design tokens
and the type scale.

## One type scale, in `theme.css`

Before there was one, the library and the run screen had accumulated **11 ad-hoc
font sizes and 5 letter-spacing values** between them, and read as two different
apps. There is now a single scale keyed to *role* rather than to element:

- Tracking: `--track-display` −0.03em, `--track-name` −0.01em, `--label-tracking`
  0.11em.
- Sizes: `--size-display`, `--size-title`, `--size-name`, `--label-size`,
  `--label-size-sm`.

**Do not add a local `clamp()` for type** — extend the scale. The one documented
exception is the run screen's exercise name, which needs a `cqh` term the tokens
do not carry so it can give way on a short window.

To step a label down, override the token (`--label-size: var(--label-size-sm)`),
never `font-size`.

## Sized for viewing distance

This is read from three metres away, mid-effort, so type is sized by distance
rather than by dashboard convention: ~1rem is the *floor* for secondary text, and
it scales with the container.

The countdown is bounded on **both** axes and sized from the *longest string a
step will show*, not the current one — otherwise a step counting through 1:00 to
59 jumps around 75% larger mid-step. The stacked layout uses fixed proportions
rather than letting the countdown take what it needs, so the image never resizes
with it.

## Text always fits its box

Nothing is clipped and nothing is truncated, so anything that can receive an
arbitrary string is **sized to fit on both axes**. Pasted routines make this
non-negotiable: a step name arrived at 159 characters.

`format.ts` has two fitters, and picking the wrong one is the mistake to avoid:

- **`fitCqi`** sizes off the LONGEST WORD, assuming the worst — one word per
  line. Right for a narrow box like the media panel, where that really happens.
- **`fitBlockCqi(text, maxLines, max)`** bounds by the longest word *and* by
  total length over a line budget. Right for a heading across a full-width
  column, where words pack and the one-per-line assumption would set a five-word
  name absurdly small.

Both return `cqi`, consumed as `calc(var(--fit) * 1cqi)` and paired with a height
term — see `.panel__empty` and `.count__name`. A floor alone is not fitting: it
just moves the overflow somewhere a grid row cannot absorb it.

The list works the other way round: its rows GROW to fill the sheet. Four short
exercises leave a lot of height going spare, and a row pinned to the 1rem floor
is unreadable from where the phone is propped. `listLines()` estimates the lines
the group needs and `.sheet__list` divides its height budget by that.

Note that the width term is deliberately absent there. A `cqi` bound pinned a
phone to the floor, because a narrow screen is exactly where the rows most need
to be big — height is the constraint in a list, not width.

Rows keep ONE size across the group, and the list scrolls when it must. A row
shrunk to fit alone would be illegible, and rows of differing sizes read as
ragged: below the fold beats unreadable.

## Traps this codebase has already hit

Each of these cost a real bug. They are recorded because they recur.

- **Never use the `font:` shorthand in a shared class.** It resets `font-size`, so
  any component override becomes dependent on CSS import order. `theme.css` is
  imported first for the same reason: base layer before modifiers.
- **A custom property consumed outside the subtree that sets it needs a root
  default.** An undefined one invalidates the whole declaration — that is how the
  editor's Save button became dark text on a dark background.
- **`object-fit: contain` does not stop an image overflowing.** It constrains the
  picture *within* the box; if the box is too big the picture is clipped. Make the
  box definite (`position: absolute; inset: 0`) rather than trusting a percentage
  height to resolve.
- **Centred text with letter-spacing is off-centre by half the tracking**, because
  the spacing is applied after the last glyph too. Compensate with padding.
- **With `container-type: inline-size`, only `cqi`/`cqw` mean anything.** `cqh`
  silently falls back to the viewport.
- **CSS cannot divide one length by another**, so a ratio driven by a pixel
  distance needs that distance passed in unitless.
- **A `<label>` must not wrap a button** — it forwards the click to its input.
- **Never fade a saturated colour toward a near-black ground** to show an inactive
  state. Dark plus desaturated red is brown. Mix toward a mid neutral instead, or
  drop the hue.

## Routine colours are labels, not phases

A routine can carry one of six tints, and they stop at the **library row and the
editor**. The run screen is never tinted: there, green/red/blue already mean get
ready / work / rest, and a second colour system on top of the one thing readable
across a gym would break it.

Red, green, blue and purple reuse the phase hues so the app has one palette rather
than two; orange and yellow complete the spectrum. A tint is only ever a
low-percentage mix, never a flat fill — and note the trap it already caused: a new
`[data-colour]` rule tied on specificity with the existing `:hover` rule and, being
later in the file, silently killed hover on tinted rows. Encode precedence with
`:not()` rather than relying on source order.

## Buttons: `.btn` is an icon, `.chip` is a word

Two classes, and picking the wrong one is not a style slip — it is a broken
control:

- **`.btn`** is a fixed 56×56 square (`.btn--primary` 68×68) built for a single
  icon. Put text in one and it is crammed into a square.
- **`.chip`** is the text button: 44px min-height, padding on the inline axis,
  uppercase at `--label-size-sm` with `--label-tracking`. Variants are
  `--action` (brighter), `--primary` (phase ground, dark text) and `--danger`.

Every dialog action, every toolbar word and the run screen's Next are chips. A
chip can carry an icon *and* a word; a `.btn` may only ever carry the icon.

`.chip--primary` uses `var(--phase)`, which is why that token has a root default
— an undefined custom property invalidates the whole declaration, and that is
how the editor's Save button once rendered as dark text on a dark ground.

## Phase colours

Traffic light, by request: green to get ready, red to work, blue to rest, violet
to recover. The values are chosen so the three separate by **lightness** as well
as hue, and so each clears 4.5:1 against the dark text of the primary button —
re-check that ratio if any role colour changes.

## Files

Each screen owns its stylesheet and imports it itself; `theme.css` is imported
first, from `main.tsx`, so the base layer always lands before the modifiers.

| | |
|---|---|
| `App.tsx` | Routing between library, run and edit; consumes a shared routine from the URL |
| `RunScreen.tsx` | The countdown, the media panel, keyboard control |
| `LibraryScreen.tsx` | Routines, import, export, share, colour, pull-to-update |
| `EditorScreen.tsx` | Steps, reps, images, undo, the lightbox and image picker |
| `SoundsScreen.tsx` | The cue bench. **Dev only** — `App.tsx` loads it through a dynamic import inside a `DEV` branch, which a production build drops along with its CSS |
| `PasteDialog.tsx` | Paste a routine as text; reports unparsed lines before saving |
| `Menu.tsx` | The dropdown behind the collapsed toolbars. Hand-rolled, because the Popover API still needs CSS anchor positioning to sit under its trigger |
| `NoticeDialog.tsx` | Outcomes reported as a modal, and a progress report while the work is still running |
| `useMediaUrl.ts` | Resolves a `MediaRef` to a URL — synchronous pass first, so a step change cannot flash blank |
| `theme.css` | Tokens, the type scale, the routine tints, and the shared `.label` / `.btn` / `.chip` classes |
| `library.css`, `run-screen.css`, `editor.css`, `sounds.css` | One stylesheet per screen, imported by the screen |
| `icons.tsx` | Inline SVG — inherits `currentColor`, no font, nothing to fetch offline |
| `format.ts` | Clock and duration formatting, and the fitting helpers the countdown needs |
