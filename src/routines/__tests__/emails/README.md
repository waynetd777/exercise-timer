# Strength routine fixtures

Sixteen routines written by a gym instructor and forwarded by email, saved
here verbatim as the source material for the paste parser. Weekly, from 16 April
to 25 August 2026, with a few weeks missing.

**Only the four listed in the table below are wired into the "understands every
line" test.** The twelve added on 2026-08-27 are source material rather than
passing fixtures: two are nearly clean, and the ten before 13 July are on an
EARLIER, terser template the grammar has never seen. See "The third template"
below.

| File | Received | Shape notes |
|---|---|---|
| `2026-07-20-general.txt` | 20 Jul 2026 | Floor/trampoline warm-up; ladder `2-4-6-8-10-8-6-4-2`; a "valley" ladder `15-12-9-6-3-6-9-12-15` |
| `2026-08-03-trampoline.txt` | 3 Aug 2026 | Trampoline warm-up with a 15s sprint finish; 7-rung finisher `8-12-16-20-16-12-8` |
| `2026-08-17-bands.txt` | 17 Aug 2026 | Resistance bands throughout; `3–5 Rounds` (a range); a "Band Burner" after the ladder |
| `2026-08-25-emom.txt` | 25 Aug 2026 | A SECOND template: AMRAP, two EMOMs, a 30/30 interval, `Repeat 2 rounds` written both above and below its block, `Then:`, `3 × 30 seconds`, and a heading behind an "(Optinal)" marker |

Only two edits were made to the email bodies: the corporate "CAUTION" banner and
the trailing "Sent from my iPhone" are removed. **Everything else is verbatim,
including en-dashes, `×`, `→`, emoji and inconsistent capitalisation.** The parser
has to cope with the real thing, so do not tidy these files.

They arrived on one template every week or two, which is why parsing is worth
doing rather than typing each routine in by hand. The 25 Aug email is the first on
a different template, and it failed the "understands every line" test on 28 lines
before the grammar was widened for it. Expect a third.

## The twelve added on 2026-08-27

Extracted from `.eml` forwards by a script that was validated first: it
reproduces three of the four fixtures above BYTE FOR BYTE, and the fourth to the
character bar some blank lines. That check is what makes the rest trustworthy.

Two of the four originals also exist here as re-forwards, which is why eighteen
emails yielded sixteen routines.

| Understood | Routines |
|---|---|
| 59 of 60 lines | `2026-07-27` |
| 40 of 45 | `2026-07-13` |
| 10 to 74% | everything from 16 April to 6 July |

## The third template

The ten routines before 13 July are terser than anything the parser knows, and
none of it is a small fix:

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
