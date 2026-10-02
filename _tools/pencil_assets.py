# -*- coding: utf-8 -*-
"""藤壶铅笔.jpg -> 去背景 + 白色/绿色/蓝色/紫色/彩色 五个上色素材。

上色与原藤壶一致: 结果 = 原像素 x 50% + 颜色 x 50% (source-over)。
彩色版沿铅笔自身宽度做 赤橙黄绿青蓝紫 横向渐变。
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim, stats

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶素材"
SRC = os.path.join(BASE, "藤壶铅笔.jpg")
OUT = os.path.join(BASE, "藤壶铅笔_素材")

COVERAGE = 0.50
RAINBOW = [(255, 0, 0), (255, 127, 0), (255, 255, 0), (0, 255, 0),
           (0, 255, 255), (0, 0, 255), (128, 0, 255), (255, 0, 127)]
COLORS = [("白色", (255, 255, 255)), ("绿色", (0, 255, 0)), ("蓝色", (0, 0, 255)),
          ("紫色", (128, 0, 255)), ("彩色", None)]

os.makedirs(OUT, exist_ok=True)

src = Image.open(SRC)
# 原图右下角有"豆包AI生成"水印, 颜色(约200,200,200)接近背景色, 抠图时会被留在
# 主体里。先用局部背景色把它盖掉, 再做抠图。
if src.size == (1920, 1920):
    s = np.array(src.convert("RGB")).astype(np.uint8)
    patch = s[1770:1900, 1540:1900]
    med = np.median(patch.reshape(-1, 3), axis=0)          # 该区域主体色 = 背景
    s[1765:1905, 1530:1905] = med.astype(np.uint8)
    src = Image.fromarray(s)
    print(f"[i] 已抹掉右下角水印, 填充色 {med.astype(int).tolist()}")

cut = cutout(src, tol=50.0, feather=22.0)
cut = trim(cut, pad=3)
print("[i] 铅笔抠图:", stats(cut))
cut.save(os.path.join(OUT, "藤壶铅笔_原色.png"), "PNG", optimize=True)

arr = np.array(cut).astype(np.float64)
rgb, alpha = arr[..., :3], arr[..., 3]
h, w = alpha.shape


def rainbow(width):
    stops = np.array(RAINBOW, dtype=np.float64)
    pos = np.linspace(0, len(stops) - 1, width)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(stops) - 1)
    frac = (pos - i0)[:, None]
    return stops[i0] * (1 - frac) + stops[i1] * frac


grad = np.repeat(rainbow(w)[None, :, :], h, axis=0)

for name, color in COLORS:
    if color is None:
        col = grad
    else:
        col = np.array(color, dtype=np.float64)[None, None, :]
    tinted = np.clip(np.rint(rgb * (1 - COVERAGE) + col * COVERAGE), 0, 255)
    out = np.dstack([tinted, alpha]).astype(np.uint8)
    p = os.path.join(OUT, f"藤壶铅笔_{name}.png")
    Image.fromarray(out, "RGBA").save(p, "PNG", optimize=True)
    print(f"[+] 藤壶铅笔_{name}.png")

# 预览: 棋盘底上排开
preview = []
cell = 260
for f in ["藤壶铅笔_原色.png", "藤壶铅笔_白色.png", "藤壶铅笔_绿色.png",
          "藤壶铅笔_蓝色.png", "藤壶铅笔_紫色.png", "藤壶铅笔_彩色.png"]:
    im = Image.open(os.path.join(OUT, f)).convert("RGBA")
    im.thumbnail((cell, cell), Image.LANCZOS)
    preview.append((f.replace("藤壶铅笔_", "").replace(".png", ""), im))
pad = 10
sheet = Image.new("RGB", (pad + len(preview) * (cell + pad), cell + pad * 2), (243, 244, 248))
for i, (label, im) in enumerate(preview):
    bg = Image.new("RGB", (cell, cell), (255, 255, 255))
    for by in range(0, cell, 16):
        for bx in range(0, cell, 16):
            if (bx // 16 + by // 16) % 2:
                bg.paste((226, 229, 237), (bx, by, min(bx + 16, cell), min(by + 16, cell)))
    bg.paste(im, ((cell - im.width) // 2, (cell - im.height) // 2), im)
    sheet.paste(bg, (pad + i * (cell + pad), pad))
sheet.save(os.path.join(OUT, "_预览.png"))
print("[+] _预览.png", sheet.size)
