# audio

Cues that land on the beat, including after the phone has been in a pocket for
ten minutes.

## Scheduled ahead, never ticked

Beeps are queued on the `AudioContext` clock in a rolling 30-second window, and
the window is re-armed on a timer, on every clock mutation, and on return to
visibility. They are never fired from a JavaScript tick, because the audio thread
keeps time when the main thread is throttled — which is exactly the situation a
gym timer is in.

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

- **The phase change is 2659 Hz with an *inharmonic* partial at ×2.578.** A
  harmonic partial would sound like a tone; the inharmonic one is what reads as
  metallic.
- **A struck sound needs a two-part envelope.** The real bell falls to a third of
  peak within 25ms and is still audible at 1.2 seconds. A single exponential from
  peak is loud in the middle and dead by 500ms, which sounds like a click whatever
  the pitch is. Hence `sustain` and `strikeMs` on every note.

When picking spectral peaks, enforce a minimum separation — the first analysis
pass reported six "partials" that were adjacent bins of one tone.

## Speech is deliberately separate

`speech.ts` and `useSpokenCues.ts` sit outside the scheduling system, because
speech cannot be queued against the audio clock. The "ten seconds left"
announcement fires from the timer's tick and may land a fraction late, which is
fine for information and would not be for a beat. Keeping it in its own module is
what stops anyone mistaking it for a scheduled cue.

## Files

| | |
|---|---|
| `engine.ts` | Context lifecycle, scheduling, and cancellation that spares sounding notes |
| `tones.ts` | The measured specs, and the one subtraction mapping run time to audio time |
| `useCueScheduler.ts` | The rolling window |
| `useMuted.ts` | Mute, persisted to localStorage — the right home for a UI flag |
| `speech.ts`, `useSpokenCues.ts` | The spoken cue, and why it is not a scheduled one |
