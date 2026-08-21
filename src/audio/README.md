# audio

Cues that land on the beat, including after the phone has been in a pocket for
ten minutes.

## Three figures, because a boundary is not just a boundary

There is no generic "phase change" sound. Every boundary is both an end and a
start, so the cue is keyed on the step being *entered*, and the three beeps
always lead somewhere:

| | |
|---|---|
| `work-start` | beep beep beep **whistle** — a referee starting play |
| `work-end` | beep beep beep **bell** — the round is over |
| `workout-complete` | beep beep beep **ding ding ding**, then the spoken wrap-up |

Entering work and leaving it mean opposite things mid-effort, which is the whole
reason they must not sound alike.

## Scheduled ahead, never ticked

Beeps are queued on the `AudioContext` clock in a rolling 30-second window, and
the window is re-armed on a timer, on every clock mutation, and on return to
visibility. They are never fired from a JavaScript tick, because the audio thread
keeps time when the main thread is throttled — which is exactly the situation a
gym timer is in.

The window's arithmetic lives in `schedule.ts`, apart from the hook, so the whole
roll can be simulated: every cue of a real routine scheduled exactly once, none
missed, none twice.

Two consequences worth knowing:

- **`cancelPending()` only drops cues that have not started.** It used to stop
  every tracked oscillator, and since the window re-arms every ten seconds, any
  cue unlucky enough to overlap a re-arm was cut off mid-ring. That is an audible
  click, and it is what made the bell sound like a click rather than a bell.
- **The AudioContext must be unlocked from a user gesture**, so every control
  calls `unlock()`. It is idempotent, which is simpler than guessing which tap
  comes first.

## The tones are measured, not invented

The cues reproduce the sounds of the Tabata Timer app. The beep, bell and dings
are synthesised: pitches and envelopes were measured from its audio — FFT for the
partials, a smoothed amplitude envelope for attack and decay — and rebuilt with
oscillators, so nothing from that app is bundled.

The whistle is the exception, and the story is worth knowing before touching it.
Five synthesis attempts were rejected. Measuring CC0 candidates against the Tabata
whistle then found one identical on every figure, with a waveform correlation of
0.992: **the Tabata app is playing a CC0 freesound recording**, so the app can ship
the real thing. It does, at 44KB. The synthesised versions and their generator are
gone — keeping a second whistle implementation to guard against a decode failure
on a precached file was not worth the code, so a failed decode sounds a plain
2900Hz tone instead. See `samples.ts` for provenance and licence.

Two findings shaped the result:

- **The bell is 2659 Hz with an *inharmonic* partial at ×2.578.** A harmonic
  partial would sound like a tone; the inharmonic one is what reads as metallic.
- **A struck sound needs a two-part envelope.** The real bell falls to a third of
  peak within 25ms and is still audible at 1.2 seconds. A single exponential from
  peak is loud in the middle and dead by 500ms, which sounds like a click whatever
  the pitch is. Hence `sustain` and `strikeMs` on every note.

When picking spectral peaks, enforce a minimum separation — the first analysis
pass reported six "partials" that were adjacent bins of one tone.

## Tuning them: the bench

`ui/SoundsScreen.tsx` plays each cue as the full figure — timing is most of how a
cue reads — and as its terminal sound alone, which is the part worth tuning, with
**the parameters printed beside it** so a change can be asked for in the terms it
will be made in ("chop slower", "whistle deeper") rather than described and
guessed at. It is reached at Routines → Sounds under `npm run dev` only, and the
`DEV` branch that loads it compiles away in a production build.

## Speech is deliberately separate

`speech.ts` and `useSpokenCues.ts` sit outside the scheduling system, because
speech cannot be queued against the audio clock. The spoken lines — the opening
"enjoy your workout", "ten seconds left", the wrap-up — fire from the timer's tick
and may land a fraction late, which is fine for information and would not be for a
beat. Keeping them in their own module is what stops anyone mistaking one for a
scheduled cue.

## Files

| | |
|---|---|
| `engine.ts` | Context lifecycle, sample decoding, scheduling, and cancellation that spares sounding notes |
| `tones.ts` | The measured specs, the full figures, and the one subtraction mapping run time to audio time |
| `schedule.ts` | The window arithmetic: `dueCues`, `cueKey`, the lookahead constants |
| `useCueScheduler.ts` | The rolling window, wired to React |
| `samples.ts` | The one recording: provenance, licence, and why it is not synthesised |
| `referee-whistle-cc0.wav` | 44KB, 22.05kHz mono, CC0 — see `samples.ts` before touching it |
| `useMuted.ts` | Mute, persisted to localStorage — the right home for a UI flag |
| `speech.ts`, `useSpokenCues.ts` | The spoken lines, and why they are not scheduled cues |
