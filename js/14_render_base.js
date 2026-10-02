/* =========================================================
   14 渲染 · 基地（含等级牌与血条）
   ---------------------------------------------------------
   · 敌方：直接换成西装藤壶立绘（按等级 5 档）
   · 我方：保留程序绘制的方块，Lv.3~Lv.5 的 DeepSeek 立绘画在方块"后面"，
           方块挡住下半身，只露出上半身
   ========================================================= */

/* 程序绘制的基地方块（含技能发光、斜纹质感）
   我方是半透明蓝（能看到后面立绘的影子），敌方只在立绘缺失时才用到 */
function drawBaseBlock(sx, sy, w, h, skillActive, flashAlpha, mainColor) {
  ctx.save();
  ctx.globalAlpha = 0.90;              // 90% 不透明
  ctx.beginPath();
  ctx.rect(sx - w / 2, sy - h, w, h);
  ctx.clip();

  ctx.fillStyle = mainColor;
  ctx.fillRect(sx - w / 2, sy - h, w, h);

  // 技能生效：叠加发光
  if (skillActive) {
    ctx.fillStyle = 'rgba(126,224,255,' + flashAlpha.toFixed(3) + ')';
    ctx.fillRect(sx - w / 2, sy - h, w, h);
  }

  // 斜纹质感
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  for (let i = -h; i < w + h; i += 26) {
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + i, sy - h);
    ctx.lineTo(sx - w / 2 + i - h, sy);
    ctx.stroke();
  }
  ctx.restore();

  // 边框（放在 clip 外面，保证描边完整）
  ctx.strokeStyle = skillActive ? 'rgba(126,224,255,0.95)' : 'rgba(0,0,0,0.42)';
  ctx.lineWidth = skillActive ? 6 : 5;
  ctx.strokeRect(sx - w / 2 + 2.5, sy - h + 2.5, w - 5, h - 5);
}

function drawBase(b) {
  const sx = b.x - camX;
  const sy = groundY;
  const w = b.w;
  const h = b.h;

  if (sx < -300 || sx > W + 300) return;   // 视野外不画

  const isPlayer = b.team === 'player';
  const era = isPlayer ? game.playerEra : game.enemyEra;
  const img = ASSETS.bases[b.team][era];

  // ---- 技能生效时：玩家基地闪烁 ----
  const skillActive = (isPlayer && game.skillTimer > 0);
  let flashAlpha = 0;
  if (skillActive) {
    flashAlpha = 0.35 + 0.35 * Math.sin(game.time * 12);
    if (flashAlpha < 0) flashAlpha = 0;
  }

  // 立绘最多画多高：上方要留给等级牌和血条（别顶到左上角的 HUD），
  // 屏幕矮的时候自动收小
  const maxArtH = Math.max(150, sy - 215);
  // 立绘顶部的屏幕 y（等级牌和血条都以它为基准）
  let artTop = sy - h;

  if (isPlayer) {
    // ---- 我方：Lv.3 之后连方块也不画了，只有立绘 ----
    if (imgReady(img)) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      let dw = w;                       // 贴图宽度 = 碰撞宽度（325）
      let dh = dw * (ih / iw);

      if (ih / iw > 1.15) {
        // 站姿全身立绘（V4.0 Pro / Harness）：只露上半身，下半身插进地里
        const maxH2 = Math.min(560, maxArtH) * 2;
        if (dh > maxH2) { dh = maxH2; dw = dh * (iw / ih); }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, sy);          // 裁到地平线以上 = 只露半身
        ctx.clip();
        ctx.drawImage(img, sx - dw / 2, sy - dh / 2, dw, dh);
        ctx.restore();
        artTop = sy - dh / 2;
      } else {
        // 半身/方形立绘（V4.1 Flash）：整个立绘底边贴地，不做裁剪
        const maxH = Math.min(460, maxArtH);
        if (dh > maxH) { dh = maxH; dw = dh * (iw / ih); }
        ctx.drawImage(img, sx - dw / 2, sy - dh, dw, dh);
        artTop = sy - dh;
      }
    }
    // Lv.1 / Lv.2 没有立绘，只有方块
    if (era < 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 6, w * 0.58, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      drawBaseBlock(sx, sy, w, h, skillActive, flashAlpha,
                    b.hitFlash > 0 ? '#ffffff' : '#2f6fb8');
    }
  } else {
    // ---- 敌方：西装藤壶立绘直接顶替方块 ----
    if (imgReady(img)) {
      const d = fitSprite(img, Math.max(w, 340), Math.min(430, maxArtH));
      ctx.drawImage(img, sx - d.w / 2, sy - d.h, d.w, d.h);
      artTop = sy - d.h;
    } else {
      drawBaseBlock(sx, sy, w, h, false, 0,
                    b.hitFlash > 0 ? '#ffffff' : '#c0392b');
    }
  }

  // ---- 版本/形象牌 ----
  const level = era + 1;
  const nameList = isPlayer ? PLAYER_BASE_NAMES : ENEMY_BASE_NAMES;
  const lvY = artTop - 72;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lvText = nameList[level - 1] || `Lv.${level}`;
  ctx.font = 'bold 22px system-ui, sans-serif';
  const textW = ctx.measureText(lvText).width;
  const padX = 16;
  const padY = 7;
  const tagW = textW + padX * 2;
  const tagH = 34 + padY;
  const tagX = sx - tagW / 2;
  const tagY = lvY - tagH / 2;

  ctx.fillStyle = isPlayer ? 'rgba(180,40,90,0.92)' : 'rgba(150,30,25,0.92)';
  roundRect(tagX, tagY, tagW, tagH, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2.5;
  roundRect(tagX, tagY, tagW, tagH, 8);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(lvText, sx, lvY + 1);
  ctx.textBaseline = 'alphabetic';

  // ---- 血条 ----
  const barW = w + 30;
  const barX = sx - barW / 2;
  const barY = artTop - 30;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(barX - 2, barY - 2, barW + 4, 16, 8);
  ctx.fill();

  const ratio = clamp(b.hp / b.maxHp, 0, 1);
  ctx.fillStyle = `hsl(${140 * ratio}, 70%, 48%)`;
  roundRect(barX, barY, barW * ratio, 12, 6);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(b.hp)} / ${b.maxHp}`, sx, barY + 7);
  ctx.textBaseline = 'alphabetic';
}
