# -*- coding: utf-8 -*-
"""探测 西装藤壶.jpg 的头部区域边界, 用于精确覆盖。"""
import numpy as np
from PIL import Image, ImageDraw
import os

SRC = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶基地\西装藤壶.jpg"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_suit_probe.png")

im = Image.open(SRC).convert("RGB")
a = np.array(im).astype(np.float32)
h, w = a.shape[:2]
print("size", (w, h))

# 背景: 四角取中位数
corners = np.concatenate([a[:20, :20].reshape(-1, 3), a[:20, -20:].reshape(-1, 3),
                          a[-20:, :20].reshape(-1, 3), a[-20:, -20:].reshape(-1, 3)])
bg = np.median(corners, axis=0)
print("bg", bg)
dist = np.abs(a - bg).max(axis=2)
fg = dist > 30
print("fg ratio", round(float(fg.mean()), 4))

# 头部: 前景中位于画面上部 55% 且在意向列范围 (左侧 20%~62%) 内的连通块
band = fg.copy()
band[int(h * 0.55):, :] = False
band[:, :int(w * 0.10)] = False
band[:, int(w * 0.75):] = False

ys, xs = np.nonzero(band)
print("head band bbox", (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
print("head px", int(band.sum()))
# 每行前景范围, 观察形状
for y in range(0, h, 40):
    row = np.flatnonzero(band[y])
    if len(row):
        print(f"  y={y:4d} x {row.min():4d}..{row.max():4d}  n={len(row)}")

# 可视化: 头部包围盒 + 逐行覆盖范围
vis = im.copy()
d = ImageDraw.Draw(vis)
d.rectangle([int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], outline=(255, 0, 0), width=4)
vis.save(OUT)
print("[+]", OUT)
