/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useMemo, useRef, useState } from 'react'
import type { Workout } from '../engine'
import { SCHEMA_VERSION } from '../engine'
import { importRoutineFiles, looksImportable } from '../routines/importFiles'
import { GenerateDialog } from './GenerateDialog'
import { PasteDialog } from './PasteDialog'
import type { Library } from '../storage/useLibrary'
import { bundleFilename, toBundle } from '../storage/bundle'
import { collectMedia } from '../storage/bundleMedia'
import { getBlob } from '../media/store'
import { copyText, downloadJson, downloadText } from '../storage/download'
import { textFilename, writeRoutine } from '../routines/writeRoutine'
import { filterWorkouts, sortWorkouts, summary } from '../storage/library'
import { shareable, shareUrl } from '../storage/shareLink'
import { updateApp } from '../state/updateApp'
import { usePullToRefresh } from '../state/usePullToRefresh'
import type { SortMode } from '../storage/library'
import { estimated } from './format'
import { withWeights } from '../routines/loads'
import { currentWeights, loadWeights } from '../storage/weights'
import { Menu } from './Menu'
import { HelpTray } from './HelpTray'
import { APP_VERSION } from '../version'
import { LIBRARY_HELP } from './help'
import { NoticeDialog } from './NoticeDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { tidyLibrary } from '../routines/rename'
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
  SoundOnIcon,
  StarIcon,
  StopwatchIcon,
  TrashIcon,
  WeightIcon,
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
  onCopyText,
  onDownloadText,
}: {
  workout: Workout
  library: Library
  onRun: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onShare: (workout: Workout) => Promise<void>
  onExport: (workout: Workout) => Promise<void>
  onCopyText: (workout: Workout) => Promise<void>
  onDownloadText: (workout: Workout) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const { totalMs, estimatedMs, rough, steps } = summary(workout)

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
          {/*
            "about 35 min" where the routine is partly self-paced, and an exact
            time where it is not. A rep-based routine used to show only its
            rests, which was truthful and useless.
          */}
          <span className="unit">{estimated(totalMs + estimatedMs, rough)}</span>
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
            {/*
              Every way of sending a routine, in one control.

              They belong together because they differ in exactly one thing:
              what survives the trip. A file carries the photos, a link carries
              the steps, text carries what a person can read. Four buttons would
              not fit a phone row, and the editor already taught that lesson: when
              the controls stop fitting, take them out of the row.
            */}
            <Menu
              label=""
              hint="Send this routine"
              className="btn btn--ghost"
              icon={<ShareIcon />}
              items={[
                {
                  label: 'Copy a share link',
                  icon: <ShareIcon />,
                  title: 'A link to this routine. Steps only, no images.',
                  onSelect: () => void onShare(workout),
                },
                {
                  label: 'Copy as text',
                  icon: <PasteIcon />,
                  title: 'The routine as plain text, for an email or a note. No images.',
                  onSelect: () => void onCopyText(workout),
                },
                {
                  label: 'Download as text',
                  icon: <ExportIcon />,
                  title: 'A .txt file in the format the app can paste back. No images.',
                  onSelect: () => void onDownloadText(workout),
                },
                /*
                 * Last, and the only one that carries everything, which is why
                 * it is called a BACKUP rather than an export: the other three
                 * send a routine to someone, this one keeps it. The two copies
                 * are the quick ways to hand it over, then the text file, then
                 * the format that loses nothing.
                 */
                {
                  label: 'Backup incl. images',
                  icon: <ExportIcon />,
                  title: 'A .json file holding everything, images included.',
                  onSelect: () => void onExport(workout),
                },
              ]}
            />
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
  onDraft,
  onSounds,
  onWeights,
}: {
  library: Library
  onRun: (workout: Workout) => void
  onEdit: (workout: Workout) => void
  onNew: () => void
  /**
   * Opens an unsaved routine in the editor. Paste and Generate both end here:
   * neither result is yours until you have looked at it.
   */
  onDraft: (workout: Workout) => void
  onSounds: () => void
  onWeights: () => void
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('recent')
  const [helping, setHelping] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tidying, setTidying] = useState(false)
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
    // Never silent: a link cannot carry an uploaded photo, and the person on
    // the other end is otherwise the one who finds out.
    const { droppedImages } = shareable(workout)
    const photos =
      droppedImages > 0
        ? `. A link cannot carry ${droppedImages === 1 ? 'the uploaded photo' : `${droppedImages} uploaded photos`}`
        : ''
    setNotice(
      (await copyText(url))
        ? `Link to “${workout.name}” copied${photos}`
        : `Could not reach the clipboard. Open the link and copy it from the address bar${photos}`,
    )
  }

  /**
   * What a text export could not carry, said plainly and once.
   *
   * Never silent. A share that quietly drops 23 illustrations looks like it
   * worked, and the person on the other end is the one who finds out. Pictures
   * are counted rather than listed, because naming all 23 is not a message
   * anyone reads.
   */
  const lostNote = (lost: readonly string[]): string => {
    const pictures = lost.filter((line) => line.startsWith('The picture on')).length
    const rest = lost.filter(
      (line) => !line.startsWith('The picture on') && !line.startsWith("The routine's name"),
    ).length
    const parts: string[] = []
    if (pictures > 0) parts.push(`${pictures} picture${pictures === 1 ? '' : 's'}`)
    if (rest > 0) parts.push(`${rest} other detail${rest === 1 ? '' : 's'}`)
    return parts.length === 0 ? '' : `. Text cannot carry ${parts.join(' or ')}`
  }

  /*
   * Putting every step's exercise back under the name the app knows it by.
   *
   * The reason it matters is not tidiness. A step called "Seated Ab Crunch" is
   * the same movement as the table's "Seated Abdominal Crunch", but only the
   * table's spelling matches on the name exactly, so anything keyed by name,
   * the weights page most of all, is working around the difference rather than
   * with it.
   *
   * Computed on every render of the menu, which is cheap: it is a walk over
   * blocks already in memory, and it has to be current or the count in the menu
   * would be a promise about a library that has since changed.
   */
  const tidy = tidyLibrary(library.workouts)

  const applyTidy = async () => {
    setTidying(false)
    for (const workout of tidy.workouts) await library.add(workout)
    setNotice(
      `Renamed ${tidy.renamed.length} ${tidy.renamed.length === 1 ? 'step' : 'steps'} in ${
        tidy.workouts.length
      } ${tidy.workouts.length === 1 ? 'routine' : 'routines'}`,
    )
  }

  /*
   * Text goes out with the weights filled in.
   *
   * The grammar carries a load in the name ("Leg Press 65kg") and there is
   * nowhere in it to say "whatever I lift for this". Someone reading the text,
   * here or on another device, needs the number, so it is resolved on the way
   * out. The routine itself is untouched.
   */
  const asText = (workout: Workout) => writeRoutine(withWeights(workout, currentWeights()))

  const copyRoutineText = async (workout: Workout) => {
    const { text, lost } = asText(workout)
    setNotice(
      (await copyText(text))
        ? `“${workout.name}” copied as text${lostNote(lost)}`
        : 'Could not reach the clipboard.',
    )
  }

  const downloadRoutineText = (workout: Workout) => {
    const { text, lost } = asText(workout)
    downloadText(textFilename(workout.name, new Date()), text)
    setNotice(`Downloaded “${workout.name}” as text${lostNote(lost)}`)
  }

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
      downloadJson(
        bundleFilename(name, new Date()),
        // The weights ride along: most routines state none of their own now.
        toBundle(workouts, Date.now(), media, loadWeights()),
      )

      const subject =
        workouts.length === 1 ? '1 routine' : `${workouts.length} routines`
      setNotice(
        photos === 0
          ? `Backed up ${subject}`
          : `Backed up ${subject} with ${photos} image${photos === 1 ? '' : 's'}`,
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
                title:
                  'Add routines from a .tabata, an exported .json, or a .txt or .md written as text',
                onSelect: () => picker.current?.click(),
              },
              {
                label: 'Paste',
                icon: <PasteIcon />,
                title: 'Paste a routine written as text',
                onSelect: () => setPasting(true),
              },
              {
                label: 'Generate',
                icon: <PlusIcon />,
                title: 'Build a routine by answering a few questions',
                onSelect: () => setGenerating(true),
              },
              /*
                Absent rather than greyed out when there is nothing to fix.
                A disabled "Tidy 0 exercise names" is an odd thing to read: it
                names a job that does not exist, and the count it carries is the
                whole reason the item is there.
              */
              ...(tidy.renamed.length > 0
                ? [
                    {
                      label: `Tidy ${tidy.renamed.length} exercise ${
                        tidy.renamed.length === 1 ? 'name' : 'names'
                      }`,
                      icon: <PencilIcon />,
                      title:
                        'Rename steps to the exercise names the app knows, so weights and pictures match',
                      onSelect: () => setTidying(true),
                    },
                  ]
                : []),
              {
                label: 'Weights',
                icon: <WeightIcon />,
                title: 'What you lift, per exercise, used by every routine that does not say',
                onSelect: onWeights,
              },
              {
                label: 'Backup all incl. images',
                icon: <ExportIcon />,
                title: 'Download every routine as one file, images included',
                disabled: library.workouts.length === 0,
                onSelect: () => void exportRoutines(library.workouts, null),
              },
              // Development only, and the screen itself is not in a production
              // build. See the note in App.tsx.
              ...(import.meta.env.DEV
                ? [{ label: 'Sounds', icon: <SoundOnIcon />, onSelect: onSounds }]
                : []),
            ]}
          />

          {/* Beside the Routines menu, since most of what it explains is in
              there. Icon-only: a question mark needs no word, and the row is
              already carrying two labelled chips. */}
          <button
            type="button"
            className="chip chip--action"
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
            : 'Drop a .tabata, an exported .json or a .txt routine here to add it'}
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
              onCopyText={copyRoutineText}
              onDownloadText={downloadRoutineText}
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
             * Into the EDITOR, as a draft. This used to go straight into the
             * library because the editor could show neither a section nor a
             * ladder, so a pasted routine opened on a blank screen. It has had
             * `SectionRow` and `LadderRow` for a while now, and a routine read
             * off someone else's email is exactly the one you want to look over
             * before keeping. The dialog still lists what it could not place;
             * this adds the chance to fix it.
             */
            const now = Date.now()
            onDraft({
              id: newId(),
              name: parsed.name,
              blocks: parsed.blocks,
              schemaVersion: SCHEMA_VERSION,
              createdAt: now,
              updatedAt: now,
            })
          }}
        />
      )}

      {generating && (
        <GenerateDialog
          library={library.workouts}
          onCancel={() => setGenerating(false)}
          onGenerate={(workout) => {
            setGenerating(false)
            onDraft(workout)
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

      {tidying && (
        <ConfirmDialog
          question="Tidy the exercise names?"
          /* Three examples and a count. The whole list would be a dialog nobody
             reads, and no examples at all would be a bulk edit taken on trust. */
          detail={`${tidy.renamed.length} ${
            tidy.renamed.length === 1 ? 'step' : 'steps'
          } in ${tidy.workouts.length} ${
            tidy.workouts.length === 1 ? 'routine' : 'routines'
          }, for example ${[...new Set(tidy.renamed.map((r) => `“${r.from}” → “${r.to}”`))]
            .slice(0, 3)
            .join(', ')}. Counts, weights and anything in brackets are kept exactly as they are.`}
          confirmLabel={`Rename ${tidy.renamed.length}`}
          onConfirm={() => void applyTidy()}
          onCancel={() => setTidying(false)}
        />
      )}

      <div className="library__drop" aria-hidden="true">
        <ImportIcon />
        <span>Drop to import</span>
      </div>
    </main>
  )
}
