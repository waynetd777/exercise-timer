#!/usr/bin/env python3
# Exercise Timer
# Copyright (c) 2026 Wayne Davies
# MIT License. See LICENSE in the project root.

"""
Regenerates src/routines/exercises.machine.ts from the Horizon Torus guide PDF.

    python3 scripts/exercise_metadata.py "~/Downloads/Horizon Torus 5 Exercise Guide.pdf"

The routine generator needs to know what each exercise WORKS, what station it is
on, what it attaches to, and whether it is done one side at a time. None of that
was anywhere: `IMAGE_CATALOGUE` is 43 paths and nothing else, and labels are
derived from filenames.

All of it is in the guide, so none of it is typed in here. Same principle as
`exercise_plates.py`, which this borrows its page reader from: run it again and
the table comes out identical, and a revised guide regenerates rather than
needing a human to notice what changed.

WHERE EACH FIELD COMES FROM

  station     The text after "STATION" on the heading line, or at the end of the
              next line where the name wraps onto it.

  area        THE COLOUR OF THE TITLE BAND. The guide's own key says so:
              "Individual exercises are color-coded by muscle group". Yellow is
              upper body, green is torso, blue is lower body. Sampled from the
              rows just under the grey strip, which is the same anchor the plate
              crop uses.

  attachment  Named in the instruction text, e.g. "attach ankle strap". More
              reliable than reading the icon, and the guide lists exactly five.

  perSide     The instructions for a one-limb exercise say which limb to start
              on, or end with "repeat on opposite side".

  pattern     NOT in the guide. Push or pull is derived from the name, because
              the generator alternates them and "upper body" is too coarse for
              that. `PATTERN_OVERRIDES` holds the arguable calls so a human
              decision survives a regeneration.

Requires poppler (`brew install poppler`) for pdftoppm and pdftotext, and Pillow.
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

import exercise_plates as plates

#: The guide's muscle-group key, as the band is actually printed.
AREA_BY_BAND = {
    (237, 217, 144): 'upper',
    (159, 173, 59): 'torso',
    (152, 211, 235): 'lower',
}

#: The five the guide lists on "HOW TO USE THIS GUIDE", as the instructions name them.
ATTACHMENTS = [
    ('ankle strap', 'ankle'),
    ('lat bar', 'lat bar'),
    ('low row bar', 'low row bar'),
    ('ab strap', 'ab strap'),
    ('free-motion arm', 'free-motion'),
]

#: "with the cuff on your right ankle", "hook one leg", "repeat on opposite side".
PER_SIDE = re.compile(
    r'\b(?:right|left|outside|inside|one)\s+(?:ankle|leg|arm|hand|foot|side)\b'
    r'|repeat on (?:the )?opposite side'
)

#: Ordered, because "Rear Cable Fly" is a pull and "Cable Fly" is a push, so the
#: rear test has to run before the fly test.
PATTERN_RULES = [
    ('pull', ('rear', 'row', 'pulldown', 'curl', 'shrug')),
    ('push', ('press', 'fly', 'dip', 'extension', 'raise')),
]

#: Where the name does not settle it. Empty until a human disagrees with a rule.
PATTERN_OVERRIDES: dict[str, str] = {}


def area_of(pdf: pathlib.Path, page: int, work: pathlib.Path) -> str:
    """The muscle group, read off the colour of the title band."""
    subprocess.run(
        ['pdftoppm', '-f', str(page), '-l', str(page), '-r', '60', '-png',
         str(pdf), str(work / 'page')],
        capture_output=True, check=True,
    )
    rendered = next(work.glob('page-*.png'))
    pixels = np.asarray(Image.open(rendered).convert('RGB'), dtype=np.int16)
    rendered.unlink()

    # The same anchor the plate crop uses: the first row that is not the grey
    # "TRAINING INSTRUCTION" strip is the top of the band.
    rows = np.median(pixels, axis=1)
    top = int(np.argmax(np.abs(rows - plates.STRIP).sum(axis=1) > 20))

    band = pixels[top + 3:top + 12].reshape(-1, 3)
    # The band's own colour, not the white of the title printed on it.
    saturated = band[band.max(axis=1) - band.min(axis=1) > 40]
    rgb = tuple(int(v) for v in np.median(saturated if len(saturated) else band, axis=0))
    return AREA_BY_BAND[min(AREA_BY_BAND, key=lambda k: sum((a - b) ** 2 for a, b in zip(k, rgb)))]


def station_of(text: str) -> int:
    """
    The station number, which sits under "STATION" or at the end of a wrapped name.

    "CABLE CONVERGING / CHEST PRESS   7" puts the digit on the second line of the
    name, which is also why `exercise_names` strips a trailing number.
    """
    lines = [line.rstrip() for line in text.split('\n')]
    start = next(i for i, line in enumerate(lines) if 'STATION' in line)
    for line in lines[start:start + 4]:
        if 'STATION' in line:
            continue
        found = re.search(r'(\d)\s*$', line.strip())
        if found:
            return int(found.group(1))
    raise SystemExit(f'no station number near: {lines[start]!r}')


def pattern_of(name: str, area: str) -> str | None:
    """Push or pull, for an upper-body exercise. The generator alternates them."""
    if area != 'upper':
        return None
    if name in PATTERN_OVERRIDES:
        return PATTERN_OVERRIDES[name]
    lowered = name.lower()
    for pattern, words in PATTERN_RULES:
        if any(word in lowered for word in words):
            return pattern
    raise SystemExit(f'cannot tell whether "{name}" is a push or a pull. Add an override.')


def rows(pdf: pathlib.Path) -> list[dict[str, object]]:
    found = []
    with tempfile.TemporaryDirectory() as tmp:
        work = pathlib.Path(tmp)
        for page, name in plates.exercise_names(pdf, plates.page_count(pdf)):
            text = plates.page_text(pdf, page)
            flat = ' '.join(text.split()).lower()
            area = area_of(pdf, page, work)
            title = name.title()
            found.append({
                'name': title,
                'area': area,
                'pattern': pattern_of(title, area),
                'media': f'exercises/{plates.slug(name)}.jpg',
                'station': station_of(text),
                'attachment': next((tag for phrase, tag in ATTACHMENTS if phrase in flat), None),
                'perSide': bool(PER_SIDE.search(flat)),
            })
    return found


def literal(value: object) -> str:
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "\\'") + "'"


def typescript(found: list[dict[str, object]]) -> str:
    lines = [
        '/**',
        ' * Exercise Timer',
        ' * Copyright (c) 2026 Wayne Davies',
        ' * MIT License. See LICENSE in the project root.',
        ' */',
        '',
        '/**',
        ' * The multi-gym half of the exercise table.',
        ' *',
        ' * GENERATED by `scripts/exercise_metadata.py` from the Horizon Torus guide.',
        ' * Do not edit by hand: run the script instead, and put a human decision in',
        ' * its `PATTERN_OVERRIDES` so it survives the next regeneration.',
        ' *',
        ' * Every field but `pattern` is read out of the guide. `area` is the colour of',
        ' * the title band, which the manual\'s own key defines; `attachment` is named in',
        ' * the instruction text; `perSide` is the instructions saying which limb to',
        ' * start on. `pattern` is derived from the name, because the guide has no notion',
        ' * of push against pull and the generator alternates them.',
        ' */',
        '',
        "import type { Exercise } from './exercises'",
        '',
        'export const MACHINE_EXERCISES: readonly Exercise[] = [',
    ]
    for row in found:
        fields = [f'name: {literal(row["name"])}', f"area: {literal(row['area'])}"]
        if row['pattern']:
            fields.append(f"pattern: {literal(row['pattern'])}")
        fields.append("equipment: 'machine'")
        fields.append(f"media: {literal(row['media'])}")
        fields.append(f"station: {row['station']}")
        if row['attachment']:
            fields.append(f"attachment: {literal(row['attachment'])}")
        if row['perSide']:
            fields.append('perSide: true')
        lines.append('  { ' + ', '.join(fields) + ' },')
    lines.append(']')
    lines.append('')
    return '\n'.join(lines)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    pdf = pathlib.Path(sys.argv[1]).expanduser()
    if not pdf.is_file():
        raise SystemExit(f'no such file: {pdf}')

    found = rows(pdf)
    out = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'routines' / 'exercises.machine.ts'
    out.write_text(typescript(found), encoding='utf-8')

    by_area: dict[str, int] = {}
    for row in found:
        by_area[str(row['area'])] = by_area.get(str(row['area']), 0) + 1
    print(f'{len(found)} exercises into {out}')
    print('  by area:', ', '.join(f'{k} {v}' for k, v in sorted(by_area.items())))
    print('  per side:', sum(1 for row in found if row['perSide']))
    print('  ankle strap:', sum(1 for row in found if row['attachment'] == 'ankle'))


if __name__ == '__main__':
    main()
