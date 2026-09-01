/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MediaRef, SegmentRole, Workout } from '../engine'
import { compile, MAX_TIMELINE_ENTRIES, ROUTINE_COLOURS, stepCount, totalDurationMs } from '../engine'
import { estimate } from '../routines/estimate'
import { collectExercises } from '../routines/exerciseOptions'
import type { CustomExercise } from '../storage/customExercises'
import {
  addCustom,
  customList,
  loadCustomExercises,
  saveCustomExercises,
  withCustom,
} from '../storage/customExercises'
import { currentRates } from '../storage/paces'
import { currentPictures, loadPictures, pictureFor, savePictures, withPicture } from '../storage/pictures'
import { loadWeights, saveWeights, weightFor, withWeight } from '../storage/weights'
import { foldName } from '../routines/foldName'
import { sameExercise } from '../routines/similar'
import { fromTables } from '../storage/tables'
import {
  appendTo,
  applyExercise,
  blockAt,
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
import { ConfirmDialog } from './ConfirmDialog'
import { ExerciseDialog, type ExerciseTables } from './ExerciseDialog'
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
   * own. Read ONCE for the screen: every row asks, and the identity has to be
   * stable or each row's media effect would re-arm on every keystroke.
   *
   * State rather than a memo, because this screen can now write to that page:
   * accepting "show this picture everywhere" has to move the whole editor onto
   * the new table in the same breath, or the step it was just cleared from
   * would go blank until the editor was reopened. Nothing else sets it, so the
   * identity is as stable as the memo's was.
   */
  const [pictures, setPictures] = useState(currentPictures)

  /*
   * The exercise table the name field offers, built ONCE for the screen, with
   * the same pictures on its thumbnails that the rows and the run will show.
   *
   * A routine runs to sixty rows and the table is 147 entries; building it per
   * row would be nine thousand objects per keystroke. Same reason `knownImages`
   * is collected by the library and handed down rather than gathered per picker.
   */
  /*
   * The exercises you have added yourself, which the name field offers beside the
   * app's own. State rather than a read, because one can be added from in here:
   * the list has to grow the moment the dialog closes.
   */
  const [custom, setCustom] = useState(loadCustomExercises)
  /** The step an exercise is being added FROM, and the name it was typed with. */
  const [naming, setNaming] = useState<{ path: Path; name: string } | null>(null)

  /*
   * A weight or a picture just put on a step for an exercise the exercises page
   * holds none for, waiting to be asked about. See `offer` below for why.
   */
  const [offeredWeight, setOfferedWeight] = useState<
    { path: Path; name: string; load: string } | null
  >(null)
  const [offeredPicture, setOfferedPicture] = useState<
    { path: Path; name: string; media: MediaRef } | null
  >(null)
  /*
   * The exercises already asked about and turned down, so each is asked once per
   * visit to the editor. Without it, correcting a typo in a weight you have just
   * said is one-off asks the same question again on every blur.
   *
   * A ref, not state: nothing renders from it, and it must not be a dependency
   * of anything. Accepted names need no entry — the page holds a weight for them
   * afterwards, which is the condition the offer already tests.
   */
  const declinedWeight = useRef(new Set<string>())
  const declinedPicture = useRef(new Set<string>())

  const table = useMemo(() => withCustom(customList(custom)), [custom])
  const exercises = useMemo(() => collectExercises(table, pictures), [table, pictures])

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
        ? compile(fromTables(preview))
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
      chosePicture(path, media)
      setChoosingFor(null)
    } catch {
      setNotice('That image could not be read. Try a JPEG, PNG or WebP.')
    }
  }

  /**
   * The exercise a step's name IS, spelled as the table spells it, or null.
   *
   * THE GATE ON BOTH OFFERS. The exercises page keeps a weight and a picture
   * against an exercise, keyed by its folded name; a step called "Warm Up" or
   * "Course leg 2" is not an exercise, and an entry filed under that name would
   * be one nothing on that page ever shows and nothing else ever reads. There is
   * nothing to add it TO, so there is nothing to ask.
   *
   * The step whose name is not on the table has its own offer already, and a
   * better one: `ExerciseField` will make the name an exercise, and the dialog
   * that does it collects the weight and the picture on the way past.
   *
   * The TABLE's spelling is what comes back, because that is the key the tables
   * use: a step reading "leg presses" is Leg Press, and its weight belongs under
   * Leg Press or under nothing.
   */
  const tableNames = useMemo(() => table.map((exercise) => exercise.name), [table])
  const knownExercise = (name: string): string | null => sameExercise(name, tableNames)

  /**
   * A picture put on a step, and the question it raises.
   *
   * BOTH ways of choosing one come through here — the catalogue and an upload —
   * so the offer is made wherever the picture came from.
   *
   * The question is worth asking for the same reason the weight's is: a picture
   * belongs to your gym rather than to one routine, and an exercise the page has
   * no picture for is one where saying so costs nothing and gains every other
   * routine that names it. Where the page ALREADY has one, the step is doing the
   * deliberate thing `pictures.ts` exists to allow, and there is nothing to ask.
   */
  const chosePicture = (path: Path, media: MediaRef) => {
    patchSegment(path, { media })
    const block = blockAt(blocks, path)
    if (block?.kind !== 'segment' || block.role !== 'work') return
    const name = knownExercise(block.name)
    if (name === null || declinedPicture.current.has(foldName(name))) return
    if (pictureFor(name) !== undefined) return
    setOfferedPicture({ path, name, media })
  }

  /**
   * A weight typed onto a step, and the same question about it.
   *
   * Only where the page holds NOTHING for the exercise. A step overriding a
   * weight already written down is the deliberate case the table exists to
   * allow, and asking about it every time would be nagging. Read fresh rather
   * than off the row's hint: this runs on a blur, and the answer has to be the
   * current one after an earlier offer was accepted.
   */
  const offerWeight = (path: Path, typed: string, load: string) => {
    const name = knownExercise(typed)
    if (name === null || declinedWeight.current.has(foldName(name))) return
    if (weightFor(name) !== '') return
    setOfferedWeight({ path, name, load })
  }

  /**
   * What the tables should now hold for one exercise, written.
   *
   * The tables are read back off storage rather than held here: this screen is
   * not their owner, the exercises page is, and a copy kept across an editing
   * session is a copy that goes stale the moment another tab saves. They are
   * two short objects in `localStorage`; reading one on a button press is free.
   */
  /**
   * What a step is already carrying, as the exercise dialog's opening values.
   * `load` is free text and `media` is the step's OWN picture, never the one it
   * is borrowing from the page: an inherited illustration is not this step's to
   * hand over, and the exercise being added does not have one yet by definition.
   */
  const stepTables = (path: Path): ExerciseTables => {
    const block = blockAt(blocks, path)
    if (block?.kind !== 'segment') return { weight: '', picture: null }
    return { weight: block.load ?? '', picture: block.media ?? null }
  }

  const writeTables = (name: string, tables: ExerciseTables) => {
    saveWeights(withWeight(loadWeights(), name, tables.weight))
    savePictures(withPicture(loadPictures(), name, tables.picture))
    setPictures(currentPictures())
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
                  onWeightTyped={offerWeight}
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
                  onAddExercise={(p, typed) => setNaming({ path: p, name: typed })}
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
            chosePicture(choosingFor, ref)
            setChoosingFor(null)
          }}
          onUpload={(file) => void upload(choosingFor, file)}
          onError={setNotice}
          onClose={() => setChoosingFor(null)}
        />
      )}

      {/*
        Making a typed name an exercise, from the step that names it.

        Two things happen on Add, and one press of undo has to take both: the
        exercise is written to your table, and the step is put onto it. The name
        is EDITABLE in the dialog, which is the point. A typo caught here is
        corrected on the step as well, and the dialog's warning is what catches
        it.

        IT ARRIVES CARRYING THE STEP'S WEIGHT AND PICTURE. A step being turned
        into an exercise usually already says what you lift and shows what it
        looks like, and asking for both again in the next breath is the app not
        listening. Whatever the dialog saves goes to the exercises page, and the
        step stops stating its own: see `onSave` for why that is the point
        rather than a side effect.
      */}
      {naming !== null && (
        <ExerciseDialog
          name={naming.name}
          table={table}
          tables={stepTables(naming.path)}
          knownImages={knownImages}
          onSave={(exercise: CustomExercise, _from, tables) => {
            const next = addCustom(custom, exercise)
            setCustom(next)
            saveCustomExercises(next)
            writeTables(exercise.name, tables)
            /*
             * ONE tree operation, so one press of undo takes the whole add back:
             * the name, the per-side flag, and the step's own weight and picture
             * where the exercise has just taken them over.
             *
             * Cleared rather than left in place, because they now say the same
             * thing twice and only one of them is the truth. A step stating a
             * weight is saying "this routine, deliberately, is not my usual" —
             * which is exactly what you have just told it is not the case. Left
             * alone, the step would go on showing 30kg after the exercise moved
             * up a plate. See `weights.ts` and `pictures.ts`.
             */
            editBlocks((c) => {
              let out = applyExercise(c, naming.path, {
                name: exercise.name,
                ...(exercise.perSide === true ? { perSide: true } : {}),
              })
              if (tables.weight !== '') out = clearText(out, naming.path, 'load')
              if (tables.picture) out = clearMedia(out, naming.path)
              return out
            })
            setNaming(null)
          }}
          /* The exercise already exists, so nothing is added: the step simply
             goes onto it, which is what picking it from the list would have done. */
          onUse={(name) => {
            const option = exercises.find((entry) => entry.name === name)
            editBlocks((c) =>
              applyExercise(c, naming.path, {
                name,
                ...(option?.perSide === true ? { perSide: true } : {}),
              }),
            )
            setNaming(null)
          }}
          onClose={() => setNaming(null)}
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

      {/*
        The weight just typed, offered to the exercises page.

        Asked, never assumed. Both answers are real: the page's number is what
        every routine naming the exercise follows, and a step's own load is how
        one routine says "not my usual weight" on purpose. Only you know which
        this is, and the app has no evidence either way — which is precisely when
        it should ask rather than guess.

        Only where the page holds NOTHING for the exercise, so the question is
        "shall I write this down" rather than "shall I overwrite what you had".
        `chip--primary`, not the red: nothing is lost either way.
      */}
      {offeredWeight !== null && (
        <ConfirmDialog
          question={`Is ${offeredWeight.load} your weight for ${offeredWeight.name}?`}
          detail={`Your exercises page has no weight for it yet. Adding it there means every routine naming ${offeredWeight.name} uses it, and this step follows the page instead of stating a weight of its own.`}
          confirmLabel="Add to my exercises"
          cancelLabel="Just this routine"
          tone="primary"
          onConfirm={() => {
            saveWeights(withWeight(loadWeights(), offeredWeight.name, offeredWeight.load))
            // The step stops overriding: the number it was stating is now the
            // page's, and two copies of one weight is one of them going stale.
            editBlocks((c) => clearText(c, offeredWeight.path, 'load'))
            setOfferedWeight(null)
          }}
          onCancel={() => {
            declinedWeight.current.add(foldName(offeredWeight.name))
            setOfferedWeight(null)
          }}
        />
      )}

      {/* The picture just chosen, offered to the exercises page. The weight's
          question, about the other thing a step can say twice. */}
      {offeredPicture !== null && (
        <ConfirmDialog
          question={`Show this picture for ${offeredPicture.name} everywhere?`}
          detail={`Your exercises page has no picture for it yet. Adding it there means every routine naming ${offeredPicture.name} shows it, and this step follows the page instead of carrying a picture of its own.`}
          confirmLabel="Add to my exercises"
          cancelLabel="Just this routine"
          tone="primary"
          onConfirm={() => {
            savePictures(withPicture(loadPictures(), offeredPicture.name, offeredPicture.media))
            setPictures(currentPictures())
            editBlocks((c) => clearMedia(c, offeredPicture.path))
            setOfferedPicture(null)
          }}
          onCancel={() => {
            declinedPicture.current.add(foldName(offeredPicture.name))
            setOfferedPicture(null)
          }}
        />
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
