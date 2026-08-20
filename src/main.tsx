import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RunScreen } from './ui/RunScreen'
import { BEGINNER_MIXED_CARDIO } from './routines/samples'
import './ui/theme.css'

// Phase 5 replaces this with the library screen; for now the run screen mounts
// against a sample routine.
const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <RunScreen workout={BEGINNER_MIXED_CARDIO} />
  </StrictMode>,
)
