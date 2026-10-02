/* =========================================================
   12 渲染 · 天空 / 远景
   ========================================================= */
function drawSky() {
  // 有整图就用整图
  if (imgReady(ASSETS.sky)) {
    ctx.drawImage(ASSETS.sky, 0, 0, W, groundY);
    return;
  }

  // ---- 渐变天空（原型配色）----
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, '#8fb8e8');
  g.addColorStop(0.55, '#b8d6f0');
  g.addColorStop(1, '#dceaf6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, groundY);

  // ---- 梁文谷时刻：技能生效时的远景（视差和山一致，位于山/地板之下）----
  if (game.skillTimer > 0) {
    const t = game.skillTimer;
    const fadeIn  = Math.min(1, (SKILL.duration - t) / 0.6);
    const fadeOut = Math.min(1, t / 1.2);
    const a = 0.35 * fadeIn * fadeOut;

    const bw = W * 1.4;                    // 巨大，撑出屏幕边缘
    const bh = groundY * 0.55;
    const cx = W / 2 - camX * 0.18;        // 和山同视差

    ctx.save();
    if (imgReady(ASSETS.skillBg)) {
      // 有立绘：照片按比例贴在远景里，底边压在地平线附近
      const d = fitSprite(ASSETS.skillBg,
                          Math.min(bw * 0.5, W * 0.9),
                          Math.min(bh * 1.2, groundY * 0.72));
      ctx.globalAlpha = Math.min(1, a * 1.15);
      ctx.drawImage(ASSETS.skillBg, cx - d.w / 2, groundY - 30 - d.h, d.w, d.h);
    } else {
      const cy = groundY - bh * 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);

      ctx.globalAlpha = a * 1.4;
      ctx.strokeStyle = '#7ee0ff';
      ctx.lineWidth = 6;
      ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    }
    ctx.restore();
  }

  // ---- 远景山影（视差 0.18）----
  const parallax = camX * 0.18;
  ctx.fillStyle = 'rgba(140,170,200,0.55)';
  for (let i = 0; i < 14; i++) {
    const bx = i * 420 - (parallax % 420) - 420;
    const bw = 380;
    const bh = 130 + (i % 3) * 45;
    ctx.beginPath();
    ctx.moveTo(bx, groundY);
    ctx.lineTo(bx + bw * 0.5, groundY - bh);
    ctx.lineTo(bx + bw, groundY);
    ctx.closePath();
    ctx.fill();
  }

  // ---- 云（视差 0.06）----
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const pc = camX * 0.06;
  for (let i = 0; i < 8; i++) {
    const cx = i * 520 - (pc % 520) - 520;
    const cy = 60 + (i % 4) * 55;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy + 6, 20, 0, Math.PI * 2);
    ctx.arc(cx - 30, cy + 8, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}
