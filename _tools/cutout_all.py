# -*- coding: utf-8 -*-
"""1) 藤壶基地: 六张带等级的西装全部抠成透明素材
2) Lv5.彩色藤壶: 彩色改为贴合藤壶头外形 (原为椭圆), 然后抠图
3) 大肥鱼阵营: 三张 DeepSeek 立绘抠图 (跳过 梁文谷时间！)
4) 大肥鱼素材: 鲸鱼娘骑用户 抠图
5) MC素材: 检查哪些带背景, 只抠有背景的
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout_lib import cutout, trim, stats

ROOT = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库"
BASE = os.path.join(ROOT, "藤壶基地")
FISH = os.path.join(ROOT, "大肥鱼阵营")
BIG = os.path.join(ROOT, "大肥鱼素材")
MC = os.path.join(ROOT, "MC素材")
HERE = os.path.dirname(os.path.abspath(__file__))

COVERAGE = 0.50
RAINBOW = [(255, 0, 0), (255, 127, 0), (255, 255, 0), (0, 255, 0),
           (0, 255, 255), (0, 0, 255), (128, 0, 255), (255, 0, 127)]


def rainbow(width):
    stops = np.array(RAINBOW, dtype=np.float64)
    pos = np.linspace(0, len(stops) - 1, width)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(stops) - 1)
    frac = (pos - i0)[:, None]
    return stops[i0] * (1 - frac) + stops[i1] * frac


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx == 0 and dy == 0:
                continue
            out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


def erode(m, r):
    return ~dilate(~m, r)


def fill_holes(m):
    """填充遮罩内部封闭的空洞 (藤壶头的开口与缝隙)。"""
    h, w = m.shape
    inv = ~m
    seen = np.zeros_like(inv)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if inv[y, x] and not seen[y, x]:
                seen[y, x] = True
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if inv[y, x] and not seen[y, x]:
                seen[y, x] = True
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and inv[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                dq.append((nx, ny))
    return m | (inv & ~seen)


# ================================================================ 1) 西装藤壶
print("=" * 60)
print("藤壶基地: 六张带等级西装")
suits = ["Lv.1西装藤壶.jpg", "Lv5.彩色藤壶.png", "西装藤壶_Lv.2三唐神海.png",
         "西装藤壶_Lv.3蓝色钟离.png", "西装藤壶_Lv.4君子瓶251.png"]
# 三张 128px 源图不是要抠的"西装图", 它们是用来的头部形状

head_files = {"西装藤壶_Lv.2三唐神海.png": "三唐神海.png",
              "西装藤壶_Lv.3蓝色钟离.png": "蓝色钟离.png",
              "西装藤壶_Lv.4君子瓶251.png": "君子瓶251.png"}

# --- 1a) 先处理 Lv5: 重新上色 (贴合头部外形) ---
src = Image.open(os.path.join(BASE, "Lv.1西装藤壶.jpg")).convert("RGB")
a = np.array(src).astype(np.float32)
h, w = a.shape[:2]

# 头部轮廓
BG = np.array([247., 248., 252.]); NAVY = np.array([49., 57., 80.]); SHIRT = np.array([245., 246., 248.])
d_bg = np.sqrt(((a - BG) ** 2).sum(2))
d_navy = np.sqrt(((a - NAVY) ** 2).sum(2))
d_shirt = np.sqrt(((a - SHIRT) ** 2).sum(2))
cand = (d_bg > 60) & (d_navy > 60) & (d_shirt > 60)
region = np.zeros((h, w), dtype=bool)
region[25:560, 290:790] = True
cand &= region

lab = np.zeros((h, w), dtype=np.int32)
best, best_n, cur = 0, 0, 0
for y0 in range(25, 560):
    for x0 in np.flatnonzero(cand[y0]):
        if lab[y0, x0]:
            continue
        cur += 1
        n = 0
        dq = deque([(x0, y0)])
        lab[y0, x0] = cur
        while dq:
            x, y = dq.popleft()
            n += 1
            for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                if 290 <= nx < 790 and 25 <= ny < 560 and cand[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cur
                    dq.append((nx, ny))
        if n > best_n:
            best, best_n = cur, n
head = lab == best
print(f"  头部轮廓像素 {int(head.sum())}")
head = fill_holes(head)
head = erode(dilate(head, 3), 3)          # 闭运算: 补掉缝隙, 平滑边缘
ys, xs = np.nonzero(head)
HX0, HY0, HX1, HY1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
print(f"  头部 bbox ({HX0},{HY0})-({HX1},{HY1}) 像素 {int(head.sum())}")

# 头部软遮罩
hm = Image.fromarray((head * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
hmask = np.array(hm, dtype=np.float32)[..., None] / 255.0

# 领带 (沿用既能分离出领带、又不外溢的参数)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
strong = (b - r >= 45) & (b > 100)
TX0, TX1, TY0, TY1 = 498, 672, 560, 1300
tie = np.zeros((h, w), dtype=bool)
for y in range(TY0, TY1):
    xr = np.flatnonzero(strong[y, TX0:TX1]) + TX0
    if xr.size < 8:
        continue
    segs, st, pv = [], xr[0], xr[0]
    for x in xr[1:]:
        if x != pv + 1:
            segs.append((st, pv)); st = x
        pv = x
    segs.append((st, pv))
    main = max(segs, key=lambda t: t[1] - t[0])
    keep = [t for t in segs if t[0] - main[1] <= 30 and main[0] - t[1] <= 30]
    x0, x1 = min(t[0] for t in keep), max(t[1] for t in keep)
    if x1 - x0 >= 12:
        tie[y, x0:x1 + 1] = True
tmask = np.array(Image.fromarray((tie * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)),
                 dtype=np.float32)[..., None] / 255.0
print(f"  领带像素 {int(tie.sum())} bbox {TX0}..{TX1}")

# 上色: 头部在轮廓内整体叠彩虹, 领带在领带像素上叠彩虹
head_rgb = np.zeros((h, w, 3)); head_rgb[:, HX0:HX1] = np.repeat(rainbow(HX1 - HX0)[None, :, :], h, axis=0)
tie_rgb = np.zeros((h, w, 3)); tie_rgb[:, TX0:TX1] = np.repeat(rainbow(TX1 - TX0)[None, :, :], h, axis=0)

out = a.copy()
out = out * (1 - COVERAGE * hmask) + head_rgb * (COVERAGE * hmask)
out = out * (1 - COVERAGE * tmask) + tie_rgb * (COVERAGE * tmask)
lv5 = Image.fromarray(np.clip(np.rint(out), 0, 255).astype(np.uint8))
lv5.save(os.path.join(BASE, "Lv5.彩色藤壶.png"), "PNG", optimize=True)
print("  [重做] Lv5.彩色藤壶.png -> 彩色贴合头部外形")

# ================================================================ 2) 抠图
print("=" * 60)
print("开始抠图")
made = []


def do_cut(path, out_path, tol, feather, label, pad=2):
    im = Image.open(path).convert("RGBA")
    res = trim(cutout(im, tol=tol, feather=feather), pad=pad)
    res.save(out_path, "PNG", optimize=True)
    print(f"  [{label}] {os.path.basename(out_path):34s} {stats(res)}")
    made.append(out_path)
    return res


# 2a) 西装六张 (贴图版三张需要重建头部形状)
for name in ["Lv.1西装藤壶.jpg", "Lv5.彩色藤壶.png"]:
    do_cut(os.path.join(BASE, name), os.path.join(BASE, name.rsplit(".", 1)[0] + "_素材.png"),
           tol=30, feather=24, label="西装")

# 三张贴图版: 底色是"抠好的西装", 再把头部矩形换成"按源图轮廓裁出的贴图"。
# 贴图内容就是三张 128px 源图放大后的样子 (与原生成脚本一致), 这里只是把
# 生硬的矩形换成源图本身的轮廓。
suit_cut = cutout(Image.open(os.path.join(BASE, "Lv.1西装藤壶.jpg")).convert("RGBA"),
                  tol=30, feather=24)
suit_arr = np.array(suit_cut)
for sticker, src_name in head_files.items():
    st = np.array(Image.open(os.path.join(BASE, sticker)).convert("RGB")).astype(np.float32)
    srca = np.array(Image.open(os.path.join(BASE, src_name)).convert("RGBA"))
    # 源图 128x128 -> 头部矩形, 用其 alpha 当"头部形状"
    a128 = srca[..., 3] > 8
    mm = Image.fromarray((a128 * 255).astype(np.uint8)).resize(
        (HX1 - HX0, HY1 - HY0), Image.NEAREST).filter(ImageFilter.GaussianBlur(0.6))
    mmask1 = np.array(mm, dtype=np.float32)[..., None] / 255.0

    base = suit_arr.astype(np.float32).copy()
    patch = st[HY0:HY1, HX0:HX1]                      # RGB
    # 贴图这里是不透明的实心内容, 补一个 alpha=255 通道以便整体混合
    patch = np.dstack([patch, np.full(patch.shape[:2], 255.0, dtype=np.float32)])
    reg = base[HY0:HY1, HX0:HX1]                      # RGBA
    mmask = np.repeat(mmask1, 4, axis=2)
    base[HY0:HY1, HX0:HX1] = reg * (1 - mmask) + patch * mmask

    res = Image.fromarray(np.clip(np.rint(base), 0, 255).astype(np.uint8), "RGBA")
    out_path = os.path.join(BASE, sticker.rsplit(".", 1)[0] + "_素材.png")
    res = trim(res, pad=2)
    res.save(out_path, "PNG", optimize=True)
    print(f"  [西装贴图] {os.path.basename(out_path):34s} {stats(res)}")
    made.append(out_path)

# 2b) 大肥鱼阵营: 三张, 跳过 梁文谷
for name in ["Lv.3 DeepSeek-V4.0 Pro.jpg", "Lv.5 DeepSeek Harness.jpg",
             "Lv4 DeepSeek-V4.1 Flash.png"]:
    do_cut(os.path.join(FISH, name),
           os.path.join(FISH, name.rsplit(".", 1)[0] + "_素材.png"),
           tol=30, feather=24, label="阵营")

# 2c) 大肥鱼素材
do_cut(os.path.join(BIG, "鲸鱼娘骑用户.png"),
       os.path.join(BIG, "鲸鱼娘骑用户_素材.png"), tol=40, feather=30, label="大肥鱼")

# 2d) MC素材: 检测哪些带背景
print("=" * 60)
print("MC素材检查")
for name in sorted(os.listdir(MC)):
    p = os.path.join(MC, name)
    im = Image.open(p).convert("RGBA")
    arr = np.array(im)
    alpha = arr[..., 3]
    rgb = arr[..., :3].astype(np.float32)
    # 边缘带的中位色, 以及"高 alpha 且接近该色"的占比 -> 判断是否有实心背景
    edge = np.zeros(alpha.shape, dtype=bool)
    edge[:3, :] = edge[-3:, :] = True
    edge[:, :3] = edge[:, -3:] = True
    bgc = np.median(rgb[edge], axis=0)
    dist = np.sqrt(((rgb - bgc[None, None, :]) ** 2).sum(2))
    solid_bg = ((alpha > 250) & (dist <= 30)).mean()
    print(f"  {name:16s} {im.size} 透明{(alpha<5).mean()*100:5.1f}% "
          f"边缘色{tuple(int(v) for v in bgc)} 实心背景占比{solid_bg*100:5.1f}% "
          f"-> {'需抠图' if solid_bg > 0.02 else '无需处理'}")

print("=" * 60)
print(f"完成, 共生成/覆盖 {len(made)} 个素材")
