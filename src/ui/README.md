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

Which layout appears is `listMode()` in the engine, not a condition scattered
through the component. Three clauses, and one is easy to get backwards:

- A step outside a list-mode section is a countdown, as it always was.
- **A timed step is a countdown wherever it falls.** You are not reading a list
  while holding a wall sit — you are watching the clock. A rest between rounds, a
  hold at the end of a rung and one in the middle of a burnout are all this case.
- A gate with nothing after it in its group is a countdown too, since the list
  would be a column of struck-through text and one live row.

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
- **Two elements sharing a column must be sized against each other**, not each
  against the column. The countdown and the step name each fitted the column on
  their own and together did not, so a two-line name pushed the step counter
  behind the media panel. `--name-lines` is what couples them.
- **An empty grid track still costs its gap.** Declare only the tracks you always
  have — an optional row or column that is sometimes absent leaves a gap behind
  it, which reads as too much padding at that edge. Where a column is genuinely
  optional, space the columns with padding on the items instead of `column-gap`.
- **A bare `1fr` has a min-content floor.** A track that must be allowed to
  shrink below its content is `minmax(0, 1fr)`, or the grid grows past its own
  parent instead of giving way.
- **Anything with auto grid rows gets stretched by whatever contains it.** A
  dialog is a child of the full-height grid that opened it, and a stretched
  dialog splits the spare height between its rows: title at the top, body
  marooned in the middle, buttons pulled into slabs. Flex children stretch the
  same way, which is what turns two chips into full-height columns. Give a box
  `height: fit-content` and `align-content` / `align-items` that pack, rather
  than trusting it to be sized by its contents.
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

## Seven kinds, seven colours

The four roles above are phases. The three group kinds are containers, so they
take hues the roles do not use: **reps orange, ladder yellow, section teal**
(`--group-*` in `theme.css`). Reps and ladder borrow the routine tints, keeping
one palette rather than two; teal is defined only as `--group-section`, because
adding it to `--routine-*` would put an eighth swatch in the colour picker and
that set is deliberately six.

Both halves show up the same way — a 4px rule down the left edge of the row — so
the shape of a routine is readable while scrolling without a word being read. Two
of them used to lie: a ladder was violet like Recover, and a section took
`--phase`, which is the Rest blue.

Each **add button wears the same rule** on its left edge, via `data-kind`, so the
button and the row it produces read as the same object. A swatch would say "this
control is coloured"; a matching edge says "this makes that". The word stays on
the button either way: colour is the second cue, never the only one, and seven
hues cannot all survive a colour-vision deficiency. Luminance is spread as well
as hue, so they also separate in greyscale.

## The build badge

The home screen shows `v<version>` beside the help button, from `src/version.ts`,
with the build date in its title attribute (stamped by `vite.config.ts`).
**Bump the version on every build you intend to test on a device.** An installed
PWA is served by a service worker, so "did my change actually reach the phone" is
otherwise a guess — and the failure mode is debugging a layout that was fixed two
deploys ago.

## The hardware takes a bite out of every screen

Installed to an iPhone home screen, the app owns the whole display:
`index.html` sets `viewport-fit=cover` and a translucent status bar, which is what
lets the phase wash run under the island instead of stopping at a grey bar. The
cost is that **every screen has to inset its own controls**, and it is not a
cosmetic matter — iOS takes touches in the status bar, so a button up there cannot
be pressed at all. That is how the run screen's back button became unusable
mid-workout while the routine kept going.

`--safe-top` / `-right` / `-bottom` / `-left` in `theme.css` wrap the `env()`
values so the intent is greppable and a new screen can copy it. Two things to
remember when using them:

- **Inset the band, not the shell.** The wash belongs edge to edge, so the padding
  goes on the header, the container's own padding, or the bottom bar — not on a
  wrapper around the screen, which would leave a flat strip above the gradient.
- **A wide-layout override must carry them too.** Each screen re-declares its
  padding inside a `@container (min-width: 46rem)` query, and a bare
  `padding: var(--step-6) var(--step-7)` there silently undoes the inset — on an
  iPhone in landscape, which is over 46rem and still has an island, at the side.

