/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SegmentRole, Workout } from '../engine'
import { compile, MAX_TIMELINE_ENTRIES, ROUTINE_COLOURS, stepCount, totalDurationMs } from '../engine'
import { estimate } from '../routines/estimate'
import { collectExercises } from '../routines/exerciseOptions'
import { currentRates } from '../storage/paces'
import { currentWeights } from '../storage/weights'
import { currentPictures } from '../storage/pictures'
import { withPictures, withWeights } from '../routines/loads'
import {
  appendTo,
  applyExercise,
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
  shownAsList,
  unwrapRepeat,
  wrapInRepeat,
} from '../editor/blocks'
import type { Path } from '../editor/blocks'
import { isDirty } from '../editor/dirty'
import type { KnownImage } from '../editor/images'
import { canRedo, canUndo, redo, undo } from '../editor/history'
import { HelpTray } from './HelpTray'
import { PreviewList } from './PreviewList'
import { NoticeDialog } from './NoticeDialog'
import { EDITOR_HELP } from './help'
import { pinDraft, storeFile, unpinDraft } from '../media/pin'
import { estimated } from './format'
import { ImageDialog, ImagePicker, type ImageView } from './editor/ImageDialogs'
import { LadderRow, RepeatRow, ROLES, SectionRow, SegmentRow } from './editor/rows'
import { useDraftHistory } from './editor/useDraftHistory'
import { useDraftDrag } from './editor/useDraftDrag'
import { BackIcon, CheckIcon, CloseIcon, HelpIcon, ListIcon, PlusIcon, RedoIcon, UndoIcon } from './icons'
import './editor.css'

