import { useEffect, useRef } from 'react'
import { CloseIcon } from './icons'

/**
 * Reports the outcome of something the user asked for, and waits to be
 * dismissed.
 *
 * A modal rather than an inline line of text because these are results, not
 * status: "Saved 24 images" is worth reading once and then getting rid of, and an
 * inline notice just sits there afterwards with no way to clear it.
 *
 * While the work is still running there is nothing to dismiss, so no close
 * affordance is offered and Escape is swallowed. The dialog becomes a progress
 * report until it has something to say.
 */
export function NoticeDialog({
  text,
  busy,
  onClose,
}: {
  text: string
  busy: boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(event) => {
        // Escape, while work is in flight.
        if (busy) event.preventDefault()
      }}
      onClose={() => {
        if (!busy) onClose()
      }}
      onClick={(event) => {
        if (!busy && event.target === dialog.current) onClose()
      }}
    >
      {/* The panel is its own element: a <dialog> styled as the box does not hug
          its content on iOS. See `.modal` in theme.css. */}
      <div className="notice">
        <p className="notice__text">{text}</p>

        {!busy && (
          <button type="button" className="chip chip--action" onClick={onClose} autoFocus>
            <CloseIcon />
            Close
          </button>
        )}
      </div>
    </dialog>
  )
}
