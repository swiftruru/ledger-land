"""啟動畫面的素材描圖（06 第 2.2 節）：把維護者的原創剪紙插圖與小 logo 描成內嵌在殼層的 SVG。
需要 pillow、numpy、opencv-python-headless（tracelib.py）。

用法（在 repo 根目錄）：
  python apps/web/brand/trace-launch.py crop --in <小logo原檔.png> --out apps/web/brand/launch-mark-source.png [--pad 2]
      原檔疊了大小兩版，只留最大的那一塊（alpha 膨脹 7px 後取外框最大的連通區），印出各區的外框給人確認。
  python apps/web/brand/trace-launch.py trace --in apps/web/brand/launch-illustration-source.png --out apps/web/brand/launch-illustration.svg \\
      --n 1024 --v 512 --k 12 --eps 1.5 --dilate 3 --min-area 48 --max-bytes 12288 [--palette '#8C3B2E,...']
  python apps/web/brand/trace-launch.py trace --in apps/web/brand/launch-mark-source.png --out apps/web/brand/launch-mark.svg \\
      --n 512 --v 128 --k 5 --eps 1.2 --dilate 3 --min-area 24 --max-bytes 2048
印出色盤、每色的點數與原始、gzip 大小；超過 --max-bytes 就失敗（預算在產生時就擋，不要等到 index.html 變大才發現）。
放不下時依序試 --eps 2.0、--k 少一兩色、--v 384；--n 不要低於 768（膨脹的接縫會變粗）。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from tracelib import assign, derive_palette, load_rgba, sizes, trace_layers, write_svg  # noqa: E402


def cmd_crop(args: argparse.Namespace) -> None:
    im = Image.open(args.inp).convert('RGBA')
    alpha = np.asarray(im)[..., 3]
    mask = ((alpha > 0) * 255).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    boxes = []
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        boxes.append((int(w) * int(h), int(x), int(y), int(w), int(h)))
    if not boxes:
        raise SystemExit('crop：找不到不透明的區塊')
    boxes.sort(reverse=True)
    for b in boxes:
        print(f'區塊 x={b[1]} y={b[2]} w={b[3]} h={b[4]}', file=sys.stderr)
    _, x, y, w, h = boxes[0]
    pad = args.pad
    box = (max(0, x - pad), max(0, y - pad), min(im.width, x + w + pad), min(im.height, y + h + pad))
    im.crop(box).save(args.out, optimize=True)
    print(f'crop：留下最大的區塊 {box}，寫到 {args.out}', file=sys.stderr)


def cmd_trace(args: argparse.Namespace) -> None:
    rgb, alpha, (w, h) = load_rgba(args.inp, args.n)
    palette = [c.strip() for c in args.palette.split(',')] if args.palette else derive_palette(rgb, alpha, args.k)
    idx = assign(rgb, alpha, palette)
    # 面積太小的色（通常是兩個色塊交界的混色）拿掉，像素改歸最近的其他色；指定色盤時不動
    if not args.palette:
        total = int((idx >= 0).sum())
        kept = [c for i, c in enumerate(palette) if int((idx == i).sum()) >= args.min_share * total]
        if len(kept) < len(palette):
            print(f'trace：拿掉面積不到 {args.min_share:.1%} 的色 {", ".join(c for c in palette if c not in kept)}', file=sys.stderr)
            palette = kept
            idx = assign(rgb, alpha, palette)
    layers = trace_layers(idx, palette, args.n, args.v, args.eps, args.dilate, args.min_area, dark_last=args.dark_last)
    sc = args.v / args.n
    svg = write_svg(layers, round(w * sc), round(h * sc))
    raw, gz = sizes(svg)
    print(f'trace：色盤 {", ".join(palette)}', file=sys.stderr)
    for layer in layers:
        pts = sum(len(p) for p in layer.polygons)
        print(f'  {layer.colour} 面積 {layer.area} 多邊形 {len(layer.polygons)} 點 {pts} 圓 {len(layer.circles)}', file=sys.stderr)
    print(f'trace：{args.out} {raw} bytes（gzip {gz}）', file=sys.stderr)
    if raw > args.max_bytes:
        raise SystemExit(f'trace：{raw} bytes 超過上限 {args.max_bytes}，調 --eps、--k 或 --v 再試')
    Path(args.out).write_text(svg, encoding='utf8')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('crop')
    c.add_argument('--in', dest='inp', required=True)
    c.add_argument('--out', required=True)
    c.add_argument('--pad', type=int, default=2)
    c.set_defaults(fn=cmd_crop)
    t = sub.add_parser('trace')
    t.add_argument('--in', dest='inp', required=True)
    t.add_argument('--out', required=True)
    t.add_argument('--n', type=int, default=1024, help='描圖時的長邊像素')
    t.add_argument('--v', type=int, default=512, help='viewBox 的長邊（座標取整的格）')
    t.add_argument('--k', type=int, default=12, help='自動取幾色')
    t.add_argument('--eps', type=float, default=1.5, help='Douglas-Peucker 的容差（v 格的單位）')
    t.add_argument('--dilate', type=int, default=3, help='每色先膨脹的像素（n 的尺度）')
    t.add_argument('--min-area', type=int, default=48, help='小於這個面積的輪廓丟掉（n 的尺度）')
    t.add_argument('--min-share', type=float, default=0.004, help='面積比例低於這個的色併掉（自動取色時）')
    t.add_argument('--max-bytes', type=int, default=12288)
    t.add_argument('--palette', default='', help='逗號分隔的十六進位色，指定就不自動取色')
    t.add_argument('--dark-last', action='store_true', help='最暗的色最後畫（有描邊線的圖）；預設面積大的先畫、小色塊在上面')
    t.set_defaults(fn=cmd_trace)
    args = ap.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
