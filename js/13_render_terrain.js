/* =========================================================
   13 渲染 · 地形（三段）
   ---------------------------------------------------------
   左（0~1140）粉蓝 / 中（1140~1860）白 / 右（1860~3000）深蓝。
   每段都可以换成贴图（ASSETS.terrain.pink / white / red）。
   ========================================================= */
function drawTerrain() {
  const gy = groundY;

  const segs = [
    {
      x0: 0,
      x1: CONFIG.pinkEnd,
      base: COLORS.left,
      top: COLORS.leftTop,
      stripe: COLORS.leftStripe,
      stripeAlpha: 0.9,
      stripeWidth: 16,
      gap: 64,
      tex: ASSETS.terrain.pink,
    },
    {
      x0: CONFIG.pinkEnd,
      x1: CONFIG.whiteEnd,
      base: COLORS.white,
      top: COLORS.whiteTop,
      stripe: null,
      tex: ASSETS.terrain.white,
    },
    {
      x0: CONFIG.whiteEnd,
      x1: CONFIG.worldWidth,
      base: COLORS.right,
      top: COLORS.rightTop,
      stripe: COLORS.rightStripe,
      stripeAlpha: 0.9,
      stripeWidth: 16,
      gap: 64,
      tex: ASSETS.terrain.red,
    },
  ];

  for (const seg of segs) {
    const sx = seg.x0 - camX;
    const ex = seg.x1 - camX;
    if (ex < -20 || sx > W + 20) continue;   // 视野外整段跳过

    const w = ex - sx;
    const h = H - gy + 20;

    // ---- 底色：优先贴图，否则渐变 ----
    if (imgReady(seg.tex)) {
      const pat = ctx.createPattern(seg.tex, 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(sx, gy, w, h);
    } else {
      const g = ctx.createLinearGradient(0, gy, 0, H);
      g.addColorStop(0, seg.top);
      g.addColorStop(0.14, seg.base);
      g.addColorStop(1, shade(seg.base, -28));
      ctx.fillStyle = g;
      ctx.fillRect(sx, gy, w, h);
    }

    // ---- 斜条纹 ----
    if (seg.stripe && w > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, gy, w, h);
      ctx.clip();

      ctx.globalAlpha = seg.stripeAlpha;
      ctx.strokeStyle = seg.stripe;
      ctx.lineWidth = seg.stripeWidth;

      const slant = h * 0.7;
      const total = w + h;
      for (let i = -h; i < total; i += seg.gap) {
        ctx.beginPath();
        ctx.moveTo(sx + i, gy);
        ctx.lineTo(sx + i - slant, gy + h);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ---- 地平高光 + 底部压暗 ----
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(sx, gy, w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(sx, H - 12, w, 12);
  }

  // ---- 分界线 ----
  for (const bx of [CONFIG.pinkEnd, CONFIG.whiteEnd]) {
    const sx = bx - camX;
    if (sx < -4 || sx > W + 4) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(sx - 1.5, gy, 3, H - gy);
  }
}
