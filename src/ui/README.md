# ui

The screens (library, run, edit, plus a dev-only sound bench), the design tokens
and the type scale.

## One type scale, in `theme.css`

Before there was one, the library and the run screen had accumulated **11 ad-hoc
font sizes and 5 letter-spacing values** between them, and read as two different
apps. There is now a single scale keyed to *role* rather than to element:

- Tracking: `--track-display` −0.03em, `--track-name` −0.01em, `--label-tracking`
  0.11em.
- Sizes: `--size-display`, `--size-title`, `--size-name`, `--label-size`,
  `--label-size-sm`.

**Do not add a local `clamp()` for type.** Extend the scale instead. The one
documented exception is the run screen's exercise name, which needs a `cqh` term
the tokens do not carry so it can give way on a short window.

To step a label down, override the token (`--label-size: var(--label-size-sm)`),
never `font-size`.

## Sized for viewing distance

This is read from three metres away, mid-effort, so type is sized by distance
rather than by dashboard convention. About 1rem is the *floor* for secondary text,
and it scales with the container.

The countdown is bounded on **both** axes and sized from the *longest string a
step will show*, not the current one. Otherwise a step counting through 1:00 down
to 59 jumps around 75% larger mid-step. The stacked layout uses fixed proportions
rather than letting the countdown take what it needs, so the image never resizes
with it.

## Text always fits its box

Nothing is clipped and nothing is truncated, so anything that can receive an
arbitrary string is **sized to fit on both axes**. Pasted routines make this
compulsory: a step name arrived at 159 characters.

`format.ts` has two fitters, and picking the wrong one is the mistake to avoid:

- **`fitCqi`** sizes off the longest word, assuming the worst case of one word per
  line. Right for a narrow box like the media panel, where that really happens.
- **`fitPanel(text)`** is the media panel's, and returns a size AND a line count.
  It solves the fixed point the other two dodge: shrinking text cuts the line
  count as well as the line height, so filling a box on both axes is a square
  root. It reproduces a line per word exactly for a short name, and rescues a
  paragraph, which a line per word drove under the CSS `1rem` floor and then set
  in three lines of an eleven-line box.
- **`fitBlockCqi(text, maxLines, max)`** bounds by the longest word *and* by total
  length over a line budget. Right for a heading across a full-width column, where
  words pack and the one-per-line assumption would set a five-word name absurdly
  small.

Both return `cqi`, consumed as `calc(var(--fit) * 1cqi)` and paired with a height
term. See `.panel__empty` and `.count__name`. A floor alone is not fitting: it
just moves the overflow somewhere a grid row cannot absorb it.

The list works the other way round: its rows GROW to fill the sheet. Four short
exercises leave a lot of height going spare, and a row pinned to the 1rem floor is
unreadable from where the phone is propped. `listLines()` estimates the lines the
group needs, and `.sheet__list` divides its height budget by that.

Note that the width term is deliberately absent there. A `cqi` bound pinned a
phone to the floor, because a narrow screen is exactly where the rows most need to
be big. Height is the constraint in a list, not width.

Which layout appears is decided by `listMode()` in the engine, not by a condition
scattered through the component. It has three clauses, and one is easy to get
backwards:

- A step outside a list-mode section is a countdown, as it always was.
- **A timed step is a countdown wherever it falls.** You are not reading a list
  while holding a wall sit, you are watching the clock. A rest between rounds, a
  hold at the end of a rung, and one in the middle of a burnout are all this case.
- A gate with nothing after it in its group is a countdown too, since the list
  would be a column of struck-through text and one live row.

Rows keep ONE size across the group, and the list scrolls when it must. A row
shrunk to fit alone would be illegible, and rows of differing sizes read as
ragged. Below the fold beats unreadable.

## Dragging a row is `moveStep` called repeatedly

`useRowDrag` never reorders the tree itself. It works out that the held row has
passed its neighbour and calls `onStep(id, ±1)`, which the editor answers with
`moveStep` — the same function the Move up and Move down buttons call, already
tested for walking a step into and out of rounds, ladders and sections. So a
drag cannot put a step anywhere the buttons could not, and there is no second
implementation of reordering to keep in step with the first.

