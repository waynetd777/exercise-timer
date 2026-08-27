/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import rawFullBody from '../beginner-full-body.tabata.json'
import rawMixedCardio1 from '../beginner-mixed-cardio-1.tabata.json'
import rawMixedCardio2 from '../beginner-mixed-cardio-2.tabata.json'
import { importTabataFile } from '../tabataFormat'

/**
 * Wayne's real `.tabata` exports, put through the importer.
 *
 * These were seeded into the library once and are now fixtures only. They are
 * kept because they are REAL data: 69 to 86 steps, images on some exercises and
 * not others, odd durations like a 29s prepare. No hand-written fixture
 * would have caught what these have.
 *
 * Imported here rather than in `samples.ts` so the app's bundle cannot include
 * them: nothing in the import graph of `App.tsx` reaches this file.
 */
const FULL_BODY_IMPORTED = importTabataFile(rawFullBody, 0, 'fixture-full-body')
const MIXED_CARDIO_1 = importTabataFile(rawMixedCardio1, 0, 'fixture-mixed-cardio-1')
export const MIXED_CARDIO_2 = importTabataFile(rawMixedCardio2, 0, 'fixture-mixed-cardio-2')

/** The three as they used to be seeded, for tests that want breadth. */
export const IMPORTED_ROUTINES = [MIXED_CARDIO_2, MIXED_CARDIO_1, FULL_BODY_IMPORTED] as const
