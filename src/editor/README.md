# editor

Pure operations on a routine's block tree, plus undo. The editor screen itself
lives in `ui/` and is a thin shell over these.

## Paths, and immutability

A `Path` is the chain of indices to reach a block. `[2]` is the third top-level
block, `[1, 0]` the first child of the second. Every operation returns a new tree
and never mutates its input, which is what lets undo keep old trees rather than
replaying inverse operations.

## Three levels, three group kinds

A routine can be `section > round or ladder > step`, so every tree walk here
recurses on `isGroup` rather than on `kind === 'repeat'`. That was a real bug
before it was a rule: `flatten` rendered a ladder as one childless row, and
`blockAt` could not reach anything inside a section.

`wrapInRepeat` refuses a section, since a section is a part of the routine rather
than a piece of work and a round cannot contain one. It allows a ladder, because
"3 rounds of this ladder" is a real thing to ask for.

## A step is timed OR counted, never both

The data model lets a step carry a duration and a rep count at once. The editor
does not, because a step that says "20 ×" and counts down 30 seconds cannot be
obeyed. So `setTiming` **deletes** the other key rather than setting it undefined.
`exactOptionalPropertyTypes` is on, and absent versus present-and-undefined is
exactly what separates a self-paced step from a timed one. `clearMedia` exists for
the same reason.

`timingOf` reads the choice back for the control that sets it, falling back to the
role's default duration for a step with no duration to return to.

## A step's note and alternative

Both live on a line BELOW the step, shown only when the step has one or the note
button asks for it. A routine runs to forty steps, and two more inputs on every row
would bury the field anyone came to change. But a pasted step usually has a note,
the instruction lifted out of its name, and losing it silently on the first edit is
what this exists to prevent.

Emptying either one calls `clearText`, which DELETES the key. Same reason as
`clearMedia` and `setTiming`: `""` and absent are different, and the empty string
would leave a blank line under the step for ever.

## Rules worth knowing

- **`moveStep` moves a row through the routine as it *reads*.** Next to a group
  (reps, ladder or section alike) it moves *into* it, as the first child going down
  or the last going up. Next to a step it swaps. At the edge of a group it steps
  *outside*. `moveBy` only reorders among siblings, which left a step trapped
  inside or outside a group. Sibling resolution covers every group kind: it once
  covered only reps, and moving a step inside a section ejected it.
- **Groups themselves only ever swap.** `wrapInRepeat` refuses to nest a group inside a
  group, because the editor renders two levels and a deeper tree would be invisible
  and un-editable. The *data model* supports any depth, so lifting this is a UI
  decision, not a schema one.
- **A move past either end is a no-op** rather than an error, so holding a button
  cannot corrupt the tree.
- **A group left empty by a departing step is kept, not pruned.** A group vanishing
  under you is more surprising than an empty one you can delete.
- **`duplicateAt` deep-copies with fresh ids.** The editor keys its rows by
  `block.id`, so a copy that kept them would give two rows the same React key.
- **`clearMedia` exists because of `exactOptionalPropertyTypes`.** You cannot patch
  a key to `undefined`, and clearing an image means *deleting* the key so the
  property is absent rather than present-and-undefined.
- **Defaults match the real routines:** 30s to get set, 20s of work, 10s rest, 60s
  recovery, and a new group is three reps of work-then-rest. An added step usually
  needs no editing. Do not tidy these to round numbers.
- **The label a new group stores is `'Reps'`, always plural,** short for
  repetitions. It is *data*, so renaming it in code is never enough. See
  `storage/migrate.ts`.

## One grammar for every row

Four kinds of row (step, reps, ladder, section) and one order for the buttons that
act on them:

    step     add · up · down · wrap    · duplicate · delete
    reps     add · up · down · ungroup · duplicate · delete
    ladder   add · up · down ·           duplicate · delete
    section  add · up · down ·           duplicate · delete

Add first, delete last, duplicate before it, up and down adjacent and in reading
order. The cluster is right-aligned, so despite rows carrying five or six buttons
the sequence is stable **counting from the right**. Delete is always flush right,
and that is where muscle memory lands. Wrap and ungroup share a slot and an icon on
purpose: on a step it makes a reps group, on a group it undoes one.

The image and note buttons are deliberately **not** in that cluster. Everything in
the cluster acts on the row's position or existence and acts at once, while these
two open the step's own content. The note toggle carries `aria-pressed`, and
pressed is styled, so the fields it reveals visibly belong to it.

One thing left alone: the plus means "add a sibling below" on a step and "add a
child inside" on a group. Same icon, same slot, two mental models. The titles say
which, and inventing a second glyph for a rare confusion seemed the worse trade.

## The image is one control, and only where it will be seen

