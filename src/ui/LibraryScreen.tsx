import { useMemo, useRef, useState } from 'react'
import type { Workout } from '../engine'
import { importRoutineFiles, looksImportable } from '../routines/importFiles'
import type { Library } from '../storage/useLibrary'
import { bundleFilename, toBundle } from '../storage/bundle'
import { copyText, downloadJson } from '../storage/download'
import { filterWorkouts, sortWorkouts, summary } from '../storage/library'
import { shareUrl } from '../storage/shareLink'
import type { Block } from '../engine'
import { pinRemote } from '../media/pin'
import { updateApp } from '../state/updateApp'
import { usePullToRefresh } from '../state/usePullToRefresh'
import type { SortMode } from '../storage/library'
import { duration } from './format'
import { Menu } from './Menu'
import { NoticeDialog } from './NoticeDialog'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ExportIcon,
  ImportIcon,
  PinIcon,
  SpeakerIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
  StopwatchIcon,
  TrashIcon,
} from './icons'
import './library.css'

const SORTS: { mode: SortMode; label: string }[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'name', label: 'Name' },
  { mode: 'duration', label: 'Longest' },
]

function Row({
  workout,
  library,
  onRun,
  onEdit,
  onShare,
}: {
  workout: Workout
  library: Library
  onRun: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onShare: (workout: Workout) => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const { totalMs, steps } = summary(workout)

  return (
    <li
      className="row"
      data-clickable={!confirming}
      data-confirming={confirming}
      data-colour={workout.colour}
    >
      {/*
        A real button stretched over the card rather than a click handler on the
        li: it is focusable and announced, and nesting buttons inside a button
        would be invalid. Rendered only when idle, or it would sit over the
        delete confirmation.
      */}
      {!confirming && (
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
        <h2 className="row__name">{workout.name}</h2>
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
        {confirming ? (
          // Two-step rather than a blocking confirm dialog.
          <>
            <span className="row__confirm label">Delete?</span>
            <button
              className="btn btn--danger"
              onClick={() => void library.remove(workout.id)}
              aria-label={`Delete ${workout.name}`}
            >
              <CheckIcon />
            </button>
            <button className="btn btn--ghost" onClick={() => setConfirming(false)} aria-label="Keep">
              <CloseIcon />
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn--ghost"
              onClick={() => onEdit(workout)}
              aria-label="Edit routine"
              title="Edit routine"
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
              onClick={() => void onShare(workout)}
              aria-label="Copy a share link"
              title="Copy a share link"
            >
              <ShareIcon />
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => setConfirming(true)}
              aria-label="Delete"
              title="Delete"
            >
              <TrashIcon />
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
  onEdit,
  onNew,
  onSounds,
}: {
  library: Library
  onRun: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onNew: () => void
  onSounds: () => void
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  /** True while the reported work is still running, so there is nothing to dismiss yet. */
  const [noticeBusy, setNoticeBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  /* Pull down from the top of the list to fetch the latest app. Routines are in
     IndexedDB and are untouched by an update — only the cached shell is. */
  const pull = usePullToRefresh(scroller, updateApp)

  const visible = useMemo(
    () => sortWorkouts(filterWorkouts(library.workouts, query), sort),
    [library.workouts, query, sort],
  )

  const share = async (workout: Workout) => {
    const url = await shareUrl(workout, `${location.origin}${location.pathname}`)
    setNotice(
      (await copyText(url))
        ? `Link to “${workout.name}” copied`
        : 'Could not reach the clipboard — open the link and copy it from the address bar',
    )
  }

  /**
   * Stores a local copy of every linked image, so routines keep their pictures
   * on gym wifi and survive the host eventually losing a file.
   *
   * Works because i.postimg.cc allows cross-origin reads. Failures are counted
   * rather than thrown: one dead link should not abandon the rest.
   */
  const saveImagesOffline = async () => {
    setNoticeBusy(true)
    setNotice('Saving images…')
    let pinned = 0
    let failed = 0

    for (const workout of library.workouts) {
      let changed = false

      const walk = async (blocks: readonly Block[]): Promise<Block[]> =>
        Promise.all(
          blocks.map(async (block) => {
            if (block.kind === 'repeat') return { ...block, children: await walk(block.children) }
            if (block.media?.source !== 'remote' || block.media.cachedHash) return block
            try {
              const media = await pinRemote(block.media)
              changed = true
              pinned += 1
              return { ...block, media }
            } catch {
              failed += 1
              return block
            }
          }),
        )

      const blocks = await walk(workout.blocks)
      if (changed) await library.add({ ...workout, blocks })
    }

    setNotice(
      pinned === 0 && failed === 0
        ? 'Every image is already saved'
        : [
            `Saved ${pinned} image${pinned === 1 ? '' : 's'}`,
            failed > 0 && `${failed} could not be reached`,
          ]
            .filter(Boolean)
            .join(' — '),
    )
    setNoticeBusy(false)
  }

  const ingest = async (files: readonly File[]) => {
    const candidates = files.filter(looksImportable)
    if (candidates.length === 0) {
      setNotice('Only .tabata files and exported routines can be imported')
      return
    }

    const { imported, failed } = await importRoutineFiles(candidates, Date.now())
    for (const workout of imported) await library.add(workout)

    const added = imported.length > 0 ? `Imported ${imported.length}` : null
    const skipped =
      failed.length > 0
        ? `${added ? 'skipped' : 'Skipped'} ${failed.map((file) => file.name).join(', ')}`
        : null
    setNotice([added, skipped].filter(Boolean).join(' — ') || null)
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
        <h1 className="library__title">
          <StopwatchIcon />
          DavShack Timer
        </h1>

        <div className="library__tools">
          <input
            className="library__search"
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search routines"
            onChange={(event) => setQuery(event.target.value)}
          />

          <Menu
            label="Sort"
            items={SORTS.map(({ mode, label }) => ({
              label,
              selected: sort === mode,
              onSelect: () => setSort(mode),
            }))}
          />

          <Menu
            label="Routines"
            items={[
              { label: 'New', icon: <PlusIcon />, onSelect: onNew },
              {
                label: 'Import',
                icon: <ImportIcon />,
                title: 'Add routines from a .tabata or exported .json file',
                onSelect: () => picker.current?.click(),
              },
              {
                label: 'Export',
                icon: <ExportIcon />,
                title: 'Download every routine as one file',
                disabled: library.workouts.length === 0,
                onSelect: () =>
                  downloadJson(
                    bundleFilename(null, new Date()),
                    toBundle(library.workouts, Date.now()),
                  ),
              },
              // Development only, and the screen itself is not in a production
              // build — see the note in App.tsx.
              ...(import.meta.env.DEV
                ? [{ label: 'Sounds', icon: <SpeakerIcon />, onSelect: onSounds }]
                : []),
              {
                label: 'Save images',
                icon: <PinIcon />,
                title: 'Store a copy of every linked image on this device',
                disabled: library.workouts.length === 0,
                onSelect: () => void saveImagesOffline(),
              },
            ]}
          />

          <input
            ref={picker}
            className="visually-hidden"
            type="file"
            accept=".tabata,.json,application/json"
            multiple
            onChange={(event) => {
              void ingest(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </div>
      </header>

      {/*
        Everything below the header scrolls, so the title, search and sort
        controls stay put. A wrapper rather than a grid row per element: the
        number of notices varies, and the scroll region must not depend on it.
      */}
      <div
        className="library__scroll"
        ref={scroller}
        /* Unitless: CSS cannot divide one length by another to get the ratio
           the indicator's opacity needs. */
        style={{ ['--pull' as string]: pull.distance }}
      >
        <p className="library__pull label label--sm" aria-hidden={pull.distance === 0}>
          {pull.busy ? 'Updating…' : pull.armed ? 'Release to update' : 'Pull to update'}
        </p>

        {library.error && (
          <p className="library__notice library__notice--error label" role="alert">
            {library.error}
          </p>
        )}

        {library.loading ? (
          <p className="library__empty label">Opening your routines…</p>
        ) : visible.length === 0 ? (
          <p className="library__empty label">
            {query
            ? `Nothing matches “${query}”`
            : 'Drop a .tabata or exported .json file here to add a routine'}
          </p>
        ) : (
          <ul className="library__list">
            {visible.map((workout) => (
              <Row
              key={workout.id}
              workout={workout}
              library={library}
              onRun={onRun}
              onEdit={onEdit}
              onShare={share}
            />
            ))}
          </ul>
        )}
      </div>

      {notice !== null && (
        <NoticeDialog
          text={notice}
          busy={noticeBusy}
          onClose={() => {
            setNotice(null)
            setNoticeBusy(false)
          }}
        />
      )}

      <div className="library__drop" aria-hidden="true">
        <ImportIcon />
        <span>Drop to import</span>
      </div>
    </main>
  )
}
