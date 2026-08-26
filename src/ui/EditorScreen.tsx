/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Block, Ladder, MediaRef, Repeat, RoutineColour, Section, Segment, SegmentRole, Workout } from '../engine'
import { ROUTINE_COLOURS, stepCount, totalDurationMs } from '../engine'
import {
  appendTo,
  clearMedia,
  clearText,
  duplicateAt,
  flatten,
  insertAfter,
  moveBy,
  moveStep,
  newLadder,
  newRepeat,
  newRepsStep,
  newSection,
  newSegment,
  removeAt,
  retypeSegment,
  isTypedPatch,
  setTiming,
  shownAsList,
  timingOf,
  unwrapRepeat,
  updateLadder,
  updateRepeat,
  updateSection,
  updateSegment,
  wrapInRepeat,
} from '../editor/blocks'
import type { Timing } from '../editor/blocks'
import type { Path } from '../editor/blocks'
import { isDirty } from '../editor/dirty'
import type { KnownImage } from '../editor/images'
import { canRedo, canUndo, initHistory, push, redo, undo } from '../editor/history'
import { ROW_ID, useRowDrag } from './useRowDrag'
import { HelpTray } from './HelpTray'
import { NoticeDialog } from './NoticeDialog'
import { EDITOR_HELP } from './help'
import type { ClipboardImage } from '../media/clipboard'
import { canReadClipboard, imageFromClipboard, probeClipboardImage } from '../media/clipboard'
import { pinDraft, storeFile, unpinDraft } from '../media/pin'
import { duration } from './format'
import { useMediaUrl } from './useMediaUrl'
import { useDismiss } from './useDismiss'
import {
  BackIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  HelpIcon,
  ImageIcon,
  ImportIcon,
  MoreIcon,
  GripIcon,
  NoteIcon,
  PasteIcon,
  PlusIcon,
  RedoIcon,
  RepsIcon,
  TrashIcon,
  UndoIcon,
} from './icons'
import './editor.css'

/** One undo step: name, colour and steps together, so they cannot drift apart. */
type Draft = { name: string; blocks: Block[]; colour: RoutineColour | null }

const ROLES: { role: SegmentRole; label: string }[] = [
  { role: 'prepare', label: 'Get ready' },
  { role: 'work', label: 'Work' },
  { role: 'rest', label: 'Rest' },
  { role: 'recover', label: 'Recover' },
]

/**
 * A step's image, as the preview dialog needs it.
 *
 * Carries the `path` because Remove lives in the dialog now rather than in the
 * row. `src` may be null: a stored ref whose file is not on this device still has
 * to be viewable enough to be removed.
 */
type ImageView = { path: Path; src: string | null; alt: string; unseen: boolean }

/**
 * A step's picture, and the way to take it off.
 *
 * Both in one dialog because they are the same errand: you open the preview to
 * see what the step is carrying, and the only thing you might want to do about it
 * is get rid of it. The row shows a 42px thumbnail, which is enough to recognise
 * an image and not enough to check it.
 *
 * The `.modal` sheet plus a panel of its own, like every other dialog here. A
 * `<dialog>` styled as the box does not hug its content on iOS, and the panel is
 * `.notice` because that layout is already known to survive it. A click that
 * lands on the sheet is a backdrop click; the panel and its children never match.
 */
