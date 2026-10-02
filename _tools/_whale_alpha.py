# -*- coding: utf-8 -*-
"""直接检查: 抠图后白肚皮的 alpha 到底是多少?"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
src = Image.open(os.path.join(BASE, "奶鲸.webp")).convert("RGBA")
res = trim(cutout(src, tol=30, feather=22.0), pad=2)
arr = np.array(res)
a = arr[..., 3]
h, w = a.shape
print("裁剪后", (w, h))
# 原图肚皮大约在 x 380..820, y 620..1150 (源图 1280x1374)
# 裁剪后需要换算: trim 去掉了 pad=2 的边
srcarr = np.array(src.convert("RGBA"))
ys = np.flatnonzero((srcarr[..., 3] > 4).any(1)) if (srcarr[..., 3] < 250).any() else None
# 直接扫描: 在裁剪图上按行统计透明比例
for y in range(0, h, 100):
    row = a[y]
    print(f"  y={y:5d} 不透明{(row>250).mean()*100:5.1f}% 透明{(row<5).mean()*100:5.1f}% "
          f"alpha范围[{row.min()},{row.max()}]")
# 中轴竖线
cx = w // 2
col = a[:, cx]
print("中轴竖线 alpha 采样 (每 100 行):", [int(col[y]) for y in range(0, h, 100)])
print("整图 alpha 直方图 >=0 的档位:", int((np.unique(a) > 0).sum()), "个不同值")
vals, cnts = np.unique(a, return_counts=True)
print("alpha=0 占比", round(float(cnts[0] / a.size) * 100, 2), "%")
print("0<alpha<250 占比", round(float(cnts[(vals > 0) & (vals < 250)].sum() / a.size) * 100, 2), "%")
