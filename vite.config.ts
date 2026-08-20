import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base` is driven by an env var so the same build works on a root-domain host
// (Cloudflare Pages) and on a subpath host (GitHub Pages -> /exercise-timer/).
// All bundled asset paths must go through import.meta.env.BASE_URL, never a
// hardcoded leading slash.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
