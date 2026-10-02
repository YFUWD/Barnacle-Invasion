# -*- coding: utf-8 -*-
"""通用抠图 (去背景) 工具模块。

策略: 从图像边缘出发, 在"背景色相近"的像素上做洪水填充, 只删掉与边缘连通的背景。
- 主体内部的同色区域 (如铅笔里的白色金属箍) 不会被误删。
- 抗锯齿边缘按"到背景色的距离"给部分 alpha, 保留柔边。
- 对本身已带透明通道的图, 先用 alpha 当主体遮罩, 避免 RGB 噪声造成误判。
"""
import numpy as np
from PIL import Image
from collections import deque


def _bg_reference(rgb, subject, band=6):
    """估计背景色: 优先取图框边缘带内的非主体像素中位数。

    注意不能要求"边缘必须是背景" —— 主体常常贯穿上下边 (如竖放的铅笔),
    此时四角/边缘带里仍有大量背景像素, 取中位数依然稳健。
    """
    h, w = rgb.shape[:2]
    edge = np.zeros((h, w), dtype=bool)
    edge[:band, :] = edge[-band:, :] = True
    edge[:, :band] = edge[:, -band:] = True
    # 先看边缘带里的非主体像素; 若太少再退到全图非主体像素
    for cand in (edge & (~subject), ~subject):
        if cand.sum() >= 50:
            return np.median(rgb[cand], axis=0)
    # 整张图都是不透明主体时, 用边缘带全体像素的"最亮一档"近似背景
    if edge.any():
        px = rgb[edge]
        lum = px.mean(axis=1)
        top = px[lum >= np.percentile(lum, 90)]
        return np.median(top, axis=0)
    return None


def _local_bg_fill(rgb, subject, seed_tol):
    """从边缘生长背景: 每一步只要求与"当前像素"颜色接近, 而不是与全局背景色接近。

    这样能顺着渐变背景一路走过去, 却不会越过主体的轮廓 —— 主体边缘相对
    背景存在明显的颜色台阶, 一旦台阶超过 seed_tol 就停住。
    返回 (背景遮罩, 未生长区域到背景的最近距离图)。
    """
    h, w = rgb.shape[:2]
    # 与相邻像素的色差: 用左右/上下差分的最大值
    dx = np.zeros((h, w), dtype=np.float32)
    dy = np.zeros((h, w), dtype=np.float32)
    dx[:, 1:] = np.sqrt(((rgb[:, 1:] - rgb[:, :-1]) ** 2).sum(2))
    dy[1:, :] = np.sqrt(((rgb[1:, :] - rgb[:-1, :]) ** 2).sum(2))
    step = np.maximum(dx, np.roll(dy, -1, axis=0))
    passable = (step <= seed_tol) & (~subject)

    seen = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                dq.append((nx, ny))
    return seen


def fill_alpha_holes(im):
    """把被主体完全包围的透明区域填回不透明。

    渐变背景 + 浅色主体时, 生长可能从轮廓渗进主体内部 (例如乳白鲸鱼的浅色
    肚皮), 在肚子里留下透明空洞。这些空洞不与图像边界连通, 因此可以安全地
    判定为"误删"并恢复。同时清掉主体内部孤立的透明噪点。
    """
    im = im.convert("RGBA")
    arr = np.array(im)
    alpha = arr[..., 3]
    h, w = alpha.shape
    trans = alpha < 5
    if not trans.any():
        return im

    outside = np.zeros((h, w), dtype=bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if trans[y, x] and not outside[y, x]:
                outside[y, x] = True
                dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if trans[y, x] and not outside[y, x]:
                outside[y, x] = True
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and trans[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                dq.append((nx, ny))

    holes = trans & ~outside
    # 主体内部孤立的透明噪点: 3x3 邻域全透明的小点 (单像素级针孔)
    nb = np.zeros((h, w), dtype=np.int32)
    padded = np.pad(trans, 1, constant_values=False)
    for dy in range(3):
        for dx in range(3):
            nb += padded[dy:dy + h, dx:dx + w]
    speck = trans & ~outside & (nb >= 8)

    fix = holes | speck
    if not fix.any():
        return im
    out = arr.copy()
    out[..., 3][fix] = 255
    return Image.fromarray(out, "RGBA")


def cutout(im, tol=24.0, feather=16.0, max_alpha=200, soft=True, fill_holes=True,
           step_tol=14.0):
    """返回去背景后的 RGBA 图。

    tol      : 置信门槛; 生长到的像素离全局背景色多远算"确定是背景"(越远越保留)
    feather  : 细边宽度
    step_tol : 局部生长阈值 —— 与相邻像素色差不超过它就继续走, 因此能顺着
               渐变背景前进, 遇到主体轮廓的色阶就停住
    max_alpha: 若原图本身带透明通道, alpha 高于此值的像素视为主体, 不参与背景填充
               (对完全不透明的图, 该保护自动关闭, 否则会把整张图都保护起来)
    fill_holes: 把被主体包围的透明空洞填回 (见 fill_alpha_holes)

    背景生长用"局部"判据而非"与全局背景色比": 这样即使背景是渐变、主体又有
    和背景颜色相近的浅色部分 (例如乳白肚皮), 也不会从轮廓渗进主体内部。
    """
    im = im.convert("RGBA")
    arr = np.array(im).astype(np.float32)
    rgb, alpha = arr[..., :3], arr[..., 3]
    h, w = alpha.shape

    # 原图是否真有透明区域: 只有真带 alpha 的图才启用"高 alpha = 主体"保护
    has_alpha = bool((alpha < 250).mean() > 0.01)
    subject = (alpha >= max_alpha) if has_alpha else np.zeros((h, w), dtype=bool)
    bg = _bg_reference(rgb, subject)
    if bg is None:
        return im

    seen = _local_bg_fill(rgb, subject, seed_tol=step_tol)
    dist = np.sqrt(((rgb - bg[None, None, :]) ** 2).sum(axis=2))

    if soft:
        # 生长到的像素按"离全局背景色多远"给 alpha: 近 -> 全透明, 远 -> 不透明
        strength = np.clip((dist - (tol - feather)) / max(feather, 1e-6), 0.0, 1.0)
    else:
        strength = np.ones((h, w), dtype=np.float32)

    out_a = alpha.copy()
    out_a[seen] = np.minimum(alpha[seen], strength[seen] * 255.0)
    out_a = np.minimum(out_a, alpha)

    out = np.dstack([rgb, out_a]).astype(np.uint8)
    res = Image.fromarray(out, "RGBA")
    if fill_holes:
        res = fill_alpha_holes(res)
    return res


def trim(im, pad=2, thresh=4):
    """裁掉四周全透明的边。"""
    a = np.array(im.convert("RGBA"))[..., 3]
    ys = np.flatnonzero((a > thresh).any(axis=1))
    xs = np.flatnonzero((a > thresh).any(axis=0))
    if len(ys) == 0 or len(xs) == 0:
        return im
    h, w = a.shape
    box = (max(0, xs[0] - pad), max(0, ys[0] - pad),
           min(w, xs[-1] + 1 + pad), min(h, ys[-1] + 1 + pad))
    return im.crop(box)


def stats(im):
    a = np.array(im.convert("RGBA"))[..., 3]
    return f"{im.size[0]}x{im.size[1]} 透明{(a<5).mean()*100:.1f}% 半透明{((a>=5)&(a<250)).mean()*100:.1f}%"
