"""把 make-launch.mjs 截下來的啟動圖壓成 128 色的 PNG（06 第 2.2 節）。需要 pillow。
啟動圖是純色底加扁平色塊，128 色、不抖動就看不出差別，檔案從一兩百 KB 降到幾十 KB；iOS 加入主畫面時只下載其中一張。
用法：python apps/web/brand/quantise-png.py <png>...
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main(paths: list[str]) -> None:
    for p in paths:
        path = Path(p)
        before = path.stat().st_size
        im = Image.open(path).convert('RGB')
        q = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        q.save(path, optimize=True)
        after = path.stat().st_size
        print(f'quantise：{path.name} {before / 1024:.0f} KB 變成 {after / 1024:.0f} KB', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
