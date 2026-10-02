# -*- coding: utf-8 -*-
"""量化比较各容差: 内部是否被掏空 (孤立透明洞) 以及白肚皮是否被吃掉。"""
import os, sys
import numpy as np
from PIL import Image
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim, stats

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
src = Image.open(os.path.join(BASE, "奶鲸.webp")).convert("RGBA")

for tol in (22, 30, 38, 46):
    res = trim(cutout(src, tol=tol, feather=22.0), pad=2)
    a = np.array(res)[..., 3]
    h, w = a.shape
    trans = a < 5
    # 内部透明洞: 从边界洪水填充透明区, 剩下的透明像素即为"被主体包围的洞"
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
    vals, cnts = np.unique(a, return_counts=True)
    print(f"tol={tol:3d} {stats(res):44s} 内部空洞 {int(holes.sum()):6d}px "
          f"({holes.mean()*100:.2f}%)  半透明档位数 {int(((vals>5)&(vals<250)).sum())}")
