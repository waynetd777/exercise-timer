/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { defineConfig } from 'vitest/config'

/**
 * Runs the generators under `scripts/`, which are written as tests because the
 * only reader of the instructor emails is the app's own parser.
 *
 *     npm run harvest
 *
 * Its own config so `npm test` cannot pick them up: they WRITE source files, and
 * a test that rewrites the tree on every run is not a test.
 */
export default defineConfig({
  test: { environment: 'node', include: ['scripts/**/*.test.ts'] },
})