Three things about it that are load-bearing:

- **The loop runs on `requestAnimationFrame`, not on `pointermove`.** A move goes
  through React, so the DOM is a render behind; a burst of pointer events would
  apply the same step several times before any of it landed. Auto-scroll also has
  to keep going while a finger is held still at the edge, when no pointer events
  arrive at all.
- **One frame is skipped after each move**, while the DOM catches up. Measuring
  immediately compares the new position against a stale neighbour and moves again.
- **The whole drag shares the `'drag'` coalescing key**, so undo takes it back in
  one press rather than one press per row crossed. Same mechanism a run of
  keystrokes uses.

`touch-action: none` is on the grip alone. The list has to keep scrolling under a
finger everywhere else, or the feature trades one gesture for another.

The grip is the WHOLE reordering affordance for a step row, by pointer and by
keyboard: it answers the arrow keys, because Move up and Move down were removed
from that row once it could be dragged. Focus survives the move, since rows are
keyed by block id and React moves the node rather than rebuilding it, so the key
can be held down to walk a step up through the routine. That goes for group rows too: the
Move up and Move down buttons are gone from every row in the editor, so the grip
is the only way to reorder anything, by either input.

## Traps this codebase has already hit

Each of these cost a real bug. They are recorded because they recur.

- **Never use the `font:` shorthand in a shared class.** It resets `font-size`, so
  any component override becomes dependent on CSS import order. `theme.css` is
  imported first for the same reason: base layer before modifiers.
- **A custom property consumed outside the subtree that sets it needs a root
  default.** An undefined one invalidates the whole declaration. That is how the
  editor's Save button became dark text on a dark background.
- **`object-fit: contain` does not stop an image overflowing.** It constrains the
  picture *within* the box, and if the box is too big the picture is clipped. Make
  the box definite (`position: absolute; inset: 0`) rather than trusting a
  percentage height to resolve.
- **Centred text with letter-spacing is off-centre by half the tracking,** because
  the spacing is applied after the last glyph too. Compensate with padding.
- **With `container-type: inline-size`, only `cqi` and `cqw` mean anything.** `cqh`
  silently falls back to the viewport.
- **CSS cannot divide one length by another,** so a ratio driven by a pixel
  distance needs that distance passed in unitless.
- **A `<label>` must not wrap a button.** It forwards the click to its input.
- **Two elements sharing a column must be sized against each other,** not each
  against the column. The countdown and the step name each fitted the column on
  their own and together did not, so a two-line name pushed the step counter
  behind the media panel. `--name-lines` is what couples them.
- **An empty grid track still costs its gap.** Declare only the tracks you always
  have. An optional row or column that is sometimes absent leaves a gap behind it,
  which reads as too much padding at that edge. Where a column is genuinely
  optional, space the columns with padding on the items instead of `column-gap`.
- **A bare `1fr` has a min-content floor.** A track that must be allowed to shrink
  below its content is `minmax(0, 1fr)`, or the grid grows past its own parent
  instead of giving way.
- **Anything with auto grid rows gets stretched by whatever contains it.** A dialog
  is a child of the full-height grid that opened it, and a stretched dialog splits
  the spare height between its rows: title at the top, body marooned in the middle,
  buttons pulled into slabs. Flex children stretch the same way, which is what
  turns two chips into full-height columns. Give a box `height: fit-content` and
  `align-content` or `align-items` that pack, rather than trusting it to be sized
  by its contents.
- **An absolutely positioned box with `width: auto` is shrink-to-fit, sized against
  its containing block.** Anchor a popover to a 42px wrapper and its available
  width is 42px, so shrink-to-fit falls back to min-content. Give a popover
  `width: max-content` and keep its widest child `nowrap`.
- **Never fade a saturated colour toward a near-black ground** to show an inactive
  state. Dark plus desaturated red is brown. Mix toward a mid neutral instead, or
  drop the hue.

## Routine colours are labels, not phases

A routine can carry one of six tints, and they stop at the **library row and the
editor**. The run screen is never tinted. There, green, red and blue already mean
get ready, work and rest, and a second colour system on top of the one thing
readable across a gym would break it.

