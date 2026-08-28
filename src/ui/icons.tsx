/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

/*
 * Inline SVG rather than an icon font or emoji: it inherits `currentColor`,
 * stays crisp at any size, renders identically on every platform, and ships no
 * extra request, which matters for something that has to work offline.
 *
 * Transport icons are filled, utilities are stroked; that is the usual split
 * and keeps the row from looking uniformly heavy.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function PlayIcon() {
  return (
    <Svg>
      <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
    </Svg>
  )
}

export function PauseIcon() {
  return (
    <Svg>
      <path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor" />
    </Svg>
  )
}

export function ResetIcon() {
  return (
    <Svg>
      <polyline points="3 4 3 10 9 10" {...STROKE} />
      <path d="M5.2 14.5a7.5 7.5 0 1 0 1.6-7.9L3 10" {...STROKE} />
    </Svg>
  )
}

export function PrevIcon() {
  return (
    <Svg>
      <polyline points="11.5 6 5.5 12 11.5 18" {...STROKE} />
      <polyline points="18.5 6 12.5 12 18.5 18" {...STROKE} />
    </Svg>
  )
}

export function NextIcon() {
  return (
    <Svg>
      <polyline points="5.5 6 11.5 12 5.5 18" {...STROKE} />
      <polyline points="12.5 6 18.5 12 12.5 18" {...STROKE} />
    </Svg>
  )
}

export function SoundOnIcon() {
  return (
    <Svg>
      <path d="M11 4 6 8.5H2.8v7H6l5 4.5z" fill="currentColor" />
      <path d="M15.2 9a4.2 4.2 0 0 1 0 6" {...STROKE} />
      <path d="M18 6.2a8 8 0 0 1 0 11.6" {...STROKE} />
    </Svg>
  )
}

export function SoundOffIcon() {
  return (
    <Svg>
      <path d="M11 4 6 8.5H2.8v7H6l5 4.5z" fill="currentColor" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" {...STROKE} />
    </Svg>
  )
}

export function BackIcon() {
  return (
    <Svg>
      <polyline points="14 6 8 12 14 18" {...STROKE} />
    </Svg>
  )
}

/**
 * The drag grip. Two columns of dots, the convention everywhere, so it reads as
 * "hold this" without a label being needed.
 */
export function GripIcon() {
  return (
    <Svg>
      {[8, 12, 16].map((y) => (
        <g key={y}>
          <circle cx="9.5" cy={y} r="1.5" fill="currentColor" />
          <circle cx="14.5" cy={y} r="1.5" fill="currentColor" />
        </g>
      ))}
    </Svg>
  )
}

export function StarIcon({ filled = false }: { filled?: boolean }) {
  const points = "12 3.6 14.7 9.2 20.8 10 16.4 14.3 17.5 20.4 12 17.4 6.5 20.4 7.6 14.3 3.2 10 9.3 9.2"
  return (
    <Svg>
      {filled ? (
        <polygon points={points} fill="currentColor" />
      ) : (
        <polygon points={points} {...STROKE} />
      )}
    </Svg>
  )
}

export function CopyIcon() {
  return (
    <Svg>
      <rect x="9" y="9" width="11" height="11" rx="2" {...STROKE} />
      <path d="M15 5.5H6A1.5 1.5 0 0 0 4.5 7v9" {...STROKE} />
    </Svg>
  )
}

export function PencilIcon() {
  return (
    <Svg>
      <path d="M4 20h4l10-10-4-4L4 16z" {...STROKE} />
      <path d="M14.5 5.5 18.5 9.5" {...STROKE} />
    </Svg>
  )
}

export function TrashIcon() {
  return (
    <Svg>
      <path d="M4.5 7h15" {...STROKE} />
      <path d="M9.5 7V4.8h5V7" {...STROKE} />
      <path d="M6.5 7l1 12.2h9L17.5 7" {...STROKE} />
    </Svg>
  )
}

export function ImportIcon() {
  return (
    <Svg>
      <path d="M12 3.5v10.5" {...STROKE} />
      <polyline points="7.5 9.5 12 14 16.5 9.5" {...STROKE} />
      <path d="M4.5 17v2.5h15V17" {...STROKE} />
    </Svg>
  )
}

export function CheckIcon() {
  return (
    <Svg>
      <polyline points="5 12.5 9.5 17 19 7.5" {...STROKE} />
    </Svg>
  )
}

export function HelpIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.6" {...STROKE} />
      {/* The hook of a question mark, then its dot as a short stroke. A dot
          drawn as a circle would fill in at 18px. */}
      <path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1 1-1.1 1.8" {...STROKE} />
      <path d="M12 16.6v.2" {...STROKE} />
    </Svg>
  )
}

export function CloseIcon() {
  return (
    <Svg>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...STROKE} />
    </Svg>
  )
}

