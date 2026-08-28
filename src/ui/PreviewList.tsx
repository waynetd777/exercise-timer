/**
 * Exercise Timer
 * Copyright (c) 2026 Wayne Davies
 * MIT License. See LICENSE in the project root.
 */

import { useMemo } from 'react'
import type { PathStep, Routine, TimelineEntry } from '../engine'
import { effortLabel, effortSuffix, groupCaption, nameWithLoad } from './format'
import { previewBlocks } from './preview'
import { useMediaUrl } from './useMediaUrl'
import './preview.css'

/**
 * The whole routine, read before it is run.
 *
 * The run screen shows you one step, or one round, because that is all you can
 * use while you are working. Before you start, the question is the opposite one:
 * what am I in for. That used to be answerable only by reading the routine in
 * the editor, which is a tree of controls rather than something to read, or by
 * copying it out as text.
 *
 * EXPANDED, so round 3 of 8 is printed as round 3 of 8. See `previewBlocks`.
 *
 * Read in the hand, not from three metres, which is the one way this differs
 * from every other list in the app: the run sheet grows its rows to fill the
 * screen because you read it mid-burpee, and this one holds a reading size and
 * scrolls, because nothing here is read while moving.
 */

/** One step, as a line to read: the effort, the name, and what it looks like. */
function Row({ entry }: { entry: TimelineEntry }) {
  const src = useMediaUrl(entry.media)

  return (
    <li className="prow" data-role={entry.role}>
      {/*
        An empty frame where there is no picture, rather than no frame: the names
        line up down the page either way, and a ragged left edge is harder to
        read than a few blanks. `loading="lazy"` because a long routine is a
        couple of hundred of these and only a handful are on screen.
      */}
      {src ? (
        <img className="prow__thumb" src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="prow__thumb prow__thumb--none" aria-hidden="true" />
      )}

      <span className="prow__effort">{effortLabel(entry)}</span>
      <span className="prow__side">{effortSuffix(entry)}</span>

      <span className="prow__name">
        {nameWithLoad(entry)}
        {entry.alternative && <em className="prow__sub">or {entry.alternative}</em>}
        {/*
          EVERY row's note, unlike the run sheet, which shows only the one you
          are working. There it is guidance for right now and the rest of the
          group has to stay on screen; here there is nothing to push off the
          bottom, and the how-to for an exercise you have not done before is
          most of the reason to read a routine in advance.
        */}
        {entry.note && <em className="prow__sub">{entry.note}</em>}
      </span>
    </li>
  )
}

/** A group opening: a section by name, a round or a rung by its count. */
function Heading({ step }: { step: PathStep }) {
  if (step.kind === 'section') {
    return (
      <>
        <h2 className="preview__section label label--sm label--section">
          {step.label?.trim() || 'Section'}
        </h2>
        {step.note && <p className="preview__note label label--sm">{step.note}</p>}
      </>
    )
  }

  // Empty for a group that runs once: "Set 1 of 1" is noise, and the steps read
  // the same with nothing above them.
  const caption = groupCaption(step)
  if (!caption) return null

  return (
    <p className="preview__caption label label--sm" data-kind={step.kind}>
      {caption}
    </p>
  )
}

export function PreviewList({ routine }: { routine: Routine }) {
  const blocks = useMemo(() => previewBlocks(routine.entries), [routine])

  return (
    <div className="preview">
      {blocks.map((block) => (
        // The first step's 1-based position: unique across the routine and
        // stable, which an index into a derived array is not.
        <section className="preview__block" key={block.rows[0]!.step}>
          {block.path.slice(block.carried).map((step) => (
            <Heading key={`${step.id}@${step.iteration}`} step={step} />
          ))}
          <ol className="preview__list">
            {block.rows.map((row) => (
              <Row key={row.step} entry={row} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
