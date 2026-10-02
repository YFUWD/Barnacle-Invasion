# -*- coding: utf-8 -*-
"""清点各素材的透明通道与背景情况, 并生成缩略图供目视判断。"""
import os
import numpy as np
from PIL import Image

ROOT = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
GROUPS = ["大肥鱼阵营", "藤壶基地", "藤壶素材", "MC素材", "大肥鱼素材"]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_inventory")

os.makedirs(OUT, exist_ok=True)
thumbs = []
for g in GROUPS:
    d = os.path.join(ROOT, g)
    print(f"== {g}")
    for n in sorted(os.listdir(d)):
        f = os.path.join(d, n)
        if not os.path.isfile(f):
            continue
        im = Image.open(f)
        arr = np.array(im.convert("RGBA"))
        a = arr[..., 3]
        opaque = a > 250
        transparent = a < 5
        semi = (~opaque) & (~transparent)
        # 四角像素 (判断是否白底/纯色底)
        corners = [tuple(arr[2, 2][:3]), tuple(arr[2, -3][:3]),
                   tuple(arr[-3, 2][:3]), tuple(arr[-3, -3][:3])]
        print(f"  {n:32s} {str(im.size):12s} 全透明{transparent.mean()*100:5.1f}% "
              f"半透明{semi.mean()*100:5.1f}% 角{corners[0]}")
        t = im.convert("RGBA")
        t.thumbnail((150, 150), Image.LANCZOS)
        thumbs.append((f"{g}/{n}", t, bool(transparent.mean() > 0.01)))

# 拼成联络表
cell, pad, title = 150, 8, 16
cols = 6
rows = (len(thumbs) + cols - 1) // cols
W = pad + cols * (cell + pad)
H = pad + rows * (cell + title + pad)
sheet = Image.new("RGB", (W, H), (243, 244, 248))
from PIL import ImageDraw
dr = ImageDraw.Draw(sheet)
for i, (label, t, has_alpha) in enumerate(thumbs):
    r, c = divmod(i, cols)
    x = pad + c * (cell + pad)
    y = pad + r * (cell + title + pad)
    bg = Image.new("RGB", (cell, cell), (255, 255, 255))
    for by in range(0, cell, 12):
        for bx in range(0, cell, 12):
            if (bx // 12 + by // 12) % 2:
                bg.paste((225, 228, 236), (bx, by, min(bx + 12, cell), min(by + 12, cell)))
    bg.paste(t, ((cell - t.width) // 2, (cell - t.height) // 2), t)
    sheet.paste(bg, (x, y))
    short = label.split("/")[-1][:20]
    dr.text((x, y + cell + 2), ("[T] " if has_alpha else "[ ] ") + short, fill=(40, 40, 40))
sheet.save(os.path.join(OUT, "_contact_sheet.png"))
print("\n[+]", os.path.join(OUT, "_contact_sheet.png"), sheet.size)