All four sides, because the island moves and the home indicator follows it. Every
token is zero on hardware without them, and zero in a browser tab.

## The keyboard belongs to the screen, except where it does not

`keys.ts` decides whether a run-screen shortcut may act, from what has focus:

- a text field or a select takes **every** key — typing must not fire a shortcut,
  and a select's arrows change its value;
- a button takes **Space and Enter**, which activate it, so a press does one
  thing rather than the button's action *and* play/pause;
- the arrows, `m` and `k` are always the screen's.

The rule it replaced ignored every key while a `<button>` had focus. Clicking a
control leaves it focused, so starting a routine with the mouse silently disabled
skipping, while starting it with the spacebar left focus on the body and the whole
keyboard worked. Two ways to begin, two different keyboards, and nothing logged.
A focus guard has to name the keys, not the tag.

## Help is a tray, and it is data

Two screens carry a help button: the library, beside the Routines menu, and the
editor, to the right of Save. Both open the same `HelpTray` — a modal `<dialog>`
pinned to the right edge, with native `<details>` sections of bullet points.

Three decisions worth keeping:

- **A tray, not a page.** Help that replaces what you were looking at makes you
  memorise the answer before you can act on it. Closing this puts you back exactly
  where you were.
- **`<details>`, not an accordion.** A hand-rolled one needs state, a keyboard
  implementation and an aria contract, and would still lose to the element the
  browser ships — which finds text inside a *closed* section when the page is
  searched. **One section at a time**, via the shared `name` attribute: that is
  the platform's own exclusive accordion, so the behaviour costs an attribute
  rather than a reducer. The name comes from `useId`, so two trays could never
  close each other's sections. The first section is open, and because that prop
  never changes value React leaves the attribute alone after mount — which is
  exactly what lets the browser close it when another section opens.
- **The text lives in `help.ts`**, as data. A point can be added without touching
  a component, and the two trays cannot drift into two different voices. Every
  line has to describe something the app actually does: a help tray that
  overstates is worse than none, because it is believed.

The paste dialog gets its help differently — **Copy template** hands over a
routine written in every part of the grammar (`routines/pasteTemplate.ts`), which
is the honest way to describe a parser that reads a human's handout. It goes to
the clipboard rather than into the box, so it can be edited where the routine
actually lives and cannot overwrite something already typed; if the clipboard is
refused it lands in the box instead, but only when there is nothing there to lose.
The acknowledgement is a `NoticeDialog` rendered as a SIBLING of the paste dialog,
never a child: `close` reaches React's handlers on the way up, so a nested notice
would cancel the whole paste when it was dismissed.

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
| `PasteDialog.tsx` | Paste a routine as text; reports unparsed lines before saving, and hands over the template |
| `HelpTray.tsx`, `help.ts` | The right-edge help tray, and the bullet points it shows |
| `Menu.tsx` | The dropdown behind the collapsed toolbars. Hand-rolled, because the Popover API still needs CSS anchor positioning to sit under its trigger |
| `NoticeDialog.tsx` | Outcomes reported as a modal, and a progress report while the work is still running |
| `ConfirmDialog.tsx` | Asks before something irreversible. A modal, unlike the editor's inline confirm, because it is answered mid-workout |
| `useMediaUrl.ts` | Resolves a `MediaRef` to a URL — synchronous pass first, so a step change cannot flash blank |
| `theme.css` | Tokens, the type scale, the routine tints, the shared `.label` / `.btn` / `.chip` classes, and the dialog shell both modals use |
| `library.css`, `run-screen.css`, `editor.css`, `sounds.css` | One stylesheet per screen, imported by the screen |
| `icons.tsx` | Inline SVG — inherits `currentColor`, no font, nothing to fetch offline |
| `format.ts` | Clock and duration formatting, and the fitting helpers the countdown needs |
| `keys.ts` | Whether a run-screen shortcut may act, given what has focus |
