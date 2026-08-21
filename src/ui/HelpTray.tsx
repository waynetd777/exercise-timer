import { useEffect, useRef } from 'react'
import { CloseIcon } from './icons'

export type HelpSection = {
  heading: string
  /** One line each. If a point needs a paragraph it belongs somewhere else. */
  points: readonly string[]
}

/**
 * What a screen can do, on demand.
 *
 * A tray rather than a page: help that replaces what you were looking at makes
 * you memorise the answer before you can act on it. This slides in beside the
 * screen, and closing it puts you back exactly where you were.
 *
 * Sections are native `<details>`. A hand-rolled accordion would need state, a
 * keyboard implementation and an aria contract, and would still be worse than
 * the element browsers already ship — which finds text inside a closed section
 * when the page is searched. The first section starts open so the tray does not
 * read as a list of doors; because that `open` never changes, React leaves the
 * DOM alone afterwards and the toggling stays the browser's business.
 *
 * A modal `<dialog>` for the same reasons `NoticeDialog` is one: Escape, focus
 * trapping and the backdrop come for free and behave natively on every platform.
 */
export function HelpTray({
  title,
  sections,
  onClose,
}: {
  title: string
  sections: readonly HelpSection[]
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="tray"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // The backdrop is the dialog's own box outside the panel.
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className="tray__head">
        <h2 className="tray__title">{title}</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          aria-label="Close help"
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="tray__body">
        {sections.map((section, index) => (
          <details key={section.heading} className="tray__section" open={index === 0}>
            <summary className="tray__summary">{section.heading}</summary>
            <ul className="tray__points">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </dialog>
  )
}