Red, green, blue and purple reuse the phase hues so the app has one palette rather
than two. Orange and yellow complete the spectrum. A tint is only ever a
low-percentage mix, never a flat fill.

Note the trap it already caused: a new `[data-colour]` rule tied on specificity
with the existing `:hover` rule and, being later in the file, silently killed hover
on tinted rows. Encode precedence with `:not()` rather than relying on source
order.

## Buttons: `.btn` is an icon, `.chip` is a word

Two classes, and picking the wrong one is not a style slip. It is a broken
control:

- **`.btn`** is a fixed 56×56 square (`.btn--primary` 68×68) built for a single
  icon. Put text in one and it is crammed into a square.
- **`.chip`** is the text button: 44px min-height, padding on the inline axis,
  uppercase at `--label-size-sm` with `--label-tracking`. Variants are `--action`
  (brighter), `--primary` (phase ground, dark text) and `--danger`.

Every dialog action, every toolbar word and the run screen's Next are chips. A
chip can carry an icon *and* a word. A `.btn` may only ever carry the icon.

`.chip--primary` uses `var(--phase)`, which is why that token has a root default.
An undefined custom property invalidates the whole declaration, and that is how
the editor's Save button once rendered as dark text on a dark ground.

## Phase colours

Traffic light, by request: green to get ready, red to work, blue to rest, violet to
recover. The values are chosen so the three separate by **lightness** as well as
hue, and so each clears 4.5:1 against the dark text of the primary button.
Re-check that ratio if any role colour changes.

## Seven kinds, seven colours

The four roles above are phases. The three group kinds are containers, so they take
hues the roles do not use: **sets orange, ladder yellow, section teal**
(`--group-*` in `theme.css`). Sets and ladder borrow the routine tints, keeping one
`.label--section` names the section running, ONCE, in the run header under the
routine name. It borrows `--group-section` rather than `--phase` on purpose, or
the heading would change hue every time work turned to rest, as though the part
of the routine had changed with it.

It lives in the header because that row is `auto` and gives way. The list layout
used to head itself with a large bone heading and the countdown showed nothing;
putting a copy above the countdown overflowed a column whose own budget leaves
about two points of slack, and it landed on the header and on the step count. The
header costs the countdown nothing that the countdown was not already going to
lose, and one location serves both layouts. A test asserts the heading appears
exactly once, inside the `header`, and never inside `.count__lead`.

palette rather than two. Teal is defined only as `--group-section`, because adding
it to `--routine-*` would put an eighth swatch in the colour picker, and that set
is deliberately six.

Both halves show up the same way, as a 4px rule down the left edge of the row, so
the shape of a routine is readable while scrolling without a word being read. Two
of them used to lie: a ladder was violet like Recover, and a section took
`--phase`, which is the Rest blue.

Each **add button wears the same rule** on its left edge, via `data-kind`, so the
button and the row it produces read as the same object. A swatch would say "this
control is coloured". A matching edge says "this makes that". The word stays on the
button either way: colour is the second cue, never the only one, and seven hues
cannot all survive a colour-vision deficiency. Luminance is spread as well as hue,
so they also separate in greyscale.

## A dialog is two elements

`.modal` is the `<dialog>`: transparent, viewport-filling, padded by the safe-area
insets, `place-items: center`, `overscroll-behavior: contain`. The box itself, with
its ground, border, padding and rows, is a child div: `.notice`, `.paste`,
`.picker`.

It was one element, the dialog styled as the panel and held to its content by
`height: fit-content` with `align-self` and `align-content`. That works in Chrome
and does not on iOS, where the box takes the height available and its auto rows
stretch to share out the surplus: title at the top, detail marooned in the middle,
buttons a screen away, Close drawn as a slab. Tuning it produced a second failure,
with centred content in a scroll container, the top overflow unreachable and the
title clipped along its cap height.

So: **never style a `<dialog>` as the panel.** A wrapper cannot be stretched by
anything, and the sheet is also the right place for the insets and for stopping a
scroll gesture reaching the screen behind.

## The build badge

