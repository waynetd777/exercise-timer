/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import type { Segment } from '../../engine'
import type { Timing } from '../../editor/blocks'
import { DEFAULT_SECONDS, timingOf } from '../../editor/blocks'
import { CountField } from '../CountField'

/**
 * What a step asks of you, as one control.
 *
 * The unit IS the mode, which is why this is a single select rather than a mode
 * switch plus a value plus a per-side toggle: "20 s", "12 ×", "5 × each side"
 * and "rung" are four things a row can say, and an editor row has no space for
 * three widgets to say them.
 */
const UNITS: { value: string; label: string; title: string }[] = [
  { value: 'timed', label: 's', title: 'Seconds. The step times itself.' },
  { value: 'reps', label: '×', title: 'Reps. The step waits for Next.' },
  { value: 'reps-side', label: '× each side', title: 'Reps per side. The step waits for Next.' },
  /*
   * Counted AND timed, which is an EMOM's minute: sixty seconds and twelve
   * curls, the clock running and the count as the target. The parser has always
   * built these; until now the editor could neither show one nor keep one.
   */
  { value: 'reps-timed', label: '× in', title: 'Reps in a fixed time. The step times itself.' },
  {
    value: 'reps-side-timed',
    label: '× each side in',
    title: 'Reps per side in a fixed time. The step times itself.',
  },
  { value: 'rung', label: 'rung', title: "Takes its count from the ladder's current rung" },
  { value: 'rung-side', label: 'rung each side', title: "The ladder's rung, per side" },
]

function unitOf(timing: Timing): string {
  if (timing.kind === 'timed') return 'timed'
  if (timing.kind === 'rung') return timing.perSide ? 'rung-side' : 'rung'
  return `reps${timing.perSide ? '-side' : ''}${timing.durationMs === undefined ? '' : '-timed'}`
}

export function TimingField({
  segment,
  onChange,
}: {
  segment: Segment
  /** `typed` marks a keystroke in the number box, as opposed to the unit select. */
  onChange: (timing: Timing, typed?: boolean) => void
}) {
  const timing = timingOf(segment)
  const unit = unitOf(timing)
  const counted = timing.kind === 'reps'

  const retarget = (next: string) => {
    // "-side" is no longer the tail of every per-side unit: "× each side in s"
    // ends in the clock. Test for the word rather than the ending.
    const perSide = next.includes('-side')
    if (next.startsWith('rung')) return onChange({ kind: 'rung', ...(perSide ? { perSide } : {}) })
    if (next.startsWith('reps')) {
      const count = counted ? timing.count : 10
      /*
       * A step arriving at a timed unit keeps the clock it still has, so a timed
       * step given a count keeps its seconds rather than being reset.
       *
       * Going self-paced really does drop the duration, because a self-paced
       * step HAS no duration: coming back gets the default, not the old value.
       * The alternative is remembering it in component state, which undo could
       * not see and which is not written down anywhere.
       */
      const durationMs = next.endsWith('-timed')
        ? (segment.durationMs ?? DEFAULT_SECONDS[segment.role] * 1000)
        : undefined
      return onChange({
        kind: 'reps',
        count,
        ...(perSide ? { perSide } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
      })
    }
    // The role's own default, as the counted-and-timed branch above uses: a
    // rest going timed used to get twenty seconds this way and its ten the other.
    onChange({ kind: 'timed', durationMs: segment.durationMs ?? DEFAULT_SECONDS[segment.role] * 1000 })
  }

  const value = timing.kind === 'timed' ? Math.round(timing.durationMs / 1000) : counted ? timing.count : 0

  /** The clock that sits beside the count, for a step that is both. */
  const clockMs = timing.kind === 'reps' ? timing.durationMs : undefined

  /*
   * Whatever else the row is showing, a commit must carry the OTHER value with
   * it. Typing in the count used to write `{ kind: 'reps', count }` and nothing
   * else, which is how a step that was both lost its clock on the first
   * keystroke. Everything the step has goes back every time.
   */
  const counts = (count: number): Timing => ({
    kind: 'reps',
    count,
    ...(timing.kind === 'reps' && timing.perSide ? { perSide: true } : {}),
    ...(clockMs !== undefined ? { durationMs: clockMs } : {}),
  })

  return (
    <label className="esecs">
      {/* A rung has no number of its own. That is the point of it. */}
      {timing.kind !== 'rung' && (
        <CountField
          value={value}
          max={timing.kind === 'timed' ? 5999 : 999}
          label={timing.kind === 'timed' ? 'Seconds' : 'Reps'}
          onCommit={(entered) =>
            onChange(
              timing.kind === 'timed'
                ? { kind: 'timed', durationMs: entered * 1000 }
                : counts(entered),
              true,
            )
          }
        />
      )}

      {/* `data-unit` is for the stylesheet: a native select is as wide as its
          LONGEST option, which is how showing "s" cost the width of "rung each
          side". See `.efield--unit` in editor.css. */}
      <select
        className="efield efield--unit unit"
        data-unit={unit}
        value={unit}
        aria-label="Timed or counted"
        onChange={(event) => retarget(event.target.value)}
      >
        {UNITS.map((option) => (
          <option key={option.value} value={option.value} title={option.title}>
            {option.label}
          </option>
        ))}
      </select>

      {/*
        After the unit, so the row reads "12 × in 20 s" left to right: how many,
        of what kind, for how long. The unit says "in" rather than "in s"
        because the field it introduces already carries its own "s".
        `.erow__main` wraps, so on a phone this pair drops to a second line
        rather than crushing the name field.
      */}
      {clockMs !== undefined && timing.kind === 'reps' && (
        <>
          <CountField
            value={Math.round(clockMs / 1000)}
            max={5999}
            label="Seconds"
            onCommit={(entered) =>
              onChange({ kind: 'reps', count: timing.count, ...(timing.perSide ? { perSide: true } : {}), durationMs: entered * 1000 }, true)
            }
          />
          <span className="esecs__unit" aria-hidden="true">
            s
          </span>
        </>
      )}
    </label>
  )
}
