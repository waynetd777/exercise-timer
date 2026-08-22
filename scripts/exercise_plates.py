#!/usr/bin/env python3
"""
Regenerates public/exercises/ from the Horizon Torus exercise guide PDF.

    python3 scripts/exercise_plates.py "~/Downloads/Horizon Torus 5 Exercise Guide.pdf"

The app's illustrations WERE 27 screenshots taken by hand and uploaded to
postimages. They are now served from the app's own origin, and this is what
produces them, so the set is reproducible rather than remembered: run it again
and every plate comes out identical, including the ones nobody has looked at
since 2013.

HOW A PLATE IS FOUND

The guide is an InDesign document with one exercise per page, pages 3 to 43.
Page 1 is the cover and page 2 is "how to use this guide". Every exercise page
has the same furniture: a grey "TRAINING INSTRUCTION" strip, then a coloured
title band, then one photo of the machine with the movement ghosted onto it.

The crop is the title band plus the photo, full page width, at 881:800, measured
from the original screenshots so the new plates are framed exactly like the ones
already in use. It is anchored on the GREY strip rather than the coloured band,
because the band's colour codes the muscle group: yellow for upper body, green
for torso, blue for lower body. Anchoring on yellow silently produced a plate
with the Horizon logo in it.

881px wide at q85 is ~65KB a plate, ~2.7MB for the set. That size is a decision,
not an accident: the whole set is precached by the service worker, so it lands on
the phone at install and a gym with no signal cannot take an illustration away
mid-set. Doubling the resolution would quadruple that install.

The two images that are NOT in this guide, the recumbent bike and the cycling
photo, are left alone. They are not the manual's and cannot be regenerated from
it.

Requires poppler (`brew install poppler`) for pdftoppm, and Pillow.
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

# The "TRAINING INSTRUCTION" strip above the coloured title band. The same on
# every page, which is why it is the anchor.
STRIP = np.array([119, 120, 123])
FIRST_EXERCISE_PAGE = 3
RENDER_DPI = 150
#: Aspect of the existing catalogue images, and the width they were saved at.
PLATE_WIDTH = 881
PLATE_ASPECT = 800 / 881
JPEG_QUALITY = 85

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'exercises'


def page_text(pdf: pathlib.Path, page: int) -> str:
    return subprocess.run(
        ['pdftotext', '-f', str(page), '-l', str(page), '-layout', str(pdf), '-'],
        capture_output=True, text=True, check=True,
    ).stdout


def exercise_names(pdf: pathlib.Path, pages: int) -> list[tuple[int, str]]:
    """
    The exercise on each page, from its heading.

    A heading is the text before "STATION" on the line carrying it, plus the next
    line when the name wraps. "CABLE CONVERGING / SHOULDER PRESS" is one
    exercise, and the two Cable Converging pages differ only in that second line.
    """
    found = []
    for page in range(FIRST_EXERCISE_PAGE, pages + 1):
        lines = [line.strip() for line in page_text(pdf, page).split('\n') if line.strip()]
        head = next((line for line in lines if 'STATION' in line), None)
        if head is None:
            raise SystemExit(f'page {page} has no STATION heading. Is this the right guide?')
        name = head.split('STATION')[0].strip()
        after = lines[lines.index(head) + 1:]
        tail = next((t for t in after if not re.match(r'^\d+\.?$', t)), '')
        if not re.match(r'^\d+\.', tail) and not tail.startswith('TRAINING'):
            name = f'{name} {tail}'
        found.append((page, re.sub(r'\s+\d+$', '', name).strip()))
    return found


def slug(name: str) -> str:
    return '-'.join(w.capitalize() for w in re.findall(r'[A-Za-z]+', name.lower().replace('-', ' ')))


def plate(pdf: pathlib.Path, page: int, work: pathlib.Path) -> Image.Image:
    subprocess.run(
        ['pdftoppm', '-f', str(page), '-l', str(page), '-r', str(RENDER_DPI), '-png',
         str(pdf), str(work / 'page')],
        capture_output=True, check=True,
    )
    rendered = next(work.glob('page-*.png'))
    image = Image.open(rendered).convert('RGB')

    # The first row that is not the grey strip is the top of the title band. Two
    # rows down from there is where the original screenshots began.
    rows = np.median(np.asarray(image, dtype=np.int16), axis=1)
    top = int(np.argmax(np.abs(rows - STRIP).sum(axis=1) > 20)) + 2

    width = image.size[0]
    cropped = image.crop((0, top, width, top + round(width * PLATE_ASPECT)))
    rendered.unlink()
    return cropped.resize((PLATE_WIDTH, round(PLATE_WIDTH * PLATE_ASPECT)), Image.LANCZOS)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    pdf = pathlib.Path(sys.argv[1]).expanduser()
    if not pdf.exists():
        raise SystemExit(f'no such file: {pdf}')

    pages = int(re.search(r'Pages:\s+(\d+)',
                          subprocess.run(['pdfinfo', str(pdf)], capture_output=True,
                                         text=True, check=True).stdout).group(1))
    names = exercise_names(pdf, pages)
    OUT.mkdir(parents=True, exist_ok=True)

    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        work = pathlib.Path(tmp)
        for page, name in names:
            path = OUT / f'{slug(name)}.jpg'
            plate(pdf, page, work).save(path, quality=JPEG_QUALITY, optimize=True)
            total += path.stat().st_size
            print(f'p{page:<3} {name:<44} {path.name}')

    print(f'\n{len(names)} plates, {total // 1024}KB total, into {OUT}')
    print('Catalogue entries live in src/routines/imageCatalogue.ts. Add any new plate there.')


if __name__ == '__main__':
    main()
