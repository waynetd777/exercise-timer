import { useMemo, useRef, useState } from 'react'
import type { Workout } from '../engine'
import { importTabataFiles, looksImportable } from '../routines/importFiles'
import type { Library } from '../storage/useLibrary'
import { filterWorkouts, sortWorkouts, summary } from '../storage/library'
import type { SortMode } from '../storage/library'
import { duration } from './format'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ImportIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
} from './icons'
import './library.css'

const SORTS: { mode: SortMode; label: string }[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'name', label: 'Name' },
  { mode: 'duration', label: 'Longest' },
]

type RowMode = 'idle' | 'renaming' | 'confirming'

function Row({
  workout,
  library,
  onRun,
}: {
  workout: Workout
  library: Library
  onRun: (workout: Workout) => void
}) {
  const [mode, setMode] = useState<RowMode>('idle')
  const [draft, setDraft] = useState(workout.name)
  const { totalMs, steps } = summary(workout)

  const commitRename = () => {
    void library.rename(workout, draft)
    setMode('idle')
  }

  return (
    <li className="row" data-clickable={mode === 'idle'}>
      {/*
        A real button stretched over the card rather than a click handler on the
        li: it is focusable and announced, and nesting buttons inside a button
        would be invalid. Rendered only when idle, or it would sit over the
        rename input and the delete confirmation.
      */}
      {mode === 'idle' && (
        <button
          className="row__open"
          onClick={() => onRun(workout)}
          aria-label={`Start ${workout.name}`}
        />
      )}

      <button
        className="row__star"
        onClick={() => void library.toggleFavourite(workout)}
        aria-pressed={workout.favourite ?? false}
        aria-label={workout.favourite ? 'Remove from favourites' : 'Add to favourites'}
        title={workout.favourite ? 'Remove from favourites' : 'Add to favourites'}
      >
        <StarIcon filled={workout.favourite ?? false} />
      </button>

      <div className="row__body">
        {mode === 'renaming' ? (
          <input
            className="row__input"
            value={draft}
            autoFocus
            aria-label="Routine name"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') setMode('idle')
            }}
          />
        ) : (
          <h2 className="row__name">{workout.name}</h2>
        )}
        <p className="row__meta label">
          <span>
            <span className="unit">{duration(totalMs)}</span>
          </span>
          <span>{steps} steps</span>
          {workout.lastRunAt !== undefined && (
            <span>Last run {new Date(workout.lastRunAt).toLocaleDateString()}</span>
          )}
        </p>
      </div>

      <div className="row__actions">
        {mode === 'idle' && (
          <>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setDraft(workout.name)
                setMode('renaming')
              }}
              aria-label="Rename"
              title="Rename"
            >
              <PencilIcon />
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => void library.duplicate(workout)}
              aria-label="Duplicate"
              title="Duplicate"
            >
              <CopyIcon />
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => setMode('confirming')}
              aria-label="Delete"
              title="Delete"
            >
              <TrashIcon />
            </button>
          </>
        )}

        {mode === 'renaming' && (
          <>
            <button className="btn btn--ghost" onClick={commitRename} aria-label="Save name">
              <CheckIcon />
            </button>
            <button className="btn btn--ghost" onClick={() => setMode('idle')} aria-label="Cancel">
              <CloseIcon />
            </button>
          </>
        )}

        {/* Two-step rather than a blocking confirm dialog. */}
        {mode === 'confirming' && (
          <>
            <span className="row__confirm label">Delete?</span>
            <button
              className="btn btn--danger"
              onClick={() => void library.remove(workout.id)}
              aria-label={`Delete ${workout.name}`}
            >
              <CheckIcon />
            </button>
            <button className="btn btn--ghost" onClick={() => setMode('idle')} aria-label="Keep">
              <CloseIcon />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function LibraryScreen({
  library,
  onRun,
}: {
  library: Library
  onRun: (workout: Workout) => void
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const visible = useMemo(
    () => sortWorkouts(filterWorkouts(library.workouts, query), sort),
    [library.workouts, query, sort],
  )

  const ingest = async (files: readonly File[]) => {
    const candidates = files.filter(looksImportable)
    if (candidates.length === 0) {
      setNotice('Only .tabata files can be imported.')
      return
    }

    const { imported, failed } = await importTabataFiles(candidates, Date.now())
    for (const workout of imported) await library.add(workout)

    setNotice(
      [
        imported.length > 0 && `Imported ${imported.length}.`,
        failed.length > 0 && `Skipped ${failed.map((f) => f.name).join(', ')}.`,
      ]
        .filter(Boolean)
        .join(' ') || null,
    )
  }

  return (
    <main
      className="library"
      data-dragging={dragging}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void ingest(Array.from(event.dataTransfer.files))
      }}
    >
      <header className="library__head">
        <h1 className="library__title">DavShack Gym Timer</h1>

        <div className="library__tools">
          <input
            className="library__search"
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search routines"
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="library__sorts" role="group" aria-label="Sort routines">
            {SORTS.map(({ mode, label }) => (
              <button
                key={mode}
                className="chip"
                aria-pressed={sort === mode}
                onClick={() => setSort(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <button className="chip chip--action" onClick={() => picker.current?.click()}>
            <ImportIcon />
            Import
          </button>
          <input
            ref={picker}
            className="visually-hidden"
            type="file"
            accept=".tabata,application/json"
            multiple
            onChange={(event) => {
              void ingest(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </div>
      </header>

      {notice && (
        <p className="library__notice label" role="status">
          {notice}
        </p>
      )}
      {library.error && (
        <p className="library__notice library__notice--error label" role="alert">
          {library.error}
        </p>
      )}

      {library.loading ? (
        <p className="library__empty label">Opening your routines…</p>
      ) : visible.length === 0 ? (
        <p className="library__empty label">
          {query ? `Nothing matches “${query}”.` : 'Drop a .tabata file here to add a routine.'}
        </p>
      ) : (
        <ul className="library__list">
          {visible.map((workout) => (
            <Row key={workout.id} workout={workout} library={library} onRun={onRun} />
          ))}
        </ul>
      )}

      <div className="library__drop" aria-hidden="true">
        <ImportIcon />
        <span>Drop to import</span>
      </div>
    </main>
  )
}
