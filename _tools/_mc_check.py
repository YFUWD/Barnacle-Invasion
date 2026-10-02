# -*- coding: utf-8 -*-
"""放大检查 MC素材: 先用几个不透明背景色合成, 看是否真有背景; 再看新旧抠图差异。"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim, stats

MC = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\MC素材"
NAMES = ["拉弓0.png", "光灵箭.png", "箭.png", "钻石剑.png", "下界合金剑.png", "拉弓1.png"]

tiles = []
for n in NAMES:
    im = Image.open(os.path.join(MC, n)).convert("RGBA")
    a = np.array(im)
    al = a[..., 3]
    # 透明区域里的 RGB 是什么?
    zero = al < 5
    rgb_in_trans = a[..., :3][zero]
    print(f"{n:16s} {im.size} 透明{zero.mean()*100:5.1f}% "
          f"透明区RGB均值={rgb_in_trans.mean(axis=0).round(1).tolist() if zero.any() else '-'} "
          f"最大={rgb_in_trans.max(axis=0).tolist() if zero.any() else '-'}")
    new = trim(cutout(im, tol=24, feather=16, step_tol=14), pad=0)
    print(f"{'':16s} 新 -> {stats(new)}")
    tiles.append((n, im, new))

# 放大 (x3 nearest) 对比: 合成到深色底上更能看出白边/残留
Z = 3
cell = 300
sheet = Image.new("RGB", (12 + len(tiles) * (cell + 12), 2 * (cell + 22) + 12), (60, 64, 72))
d = ImageDraw.Draw(sheet)
for i, (n, old, new) in enumerate(tiles):
    x = 12 + i * (cell + 12)
    for r, (tag, im) in enumerate((("原图", old), ("新抠图", new))):
        y = 12 + r * (cell + 22)
        bg = Image.new("RGB", (cell, cell), (30, 90, 40))       # 深绿底: 白边/残留一目了然
        t = im.copy(); t.thumbnail((cell, cell), Image.NEAREST)
        bg.paste(t, ((cell - t.width) // 2, (cell - t.height) // 2), t)
        sheet.paste(bg, (x, y))
        d.text((x, y + cell + 2), f"{tag} {n}", fill=(255, 255, 255))
sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_mc_zoom.png"))
print("[+] _mc_zoom.png")
