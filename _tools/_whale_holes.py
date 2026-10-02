# -*- coding: utf-8 -*-
"""可视化内部空洞, 找出它们到底在哪里。"""
import os, sys
import numpy as np
from PIL import Image
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
src = Image.open(os.path.join(BASE, "奶鲸.webp")).convert("RGBA")
res = trim(cutout(src, tol=30, feather=22.0), pad=2)
arr = np.array(res)
a = arr[..., 3]
h, w = a.shape
trans = a < 5

seen = np.zeros_like(trans)
dq = deque()
for x in range(w):
    for y in (0, h - 1):
        if trans[y, x] and not seen[y, x]:
            seen[y, x] = True; dq.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if trans[y, x] and not seen[y, x]:
            seen[y, x] = True; dq.append((x, y))
while dq:
    x, y = dq.popleft()
    for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
        if 0 <= nx < w and 0 <= ny < h and trans[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True; dq.append((nx, ny))
holes = trans & ~seen
print("内部空洞像素", int(holes.sum()), "占", round(holes.mean()*100, 2), "%")
ys, xs = np.nonzero(holes)
if len(ys):
    print("空洞范围 x", xs.min(), xs.max(), " y", ys.min(), ys.max())

vis = arr[..., :3].copy()
vis[holes] = [255, 0, 0]
out = Image.new("RGB", (w, h), (255, 255, 255))
im = Image.fromarray(vis, "RGB").convert("RGBA")
out.paste(im, (0, 0), res)
out.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_whale_holes.png"))
print("[+] _whale_holes.png", (w, h))
