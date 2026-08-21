import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `base` is driven by an env var so the same build works on a root-domain host
// and on a subpath host (GitHub Pages -> /exercise-timer/). All bundled asset
// paths must go through import.meta.env.BASE_URL, never a hardcoded leading
// slash.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
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
        // wav included for the whistle sample. Without it the sound is fetched at
        // runtime and the app is silent-ish offline, which is the one place it
        // matters: a gym with no signal.
        globPatterns: ['**/*.{js,css,html,png,svg,wav}'],
        // A 42-minute routine can outlast a cached page, so take over
        // immediately rather than waiting for every tab to close.
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Exercise illustrations. Cache-first because they never change —
            // postimages serves them with a ten-year max-age — and because gym
            // wifi is the whole reason this app has to work offline.
            urlPattern: /^https:\/\/i\.postimg\.cc\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              // 0 covers an opaque response, in case a host without CORS is
              // ever used for images.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
