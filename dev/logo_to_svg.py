#!/usr/bin/env python3
"""Converts the retreat logo PDF into the site's logo (docs/assets/logo.svg).

The PDF's text is turned into vector outlines, the white page background is dropped,
the view is cropped tightly around the artwork, and the logo is colored in the design's slate.

    pip install pymupdf
    python dev/logo_to_svg.py                     # retreat_logo.pdf -> docs/assets/logo.svg
    python dev/logo_to_svg.py other.pdf out.svg
"""

import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
SLATE = '#293D4C'
PAD = 1.5  # points of breathing room around the artwork


def ink_bounds(page, zoom=10):
    """Bounding box of the dark pixels, in page coordinates."""
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    w, h, n, s = pix.width, pix.height, pix.n, pix.samples
    x0 = y0 = None
    x1 = y1 = -1
    for y in range(h):
        row = s[y * w * n:(y + 1) * w * n]
        dark = [i // n for i in range(0, w * n, n) if row[i] < 128]
        if dark:
            y0 = y if y0 is None else y0
            y1 = y
            x0 = dark[0] if x0 is None else min(x0, dark[0])
            x1 = max(x1, dark[-1])
    if y0 is None:
        raise SystemExit('No artwork found in the PDF.')
    return fitz.Rect(x0 / zoom, y0 / zoom, (x1 + 1) / zoom, (y1 + 1) / zoom)


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'retreat_logo.pdf'
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'docs' / 'assets' / 'logo.svg'
    page = fitz.open(src)[0]
    ink = ink_bounds(page)

    svg = page.get_svg_image(text_as_path=True)
    view_box = '%.2f %.2f %.2f %.2f' % (ink.x0 - PAD, ink.y0 - PAD, ink.width + 2 * PAD, ink.height + 2 * PAD)
    svg = re.sub(r'viewBox="[^"]*"', 'viewBox="%s"' % view_box, svg, count=1)
    svg = re.sub(r'\swidth="[^"]*"\sheight="[^"]*"', '', svg, count=1)
    svg = re.sub(r'<path[^>]*fill="#ffffff"[^>]*/>', '', svg)  # the white page background
    svg = svg.replace(' xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"', '')
    svg = svg.replace('<svg xmlns="http://www.w3.org/2000/svg"',
                      '<svg xmlns="http://www.w3.org/2000/svg" fill="%s" role="img" aria-label="Reichart Group Retreat"'
                      % SLATE, 1)
    out.write_text(svg)
    print('%s -> %s (artwork %.0f x %.0f pt, %d bytes)' % (src.name, out, ink.width, ink.height, len(svg)))


if __name__ == '__main__':
    main()
