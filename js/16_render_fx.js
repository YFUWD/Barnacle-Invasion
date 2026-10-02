/* =========================================================
   16 渲染 · 投射物 / 粒子 / 主渲染
   ========================================================= */
function drawProjectiles() {
  for (const p of game.projectiles) {
    const sx = p.x - camX;
    if (sx < -40 || sx > W + 40) continue;

    const sy = groundY + p.y;

    // 地面上的小影子
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx, groundY, p.size * 1.6, p.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- 飞向目标的实际方向（贴图按它旋转）----
    let dirX = p.team === 'player' ? 1 : -1, dirY = 0;
    if (p.target && !p.target.dead) {
      const tx = p.target.x;
      const ty = p.target.isBase ? -p.target.h * 0.5 : -p.target.def.h * 0.5;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const len = Math.hypot(dx, dy) || 1;
      dirX = dx / len;
      dirY = dy / len;
    }

    // ---- 有贴图：箭矢 / 铅笔按弹道旋转 ----
    if (imgReady(p.img)) {
      const d = fitSprite(p.img, 46, 46);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.atan2(dirY, dirX) + (p.imgRot || 0));
      ctx.drawImage(p.img, -d.w / 2, -d.h / 2, d.w, d.h);
      ctx.restore();
      continue;
    }

    if (p.team === 'player') {
      // 我方远程：投掷一条颜色线段（沿飞行方向）
      const trail = 26;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - dirX * trail, sy - dirY * trail);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    } else {
      // 敌方远程：保持圆点
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(sx - p.size * 0.3, sy - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles() {
  for (const p of game.particles) {
    const sx = p.x - camX;
    if (sx < -30 || sx > W + 30) continue;

    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx - p.size / 2, groundY + p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawWhales() {
  for (const wh of game.whales) {
    const sx = wh.x - camX;
    if (sx < -wh.w || sx > W + wh.w) continue;

    const bottomY = groundY + wh.y;
    const topY = bottomY - wh.h;
    const leftX = sx - wh.w / 2;

    ctx.globalAlpha = wh.alpha;

    if (wh.state === 'falling') {
      ctx.fillStyle = 'rgba(120,190,255,0.25)';
      ctx.fillRect(leftX, topY - 200, wh.w, 200);
    }

    // ---- 有立绘就用奶鲸立绘，否则画蓝方块 ----
    if (imgReady(ASSETS.whale)) {
      const d = fitSprite(ASSETS.whale, wh.w * 1.3, wh.h * 2.0);
      ctx.drawImage(ASSETS.whale, sx - d.w / 2, bottomY - d.h, d.w, d.h);
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(leftX, topY, wh.w, wh.h);

    ctx.fillStyle = 'rgba(160,215,255,0.55)';
    ctx.fillRect(leftX + 10, topY + 10, wh.w - 20, 16);

    ctx.strokeStyle = 'rgba(10,30,60,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeRect(leftX + 2, topY + 2, wh.w - 4, wh.h - 4);

    const eyeY = topY + wh.h * 0.55;
    const eyeR = 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx - wh.w * 0.18, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(sx + wh.w * 0.18, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a1a30';
    ctx.beginPath();
    ctx.arc(sx - wh.w * 0.18, eyeY, eyeR * 0.5, 0, Math.PI * 2);
    ctx.arc(sx + wh.w * 0.18, eyeY, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatTexts() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const f of game.floatTexts) {
    const sx = f.x - camX;
    if (sx < -60 || sx > W + 60) continue;

    const a = clamp(f.life / f.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(f.text, sx, groundY + f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, sx, groundY + f.y);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawTurrets() {
  // 玩家炮塔（3 个槽位）
  for (let i = 0; i < game.turrets.length; i++) {
    const t = game.turrets[i];
    if (!t) continue;
    const pos = getTurretPos(i);
    const sx = pos.x - camX;
    if (sx < -120 || sx > W + 120) continue;

    const sy = groundY + pos.y;
    const w = TURRET.w;
    const h = TURRET.h;
    const building = t.buildTimer > 0;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx, groundY - bases.player.h + 4, w * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (building) {
      const p = 1 - t.buildTimer / TURRET.buildTime;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#8a8a92';
      ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(100,180,255,0.6)';
      ctx.fillRect(sx - w / 2 + 4, sy + h / 2 - 4 - (h - 8) * p, w - 8, (h - 8) * p);
    } else if (imgReady(ASSETS.turrets.player)) {
      // ---- 有立绘：萌鲸鱼 ----
      const d = fitSprite(ASSETS.turrets.player, w * 1.7, h * 1.25);
      const bottom = sy + h / 2;
      ctx.drawImage(ASSETS.turrets.player, sx - d.w / 2, bottom - d.h, d.w, d.h);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText('Lv.' + t.level, sx, bottom - d.h - 10);
      ctx.fillStyle = '#ffe08a';
      ctx.fillText('Lv.' + t.level, sx, bottom - d.h - 10);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    } else {
      ctx.fillStyle = '#8a8a92';
      ctx.fillRect(sx - w / 2, sy - h / 2, w, h);

      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx - w / 2 + 1.5, sy - h / 2 + 1.5, w - 3, h - 3);

      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(sx + w / 2 - 3, sy - 8, 14, 16);

      ctx.fillStyle = '#7ee08a';
      ctx.beginPath();
      ctx.arc(sx, sy - h / 2 + 10, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Lv.' + t.level, sx, sy);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // 敌方炮塔（自动存在 1 个，等级 = 敌方基地等级）
  if (!bases.enemy.dead) {
    const pos = getEnemyTurretPos();
    const sx = pos.x - camX;
    if (sx > -120 && sx < W + 120) {
      const sy = groundY + pos.y;
      const w = TURRET.w;
      const h = TURRET.h;
      const lvl = game.enemyEra + 1;
      const era = clamp(game.enemyEra | 0, 0, 4);
      const img = ASSETS.turrets.enemy[era];

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(sx, groundY - bases.enemy.h + 4, w * 0.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (imgReady(img)) {
        // ---- 有立绘：6 号藤壶（颜色跟着敌方等级）----
        const d = fitSprite(img, w * 1.5, h * 1.6);
        const bottom = sy + h / 2;
        ctx.drawImage(img, sx - d.w / 2, bottom - d.h, d.w, d.h);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText('Lv.' + lvl, sx, bottom - d.h - 10);
        ctx.fillStyle = '#ffb0a6';
        ctx.fillText('Lv.' + lvl, sx, bottom - d.h - 10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      } else {
        ctx.fillStyle = '#a04a4a';
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);

        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx - w / 2 + 1.5, sy - h / 2 + 1.5, w - 3, h - 3);

        ctx.fillStyle = '#3a3a44';
        ctx.fillRect(sx - w / 2 - 11, sy - 8, 14, 16);

        ctx.fillStyle = '#ff8a7e';
        ctx.beginPath();
        ctx.arc(sx, sy - h / 2 + 10, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Lv.' + lvl, sx, sy);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }
}

/* 敌方升级：在右侧远景闪 3 秒新形象的头像 */
function drawEnemyEraFlash() {
  if (!(game.enemyEraFlash > 0)) return;
  const img = ASSETS.bases.enemy[clamp(game.enemyEra | 0, 0, 4)];
  if (!imgReady(img)) return;

  const total = 3;
  const age = total - game.enemyEraFlash;
  const fadeIn = Math.min(1, age / 0.35);
  const fadeOut = Math.min(1, game.enemyEraFlash / 0.8);
  const pulse = 0.72 + 0.28 * Math.sin(age * Math.PI * 2 * 3);   // 闪三下
  const a = 0.78 * fadeIn * fadeOut * pulse;

  const d = fitSprite(img, W * 0.32, H * 0.66);
  const cx = W - d.w * 0.52;
  const bottomY = groundY - 8;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(img, cx - d.w / 2, bottomY - d.h, d.w, d.h);
  ctx.restore();
}

/* ---------------- 主渲染（顺序就是图层顺序）---------------- */
function render() {
  ctx.clearRect(0, 0, W, H);

  drawSky();
  drawTerrain();

  // 远景：敌方升级时闪 3 秒新形象（在压暗之前画，所以看着"远"）
  drawEnemyEraFlash();

  // 背景压暗：只盖住天空+地形，单位和 UI 在它之后画，所以还是亮的
  if (BG_DIM) {
    ctx.fillStyle = BG_DIM;
    ctx.fillRect(0, 0, W, H);
  }

  drawTurrets();

  for (const b of [bases.player, bases.enemy]) {
    if (!b.dead) drawBase(b);
  }

  for (const u of game.units) {
    if (!u.dead) drawUnit(u);
  }

  drawProjectiles();
  drawWhales();
  drawParticles();
  drawFloatTexts();
  drawUI();
}