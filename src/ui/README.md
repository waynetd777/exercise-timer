# ui

The three screens, the design tokens and the type scale.

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

## Phase colours

Traffic light, by request: green to get ready, red to work, blue to rest, violet
to recover. The values are chosen so the three separate by **lightness** as well
as hue, and so each clears 4.5:1 against the dark text of the primary button —
re-check that ratio if any role colour changes.

## Files

| | |
|---|---|
| `App.tsx` | Routing between library, run and edit; consumes a shared routine from the URL |
| `RunScreen.tsx` | The countdown, the media panel, keyboard control |
| `LibraryScreen.tsx` | Routines, import, export, share, pull-to-update |
| `EditorScreen.tsx` | Steps, reps, images, undo, the lightbox and image picker |
| `theme.css` | Tokens, the type scale, and the shared `.label` / `.btn` / `.chip` classes |
| `icons.tsx` | Inline SVG — inherits `currentColor`, no font, nothing to fetch offline |
| `format.ts` | Clock and duration formatting, and the fitting helpers the countdown needs |
