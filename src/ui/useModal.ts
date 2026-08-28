/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useEffect, useRef, type MouseEvent, type RefObject } from 'react'

/**
 * A `<dialog>` opened as a modal on mount, with a backdrop click that closes it.
 *
 * Every dialog in the app is a native `<dialog>` for the same reasons: Escape,
 * focus trapping and the backdrop come free. Each used to carry the same three
 * lines to open it and the same click handler, eight copies in all. The open is
 * GUARDED because StrictMode runs effects twice in development and `showModal()`
 * on an already-open dialog throws. The backdrop is the dialog's own box outside
 * its panel, which is why the click test is against the element itself.
 */
export function useModal(onBackdrop?: () => void): {
  dialog: RefObject<HTMLDialogElement | null>
  onBackdropClick: (event: MouseEvent<HTMLDialogElement>) => void
} {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialog.current) onBackdrop?.()
  }

  return { dialog, onBackdropClick }
}
