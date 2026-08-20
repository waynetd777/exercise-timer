import { useEffect, useMemo, useState } from 'react'
import type { Block, MediaRef, Repeat, Segment, SegmentRole, Workout } from '../engine'
import { stepCount, totalDurationMs } from '../engine'
import {
  appendTo,
  clearMedia,
  duplicateAt,
  flatten,
  insertAfter,
  moveBy,
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
import { canRedo, canUndo, initHistory, push, redo, undo } from '../editor/history'
import { normaliseImageUrl } from '../editor/postimages'
import { duration } from './format'
import {
  BackIcon,
  CheckIcon,
  CopyIcon,
  DownIcon,
  PlusIcon,
  RedoIcon,
  RoundsIcon,
  TrashIcon,
  UndoIcon,
  UpIcon,
} from './icons'
import './editor.css'

/** One undo step: name and steps together, so they cannot drift apart. */
type Draft = { name: string; blocks: Block[] }

const ROLES: { role: SegmentRole; label: string }[] = [
  { role: 'prepare', label: 'Get ready' },
  { role: 'work', label: 'Work' },
  { role: 'rest', label: 'Rest' },
  { role: 'recover', label: 'Recover' },
]

/** The URL currently on a segment, for the image field. */
function mediaUrl(media: MediaRef | undefined): string {
  return media?.source === 'remote' ? media.url : ''
}

type RowProps = {
  path: Path
  depth: number
  first: boolean
  last: boolean
  onMove: (path: Path, delta: number) => void
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
  onDuplicate,
  onRemove,
  onPatch,
  onClearImage,
  onWrap,
}: RowProps & {
  segment: Segment
  onPatch: (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) => void
  onClearImage: (path: Path) => void
  onWrap: (path: Path) => void
}) {
  const [urlDraft, setUrlDraft] = useState(mediaUrl(segment.media))

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

  return (
    <li className="erow" data-depth={depth} data-role={segment.role}>
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

        <label className="esecs">
          <input
            className="efield efield--secs"
            type="number"
            min={1}
            max={5999}
            value={Math.round(segment.durationMs / 1000)}
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
          <button
            className="btn btn--ghost"
            onClick={() => onMove(path, -1)}
            disabled={first}
            aria-label="Move up"
            title="Move up"
          >
            <UpIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onMove(path, 1)}
            disabled={last}
            aria-label="Move down"
            title="Move down"
          >
            <DownIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onWrap(path)}
            disabled={depth > 0}
            aria-label="Repeat this step"
            title={depth > 0 ? 'Already inside rounds' : 'Repeat this step'}
          >
            <RoundsIcon />
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

      <label className="erow__image">
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
        {segment.media?.source === 'remote' && (
          <img className="erow__thumb" src={segment.media.url} alt="" />
        )}
      </label>
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
          value={repeat.label ?? 'Round'}
          aria-label="Round label"
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
            aria-label="Number of rounds"
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
            aria-label="Add a step to these rounds"
            title="Add a step inside"
          >
            <PlusIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onMove(path, -1)}
            disabled={first}
            aria-label="Move up"
            title="Move up"
          >
            <UpIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onMove(path, 1)}
            disabled={last}
            aria-label="Move down"
            title="Move down"
          >
            <DownIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onUnwrap(path)}
            aria-label="Ungroup these rounds"
            title="Ungroup — keeps the steps, drops the repeat"
          >
            <RoundsIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onDuplicate(path)}
            aria-label="Duplicate these rounds"
            title="Duplicate rounds and steps"
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onRemove(path)}
            aria-label="Delete these rounds and their steps"
            title="Delete rounds and steps"
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
  onSave,
  onCancel,
}: {
  workout: Workout
  onSave: (workout: Workout) => void
  onCancel: () => void
}) {
  /**
   * Name and steps live in ONE history entry, so undo restores a consistent
   * draft rather than two states that can drift apart.
   */
  const [history, setHistory] = useState(() =>
    initHistory<Draft>({ name: workout.name, blocks: workout.blocks }),
  )
  const { name, blocks } = history.present
  const [confirmingExit, setConfirmingExit] = useState(false)

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
  const preview = useMemo(() => ({ ...workout, name, blocks }), [workout, name, blocks])
  const dirty = useMemo(() => isDirty(workout, name, blocks), [workout, name, blocks])

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
    <main className="editor">
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

        <p className="editor__stats label label--sm">
          <span>
            <span className="unit">{duration(totalDurationMs(preview))}</span> total
          </span>
          <span>{stepCount(preview)} steps</span>
        </p>
      </div>

      <div className="editor__scroll">
        {rows.length === 0 ? (
          <p className="editor__empty label label--sm">
            No steps yet. Add one below.
          </p>
        ) : (
          <ul className="editor__list">
            {rows.map(({ block, path, depth, first, last }) =>
              block.kind === 'segment' ? (
                <SegmentRow
                  key={block.id}
                  segment={block}
                  path={path}
                  depth={depth}
                  first={first}
                  last={last}
                  onMove={(p, d) => editBlocks((c) => moveBy(c, p, d))}
                  onDuplicate={(p) => editBlocks((c) => duplicateAt(c, p))}
                  onRemove={(p) => editBlocks((c) => removeAt(c, p))}
                  onPatch={patchSegment}
                  onClearImage={(p) => editBlocks((c) => clearMedia(c, p))}
                  onWrap={(p) => editBlocks((c) => wrapInRepeat(c, p))}
                />
              ) : (
                <RepeatRow
                  key={block.id}
                  repeat={block}
                  path={path}
                  depth={depth}
                  first={first}
                  last={last}
                  onMove={(p, d) => editBlocks((c) => moveBy(c, p, d))}
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
          Rounds
        </button>
      </div>
    </main>
  )
}
