import { useEffect, useMemo, useRef, useState } from 'react'
import type { Block, MediaRef, Repeat, RoutineColour, Segment, SegmentRole, Workout } from '../engine'
import { ROUTINE_COLOURS, stepCount, totalDurationMs } from '../engine'
import {
  appendTo,
  clearMedia,
  duplicateAt,
  flatten,
  insertAfter,
  moveStep,
  newRepeat,
  newSegment,
  removeAt,
  unwrapRepeat,
  updateRepeat,
  updateSegment,
  wrapInRepeat,
} from '../editor/blocks'
import type { Path } from '../editor/blocks'
import { isDirty } from '../editor/dirty'
import type { KnownImage } from '../editor/images'
import { canRedo, canUndo, initHistory, push, redo, undo } from '../editor/history'
import { normaliseImageUrl } from '../editor/postimages'
import { storeFile } from '../media/pin'
import { duration } from './format'
import { useMediaUrl } from './useMediaUrl'
import {
  BackIcon,
  CheckIcon,
  CloseIcon,
  ImageIcon,
  ImportIcon,
  CopyIcon,
  DownIcon,
  PlusIcon,
  RedoIcon,
  RepsIcon,
  TrashIcon,
  UndoIcon,
  UpIcon,
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
 * Full-size image preview.
 *
 * A native `<dialog>` opened with `showModal()`, so Escape, focus trapping and
 * the backdrop are the browser's job rather than mine. A click that lands on the
 * dialog itself is a backdrop click — the image and the close button are
 * children, so they never match.
 */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <img src={src} alt={alt} />
      <button
        type="button"
        className="btn btn--ghost lightbox__close"
        onClick={onClose}
        aria-label="Close preview"
        title="Close"
      >
        <CloseIcon />
      </button>
    </dialog>
  )
}

/**
 * Pick from the images already used somewhere in the library.
 *
 * Visual rather than a list of urls: the point is to recognise the machine, not
 * to read a postimages id. Filtered by name once there are enough to scroll.
 */
