/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useId, useLayoutEffect, useRef, useState, useEffect } from 'react'
import type { Ladder, Repeat, Section, Segment, SegmentRole } from '../../engine'
import type { Path, Timing } from '../../editor/blocks'
import { retypeSegment } from '../../editor/blocks'
import { weightFor } from '../../storage/weights'
import { ROW_ID, useRowDrag } from '../useRowDrag'
import { useDismiss } from '../useDismiss'
import { useMediaUrl } from '../useMediaUrl'
import { CountField } from '../CountField'
import { TimingField } from './TimingField'
import type { ImageView } from './ImageDialogs'
import {
  CloseIcon,
  CopyIcon,
  GripIcon,
  ImageIcon,
  MoreIcon,
  NoteIcon,
  PlusIcon,
  RepsIcon,
  TrashIcon,
} from '../icons'

export const ROLES: { role: SegmentRole; label: string }[] = [
  { role: 'prepare', label: 'Get ready' },
  { role: 'work', label: 'Work' },
  { role: 'rest', label: 'Rest' },
  { role: 'recover', label: 'Recover' },
]

export type RowProps = {
  path: Path
  depth: number
  onMove: (path: Path, delta: 1 | -1) => void
  onDuplicate: (path: Path) => void
  onRemove: (path: Path) => void
  /** Pointer handlers for this row's drag grip. See `useRowDrag`. */
  grip: ReturnType<typeof useRowDrag>['gripProps'] extends (id: string) => infer P ? P : never
  /** This row is being dragged, or is nested under the row that is. */
  dragging: boolean
}

/**
 * The grip: the whole of the reordering affordance, by pointer AND by keyboard.
 *
 * It answers the arrow keys because the Move up and Move down buttons are gone
 * from the step row now that a row can be dragged. A grip that took a pointer
 * and nothing else would have made reordering impossible without one, which is
 * not a trade removing those buttons was meant to make.
 *
 * Focus survives the move: rows are keyed by block id, so React moves the node
 * rather than rebuilding it, and the arrow key can be held down to walk a step
 * up through the routine.
 */
function Grip({ grip, onNudge }: { grip: RowProps['grip']; onNudge: (delta: 1 | -1) => void }) {
  return (
    <button
      type="button"
      className="erow__grip"
      aria-label="Reorder: drag, or use the arrow keys"
      title="Drag to reorder, or focus and use the arrow keys"
      onKeyDown={(event) => {
        const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : null
        if (delta === null) return
        // Or the list scrolls away under the row being moved.
        event.preventDefault()
        onNudge(delta)
      }}
      {...grip}
    >
      <GripIcon />
    </button>
  )
}

