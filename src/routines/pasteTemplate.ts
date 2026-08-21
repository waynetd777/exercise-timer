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
 * with a rest between rounds and a note that applies to the whole section; a
 * flame section with a numbered list; a long parenthetical that becomes the
 * step's note; and a cool-down. The five seconds to get ready are NOT in it,
 * because the parser adds those itself.
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

🔥 Final Burnout
Perform the following:
1. Jumping Jacks for 30 seconds
2. 20 × Flutter Kicks
3. Side-to-Side Squats with a Reach (start standing, step out to one side, sink your hips and reach across your body)

Cool-down
30 sec each
* Hamstring Stretch
* Chest Opener
* Deep Breathing
`
