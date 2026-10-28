"""啟動畫面的字樣（06 第 2.2 節、07 第 12 節）：把「LedgerLand」從字型轉成 SVG 的字形外框（維護者 2026-10-28：字樣用英文，和 App 名稱一樣），內嵌在殼層，網站不散布任何字型檔。
字型用 jf open 粉圓（justfont，OFL 1.1）：字型檔放 references/fonts/（永遠不 commit），只有這裡產出的輪廓進 repo；OFL 允許把字形嵌進文件。
需要 fonttools（venv：pip install fonttools）。

用法：python apps/web/brand/wordmark.py references/fonts/jf-openhuninn-2.1.ttf [--text LedgerLand] [--upm 400] [--tracking 0] [--out apps/web/brand/launch-wordmark.svg]
印出字型的名稱、版本與授權（不含 OFL 就停）、字高比例與檔案大小；單一 <path fill="currentColor">，nonzero 填色（字形的輪廓會重疊，不能用 evenodd）。字距用字型的 advance，不套 GPOS 的 kerning。
"""

from __future__ import annotations

import argparse
import gzip
import re
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.roundingPen import RoundingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


def name_record(font: TTFont, name_id: int) -> str:
    rec = font['name'].getDebugName(name_id)
    return rec or ''


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('font')
    ap.add_argument('--text', default='LedgerLand')
    ap.add_argument('--upm', type=int, default=400, help='輸出座標的每 em 單位數（愈小檔案愈小）')
    ap.add_argument('--tracking', type=float, default=0, help='字距（輸出單位）')
    ap.add_argument('--out', default=str(Path(__file__).parent / 'launch-wordmark.svg'))
    args = ap.parse_args()

    font = TTFont(args.font)
    family, version, licence, url = (name_record(font, i) for i in (1, 5, 13, 14))
    print(f'wordmark：{family}，{version}', file=sys.stderr)
    print(f'wordmark：授權 {licence[:80]}{"…" if len(licence) > 80 else ""} {url}', file=sys.stderr)
    if 'OFL' not in licence and 'Open Font License' not in licence and 'OFL' not in url:
        raise SystemExit('wordmark：這個字型的授權說明沒有 OFL，不是預期的字型')
    cmap = font.getBestCmap()
    missing = [ch for ch in args.text if ord(ch) not in cmap]
    if missing:
        raise SystemExit(f'wordmark：字型沒有 {"".join(missing)}')
    glyph_set = font.getGlyphSet()
    hmtx = font['hmtx']
    scale = args.upm / font['head'].unitsPerEm
    glyphs = [cmap[ord(ch)] for ch in args.text]
    # 第一遍：量整串字的外框（y 翻轉後），第二遍帶著位移畫，路徑一出來就貼在 viewBox 的原點
    def draw(pen_factory, dx: float, dy: float):
        x = 0.0
        heights: list[float] = []
        for glyph in glyphs:
            transform = (scale, 0, 0, -scale, x + dx, dy)
            glyph_set[glyph].draw(pen_factory(transform))
            bp = BoundsPen(glyph_set)
            glyph_set[glyph].draw(TransformPen(bp, transform))
            if bp.bounds:
                heights.append(bp.bounds[3] - bp.bounds[1])
            x += hmtx[glyph][0] * scale + args.tracking
        return heights

    bounds_pen = BoundsPen(glyph_set)
    heights = draw(lambda t: TransformPen(bounds_pen, t), 0, 0)
    if not bounds_pen.bounds:
        raise SystemExit('wordmark：沒有畫出任何輪廓')
    x0, y0, x1, y1 = bounds_pen.bounds
    path_pen = SVGPathPen(glyph_set, ntos=lambda v: str(int(round(v))))
    draw(lambda t: RoundingPen(TransformPen(path_pen, t)), -x0, -y0)
    d = re.sub(r'\s+(?=-)', '', path_pen.getCommands()).replace(', ', ',')
    w, h = int(round(x1 - x0)), int(round(y1 - y0))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="currentColor" d="{d}"/></svg>\n'
    raw = svg.encode('utf8')
    Path(args.out).write_text(svg, encoding='utf8')
    print(f'wordmark：{args.out} {len(raw)} bytes（gzip {len(gzip.compress(raw, 9))}），viewBox {w}×{h}，字高約 {max(heights) / args.upm:.2f} em', file=sys.stderr)


if __name__ == '__main__':
    main()
