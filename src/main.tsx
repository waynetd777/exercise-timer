/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/*
 * theme.css first, before anything that pulls in a screen's stylesheet: CSS is
 * emitted in module-import order, and at equal specificity the later rule wins,
 * so the base layer belongs ahead of the modifiers that override it. (This was
 * already effectively the order; stating it explicitly keeps it that way.)
 */
import './ui/theme.css'
import { App } from './ui/App'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
