# Pasting a routine as text

The app reads a routine written the way a gym instructor writes one. Open
**Paste** on the library screen, drop the text in, and it becomes a draft you
review in the editor before saving.

Two things worth knowing before the detail:

- **Nothing is guessed.** A line the parser cannot place is listed, with its line
  number, before anything is saved. What you were not told is on screen.
- **The result is a draft.** It opens in the editor, so a line read the wrong way
  costs a correction rather than a bad workout.

**Copy template** in the paste dialog hands you the example below, ready to edit.

## A routine using everything

```
Warm-up
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

🔥 Final Burnout
Perform the following:
1. Jumping Jacks for 30 seconds
2. 20 × Flutter Kicks
3. Side-to-Side Squats with a Reach (start standing, step out to one side, sink your hips and reach across your body)

Cool-down
30 sec each
* Hamstring Stretch
* Chest Opener
* Child's Pose - 1 minute
* Deep Breathing
```

## Sections

A section is a named part of the routine. Four ways to start one:

| Write | Example |
|---|---|
| A number | `#1 Full Body Ladder` |
| A flame | `🔥 Final Burnout` |
| After a round | `After Round 4` |
| A known name | `Warm-up`, `Cool-down`, `Final Burnout`, `Band Burner`, `Burnout Ladder` |

Only those names are recognised on their own. Any other heading needs a `#` or a
flame, because a rule like "a short line in title case" would swallow half the
exercises.

## Steps

Start a step with `*`, `•`, `-`, or a number and a dot.

| Write | Means |
|---|---|
| `12 × Hammer Curls` | 12 reps, waits for Next |
| `20 Flutter Kicks` | the same, with the `×` left out |
| `30-second Plank` | 30 seconds, counts itself down |
| `Fast Feet for 15 seconds` | the same, the other way round |
| `Plank - 1 minute` | minutes work anywhere seconds do: `2 min`, `1.5 minutes` |
| `Side Plank - 30 seconds each side` | 30 seconds, once per side |
| `40 sec each` | gives every step in the section that duration |

`40 sec each` only counts on a line of its own. A bulleted step saying
`30 seconds each side` keeps its own time and never retimes the list.

A step named `Get ready`, `Get set` or `Prepare` becomes a get-ready step. One
that says `rest` becomes a rest. Everything else is work.

## Rounds and ladders

| Write | Means |
|---|---|
| `4 Rounds` | everything below it, four times |
| `3-5 Rounds` | five. A range takes its upper bound, since you can always stop early |
| `Counting: 10-8-6-4-2` | a ladder: five rounds, the count changing each time |
| `15-12-9-6-3` | the same, without the word |
| `Rest 45 seconds after each round` | a rest between rounds, not after the last one |

In a ladder, `Main exercise:` marks the lift that takes the rung count, and
`After every set:` marks accessories that keep their own count. Accessories run
after every set including the last. `Bonus: …` adds one step after the ladder
finishes.

## Details on a step

| Write | Means |
|---|---|
| `10 × Walking Lunges (5 each leg)` | five a side, the smaller and truer number |
| `Lateral Walks - 5 each direction` | the same |
| `15 × Push-ups (or Knee Push-ups for low impact)` | an easier swap, shown beside the step |
| `or March in Place` | on its own line, the same swap for the step above |
| `20 × Front Punches + 20 × Uppercuts` | two steps, with or without the `×`. It splits only when both halves state a count |
| `Squat + Shoulder Press` | one step. One movement, left intact |
| `Squats with a Reach (start standing, step out…)` | a parenthesis of 24 characters or more becomes the step's note, so the name stays readable across a room |
| `(basic)` | short ones stay in the name, because they are part of what the exercise is |

Lines like `No rest between exercises` or `Complete the full count of one exercise
before moving to the next` become a note on the section rather than on any step.

## What the app adds

**Five seconds to get ready**, at the very start. Long enough to prop the phone
up and step back. It is skipped if your text already opens with a get-ready step,
so a routine that says `30 sec to get set` does not wait twice.

Nothing else. Every step, count and duration comes from what you pasted.

## How a section is shown while running

A section whose every step is timed runs as a **countdown**, one step at a time.
Any other section runs as a **list**, with the whole round on screen and one Next
to clear it, because you do not tap through a set of curls with your hands full.
A timed step inside a list still counts itself down.
