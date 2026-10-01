// Copyright © 2026 Wayne Davies. Free software under the GNU General Public License, version 3 or later.
// SPDX-License-Identifier: GPL-3.0-or-later. See LICENSE in the project root.

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
