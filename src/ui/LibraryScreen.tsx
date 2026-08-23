/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useMemo, useRef, useState } from 'react'
import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { importRoutineFiles, looksImportable } from '../routines/importFiles'
import { PasteDialog } from './PasteDialog'
import type { Library } from '../storage/useLibrary'
import { bundleFilename, toBundle } from '../storage/bundle'
import { collectMedia } from '../storage/bundleMedia'
import { getBlob } from '../media/store'
import { copyText, downloadJson } from '../storage/download'
import { filterWorkouts, sortWorkouts, summary } from '../storage/library'
import { shareUrl } from '../storage/shareLink'
import { updateApp } from '../state/updateApp'
import { usePullToRefresh } from '../state/usePullToRefresh'
import type { SortMode } from '../storage/library'
import { duration } from './format'
import { Menu } from './Menu'
import { HelpTray } from './HelpTray'
import { APP_VERSION } from '../version'
import { LIBRARY_HELP } from './help'
import { NoticeDialog } from './NoticeDialog'
import { unpinDraft } from '../media/pin'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ExportIcon,
  HelpIcon,
  ImportIcon,
  PasteIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  SpeakerIcon,
  StarIcon,
  StopwatchIcon,
  TrashIcon,
} from './icons'
import './library.css'
import { newId } from '../id'

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
  onExport,
}: {
  workout: Workout
  library: Library
  onRun: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onShare: (workout: Workout) => Promise<void>
  onExport: (workout: Workout) => Promise<void>
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
              title="Copy a share link. Steps only, no photos."
            >
              <ShareIcon />
            </button>
            {/* Beside the link, because they are the two ways to send a routine
                and they differ in exactly one thing: a file carries the photos
                you took, a link cannot. */}
            <button
              className="btn btn--ghost"
              onClick={() => void onExport(workout)}
              aria-label="Export as a file"
              title="Export as a file. Photos included."
            >
              <ExportIcon />
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
  const [helping, setHelping] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  /** True while the reported work is still running, so there is nothing to dismiss yet. */
  const [noticeBusy, setNoticeBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  /* Pull down from the top of the list to fetch the latest app. Routines are in
     IndexedDB and are untouched by an update. Only the cached shell is. */
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
        : 'Could not reach the clipboard. Open the link and copy it from the address bar.',
    )
  }

  /**
   * Stores a local copy of every linked image, so routines keep their pictures
   * on gym wifi and survive the host eventually losing a file.
   *
   * Works because i.postimg.cc allows cross-origin reads. Failures are counted
   * rather than thrown: one dead link should not abandon the rest.
   */
  /**
   * Writes routines to a file, with their uploaded photos inside it.
   *
   * One function for both callers, so "Export" and a row's own export cannot
   * drift into carrying different things. The photos are always included: an
   * export that quietly loses a picture is the worse failure, and a whole library
   * of them is a couple of megabytes.
   *
   * A bundled illustration needs no bytes here, because the app on the other side has
   * it. Only an uploaded photo has to travel, and since the image-link field went
   * this is the only way one reaches another device.
   */
  const exportRoutines = async (workouts: readonly Workout[], name: string | null) => {
    setNoticeBusy(true)
    setNotice(workouts.length === 1 ? 'Preparing the routine…' : 'Preparing your routines…')

    /*
     * The busy notice swallows Escape, hides Close and ignores the backdrop,
     * so a failure that skipped `setNoticeBusy(false)` wedged the whole screen
     * behind an undismissable modal until a reload.
     */
    try {
      const media = await collectMedia(workouts, getBlob)
      const photos = Object.keys(media).length
      downloadJson(bundleFilename(name, new Date()), toBundle(workouts, Date.now(), media))

      const subject =
        workouts.length === 1 ? '1 routine' : `${workouts.length} routines`
      setNotice(
        photos === 0
          ? `Exported ${subject}`
          : `Exported ${subject} with ${photos} photo${photos === 1 ? '' : 's'}`,
      )
    } catch {
      setNotice('The export failed before anything was written. Try again.')
    } finally {
      setNoticeBusy(false)
    }
  }

  const ingest = async (files: readonly File[]) => {
    const candidates = files.filter(looksImportable)
    if (candidates.length === 0) {
      setNotice('Only .tabata files, exported routines and plain-text routines can be imported')
      return
    }

    const { imported, failed, droppedImages, rejectedRoutines, pinnedHashes, skippedLines } =
      await importRoutineFiles(candidates, Date.now())
    try {
      for (const workout of imported) await library.add(workout)
    } finally {
      // Saved or abandoned, the routines own their images now; the import's
      // shield against a mid-flight sweep comes off either way.
      for (const hash of pinnedHashes) unpinDraft(hash)
    }

    const added = imported.length > 0 ? `Imported ${imported.length}` : null
    const skipped =
      failed.length > 0
        ? `${added ? 'skipped' : 'Skipped'} ${failed.map((file) => file.name).join(', ')}`
        : null
    // An image whose contents did not match its hash is worth saying out loud:
    // the routine is here, but a step lost its picture.
    const dropped =
      droppedImages > 0
        ? `${droppedImages} image${droppedImages === 1 ? '' : 's'} could not be read`
        : null
    // A bundle's unreadable routines and a text file's refused lines both mean
    // the import is smaller than the file: never let that look fully successful.
    const rejected =
      rejectedRoutines.length > 0 ? `Could not read ${rejectedRoutines.join(', ')}` : null
    const misread =
      skippedLines.length > 0
        ? skippedLines
            .map(
              ({ file, lines }) =>
                `${lines.length} line${lines.length === 1 ? '' : 's'} in ${file} not understood`,
            )
            .join('; ')
        : null
    setNotice([added, skipped, dropped, rejected, misread].filter(Boolean).join('. ') || null)
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
          Exercise Timer
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
                title: 'Add routines from a .tabata, an exported .json, or a plain-text routine',
                onSelect: () => picker.current?.click(),
              },
              {
                label: 'Paste',
                icon: <PasteIcon />,
                title: 'Paste a routine written as text',
                onSelect: () => setPasting(true),
              },
              {
                label: 'Export all',
                icon: <ExportIcon />,
                title: 'Download every routine as one file, photos included',
                disabled: library.workouts.length === 0,
                onSelect: () => void exportRoutines(library.workouts, null),
              },
              // Development only, and the screen itself is not in a production
              // build. See the note in App.tsx.
              ...(import.meta.env.DEV
                ? [{ label: 'Sounds', icon: <SpeakerIcon />, onSelect: onSounds }]
                : []),
            ]}
          />

          {/* Beside the Routines menu, since most of what it explains is in
              there. Icon-only: a question mark needs no word, and the row is
              already carrying two labelled chips. */}
          <button
            type="button"
            className="chip chip--action library__help"
            onClick={() => setHelping(true)}
            aria-label="Help"
            title="What this screen can do"
          >
            <HelpIcon />
          </button>

          {/*
            Which build is loaded. An installed PWA is served by a service
            worker, so without this "is my change on the phone yet" cannot be
            answered by looking. The date comes from the build, so a forgotten
            version bump still shows something new.
          */}
          <span className="library__version label label--sm" title={`Built ${__BUILD_DATE__}`}>
            v{APP_VERSION}
          </span>

          <input
            ref={picker}
            className="visually-hidden"
            type="file"
            accept=".tabata,.json,.txt,.md,application/json,text/plain"
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
              onExport={(workout) => exportRoutines([workout], workout.name)}
            />
            ))}
          </ul>
        )}
      </div>

      {pasting && (
        <PasteDialog
          onCancel={() => setPasting(false)}
          onImport={(parsed) => {
            setPasting(false)
            /*
             * Into the library rather than the editor: the editor cannot show a
             * section or a ladder yet, so it would open on a blank screen. The
             * review the editor would have provided happens in the dialog, which
             * lists every line the parser could not place.
             */
            const now = Date.now()
            void library.add({
              id: newId(),
              name: parsed.name,
              blocks: parsed.blocks,
              schemaVersion: SCHEMA_VERSION,
              createdAt: now,
              updatedAt: now,
            })
            // No notice: the dialog already listed anything it could not place,
            // before saving, and the routine appearing in the list says the rest.
          }}
        />
      )}

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

      {helping && (
        <HelpTray title="Help" sections={LIBRARY_HELP} onClose={() => setHelping(false)} />
      )}

      <div className="library__drop" aria-hidden="true">
        <ImportIcon />
        <span>Drop to import</span>
      </div>
    </main>
  )
}
