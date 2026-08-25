/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/**
 * A routine written in every part of the grammar the paste parser understands,
 * offered from the paste dialog as a starting point.
 *
 * Teaching by example rather than by documentation: the parser reads a human's
 * handout, so the honest way to describe what it accepts is to show a handout it
 * accepts. Anyone editing this shape gets a routine; anyone reading a syntax
 * table would still have to guess how two rules interact.
 *
 * It exercises, in order: a named section with a duration directive; a lone "or"
 * line as an alternative; a numbered section; a ladder with a main lift that
 * scales and accessories that do not; a bonus after the ladder; a rounds group
 * with a rest between rounds and a note that applies to the whole section; an
 * EMOM stating its rounds first, written both as "Minute 1: …" and as a heading
 * over a bullet, including a minute whose step is shorter than the minute; a
 * 30/30 interval naming its exercises on the line below each timed one, with a
 * step that closes every round; an AMRAP, which becomes the clock it is with its
 * round as the note beside it; a list ended by "Then:" and a second one given a
 * round count and a time at once, spaced by the rest between its exercises; a flame
 * section behind an optional marker, with a numbered list and a closing sprint;
 * a long parenthetical that becomes the step's note; a bulleted step that keeps
 * its own per-side time under a directive; a duration in minutes; and a
 * cool-down. The five seconds to get ready are NOT in it, because the parser
 * adds those itself.
 *
 * A test parses this and asserts nothing is skipped. It is deliberately coupled:
 * if the grammar changes under it, the template must not be allowed to become the
 * one example in the app that the app cannot read.
 */
export const PASTE_TEMPLATE = `Warm-up
40 sec each
* Marching on the Spot
* Arm Circles
* Bodyweight Squats (basic)
or March in Place
* Side Plank - 30 seconds each side

#1 Full Body Ladder
Counting: 10-8-6-4-2
Main exercise:
Goblet Squats
After every set:
* 12 × Hammer Curls
* 10 × Walking Lunges (5 each leg)
Bonus: After completing the ladder, 30 seconds Fast Mountain Climbers

#2 Upper Body
4 Rounds
No rest between exercises
* 15 × Push-ups (or Knee Push-ups for low impact)
* 20 × Bent-over Rows
* 30-second Plank
Rest 45 seconds after each round

#3 Arms EMOM
5-Minute EMOM
Repeat 2 rounds
Start a new exercise every minute.
Minute 1: 12 × Bicep Curls
Minute 2: 10 × Arnold Press
Minute 3: 30-second Wall Sit
Minute 4
* 15 × Band Pull-Aparts
Minute 5: 12 × Lateral Raises + 10 Cross Punches

#4 Legs 30/30
Repeat × 4 rounds
30 sec WORK
Lateral Walks
30 sec WORK
Glute Kickbacks
30 sec REST
Every time you finish a round:
10 Mountain Climbers

#5 Core AMRAP
6-minute AMRAP (as many rounds as possible)
* 10 × Heel Taps
* 20 × Russian Twists - 10 each side
Every time you finish a round:
10 Mountain Climbers

Then:
3 × 30 seconds
* Forearm Plank
* Side Plank - right
15 sec rest between exercises

(Optional) 🔥 Final Burnout
Perform the following:
1. Jumping Jacks for 30 seconds
2. 20 × Flutter Kicks
3. Side-to-Side Squats with a Reach (start standing, step out to one side, sink your hips and reach across your body)
LAST 20 SECONDS
All out - Fast Feet

Cool-down
30 sec each
* Hamstring Stretch
* Chest Opener
* Child's Pose - 1 minute
* Deep Breathing
`
