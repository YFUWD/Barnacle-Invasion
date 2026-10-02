# -*- coding: utf-8 -*-
"""重建 Lv5.彩色藤壶: 彩色严格贴合藤壶头的外形 (含头顶开口与瓣间缝隙), 领带同步上色。

头部轮廓: 取"与背景/西装藏青/衬衫白 都不接近"的最大连通块 (阈值 30 可覆盖
头顶暗色开口与瓣间缝隙), 再填洞 + 闭运算收边。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶基地"
SUIT = os.path.join(BASE, "Lv.1西装藤壶.jpg")
OUT = os.path.join(BASE, "Lv5.彩色藤壶.png")

COVERAGE = 0.50
RAINBOW = [(255, 0, 0), (255, 127, 0), (255, 255, 0), (0, 255, 0),
           (0, 255, 255), (0, 0, 255), (128, 0, 255), (255, 0, 127)]


def rainbow(width):
    stops = np.array(RAINBOW, dtype=np.float64)
    pos = np.linspace(0, len(stops) - 1, width)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(stops) - 1)
    frac = (pos - i0)[:, None]
    return stops[i0] * (1 - frac) + stops[i1] * frac


def dilate(m, r=1):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx or dy:
                out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def erode(m, r=1):
    return ~dilate(~m, r)


def fill_holes(m):
    h, w = m.shape
    inv = ~m
    seen = np.zeros_like(inv)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if inv[y, x] and not seen[y, x]:
                seen[y, x] = True; dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if inv[y, x] and not seen[y, x]:
                seen[y, x] = True; dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < w and 0 <= ny < h and inv[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; dq.append((nx, ny))
    return m | (inv & ~seen)


a = np.array(Image.open(SUIT).convert("RGB")).astype(np.float32)
h, w = a.shape[:2]

BG = np.array([247., 248., 252.]); NAVY = np.array([49., 57., 80.]); SHIRT = np.array([245., 246., 248.])
d_bg = np.sqrt(((a - BG) ** 2).sum(2))
d_navy = np.sqrt(((a - NAVY) ** 2).sum(2))
d_shirt = np.sqrt(((a - SHIRT) ** 2).sum(2))

THR = 30
cand = (d_bg > THR) & (d_navy > THR) & (d_shirt > THR)
region = np.zeros((h, w), dtype=bool)
region[25:562, 290:790] = True
cand &= region

lab = np.zeros((h, w), dtype=np.int32)
best, best_n, cur = 0, 0, 0
for y0 in range(25, 562):
    for x0 in np.flatnonzero(cand[y0]):
        if lab[y0, x0]:
            continue
        cur += 1; n = 0
        dq = deque([(x0, y0)]); lab[y0, x0] = cur
        while dq:
            x, y = dq.popleft(); n += 1
            for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                if 290 <= nx < 790 and 25 <= ny < 562 and cand[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur; dq.append((nx, ny))
        if n > best_n:
            best, best_n = cur, n
head = lab == best
print(f"头部轮廓 {best_n} 像素")
head = fill_holes(head)
head = erode(dilate(head, 2), 2)
ys, xs = np.nonzero(head)
HX0, HY0, HX1, HY1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
print(f"头部 bbox ({HX0},{HY0})-({HX1},{HY1}) 最终 {int(head.sum())} 像素")

hm = Image.fromarray((head * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
hmask = np.array(hm, dtype=np.float32)[..., None] / 255.0

# 领带
r, g, b = a[..., 0], a[..., 1], a[..., 2]
strong = (b - r >= 45) & (b > 100)
TX0, TX1, TY0, TY1 = 498, 672, 560, 1300
tie = np.zeros((h, w), dtype=bool)
for y in range(TY0, TY1):
    xr = np.flatnonzero(strong[y, TX0:TX1]) + TX0
    if xr.size < 8:
        continue
    segs, st, pv = [], xr[0], xr[0]
    for x in xr[1:]:
        if x != pv + 1:
            segs.append((st, pv)); st = x
        pv = x
    segs.append((st, pv))
    main = max(segs, key=lambda t: t[1] - t[0])
    keep = [t for t in segs if t[0] - main[1] <= 30 and main[0] - t[1] <= 30]
    x0, x1 = min(t[0] for t in keep), max(t[1] for t in keep)
    if x1 - x0 >= 12:
        tie[y, x0:x1 + 1] = True
tmask = np.array(Image.fromarray((tie * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)),
                 dtype=np.float32)[..., None] / 255.0
print(f"领带 {int(tie.sum())} 像素")

head_rgb = np.zeros((h, w, 3)); head_rgb[:, HX0:HX1] = np.repeat(rainbow(HX1 - HX0)[None, :, :], h, axis=0)
tie_rgb = np.zeros((h, w, 3)); tie_rgb[:, TX0:TX1] = np.repeat(rainbow(TX1 - TX0)[None, :, :], h, axis=0)

out = a.copy()
out = out * (1 - COVERAGE * hmask) + head_rgb * (COVERAGE * hmask)
out = out * (1 - COVERAGE * tmask) + tie_rgb * (COVERAGE * tmask)
Image.fromarray(np.clip(np.rint(out), 0, 255).astype(np.uint8)).save(OUT, "PNG", optimize=True)
print("[+]", OUT)
