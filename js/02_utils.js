/* =========================================================
   02 工具函数
   ========================================================= */

const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const rand  = (a, b) => a + Math.random() * (b - a);

/* 圆角矩形路径（调用方自己 fill / stroke） */
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* '#rrggbb' 整体加减亮度，amt 为 -255..255 */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt;
  let g = ((n >> 8) & 0xff) + amt;
  let b = (n & 0xff) + amt;
  r = clamp(r, 0, 255);
  g = clamp(g, 0, 255);
  b = clamp(b, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* Token 格式化：千 → K，百万 → M */
function formatGold(n) {
  n = Math.floor(n);
  if (n >= 1e6) {
    const v = n / 1e6;
    return (Math.round(v * 100) / 100) + 'M';
  }
  if (n >= 1e3) {
    const v = n / 1e3;
    return (Math.round(v * 10) / 10) + 'K';
  }
  return String(n);
}

/* 秒 → 1:05 */
function formatTime(t) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* 两个单位之间的软阻挡距离 */
function unitMinDist(a, b) {
  return (a.def.w + b.def.w) * 0.5 + BODY.gap;
}

/* 判断一个方块的中心 x 是否和基地矩形水平重叠 */
function overlapsBase(x, uHalf, base) {
  if (base.dead) return false;
  const l = base.x - base.w * 0.5;
  const r = base.x + base.w * 0.5;
  return (x + uHalf > l) && (x - uHalf < r);
}

/* 点击命中测试 */
function hitTest(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

/* 等比缩放：把 img 塞进 maxW × maxH 的盒子，返回实际绘制尺寸。
   立绘一律用这个算尺寸 —— 直接用碰撞盒的 w/h 拉伸会把 914×1251 的立绘压成扁片。 */
function fitSprite(img, maxW, maxH) {
  const iw = (img && (img.naturalWidth || img.width)) || 1;
  const ih = (img && (img.naturalHeight || img.height)) || 1;
  const s = Math.min(maxW / iw, maxH / ih);
  return { w: iw * s, h: ih * s };
}