/**
 * The app mark: a stopwatch, matching favicon.svg exactly.
 *
 * Its own viewBox and class rather than the 24-unit `Svg` wrapper, because it
 * is sized in `em` to track whatever text it sits beside.
 */
export function StopwatchIcon() {
  return (
    <svg className="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="32" cy="38" r="18" />
        <path d="M26.5 7h11" />
        <path d="M32 7v6.2" />
        <path d="M47.5 15.5l3.6 3.6" />
        <path d="M32 38V27.5" />
      </g>
    </svg>
  )
}

/** A dumbbell: two plates and a bar, for the weights page. */
export function WeightIcon() {
  return (
    <Svg>
      <path d="M4 9.5v5" {...STROKE} />
      <path d="M20 9.5v5" {...STROKE} />
      <rect x="6.5" y="7.5" width="3" height="9" rx="1" {...STROKE} />
      <rect x="14.5" y="7.5" width="3" height="9" rx="1" {...STROKE} />
      <path d="M9.5 12h5" {...STROKE} />
    </Svg>
  )
}

export function DownIcon() {
  return (
    <Svg>
      <polyline points="6 9.5 12 15.5 18 9.5" {...STROKE} />
    </Svg>
  )
}

export function PlusIcon() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" {...STROKE} />
    </Svg>
  )
}

/** Wrap in reps: a loop. */
export function RepsIcon() {
  return (
    <Svg>
      <path d="M4.5 11a7.5 7.5 0 0 1 12.8-5.3" {...STROKE} />
      <polyline points="17.5 2.5 17.5 6.5 13.5 6.5" {...STROKE} />
      <path d="M19.5 13a7.5 7.5 0 0 1-12.8 5.3" {...STROKE} />
      <polyline points="6.5 21.5 6.5 17.5 10.5 17.5" {...STROKE} />
    </Svg>
  )
}

export function UndoIcon() {
  return (
    <Svg>
      <polyline points="9 6 4 11 9 16" {...STROKE} />
      <path d="M4 11h9.5a5.5 5.5 0 0 1 0 11H9" {...STROKE} />
    </Svg>
  )
}

export function RedoIcon() {
  return (
    <Svg>
      <polyline points="15 6 20 11 15 16" {...STROKE} />
      <path d="M20 11h-9.5a5.5 5.5 0 0 0 0 11H15" {...STROKE} />
    </Svg>
  )
}

export function ImageIcon() {
  return (
    <Svg>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" {...STROKE} />
      <circle cx="9" cy="10" r="1.6" {...STROKE} />
      <polyline points="5 17 10 12.5 13.5 15.5 16.5 13 19 15" {...STROKE} />
    </Svg>
  )
}

export function ExportIcon() {
  return (
    <Svg>
      <path d="M12 16V5.5" {...STROKE} />
      <polyline points="7.5 10 12 5.5 16.5 10" {...STROKE} />
      <path d="M4.5 17v2.5h15V17" {...STROKE} />
    </Svg>
  )
}

export function ShareIcon() {
  return (
    <Svg>
      <circle cx="6" cy="12" r="2.6" {...STROKE} />
      <circle cx="18" cy="6" r="2.6" {...STROKE} />
      <circle cx="18" cy="18" r="2.6" {...STROKE} />
      <path d="M8.3 10.8 15.7 7.2M8.3 13.2l7.4 3.6" {...STROKE} />
    </Svg>
  )
}

/** Paste: a clipboard. Stroked, like the other utilities. */
export function PasteIcon() {
  return (
    <Svg>
      <path d="M9 4.5h6v3H9z" {...STROKE} />
      <path
        d="M9 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H15"
        {...STROKE}
      />
      <path d="M8.5 12h7M8.5 16h4" {...STROKE} />
    </Svg>
  )
}

/* Filled dots rather than stroked circles: at 19px a stroked ring reads as mush. */
export function MoreIcon() {
  return (
    <Svg>
      <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.7" fill="currentColor" />
    </Svg>
  )
}

/** A note: lines on a page. */
export function NoteIcon() {
  return (
    <Svg>
      <path d="M6 4.5h12v15H6z" {...STROKE} />
      <path d="M9 9h6M9 12.5h6M9 16h3.5" {...STROKE} />
    </Svg>
  )
}

/**
 * A list: the routine written out, rather than one step of it.
 *
 * Dots and rules, not the note icon's page: what it opens is the SAME steps in
 * another arrangement, and a page would say a document had been produced.
 */
export function ListIcon() {
  return (
    <Svg>
      <circle cx="5.5" cy="7" r="1.4" fill="currentColor" />
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="5.5" cy="17" r="1.4" fill="currentColor" />
      <path d="M10 7h9M10 12h9M10 17h6" {...STROKE} />
    </Svg>
  )
}
