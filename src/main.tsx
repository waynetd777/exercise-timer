import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Placeholder shell. Phase 2 replaces this with the run screen.
function App() {
  return <h1>Exercise Timer</h1>
}

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