export function EditorScreen({
  workout,
  knownImages,
  onSave,
  onCancel,
  backRequest = 0,
}: {
  workout: Workout
  /** Images already used across the library, offered by the picker. */
  knownImages: readonly KnownImage[]
  /** May be asynchronous: a rejected save keeps the draft here and says why. */
  onSave: (workout: Workout) => void | Promise<void>
  onCancel: () => void
  /** Bumped when the browser's Back is pressed; answered as the in-app Back is. */
  backRequest?: number
}) {
  const {
    history,
    setHistory,
    edit,
    editBlocks,
    patchSegment,
    patchRepeat,
    patchLadder,
    patchSection,
    patchTiming,
  } = useDraftHistory(workout)
  const { name, blocks, colour } = history.present
  const [confirmingExit, setConfirmingExit] = useState(false)
  const [helping, setHelping] = useState(false)
  const [imagePreview, setImagePreview] = useState<ImageView | null>(null)
  /** The step whose image is being chosen, or null when the picker is closed. */
  const [choosingFor, setChoosingFor] = useState<Path | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(() => flatten(blocks), [blocks])

  /*
   * Where focus lands after a row is added, copied or deleted. The button that
   * was pressed unmounts with its row, and focus fell to the body: the next
   * keyboard press went nowhere. A row's index in the flat list survives the
   * edit, so the target is named by index and found after the render.
   */
  const focusAfter = useRef<{ index: number; selector: string } | null>(null)
  useEffect(() => {
    const want = focusAfter.current
    if (!want) return
    focusAfter.current = null
    const row = list.current?.querySelectorAll<HTMLElement>('[data-row-id]')[want.index]
    row?.querySelector<HTMLElement>(want.selector)?.focus()
  })
  const rowIndex = (path: Path) => rows.findIndex((row) => row.path.join('.') === path.join('.'))
  const removeRow = (path: Path) => {
    focusAfter.current = { index: Math.max(0, rowIndex(path) - 1), selector: '.erow__grip' }
    editBlocks((current) => removeAt(current, path))
  }
  const duplicateRow = (path: Path) => {
    // The copy lands after the whole block, descendants included: for a group,
    // index + 1 was its own first child.
    const within = rows.filter((row) => path.every((at, i) => row.path[i] === at)).length
    focusAfter.current = { index: rowIndex(path) + within, selector: '.erow__grip' }
    editBlocks((current) => duplicateAt(current, path))
  }
  const addRow = (path: Path, role: SegmentRole) => {
    focusAfter.current = { index: rowIndex(path) + 1, selector: '[aria-label="Step name"]' }
    editBlocks((current) => insertAfter(current, path, newSegment(role)))
  }

  const { list, drag, held } = useDraftDrag({ history, rows, editBlocks, setHistory })

  /*
   * What the exercises page supplies for a step that carries no picture of its
   * own. Read once for the screen: every row asks, and the identity has to be
   * stable or each row's media effect would re-arm on every keystroke.
   */
  const pictures = useMemo(() => currentPictures(), [])

  /*
   * The exercise table the name field offers, built ONCE for the screen, with
   * the same pictures on its thumbnails that the rows and the run will show.
   *
   * A routine runs to sixty rows and the table is 147 entries; building it per
   * row would be nine thousand objects per keystroke. Same reason `knownImages`
   * is collected by the library and handed down rather than gathered per picker.
   */
  const exercises = useMemo(() => collectExercises(undefined, pictures), [pictures])

  /*
   * Reading the draft, as the run screen reads a saved routine.
   *
   * A MODE of this screen rather than a trip to the run screen, for one reason:
   * the draft. Navigating away and back would either lose the unsaved edits or
   * hand them back as the editor's new baseline, which would leave the screen
   * looking clean with a routine that has never been saved. Nothing leaves this
   * component, so there is nothing to lose.
   */
  const [previewing, setPreviewing] = useState(false)

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
  const steps = stepCount(preview)
  /*
   * `compile()` refuses a routine of more than this many steps, and it does so
   * in the run screen's render. Refused here first, with the count in view, so
   * a nested repeat that overshoots is fixed in the editor rather than found
   * on Start.
   */
  const tooLarge = steps > MAX_TIMELINE_ENTRIES
  /*
   * The weights are filled in for the reading, exactly as `App` fills them on
   * the way into a run: a step that states no load of its own means "whatever I
   * lift for this", and the preview is here to be read as the routine will run.
   * Nothing is written back; `preview` itself is untouched.
   *
   * Only while it is being read. Compiling a sixty-step routine on every
   * keystroke to render nothing would be work for its own sake.
   *
   * And never over the cap: `compile()` throws there, this is a render, and the
   * error boundary that catches it takes the unsaved draft with it. The Preview
   * button is disabled on the same condition; this is the guard behind it.
   */
  const previewRoutine = useMemo(
    () =>
      previewing && !tooLarge
        ? compile(withPictures(withWeights(preview, currentWeights()), currentPictures()))
        : null,
    [previewing, tooLarge, preview],
  )
  const dirty = useMemo(
    () => isDirty(workout, name, blocks, colour),
    [workout, name, blocks, colour],
  )

  /*
   * The header total, including the steps that have no length.
   *
   * `totalDurationMs` alone reads 0:30 for a routine of twelve counted
   * exercises and one rest, because a self-paced step contributes nothing until
   * you tap Next. Adding the estimate is what makes the number move as you
   * build. `rough` is what earns the word "about": the estimate is a rate, and
   * how long you rest between sets is yours alone.
   */
  const rates = useMemo(() => currentRates(), [])
  const guess = useMemo(() => estimate(blocks, rates), [blocks, rates])

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
      setNotice('That image could not be read. Try a JPEG, PNG or WebP.')
    }
  }

  const goBack = () => {
    if (dirty) setConfirmingExit(true)
    else onCancel()
  }

  useEffect(() => {
    if (backRequest > 0) goBack()
    // goBack reads the live draft; only the request count should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backRequest])

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
              disabled={tooLarge}
              title={tooLarge ? `Over ${MAX_TIMELINE_ENTRIES.toLocaleString()} steps` : undefined}
              onClick={() => {
                void Promise.resolve(
                  onSave({ ...preview, name: name.trim() || 'Untitled routine' }),
                ).catch((cause: unknown) => {
                  const reason = cause instanceof Error ? cause.message : 'Could not save'
                  setNotice(`${reason}. Your changes are still here.`)
                })
              }}
              aria-label="Save routine"
            >
              <CheckIcon />
              Save
            </button>

            {/*
              Read the draft end to end, the same list the run screen shows
              before a routine starts. Between Save and Help, so Save keeps the
              position the thumb already knows.
            */}
            <button
              className="btn btn--ghost"
              onClick={() => setPreviewing((open) => !open)}
              // Same bar as Save: the reading compiles, and compiling over the cap throws.
              disabled={tooLarge}
              aria-pressed={previewing}
              aria-label={previewing ? 'Back to editing' : 'Preview the routine'}
              title={previewing ? 'Back to editing' : 'Read the whole routine'}
            >
              {previewing ? <CloseIcon /> : <ListIcon />}
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
            <span className="unit">
              {estimated(totalDurationMs(preview) + guess.estimatedMs, guess.rough)}
            </span>{' '}
            total
          </span>
          <span>
            {steps.toLocaleString()} steps
            {tooLarge && ` (the most a routine can run is ${MAX_TIMELINE_ENTRIES.toLocaleString()})`}
          </span>
        </p>
      </div>

      {previewing && previewRoutine ? (
        <PreviewList routine={previewRoutine} />
      ) : (
      <div className="editor__scroll">
        {rows.length === 0 ? (
          <p className="editor__empty label label--sm">No steps yet. Add one below.</p>
        ) : (
          <ul className="editor__list" ref={list}>
            {rows.map(({ block, path, depth, last }) =>
              /*
               * One row component per block kind. Exhaustive rather than a
               * cast, so adding a kind cannot silently render it as a repeat.
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
                  onDuplicate={duplicateRow}
                  onRemove={removeRow}
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
                  onDuplicate={duplicateRow}
                  onRemove={removeRow}
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
                  onAdd={addRow}
                  onDuplicate={duplicateRow}
                  onRemove={removeRow}
                  onPatch={patchSegment}
                  onTiming={patchTiming}
                  onClearText={(p, field) => editBlocks((c) => clearText(c, p, field))}
                  exercises={exercises}
                  pictures={pictures}
                  /* One tree operation, so one press of undo takes the whole
                     pick back: the name and the per-side flag. The picture is
                     not written; the step takes the exercises page's. */
                  onPickExercise={(p, option) =>
                    editBlocks((c) =>
                      applyExercise(c, p, {
                        name: option.name,
                        ...(option.perSide === true ? { perSide: true } : {}),
                      }),
                    )
                  }
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
                  onDuplicate={duplicateRow}
                  onRemove={removeRow}
                  onPatch={patchRepeat}
                  onAddChild={(p) => editBlocks((c) => appendTo(c, p, newSegment('work')))}
                  onUnwrap={(p) => editBlocks((c) => unwrapRepeat(c, p))}
                />
              ),
            )}
          </ul>
        )}
      </div>
      )}

      {choosingFor && (
        <ImagePicker
          images={knownImages}
          onPick={(ref) => {
            patchSegment(choosingFor, { media: ref })
            setChoosingFor(null)
          }}
          onUpload={(file) => void upload(choosingFor, file)}
          onError={setNotice}
          onClose={() => setChoosingFor(null)}
        />
      )}

      {/*
        A SIBLING of the chooser, never a child: `close` reaches React's handlers
        on the way up, so a notice nested inside would fire the chooser's own
        onClose and shut it on dismissal. Rendered after it, so it sits above it
        in the top layer.
      */}
      {notice !== null && (
        <NoticeDialog text={notice} busy={false} onClose={() => setNotice(null)} />
      )}

      {imagePreview && (
        <ImageDialog
          view={imagePreview}
          onRemove={() => {
            editBlocks((c) => clearMedia(c, imagePreview.path))
            setImagePreview(null)
          }}
          onChoose={() => {
            setChoosingFor(imagePreview.path)
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
      {/* Gone while the draft is being read: every one of these adds a row to a
          list that is not on screen, and the reading page takes the height. */}
      {!previewing && (
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
          Sets
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
      )}
    </main>
  )
}
