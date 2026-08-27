# Strength routine fixtures

Sixteen routines written by a gym instructor and forwarded by email, saved
here verbatim as the source material for the paste parser. Weekly, from 16 April
to 25 August 2026, with a few weeks missing.

**All sixteen are wired into the "understands every line" test**, and all sixteen
pass. They read at 53% when they were added; the grammar was widened for them the
same day.

## The twelve added on 2026-08-27

Extracted from `.eml` forwards by a script that was validated first: it
reproduces three of the four fixtures above BYTE FOR BYTE, and the fourth to the
character bar some blank lines. That check is what makes the rest trustworthy.

Two of the four originals also exist here as re-forwards, which is why eighteen
emails yielded sixteen routines.

## The third template, now read

The ten routines before 13 July are terser than anything the parser knew. These
were the forms, and all of them are understood now:

- Bare lines with no bullet at all, where the current grammar needs `*`, a
  number and a dot, or a bullet character
- `10 x forward/backward run`, `10x lateral raises`: a lowercase `x`, sometimes
  with no space
- `2-4-6-8-10-8-6-4-2 king squats`: the ladder counts INLINE with the exercise
  rather than on a `Counting:` line of their own
- `LEGS`, `ARMS`, `ABS`, `#1`: bare headings, and a section marker that is just
  a number
- `20-30-45-30-20 sec cardio`: a ladder of DURATIONS rather than of reps
- `Knee lifts (20 sec)(Tabata)`: the duration in a parenthesis after the name
- `5m ham string stretch`: minutes written as `5m`
- `10/12 x lateral raises`, `1-2mins Jumping jacks`: a range where one number
  is expected

The two July routines are on the template the parser does know, and fail on
smaller things: a bracketed optional rung `Counting: 12-8-4-8-12-(16)`, and four
directive lines such as "After every round:" and "Use heavy dumbbells".

## Shapes, not syntax

Six of these needed a decision about what the writing MEANT before it could be
read, and Wayne made each one:

- **A pyramid circuit.** Numbered lines are a VOCABULARY, and the rows below
  spend it: `1`, `1 + 2`, `1 + 2 + 3`. Seven rounds, growing and shrinking. A
  lone numbered line outside an ascending run is an ordinary step, and in one
  routine it bookends the pyramid on both sides.
- **A countdown**, `10,9,8,…,1`, is a ladder over the exercises beneath it.
- **A course drawn in characters**, `A🔺-------5m———🔺B`, is the shape of the
  room. It becomes the section's note, and its distance measures the legs below
  it: "Walking lunge 5m A-B". The markers are kept, since the note still has
  them.
- **A step whose length is described rather than stated**, "wall sit till 1min is
  over", waits for Next. A made-up thirty seconds would be the app inventing the
  number it could not read.
- **An interval pair**, "Squats 20sec - 10sec squat hold", is two steps on a line
  shaped like a range.
- **A ladder of durations**, "20-30-45-30-20 sec cardio", is a run of timed steps
  and emphatically not a rep ladder whose main lift is called "sec cardio".
