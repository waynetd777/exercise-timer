import { useMemo, useState } from 'react'
import type { Block, MediaRef, Repeat, Segment, SegmentRole, Workout } from '../engine'
import { stepCount, totalDurationMs } from '../engine'
import {
  appendTo,
  clearMedia,
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
import { normaliseImageUrl } from '../editor/postimages'
import { duration } from './format'
import {
  BackIcon,
  CheckIcon,
  DownIcon,
  PlusIcon,
  RoundsIcon,
  TrashIcon,
  UpIcon,
} from './icons'
import './editor.css'

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
  onRemove: (path: Path) => void
}

function SegmentRow({
  segment,
  path,
  depth,
  first,
  last,
  onMove,
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
  const [name, setName] = useState(workout.name)
  const [blocks, setBlocks] = useState<Block[]>(workout.blocks)

  const rows = useMemo(() => flatten(blocks), [blocks])
  const preview = useMemo(() => ({ ...workout, name, blocks }), [workout, name, blocks])

  const patchSegment = (path: Path, patch: Partial<Omit<Segment, 'kind' | 'id'>>) =>
    setBlocks((current) => updateSegment(current, path, patch))
  const patchRepeat = (path: Path, patch: Partial<Omit<Repeat, 'kind' | 'id' | 'children'>>) =>
    setBlocks((current) => updateRepeat(current, path, patch))

  return (
    <main className="editor">
      <header className="editor__head">
        <button className="btn btn--ghost" onClick={onCancel} aria-label="Discard changes" title="Discard changes">
          <BackIcon />
        </button>

        <input
          className="efield editor__name"
          value={name}
          aria-label="Routine name"
          placeholder="Routine name"
          onChange={(event) => setName(event.target.value)}
        />

        <button
          className="btn btn--primary"
          onClick={() => onSave({ ...preview, name: name.trim() || 'Untitled routine' })}
          aria-label="Save routine"
          title="Save"
        >
          <CheckIcon />
        </button>
      </header>

      <p className="editor__stats label label--sm">
        <span>
          <span className="unit">{duration(totalDurationMs(preview))}</span> total
        </span>
        <span>{stepCount(preview)} steps</span>
      </p>

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
                  onMove={(p, d) => setBlocks((c) => moveBy(c, p, d))}
                  onRemove={(p) => setBlocks((c) => removeAt(c, p))}
                  onPatch={patchSegment}
                  onClearImage={(p) => setBlocks((c) => clearMedia(c, p))}
                  onWrap={(p) => setBlocks((c) => wrapInRepeat(c, p))}
                />
              ) : (
                <RepeatRow
                  key={block.id}
                  repeat={block}
                  path={path}
                  depth={depth}
                  first={first}
                  last={last}
                  onMove={(p, d) => setBlocks((c) => moveBy(c, p, d))}
                  onRemove={(p) => setBlocks((c) => removeAt(c, p))}
                  onPatch={patchRepeat}
                  onAddChild={(p) => setBlocks((c) => appendTo(c, p, newSegment('work')))}
                  onUnwrap={(p) => setBlocks((c) => unwrapRepeat(c, p))}
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
            onClick={() => setBlocks((c) => insertAfter(c, [], newSegment(role)))}
          >
            <PlusIcon />
            {label}
          </button>
        ))}
        <button
          className="chip chip--action"
          onClick={() => setBlocks((c) => insertAfter(c, [], newRepeat([newSegment('work')])))}
        >
          <PlusIcon />
          Rounds
        </button>
      </div>
    </main>
  )
}
