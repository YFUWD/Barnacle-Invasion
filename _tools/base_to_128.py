# -*- coding: utf-8 -*-
"""把 藤壶基地 里的三张基地图统一成 128x128 并降低清晰度 (覆盖原图)。

处理链: 白底铺平 -> 最近邻缩小到 128x128 (硬像素块) -> 高斯模糊 0.8 (发虚)
"""
import os
from PIL import Image, ImageFilter

SRC = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶基地"
NAMES = ["Lv.1蓝色钟离.png", "Lv.3君子瓶251.png", "三唐神海.png"]
TARGET = 128
BLUR = 0.8


def flatten(im):
    """把带透明的图铺到白底上, 避免缩放后边缘发黑。"""
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


for name in NAMES:
    path = os.path.join(SRC, name)
    src = Image.open(path)
    before = (src.size, src.mode)

    out = flatten(src)                                 # 统一为 RGB
    out = out.resize((TARGET, TARGET), Image.NEAREST)  # 直接拉伸 + 最近邻 -> 硬块
    out = out.filter(ImageFilter.GaussianBlur(BLUR))   # 轻微模糊 -> 糊
    out.save(path, "PNG", optimize=True)

    check = Image.open(path)
    print(f"{name}: {before[0]} {before[1]} -> {check.size} {check.mode} "
          f"({os.path.getsize(path):,} 字节)")