It used to be a row of its own under every step: an "Image" label, Choose, Upload,
and a thumbnail when there was one. Forty steps meant forty mostly-empty rows for
something most of them never got. It is one button now, beside the note button, and
it has two states in one slot so the row does not reflow when a picture arrives:

- **No image:** an image button, which opens the chooser. That is the catalogue's
  illustrations in a searchable grid, with Upload a photo under it. One dialog,
  because it answers one question.
- **An image:** the thumbnail itself, which opens the preview. The picture full
  size, the step's name, and **Remove image**. Both live there because they are the
  same errand: you open it to see what the step is carrying, and the only thing you
  might want to do about it is take it off.

Only the countdown layout has a media panel. A step that runs as a row of its
section's list has nowhere to draw a picture, so the editor stops offering one.
`shownAsList(blocks, path)` answers the question from the tree, and no image button
is drawn for those steps.

Two details it would be easy to get wrong:

- **It is the enclosing SECTION that decides, not the group the step sits in.** A
  ladder or a reps group on its own always runs as the countdown. Inside a
  list-display section, its steps are listed. So the check walks ancestors for the
  nearest section rather than looking at the immediate parent.
- **A TIMED step in a list section still runs as the countdown,** because you watch
  the clock through a wall sit rather than reading a list. Its image shows, so its
  controls stay.

An image that is ALREADY set keeps its thumbnail, and the preview dialog says it
will not be shown while running. Hiding the thumbnail would trap data: a step
carrying a picture that nothing in the app can remove. That is also why the
thumbnail is drawn from `segment.media` rather than from the resolved URL. A ref
whose file is not on this device opens an empty frame, and the dialog offers Remove
alongside a line saying why there is nothing to look at. Keying it on the picture
would strand exactly the step that most needs clearing.

There is no link field. Pasting a URL only made sense while the illustrations lived
on someone else's server. An image now comes from the catalogue or from this
device, and `editor/postimages.ts`, which parsed postimages share links and bare
ids, went with it.

Both dialogs are the `.modal` sheet plus a panel of their own, and the preview's
panel is `.notice`, the layout already known to survive iOS where a `<dialog>`
styled as the box does not hug its content. The upload notice is a SIBLING of the
chooser, never a child: `close` reaches React's handlers on the way up, so a notice
nested inside would fire the chooser's own `onClose` and shut it on dismissal.

`engine/navigate.ts`'s `listMode()` is the authority. It has a third, positional
clause, that the last remaining row of a group runs as the countdown, which this
deliberately drops: a control appearing on whichever step happened to be last, and
moving when steps were reordered, is worse than one that is absent. A test asserts
the one-way property that matters, which is that everything the runtime lists is
something the editor calls listed.

## Where the row's buttons live, and two attempts that failed

A step row wants four fields and eight 42px buttons. The buttons alone want about
380pt, and a phone row has about 313pt. That gap cannot be closed by arranging
things better. Both attempts that tried are recorded here because both looked
obviously right:

1. **Pair the buttons, keep them loose in the wrap flow.** Fixed a stranded note
   button, but left the row three and four lines tall with holes in it.
2. **Gather all eight into one `.erow__band` at the trailing edge.** Made it
   *worse*, four lines where there had been three. **A flex item is placed by its
   MAX-CONTENT width, and only then shrunk.** The band measured about 380pt, so it
   could never share the phone's line whatever it would have done once wrapped. It
   took a line of its own and split inside it. Grouping items can only ever make
   them harder to place, never easier.

One genuine waste turned up along the way and was fixed on its own merits. A native
`<select>` takes the width of its **widest option**, so the unit select showed `s`
while holding the width of `rung each side`: about 140pt of a 313pt row, nearly all
empty. It is sized by the label it shows now, via `data-unit` and three widths in
`em` in `.efield--unit`. Worth about 50pt, but not the 70 the row needed.

**What shipped: the buttons leave the row when there is no room for them.**
`.erow__tools` holds all eight and has two entirely different jobs, chosen by CSS
alone:

| Container | `.erow__tools` | `.erow__more` |
|---|---|---|
| under 64rem | an absolutely positioned panel off the row's bottom right, hidden until ⋯ opens it | the ⋯ trigger |
| 64rem and over | laid out inline at the trailing edge, always visible | `display: none` |

Below the breakpoint the row is just its fields plus one 42px button, which fits a
phone in two lines and a narrow laptop window in one. Above it, the whole row fits
on one line **by construction**, which is the only reason grouping the buttons is
safe up there given attempt 2.

Details that matter:

- **64rem, not the row's true minimum of about 53rem.** The deepest indent takes
  48px off the row, and the name field should not sit at its 9rem floor. At 64rem
  even a two-level-nested row has about 44px spare.
- **No width is measured in JS.** The `tools` flag is inert above the breakpoint,
  where CSS shows the panel inline regardless. So there is nothing to correct on a
  resize and no two sources of truth.