export function SegmentRow({
  segment,
  path,
  depth,
  last,
  listed,
  grip,
  dragging,
  onMove,
  onAdd,
  onDuplicate,
  onRemove,
  onPatch,
  onTiming,
  onClearText,
  onWrap,
  onPreview,
  onChoose,
}: RowProps & {
  /** Last child of its group, which is what makes a rest a between-reps rest. */
  last: boolean
  onAdd: (path: Path, role: SegmentRole) => void
  segment: Segment
  /** Shown as a row in a list while running, so it has no media panel. */
  listed: boolean
  onPatch: (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) => void
  onTiming: (path: Path, timing: Timing, typed?: boolean) => void
  onClearText: (path: Path, field: 'note' | 'alternative' | 'load') => void
  onWrap: (path: Path) => void
  onPreview: (view: ImageView) => void
  onChoose: (path: Path) => void
}) {
  const imageUrl = useMediaUrl(segment.media)

  /*
   * The rest that does not run after the final rep. Marked in the row itself
   * rather than explained in a help text somewhere: the rule is invisible in a
   * flat list of steps, and "3 reps of work and rest" reads as six steps until
   * something says otherwise.
   *
   * Same condition as the engine's: last child of a group, and the rest role.
   */
  const betweenRepsOnly = last && depth > 0 && segment.role === 'rest'

  /*
   * The how-to and the swap, on a line of their own BELOW the step.
   *
   * Shown only when the step has one, plus a button to add one, because a
   * routine is forty steps long and giving every row two more inputs would bury
   * the thing you came to change. But a pasted step usually has a note, the
   * instruction lifted out of its name, and losing it silently on the first edit
   * is what this exists to prevent.
   *
   * Emptying a field DELETES it rather than storing "", so the line disappears
   * again instead of leaving a blank one behind.
   */
  const [extras, setExtras] = useState(false)
  const hasExtras =
    segment.note !== undefined || segment.alternative !== undefined || segment.load !== undefined
  const showExtras = hasExtras || extras

  /*
   * Whether this row's controls are showing, which only means anything on a
   * narrow screen. Above the breakpoint in editor.css they are laid out inline
   * and always visible, and this flag is inert. CSS decides which of the two
   * the row is, so there is no width to measure here and nothing to get wrong on
   * a resize.
   */
  const [tools, setTools] = useState(false)
  /** True when the panel opens upward, because there is no room below the row. */
  const [toolsUp, setToolsUp] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const more = useRef<HTMLButtonElement>(null)
  const toolsId = useId()

  /*
   * Which way the panel opens, decided once per opening from the room actually
   * available.
   *
   * `useLayoutEffect`, so the flip is applied in the same frame the panel first
   * paints. A plain effect would show it hanging off the bottom for a frame and
   * then jump. Measured rather than expressed in CSS because CSS cannot ask; the
   * one thing that could, anchor positioning, is the reason `Menu` is hand-rolled
   * in the first place.
   *
   * The limit is the SCROLLER's visible box, not the viewport: the panel is
   * absolutely positioned inside `.editor__scroll`, so that is what clips it. And
   * it is measured against the BUTTON's box, because that is what the panel is
   * positioned against. The row is two lines tall on a phone, and taller again
   * with the note fields open, so its edges are nowhere near the button's.
   */
  useLayoutEffect(() => {
    if (!tools) return
    const box = more.current?.getBoundingClientRect()
    const height = panel.current?.offsetHeight
    if (!box || height === undefined) return

    const scroller = more.current?.closest('.editor__scroll')?.getBoundingClientRect()
    const top = scroller?.top ?? 0
    const bottom = scroller?.bottom ?? window.innerHeight

    // The gap in the CSS, so both agree on what "just below the row" means.
    const needed = height + 4
    const below = bottom - box.bottom
    const above = box.top - top
    // Only flip if it genuinely helps: with too little room on both sides, down
    // is the direction that can at least be scrolled to.
    setToolsUp(below < needed && above > below)
  }, [tools])
  /*
   * The panel and its trigger are "inside"; everything else, INCLUDING the rest
   * of this row, is outside and closes it. Scoping this to the whole row was
   * wrong: pressing the step's own name field left the panel hanging open over
   * the row below.
   *
   * The trigger has to count as inside, or the press would close the panel and
   * the click that follows would toggle it straight back open.
   */
  useDismiss(
    tools,
    () => setTools(false),
    (target) =>
      panel.current?.contains(target) === true || more.current?.contains(target) === true,
  )

  /*
   * Blur commits, so nothing is written until the field is left, and nothing at
   * all if it comes back unchanged. Without that guard, tabbing through a step
   * left an undo step that undid nothing visible.
   */
  const commitText = (field: 'note' | 'alternative' | 'load', value: string) => {
    const next = value.trim()
    if (next === (segment[field] ?? '')) return
    if (next === '') onClearText(path, field)
    else onPatch(path, { [field]: next })
  }

  return (
    <li
      className="erow"
      {...{ [ROW_ID]: segment.id }}
      data-depth={depth}
      data-dragging={dragging || undefined}
      data-role={segment.role}
      data-between-reps={betweenRepsOnly || undefined}
      /* Lifts this row over the ones below it, so an open panel is not painted
         under the next row, since later siblings paint on top by default. */
      data-tools={tools || undefined}
    >
      <div className="erow__main">
        <Grip grip={grip} onNudge={(delta) => onMove(path, delta)} />
        <select
          className="efield efield--role"
          value={segment.role}
          aria-label="Type of step"
          /* The name comes too, where it is still the old type's default. See
             `retypeSegment`. */
          onChange={(event) =>
            onPatch(path, retypeSegment(segment, event.target.value as SegmentRole))
          }
        >
          {/* A .tabata import can arrive with the 'custom' role, which has no
              add button. Offered here only when the step already has it, so
              the select does not show "Get ready" for a step that is not. */}
          {[...ROLES, ...(segment.role === 'custom' ? [{ role: 'custom' as const, label: 'Custom' }] : [])].map(({ role, label }) => (
            <option key={role} value={role}>
              {label}
            </option>
          ))}
        </select>

        <input
          className="efield efield--name"
          value={segment.name}
          aria-label="Step name"
          onChange={(event) => onPatch(path, { name: event.target.value })}
        />

        {betweenRepsOnly && (
          <span
            className="erow__between label label--sm"
            title="A rest belongs between sets, so this one does not run after the last set. To rest at the end too, put a rest step after the group."
          >
            between sets
          </span>
        )}

        <TimingField
          segment={segment}
          onChange={(timing, typed) => onTiming(path, timing, typed)}
        />

        {/*
          Every button the row has, in one group. On a narrow screen, a group that
          is not in the row at all.

          Below the breakpoint in editor.css this is a panel: hidden until the ⋯
          button opens it, absolutely positioned, so it is out of the row's flow
          and the row itself is just its fields. Above the breakpoint it is laid
          out inline at the trailing edge and the ⋯ button is gone. CSS decides
          which, so there is no width measured in JS and nothing to correct on a
          resize.

          Wrapping the buttons like this is only safe BECAUSE of that split. As a
          wrapping flex item inside the row it was a disaster. A flex item is
          placed by its max-content width, ~380pt here, so it could never share a
          phone's line and took one of its own. Above the breakpoint the whole row
          fits on one line by construction, so there is no wrapping left to get
          wrong.
        */}
        {/*
          Exists to be the panel's anchor: the panel is positioned against THIS,
          so it opens directly under (or over) the ⋯ button rather than under the
          whole row. Above the breakpoint the panel is laid out inline inside it
          and the wrapper is just the flex item that holds the trailing edge.
        */}
        <div className="erow__menu">
        <div
          ref={panel}
          id={toolsId}
          className="erow__tools"
          data-open={tools || undefined}
          data-up={(tools && toolsUp) || undefined}
          role="group"
          aria-label={`Controls for ${segment.name}`}
          /* Anything in here is a deed, and a panel left open over a row that has
             just moved, or been deleted, points at nothing. Inert above the
             breakpoint, where the panel is the row and nothing is open. */
          onClick={() => setTools(false)}
        >
          <div className="erow__own">
            {segment.media !== undefined ? (
              <button
                type="button"
                className="erow__thumb"
                onClick={() =>
                  onPreview({ path, src: imageUrl, alt: segment.name, unseen: listed })
                }
                aria-label={`Image for ${segment.name}. Preview or remove it.`}
                title="Preview image"
              >
                {/* Empty frame when the ref is set and its file is not on this
                    device. The button still opens, because that is the only way
                    left to remove it. */}
                {imageUrl && <img src={imageUrl} alt="" />}
              </button>
            ) : (
              !listed && (
                <button
                  type="button"
                  className="btn btn--ghost erow__image"
                  onClick={() => onChoose(path)}
                  aria-label={`Add an image to ${segment.name}`}
                  title="Add an image"
                >
                  <ImageIcon />
                </button>
              )
            )}

            <button
              className="btn btn--ghost erow__note"
              onClick={() => setExtras((open) => !open)}
              aria-pressed={showExtras}
              disabled={hasExtras}
              aria-label="Add a note or an alternative"
              title={
                hasExtras
                  ? 'Note and alternative are shown below. Empty them to remove.'
                  : 'Add a note or an alternative'
              }
            >
              <NoteIcon />
            </button>
          </div>

          <div className="erow__actions">
            {/*
              Adds a FRESH step of the same type below, where duplicate beside it
              copies this one. Same type because that is what "another" means on a
              row: plus on a 20s work step gives another work step at its default
              length, not a copy of this one's name and image.
            */}
            <button
              className="btn btn--ghost"
              onClick={() => onAdd(path, segment.role)}
              aria-label={`Add a ${segment.role} step below`}
              title="Add a step below"
            >
              <PlusIcon />
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => onWrap(path)}
              disabled={depth > 0}
              aria-label="Repeat this step"
              title={depth > 0 ? 'Already inside sets' : 'Repeat this step'}
            >
              <RepsIcon />
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => onDuplicate(path)}
              aria-label="Duplicate step"
              title="Duplicate step"
            >
              <CopyIcon />
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => onRemove(path)}
              aria-label="Delete step"
              title="Delete step"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {/*
          Opens the panel, and only exists while there is no room to show it. The
          eight buttons need about 380pt of a row; a phone has about 311pt, and
          shrinking them to fit lands at 36px, well under the touch guideline. So
          on a narrow screen the row shows its fields and one way in to the rest.
        */}
        <button
          ref={more}
          type="button"
          className="btn btn--ghost erow__more"
          aria-haspopup="true"
          aria-expanded={tools}
          aria-controls={toolsId}
          onClick={() => setTools((open) => !open)}
          aria-label={`Controls for ${segment.name}`}
          title="Image, note and step controls"
        >
          <MoreIcon />
        </button>
        </div>
      </div>

      {showExtras && (
        /*
         * Both fields are uncontrolled (committed on blur, so a note is one
         * undo step) but KEYED on the committed value: undo rewrites that value
         * under the field, and an uncontrolled input left standing would show
         * the old text and re-commit it on the next blur, silently redoing what
         * undo undid. A new key remounts the field with the truth.
         */
        <div className="erow__extras">
          <label className="erow__extra">
            <span className="label label--sm">Note</span>
            <input
              key={segment.note ?? ''}
              className="efield"
              defaultValue={segment.note ?? ''}
              placeholder="How to do it"
              aria-label="Note"
              onBlur={(event) => commitText('note', event.target.value)}
            />
          </label>
          <label className="erow__extra">
            <span className="label label--sm">Or</span>
            <input
              key={segment.alternative ?? ''}
              className="efield"
              defaultValue={segment.alternative ?? ''}
              placeholder="Lower-impact swap"
              aria-label="Alternative"
              onBlur={(event) => commitText('alternative', event.target.value)}
            />
          </label>
          {/*
            Free text, because half of what a routine loads is not a number: a
            band has a colour and a press-up has your own weight. Weights used to
            be typed into the step NAME, which made the name carry two things and
            put the count and the load next to each other in one heading.

            EMPTY IS NOT UNLOADED. An empty field means "whatever I lift for
            this", and the weight comes from Settings when the routine runs, so
            the placeholder shows what that would be rather than an example.
            Typing here overrides it for this routine only.
          */}
          <div className="erow__extra erow__extra--load">
            <span className="label label--sm">Weight</span>
            <LoadField
              /* Keyed on the committed value, like the two fields above and for
                 the same reason: undo rewrites it underneath. */
              key={segment.load ?? ''}
              value={segment.load ?? ''}
              hint={weightFor(segment.name)}
              name={segment.name}
              onCommit={(next) => commitText('load', next)}
            />
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * The weight field, with a way to empty it.
 *
 * Emptying it is a REAL ACTION here, not a lack of one: an empty load means
 * "whatever I lift for this", so clearing the field is how a step stops
 * overriding the weights page and starts following it. Selecting three
 * characters and pressing delete is a poor way to express that, hence the ×.
 *
 * Controlled, unlike the note and alternative beside it, because the × has to
 * change what the field shows and commit in the same gesture. Typing still
 * commits on blur, so a weight is one undo step rather than one per keystroke.
 */
function LoadField({
  value,
  hint,
  name,
  onCommit,
}: {
  value: string
  /** What the weights page would supply. Shown once the field is empty. */
  hint: string
  name: string
  onCommit: (value: string) => void
}) {
  const [text, setText] = useState(value)

  return (
    <span className="efield-clearable">
      <input
        className="efield"
        value={text}
        /*
         * The hint is the weight this step would use if left alone, so an empty
         * field answers the question it raises. Only where there is nothing to
         * fall back on does it show an example instead.
         */
        placeholder={hint || '65kg, red band'}
        aria-label="Weight"
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => onCommit(event.target.value)}
      />
      {text !== '' && (
        <button
          type="button"
          className="efield-clear"
          aria-label={`Clear the weight for ${name}`}
          title={hint ? `Clear, and use ${hint} from the weights page` : 'Clear'}
          /* Blur would otherwise fire first and commit the old text, and on a
             touch device the field would keep it. */
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setText('')
            onCommit('')
          }}
        >
          <CloseIcon />
        </button>
      )}
    </span>
  )
}