function ImageDialog({
  view,
  onRemove,
  onClose,
}: {
  view: ImageView
  onRemove: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      {/* The panel is its own element. See `.modal` in theme.css. */}
      <div className="notice imgview">
        {view.src ? (
          <img className="imgview__img" src={view.src} alt={view.alt} />
        ) : (
          /*
           * The step carries a ref whose file is not here: an uploaded photo
           * that arrived in an export without its blob. Saying so beats an empty
           * frame, and Remove is offered anyway: the alternative is a step with a
           * picture nothing can show and nothing can take off.
           */
          <p className="imgview__missing label label--sm">
            This image is not on this device, so it cannot be shown.
          </p>
        )}

        {view.alt !== '' && <p className="notice__text">{view.alt}</p>}

        {/* Only for a step that runs as a row of its section's list, where the
            picture it is holding will never be drawn. */}
        {view.unseen && (
          <p className="notice__detail label label--sm">
            Not shown while running. This step appears as a row in its section’s list.
          </p>
        )}

        <div className="notice__actions">
          {/* Close first and focused, so a stray Enter or space keeps the picture.
              The same order, for the same reason, as ConfirmDialog. */}
          <button type="button" className="chip" onClick={onClose} autoFocus>
            <CloseIcon />
            Close
          </button>
          {/* A trash can is unambiguous HERE: the row's own trash can, which
              deletes the whole step, is nowhere in sight, and the word says what
              goes. In the row itself it could only have meant one of the two. */}
          <button type="button" className="chip chip--danger" onClick={onRemove}>
            <TrashIcon />
            Remove image
          </button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * Where a step's image comes from: the catalogue, or this device.
 *
 * Visual rather than a list of urls: the point is to recognise the machine, not
 * to read a postimages id. Filtered by name once there are enough to scroll.
 *
 * Both ways in live in one dialog because the question is one question, "what
 * picture goes on this step", and splitting it across two buttons in the row is
 * what made the old image row a row.
 */
function ImagePicker({
  images,
  onPick,
  onUpload,
  onError,
  onClose,
}: {
  images: readonly KnownImage[]
  onPick: (ref: MediaRef) => void
  onUpload: (file: Blob) => void
  onError: (message: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const upload = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [clipboard, setClipboard] = useState<ClipboardImage>(() =>
    canReadClipboard() ? 'unknown' : 'unsupported',
  )

  useEffect(() => {
    // Guarded like every other dialog here: StrictMode runs effects twice in
    // dev, and showModal() on an already-open dialog throws.
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  /*
   * Whether the clipboard holds an image, re-asked whenever this window comes
   * back to the front — you copy the screenshot in another app and return, with
   * this dialog still open behind it.
   *
   * `probeClipboardImage` reads nothing where a read would prompt, so this
   * cannot put a paste confirmation on the screen. See `media/clipboard.ts`.
   */
  useEffect(() => {
    if (!canReadClipboard()) return

    let live = true
    let latest = 0
    const probe = () => {
      if (document.visibilityState !== 'visible') return
      const token = ++latest
      // A slow probe must not land on top of a later, fresher one: focus and
      // visibilitychange can fire together, and the reads settle out of order.
      void probeClipboardImage().then((state) => {
        if (live && token === latest) setClipboard(state)
      })
    }

    probe()
    window.addEventListener('focus', probe)
    document.addEventListener('visibilitychange', probe)
    return () => {
      live = false
      window.removeEventListener('focus', probe)
      document.removeEventListener('visibilitychange', probe)
    }
  }, [])

  /*
   * Must run from the click and not a moment later: this is the call that spends
   * the user activation Safari and Firefox demand.
   */
  const paste = async () => {
    try {
      const blob = await imageFromClipboard()
      if (!blob) {
        // Only reachable from `unknown`, since `none` disables the button. Now
        // it is known, so the button goes with it rather than inviting a retry
        // that would fail the same way.
        setClipboard('none')
        onError('There is no image on the clipboard — copy one and try again')
        return
      }
      onUpload(blob)
    } catch {
      onError(
        'The clipboard could not be read — allow this site to see it, or use Upload a photo instead',
      )
    }
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? images.filter((i) => i.label.toLowerCase().includes(needle)) : images
  }, [images, query])

  return (
    <dialog
      ref={dialog}
      className="modal"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      {/* The panel is its own element. See `.modal` in theme.css. */}
      <div className="picker">
      <header className="picker__head">
        <h2 className="picker__title label label--sm">Add an image</h2>
        <input
          className="efield"
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search images"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <CloseIcon />
        </button>
      </header>

      {shown.length === 0 ? (
        <p className="picker__empty label label--sm">
          {images.length === 0
            ? 'No illustrations available'
            : `Nothing matches “${query}”`}
        </p>
      ) : (
        <ul className="picker__grid">
          {shown.map((image) => (
            <li key={image.id}>
              <button type="button" className="picker__item" onClick={() => onPick(image.ref)}>
                {/* `src` is not the stored ref: a bundled image stores a path and
                    renders through BASE_URL. */}
                <img src={image.src} alt="" loading="lazy" />
                <span className="picker__label">{image.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Under the grid rather than beside the search box: these are the way in for
        the exercise the catalogue does not have, and a distraction for everyone
        else. The same placement, for the same reason, as Copy template in the
        paste dialog.
      */}
      <div className="picker__actions">
        <button
          type="button"
          className="chip chip--action"
          onClick={() => upload.current?.click()}
          title="Use a photo from this device"
        >
          <ImportIcon />
          Upload a photo
        </button>
        {/*
          Disabled only when we KNOW there is nothing to paste, or when this
          browser cannot read a clipboard at all. Where the answer is unknowable
          without a gesture it stays enabled and the tap finds out — a button
          that is permanently grey on the device the app is used on would be a
          worse lie than an occasional "nothing there".
        */}
        <button
          type="button"
          className="chip chip--action"
          disabled={clipboard === 'none' || clipboard === 'unsupported'}
          onClick={() => void paste()}
          title={
            clipboard === 'unsupported'
              ? 'This browser cannot read the clipboard'
              : clipboard === 'none'
                ? 'There is no image on the clipboard'
                : 'Use the image on the clipboard'
          }
        >
          <PasteIcon />
          Paste from clipboard
        </button>
        <input
          ref={upload}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared so choosing the SAME file again still fires a change.
            event.target.value = ''
            if (file) onUpload(file)
          }}
        />
      </div>
      </div>
    </dialog>
  )
}

type RowProps = {
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

/**
 * What a step asks of you, as one control.
 *
 * The unit IS the mode, which is why this is a single select rather than a mode
 * switch plus a value plus a per-side toggle: "20 s", "12 ×", "5 × each side"
 * and "rung" are four things a row can say, and an editor row has no space for
 * three widgets to say them.
 */
const UNITS: { value: string; label: string; title: string }[] = [
  { value: 'timed', label: 's', title: 'Seconds. The step times itself.' },
  { value: 'reps', label: '×', title: 'Reps. The step waits for Next.' },
  { value: 'reps-side', label: '× each side', title: 'Reps per side. The step waits for Next.' },
  { value: 'rung', label: 'rung', title: "Takes its count from the ladder's current rung" },
  { value: 'rung-side', label: 'rung each side', title: "The ladder's rung, per side" },
]

function unitOf(timing: Timing): string {
  if (timing.kind === 'timed') return 'timed'
  return timing.perSide ? `${timing.kind}-side` : timing.kind
}

/** The single field a group patch carries, for keying a run of keystrokes. */
function keyOf(patch: object): string {
  return Object.keys(patch).join(',')
}

/** The number the field shows, and what a change to it means. */
/**
 * A whole-number field that commits as it is typed, clamped into [1, max].
 *
 * The draft exists so the field can be CLEARED while retyping: committing the
 * empty string used to snap the value to 1 under the cursor. It also holds raw
 * text past the cap, because the `max` attribute only guards the spinners; the
 * COMMITTED value is clamped, and blur tidies the field to it.
 */
function CountField({
  value,
  max,
  label,
  onCommit,
}: {
  value: number
  max: number
  label: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const lastCommit = useRef<number | null>(null)

  // An outside change (undo, redo) rewrites the value under the field. A draft
  // left standing would mask it, and the next blur would re-commit stale text.
  useEffect(() => {
    if (value !== lastCommit.current) setDraft(null)
  }, [value])

  return (
    <input
      className="efield efield--secs"
      type="number"
      min={1}
      max={max}
      value={draft ?? String(value)}
      aria-label={label}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const entered = Number(text)
        if (text === '' || !Number.isFinite(entered)) return
        const clamped = Math.min(max, Math.max(1, Math.round(entered)))
        lastCommit.current = clamped
        onCommit(clamped)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

function TimingField({
  segment,
  onChange,
}: {
  segment: Segment
  /** `typed` marks a keystroke in the number box, as opposed to the unit select. */
  onChange: (timing: Timing, typed?: boolean) => void
}) {
  const timing = timingOf(segment)
  const unit = unitOf(timing)
  const counted = timing.kind === 'reps'

  const retarget = (next: string) => {
    const perSide = next.endsWith('-side')
    if (next.startsWith('rung')) return onChange({ kind: 'rung', ...(perSide ? { perSide } : {}) })
    if (next.startsWith('reps')) {
      const count = counted ? timing.count : 10
      return onChange({ kind: 'reps', count, ...(perSide ? { perSide } : {}) })
    }
    onChange({ kind: 'timed', durationMs: segment.durationMs ?? 20_000 })
  }

  const value = timing.kind === 'timed' ? Math.round(timing.durationMs / 1000) : counted ? timing.count : 0

  return (
    <label className="esecs">
      {/* A rung has no number of its own. That is the point of it. */}
      {timing.kind !== 'rung' && (
        <CountField
          value={value}
          max={timing.kind === 'timed' ? 5999 : 999}
          label={timing.kind === 'timed' ? 'Seconds' : 'Reps'}
          onCommit={(entered) =>
            onChange(
              timing.kind === 'timed'
                ? { kind: 'timed', durationMs: entered * 1000 }
                : { kind: 'reps', count: entered, ...(timing.perSide ? { perSide: true } : {}) },
              true,
            )
          }
        />
      )}
      {/* `data-unit` is for the stylesheet: a native select is as wide as its
          LONGEST option, which is how showing "s" cost the width of "rung each
          side". See `.efield--unit` in editor.css. */}
      <select
        className="efield efield--unit unit"
        data-unit={unit}
        value={unit}
        aria-label="Timed or counted"
        onChange={(event) => retarget(event.target.value)}
      >
        {UNITS.map((option) => (
          <option key={option.value} value={option.value} title={option.title}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SegmentRow({
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
  onClearText: (path: Path, field: 'note' | 'alternative') => void
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
  const hasExtras = segment.note !== undefined || segment.alternative !== undefined
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
  const commitText = (field: 'note' | 'alternative', value: string) => {
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
          {ROLES.map(({ role, label }) => (
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
            title="A rest belongs between reps, so this one does not run after the last rep. To rest at the end too, put a rest step after the group."
          >
            between reps
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
              title={depth > 0 ? 'Already inside reps' : 'Repeat this step'}
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
        </div>
      )}
    </li>
  )
}

function RepeatRow({
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
        <input
          className="efield efield--name"
          value={repeat.label ?? 'Reps'}
          aria-label="Reps label"
          onChange={(event) => onPatch(path, { label: event.target.value })}
        />

        <label className="esecs">
          <span className="unit">&times;</span>
          <CountField
            value={repeat.times}
            max={99}
            label="Number of reps"
            onCommit={(times) => onPatch(path, { times })}
          />
        </label>

        <div className="erow__actions">
          <button
            className="btn btn--ghost"
            onClick={() => onAddChild(path)}
            aria-label="Add a step to these reps"
            title="Add a step inside"
          >
            <PlusIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onUnwrap(path)}
            aria-label="Ungroup these reps"
            title="Ungroup. Keeps the steps, drops the repeat."
          >
            <RepsIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onDuplicate(path)}
            aria-label="Duplicate these reps"
            title="Duplicate reps and steps"
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onRemove(path)}
            aria-label="Delete these reps and their steps"
            title="Delete reps and steps"
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
function LadderRow({
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
        <input
          className="efield efield--name"
          value={ladder.label ?? 'Set'}
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
function SectionRow({
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

export function EditorScreen({
  workout,
  knownImages,
  onSave,
  onCancel,
}: {
  workout: Workout
  /** Images already used across the library, offered by the picker. */
  knownImages: readonly KnownImage[]
  onSave: (workout: Workout) => void
  onCancel: () => void
}) {
  /**
   * Name and steps live in ONE history entry, so undo restores a consistent
   * draft rather than two states that can drift apart.
   */
  const [history, setHistory] = useState(() =>
    initHistory<Draft>({
      name: workout.name,
      blocks: workout.blocks,
      colour: workout.colour ?? null,
    }),
  )
  const { name, blocks, colour } = history.present
  const [confirmingExit, setConfirmingExit] = useState(false)
  const [helping, setHelping] = useState(false)
  const [imagePreview, setImagePreview] = useState<ImageView | null>(null)
  /** The step whose image is being chosen, or null when the picker is closed. */
  const [choosingFor, setChoosingFor] = useState<Path | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /**
   * `typing` names the field a keystroke belongs to, so a run in ONE field
   * collapses into a single undo step. Everything else is discrete and gets a step
   * of its own: adding, deleting, reordering, changing a step's type, choosing an
   * image.
   */
  const edit = (next: (draft: Draft) => Draft, typing: string | null = null) =>
    setHistory((current) => push(current, next(current.present), typing))

  const editBlocks = (op: (blocks: Block[]) => Block[], typing: string | null = null) =>
    edit((draft) => ({ ...draft, blocks: op(draft.blocks) }), typing)

  /**
   * Identifies the field being typed into.
   *
   * Per field, not per screen: with one shared flag, renaming a step and then
   * renaming the next one were a single undo step.
   */
  const typingIn = (path: Path, field: string) => `${path.join('.')}:${field}`

  const rows = useMemo(() => flatten(blocks), [blocks])

  /**
   * Dragging a row, which is `moveStep` called once per row crossed.
   *
   * `'drag'` is the coalescing key, the same mechanism a run of keystrokes uses:
   * every step of one drag replaces the last rather than stacking, so undo takes
   * the whole drag back in one press instead of one press per row passed.
   */
  /**
   * The live draft, for the drag loop.
   *
   * The loop runs on animation frames and can apply several moves before React
   * re-renders, so a `blocks` captured in the callback's closure would be stale
   * by the second one and every step after the first would be computed from the
   * position the row started in.
   */
  const historyRef = useRef(history)
  historyRef.current = history

  const list = useRef<HTMLUListElement>(null)
  /** The tree as it was before the drag, for Escape to put back. */
  const beforeDrag = useRef<Block[] | null>(null)
  const drag = useRowDrag({
    list,
    onStep: (id, delta) => {
      const row = flatten(historyRef.current.present.blocks).find(
        ({ block }) => block.id === id,
      )
      if (!row) return
      if (beforeDrag.current === null) beforeDrag.current = historyRef.current.present.blocks
      editBlocks((current) => moveStep(current, row.path, delta), 'drag')
    },
    onEnd: () => {
      beforeDrag.current = null
    },
    onCancel: () => {
      const original = beforeDrag.current
      beforeDrag.current = null
      if (original) editBlocks(() => original, 'drag')
    },
  })

  /** Which rows travel with the one being dragged: a group takes its children. */
  const heldPath = drag.draggingId
    ? (rows.find(({ block }) => block.id === drag.draggingId)?.path ?? null)
    : null
  const held = (path: Path): boolean =>
    heldPath !== null && path.length >= heldPath.length && heldPath.every((at, i) => path[i] === at)

  /*
   * `colour` is optional on a Workout, and under exactOptionalPropertyTypes a key
   * set to undefined is not the same as an absent key. So the untinted case
   * DELETES the key rather than assigning undefined, which also keeps exported
   * JSON free of `"colour": null`.
   */
  const preview = useMemo(() => {
    const { colour: _previous, ...rest } = workout
    return colour ? { ...rest, name, blocks, colour } : { ...rest, name, blocks }
  }, [workout, name, blocks, colour])
  const dirty = useMemo(
    () => isDirty(workout, name, blocks, colour),
    [workout, name, blocks, colour],
  )

  const pinnedUploads = useRef<string[]>([])
  useEffect(
    () => () => {
      for (const hash of pinnedUploads.current) unpinDraft(hash)
    },
    [],
  )

  // Also catch a reload or a closed tab, not just the back button.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /*
   * Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. This deliberately overrides a text field's
   * native undo: the draft's history already covers typing (coalesced into one
   * step), so one undo stack for the whole editor is less surprising than two
   * that disagree.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      // A modal on top owns the keyboard. Undoing the draft from behind the
      // image picker edits state the user cannot see, and steals the native
      // text undo from the picker's own search box.
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      setHistory(event.shiftKey ? redo : undo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /*
   * Reached only from the chooser, which is why it closes it: a stored photo IS
   * the answer to the question the dialog was asking. A failure leaves it open
   * instead, so the next file can be tried without reopening anything. The notice
   * explaining why sits above it in the top layer.
   *
   * A Blob, not a File: a clipboard image has no filename and does not need one.
   * Nothing below here reads anything but the bytes and the mime type.
   */
  const upload = async (path: Path, file: Blob) => {
    try {
      const media = await storeFile(file)
      if (media.source === 'local') {
        // The blob is stored NOW but the routine only on Save, and the sweep
        // counts references over persisted routines alone. Pinned until the
        // editor leaves: by then the draft is saved (the routine owns the
        // hash) or discarded (the sweep may fairly reclaim it).
        pinDraft(media.hash)
        pinnedUploads.current.push(media.hash)
      }
      patchSegment(path, { media })
      setChoosingFor(null)
    } catch {
      setUploadError('That image could not be read. Try a JPEG, PNG or WebP.')
    }
  }

  const goBack = () => {
    if (dirty) setConfirmingExit(true)
    else onCancel()
  }

  /*
   * Only a keystroke-by-keystroke field coalesces. See `isTypedPatch`. Anything
   * else, an image above all, is one deliberate act and gets one undo step.
   */
  const patchSegment = (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) =>
    editBlocks(
      (current) => updateSegment(current, path, patch),
      isTypedPatch(patch) ? typingIn(path, 'name') : null,
    )
  /*
   * Every field on a group is typed straight into, so all three coalesce, keyed
   * on the field, so a label and a rep count do not share a step.
   */
  const patchRepeat = (path: Path, patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateRepeat(current, path, patch), typingIn(path, keyOf(patch)))
  const patchLadder = (path: Path, patch: Partial<Omit<Ladder, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateLadder(current, path, patch), typingIn(path, keyOf(patch)))
  const patchSection = (path: Path, patch: Partial<Omit<Section, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateSection(current, path, patch), typingIn(path, keyOf(patch)))
  /*
   * Switching a step between timed and counted is discrete, and undo should put
   * it back in one press rather than unwinding it through whatever typing came
   * before. TYPING the number is the other case: a run of keystrokes, which
   * collapses like any other, or "45" would cost two undos to take back.
   */
  const patchTiming = (path: Path, timing: Timing, typed = false) =>
    editBlocks(
      (current) => setTiming(current, path, timing),
      typed ? typingIn(path, 'timing') : null,
    )

  return (
    <main className="editor" data-colour={colour ?? undefined}>
      <header className="editor__head" data-confirming={confirmingExit}>
        {confirmingExit ? (
          /* Two-step in place, matching how deleting a routine confirms, rather
             than introducing a blocking dialog for one case. */
          <div className="editor__confirm">
            <span className="label label--sm">Discard your changes?</span>
            <button className="chip chip--danger" onClick={onCancel}>
              Discard
            </button>
            <button className="chip" onClick={() => setConfirmingExit(false)}>
              Keep editing
            </button>
          </div>
        ) : (
          <>
            <button className="btn btn--ghost" onClick={goBack} aria-label="Back to routines" title="Back to routines">
              <BackIcon />
            </button>

        <input
          className="efield editor__name"
          value={name}
          aria-label="Routine name"
          placeholder="Routine name"
          onChange={(event) => edit((draft) => ({ ...draft, name: event.target.value }), 'name')}
        />

        {/* Labelled, not icon-only: saving is infrequent and consequential, so
            a word beats a tick. */}
            <button
              className="btn btn--primary editor__save"
              onClick={() => onSave({ ...preview, name: name.trim() || 'Untitled routine' })}
              aria-label="Save routine"
            >
              <CheckIcon />
              Save
            </button>

            {/* Last in the row, so Save keeps the position the thumb already
                knows. */}
            <button
              className="btn btn--ghost"
              onClick={() => setHelping(true)}
              aria-label="Help"
              title="What this screen can do"
            >
              <HelpIcon />
            </button>
          </>
        )}
      </header>

      <div className="editor__bar">
        <div className="editor__history">
          <button
            className="btn btn--ghost"
            onClick={() => setHistory(undo)}
            disabled={!canUndo(history)}
            aria-label="Undo"
            title="Undo"
          >
            <UndoIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => setHistory(redo)}
            disabled={!canRedo(history)}
            aria-label="Redo"
            title="Redo"
          >
            <RedoIcon />
          </button>
        </div>

        <div className="editor__colours" role="group" aria-label="Routine colour">
          <button
            className="swatch swatch--none"
            data-selected={colour === null}
            aria-pressed={colour === null}
            aria-label="No colour"
            title="No colour"
            onClick={() => edit((draft) => ({ ...draft, colour: null }))}
          />
          {ROUTINE_COLOURS.map((option) => (
            <button
              key={option}
              className="swatch"
              data-colour={option}
              data-selected={colour === option}
              aria-pressed={colour === option}
              aria-label={option}
              title={option}
              onClick={() => edit((draft) => ({ ...draft, colour: option }))}
            />
          ))}
        </div>

        <p className="editor__stats label label--sm">
          <span>
            <span className="unit">{duration(totalDurationMs(preview))}</span> total
          </span>
          <span>{stepCount(preview)} steps</span>
        </p>
      </div>

      <div className="editor__scroll">
        {rows.length === 0 ? (
          <p className="editor__empty label label--sm">No steps yet. Add one below.</p>
        ) : (
          <ul className="editor__list" ref={list}>
            {rows.map(({ block, path, depth, last }) =>
              /*
               * Ladders and sections have no row yet. The editor gains them with
               * the strength-routine work. Nothing in the app can author one, so
               * this branch is unreachable today; it is explicit rather than a
               * cast so adding a kind cannot silently render it as a repeat.
               */
              block.kind === 'section' ? (
                <SectionRow
                  key={block.id}
                  section={block}
                  path={path}
                  depth={depth}
                  grip={drag.gripProps(block.id)}
                  dragging={held(path)}
                  onMove={(p, d) => editBlocks((c) => moveBy(c, p, d))}
                  onDuplicate={(p) => editBlocks((c) => duplicateAt(c, p))}
                  onRemove={(p) => editBlocks((c) => removeAt(c, p))}
                  onPatch={patchSection}
                  onAddChild={(p) => editBlocks((c) => appendTo(c, p, newRepsStep()))}
                />
              ) : block.kind === 'ladder' ? (
                <LadderRow
                  key={block.id}
                  ladder={block}
                  path={path}
                  depth={depth}
                  grip={drag.gripProps(block.id)}
                  dragging={held(path)}
                  onMove={(p, d) => editBlocks((c) => moveBy(c, p, d))}
                  onDuplicate={(p) => editBlocks((c) => duplicateAt(c, p))}
                  onRemove={(p) => editBlocks((c) => removeAt(c, p))}
                  onPatch={patchLadder}
                  onAddChild={(p) => editBlocks((c) => appendTo(c, p, newRepsStep()))}
                />
              ) : block.kind === 'segment' ? (
                <SegmentRow
                  key={block.id}
                  last={last}
                  segment={block}
                  path={path}
                  depth={depth}
                  grip={drag.gripProps(block.id)}
                  dragging={held(path)}
                  listed={shownAsList(blocks, path)}
                  onMove={(p, d) => editBlocks((c) => moveStep(c, p, d))}
                  onAdd={(p, role) => editBlocks((c) => insertAfter(c, p, newSegment(role)))}
                  onDuplicate={(p) => editBlocks((c) => duplicateAt(c, p))}
                  onRemove={(p) => editBlocks((c) => removeAt(c, p))}
                  onPatch={patchSegment}
                  onTiming={patchTiming}
                  onClearText={(p, field) => editBlocks((c) => clearText(c, p, field))}
                  onWrap={(p) => editBlocks((c) => wrapInRepeat(c, p))}
                  onPreview={setImagePreview}
                  onChoose={setChoosingFor}
                />
              ) : (
                <RepeatRow
                  key={block.id}
                  repeat={block}
                  path={path}
                  depth={depth}
                  grip={drag.gripProps(block.id)}
                  dragging={held(path)}
                  onMove={(p, d) => editBlocks((c) => moveStep(c, p, d))}
                  onDuplicate={(p) => editBlocks((c) => duplicateAt(c, p))}
                  onRemove={(p) => editBlocks((c) => removeAt(c, p))}
                  onPatch={patchRepeat}
                  onAddChild={(p) => editBlocks((c) => appendTo(c, p, newSegment('work')))}
                  onUnwrap={(p) => editBlocks((c) => unwrapRepeat(c, p))}
                />
              ),
            )}
          </ul>
        )}
      </div>

      {choosingFor && (
        <ImagePicker
          images={knownImages}
          onPick={(ref) => {
            patchSegment(choosingFor, { media: ref })
            setChoosingFor(null)
          }}
          onUpload={(file) => void upload(choosingFor, file)}
          onError={setUploadError}
          onClose={() => setChoosingFor(null)}
        />
      )}

      {/*
        A SIBLING of the chooser, never a child: `close` reaches React's handlers
        on the way up, so a notice nested inside would fire the chooser's own
        onClose and shut it on dismissal. Rendered after it, so it sits above it
        in the top layer.
      */}
      {uploadError !== null && (
        <NoticeDialog text={uploadError} busy={false} onClose={() => setUploadError(null)} />
      )}

      {imagePreview && (
        <ImageDialog
          view={imagePreview}
          onRemove={() => {
            editBlocks((c) => clearMedia(c, imagePreview.path))
            setImagePreview(null)
          }}
          onClose={() => setImagePreview(null)}
        />
      )}

      {helping && (
        <HelpTray title="Help" sections={EDITOR_HELP} onClose={() => setHelping(false)} />
      )}

      {/*
        `data-kind` colours each button's left edge with the colour the row it
        adds will carry. See `.editor__add .chip[data-kind]`. The word stays,
        because the colour is the second cue and never the only one.
      */}
      <div className="editor__add">
        {ROLES.map(({ role, label }) => (
          <button
            key={role}
            className="chip chip--action"
            data-kind={role}
            onClick={() => editBlocks((c) => insertAfter(c, [], newSegment(role)))}
          >
            <PlusIcon />
            {label}
          </button>
        ))}
        <button
          className="chip chip--action"
          data-kind="reps"
          onClick={() => editBlocks((c) => insertAfter(c, [], newRepeat()))}
        >
          <PlusIcon />
          Reps
        </button>
        <button
          className="chip chip--action"
          data-kind="ladder"
          onClick={() => editBlocks((c) => insertAfter(c, [], newLadder()))}
          title="A group whose rep count changes each set: 5-10-15"
        >
          <PlusIcon />
          Ladder
        </button>
        <button
          className="chip chip--action"
          data-kind="section"
          onClick={() => editBlocks((c) => insertAfter(c, [], newSection()))}
          title="A named part of the routine, shown as a list while running"
        >
          <PlusIcon />
          Section
        </button>
      </div>
    </main>
  )
}