- **`[data-open]` is repeated inside the container query,** because it beats the
  bare class on specificity. Without it, a row left open would keep `display: grid`
  and lose the inline layout when the window grew.
- **The panel is anchored to the BUTTON, not to the row.** `.erow__menu` exists only
  to be that anchor. On a narrow screen the ⋯ button is its one in-flow child, so
  the wrapper's box is the button's box and `top: 100%` with `right: 0` land the
  panel directly under it. Anchoring to the row put it under both of a phone row's
  lines, and further still with the note fields open. Above the breakpoint the same
  wrapper holds the panel inline and carries the trailing edge's auto margin, so
  `.erow__tools` never needs one.
- **The panel is `position: absolute` against that wrapper,** not viewport-fixed
  like `Menu`. It therefore travels with its row on a scroll instead of detaching,
  which is why it does not need `Menu`'s close-on-scroll. The row it belongs to
  takes `z-index` while open (`.erow[data-tools]`), since a later sibling row would
  otherwise paint over the panel.
- **It opens upward when there is no room below,** which is the last rows of the
  list, where a downward panel is clipped by the scroller. Measured in a
  `useLayoutEffect`, so the flip lands in the frame the panel first paints rather
  than showing it in the wrong place and jumping. The limit is `.editor__scroll`'s
  visible box, which is what actually clips it, and the measurement is against the
  button's box, which is what the panel is positioned against. It only flips when
  that genuinely helps: with too little room either side, downward at least scrolls
  into view. CSS cannot ask this question, and the one feature that could, anchor
  positioning, is why `Menu` is hand-rolled. The gap is `--step-1` in both places
  and they have to agree.
- **The panel is `width: max-content`, and the cluster stays `nowrap`.** An
  absolutely positioned box with `auto` width is shrink-to-fit sized against its
  CONTAINING BLOCK, which is the 42px `.erow__menu`. So its available width is 42px
  and shrink-to-fit falls back to min-content. Letting the cluster wrap made
  min-content one button wide, and the panel collapsed into a vertical column of
  eight. `max-content` says what is meant and does not care what it is anchored to,
  and the cluster's `nowrap` is what holds the width up. The panel is 288px against
  a phone's 361px of list, and the button sits at the row's right edge whatever the
  indent, so there is room to grow leftward at any depth.
- **The panel closes on any click inside it.** Every button in there is a deed, and
  a panel left hanging off a row that just moved, or was deleted, points at nothing.
- Escape and press-outside come from `ui/useDismiss.ts`, shared with `Menu`. The
  predicate scopes to the panel and its trigger, never to the whole row, or pressing
  the step's own name field would not close it. The trigger has to count as inside,
  or `pointerdown` closes the panel and the following `click` toggles it back open.

## Undo, and why typing collapses

`history.ts` is a `History<T>` of past, present and future, capped at 60 entries.
The interesting rule is **coalescing**. A run of keystrokes collapses into one undo
step, because undoing a rename one character at a time is useless, while any
discrete change earns its own step: adding, deleting, reordering, changing a step's
type, choosing an image.

`push` takes the **field** being typed into, not a boolean, and only a push naming
the same field may replace the present. A flag collapsed too much, in two ways that
were both real:

- **Renaming a step and then the next one became one undo step,** since both were
  merely "text".
- **Every non-typing edit that shared the text path was absorbed** into whatever
  typing came before it. `patchSegment` coalesced anything that was not a role, so
  choosing pictures for two steps in a row collapsed into a single step and one undo
  took both back. `isTypedPatch` in `blocks.ts` now names the fields that are
  genuinely typed a character at a time, which is just `name`, and everything else
  is discrete.

The other half of "is it in the undo stack" is not writing when nothing changed. The
note and the alternative commit on blur, so tabbing through a step used to leave
undo steps that undid nothing visible. Each now compares against what is stored and
returns if it matches.

The caller says which field it is typing into, so there are no timers involved and
the behaviour is testable. Undo also ends a run, so typing after an undo does not
overwrite the state it just restored.

Name, colour and steps share **one** history entry, so undo restores a consistent
draft rather than states that can drift apart. Every mutation in the editor goes
through the same two helpers, `edit` and `editBlocks`, and `setHistory` is touched
nowhere else but undo and redo, so a new mutation cannot quietly bypass the stack.
Screen state that is not the routine is deliberately outside it: the extras row, the
image chooser, the image preview, the controls panel, the help tray and the exit
prompt. Undo should not close a dialog.

## Files

| | |
|---|---|
| `blocks.ts` | The tree operations, the constructors, `setTiming`, `shownAsList`, and the new-routine template |
| `history.ts` | Undo/redo with coalescing |
| `dirty.ts` | Unsaved-change detection, compared **field by field**. `JSON.stringify` depends on key insertion order, and patching an object reorders keys |
| `images.ts` | The images a step can be given: the catalogue merged with library usage |
