/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * Everything the Horizon guide does not draw.
 *
 * Mostly that means what the multi-gym cannot do (bodyweight, band, dumbbell,
 * kettlebell, trampoline and the bike), but it also holds the odd MACHINE
 * movement the guide leaves out, which is why the file is defined by the
 * missing picture rather than by the missing machine.
 *
 * HARVESTED, not invented. Every movement here appears in a routine this app has
 * already been given: `strength-training.routine.json` and the four emails in
 * `__tests__/emails`. That corpus held 105 distinct names, which is fewer
 * exercises than it looks: it spells Mountain Climbers three ways, Bulgarian
 * Split Squat four (one of them "Bugarian"), and carries per-side qualifiers and
 * "12 × Lateral Raises + 10 Cross Punches" as if they were names. Canonicalising
 * that is the whole of the work below.
 *
 * The vocabulary is therefore Wayne's instructor's, so a generated routine reads
 * like the ones she is actually sent. A handful of obvious siblings are added
 * where the corpus has one of a pair and the generator would otherwise be unable
 * to balance a session; each is marked ADDED.
 *
 * NO ILLUSTRATIONS. The Horizon guide is the only source of those and it only
 * draws the machine, so these steps run with the media panel showing their name.
 * A picture can be put on a step by hand afterwards.
 *
 * LOADS are bounded by what is in the garage: a 6kg kettlebell, dumbbells at 1,
 * 1.5, 2, 3 and 5kg, a set of bands, a trampoline. Nothing here calls for a
 * weight that is not there, and no row states one: the generator seeds a weight
 * from what was last used in the saved library, and leaves it blank otherwise.
 *
 * This is a vocabulary of movements, not advice about which to do.
 */

import type { Exercise } from './exercises'