function ImagePicker({
  images,
  onPick,
  onClose,
}: {
  images: readonly KnownImage[]
  onPick: (url: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? images.filter((i) => i.label.toLowerCase().includes(needle)) : images
  }, [images, query])

  return (
    <dialog
      ref={dialog}
      className="picker"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <header className="picker__head">
        <h2 className="picker__title label label--sm">Images in your routines</h2>
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
            ? 'No routine uses an image yet — paste a link instead'
            : `Nothing matches “${query}”`}
        </p>
      ) : (
        <ul className="picker__grid">
          {shown.map((image) => (
            <li key={image.url}>
              <button type="button" className="picker__item" onClick={() => onPick(image.url)}>
                <img src={image.url} alt="" loading="lazy" />
                <span className="picker__label">{image.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  )
}

/** The URL currently on a segment, for the image field. */
function mediaUrl(media: MediaRef | undefined): string {
  return media?.source === 'remote' ? media.url : ''
}

type RowProps = {
  path: Path
  depth: number
  first: boolean
  last: boolean
  onMove: (path: Path, delta: 1 | -1) => void
  onDuplicate: (path: Path) => void
  onRemove: (path: Path) => void
}

function SegmentRow({
  segment,
  path,
  depth,
  first,
  last,
  onMove,
  onAdd,
  onDuplicate,
  onRemove,
  onPatch,
  onClearImage,
  onWrap,
  onPreview,
  onChoose,
  onUpload,
}: RowProps & {
  onAdd: (path: Path, role: SegmentRole) => void
  segment: Segment
  onPatch: (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) => void
  onClearImage: (path: Path) => void
  onWrap: (path: Path) => void
  onPreview: (src: string, alt: string) => void
  onChoose: (path: Path) => void
  onUpload: (path: Path, file: File) => Promise<void>
}) {
  const [urlDraft, setUrlDraft] = useState(mediaUrl(segment.media))
  const upload = useRef<HTMLInputElement>(null)
  const imageUrl = useMediaUrl(segment.media)

  const commitUrl = () => {
    const url = normaliseImageUrl(urlDraft)
    // An empty field clears the image; anything unrecognised is left alone so a
    // half-typed paste does not wipe what was there.
    if (urlDraft.trim() === '') {
      onClearImage(path)
    } else if (url) {
      onPatch(path, { media: { source: 'remote', url } })
      setUrlDraft(url)
    }
  }

  /*
   * The rest that does not run after the final rep. Marked in the row itself
   * rather than explained in a help text somewhere: the rule is invisible in a
   * flat list of steps, and "3 reps of work and rest" reads as six steps until
   * something says otherwise.
   *
   * Same condition as the engine's: last child of a group, and the rest role.
   */
  const betweenRepsOnly = last && depth > 0 && segment.role === 'rest'

  return (
    <li
      className="erow"
      data-depth={depth}
      data-role={segment.role}
      data-between-reps={betweenRepsOnly || undefined}
    >
      <div className="erow__main">
        <select
          className="efield efield--role"
          value={segment.role}
          aria-label="Type of step"
          onChange={(event) => onPatch(path, { role: event.target.value as SegmentRole })}
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

        <label className="esecs">
          <input
            className="efield efield--secs"
            type="number"
            min={1}
            max={5999}
            value={Math.round((segment.durationMs ?? 0) / 1000)}
            aria-label="Seconds"
            onChange={(event) => {
              const seconds = Number(event.target.value)
              if (Number.isFinite(seconds)) {
                onPatch(path, { durationMs: Math.max(1, Math.round(seconds)) * 1000 })
              }
            }}
          />
          <span className="unit">s</span>
        </label>

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
            onClick={() => onMove(path, -1)}
            disabled={first && depth === 0}
            aria-label="Move up"
            title={first && depth > 0 ? 'Move out of the reps' : 'Move up'}
          >
            <UpIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onMove(path, 1)}
            disabled={last && depth === 0}
            aria-label="Move down"
            title={last && depth > 0 ? 'Move out of the reps' : 'Move down'}
          >
            <DownIcon />
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

      {/* A div, not a label: a label wrapping the preview button would forward
          the button's click to the input. The input names itself instead. */}
      <div className="erow__image">
        <span className="label label--sm">Image</span>
        <input
          className="efield"
          value={urlDraft}
          placeholder="postimages link, or leave empty"
          aria-label="Image link"
          onChange={(event) => setUrlDraft(event.target.value)}
          onBlur={commitUrl}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitUrl()
          }}
        />
        <button
          type="button"
          className="chip chip--action"
          onClick={() => onChoose(path)}
          aria-label="Choose an image already used in your routines"
        >
          <ImageIcon />
          Choose
        </button>

        <button
          type="button"
          className="chip chip--action"
          onClick={() => upload.current?.click()}
          aria-label="Upload your own photo for this step"
          title="Upload your own photo"
        >
          <ImportIcon />
          Upload
        </button>
        <input
          ref={upload}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void onUpload(path, file)
          }}
        />

        {imageUrl && (
          <button
            type="button"
            className="erow__thumb"
            onClick={() => onPreview(imageUrl, segment.name)}
            aria-label={`Preview the image for ${segment.name}`}
            title="Preview image"
          >
            <img src={imageUrl} alt="" />
          </button>
        )}
      </div>
    </li>
  )
}