export function RepeatRow({
  repeat,
  path,
  depth,
  grip,
  dragging,
  onMove,
  onDuplicate,
  onRemove,
  onPatch,
  onAddChild,
  onUnwrap,
}: RowProps & {
  repeat: Repeat
  onPatch: (path: Path, patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>) => void
  onAddChild: (path: Path) => void
  onUnwrap: (path: Path) => void
}) {
  return (
    <li
      className="erow erow--repeat"
      {...{ [ROW_ID]: repeat.id }}
      data-depth={depth}
      data-dragging={dragging || undefined}
    >
      <div className="erow__main">
        <Grip grip={grip} onNudge={(delta) => onMove(path, delta)} />
        {/* The kind, named. The label field is free text, so a row whose label
            said "Set" or "Round" gave no other clue what it was. */}
        <span className="erow__kind label label--sm">Sets</span>
        <input
          className="efield efield--name"
          value={repeat.label ?? 'Set'}
          aria-label="Set label"
          onChange={(event) => onPatch(path, { label: event.target.value })}
        />

        <label className="esecs">
          <span className="unit">&times;</span>
          <CountField
            value={repeat.times}
            max={99}
            label="Number of sets"
            onCommit={(times) => onPatch(path, { times })}
          />
        </label>

        <div className="erow__actions">
          <button
            className="btn btn--ghost"
            onClick={() => onAddChild(path)}
            aria-label="Add a step to these sets"
            title="Add a step inside"
          >
            <PlusIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onUnwrap(path)}
            aria-label="Ungroup these sets"
            title="Ungroup. Keeps the steps, drops the group."
          >
            <RepsIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onDuplicate(path)}
            aria-label="Duplicate these sets"
            title="Duplicate sets and steps"
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onRemove(path)}
            aria-label="Delete these sets and their steps"
            title="Delete sets and steps"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  )
}

