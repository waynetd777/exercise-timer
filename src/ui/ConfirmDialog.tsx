/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { CheckIcon, CloseIcon } from './icons'
import { useModal } from './useModal'

/**
 * Asks before something that cannot be undone.
 *
 * A modal rather than the inline confirm the editor and the library rows use,
 * because this one is answered mid-workout: the phone is propped across the
 * room, hands are busy, and a confirm tucked into a header is easy to miss and
 * easier to mistap. The same reason Next is a slab.
 *
 * Escape and the backdrop both cancel, so the safe answer is the easy one.
 */
export function ConfirmDialog({
  question,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  question: string
  detail?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { dialog, onBackdropClick } = useModal(onCancel)

  return (
    <dialog ref={dialog} className="modal" onClose={onCancel} onClick={onBackdropClick}>
      {/* The panel is its own element: a <dialog> styled as the box does not hug
          its content on iOS. See `.modal` in theme.css. */}
      <div className="notice">
        <p className="notice__text">{question}</p>
        {detail && <p className="notice__detail label label--sm">{detail}</p>}

        <div className="notice__actions">
          {/* Cancel is focused, so a stray Enter or space keeps you where you are. */}
          <button type="button" className="chip" onClick={onCancel} autoFocus>
            <CloseIcon />
            Cancel
          </button>
          <button type="button" className="chip chip--danger" onClick={onConfirm}>
            <CheckIcon />
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
