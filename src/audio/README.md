# audio

Cues that land on the beat, including after the phone has been in a pocket for
ten minutes.

## Three figures, because a boundary is not just a boundary

There is no generic "phase change" sound. Every boundary is both an end and a start,
so the cue is keyed on the step being *entered*, and the three beeps always lead
somewhere:

| | |
|---|---|
| `work-start` | beep beep beep **whistle**, like a referee starting play |
| `work-end` | beep beep beep **bell**. The round is over |
| `workout-complete` | beep beep beep **ding ding ding**, then the spoken wrap-up |

Entering work and leaving it mean opposite things mid-effort, which is the whole
reason they must not sound alike.

## One run at a time

A routine that can wait for a tap is scheduled run by run: `runCues(routine, i)`
gives the cues for the run the clock is currently measuring, and the window
re-arms from scratch when the cursor crosses into the next one.

`cues()` describes a WHOLE workout, so handing it a single run made it say three
wrong things. They are worth knowing, because they are easy to reintroduce:

- **The finishing dings landed at the end of every run**, after the warm-up and
  after each 45-second rest. Completion belongs to the last run only.
- **A gate emitted one boundary cue per step,** all stacked on the same millisecond,
  because every step of a gate sits at time zero. A gate gets ONE cue: a whistle as
  it opens, which is the tap's answer.
- **A gate has no end to count down to**, so there is nothing more to say until
  the user says it.

The finish is the one cue that cannot always be scheduled. A routine ending on a
self-paced step ends when the user taps, and a tap cannot be queued on the audio
clock in advance. So `finishesOnTap()` says when the scheduler has to fire the
figure by hand instead. That costs a few milliseconds on an announcement rather
than a beat, which is the same trade `speech.ts` makes.

## Scheduled ahead, never ticked

Beeps are queued on the `AudioContext` clock in a rolling 30-second window. The
window is re-armed on a timer, on every clock mutation, on return to visibility,
when the whistle recording finishes decoding, and whenever the context changes
state, because iOS suspends it while the page hides and a phone call can leave it
'interrupted'; each of those cancels the stale queue first, so nothing queued
against a frozen clock plays late. They are never fired from a
JavaScript tick, because the audio thread keeps time when the main thread is
throttled, which is exactly the situation a gym timer is in.

The window's arithmetic lives in `schedule.ts`, apart from the hook, so the whole
roll can be simulated: every cue of a real routine scheduled exactly once, none
missed, none twice.

Two consequences worth knowing:

- **`cancelPending()` only drops cues that have not started.** It used to stop
  every tracked oscillator, and since the window re-arms every ten seconds, any
  cue unlucky enough to overlap a re-arm was cut off mid-ring. That is an audible
  click, and it is what made the bell sound like a click rather than a bell.
- **The AudioContext must be unlocked from a user gesture,** so every control calls
  `unlock()`. It is idempotent, which is simpler than guessing which tap comes
  first.
- **A cue is BUILT when it is queued, not when it sounds,** which is up to thirty
  seconds earlier. That is why the first whistle of a cold start used to be the
  fallback tone: the recording is chosen at that moment or not at all, and on a cold
  start the first window is armed in the same tick the decode begins, so every
  whistle in the first half-minute got the plain 2900Hz tone. Two things fix it. The
  download starts at module load rather than at the first tap (`samples.ts`), and
  `onSampleDecoded` tells the scheduler to cancel and queue again when the buffer
  lands. `requeueable()` is what keeps that from playing a cue twice: cancellation
  spares a cue that has begun, so the re-arm has to forget only the cues it actually
  dropped. Both sides read `CANCEL_GRACE_MS`.
- **The window opens a grace behind the clock, and the dedup set is per run.** The
  first arm runs a few milliseconds after the clock starts, because React commits
  first, so a window that opened at the clock never held the cue at zero: no run
  started with its whistle, and a gate's one answer to the tap was silent. `dueCues`
  now looks back by `CANCEL_GRACE_MS`, and the engine plays a cue that late rather
  than dropping it. Separately, a cue's key is its moment WITHIN the run, so the set
  of what has been queued is cleared when the run changes; kept, it swallowed every
  opening cue after the first.

## The tones are measured, not invented

The cues reproduce the sounds of the Tabata Timer app. The beep, bell and dings are
synthesised. Pitches and envelopes were measured from its audio, using an FFT for
the partials and a smoothed amplitude envelope for attack and decay, then rebuilt
with oscillators. Nothing from that app is bundled.

The whistle is the exception, and the story is worth knowing before touching it.
Five synthesis attempts were rejected. Measuring CC0 candidates against the Tabata
whistle then found one identical on every figure, with a waveform correlation of
0.992. **The Tabata app is playing a CC0 freesound recording**, so this app can ship
the real thing. It does, at 44KB. The synthesised versions and their generator are
gone: keeping a second whistle implementation to guard against a decode failure on
a precached file was not worth the code, so a failed decode sounds a plain 2900Hz
tone instead. See `samples.ts` for provenance and licence, and for why the decode
waits for the gesture while the download does not.

Two findings shaped the result:

- **The bell is 2659 Hz with an *inharmonic* partial at ×2.578.** A harmonic partial
  would sound like a tone. The inharmonic one is what reads as metallic.
- **A struck sound needs a two-part envelope.** The real bell falls to a third of
  peak within 25ms and is still audible at 1.2 seconds. A single exponential from
  peak is loud in the middle and dead by 500ms, which sounds like a click whatever
  the pitch is. Hence `sustain` and `strikeMs` on every note.

When picking spectral peaks, enforce a minimum separation. The first analysis pass
reported six "partials" that were adjacent bins of one tone.

## Tuning them: the bench

`ui/SoundsScreen.tsx` plays each cue twice: as the full figure, since timing is most
of how a cue reads, and as its terminal sound alone, which is the part worth
tuning. **The parameters are printed beside it,** so a change can be asked for in
the terms it will be made in ("chop slower", "whistle deeper") rather than described
and guessed at. It is reached at Routines then Sounds under `npm run dev` only, and
the `DEV` branch that loads it compiles away in a production build.

## Speech is deliberately separate

`speech.ts` and `useSpokenCues.ts` sit outside the scheduling system, because speech
cannot be queued against the audio clock. The spoken lines are the opening "Let's
go!", "ten seconds left" and the wrap-up. They fire from the timer's tick and may
land a fraction late, which is fine for information and would not be for a beat.
Keeping them in their own module is what stops anyone mistaking one for a scheduled
cue.

## Files

| | |
|---|---|
| `engine.ts` | Context lifecycle, sample decoding, scheduling, and cancellation that spares sounding notes |
| `tones.ts` | The measured specs, the full figures, and the one subtraction mapping run time to audio time |
| `schedule.ts` | The window arithmetic: `dueCues`, `cueKey`, the lookahead constants |
| `useCueScheduler.ts` | The rolling window, wired to React |
| `samples.ts` | The one recording: provenance, licence, why it is not synthesised, and the download that starts before the first tap |
| `referee-whistle-cc0.wav` | 44KB, 22.05kHz mono, CC0. See `samples.ts` before touching it |
| `useMuted.ts` | Mute, persisted to localStorage, the right home for a UI flag |
| `speech.ts`, `useSpokenCues.ts` | The spoken lines, and why they are not scheduled cues |
