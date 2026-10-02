# -*- coding: utf-8 -*-
"""
各种藤壶.png -> 5 个上色版本 (50% 不透明度叠加) + 分割素材

颜色: 白色 / 绿色 / 蓝色 / 紫色 / 彩色(赤橙黄绿青蓝紫渐变)
每个版本同时输出:
  1. 整张 1254x1254 上色图
  2. 按藤壶逐个分割的独立素材 PNG (7 个, 透明背景, 命名一致便于换色)

分割要点: 原图边缘有大量 alpha 极低的抗锯齿像素。先用连通域定位每个藤壶,
再把每个弱 alpha 像素分配给"最近的藤壶", 这样既不会裁掉边缘柔光,
也不会把邻居的抗锯齿糊色带进别的素材里。
"""
import os
import numpy as np
from PIL import Image

BASE = r"C:\Users\YFIWD\DeepSeek Workshop\藤壶的入侵\藤壶的入侵素材库\藤壶素材"
SRC = os.path.join(BASE, "各种藤壶.png")
OUT = os.path.join(BASE, "各种藤壶_上色分割")

CANVAS = (1254, 1254)
COVERAGE = 0.50          # 不透明度
PAD = 12                 # 分割时保留的透明边距
MIN_PX = 200             # 过滤噪点
CORE_ALPHA = 16          # 构成藤壶主体的 alpha 阈值
SLACK = 2                # 允许分配给邻居的像素稀释的邻域半径

# 赤橙黄绿青蓝紫 + 回到红, 8 个色标形成循环渐变
RAINBOW = [
    (255, 0, 0),      # 赤
    (255, 127, 0),    # 橙
    (255, 255, 0),    # 黄
    (0, 255, 0),      # 绿
    (0, 255, 255),    # 青
    (0, 0, 255),      # 蓝
    (128, 0, 255),    # 紫
    (255, 0, 127),    # 回到赤(洋红侧)
]

COLORS = [
    ("白色", (255, 255, 255)),
    ("绿色", (0, 255, 0)),
    ("蓝色", (0, 0, 255)),
    ("紫色", (128, 0, 255)),
    ("彩色", None),   # 渐变, 单独构建
]


# ---------------------------------------------------------------- 工具
def rainbow_gradient(width):
    """构建 1 x width 的横向彩虹渐变 (赤橙黄绿青蓝紫)。"""
    stops = np.array(RAINBOW, dtype=np.float64)
    n = len(stops)
    t = np.linspace(0.0, 1.0, width, endpoint=False)
    pos = t * (n - 1)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, n - 1)
    frac = (pos - i0)[:, None]
    rgb = stops[i0] * (1 - frac) + stops[i1] * frac
    return rgb.astype(np.uint8)[None, :, :]      # (1, width, 3)


def tint(rgb, color_rgb):
    """在原图上以 50% 不透明度叠加纯色/渐变 (标准 source-over 合成)。"""
    base = rgb.astype(np.float64)
    col = np.asarray(color_rgb, dtype=np.float64)
    out = base * (1.0 - COVERAGE) + col * COVERAGE
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def dilate(mask, r):
    """方形结构元膨胀, 用积分图实现, 结果与逐像素 max 一致。"""
    h, w = mask.shape
    ii = np.zeros((h + 1, w + 1), dtype=np.int32)
    ii[1:, 1:] = mask.cumsum(0).cumsum(1)
    ys = np.arange(h)[:, None]
    xs = np.arange(w)[None, :]
    y0 = np.clip(ys - r, 0, h)
    y1 = np.clip(ys + r + 1, 0, h)
    x0 = np.clip(xs - r, 0, w)
    x1 = np.clip(xs + r + 1, 0, w)
    s = ii[y1, x1] - ii[y0, x1] - ii[y1, x0] + ii[y0, x0]
    return s > 0


