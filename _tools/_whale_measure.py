# -*- coding: utf-8 -*-
"""测量背景渐变与鲸鱼肚皮的 RGB/距离, 找出渗漏原因。"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
im = Image.open(os.path.join(BASE, "奶鲸.webp")).convert("RGB")
a = np.array(im).astype(np.float32)
h, w = a.shape[:2]
print("size", (w, h))

edge = np.zeros((h, w), dtype=bool)
edge[:6, :] = edge[-6:, :] = True
edge[:, :6] = edge[:, -6:] = True
bg = np.median(a[edge], axis=0)
print("背景参考", bg.tolist())
print("边缘带像素 min/max:", a[edge].min(axis=0).tolist(), a[edge].max(axis=0).tolist())

dist = np.sqrt(((a - bg[None, None, :]) ** 2).sum(2))
print("边缘带距离: 中位", round(float(np.median(dist[edge])), 1),
      "95分位", round(float(np.percentile(dist[edge], 95)), 1),
      "最大", round(float(dist[edge].max()), 1))

print("\n左侧竖直扫描 (x=4, 每 100 行) -> 背景是否变化:")
for y in range(0, h, 100):
    print(f"  y={y:4d} rgb={a[y,4].tolist()} dist={dist[y,4]:.1f}")

print("\n肚皮采样 (原图中心附近):")
for (x, y) in [(600, 700), (600, 800), (600, 900), (500, 850), (700, 850), (640, 1000)]:
    print(f"  ({x},{y}) rgb={a[y,x].tolist()} dist={dist[y,x]:.1f}")

print("\n各条水平线的距离剖面 (y=850, 从左边缘到中心):")
row = dist[850]
for x in range(0, 700, 50):
    print(f"  x={x:4d} rgb={a[850,x].astype(int).tolist()} dist={row[x]:.1f}")
