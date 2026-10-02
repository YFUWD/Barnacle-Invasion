# -*- coding: utf-8 -*-
"""从 鲸鱼娘骑用户_素材.png 里分离"骑手"和"鲸鱼"，做一张黑发 Harness 骑手骑蓝鲸的素材。

思路：
  1. 从鲸鱼身体内部洪水填充（局部色差判据），得到"鲸鱼区域"
  2. 膨胀一点，把鲸鱼自己的深色描边也吃进去
  3. 不在鲸鱼区域里的不透明像素 = 骑手
  4. 只给骑手换色：蓝发/蓝裙 → 黑；浅蓝蝴蝶结 → 红；白色围裙和皮肤不动
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LIB = os.path.join(ROOT, "藤壶的入侵素材库", "大肥鱼素材")
SRC = os.path.join(LIB, "鲸鱼娘骑用户_素材.png")
DBG = os.path.join(HERE, "_shots", "_rider_mask.png")


def flood_mask(pred, seed):
    """在 pred 为真的像素上，从 seed 做四连通，返回连通域。"""
    h, w = pred.shape
    seen = np.zeros((h, w), dtype=bool)
    if not pred[seed[1], seed[0]]:
        return seen
    dq = deque([seed])
    seen[seed[1], seed[0]] = True
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and pred[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                dq.append((nx, ny))
    return seen


im = Image.open(SRC).convert("RGBA")
arr = np.array(im)
rgb = arr[..., :3].astype(np.float32)
alpha = arr[..., 3]
h, w = alpha.shape

r = rgb[..., 0]
g = rgb[..., 1]
b = rgb[..., 2]
lum = rgb.mean(2)

# "像鲸鱼"的像素：蓝得明显（b-r 大）或者很亮（白肚皮）。
# 骑手头发 b-r ~79、鲸鱼身体 b-r ~113，用 88 分开。
whalelike = (alpha > 10) & (((b - r) > 88) | (lum > 205))
whale = flood_mask(whalelike, (200, 560))
# 把鲸鱼自己的深色描边也吃进来
wm = Image.fromarray((whale * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
whale_d = np.array(wm) > 128

# 骑手（含飘起来的长发）的包围盒 —— 用来排除鲸鱼身上那些"和身体不连通的
# 浅蓝高光"（喷水柱、尾鳍、眼睛、肚子条纹），它们过不了连通域判据，
# 光靠颜色会被误判成骑手。
RX0, RY0, RX1, RY1 = 470, 0, 1130, 680
box = np.zeros((h, w), dtype=bool)
box[RY0:RY1, RX0:RX1] = True

rider = (alpha > 10) & (~whale_d) & box
print("鲸鱼 %.1f%%  骑手 %.1f%%" % (whale_d.mean() * 100, rider.mean() * 100))

# ---- 只给"骑手身上的蓝色系"换色 ----
out = arr.copy()
strong_blue = (b - r) > 30
# 蝴蝶结只有头上那一个（浅蓝），单独框出来 —— 否则头发上的浅蓝高光
# 也会被当成蝴蝶结刷成红色
BOW_X0, BOW_Y0, BOW_X1, BOW_Y1 = 705, 152, 802, 228
bowbox = np.zeros((h, w), dtype=bool)
bowbox[BOW_Y0:BOW_Y1, BOW_X0:BOW_X1] = True
# 注意每条都要 & rider —— 漏了就会把鲸鱼身上的浅蓝高光也刷成红色
bow = rider & bowbox & strong_blue & (lum > 155) & (b > 185)
body = rider & strong_blue & ~bow

BLACK = np.array([26, 24, 30], dtype=np.float32)
RED = np.array([196, 40, 56], dtype=np.float32)

# 头发/裙子：保留明暗层次，往黑色压
shade = np.clip(lum / 150.0, 0.35, 1.30)[..., None]
out[..., :3] = np.where(body[..., None], BLACK[None, None, :] * shade, out[..., :3])
out[..., :3] = np.where(bow[..., None],
                        RED[None, None, :] * np.clip(lum / 190.0, 0.6, 1.15)[..., None],
                        out[..., :3])

res = Image.fromarray(out, "RGBA")
res.save(os.path.join(HERE, "_rider_black.png"))

# 调试图
dbg = np.array(im)[..., :3].copy()
dbg[whale_d] = dbg[whale_d] * 0.55 + np.array([0, 200, 255]) * 0.45
dbg[rider] = dbg[rider] * 0.55 + np.array([255, 0, 0]) * 0.45
Image.fromarray(dbg.astype(np.uint8)).save(DBG)
print("[+] _rider_black.png / _rider_mask.png")
