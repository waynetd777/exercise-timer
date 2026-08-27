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

A marker in front of a heading is read past and then kept: `(Optional) 🔥 Final
Burnout` is the Final Burnout section, still named `(Optional) Final Burnout`,
because whether a block is optional is yours to know.

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
| `Repeat 2 rounds` | the same as `2 Rounds`, and it may be written either above the steps or below them |
| `Repeat × 4 rounds` | the same again |
| `3 × 30 seconds` | three rounds, and every step in them gets 30 seconds |
| `Counting: 10-8-6-4-2` | a ladder: five rounds, the count changing each time |
| `15-12-9-6-3` | the same, without the word |
| `Rest 45 seconds after each round` | a rest between rounds, not after the last one |
| `15 sec rest between exercises` | written after the list, it spaces it out. Between, so the last step runs straight into the next round |
| `Then:` | ends the block above it, so what follows is not read as part of it |
| `Every time you finish a round:` | the step on the next line closes every round |

`Repeat 2 rounds` below a run of steps wraps those steps. It only does that where
the section is still a plain list: a section that has already stated a ladder or a
round keeps it, and the line opens a new group beside it rather than around it.

In a ladder, `Main exercise:` marks the lift that takes the rung count, and
`After every set:` marks accessories that keep their own count. Accessories run
after every set including the last. `Bonus: …` adds one step after the ladder
finishes.

## Intervals, EMOMs and AMRAPs

An **EMOM** ("every minute on the minute") is a run of one-minute steps. Write the
minutes and the app times them; a rep count on the same line is shown as the
target for that minute.

| Write | Means |
|---|---|
| `5-Minute EMOM` | a heading. It becomes a note, since the minutes below carry the timing |
| `Minute 1: 12 × Bicep Curls` | one minute, labelled 12 reps |
| `Minute 4` | a heading over the bulleted step that fills that minute |
| `Minute 6: 30-sec Wall Sit` | 30 seconds of work and 30 of rest, because the minute is fixed |
| `Minute 5: 12 × Lateral Raises + 10 Cross Punches` | one minute, not two. A joined pair inside a minute stays one step |

A **30/30 interval** states the time on one line and the exercise on the next.

| Write | Means |
|---|---|
| `30 sec WORK` | 30 seconds for whatever is named on the line below |
| `30 sec REST` | a 30-second rest, needing no line below |
| `LAST 20 SECONDS` | the same idea: 20 seconds for the effort named below it |
| `Replace rest with 30-second Squat Hold` | a 30-second Squat Hold, and the line is kept as a note so you can see what it stands in for |

An **AMRAP** is a clock, and that is what it becomes.

| Write | Means |
|---|---|
| `10-MINUTE AMRAP (As Many Rounds As Possible)` | a single 10-minute countdown, named "As many rounds as possible" |
| the bulleted list below it | the round, shown in full beside the clock for the whole ten minutes |
| `Every time you finish a round:` | that step joins the round too |
| `AMRAP` with no length | no clock to build, so it stays a note and the list below is read as ordinary steps |

The ten minutes is stated, so it is read. How many rounds is not, so it is not
invented: that number is yours to make against the clock, and the app just runs
it and shows you the round.

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

## Writing a routine back out

Send › Copy as text, or Download as text, writes a routine in this format. It is
the only export that is lossy, so it is for sending to a person rather than for
keeping. It always says what it could not carry.

What has no syntax here, and so cannot survive the trip:

- **Pictures.** Nothing in this format can name one.
- **The routine's name**, which the download carries as its filename and the
  paste dialog asks for on the way back.
- **The routine's colour**, and whether it was a favourite.
- **A step whose role does not match its name.** A role is read off the name on
  the way in, so a get-ready called "Change Sides" comes back as work.
- **A note under 24 characters.** At that length a parenthesis is part of what an
  exercise is called, so writing one would rename the step.
- **A count on a step that is also timed.** `12 × Bicep Curls - 60 seconds` reads
  as a step CALLED "12 × Bicep Curls"; only an EMOM minute says both.
- **An AMRAP's round, unless a heading follows the AMRAP.** Nothing else ends the
  round, so anywhere else it is written as the plain countdown it is.

Two things change shape rather than being lost. A routine that does not open on a
get-ready gains the usual five seconds, and loose steps are gathered into a
section called "Routine". Both are this parser's doing, and both settle: writing
a routine that has already been through once changes nothing further.

## What the app adds

**Five seconds to get ready**, at the very start. Long enough to prop the phone
up and step back. It is skipped if your text already opens with a get-ready step,
so a routine that says `30 sec to get set` does not wait twice.

Nothing else. Every step, count and duration comes from what you pasted, and a
rest the app puts in for you always comes from a line that asked for one: the rest
between rounds, the rest between exercises, the balance of an EMOM minute.

## How a section is shown while running

A section whose every step is timed runs as a **countdown**, one step at a time.
Any other section runs as a **list**, with the whole round on screen and one Next
to clear it, because you do not tap through a set of curls with your hands full.
A timed step inside a list still counts itself down.
