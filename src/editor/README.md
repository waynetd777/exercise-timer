# editor

Pure operations on a routine's block tree, plus undo. The editor screen itself
lives in `ui/` and is a thin shell over these.

## Paths, and immutability

A `Path` is the chain of indices to reach a block: `[2]` is the third top-level
block, `[1, 0]` the first child of the second. Every operation returns a new tree
and never mutates its input, which is what lets undo keep old trees rather than
replaying inverse operations.

## Three levels, three group kinds

A routine can now be `section > round or ladder > step`, so every tree walk here
recurses on `isGroup` rather than on `kind === 'repeat'`. That was a real bug
before it was a rule: `flatten` rendered a ladder as one childless row, and
`blockAt` could not reach anything inside a section.

`wrapInRepeat` refuses a section — a part of the routine rather than a piece of
work, so a round cannot contain one — but allows a ladder, since "3 rounds of
this ladder" is a real thing to ask for.

## A step is timed OR counted, never both

The data model lets a step carry a duration and a rep count at once; the editor
does not, because a step that says "20 ×" and counts down 30 seconds cannot be
obeyed. `setTiming` therefore **deletes** the other key rather than setting it
undefined — `exactOptionalPropertyTypes` is on, and absent versus
present-and-undefined is exactly what separates a self-paced step from a timed
one. Same reason `clearMedia` exists.

`timingOf` reads the choice back for the control that sets it, falling back to
the role's default duration for a step with no duration to return to.

## A step's note and alternative

Both live on a line BELOW the step, shown only when the step has one or the note
button asks for it. A routine runs to forty steps, and two more inputs on every
row would bury the field anyone came to change — but a pasted step usually has a
note, the instruction lifted out of its name, and losing it silently on the first
edit is what this exists to prevent.

Emptying either one calls `clearText`, which DELETES the key. Same reason as
`clearMedia` and `setTiming`: `""` and absent are different, and the empty string
would leave a blank line under the step for ever.

## Rules worth knowing

- **`moveStep` moves a row through the routine as it *reads*.** Next to a reps
  group it moves *into* it — first child going down, last going up; next to a step
  it swaps; at the edge of a group it steps *outside*. `moveBy` only reorders among
  siblings, which left a step trapped inside or outside a group.
- **Reps groups only ever swap.** `wrapInRepeat` refuses to nest a group inside a
  group: the editor renders two levels, and a deeper tree would be invisible and
  un-editable. The *data model* supports any depth, so lifting this is a UI
  decision, not a schema one.
- **A move past either end is a no-op** rather than an error, so holding a button
  cannot corrupt the tree.
- **A group left empty by a departing step is kept, not pruned.** A group
  vanishing under you is more surprising than an empty one you can delete.
- **`duplicateAt` deep-copies with fresh ids.** The editor keys its rows by
  `block.id`, so a copy that kept them would give two rows the same React key.
- **`clearMedia` exists because of `exactOptionalPropertyTypes`** — you cannot
  patch a key to `undefined`, and clearing an image means *deleting* the key so
  the property is absent rather than present-and-undefined.
- **Defaults match the real routines**: 30s to get set, 20s of work, 10s rest, 60s
  recovery, and a new group is three reps of work-then-rest. An added step usually
  needs no editing. Don't tidy these to round numbers.
- **The label a new group stores is `'Reps'`, always plural** — short for
  repetitions. It is *data*, so renaming it in code is never enough; see
  `storage/migrate.ts`.

## One grammar for every row

Four kinds of row — step, reps, ladder, section — and one order for the buttons
that act on them:

    step     add · up · down · wrap    · duplicate · delete
    reps     add · up · down · ungroup · duplicate · delete
    ladder   add · up · down ·           duplicate · delete
    section  add · up · down ·           duplicate · delete

Add first, delete last, duplicate before it, up and down adjacent and in reading
order. The cluster is right-aligned, so despite rows carrying five or six buttons
the sequence is stable **counting from the right**: delete is always flush right
and that is where muscle memory lands. Wrap and ungroup share a slot and an icon
on purpose — on a step it makes a reps group, on a group it undoes one.

