# -*- coding: utf-8 -*-
"""西装藤壶: 用前面三张基地图粗糊地盖住头部, 另做一版彩色头发+领带。

头部矩形 (人工核对 _suit_probe.png 得出): x 325..752, y 45..520
三张 128x128 的基地图直接拉伸到该矩形, 再加 2px 深灰描边 -> 一眼可见的"贴上去"感。
彩色版: 同一个矩形 + 领带区域叠加 赤橙黄绿青蓝紫 横向渐变 (50%)。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶基地"
SUIT = os.path.join(BASE, "西装藤壶.jpg")
HEADS = [("Lv.1蓝色钟离.png", "Lv.1蓝色钟离"), ("Lv.2三唐神海.png", "Lv.2三唐神海"),
         ("Lv.3君子瓶251.png", "Lv.3君子瓶251")]

# 头部覆盖矩形
HX0, HY0, HX1, HY1 = 325, 45, 752, 528
FEATHER = 1.6            # 边缘羽化, 轻微即可
BORDER = (70, 70, 78)    # 描边色
BORDER_W = 3
RAINBOW = [(255, 0, 0), (255, 127, 0), (255, 255, 0), (0, 255, 0),
           (0, 255, 255), (0, 0, 255), (128, 0, 255), (255, 0, 127)]

os.chdir(BASE)
suit = Image.open(SUIT).convert("RGB")
W, H = suit.size
print("suit", suit.size)


def rect_mask(size, box, feather=FEATHER):
    """矩形遮罩, 边缘轻微羽化。"""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rectangle(list(box), fill=255)
    if feather > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return np.array(m, dtype=np.float32)[..., None] / 255.0


def paste_head(head_path, out_name, border=True):
    suit = Image.open(SUIT).convert("RGB")
    head = Image.open(head_path).convert("RGB")
    box = (HX0, HY0, HX1, HY1)
    # 直接拉伸铺满矩形 (不保持比例 —— 要的就是粗糙)
    patch = head.resize((box[2] - box[0], box[3] - box[1]), Image.NEAREST)
    s = np.array(suit, dtype=np.float32)
    p = np.array(patch, dtype=np.float32)
    a = rect_mask(suit.size, box)
    region = s[HY0:HY1, HX0:HX1]
    s[HY0:HY1, HX0:HX1] = region * (1 - a[HY0:HY1, HX0:HX1]) + p * a[HY0:HY1, HX0:HX1]
    out = Image.fromarray(np.clip(np.rint(s), 0, 255).astype(np.uint8))
    if border:
        d = ImageDraw.Draw(out)
        d.rectangle(list(box), outline=BORDER, width=BORDER_W)
    out.save(out_name, "PNG", optimize=True)
    print(f"[+] {out_name}")
    return out


# 1) 三张机械覆盖
for path, stem in HEADS:
    paste_head(path, f"西装藤壶_{stem}.png")

# ---------------------------------------------------------------- 彩色版
suit = Image.open(SUIT).convert("RGB")
s = np.array(suit, dtype=np.float32)

# 领带检测: 领带是"蓝色 -> 深藏青"的渐变, 下半段与西装同色, 无法单靠颜色分开。
# 做法: 在领带所在的竖直窄带内, 以明显蓝色的领带结/上段为种子向外生长,
#       只接受"蓝色或中暗色"像素; 窄带限制了不会吞掉西装与衬衫。
r, g, b = s[..., 0], s[..., 1], s[..., 2]
# 领带检测: 领带主体的蓝(如 47,74,165 -> b-r=118) 与西装/马甲的藏青
# (如 49,57,80 -> b-r=31) 分得很开, 阈值 b-r>=45 且 b>90 能干净分离。
# 领带内部有阴影/别针造成的暗块, 所以逐行取"最左到最右的蓝色范围"再填满,
# 这样领带内部的暗块也会被算进领带。
r, g, b = s[..., 0], s[..., 1], s[..., 2]
strong = (b - r >= 45) & (b > 100)

# 领带实际横向范围约 506..619 (人工核对)。窄带略放宽, 并只保留与"最宽一段"
# 相邻的像素段, 以排除领口/驳岸边缘的蓝色杂点 (它们出现在 x>680)。
TX0, TX1, TY0, TY1 = 498, 672, 560, 1300
tie = np.zeros((H, W), dtype=bool)
rows = 0
for y in range(TY0, TY1):
    xs_row = np.flatnonzero(strong[y, TX0:TX1]) + TX0
    if xs_row.size < 8:
        continue
    # 切成连续段
    segs, st, pv = [], xs_row[0], xs_row[0]
    for x in xs_row[1:]:
        if x != pv + 1:
            segs.append((st, pv))
            st = x
        pv = x
    segs.append((st, pv))
    main = max(segs, key=lambda t: t[1] - t[0])          # 最宽的一段 = 领带主体
    keep = [t for t in segs if t[0] - main[1] <= 30 and main[0] - t[1] <= 30]
    x0 = min(t[0] for t in keep)
    x1 = max(t[1] for t in keep)
    if x1 - x0 < 12:
        continue
    tie[y, x0:x1 + 1] = True
    rows += 1
print(f"tie 行数 {rows}")
ys, xs = np.nonzero(tie)
print("tie px", int(tie.sum()), "bbox", (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
assert xs.min() > TX0 and xs.max() < TX1 - 1, "领带触到窄带边界"

# 横向彩虹渐变
stops = np.array(RAINBOW, dtype=np.float64)


def rainbow(width):
    """返回 (width, 3) 的 赤橙黄绿青蓝紫 横向渐变。"""
    pos = np.linspace(0, len(stops) - 1, width)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(stops) - 1)
    frac = (pos - i0)[:, None]
    return stops[i0] * (1 - frac) + stops[i1] * frac


# 渐变各自铺满自己的区域宽度: 这样头发和领带都能看到完整的一条彩虹,
# 而不是全画布尺度下各自只分到一小段颜色。
head_rgb = np.repeat(rainbow(HX1 - HX0)[None, :, :], H, axis=0)
head_rgb_full = np.zeros((H, W, 3), dtype=np.float64)
head_rgb_full[:, HX0:HX1] = head_rgb
tie_rgb = np.repeat(rainbow(TX1 - TX0)[None, :, :], H, axis=0)
tie_rgb_full = np.zeros((H, W, 3), dtype=np.float64)
tie_rgb_full[:, TX0:TX1] = tie_rgb

# 头部用内切椭圆遮罩 (跟着藤壶头的外形, 避免四个角糊上方块), 领带用检出的像素
hm = Image.new("L", (W, H), 0)
ImageDraw.Draw(hm).ellipse([HX0 - 8, HY0 - 4, HX1 + 8, HY1 + 4], fill=255)
hm = hm.filter(ImageFilter.GaussianBlur(FEATHER))
head_mask = np.array(hm, dtype=np.float32)[..., None] / 255.0

tie_mask = np.array(Image.fromarray((tie * 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(FEATHER)), dtype=np.float32)[..., None] / 255.0

# 头部: 椭圆区域内一律叠色 (含原来的蓝色部分) -> 整个脑袋变成彩色
colorful = s.copy()
a_head = head_mask[HY0:HY1, HX0:HX1]
colorful[HY0:HY1, HX0:HX1] = (s[HY0:HY1, HX0:HX1] * (1 - 0.5 * a_head)
                              + head_rgb_full[HY0:HY1, HX0:HX1] * (0.5 * a_head))
# 领带: 只在实际领带像素上叠色
a_tie = tie_mask
colorful = colorful * (1 - 0.5 * a_tie) + tie_rgb_full * (0.5 * a_tie)

out = Image.fromarray(np.clip(np.rint(colorful), 0, 255).astype(np.uint8))
out.save("西装藤壶_彩色头发领带.png", "PNG", optimize=True)
print("[+] 西装藤壶_彩色头发领带.png")

# 调试图: 标出头部矩形与检出的领带
dbg = Image.open(SUIT).convert("RGB")
da = np.array(dbg)
da[..., 1][tie] = 255
da[..., 0][tie] = 40
da[..., 2][tie] = 40
dbg = Image.fromarray(da)
ImageDraw.Draw(dbg).rectangle([HX0, HY0, HX1, HY1], outline=(255, 0, 0), width=4)
dbg.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_suit_regions.png"))
print("[+] _suit_regions.png (调试)")
