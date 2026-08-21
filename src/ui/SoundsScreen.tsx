import type { CueKind } from '../engine'
import { audio } from '../audio/engine'
import { sequenceFor, toneFor } from '../audio/tones'
import type { Note, ToneSpec } from '../audio/tones'
import { BackIcon, PlayIcon } from './icons'
import './sounds.css'

/**
 * A bench for the cue sounds.
 *
 * Two rows of buttons per cue on purpose: the full figure, because timing is
 * most of how a cue reads, and the terminal sound alone, because that is the
 * part worth tuning. The parameters are printed beside each one so a change can
 * be asked for in the terms it will actually be made in — "warble slower",
 * "whistle shorter" — rather than by description.
 */
type Bench = {
  kind: Exclude<CueKind, 'countdown'>
  title: string
  signals: string
}

const BENCH: Bench[] = [
  {
    kind: 'work-start',
    title: 'Whistle',
    signals: 'Counting into a work step — a referee starting play',
  },
  {
    kind: 'work-end',
    title: 'Bell',
    signals: 'Counting out of a work step — the round is over',
  },
  {
    kind: 'workout-complete',
    title: 'Three dings',
    signals: 'The end of the routine',
  },
]

/** The numbers behind a note, so a change can be asked for precisely. */
function describe(note: Note): string {
  const parts = [
    `${note.freq}Hz`,
    `${note.durationMs}ms`,
    `sustain ${note.sustain}`,
    `strike ${note.strikeMs}ms`,
  ]
  if (note.partial) parts.push(`partial ×${note.partial.ratio} @${note.partial.gain}`)
  if (note.warble) parts.push(`warble ${note.warble.hz}Hz ±${note.warble.depthHz}Hz`)
  if (note.tremolo) parts.push(`tremolo ${note.tremolo.hz}Hz ${note.tremolo.depth}`)
  if (note.noise) parts.push(`breath ${note.noise.gain} @${note.noise.centreHz}Hz`)
  return parts.join(' · ')
}

function Card({
  title,
  signals,
  spec,
  sequence,
}: {
  title: string
  signals: string
  spec: ToneSpec
  sequence?: ToneSpec
}) {
  return (
    <li className="sound">
      <div className="sound__head">
        <h2 className="sound__title">{title}</h2>
        <p className="sound__signals label label--sm">{signals}</p>
      </div>

      <div className="sound__buttons">
        {sequence && (
          <button className="chip chip--action" onClick={() => audio.preview(sequence)}>
            <PlayIcon />
            Beep beep beep {title.toLowerCase()}
          </button>
        )}
        <button className="chip" onClick={() => audio.preview(spec)}>
          <PlayIcon />
          {sequence ? 'Just the sound' : 'Play'}
        </button>
      </div>

      <ul className="sound__notes">
        {spec.notes.map((note, index) => (
          <li key={index}>{describe(note)}</li>
        ))}
      </ul>
    </li>
  )
}

export function SoundsScreen({ onExit }: { onExit: () => void }) {
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
        </ul>
      </div>
    </main>
  )
}