/** A rung of zero reps is nothing to do; refuse it rather than compile it away. */
const parseCounts = (text: string): number[] =>
  text
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number)
    .filter((count) => count > 0)

/**
 * A ladder's rungs, edited as the text they are written as.
 *
 * "5-10-15-20-15-10-5" is how the routines state a ladder and how anyone thinks
 * about one; a row of number inputs would be nine controls for one idea. Parsed
 * on every keystroke and left alone when it does not parse, so a half-typed
 * "5-10-" does not wipe the rungs behind it.
 */
export function LadderRow({
  ladder,
  path,
  depth,
  grip,
  dragging,
  onMove,
  onDuplicate,
  onRemove,
  onPatch,
  onAddChild,
}: RowProps & {
  ladder: Ladder
  onPatch: (path: Path, patch: Partial<Omit<Ladder, 'kind' | 'id' | 'children'>>) => void
  onAddChild: (path: Path) => void
}) {
  const [draft, setDraft] = useState(ladder.counts.join('-'))

  /*
   * Undo and redo rewrite the rungs UNDER the field. A draft that parses to
   * something else is stale: left standing, the next keystroke would re-commit
   * the undone rungs. A draft that parses to nothing is someone mid-clear, and
   * resyncing under their cursor would fight the typing; blur tidies that case.
   */
  useEffect(() => {
    const parsed = parseCounts(draft)
    const same =
      parsed.length === ladder.counts.length && parsed.every((n, i) => n === ladder.counts[i])
    if (!same && parsed.length > 0) setDraft(ladder.counts.join('-'))
  }, [ladder.counts, draft])

  return (
    <li
      className="erow erow--ladder"
      {...{ [ROW_ID]: ladder.id }}
      data-depth={depth}
      data-dragging={dragging || undefined}
    >
      <div className="erow__main">
        <Grip grip={grip} onNudge={(delta) => onMove(path, delta)} />
        <span className="erow__kind label label--sm">Ladder</span>
        <input
          className="efield efield--name"
          value={ladder.label ?? 'Rung'}
          aria-label="Ladder label"
          onChange={(event) => onPatch(path, { label: event.target.value })}
        />

        <label className="esecs esecs--counts">
          <input
            className="efield efield--counts"
            value={draft}
            inputMode="numeric"
            aria-label="Reps at each rung"
            placeholder="5-10-15"
            onChange={(event) => {
              setDraft(event.target.value)
              const counts = parseCounts(event.target.value)
              if (counts.length > 0) onPatch(path, { counts })
            }}
            onBlur={() => setDraft(ladder.counts.join('-'))}
          />
        </label>

        <span className="erow__count label label--sm">
          {ladder.counts.length} {ladder.counts.length === 1 ? 'set' : 'sets'}
        </span>

        <div className="erow__actions">
          <button
            className="btn btn--ghost"
            onClick={() => onAddChild(path)}
            aria-label="Add a step to this ladder"
            title="Add a step inside"
          >
            <PlusIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onDuplicate(path)}
            aria-label="Duplicate this ladder"
            title="Duplicate ladder and steps"
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onRemove(path)}
            aria-label="Delete this ladder and its steps"
            title="Delete ladder and steps"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  )
}