function RepeatRow({
  repeat,
  path,
  depth,
  first,
  last,
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
    <li className="erow erow--repeat" data-depth={depth}>
      <div className="erow__main">
        <input
          className="efield efield--name"
          value={repeat.label ?? 'Reps'}
          aria-label="Reps label"
          onChange={(event) => onPatch(path, { label: event.target.value })}
        />

        <label className="esecs">
          <span className="unit">&times;</span>
          <input
            className="efield efield--secs"
            type="number"
            min={1}
            max={99}
            value={repeat.times}
            aria-label="Number of reps"
            onChange={(event) => {
              const times = Number(event.target.value)
              if (Number.isFinite(times)) onPatch(path, { times: Math.max(1, Math.round(times)) })
            }}
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
            onClick={() => onMove(path, -1)}
            disabled={first && depth === 0}
            aria-label="Move up"
            title={first && depth > 0 ? 'Move out of the reps' : 'Move up'}
          >
            <UpIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onMove(path, 1)}
            disabled={last && depth === 0}
            aria-label="Move down"
            title={last && depth > 0 ? 'Move out of the reps' : 'Move down'}
          >
            <DownIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onUnwrap(path)}
            aria-label="Ungroup these reps"
            title="Ungroup — keeps the steps, drops the repeat"
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
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null)
  /** The step whose image is being chosen, or null when the picker is closed. */
  const [choosingFor, setChoosingFor] = useState<Path | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /**
   * `coalesce` marks a text-ish edit, which collapses a run of keystrokes into
   * one undo step. Discrete changes — adding, deleting, reordering, changing a
   * step's type — each get their own.
   */
  const edit = (next: (draft: Draft) => Draft, coalesce = false) =>
    setHistory((current) => push(current, next(current.present), coalesce))

  const editBlocks = (op: (blocks: Block[]) => Block[], coalesce = false) =>
    edit((draft) => ({ ...draft, blocks: op(draft.blocks) }), coalesce)

  const rows = useMemo(() => flatten(blocks), [blocks])

  /*
   * A pasted strength routine is built from sections and ladders, which have no
   * row yet. Saying so beats rendering an empty list and letting someone think
   * the routine was lost — it is all still there, and saving keeps it.
   */
  const hasUneditable = useMemo(() => {
    const any = (list: Block[]): boolean =>
      list.some((block) =>
        block.kind === 'section' || block.kind === 'ladder'
          ? true
          : block.kind === 'repeat'
            ? any(block.children)
            : false,
      )
    return any(blocks)
  }, [blocks])
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
      event.preventDefault()
      setHistory(event.shiftKey ? redo : undo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const upload = async (path: Path, file: File) => {
    try {
      const media = await storeFile(file)
      patchSegment(path, { media })
    } catch {
      setUploadError('That image could not be read — try a JPEG, PNG or WebP')
    }
  }

  const goBack = () => {
    if (dirty) setConfirmingExit(true)
    else onCancel()
  }

  // A role comes from a select, so it is discrete; everything else is typed.
  const patchSegment = (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) =>
    editBlocks((current) => updateSegment(current, path, patch), patch.role === undefined)
  const patchRepeat = (path: Path, patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>) =>
    editBlocks((current) => updateRepeat(current, path, patch), true)

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
          onChange={(event) => edit((draft) => ({ ...draft, name: event.target.value }), true)}
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

        {uploadError && (
          <p className="editor__error label label--sm" role="alert">
            {uploadError}
          </p>
        )}

        <p className="editor__stats label label--sm">
          <span>
            <span className="unit">{duration(totalDurationMs(preview))}</span> total
          </span>
          <span>{stepCount(preview)} steps</span>
        </p>
      </div>

      <div className="editor__scroll">
        {hasUneditable && (
          <p className="editor__empty label label--sm">
            This routine has sections or ladders, which cannot be edited here yet. They are
            still in the routine and saving will keep them.
          </p>
        )}
        {rows.length === 0 && !hasUneditable ? (
          <p className="editor__empty label label--sm">No steps yet — add one below</p>
        ) : (
          <ul className="editor__list">
            {rows.map(({ block, path, depth, first, last }) =>
              /*
               * Ladders and sections have no row yet — the editor gains them with
               * the strength-routine work. Nothing in the app can author one, so
               * this branch is unreachable today; it is explicit rather than a
               * cast so adding a kind cannot silently render it as a repeat.
               */
              block.kind === 'ladder' || block.kind === 'section' ? null : block.kind ===
                'segment' ? (
                <SegmentRow
                  key={block.id}
                  segment={block}
                  path={path}
                  depth={depth}
                  first={first}
                  last={last}
                  onMove={(p, d) => editBlocks((c) => moveStep(c, p, d))}
                  onAdd={(p, role) => editBlocks((c) => insertAfter(c, p, newSegment(role)))}
                  onDuplicate={(p) => editBlocks((c) => duplicateAt(c, p))}
                  onRemove={(p) => editBlocks((c) => removeAt(c, p))}
                  onPatch={patchSegment}
                  onClearImage={(p) => editBlocks((c) => clearMedia(c, p))}
                  onWrap={(p) => editBlocks((c) => wrapInRepeat(c, p))}
                  onPreview={(src, alt) => setImagePreview({ src, alt })}
                  onChoose={setChoosingFor}
                  onUpload={upload}
                />
              ) : (
                <RepeatRow
                  key={block.id}
                  repeat={block}
                  path={path}
                  depth={depth}
                  first={first}
                  last={last}
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
          onPick={(url) => {
            patchSegment(choosingFor, { media: { source: 'remote', url } })
            setChoosingFor(null)
          }}
          onClose={() => setChoosingFor(null)}
        />
      )}

      {imagePreview && (
        <Lightbox
          src={imagePreview.src}
          alt={imagePreview.alt}
          onClose={() => setImagePreview(null)}
        />
      )}

      <div className="editor__add">
        {ROLES.map(({ role, label }) => (
          <button
            key={role}
            className="chip chip--action"
            onClick={() => editBlocks((c) => insertAfter(c, [], newSegment(role)))}
          >
            <PlusIcon />
            {label}
          </button>
        ))}
        <button
          className="chip chip--action"
          onClick={() => editBlocks((c) => insertAfter(c, [], newRepeat()))}
        >
          <PlusIcon />
          Reps
        </button>
      </div>
    </main>
  )
}
