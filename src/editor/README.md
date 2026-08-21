# editor

Pure operations on a routine's block tree, plus undo. The editor screen itself
lives in `ui/` and is a thin shell over these.

## Paths, and immutability

A `Path` is the chain of indices to reach a block: `[2]` is the third top-level
block, `[1, 0]` the first child of the second. Every operation returns a new tree
and never mutates its input, which is what lets undo keep old trees rather than
replaying inverse operations.

## Rules worth knowing

- **`moveStep` moves a row through the routine as it *reads*.** Next to a round it
  moves *into* it — first child going down, last going up; next to a step it swaps;
  at the edge of a round it steps *outside*. `moveBy` only reorders among
  siblings, which left a step trapped inside or outside a round.
- **Rounds only ever swap.** `wrapInRepeat` refuses to nest a round inside a
  round: the editor renders two levels, and a deeper tree would be invisible and
  un-editable. The *data model* supports any depth, so lifting this is a UI
  decision, not a schema one.
- **A move past either end is a no-op** rather than an error, so holding a button
  cannot corrupt the tree.
- **A round left empty by a departing step is kept, not pruned.** A group
  vanishing under you is more surprising than an empty one you can delete.
- **`duplicateAt` deep-copies with fresh ids.** The editor keys its rows by
  `block.id`, so a copy that kept them would give two rows the same React key.
- **`clearMedia` exists because of `exactOptionalPropertyTypes`** — you cannot
  patch a key to `undefined`, and clearing an image means *deleting* the key so
  the property is absent rather than present-and-undefined.
- **Defaults match the real routines**: 30s to get set, 20s of work, 10s rest, 60s
  recovery. An added step usually needs no editing. Don't tidy these to round
  numbers.

## Undo, and why typing collapses

`history.ts` is a `History<T>` of past, present and future, capped at 60 entries.
The interesting rule is **coalescing**: a run of text edits collapses into one undo
step, because undoing a rename one character at a time is useless, while any
discrete change — adding, deleting, reordering, changing a step's type — ends the
run and earns its own step.

The caller says which kind of edit it is making, so there are no timers involved
and the behaviour is testable. Undo also ends a run, so typing after an undo does
not overwrite the state it just restored.

Name and steps share **one** history entry, so undo restores a consistent draft
rather than two states that can drift apart. Every mutation in the editor goes
through the same two helpers and there is no `setBlocks` — a new mutation
therefore cannot quietly bypass undo.

## Files

| | |
|---|---|
| `blocks.ts` | The tree operations, the constructors, and the new-routine template |
| `history.ts` | Undo/redo with coalescing |
| `dirty.ts` | Unsaved-change detection, compared **field by field** — `JSON.stringify` depends on key insertion order, and patching an object reorders keys |
| `images.ts` | The images a step can be given: the catalogue merged with library usage |
| `postimages.ts` | Accepts a direct link, a share link or a bare id |