/**
 * A named part of the routine.
 *
 * The note is a field rather than something the editor hides, because a pasted
 * section carries one, such as "No rest between exercises. Rest 45 seconds after
 * each round.", and an editor that cannot show it is an editor that quietly loses it
 * the first time someone rewrites the section.
 */
export function SectionRow({
  section,
  path,
  depth,
  grip,
  dragging,
  onMove,
  onDuplicate,
  onRemove,
  onPatch,
  onAddChild,
}: RowProps & {
  section: Section
  onPatch: (path: Path, patch: Partial<Omit<Section, 'kind' | 'id' | 'children'>>) => void
  onAddChild: (path: Path) => void
}) {
  return (
    <li
      className="erow erow--section"
      {...{ [ROW_ID]: section.id }}
      data-depth={depth}
      data-dragging={dragging || undefined}
    >
      <div className="erow__main">
        <Grip grip={grip} onNudge={(delta) => onMove(path, delta)} />
        <span className="erow__kind label label--sm">Section</span>
        <input
          className="efield efield--name efield--section"
          value={section.name}
          aria-label="Section name"
          onChange={(event) => onPatch(path, { name: event.target.value })}
        />

        <div className="erow__actions">
          <button
            className="btn btn--ghost"
            onClick={() => onAddChild(path)}
            aria-label="Add a step to this section"
            title="Add a step inside"
          >
            <PlusIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onDuplicate(path)}
            aria-label="Duplicate this section"
            title="Duplicate section and everything in it"
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onRemove(path)}
            aria-label="Delete this section and everything in it"
            title="Delete section and everything in it"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <input
        className="efield efield--note"
        value={section.note ?? ''}
        aria-label="Section instruction"
        placeholder="Instruction for the whole section"
        onChange={(event) => onPatch(path, { note: event.target.value })}
      />
    </li>
  )
}
