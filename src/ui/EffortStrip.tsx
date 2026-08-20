import type { Timeline } from '../engine'

type Props = {
  timeline: Timeline
  /** Index of the step in progress, or `timeline.entries.length` when complete. */
  currentIndex: number
}

/**
 * The shape of the whole routine, and the progress bar, in one object.
 *
 * Each step is a sliver: width proportional to its duration, height
 * proportional to its effort. Eight rounds of Tabata read as eight peaks.
 */
export function EffortStrip({ timeline, currentIndex }: Props) {
  return (
    <div className="strip" aria-hidden="true">
      {timeline.entries.map((entry) => (
        <div
          key={entry.index}
          className="strip__step"
          data-state={
            entry.index < currentIndex ? 'done' : entry.index === currentIndex ? 'current' : 'todo'
          }
          style={{
            flexGrow: entry.durationMs,
            ['--effort' as string]: `var(--effort-${entry.role})`,
            ['--step-colour' as string]: `var(--role-${entry.role})`,
          }}
        />
      ))}
    </div>
  )
}
