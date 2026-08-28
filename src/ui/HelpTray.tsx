/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useId } from 'react'
import { CloseIcon } from './icons'
import { useModal } from './useModal'

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
 * Sections are native `<details>`, and only one is open at a time. They share a
 * `name`, which is the platform's own exclusive accordion. That is the whole
 * implementation: no state, no keyboard handling, no aria contract, and in-page
 * search still opens a closed section to show a match. A hand-rolled accordion
 * would be more code and less correct.
 *
 * The `name` comes from `useId`, so two trays in one document could never close
 * each other's sections.
 *
 * The first section starts open so the tray does not read as a list of doors.
 * Because that `open` prop never changes value, React leaves the attribute alone
 * after mount, which is what lets the browser close it when another section is
 * opened, instead of React insisting it stay open.
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
  const { dialog, onBackdropClick } = useModal(onClose)
  const group = useId()

  return (
    <dialog ref={dialog} className="tray" aria-label={title} onClose={onClose} onClick={onBackdropClick}>
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
          <details
            key={section.heading}
            className="tray__section"
            name={group}
            open={index === 0}
          >
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