The home screen shows `v<version>` beside the help button, from `src/version.ts`,
with the build date in its title attribute (stamped by `vite.config.ts`).
**Bump the version on every build you intend to test on a device.** An installed
PWA is served by a service worker, so "did my change actually reach the phone" is
otherwise a guess, and the failure mode is debugging a layout that was fixed two
deploys ago.

## The hardware takes a bite out of every screen

Installed to an iPhone home screen, the app owns the whole display. `index.html`
sets `viewport-fit=cover` and a translucent status bar, which is what lets the
phase wash run under the island instead of stopping at a grey bar. The cost is that
**every screen has to inset its own controls**, and it is not a cosmetic matter:
iOS takes touches in the status bar, so a button up there cannot be pressed at all.
That is how the run screen's back button became unusable mid-workout while the
routine kept going.

`--safe-top`, `-right`, `-bottom` and `-left` in `theme.css` wrap the `env()`
values so the intent is greppable and a new screen can copy it. Two things to
remember when using them:

- **Inset the band, not the shell.** The wash belongs edge to edge, so the padding
  goes on the header, the container's own padding, or the bottom bar. Not on a
  wrapper around the screen, which would leave a flat strip above the gradient.
- **A wide-layout override must carry them too.** Each screen re-declares its
  padding inside a `@container (min-width: 46rem)` query, and a bare
  `padding: var(--step-6) var(--step-7)` there silently undoes the inset. That
  shows up on an iPhone in landscape, which is over 46rem and still has an island,
  at the side.

All four sides, because the island moves and the home indicator follows it. Every
token is zero on hardware without them, and zero in a browser tab.

## The shell's height is `svh`

`html`, `body` and `#root` are `100svh`, the **small** viewport: the screen with
the browser UI showing. All three units are equal on a home-screen install, so a
mistake here only shows up in a browser tab.

- Not `dvh`, which shrinks when the keyboard appears. The app relaid itself at
  keyboard height and iOS did not always report the dismissal, leaving a band of
  nothing at the bottom.
- Not `lvh`, the screen with the browser UI **retracted**. With Safari's bars
  showing, the shell was taller than the screen by their height, so the bottom band
  of every screen sat under the toolbar. Worse, content taller than the viewport is
  scrollable **overflow**, and `overflow: hidden` only clips it. The keyboard's
  focus-reveal scrolled the document and left it scrolled, with no way for the user
  to scroll back.

`svh` and `lvh` are both stable, so `svh` keeps everything `lvh` was chosen for.
The lesson worth carrying: **`overflow: hidden` clips overflow, it does not prevent
it, and the browser can still scroll what the user cannot.** "The document never
scrolls" needs both the hidden overflow and a height the screen can actually show.
`.modal` is the exception and uses `dvh` on purpose, because a dialog should track
the keyboard.

## A wide layout is about shape, not size

`46rem` is the width at which a screen can afford wider padding, more columns in a
row, or an action button on the same line as its label. It is **not** on its own
the width at which the run screen may stand the countdown and the picture side by
side. That needs height to give away, and a portrait iPad has none: at 768 to
1024px wide it passed the width test, so the two halves became two tall half-width
columns, while an iPhone of the same shape and smaller stacked them.

So `.run__body`'s columns, and `.count__clock`'s coefficients which are sized for
that column, sit inside `@container shell (min-width: 46rem)` with a nested
`@media (orientation: landscape)`. An iPhone in landscape is both, and keeps the
columns. It has to be a viewport media query rather than an aspect-ratio container
query: `.run` is an `inline-size` container, so it cannot be asked about its own
height, and the shell is pinned to the viewport anyway.

Both blocks carry the same gate. Gating one without the other sizes the clock for a
column it is no longer in.

## The keyboard belongs to the screen, except where it does not

`keys.ts` decides whether a run-screen shortcut may act, based on what has focus:

- a text field or a select takes **every** key, since typing must not fire a
  shortcut and a select's arrows change its value;
- a button takes **Space and Enter**, which activate it, so a press does one thing
  rather than the button's action *and* play/pause;
- the arrows, `m` and `k` are always the screen's.

The rule it replaced ignored every key while a `<button>` had focus. Clicking a
control leaves it focused, so starting a routine with the mouse silently disabled
skipping, while starting it with the spacebar left focus on the body and the whole
keyboard worked. Two ways to begin, two different keyboards, and nothing logged. A
focus guard has to name the keys, not the tag.

