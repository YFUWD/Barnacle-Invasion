# -*- coding: utf-8 -*-
"""把 藤壶的入侵素材库/ 里的原料加工成游戏直接读取的 素材/。

三条固定规则（和工程里既有的 pencil_assets.py / cutout_all.py 保持一致）：

1. **统一镜像**
   素材库里的人物 / 鲸鱼 / 龟龟全部**朝左**；而代码里 ``drawUnit`` 是
   ``if (u.dir < 0) ctx.scale(-1, 1)`` —— 也就是"源图朝右，敌方镜像后朝左"。
   所以入库前统一水平镜像一次。

2. **染色 = 原像素 × 50% + 颜色 × 50%（source-over）**
   与铅笔、藤壶五色用的是同一套参数（COVERAGE = 0.50）。

3. **按够用的分辨率缩小**
   立绘实际只画到 128 CSS px 高（DPR 2 → 256 设备像素），原图 1251px 纯属浪费。
   统一压到 ≤384 / ≤640，仓库体积和加载时间都能省下来。

产物命名见 素材对接清单.md §9，全部落在 <仓库根>/素材/。
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cutout_lib import cutout, trim
ROOT = os.path.dirname(HERE)
LIB = os.path.join(ROOT, "藤壶的入侵素材库")
OUT = os.path.join(ROOT, "素材")

MC = os.path.join(LIB, "MC素材")
BARN = os.path.join(LIB, "藤壶素材")
SPLIT = os.path.join(BARN, "各种藤壶_上色分割")
PENCIL = os.path.join(BARN, "藤壶铅笔_素材")
EBASE = os.path.join(LIB, "藤壶基地")
PBASE = os.path.join(LIB, "大肥鱼阵营")
FISH = os.path.join(LIB, "大肥鱼素材")

COVERAGE = 0.50
RAINBOW = [(255, 0, 0), (255, 127, 0), (255, 255, 0), (0, 255, 0),
           (0, 255, 255), (0, 0, 255), (128, 0, 255), (255, 0, 127)]

# 等级索引 0~4 对应的颜色名（和 15_render_unit.js 里敌方等级配色一致）
ERAS = ["白色", "绿色", "蓝色", "紫色", "彩色"]
ERA_COLOR = {"白色": (255, 255, 255), "绿色": (0, 255, 0), "蓝色": (0, 0, 255),
             "紫色": (128, 0, 255), "彩色": None}

UNIT_MAX = 384      # 兵种立绘最长边
BASE_MAX = 640      # 基地立绘最长边
ITEM_MAX = 320      # 武器 / 图标最长边
PROJ_MAX = 200      # 投射物最长边

os.makedirs(OUT, exist_ok=True)
made = []


# ------------------------------------------------------------------ 工具
def rainbow(width):
    stops = np.array(RAINBOW, dtype=np.float64)
    pos = np.linspace(0, len(stops) - 1, width)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, len(stops) - 1)
    frac = (pos - i0)[:, None]
    return stops[i0] * (1 - frac) + stops[i1] * frac


def mirror(im):
    """水平镜像（素材库朝左 -> 代码要的朝右）。"""
    return im.convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT)


def tint(im, color):
    """50% 纯色叠加；color=None 时用赤橙黄绿青蓝紫横向渐变（彩色版）。"""
    arr = np.array(im.convert("RGBA")).astype(np.float64)
    rgb, alpha = arr[..., :3], arr[..., 3]
    h, w = alpha.shape
    if color is None:
        col = np.repeat(rainbow(w)[None, :, :], h, axis=0)
    else:
        col = np.array(color, dtype=np.float64)[None, None, :]
    out = np.clip(np.rint(rgb * (1 - COVERAGE) + col * COVERAGE), 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([out, alpha]).astype(np.uint8), "RGBA")


def shrink(im, max_side):
    im = im.convert("RGBA")
    w, h = im.size
    if max(w, h) <= max_side:
        return im
    s = max_side / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def put(im, name, max_side=None, note=""):
    if max_side:
        im = shrink(im, max_side)
    p = os.path.join(OUT, name)
    im.convert("RGBA").save(p, "PNG", optimize=True)
    made.append(name)
    print("  %-34s %-11s %s" % (name, "%dx%d" % im.size, note))


def load(*parts):
    return Image.open(os.path.join(*parts))


def _flood_component(pred, seed):
    """在 pred 为真的像素上从 seed 做四连通，返回连通域。"""
    from collections import deque
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


def black_rider_variant(im):
    """把"鲸鱼娘骑用户"里的骑手换成黑发 Harness 配色，鲸鱼本体不动。

    做法：
      1. 按"蓝得明显 / 很亮"筛出鲸鱼像素，从鲸鱼身体内部取连通域 = 鲸鱼
         （骑手头发 b-r≈79、鲸鱼身体 b-r≈113，用 88 分开）
      2. 膨胀一点把鲸鱼自己的深色描边也算进去
      3. 骑手 = 不透明 & 不在鲸鱼里 & 在骑手包围盒里
         （包围盒是为了排除鲸鱼身上那些"和身体不连通的浅蓝高光"：
           喷水柱、尾鳍、眼睛、肚子条纹，它们过不了连通域判据）
      4. 骑手身上的蓝色 → 黑（保留明暗），头上的浅蓝蝴蝶结 → 红
    """
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[..., :3].astype(np.float32)
    alpha = arr[..., 3]
    h, w = alpha.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(2)

    whalelike = (alpha > 10) & (((b - r) > 88) | (lum > 205))
    whale = _flood_component(whalelike, (200, 560))
    whale_d = np.array(Image.fromarray((whale * 255).astype(np.uint8))
                       .filter(ImageFilter.MaxFilter(11))) > 128

    box = np.zeros((h, w), dtype=bool)
    box[0:680, 470:1130] = True          # 骑手 + 她飘起来的长发
    rider = (alpha > 10) & (~whale_d) & box

    strong_blue = (b - r) > 30
    bowbox = np.zeros((h, w), dtype=bool)
    bowbox[152:228, 705:802] = True      # 只有头上那一个浅蓝蝴蝶结
    bow = rider & bowbox & strong_blue & (lum > 155) & (b > 185)
    body = rider & strong_blue & ~bow

    BLACK = np.array([26, 24, 30], dtype=np.float32)
    RED = np.array([196, 40, 56], dtype=np.float32)
    out = arr.copy()
    shade = np.clip(lum / 150.0, 0.35, 1.30)[..., None]
    out[..., :3] = np.where(body[..., None], BLACK[None, None, :] * shade, out[..., :3])
    out[..., :3] = np.where(bow[..., None],
                            RED[None, None, :] * np.clip(lum / 190.0, 0.6, 1.15)[..., None],
                            out[..., :3])
    return Image.fromarray(out, "RGBA")


def soft_edge(im, radius_ratio=0.06, feather_ratio=0.045):
    """给整张图加一圈柔和羽化的圆角边（用于没有透明通道、又不适合抠图的照片）。"""
    w, h = im.size
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1],
                                        radius=int(min(w, h) * radius_ratio), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(min(w, h) * feather_ratio))
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    arr[..., 3] *= np.array(m, dtype=np.float32) / 255.0
    return Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), "RGBA")


# ================================================================ 1) 基地
print("[1] 基地立绘")
# 敌方：五张西装藤壶，直接对号入座
for i, src in enumerate(["Lv.1西装藤壶_素材.png",
                         "西装藤壶_Lv.2三唐神海_素材.png",
                         "西装藤壶_Lv.3蓝色钟离_素材.png",
                         "西装藤壶_Lv.4君子瓶251_素材.png",
                         "Lv5.彩色藤壶_素材.png"]):
    put(load(EBASE, src), "base_enemy_%d.png" % (i + 1), BASE_MAX, "敌方 Lv.%d" % (i + 1))

# 我方：只有 Lv.3 / Lv.4 / Lv.5 三张（前两级保留程序绘制的方块）
for i, src in [(2, "Lv.3 DeepSeek-V4.0 Pro_素材.png"),
               (3, "Lv4 DeepSeek-V4.1 Flash_素材.png"),
               (4, "Lv.5 DeepSeek Harness_素材.png")]:
    put(load(PBASE, src), "base_player_%d.png" % (i + 1), BASE_MAX, "我方 Lv.%d" % (i + 1))

# ================================================================ 2) 玩家兵种
print("[2] 玩家兵种（镜像 + 走路 4 帧 + 受伤 1 帧）")
for i in range(1, 5):
    put(mirror(load(FISH, "大肥鱼走路_%d.png" % i)),
        "unit_player_soldier_walk%d.png" % i, UNIT_MAX, "蓝发走路 %d" % i)
    put(mirror(load(FISH, "大肥鱼走路_harness_%d.png" % i)),
        "unit_player_soldier5_walk%d.png" % i, UNIT_MAX, "黑发(Lv.5) 走路 %d" % i)
put(mirror(load(FISH, "大肥鱼受伤.png")), "unit_player_soldier_hurt.png", UNIT_MAX, "受伤剪影")
put(mirror(load(FISH, "鲸鱼娘骑用户_素材.png")), "unit_player_cavalry.png", UNIT_MAX, "玩家骑兵")
# 5 级骑兵：鲸鱼（用户）不变，背上的大肥鱼换成黑发 Harness
put(mirror(black_rider_variant(load(FISH, "鲸鱼娘骑用户_素材.png"))),
    "unit_player_cavalry5.png", UNIT_MAX, "玩家骑兵 Lv.5（黑发 Harness）")

# ================================================================ 3) 敌方兵种
print("[3] 敌方兵种（颜色 = 等级：白/绿/蓝/紫/彩）")
for era, color_name in enumerate(ERAS):
    put(load(SPLIT, "%s_分割素材" % color_name, "藤壶_01_%s.png" % color_name),
        "unit_enemy_melee_%d.png" % (era + 1), UNIT_MAX, "Lv.%d 近战 #01" % (era + 1))
    put(load(SPLIT, "%s_分割素材" % color_name, "藤壶_02_%s.png" % color_name),
        "unit_enemy_ranged_%d.png" % (era + 1), UNIT_MAX, "Lv.%d 远程 #02" % (era + 1))

# ================================================================ 4) 敌方骑兵：龟龟 + 藤壶
print("[4] 敌方骑兵（龟龟按等级染色 + 背上藤壶拼接）")
turtle = mirror(load(BARN, "龟龟.png"))
TW, TH = turtle.size
HEADROOM = 330                      # 壳顶原本贴着画布上沿，先在上方留出骑手的位置
canvas = Image.new("RGBA", (TW, TH + HEADROOM), (0, 0, 0, 0))
canvas.paste(turtle, (0, HEADROOM), turtle)

# 壳色实测 bbox: 镜像后 x 80..949（宽 869），壳顶 y ≈ HEADROOM + 1
SHELL_X0, SHELL_X1, SHELL_TOP = 80, 949, HEADROOM + 1
RIDER_W = int((SHELL_X1 - SHELL_X0) * 0.30)      # 骑手 ≈ 壳宽 30%
RIDER_BOTTOM = SHELL_TOP + 40                    # 稍微陷进壳里一点，看着是"骑在"上面
RIDER_CX = (SHELL_X0 + SHELL_X1) // 2

for era, color_name in enumerate(ERAS):
    rider = load(SPLIT, "%s_分割素材" % color_name, "藤壶_07_%s.png" % color_name)
    rw, rh = rider.size
    rider = rider.resize((RIDER_W, max(1, round(rh * RIDER_W / rw))), Image.LANCZOS)

    base = tint(canvas, ERA_COLOR[color_name])           # 龟龟按等级染色（骑手本来就是该色）
    base.paste(rider, (RIDER_CX - rider.width // 2, RIDER_BOTTOM - rider.height), rider)
    put(base, "unit_enemy_cavalry_%d.png" % (era + 1), BASE_MAX,
        "Lv.%d 龟+%s藤壶" % (era + 1, color_name))

# ================================================================ 5) 武器
print("[5] 武器")
# 玩家近战：木 / 石 / 铁 / 钻石 / 下界合金（MC 图标本身就是五级递进）
for i, src in enumerate(["木剑.png", "石剑.png", "铁剑.png", "钻石剑.png", "下界合金剑.png"]):
    put(load(MC, src), "weapon_player_melee_%d.png" % (i + 1), ITEM_MAX, "Lv.%d" % (i + 1))
# 玩家远程：拉弓 4 帧
for i in range(4):
    put(load(MC, "拉弓%d.png" % i), "weapon_player_bow_%d.png" % i, ITEM_MAX, "拉弓 %d" % i)
# 敌方：藤壶铅笔（转 180° -> 笔尖朝上，像握着一支笔）
for era, color_name in enumerate(ERAS):
    pen = load(PENCIL, "藤壶铅笔_%s.png" % color_name).rotate(180)
    put(pen, "weapon_enemy_pencil_%d.png" % (era + 1), ITEM_MAX, "笔尖朝上")

# ================================================================ 6) 投射物
print("[6] 投射物")
put(load(MC, "箭.png"), "proj_player_arrow.png", PROJ_MAX, "普通箭矢")
put(load(MC, "光灵箭.png"), "proj_player_spectral.png", PROJ_MAX, "光灵箭")
# 铅笔投射物：旋转 90° 让笔尖朝右（= 飞行方向 0°），绘制时再按实际弹道旋转
for era, color_name in enumerate(ERAS):
    pen = load(PENCIL, "藤壶铅笔_%s.png" % color_name).rotate(90, expand=True)
    put(pen, "proj_enemy_pencil_%d.png" % (era + 1), PROJ_MAX, "笔尖朝右")

# ================================================================ 7) 事件 / UI
print("[7] 事件与 UI")
put(load(LIB, "奶鲸.png"), "whale_event.png", BASE_MAX, "奶鲸事件")
put(load(LIB, "鲸元券.png"), "token_icon.png", 240, "Token 图标")
# 技能背景「梁文谷时刻」：这是一张实拍照片，背景是浅色渐变、和人物的白衬衫几乎同色。
# 实测洪水填充会把衬衫 92% 判成背景（连人一起抠没），所以不抠图，
# 改成给整张图加一圈柔和羽化边，让它自然融进天空。
put(soft_edge(load(PBASE, "梁文谷时间！.webp")), "skill_bg.png", BASE_MAX, "梁文谷时刻（羽化边）")
# 胜负 CG（结算界面用；这两张本来就是透明底，直接缩放）
put(load(LIB, "胜利CG.png"), "cg_victory.png", 1000, "胜利 CG")
put(load(LIB, "战败CG.png"), "cg_defeat.png", 1000, "战败 CG")

# ================================================================ 8b) 音频
print("[7b] 音频")
AUDIO_SRC = os.path.join(LIB, "audio")
AUDIO_OUT = os.path.join(ROOT, "audio")
os.makedirs(AUDIO_OUT, exist_ok=True)
for src, dst in [("bgm_let_me_go.m4a", "bgm.m4a"), ("sfx_victory.m4a", "victory.m4a")]:
    p = os.path.join(AUDIO_SRC, src)
    if os.path.exists(p):
        import shutil
        shutil.copyfile(p, os.path.join(AUDIO_OUT, dst))
        print("  %-22s %8.1f KB" % (dst, os.path.getsize(os.path.join(AUDIO_OUT, dst)) / 1024))
    else:
        print("  [skip] 缺 %s" % src)

# ================================================================ 8) 炮塔
print("[8] 炮塔与炮塔子弹")
# 敌方炮塔：6 号藤壶（俯视那朵"花"，当炮口最合适），按等级上色
for era, color_name in enumerate(ERAS):
    bo = load(SPLIT, "%s_分割素材" % color_name, "藤壶_06_%s.png" % color_name)
    put(bo, "turret_enemy_%d.png" % (era + 1), 256, "Lv.%d 敌方炮塔" % (era + 1))
    # 子弹就是同一朵更小的 6 号藤壶
    put(bo, "proj_turret_enemy_%d.png" % (era + 1), 72, "Lv.%d 炮塔子弹" % (era + 1))
# 我方炮塔：萌鲸鱼（白底 jpg，抠一下）。原图朝左，镜像成朝右 = 朝敌方
whale_turret = mirror(trim(cutout(load(LIB, "萌鲸鱼.jpg").convert("RGBA"), tol=30, feather=24), pad=2))
put(whale_turret, "turret_player.png", 320, "萌鲸鱼（朝右）")
# 我方炮塔子弹：大招（深度思考图标），原图只有 26px，放大到 96 再入库
shot = load(LIB, "大招（深度思考图标）.png").convert("RGBA")
put(shot.resize((96, 96), Image.LANCZOS), "proj_turret_player.png", 96, "深度思考")

# ================================================================ 9) 总览预览
print("[9] 生成总览预览（棋盘底，方便一眼看全所有槽位）")
PREVIEW = [
    "base_enemy_1.png", "base_enemy_2.png", "base_enemy_3.png", "base_enemy_4.png", "base_enemy_5.png",
    "base_player_3.png", "base_player_4.png", "base_player_5.png",
    "unit_player_soldier_walk1.png", "unit_player_soldier_walk2.png",
    "unit_player_soldier_walk3.png", "unit_player_soldier_walk4.png",
    "unit_player_soldier5_walk1.png", "unit_player_soldier_hurt.png", "unit_player_cavalry.png",
    "unit_enemy_melee_1.png", "unit_enemy_melee_3.png", "unit_enemy_melee_5.png",
    "unit_enemy_ranged_1.png", "unit_enemy_ranged_3.png", "unit_enemy_ranged_5.png",
    "unit_enemy_cavalry_1.png", "unit_enemy_cavalry_3.png", "unit_enemy_cavalry_5.png",
    "weapon_player_melee_1.png", "weapon_player_melee_5.png",
    "weapon_player_bow_0.png", "weapon_player_bow_3.png",
    "weapon_enemy_pencil_1.png", "weapon_enemy_pencil_5.png",
    "proj_player_arrow.png", "proj_player_spectral.png", "proj_enemy_pencil_1.png",
    "turret_player.png", "turret_enemy_1.png", "turret_enemy_3.png", "turret_enemy_5.png",
    "proj_turret_player.png", "proj_turret_enemy_1.png", "proj_turret_enemy_5.png",
    "whale_event.png", "token_icon.png", "skill_bg.png",
]
cell, pad, title, cols = 170, 8, 18, 6
rows = (len(PREVIEW) + cols - 1) // cols
sheet = Image.new("RGB", (pad + cols * (cell + pad), pad + rows * (cell + title + pad)), (240, 242, 246))
dr = ImageDraw.Draw(sheet)
for i, name in enumerate(PREVIEW):
    im = Image.open(os.path.join(OUT, name)).convert("RGBA")
    im.thumbnail((cell, cell), Image.LANCZOS)
    r, c = divmod(i, cols)
    x = pad + c * (cell + pad)
    y = pad + r * (cell + title + pad)
    bg = Image.new("RGB", (cell, cell), (255, 255, 255))
    for by in range(0, cell, 16):
        for bx in range(0, cell, 16):
            if (bx // 16 + by // 16) % 2:
                bg.paste((222, 226, 234), (bx, by, min(bx + 16, cell), min(by + 16, cell)))
    bg.paste(im, ((cell - im.width) // 2, (cell - im.height) // 2), im)
    sheet.paste(bg, (x, y))
    dr.text((x, y + cell + 3), name, fill=(30, 30, 30))
sheet.save(os.path.join(OUT, "_预览_素材总览.png"), "PNG", optimize=True)
print("  _预览_素材总览.png %s" % (sheet.size,))

print("\n[+] 共生成 %d 个文件 -> %s" % (len(made) + 1, OUT))
