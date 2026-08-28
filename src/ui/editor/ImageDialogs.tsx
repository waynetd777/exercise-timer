/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MediaRef } from '../../engine'
import type { Path } from '../../editor/blocks'
import type { KnownImage } from '../../editor/images'
import type { ClipboardImage } from '../../media/clipboard'
import { canReadClipboard, imageFromClipboard, probeClipboardImage } from '../../media/clipboard'
import { CloseIcon, ImageIcon, ImportIcon, PasteIcon, TrashIcon } from '../icons'
import { useModal } from '../useModal'

/**
 * A step's image, as the preview dialog needs it.
 *
 * Carries the `path` because Remove lives in the dialog now rather than in the
 * row. `src` may be null: a stored ref whose file is not on this device still has
 * to be viewable enough to be removed.
 */
export type ImageView = {
  path: Path
  src: string | null
  alt: string
  unseen: boolean
  /**
   * The picture is the exercises page's, not this step's.
   *
   * Then there is nothing here to remove, and the useful offer is the opposite
   * one: give this step a picture of its own, which is what overriding means.
   */
  inherited?: boolean
}

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
export function ImageDialog({
  view,
  onRemove,
  onChoose,
  onClose,
}: {
  view: ImageView
  onRemove: () => void
  /** Give this step its own picture, for one it is only borrowing. */
  onChoose: () => void
  onClose: () => void
}) {
  const { dialog, onBackdropClick } = useModal(onClose)

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} onClick={onBackdropClick}>
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

        {/* Where it comes from, said plainly: a picture nobody put on this step
            looks like a bug until you know the page supplies it. */}
        {view.inherited === true && (
          <p className="notice__detail label label--sm">
            From the Exercises page, which every routine naming this exercise follows.
          </p>
        )}

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
          {view.inherited === true ? (
            /* Nothing to remove: this picture is not the step's. Overriding is
               the only thing the step can say about it. */
            <button type="button" className="chip chip--action" onClick={onChoose}>
              <ImageIcon />
              Use my own
            </button>
          ) : (
            /* A trash can is unambiguous HERE: the row's own trash can, which
               deletes the whole step, is nowhere in sight, and the word says what
               goes. In the row itself it could only have meant one of the two. */
            <button type="button" className="chip chip--danger" onClick={onRemove}>
              <TrashIcon />
              Remove image
            </button>
          )}
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
export function ImagePicker({
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
  const { dialog, onBackdropClick } = useModal(onClose)
  const upload = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [clipboard, setClipboard] = useState<ClipboardImage>(() =>
    canReadClipboard() ? 'unknown' : 'unsupported',
  )

  /*
   * Whether the clipboard holds an image, re-asked whenever this window comes
   * back to the front: you copy the screenshot in another app and return, with
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
        onError('There is no image on the clipboard. Copy one and try again')
        return
      }
      onUpload(blob)
    } catch {
      onError(
        'The clipboard could not be read. Allow this site to see it, or use Upload a photo instead',
      )
    }
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? images.filter((i) => i.label.toLowerCase().includes(needle)) : images
  }, [images, query])

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} onClick={onBackdropClick}>
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
          without a gesture it stays enabled and the tap finds out: a button
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
