import type { CueKind } from '../engine'
import { audio } from '../audio/engine'
import { canSpeak, speak, SPOKEN, VOICE } from '../audio/speech'
import { lastStrikeMs, sequenceFor, toneFor } from '../audio/tones'
import type { Note, ToneSpec } from '../audio/tones'
import { BackIcon, PlayIcon } from './icons'
import './sounds.css'

/**
 * A bench for the cue sounds.
 *
 * Each cue plays as the full figure, because timing is most of how a cue reads,
 * and as the terminal sound alone, because that is the part worth tuning. The
 * parameters are printed beside each one so a change can be asked for in the
 * terms it will be made in — "chop slower", "whistle deeper" — rather than
 * described and guessed at.
 */

/** The numbers behind a note. */
function describe(note: Note): string {
  if (note.sample) {
    return [
      `recording “${note.sample}”`,
      `gain ${note.gain}`,
      `rate ${note.playbackRate ?? 1}`,
      audio.sampleReady(note.sample)
        ? 'decoded, so this is what plays'
        : 'not decoded yet — the synthesised contour plays until it is',
    ].join(' · ')
  }

  const parts = [
    `${note.freq}Hz`,
    `${note.durationMs}ms`,
    `attack ${note.attackMs ?? 6}ms`,
    `sustain ${note.sustain}`,
    `strike ${note.strikeMs}ms`,
  ]
  if (note.partial) parts.push(`partial ×${note.partial.ratio} @${note.partial.gain}`)
  if (note.warble) parts.push(`warble ${note.warble.hz}Hz ±${note.warble.depthHz}Hz`)
  if (note.tremolo) {
    parts.push(
      `chop ${note.tremolo.hz}Hz depth ${note.tremolo.depth} ${note.tremolo.shape ?? 'sine'}`,
    )
  }
  for (const resonance of note.resonances ?? []) {
    parts.push(
      `noise ${resonance.gain} @${resonance.centreHz}Hz Q${resonance.q}` +
        (resonance.sweepFromHz ? ` sweep ${resonance.sweepFromHz}Hz` : '') +
        (resonance.wobbleHz ? ` wobble ${resonance.wobbleHz}Hz ±${resonance.wobbleDepthHz}Hz` : ''),
    )
  }
  return parts.join(' · ')
}

function Card({
  title,
  signals,
  spec,
  sequence,
  extra,
}: {
  title: string
  signals: string
  spec: ToneSpec
  sequence?: ToneSpec
  extra?: React.ReactNode
}) {
  return (
    <li className="sound">
      <div className="sound__head">
        <h2 className="sound__title">{title}</h2>
        <p className="sound__signals label label--sm">{signals}</p>
      </div>

      <div className="sound__buttons">
        {sequence && (
          <button className="chip chip--action" onClick={() => void audio.preview(sequence)}>
            <PlayIcon />
            Beep beep beep {title.toLowerCase()}
          </button>
        )}
        <button className="chip" onClick={() => void audio.preview(spec)}>
          <PlayIcon />
          {sequence ? 'Just the sound' : 'Play'}
        </button>
        {extra}
      </div>

      <ul className="sound__notes">
        {spec.notes.map((note, index) => (
          <li key={index}>{describe(note)}</li>
        ))}
      </ul>
    </li>
  )
}

/**
 * The spoken cues, which are a different mechanism entirely: speech cannot be
 * scheduled against the audio clock, so it is fired from the timer's tick and may
 * land a fraction late. Worth checking here because the voice is the browser's,
 * not ours — it differs by device and can be missing altogether.
 */
function VoiceCard() {
  const available = canSpeak()

  return (
    <li className="sound">
      <div className="sound__head">
        <h2 className="sound__title">Voice</h2>
        <p className="sound__signals label label--sm">
          The device&apos;s own voice, not a recording of ours
        </p>
      </div>

      <div className="sound__buttons">
        <button
          className="chip chip--action"
          disabled={!available}
          onClick={() => speak(SPOKEN.start)}
        >
          <PlayIcon />
          “{SPOKEN.start}”
        </button>
        <button
          className="chip chip--action"
          disabled={!available}
          onClick={() => speak(SPOKEN.tenSecondsLeft)}
        >
          <PlayIcon />
          “{SPOKEN.tenSecondsLeft}”
        </button>
        <button
          className="chip chip--action"
          disabled={!available}
          onClick={() => speak(SPOKEN.thatsAWrap)}
        >
          <PlayIcon />
          “{SPOKEN.thatsAWrap}”
        </button>
      </div>

      <ul className="sound__notes">
        <li>
          “{SPOKEN.start}” — just after the routine starts, once per run, not on
          resume from a pause
        </li>
        <li>“{SPOKEN.tenSecondsLeft}” — at ten seconds left, on steps of 20s or more</li>
        <li>“{SPOKEN.thatsAWrap}” — after the three dings, at the end of a routine</li>
        <li>
          rate {VOICE.rate} · volume {VOICE.volume} ·{' '}
          {available
            ? 'fired from the timer tick, not the audio clock'
            : 'this browser has no speech synthesis, so the cue is skipped'}
        </li>
      </ul>
    </li>
  )
}

const BENCH: { kind: Exclude<CueKind, 'countdown'>; title: string; signals: string }[] = [
  {
    kind: 'work-start',
    title: 'Whistle',
    signals: 'Counting into a work step — a referee starting play, from a CC0 recording',
  },
  {
    kind: 'work-end',
    title: 'Bell',
    signals: 'Counting out of a work step — the reps are over',
  },
]

export function SoundsScreen({ onExit }: { onExit: () => void }) {
  /** The whole finish, dings and voice, which is the only way to judge the gap. */
  const playFinish = () => {
    const complete = toneFor('workout-complete')!
    void audio.preview(sequenceFor('workout-complete'))
    if (canSpeak()) {
      window.setTimeout(() => speak(SPOKEN.thatsAWrap), 3000 + lastStrikeMs(complete) + 450)
    }
  }

  return (
    <main className="sounds">
      <header className="sounds__head">
        <button
          className="btn btn--ghost"
          onClick={onExit}
          aria-label="Back to routines"
          title="Back to routines"
        >
          <BackIcon />
        </button>
        <h1 className="sounds__title">Sounds</h1>
        <span />
      </header>

      <div className="sounds__scroll">
        <ul className="sounds__list">
          <Card
            title="Beep"
            signals="Three of these count down the last three seconds of every step"
            spec={toneFor('countdown')!}
          />

          {BENCH.map(({ kind, title, signals }) => (
            <Card
              key={kind}
              title={title}
              signals={signals}
              spec={toneFor(kind)!}
              sequence={sequenceFor(kind)}
            />
          ))}

          <Card
            title="Three dings"
            signals="The end of the routine, followed by the wrap-up line"
            spec={toneFor('workout-complete')!}
            sequence={sequenceFor('workout-complete')}
            extra={
              <button className="chip chip--action" onClick={playFinish}>
                <PlayIcon />
                The whole finish, with voice
              </button>
            }
          />

          <VoiceCard />
        </ul>
      </div>
    </main>
  )
}