The note toggle is deliberately **not** in that cluster; it sits at the end of the
field run instead. Everything in the cluster acts on the row's position or
existence and acts at once, while the note opens this step's own text and is a
disclosure rather than a deed. It carries `aria-pressed`, and pressed is styled,
so the fields it reveals visibly belong to it.

One thing left alone: the plus means "add a sibling below" on a step and "add a
child inside" on a group. Same icon, same slot, two mental models — the titles say
which, and inventing a second glyph for a rare confusion seemed the worse trade.

## An image is only offered where it will be seen

Only the countdown layout has a media panel. A step that runs as a row of its
section's list has nowhere to draw a picture, so the editor stops offering one:
`shownAsList(blocks, path)` answers the question from the tree, and the image row
is left out for those steps.

Two details it would be easy to get wrong:

- **It is the enclosing SECTION that decides, not the group the step sits in.** A
  ladder or a reps group on its own always runs as the countdown; inside a
  list-display section, its steps are listed. So the check walks ancestors for the
  nearest section rather than looking at the immediate parent.
- **A TIMED step in a list section still runs as the countdown**, because you
  watch the clock through a wall sit rather than reading a list. Its image shows,
  so its controls stay.

An image that is ALREADY set keeps its row, with the × that removes it and a line
saying it will not be shown. Hiding it would trap data: a step carrying a picture
that nothing in the app can remove.

There is no link field. Pasting a URL only made sense while the illustrations
lived on someone else's server — an image now comes from the catalogue (Choose) or
from this device (Upload), and `editor/postimages.ts`, which parsed postimages
share links and bare ids, went with it.

`engine/navigate.ts`'s `listMode()` is the authority — it has a third, positional
clause (the last remaining row of a group runs as the countdown) that this
deliberately drops, since a control appearing on whichever step happened to be
last, and moving when steps were reordered, is worse than one that is absent. A
test asserts the one-way property that matters: everything the runtime lists is
something the editor calls listed.

## Undo, and why typing collapses

`history.ts` is a `History<T>` of past, present and future, capped at 60 entries.
The interesting rule is **coalescing**: a run of keystrokes collapses into one undo
step, because undoing a rename one character at a time is useless, while any
discrete change — adding, deleting, reordering, changing a step's type, choosing
an image — earns its own step.

`push` takes the **field** being typed into, not a boolean, and only a push naming
the same field may replace the present. A flag collapsed too much, in two ways
that were both real:

- **Renaming a step and then the next one became one undo step**, since both were
  merely "text".
- **Every non-typing edit that shared the text path was absorbed** into whatever
  typing came before it. `patchSegment` coalesced anything that was not a role, so
  choosing pictures for two steps in a row collapsed into a single step and one
  undo took both back. `isTypedPatch` in `blocks.ts` now names the fields that are
  genuinely typed a character at a time — just `name` — and everything else is
  discrete.

The other half of "is it in the undo stack" is not writing when nothing changed.
The note, the alternative and the image link commit on blur, so tabbing through a
step used to leave undo steps that undid nothing visible; each now compares
against what is stored and returns if it matches. And an empty image box only
clears a **remote** link: an uploaded photo never had a link in there, so a stray
focus-and-blur must not delete it.

The caller says which field it is typing into, so there are no timers involved and
the behaviour is testable. Undo also ends a run, so typing after an undo does not
overwrite the state it just restored.

Name, colour and steps share **one** history entry, so undo restores a consistent
draft rather than states that can drift apart. Every mutation in the editor goes
through the same two helpers — `edit` and `editBlocks` — and `setHistory` is
touched nowhere else but undo and redo, so a new mutation cannot quietly bypass
the stack. Screen state that is not the routine (the extras row, the picker, the
lightbox, the help tray, the exit prompt) is deliberately outside it: undo should
not close a dialog.

## Files

| | |
|---|---|
| `blocks.ts` | The tree operations, the constructors, `setTiming`, `shownAsList`, and the new-routine template |
| `history.ts` | Undo/redo with coalescing |
| `dirty.ts` | Unsaved-change detection, compared **field by field** — `JSON.stringify` depends on key insertion order, and patching an object reorders keys |
| `images.ts` | The images a step can be given: the catalogue merged with library usage |
