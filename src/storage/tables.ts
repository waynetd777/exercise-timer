/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Workout } from '../engine'
import { withPictures, withWeights } from '../routines/loads'
import { currentPictures } from './pictures'
import { currentWeights } from './weights'

/**
 * The routine as it will run: the weight and the picture the exercises page
 * supplies, filled into every step that states none of its own. Read on the way
 * into a run and into the editor's preview, and never saved back: a step that
 * states nothing means "whatever I lift for this" and "whatever this looks
 * like", and follows a change on that page. A step that does state one is left
 * alone, because it is overriding on purpose.
 */
export function fromTables(workout: Workout): Workout {
  return withPictures(withWeights(workout, currentWeights()), currentPictures())
}
