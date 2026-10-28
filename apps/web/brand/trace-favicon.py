# 把 favicon-source.webp 描成 public/favicon.svg（2026-10-28，06 第 2.2 節）。
# 做法：原圖縮到 512、每個像素對到固定的 14 色色盤，逐色取輪廓（含洞）後用 Douglas-Peucker 簡化成多邊形，
# 座標縮到 128 的格子取整數；輪廓先膨脹 3 像素讓相鄰色塊重疊、最後畫線條色蓋住接縫。背景色不畫（透明），分頁列上只看到角色。
# 參數 EPS 1.4、MIN_AREA 24 是 32 px 下看不出差別的最粗一檔（約 5.4 KB，gzip 2.2 KB）。
# 需要 pillow、numpy、opencv-python-headless；favicon.ico 用同一份原圖去背後縮成 48、32、16 存成 ICO。
import gzip
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / 'favicon-source.webp'
OUT_SVG = HERE.parent / 'public' / 'favicon.svg'
OUT_ICO = HERE.parent / 'public' / 'icons' / 'favicon.ico'
PAL = [
    ('bg', '#CBEBDA'), ('hair', '#FDE3BE'), ('skin', '#FEEEE1'), ('grey', '#CFCED3'), ('ledger', '#8C3B2E'),
    ('spine', '#703227'), ('pink', '#F7B6C4'), ('mint', '#A9D6BE'), ('iris', '#D7962A'), ('cheek', '#FEB9B1'),
    ('green', '#1E6B48'), ('gold', '#E9BA5F'), ('white', '#FFFFFF'), ('line', '#461B0E'),
]
# 2026-10-28：128 格改 96 格、EPS 1.4 改 1.8（5.5 KB 變 3.5 KB，gzip 2.3 變 1.5 KB）：殼層內嵌了啟動畫面的 SVG 後 HTML 要留在 TCP 第一個視窗內（06 第 8.2 節）；
# 瀏覽器分頁的圖示最大 48px，和 128 格看起來一樣
N, V, EPS, DILATE, MIN_AREA = 512, 96, 1.8, 3, 32


def main() -> None:
    pal = np.array([[int(h[i : i + 2], 16) for i in (1, 3, 5)] for _, h in PAL], dtype=np.float32)
    src = Image.open(SRC).convert('RGB')
    side = min(src.size)
    src = src.crop((0, 0, side, side))
    im = np.asarray(src.resize((N, N), Image.LANCZOS), dtype=np.float32)
    idx = ((im[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1).argmin(-1).astype(np.uint8)
    sc = V / N
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {V} {V}">']
    for k, (name, hexc) in enumerate(PAL):
        if name == 'bg':
            continue
        mask = cv2.dilate((idx == k).astype(np.uint8) * 255, np.ones((DILATE, DILATE), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = []
        for c in contours:
            if cv2.contourArea(c) < MIN_AREA:
                continue
            pts = np.rint(cv2.approxPolyDP(c, EPS / sc, True).reshape(-1, 2) * sc).astype(int)
            keep = [pts[0]]
            for p in pts[1:]:
                if (p != keep[-1]).any():
                    keep.append(p)
            if len(keep) >= 3:
                d.append('M' + ' '.join(f'{x} {y}' for x, y in keep) + 'z')
        if d:
            parts.append(f'<path fill="{hexc}" fill-rule="evenodd" d="{"".join(d)}"/>')
    parts.append('</svg>')
    svg = ''.join(parts).encode()
    OUT_SVG.write_bytes(svg + b'\n')
    # ICO：背景色的像素變透明（用 512 的色盤對應當遮罩，先膨脹 2 像素免得外框被吃掉），再縮成三個尺寸
    alpha = cv2.dilate(((idx != 0).astype(np.uint8) * 255), np.ones((3, 3), np.uint8))
    rgba = Image.fromarray(np.dstack([im.astype(np.uint8), alpha]), 'RGBA')
    frames = [rgba.resize((n, n), Image.LANCZOS) for n in (48, 32, 16)]
    frames[0].save(OUT_ICO, format='ICO', sizes=[(48, 48), (32, 32), (16, 16)], append_images=frames[1:])
    print(f'favicon.svg {len(svg)} bytes (gzip {len(gzip.compress(svg, 9))}), favicon.ico {OUT_ICO.stat().st_size} bytes', file=sys.stderr)


if __name__ == '__main__':
    main()
