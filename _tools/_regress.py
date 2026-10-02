# -*- coding: utf-8 -*-
"""回归测试: 新的局部生长抠图在各素材上的表现。"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim, stats

ROOT = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
CASES = [
    ("奶鲸", os.path.join(ROOT, "奶鲸.webp"), dict(tol=24, feather=16, step_tol=14)),
    ("奶鲸(紧)", os.path.join(ROOT, "奶鲸.webp"), dict(tol=24, feather=16, step_tol=9)),
    ("奶鲸(松)", os.path.join(ROOT, "奶鲸.webp"), dict(tol=24, feather=16, step_tol=20)),
    ("铅笔", os.path.join(ROOT, "藤壶素材", "藤壶铅笔.jpg"), dict(tol=24, feather=16, step_tol=14)),
    ("西装Lv1", os.path.join(ROOT, "藤壶基地", "Lv.1西装藤壶.jpg"), dict(tol=24, feather=16, step_tol=14)),
    ("V4.1 Flash", os.path.join(ROOT, "大肥鱼阵营", "Lv4 DeepSeek-V4.1 Flash.png"), dict(tol=24, feather=16, step_tol=14)),
    ("V4.0 Pro", os.path.join(ROOT, "大肥鱼阵营", "Lv.3 DeepSeek-V4.0 Pro.jpg"), dict(tol=24, feather=16, step_tol=14)),
    ("Harness", os.path.join(ROOT, "大肥鱼阵营", "Lv.5 DeepSeek Harness.jpg"), dict(tol=24, feather=16, step_tol=14)),
    ("鲸鱼娘骑用户", os.path.join(ROOT, "大肥鱼素材", "鲸鱼娘骑用户.png"), dict(tol=30, feather=18, step_tol=16)),
    ("拉弓0(已透明)", os.path.join(ROOT, "MC素材", "拉弓0.png"), dict(tol=24, feather=16, step_tol=14)),
]

tiles = []
for label, path, kw in CASES:
    before = Image.open(path).convert("RGBA")
    try:
        after = trim(cutout(before, **kw), pad=2)
        print(f"{label:16s} 前 {stats(before):40s} -> 后 {stats(after)}")
    except Exception as e:
        print(f"{label:16s} 失败: {e}")
        after = before
    tiles.append((label, after))

cell, pad, cap = 220, 8, 15
cols = 5
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (pad + cols * (cell + pad), pad + rows * (cell + cap + pad)), (243, 244, 248))
d = ImageDraw.Draw(sheet)
for i, (label, im) in enumerate(tiles):
    r, c = divmod(i, cols)
    x = pad + c * (cell + pad)
    y = pad + r * (cell + cap + pad)
    bg = Image.new("RGB", (cell, cell), (255, 255, 255))
    for by in range(0, cell, 14):
        for bx in range(0, cell, 14):
            if (bx // 14 + by // 14) % 2:
                bg.paste((224, 227, 236), (bx, by, min(bx + 14, cell), min(by + 14, cell)))
    t = im.copy(); t.thumbnail((cell, cell), Image.LANCZOS)
    bg.paste(t, ((cell - t.width) // 2, (cell - t.height) // 2), t)
    sheet.paste(bg, (x, y))
    d.text((x, y + cell + 1), label, fill=(40, 40, 40))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_cutout_regress.png")
sheet.save(out)
print("[+]", out, sheet.size)
