"""描圖共用模組（06 第 2.2 節）：把扁平色塊的 RGBA 圖描成很小的 SVG，給啟動畫面的插圖與小 logo 用。
需要 pillow、numpy、opencv-python-headless；由 trace-launch.py 呼叫。

做法：圖縮到長邊 n 像素（LANCZOS），只拿不透明的像素用 k-means 取 k 色，每群的代表色吸附到群裡最常見的真實顏色
（扁平剪紙風的色塊幾乎是單一顏色，平均值會變髒）；每個像素對到最近的色、透明的不畫；逐色先膨脹幾個像素再取輪廓（含洞），
Douglas-Peucker 簡化，座標取整到 v 格；面積大的色先畫、最暗的色最後畫，膨脹的接縫被後畫的蓋掉。
路徑用相對指令（M x y 之後都是 l dx dy），負數前不留空白，比絕對座標省三分之一的位元。
輸出只有 <svg viewBox> 加每色一個 <path fill fill-rule="evenodd">：沒有 xml 宣告、註解、metadata，也沒有 style 屬性
（殼層 index.html 不准有 style 屬性，postbuild 會擋）。
"""

from __future__ import annotations

import gzip
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass
class Layer:
    colour: str
    polygons: list[list[tuple[int, int]]]
    area: int
    # 很小又接近圓形的色塊（帳簿上的金色圓點、腮紅）直接寫成 <circle>：多邊形簡化後會變成菱形，圓只要三個數字
    circles: list[tuple[int, int, int]]


def load_rgba(path: str, n: int) -> tuple[np.ndarray, np.ndarray, tuple[int, int]]:
    """讀成 RGBA、長邊縮到 n；回 (rgb float32, alpha uint8, (寬, 高))"""
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    scale = n / max(w, h)
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    im = im.resize(size, Image.LANCZOS)
    arr = np.asarray(im)
    return arr[..., :3].astype(np.float32), arr[..., 3].copy(), size


def parse_hex(s: str) -> np.ndarray:
    s = s.strip().lstrip('#')
    return np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def to_hex(c: np.ndarray) -> str:
    return '#%02X%02X%02X' % tuple(int(round(float(x))) for x in c)


def derive_palette(rgb: np.ndarray, alpha: np.ndarray, k: int, alpha_min: int = 128, merge_dist: float = 14.0) -> list[str]:
    """k-means 取 k 色，代表色吸附到群裡最常見的真實顏色；太接近的色合併。回傳依面積由大到小的十六進位色。"""
    px = rgb[alpha >= alpha_min].reshape(-1, 3)
    if len(px) == 0:
        raise SystemExit('tracelib：圖裡沒有不透明的像素')
    cv2.setRNGSeed(1)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, labels, _centres = cv2.kmeans(px, k, None, criteria, 8, cv2.KMEANS_PP_CENTERS)
    labels = labels.ravel()
    # 吸附：把群內顏色量化到 64 階找眾數，再取眾數那一格的平均當代表色
    q = np.floor_divide(px, 4).astype(np.int32)
    keys = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
    found: list[tuple[np.ndarray, int]] = []
    for i in range(k):
        sel = labels == i
        if not sel.any():
            continue
        vals, counts = np.unique(keys[sel], return_counts=True)
        best = vals[np.argmax(counts)]
        rep = px[sel & (keys == best)].mean(axis=0)
        found.append((rep, int(sel.sum())))
    found.sort(key=lambda t: -t[1])
    merged: list[tuple[np.ndarray, int]] = []
    for col, area in found:
        for j, (c2, a2) in enumerate(merged):
            if np.linalg.norm(col - c2) < merge_dist:
                merged[j] = (c2, a2 + area)
                break
        else:
            merged.append((col, area))
    return [to_hex(c) for c, _ in merged]