## Help is a tray, and it is data

Two screens carry a help button: the library, beside the Routines menu, and the
editor, to the right of Save. Both open the same `HelpTray`, a modal `<dialog>`
pinned to the right edge, with native `<details>` sections of bullet points.

Three decisions worth keeping:

- **A tray, not a page.** Help that replaces what you were looking at makes you
  memorise the answer before you can act on it. Closing this puts you back exactly
  where you were.
- **`<details>`, not an accordion.** A hand-rolled one needs state, a keyboard
  implementation and an aria contract, and would still lose to the element the
  browser ships, which finds text inside a *closed* section when the page is
  searched. **One section at a time**, via the shared `name` attribute: that is the
  platform's own exclusive accordion, so the behaviour costs an attribute rather
  than a reducer. The name comes from `useId`, so two trays could never close each
  other's sections. The first section is open, and because that prop never changes
  value React leaves the attribute alone after mount, which is exactly what lets
  the browser close it when another section opens.
- **The text lives in `help.ts`,** as data. A point can be added without touching a
  component, and the two trays cannot drift into two different voices. Every line
  has to describe something the app actually does. A help tray that overstates is
  worse than no help at all, because it is believed.

The paste dialog gets its help differently. **Copy template** hands over a routine
written in every part of the grammar (`routines/pasteTemplate.ts`), which is the
honest way to describe a parser that reads a human's handout. It goes to the
clipboard rather than into the box, so it can be edited where the routine actually
lives and cannot overwrite something already typed. If the clipboard is refused it
lands in the box instead, but only when there is nothing there to lose.

The acknowledgement is a `NoticeDialog` rendered as a SIBLING of the paste dialog,
never a child. `close` reaches React's handlers on the way up, so a nested notice
would cancel the whole paste when it was dismissed.

## Files

Each screen owns its stylesheet and imports it itself. `theme.css` is imported
first, from `main.tsx`, so the base layer always lands before the modifiers.

| | |
|---|---|
| `App.tsx` | Routing between library, run and edit. Consumes a shared routine from the URL |
| `RunScreen.tsx` | The countdown, the media panel, keyboard control |
| `LibraryScreen.tsx` | Routines, import, export, share, colour, pull-to-update |
| `EditorScreen.tsx` | Steps, sets, images, undo, and the image chooser and preview dialogs |
| `SoundsScreen.tsx` | The cue bench. **Dev only.** `App.tsx` loads it through a dynamic import inside a `DEV` branch, which a production build drops along with its CSS |
| `PasteDialog.tsx` | Paste a routine as text. Reports unparsed lines before saving, and hands over the template |
| `HelpTray.tsx`, `help.ts` | The right-edge help tray, and the bullet points it shows |
| `Menu.tsx` | The dropdown behind the collapsed toolbars. Hand-rolled, because the Popover API still needs CSS anchor positioning to sit under its trigger |
| `useDismiss.ts` | Close-on-Escape and close-on-press-outside, shared by `Menu` and the editor row's controls panel |
| `NoticeDialog.tsx` | Outcomes reported as a modal, and a progress report while the work is still running |
| `ConfirmDialog.tsx` | Asks before something irreversible. A modal, unlike the editor's inline confirm, because it is answered mid-workout |
| `useMediaUrl.ts` | Resolves a `MediaRef` to a URL. Synchronous pass first, so a step change cannot flash blank |
| `useRowDrag.ts` | Reordering editor rows by their grip. Pointer Events, not HTML5 drag-and-drop, which does not fire at all in iOS Safari |
| `theme.css` | Tokens, the type scale, the routine tints, the shared `.label`, `.btn` and `.chip` classes, and the dialog shell both modals use |
| `library.css`, `run-screen.css`, `editor.css`, `sounds.css` | One stylesheet per screen, imported by the screen |
| `icons.tsx` | Inline SVG. Inherits `currentColor`, needs no font, nothing to fetch offline |
| `format.ts` | Clock and duration formatting, and the fitting helpers the countdown needs |
| `keys.ts` | Whether a run-screen shortcut may act, given what has focus |
