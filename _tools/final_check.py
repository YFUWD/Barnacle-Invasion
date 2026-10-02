# -*- coding: utf-8 -*-
"""最终验收: 列出本轮所有产出, 并生成联络表。"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
HERE = os.path.dirname(os.path.abspath(__file__))

OUTPUTS = [
    ("藤壶素材", ["藤壶铅笔_素材/藤壶铅笔_原色.png", "藤壶铅笔_素材/藤壶铅笔_白色.png",
                  "藤壶铅笔_素材/藤壶铅笔_绿色.png", "藤壶铅笔_素材/藤壶铅笔_蓝色.png",
                  "藤壶铅笔_素材/藤壶铅笔_紫色.png", "藤壶铅笔_素材/藤壶铅笔_彩色.png"]),
    ("藤壶基地", ["Lv.1西装藤壶_素材.png", "Lv5.彩色藤壶_素材.png",
                  "西装藤壶_Lv.2三唐神海_素材.png", "西装藤壶_Lv.3蓝色钟离_素材.png",
                  "西装藤壶_Lv.4君子瓶251_素材.png"]),
    ("大肥鱼阵营", ["Lv.3 DeepSeek-V4.0 Pro_素材.png", "Lv.5 DeepSeek Harness_素材.png",
                    "Lv4 DeepSeek-V4.1 Flash_素材.png"]),
    ("大肥鱼素材", ["鲸鱼娘骑用户_素材.png"]),
]

print("=" * 74)
print("本轮产出清单")
tiles = []
for group, files in OUTPUTS:
    for rel in files:
        p = os.path.join(ROOT, group, rel)
        if not os.path.exists(p):
            print(f"  [!] 缺失: {group}/{rel}")
            continue
        im = Image.open(p).convert("RGBA")
        a = np.array(im)[..., 3]
        print(f"  {group:8s} {os.path.basename(rel):34s} {im.size[0]:5d}x{im.size[1]:<5d} "
              f"透明{(a<5).mean()*100:5.1f}% 半透明{((a>=5)&(a<250)).mean()*100:4.1f}% "
              f"{os.path.getsize(p):>9,}B")
        tiles.append((group, os.path.basename(rel), im))

# 联络表 (棋盘底, 看清楚透明)
cell, pad, cap = 200, 8, 15
cols = 7
rows = (len(tiles) + cols - 1) // cols
W = pad + cols * (cell + pad)
H = pad + rows * (cell + cap + pad)
sheet = Image.new("RGB", (W, H), (243, 244, 248))
d = ImageDraw.Draw(sheet)
for i, (group, name, im) in enumerate(tiles):
    r, c = divmod(i, cols)
    x = pad + c * (cell + pad)
    y = pad + r * (cell + cap + pad)
    bg = Image.new("RGB", (cell, cell), (255, 255, 255))
    for by in range(0, cell, 14):
        for bx in range(0, cell, 14):
            if (bx // 14 + by // 14) % 2:
                bg.paste((224, 227, 236), (bx, by, min(bx + 14, cell), min(by + 14, cell)))
    t = im.copy()
    t.thumbnail((cell, cell), Image.LANCZOS)
    bg.paste(t, ((cell - t.width) // 2, (cell - t.height) // 2), t)
    sheet.paste(bg, (x, y))
    d.text((x, y + cell + 1), name[:26], fill=(40, 40, 40))
out = os.path.join(HERE, "_final_check.png")
sheet.save(out)
print("=" * 74)
print("[+]", out, sheet.size)