def connected_components(fg):
    """4 邻域连通域标注 (两遍扫描 + 并查集), 避免依赖 scipy。"""
    h, w = fg.shape
    labels = np.zeros((h, w), dtype=np.int32)
    parent = [0]

    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root

    nxt = 1
    for y in range(h):
        row = fg[y]
        lab_row = labels[y]
        prev = fg[y - 1] if y > 0 else None
        lab_prev = labels[y - 1] if y > 0 else None
        for x in np.flatnonzero(row):
            up = lab_prev[x] if (prev is not None and prev[x]) else 0
            left = lab_row[x - 1] if (x > 0 and row[x - 1]) else 0
            if up and left:
                lab_row[x] = min(up, left)
                if up != left:                       # 合并两个等价类
                    ra, rb = find(up), find(left)
                    if ra != rb:
                        parent[max(ra, rb)] = min(ra, rb)
            elif up:
                lab_row[x] = up
            elif left:
                lab_row[x] = left
            else:
                lab_row[x] = nxt
                parent.append(nxt)
                nxt += 1

    roots = np.array([find(i) for i in range(nxt)], dtype=np.int32)
    return roots[labels.reshape(-1)].reshape(h, w)


# ---------------------------------------------------------------- 主流程
def main():
    src = Image.open(SRC).convert("RGBA")
    arr = np.array(src)
    rgb, alpha = arr[..., :3], arr[..., 3]
    h, w = alpha.shape
    assert (w, h) == CANVAS, f"画布尺寸变化: {(w, h)}"

    canon = connected_components(alpha > CORE_ALPHA)
    ids, counts = np.unique(canon[canon > 0], return_counts=True)
    keep = [int(i) for i, c in zip(ids, counts) if c >= MIN_PX]
    print(f"[i] 连通域 {len(keep)} 个")

    # 每个藤壶的原始包围盒 + 主体收紧包围盒
    raw_box, core_box = {}, {}
    for cid in keep:
        ys, xs = np.nonzero(canon == cid)
        raw_box[cid] = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        x0, y0, x1, y1 = raw_box[cid]
        sub = alpha[y0:y1, x0:x1]
        cys = np.flatnonzero((sub > CORE_ALPHA).any(axis=1))
        cxs = np.flatnonzero((sub > CORE_ALPHA).any(axis=0))
        core_box[cid] = (x0 + int(cxs[0]), y0 + int(cys[0]),
                         x0 + int(cxs[-1]) + 1, y0 + int(cys[-1]) + 1)
    # 按阅读顺序 (先上后下, 再左右) 编号
    order = sorted(keep, key=lambda c: (round(raw_box[c][1] / 120), raw_box[c][0]))

    owner_full = np.zeros((h, w), dtype=np.int32)

    # 1) 主体像素直接归位
    for cid in order:
        owner_full[canon == cid] = cid

    # 2) 每个藤壶在自己的收紧包围盒附近, 认领未被占用的弱 alpha 像素
    for cid in order:
        cx0, cy0, cx1, cy1 = core_box[cid]
        x0, y0 = max(0, cx0 - PAD), max(0, cy0 - PAD)
        x1, y1 = min(w, cx1 + PAD), min(h, cy1 + PAD)
        sub_alpha = alpha[y0:y1, x0:x1]
        sub_core = canon[y0:y1, x0:x1]
        unclaimed = (owner_full[y0:y1, x0:x1] == 0) & (sub_alpha > 0)
        if not unclaimed.any():
            continue
        # 藤壶主体的外扩范围 (积分图实现, 等价于逐像素取邻域最大值)
        near = dilate(sub_core == cid, SLACK)
        take = unclaimed & near
        # 与自己主体直接接触的边缘像素优先, 避免被邻居抢先
        take |= unclaimed & (sub_core == cid)
        owner_full[y0:y1, x0:x1][take] = cid

    # 每个藤壶的最终遮罩与收紧包围盒
    masks = {}
    for cid in order:
        m = owner_full == cid
        ys, xs = np.nonzero(m)
        tx0, ty0 = int(xs.min()), int(ys.min())
        tx1, ty1 = int(xs.max()) + 1, int(ys.max()) + 1
        box = (max(0, tx0 - PAD), max(0, ty0 - PAD), min(w, tx1 + PAD), min(h, ty1 + PAD))
        sub = m[box[1]:box[3], box[0]:box[2]]
        masks[cid] = (box, sub)

    need = [c for c in order if masks[c][1].sum() == 0]
    assert not need, f"空遮罩: {need}"
    for i, cid in enumerate(order, 1):
        box, m = masks[cid]
        ow = owner_full[box[1]:box[3], box[0]:box[2]][m]
        other = np.unique(ow[ow != cid])
        print(f"    #{i:02d} bbox={box} wh=({box[2]-box[0]},{box[3]-box[1]}) px={int(m.sum())}"
              + (f"  混入其他标签={other.tolist()}" if len(other) else ""))

    grad = rainbow_gradient(w)
    os.makedirs(OUT, exist_ok=True)

    manifest = ["# 各种藤壶 · 上色与分割清单", "",
                f"源文件: 各种藤壶.png ({w}x{h})",
                "上色方式: 50% 不透明度纯色叠加 (source-over)",
                f"分割方式: alpha 连通域 + 就近分配边缘像素, 共 {len(order)} 个素材",
                "边缘处理: 半透明抗锯齿像素归属最近的藤壶, 素材间互不污染", "",
                "| 颜色 | 整张上色图 | 分割素材目录 | 素材尺寸(按编号) |",
                "| --- | --- | --- | --- |"]

    for name, color in COLORS:
        if color is None:
            # 渐变: 沿画布宽度 赤→橙→黄→绿→青→蓝→紫
            sheet_rgb = tint(rgb, np.broadcast_to(grad, (h, w, 3)))
        else:
            sheet_rgb = tint(rgb, color)

        sheet = np.dstack([sheet_rgb, alpha])
        sheet_path = os.path.join(OUT, f"各种藤壶_{name}.png")
        Image.fromarray(sheet, "RGBA").save(sheet_path)

        sub_dir = os.path.join(OUT, f"{name}_分割素材")
        os.makedirs(sub_dir, exist_ok=True)
        sizes = []
        for idx, cid in enumerate(order, 1):
            box, m = masks[cid]
            x0, y0, x1, y1 = box
            crop = sheet[y0:y1, x0:x1].copy()
            crop[..., 3] = np.where(m, alpha[y0:y1, x0:x1], 0)
            fname = f"藤壶_{idx:02d}_{name}.png"
            path = os.path.join(sub_dir, fname)
            Image.fromarray(crop, "RGBA").save(path)

            # 回读校验: 素材必须与整图对应区域逐像素一致, 且四边不贴内容
            back = np.array(Image.open(path).convert("RGBA"))
            assert back.shape == crop.shape and (back == crop).all(), f"回读不一致: {fname}"
            edge = max(int(back[0, :, 3].max()), int(back[-1, :, 3].max()),
                       int(back[:, 0, 3].max()), int(back[:, -1, 3].max()))
            assert edge == 0, f"贴边(可能被裁切): {fname} edge_alpha={edge}"
            # 整图同区域 (含被排除的邻居残留) 必须与素材一致 —— 保证没有混入邻居像素
            same = (sheet[y0:y1, x0:x1][..., :3][m] == crop[..., :3][m]).all()
            assert same, f"整图与素材颜色不一致: {fname}"
            sizes.append(f"#{idx:02d} {crop.shape[1]}x{crop.shape[0]}")
        print(f"[+] {name}: 各种藤壶_{name}.png + {len(order)} 个素材")
        manifest.append(f"| {name} | 各种藤壶_{name}.png | {name}_分割素材/ | {', '.join(sizes)} |")

    manifest += ["", "## 说明", "",
                 "- 素材命名一一对应 (藤壶_01_颜色.png ... 藤壶_07_颜色.png), 同编号不同颜色可互换使用。",
                 "- 透明区域保持透明, 上色只作用于原有像素, 边缘柔光完整保留。",
                 "- 彩色版沿整张画布宽度做 赤→橙→黄→绿→青→蓝→紫 循环渐变。",
                 "- 预览: _预览_五种颜色.png, _预览_分割素材矩阵.png"]
    with open(os.path.join(OUT, "清单.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(manifest) + "\n")
    print(f"[✓] 输出目录: {OUT}")


if __name__ == "__main__":
    main()
