# -*- coding: utf-8 -*-
"""Verify the split assets (no clipping / correct sizes) and build preview montages."""
import os
import numpy as np
from PIL import Image

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶素材"
OUT = os.path.join(BASE, "各种藤壶_上色分割")
COLORS = ["白色", "绿色", "蓝色", "紫色", "彩色"]
GLYPH = {"白色": (60, 60, 60), "绿色": (0, 110, 0), "蓝色": (0, 0, 140),
         "紫色": (90, 0, 140), "彩色": (200, 0, 120)}

ok = True
for c in COLORS:
    sub = os.path.join(OUT, f"{c}_分割素材")
    files = sorted(os.listdir(sub))
    assert len(files) == 7, (c, files)
    for f in files:
        im = Image.open(os.path.join(sub, f)).convert("RGBA")
        a = np.array(im)[..., 3]
        # 前景不得贴边 (留了 8px 边距), 且必须有内容
        edge = max(a[0].max(), a[-1].max(), a[:, 0].max(), a[:, -1].max())
        if edge > 0:
            ok = False
            print(f"[!] 贴边(可能被裁切): {c}/{f} edge_alpha={edge}")
        if a.max() == 0:
            ok = False
            print(f"[!] 空素材: {c}/{f}")
print("[✓] 分割素材检查通过: 无贴边、无空图" if ok else "[x] 存在问题")

# ---- 预览图 1: 5 个上色整图 (缩放到 40%)
scale = 0.4
tw = int(1254 * scale)
th = int(1254 * scale)
pad = 12
sheet = Image.new("RGBA", (tw * len(COLORS) + pad * (len(COLORS) + 1), th + 2 * pad), (250, 250, 250, 255))
for i, c in enumerate(COLORS):
    im = Image.open(os.path.join(OUT, f"各种藤壶_{c}.png")).convert("RGBA").resize((tw, th), Image.LANCZOS)
    sheet.alpha_composite(im, (pad + i * (tw + pad), pad))
sheet.convert("RGB").save(os.path.join(OUT, "_预览_五种颜色.png"))
print("[+] _预览_五种颜色.png")

# ---- 预览图 2: 分割素材矩阵 (行=颜色, 列=7 个藤壶)
cell = 190
mg = 10
W = mg + 7 * (cell + mg)
H = mg + len(COLORS) * (cell + mg)
mont = Image.new("RGBA", (W, H), (245, 246, 250, 255))
for r, c in enumerate(COLORS):
    sub = os.path.join(OUT, f"{c}_分割素材")
    for k in range(7):
        f = f"藤壶_{k+1:02d}_{c}.png"
        im = Image.open(os.path.join(sub, f)).convert("RGBA")
        im.thumbnail((cell, cell), Image.LANCZOS)
        # 棋盘格底, 便于看透明区域
        bg = Image.new("RGBA", (cell, cell), (255, 255, 255, 255))
        for by in range(0, cell, 16):
            for bx in range(0, cell, 16):
                if (bx // 16 + by // 16) % 2:
                    bg.paste((228, 230, 238, 255), (bx, by, min(bx + 16, cell), min(by + 16, cell)))
        bg.alpha_composite(im, ((cell - im.width) // 2, (cell - im.height) // 2))
        mont.alpha_composite(bg, (mg + k * (cell + mg), mg + r * (cell + mg)))
mont.convert("RGB").save(os.path.join(OUT, "_预览_分割素材矩阵.png"))
print("[+] _预览_分割素材矩阵.png")