def assign(rgb: np.ndarray, alpha: np.ndarray, palette: list[str], alpha_min: int = 128) -> np.ndarray:
    """每個像素最近的色的索引；透明的像素是 -1"""
    pal = np.stack([parse_hex(c) for c in palette])
    d = ((rgb[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(axis=3)
    idx = d.argmin(axis=2).astype(np.int32)
    idx[alpha < alpha_min] = -1
    return idx


def luma(hex_colour: str) -> float:
    c = parse_hex(hex_colour)
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def trace_layers(
    idx: np.ndarray,
    palette: list[str],
    n: int,
    v: int,
    eps: float,
    dilate: int,
    min_area: int,
    circle_area: int = 2500,
    circularity: float = 0.82,
    dark_last: bool = False,
) -> list[Layer]:
    """逐色描輪廓；回傳的順序就是畫的順序：面積大的先畫，小色塊蓋在上面；dark_last 讓最暗的色最後畫（有描邊線的圖，像 favicon）。
    面積（n 的尺度）小於 circle_area 且圓度 4πA/P² 高於 circularity 的外輪廓寫成圓；小於 circle_area 的洞不挖。"""
    sc = v / n
    kernel = np.ones((dilate, dilate), np.uint8) if dilate > 1 else None
    layers: list[Layer] = []
    for i, colour in enumerate(palette):
        mask = ((idx == i) * 255).astype(np.uint8)
        area = int((idx == i).sum())
        if area == 0:
            continue
        if kernel is not None:
            mask = cv2.dilate(mask, kernel)
        contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        polys: list[list[tuple[int, int]]] = []
        circles: list[tuple[int, int, int]] = []
        for ci, c in enumerate(contours):
            a = cv2.contourArea(c)
            if a < min_area:
                continue
            is_outer = hierarchy is None or hierarchy[0][ci][3] < 0
            # 小的洞不挖：洞裡是後畫的小色塊（圓點、腮紅），簡化後的洞會比色塊大、露出底色
            if not is_outer and a < circle_area:
                continue
            if is_outer and a < circle_area:
                per = cv2.arcLength(c, True)
                if per > 0 and 4 * np.pi * a / (per * per) >= circularity:
                    (cx, cy), r = cv2.minEnclosingCircle(c)
                    # 膨脹過的半徑要縮回去（dilate 是整個核的寬度，半邊是 dilate // 2）
                    rr = max(1, int(round((r - dilate // 2) * sc)))
                    circles.append((int(round(cx * sc)), int(round(cy * sc)), rr))
                    continue
            approx = cv2.approxPolyDP(c, eps / sc, True).reshape(-1, 2)
            pts: list[tuple[int, int]] = []
            for x, y in approx:
                p = (int(round(x * sc)), int(round(y * sc)))
                if not pts or pts[-1] != p:
                    pts.append(p)
            if len(pts) > 1 and pts[0] == pts[-1]:
                pts.pop()
            if len(pts) >= 3:
                polys.append(pts)
        if polys or circles:
            layers.append(Layer(colour, polys, area, circles))
    layers.sort(key=lambda l: -l.area)
    if dark_last and len(layers) > 1:
        darkest = min(layers, key=lambda l: luma(l.colour))
        layers.remove(darkest)
        layers.append(darkest)
    return layers


def _num(n: int, first: bool) -> str:
    s = str(n)
    return s if first or s.startswith('-') else ' ' + s


def path_d(polygons: list[list[tuple[int, int]]]) -> str:
    out: list[str] = []
    for pts in polygons:
        x0, y0 = pts[0]
        out.append('M' + _num(x0, True) + _num(y0, False))
        px, py = x0, y0
        for x, y in pts[1:]:
            out.append('l' + _num(x - px, True) + _num(y - py, False))
            px, py = x, y
        out.append('z')
    return ''.join(out)


def write_svg(layers: list[Layer], width: int, height: int) -> str:
    paths = ''
    for l in layers:
        if l.polygons:
            paths += f'<path fill="{l.colour}" fill-rule="evenodd" d="{path_d(l.polygons)}"/>'
        for cx, cy, r in l.circles:
            paths += f'<circle fill="{l.colour}" cx="{cx}" cy="{cy}" r="{r}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">{paths}</svg>\n'


def sizes(svg: str) -> tuple[int, int]:
    raw = svg.encode('utf8')
    return len(raw), len(gzip.compress(raw, 9))
