# -*- coding: utf-8 -*-
"""奶鲸抠图最终版: 局部生长 + 柔边 + 内部空洞回填。

用法: python whale_cutout.py          -> 只试算并输出预览
      python whale_cutout.py --save   -> 写出 奶鲸_素材.png
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim, stats

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "奶鲸.webp")
OUT = os.path.join(BASE, "奶鲸_素材.png")

src = Image.open(SRC).convert("RGBA")
res = trim(cutout(src, tol=24, feather=16, step_tol=14), pad=2)
print("源图", src.size, stats(src))
print("抠图", res.size, stats(res))

if "--save" in sys.argv:
    res.save(OUT, "PNG", optimize=True)
    print("[+]", OUT)