export const OTHER_EXERCISES: readonly Exercise[] = [
  /*
   * ── On the machine, but not in the guide ─────────────────────────────────
   *
   * Wayne does this one and routine 2 has always carried it; the guide simply
   * does not illustrate it, so `exercise_metadata.py` could never find it and
   * it cannot live in the generated table. Rigged like the Deadlift, which is
   * the same low pulley and the same bar.
   */
  { name: 'Low Pulley Squat', area: 'lower', equipment: 'machine', station: 5, attachment: 'low row bar' },

  // ── Mobility, for the opening minutes ────────────────────────────────────
  { name: 'Arm Circles', area: 'upper', pattern: 'push', equipment: 'bodyweight', use: 'mobility' },
  { name: 'Arm Swings', area: 'upper', pattern: 'push', equipment: 'bodyweight', use: 'mobility' },
  { name: 'Torso Rotations', area: 'torso', equipment: 'bodyweight', use: 'mobility' },
  { name: 'Standing Hip Rotations', area: 'lower', equipment: 'bodyweight', use: 'mobility' },
  { name: 'Toy Soldier Kicks', area: 'lower', equipment: 'bodyweight', use: 'mobility' },
  { name: 'Standing Knee Hugs', area: 'lower', equipment: 'bodyweight', use: 'mobility' },
  { name: 'Inchworms', area: 'torso', equipment: 'bodyweight', use: 'mobility' },
  {
    name: 'World’s Greatest Stretch',
    area: 'lower',
    equipment: 'bodyweight',
    use: 'mobility',
    perSide: true,
  },

  // ── Cardio, for a warm-up and for active recovery between sets ───────────
  { name: 'Cycling', area: 'lower', equipment: 'bike', use: 'cardio', media: 'exercises/Cycling.jpg' },
  /*
   * The trampoline as an ACTIVITY, beside the specific moves further down. A
   * minute of recovery on it is "a minute on the trampoline", the same way a
   * minute on the bike is Cycling rather than a named pedalling drill.
   */
  { name: 'Trampoline', area: 'lower', equipment: 'trampoline', use: 'cardio' },
  { name: 'Jumping Jacks', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Jog on the Spot', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'High Knees', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Butt Kicks', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Fast Feet', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Burpees', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Speed Skaters', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Mountain Climbers', area: 'torso', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Cross-Body Mountain Climbers', area: 'torso', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Front Punches', area: 'upper', pattern: 'push', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Uppercuts', area: 'upper', pattern: 'push', equipment: 'bodyweight', use: 'cardio' },
  {
    name: 'Alternating Cross Punches',
    area: 'upper',
    pattern: 'push',
    equipment: 'bodyweight',
    use: 'cardio',
  },
  // Trampoline. The bounce is the point, so these are not offered on the floor.
  { name: 'Easy Bounce', area: 'lower', equipment: 'trampoline', use: 'cardio' },
  { name: 'Ski Jumps', area: 'lower', equipment: 'trampoline', use: 'cardio' },
  { name: 'Knee Lifts', area: 'lower', equipment: 'trampoline', use: 'cardio' },
  { name: 'Squat to Knee Lift', area: 'lower', equipment: 'trampoline', use: 'cardio' },
  { name: 'Jump-Jump Squat', area: 'lower', equipment: 'trampoline', use: 'cardio' },

  // ── Lower body ───────────────────────────────────────────────────────────
  { name: 'Squats', area: 'lower', equipment: 'bodyweight' },
  { name: 'Squat Pulses', area: 'lower', equipment: 'bodyweight' },
  { name: 'Squat Hold', area: 'lower', equipment: 'bodyweight' },
  { name: 'Wall Sit', area: 'lower', equipment: 'bodyweight' },
  { name: 'Sumo Squats', area: 'lower', equipment: 'bodyweight' },
  { name: 'Sumo Squat Pulses', area: 'lower', equipment: 'bodyweight' },
  { name: 'Squat Jumps', area: 'lower', equipment: 'bodyweight' },
  // In her "40 sec each (continuous movement)" warm-up block with the jog and the jacks, never a set.
  { name: 'Side-to-Side Squats with a Reach', area: 'lower', equipment: 'bodyweight', use: 'cardio' },
  { name: 'Walking Lunges', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Reverse Lunges', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Alternating Curtsy Lunges', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Alternating Jump Lunges', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Lateral Lunges with Overhead Reach', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Bulgarian Split Squats', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Calf Raises', area: 'lower', equipment: 'bodyweight' },
  { name: 'Glute Bridge Marches', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Fire Hydrants', area: 'lower', equipment: 'bodyweight', perSide: true },
  { name: 'Glute Bridges', area: 'lower', equipment: 'bodyweight' }, // ADDED, the un-marched pair
  { name: 'Band Squats', area: 'lower', equipment: 'band' },
  { name: 'Band Squat Hold', area: 'lower', equipment: 'band' },
  { name: 'Band Glute Kickbacks', area: 'lower', equipment: 'band', perSide: true },
  { name: 'Band Lateral Walks', area: 'lower', equipment: 'band', perSide: true },
  { name: 'Band Side Steps', area: 'lower', equipment: 'band', perSide: true },
  { name: 'Band Walks Forward and Back', area: 'lower', equipment: 'band' },
  { name: 'Glute Bridge with Band Abduction', area: 'lower', equipment: 'band' },
  { name: 'Hamstring Curls with Arm Pulls', area: 'lower', equipment: 'band', perSide: true },
  { name: 'Goblet Squats', area: 'lower', equipment: 'kettlebell' },
  { name: 'Thrusters', area: 'lower', equipment: 'dumbbell' },

  // ── Torso, which is what the machine runs short of ───────────────────────
  { name: 'Plank', area: 'torso', equipment: 'bodyweight' },
  { name: 'Forearm Plank', area: 'torso', equipment: 'bodyweight' },
  { name: 'High Plank', area: 'torso', equipment: 'bodyweight' },
  { name: 'Side Plank', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Plank Shoulder Taps', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Plank Knee-to-Elbow', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Plank Hip Dips', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Inchworm with Shoulder Tap', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Russian Twists', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Bicycle Crunches', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Heel Taps', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Dead Bugs', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Reverse Crunches', area: 'torso', equipment: 'bodyweight' },
  { name: 'Flutter Kicks', area: 'torso', equipment: 'bodyweight' },
  { name: 'Hollow Hold', area: 'torso', equipment: 'bodyweight' },
  { name: 'V-Ups', area: 'torso', equipment: 'bodyweight' },
  { name: 'Toe Touches', area: 'torso', equipment: 'bodyweight' },
  { name: 'Sit-ups with a Reach', area: 'torso', equipment: 'bodyweight' },
  { name: 'Alternating Leg Raises', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Knee Drives with Opposite Elbow', area: 'torso', equipment: 'bodyweight', perSide: true },
  { name: 'Crunches', area: 'torso', equipment: 'bodyweight' }, // ADDED, the plainest of the set

  // ── Upper body, push ─────────────────────────────────────────────────────
  { name: 'Push-ups', area: 'upper', pattern: 'push', equipment: 'bodyweight' },
  { name: 'Shoulder Press', area: 'upper', pattern: 'push', equipment: 'dumbbell' },
  { name: 'Arnold Press', area: 'upper', pattern: 'push', equipment: 'dumbbell' },
  { name: 'Lateral Raises', area: 'upper', pattern: 'push', equipment: 'dumbbell' },
  { name: 'Squat with Shoulder Press', area: 'upper', pattern: 'push', equipment: 'dumbbell' },
  { name: 'Front Raises', area: 'upper', pattern: 'push', equipment: 'dumbbell' }, // ADDED, pairs with Lateral Raises
  { name: 'Tricep Extensions', area: 'upper', pattern: 'push', equipment: 'dumbbell' }, // ADDED, the corpus has curls and no tricep work off the machine

  // ── Upper body, pull ─────────────────────────────────────────────────────
  { name: 'Bent-Over Rows', area: 'upper', pattern: 'pull', equipment: 'dumbbell' },
  { name: 'Upright Rows', area: 'upper', pattern: 'pull', equipment: 'band' },
  { name: 'Bicep Curls', area: 'upper', pattern: 'pull', equipment: 'dumbbell' },
  { name: 'Hammer Curls', area: 'upper', pattern: 'pull', equipment: 'dumbbell' },
  { name: 'Band Pull-Aparts', area: 'upper', pattern: 'pull', equipment: 'band' },
  { name: 'Bent-Over Reverse Flyes', area: 'upper', pattern: 'pull', equipment: 'band' },
]
