import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `base` is driven by an env var so the same build works on a root-domain host
// and on a subpath host (GitHub Pages -> /exercise-timer/). All bundled asset
// paths must go through import.meta.env.BASE_URL, never a hardcoded leading
// slash.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  /*
   * The build's own date, shown beside the version on the home screen. The
   * version is bumped by hand (see `src/version.ts`); this is the backstop for
   * the time it is forgotten, since an installed PWA is served by a service
   * worker and "did my change reach the phone" is otherwise a guess.
   */
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg', 'favicon-32.png', 'favicon-64.png'],
      manifest: {
        name: 'Exercise Timer',
        short_name: 'Exercise',
        description: 'Interval timer for gym routines',
        // Matches --ink-900 so the shell does not flash a different colour.
        theme_color: '#121314',
        background_color: '#121314',
        display: 'standalone',
        orientation: 'any',
        // Relative, so an install works the same at a domain root and under a
        // subpath like /exercise-timer/.
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        /*
         * wav for the whistle sample, jpg for the exercise illustrations.
         * Without them the sound and the pictures are fetched at runtime, and the
         * app goes quiet and blank in the one place it matters: a gym with no
         * signal. The 43 plates are ~3MB, deliberately kept at 881px wide so that
         * install stays reasonable. See `scripts/exercise_plates.py`.
         */
        globPatterns: ['**/*.{js,css,html,png,svg,wav,jpg}'],
        // A 42-minute routine can outlast a cached page, so take over
        // immediately rather than waiting for every tab to close.
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: {
    // Node by default; hook tests opt into jsdom per file with
    // `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
