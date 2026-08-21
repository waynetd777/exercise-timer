import { useEffect, useRef, useState } from 'react'
import { parseRoutine } from '../routines/pasteFormat'
import type { ParsedRoutine } from '../routines/pasteFormat'
import { CloseIcon, PlusIcon } from './icons'

/**
 * Paste a routine in as text.
 *
 * The routines arrive as a weekly email, so this is the main way a real one gets
 * into the app — quicker than the editor by an order of magnitude, and the same
 * grammar arrives by WhatsApp and Notes, which is why this is a paste box rather
 * than an `.eml` importer.
 *
 * Lines the parser could not place are shown BEFORE saving, with their numbers.
 * Hiding them would make a partial parse look like a complete one, and the whole
 * point is that the reviewer can see what they were not told. The review happens
 * here rather than in the editor, which cannot show a section or a ladder yet.
 */
export function PasteDialog({
  onCancel,
  onImport,
}: {
  onCancel: () => void
  onImport: (parsed: ParsedRoutine) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  // Parsing is pure and fast, so the preview updates as you type rather than
  // behind a button: you find out it did not understand line 45 immediately.
  const parsed = text.trim() === '' ? null : parseRoutine(text, name.trim() || 'Pasted routine')
  const sections = parsed?.blocks.filter((block) => block.kind === 'section').length ?? 0

  return (
    <dialog ref={dialog} className="paste" onCancel={onCancel} onClose={onCancel}>
      <h2 className="paste__title">Paste a routine</h2>

      <label className="paste__field">
        <span className="label label--sm">Name</span>
        <input
          className="paste__name"
          value={name}
          placeholder="Strength training"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="paste__field">
        <span className="label label--sm">Routine text</span>
        <textarea
          className="paste__text"
          value={text}
          autoFocus
          placeholder={'#1 General Body\nCounting: 2-4-6-8-10-8-6-4-2\n\n* Squat + Shoulder Press\n…'}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      {parsed && (
        <div className="paste__report">
          <p className="label label--sm">
            {sections} {sections === 1 ? 'section' : 'sections'} ·{' '}
            {parsed.skipped.length === 0
              ? 'every line understood'
              : `${parsed.skipped.length} ${parsed.skipped.length === 1 ? 'line' : 'lines'} not understood`}
          </p>
          {parsed.skipped.length > 0 && (
            <ul className="paste__skipped label label--sm">
              {parsed.skipped.map((line) => (
                <li key={line.line}>
                  <b>{line.line}</b> {line.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="paste__actions">
        <button type="button" className="chip" onClick={onCancel}>
          <CloseIcon />
          Cancel
        </button>
        {/* Importing with unread lines is allowed — they are listed above, and a
            routine with one odd line should not be unimportable. */}
        <button
          type="button"
          className="chip chip--primary"
          disabled={!parsed || parsed.blocks.length === 0}
          onClick={() => parsed && onImport(parsed)}
        >
          <PlusIcon />
          Add to library
        </button>
      </div>
    </dialog>
  )
}
