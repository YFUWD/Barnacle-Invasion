/* =========================================================
   17 UI：尺寸 / 布局 / 面板 / 按钮 / 重开
   ========================================================= */

/* ---------------- 尺寸 ---------------- */
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;

  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  groundY = Math.round(H * 0.74);
  layoutUI();
}

/* ---------------- 按钮热区 ---------------- */
/* 底部一排的整体缩放：屏幕窄的时候一起缩小，避免几组按钮互相压住。
   基准尺寸是 1440 宽下"看得清"的尺寸（出兵按钮 112 高，骑兵那个更宽）。 */
function layoutUI() {
  ui.unitButtons = [];

  const LEFT_W = 4 * 96 + 3 * 12;      // 炮塔×3 + 技能
  const RIGHT_W = 162;                  // 升级基地
  const MID_W = 108 + 12 + 108 + 12 + 176;   // 近战 + 远程 + 骑兵（骑兵更宽）
  const want = 20 + LEFT_W + 24 + MID_W + 24 + RIGHT_W + 20;
  const s = clamp((W - 20) / want, 0.55, 1.25);

  const tSize = Math.round(96 * s);
  const tGap = Math.round(12 * s);
  const bh = Math.round(112 * s);
  const gap = Math.round(12 * s);
  const bw = Math.round(108 * s);      // 近战 / 远程
  const cw = Math.round(176 * s);      // 骑兵（横向 4 身位，按钮跟着拉长）
  const y = H - bh - 16;

  // 左边一组：炮塔 W/E/R + 技能
  const tX = 20;
  const tY = H - tSize - 16;
  ui.turretSlots = [
    { slot: 2, x: tX,                      y: tY, w: tSize, h: tSize },  // W 后
    { slot: 1, x: tX + (tSize + tGap),     y: tY, w: tSize, h: tSize },  // E 中
    { slot: 0, x: tX + (tSize + tGap) * 2, y: tY, w: tSize, h: tSize },  // R 前
  ];
  ui.skillButton = { x: tX + (tSize + tGap) * 3, y: tY, w: tSize, h: tSize };

  // 右边：升级基地
  const ubW = Math.round(RIGHT_W * s);
  ui.upgradeButton = { x: W - 20 - ubW, y, w: ubW, h: bh };
  ui.restartButton = { x: W / 2 - 90, y: H / 2 + 80, w: 180, h: 52 };

  // 中间：放在"左边一组"和"升级基地"之间的空档里居中
  const leftEnd = tX + LEFT_W * s;
  const rightStart = ui.upgradeButton.x;
  const ids = ERAS[game.playerEra].units;
  const midW = bw + gap + bw + gap + cw;
  const free = Math.max(midW, rightStart - leftEnd - 16);
  let x = leftEnd + (free - midW) / 2;

  for (const id of ids) {
    const isCav = UNIT_DB[id].isCavalry;
    const w = isCav ? cw : bw;
    ui.unitButtons.push({ id, x, y, w, h: bh });
    x += w + gap;
  }

  // 开始菜单难度按钮
  const mbw = 170, mbh = 70, mgap = 24;
  const totalMW = mbw * 3 + mgap * 2;
  const startMX = W / 2 - totalMW / 2;
  const mby = H / 2 + 30;
  ui.menuButtons = [
    { diff: 'easy',   label: '简单', x: startMX,                    y: mby, w: mbw, h: mbh },
    { diff: 'normal', label: '普通', x: startMX + mbw + mgap,       y: mby, w: mbw, h: mbh },
    { diff: 'hard',   label: '困难', x: startMX + (mbw + mgap) * 2, y: mby, w: mbw, h: mbh },
  ];
}

/* ---------------- 开始菜单 ---------------- */
function drawMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e1a33');
  g.addColorStop(1, '#1d2f55');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText('藤壶的入侵', W / 2, H / 2 - 130);
  ctx.fillStyle = '#ffd94a';
  ctx.fillText('藤壶的入侵', W / 2, H / 2 - 130);

  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText('选择难度', W / 2, H / 2 - 40);
  ctx.fillStyle = '#c6dcff';
  ctx.fillText('选择难度', W / 2, H / 2 - 40);

  for (const b of ui.menuButtons) {
    let accent = '#6eb4ff';
    if (b.diff === 'easy')   accent = '#7ee08a';
    if (b.diff === 'hard')   accent = '#ff8a7e';

    ctx.fillStyle = 'rgba(20,32,58,0.9)';
    roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.stroke();

    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 8);
  }

  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#8898b0';
  ctx.fillText('点击难度开始（或按 1 / 2 / 3）', W / 2, H / 2 + 150);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* 在按钮上叠加阴影进度条 */
function drawButtonProgressMask(btn, progress) {
  if (progress <= 0) return;
  if (progress >= 1) return;
  const doneW = btn.w * progress;
  ctx.save();
  roundRect(btn.x, btn.y, btn.w, btn.h, 12);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(btn.x + doneW, btn.y, btn.w - doneW, btn.h);
  ctx.restore();
}

/* 炮塔/技能按钮左上角快捷键提示 */
function drawTurretHotkey(slot, label) {
  const kx = slot.x + 6;
  const ky = slot.y + 6;
  const kw = 22, kh = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(kx, ky, kw, kh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  roundRect(kx, ky, kw, kh, 4);
  ctx.stroke();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, kx + kw / 2, ky + kh / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* 出兵按钮左上角快捷键提示 */
function drawUnitHotkey(btn, idx) {
  const keys = ['Z', 'X', 'C'];
  const label = keys[idx];
  if (!label) return;
  const kx = btn.x + 6;
  const ky = btn.y + 6;
  const kw = 22, kh = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(kx, ky, kw, kh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  roundRect(kx, ky, kw, kh, 4);
  ctx.stroke();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, kx + kw / 2, ky + kh / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* ---------------- 出兵按钮 / 升级按钮 / 结算界面 ---------------- */

/* 画"鲸元券图标 + 数量"（整体以 cx 居中）。没有图标就退回金币 emoji */
function drawTokenCost(text, cx, y, color, iconBoxW, iconBoxH) {
  const icon = ASSETS.tokenIcon;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (imgReady(icon)) {
    const d = fitSprite(icon, iconBoxW || 46, iconBoxH || 26);
    const tw = ctx.measureText(text).width;
    const x0 = cx - (d.w + 6 + tw) / 2;
    ctx.drawImage(icon, x0, y - d.h * 0.78, d.w, d.h);
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillText(text, x0 + d.w + 6, y);
    ctx.textAlign = 'center';
    return;
  }
  ctx.fillStyle = color;
  ctx.fillText('🪙' + text, cx, y);
}

function drawUI() {
  if (!game.started) { drawMenu(); return; }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Token（图标是鲸元券）
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  const goldText = formatGold(game.gold);
  const tokenIcon = ASSETS.tokenIcon;
  if (imgReady(tokenIcon)) {
    const d = fitSprite(tokenIcon, 62, 36);
    ctx.drawImage(tokenIcon, 22, 46 - d.h * 0.78, d.w, d.h);
    ctx.strokeText(goldText, 22 + d.w + 9, 46);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(goldText, 22 + d.w + 9, 46);
  } else {
    const goldLabel = `🪙 ${goldText}`;
    ctx.strokeText(goldLabel, 22, 46);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(goldLabel, 22, 46);
  }

  // 我方版本
  ctx.font = 'bold 24px system-ui, sans-serif';
  const eraText = `我方版本：${PLAYER_BASE_NAMES[game.playerEra] || 'DeepSeek-V2'}`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(eraText, 22, 80);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(eraText, 22, 80);

  // 视角提示
  const manualActive = keys.a || keys.d;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  const camText = manualActive ? '视角移动中…' : '按 A / D 自由移动视角';
  ctx.strokeText(camText, 22, 110);
  ctx.fillStyle = manualActive ? '#7ee0ff' : '#c8d4e0';
  ctx.fillText(camText, 22, 110);

  // 右上角：敌方形象 + 难度（难度动态左移，避免和敌方形象重叠）
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px system-ui, sans-serif';
  const eText = `敌方形象：${ENEMY_BASE_NAMES[game.enemyEra] || '西装藤壶'}`;
  const eWidth = ctx.measureText(eText).width;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(eText, W - 22, 40);
  ctx.fillStyle = '#a8c8ff';
  ctx.fillText(eText, W - 22, 40);

  const diffNames  = { easy: '简单', normal: '普通', hard: '困难' };
  const diffColors = { easy: '#7ee08a', normal: '#a8c8ff', hard: '#ff8a7e' };
  const dName  = diffNames[game.difficulty]  || '普通';
  const dColor = diffColors[game.difficulty] || '#a8c8ff';
  const dText  = '难度：' + dName;
  const dX = W - 22 - eWidth - 28;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(dText, dX, 40);
  ctx.fillStyle = dColor;
  ctx.fillText(dText, dX, 40);

  // ---------- 技能释放：屏幕中央大字 ----------
  if (game.skillAnnounce > 0) {
    const a = Math.min(1, game.skillAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText('现在是，梁文谷时刻！', W / 2, H * 0.32);
    ctx.fillStyle = '#7ee0ff';
    ctx.fillText('现在是，梁文谷时刻！', W / 2, H * 0.32);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 技能解锁提示 ----------
  if (game.skillUnlockAnnounce > 0) {
    const a = Math.min(1, game.skillUnlockAnnounce / 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText('技能已解锁：梁文谷时刻（按 F 释放）', W / 2, H * 0.42);
    ctx.fillStyle = '#7ee0ff';
    ctx.fillText('技能已解锁：梁文谷时刻（按 F 释放）', W / 2, H * 0.42);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 基地可升级：左侧脉动提示 ----------
  const nextEraHint = game.playerEra + 1;
  if (nextEraHint < ERAS.length) {
    const needHint = [110, 100, 140, 150][nextEraHint - 1];
    const tokenHint = CONFIG.upgradeTokenCostByLevel[game.playerEra];
    if (game.upgradePoints >= needHint && game.gold >= tokenHint) {
      const a = 0.55 + 0.45 * Math.sin(game.time * 8);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText('DeepSeek 可升级！', 24, H * 0.55);
      ctx.fillStyle = '#ffd94a';
      ctx.fillText('DeepSeek 可升级！', 24, H * 0.55);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  // ---------- 敌方升级：右侧提示 ----------
  if (game.enemyLevelAnnounce > 0) {
    const a = Math.min(1, game.enemyLevelAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText('藤壶开始变异了！', W - 24, H * 0.55);
    ctx.fillStyle = '#ff8a7e';
    ctx.fillText('藤壶开始变异了！', W - 24, H * 0.55);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 奶鲸来袭：屏幕中上方提示 ----------
  if (game.whaleAnnounce > 0) {
    const a = Math.min(1, game.whaleAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText('理中客奶鲸来了！！！', W / 2, H * 0.18);
    ctx.fillStyle = '#7ec8ff';
    ctx.fillText('理中客奶鲸来了！！！', W / 2, H * 0.18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 出兵按钮 ----------
  for (let bi = 0; bi < ui.unitButtons.length; bi++) {
    const btn = ui.unitButtons[bi];
    const def = UNIT_DB[btn.id];

    if (def.isCavalry && !game.playerCavalryUnlocked) {
      const unlockCost = cavalryUnlockCost('player');
      const unlocking = isCavalryUnlocking('player');
      const canUnlock = !unlocking && game.gold >= unlockCost;

      ctx.fillStyle = 'rgba(25,20,15,0.9)';
      roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = (canUnlock || unlocking) ? 'rgba(255,200,80,0.9)' : 'rgba(120,100,60,0.6)';
      roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.stroke();

      if (unlocking) {
        const p = 1 - game.playerCavalryUnlockLeft / PLAYER_CAVALRY_UNLOCK_TIME;
        drawButtonProgressMask(btn, p);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lk = btn.h / 112;
      ctx.font = `bold ${Math.round(34 * lk)}px system-ui, sans-serif`;
      ctx.fillStyle = (canUnlock || unlocking) ? '#ffd94a' : '#8a7a55';
      ctx.fillText('🔒', btn.x + btn.w / 2, btn.y + Math.round(34 * lk));
      ctx.textBaseline = 'alphabetic';

      if (unlocking) {
        ctx.font = `bold ${Math.round(13 * lk)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffe08a';
        ctx.fillText('解锁中…', btn.x + btn.w / 2, btn.y + btn.h - Math.round(26 * lk));

        ctx.font = `bold ${Math.round(14 * lk)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffd94a';
        ctx.fillText(game.playerCavalryUnlockLeft.toFixed(1) + 's',
                     btn.x + btn.w / 2, btn.y + btn.h - Math.round(8 * lk));
      } else {
        ctx.font = `bold ${Math.round(13 * lk)}px system-ui, sans-serif`;
        ctx.fillStyle = canUnlock ? '#ffe08a' : '#8a7a55';
        ctx.fillText('解锁骑兵', btn.x + btn.w / 2, btn.y + btn.h - Math.round(26 * lk));

        ctx.font = `bold ${Math.round(14 * lk)}px system-ui, sans-serif`;
        drawTokenCost(formatGold(unlockCost), btn.x + btn.w / 2,
                      btn.y + btn.h - Math.round(8 * lk),
                      canUnlock ? '#ffd94a' : '#7a6a30',
                      Math.round(30 * lk), Math.round(17 * lk));
      }
      drawUnitHotkey(btn, bi);
      continue;
    }

    const cost = unitCostFor(btn.id, 'player');
    const canAfford = game.gold >= cost;
    const queueFull = spawnQueue.player.length >= CONFIG.maxQueue;
    const enabled = canAfford && !queueFull;

    ctx.fillStyle = enabled ? 'rgba(28,38,58,0.92)' : 'rgba(20,22,30,0.75)';
    roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = enabled ? 'rgba(110,200,255,0.9)' : 'rgba(90,90,100,0.6)';
    roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.stroke();

    // 按钮尺寸会跟着屏幕缩放，这里统一按"基准高 112"换算
    const k = btn.h / 112;

    // 骑兵立绘是横的（384×253），塞进步兵那个 36×48 的小盒子会只剩 36×24，
    // 文字先排好，贴图区域的上限要按文字顶部来算，避免压在一起
    const era = clamp(game.playerEra | 0, 0, 4);
    const tag = ERA_TAGS[era] || ('Lv.' + (era + 1));
    const padX = Math.round(8 * k);
    const maxTextW = btn.w - padX * 2;
    const setFont = (px) => { ctx.font = `bold ${px}px system-ui, sans-serif`; };

    // 优先一行 "V2 大肥鱼"；放不下就拆成两行（版本 / 兵种）并缩字号
    let namePx = Math.round(14 * k);
    let lines;
    setFont(namePx);
    const oneLine = tag + ' ' + def.name;
    if (ctx.measureText(oneLine).width <= maxTextW) {
      lines = [oneLine];
    } else {
      lines = [tag, def.name];
      const widest = () => Math.max(ctx.measureText(tag).width, ctx.measureText(def.name).width);
      while (widest() > maxTextW && namePx > 9) { namePx--; setFont(namePx); }
    }

    const lineH = Math.round(namePx * 1.12);
    const lastBaseY = btn.y + btn.h - Math.round(26 * k);
    const textTop = lastBaseY - (lines.length - 1) * lineH - namePx;

    // ---- 贴图（底边贴住文字上沿）----
    const isCav = def.isCavalry;
    const iconTop = btn.y + Math.round(10 * k);
    const iconAvail = Math.max(Math.round(22 * k), textTop - Math.round(4 * k) - iconTop);
    const iconMaxW = btn.w - padX * 2;
    const iconW = Math.min(Math.round((isCav ? 106 : 40) * k), iconMaxW);

    const img = firstReady(unitSpriteSetByType('player', btn.id).walk);
    if (imgReady(img)) {
      const d = fitSprite(img, iconW, iconAvail);
      ctx.drawImage(img, btn.x + btn.w / 2 - d.w / 2, iconTop + iconAvail - d.h, d.w, d.h);
    } else {
      const d = fitSprite({ naturalWidth: 1, naturalHeight: 1.4 }, iconW, iconAvail);
      const fx = btn.x + btn.w / 2 - d.w / 2;
      const fy = iconTop + iconAvail - d.h;
      ctx.fillStyle = def.color;
      ctx.fillRect(fx, fy, d.w, d.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.38)';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx + 1, fy + 1, d.w - 2, d.h - 2);
    }

    const spawnP = playerSpawnProgress(btn.id);
    if (spawnP > 0) {
      drawButtonProgressMask(btn, spawnP);
    }

    // ---- 士兵名（含等级版本标签）----
    ctx.textAlign = 'center';
    setFont(namePx);
    lines.forEach((txt, i) => {
      const y = lastBaseY - (lines.length - 1 - i) * lineH;
      // 版本标签用淡一点的颜色，兵种名保持原来的亮/灰
      ctx.fillStyle = (i === 0 && lines.length > 1)
        ? (enabled ? '#9fd0ff' : '#5c6b80')
        : (enabled ? '#ffffff' : '#888');
      ctx.fillText(txt, btn.x + btn.w / 2, y);
    });

    ctx.font = `bold ${Math.round(14 * k)}px system-ui, sans-serif`;
    drawTokenCost(formatGold(cost), btn.x + btn.w / 2, btn.y + btn.h - Math.round(8 * k),
                  enabled ? '#ffd94a' : '#7a6a30',
                  Math.round(31 * k), Math.round(17 * k));

    const qCount = queuedCount('player', btn.id);
    if (qCount > 0) {
      const br = Math.round(15 * k);
      const bx = btn.x + btn.w - br - 2;
      const by = btn.y + br + 2;

      ctx.fillStyle = '#ff5b4a';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(14 * k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(qCount, bx, by + 1);
      ctx.textBaseline = 'alphabetic';
    }

    drawUnitHotkey(btn, bi);
  }

  // ---------- 炮塔槽位 ----------
  if (ui.turretSlots) {
    for (const slot of ui.turretSlots) {
      drawTurretHotkey(slot, slot.slot === 2 ? 'W' : (slot.slot === 1 ? 'E' : 'R'));
      const built = !!game.turrets[slot.slot];
      const prevBuilt = slot.slot === 0 || !!game.turrets[slot.slot - 1];
      const cost = TURRET.slotCosts[slot.slot];
      const canAfford = game.gold >= cost;
      const canBuild = !built && prevBuilt && canAfford;

      ctx.fillStyle = built
        ? 'rgba(40,70,45,0.9)'
        : (canBuild ? 'rgba(28,38,58,0.92)' : 'rgba(20,22,30,0.75)');
      roundRect(slot.x, slot.y, slot.w, slot.h, 8);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = built
        ? 'rgba(120,220,120,0.9)'
        : (canBuild ? 'rgba(110,200,255,0.9)' : 'rgba(90,90,100,0.6)');
      roundRect(slot.x, slot.y, slot.w, slot.h, 8);
      ctx.stroke();

      if (game.turrets[slot.slot] && game.turrets[slot.slot].buildTimer > 0) {
        const bp = 1 - game.turrets[slot.slot].buildTimer / TURRET.buildTime;
        ctx.save();
        roundRect(slot.x, slot.y, slot.w, slot.h, 8);
        ctx.clip();
        ctx.fillStyle = 'rgba(100,180,255,0.35)';
        ctx.fillRect(slot.x, slot.y + slot.h * (1 - bp), slot.w, slot.h * bp);
        ctx.restore();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const tSlot = game.turrets[slot.slot];
      const maxLv = Math.min(TURRET.damages.length, game.playerEra + 1);

      if (tSlot && tSlot.buildTimer > 0) {
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#c6dcff';
        ctx.fillText('建造中', slot.x + slot.w / 2, slot.y + slot.h / 2 - 14);
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = '#7ec8ff';
        ctx.fillText(tSlot.buildTimer.toFixed(1) + 's', slot.x + slot.w / 2, slot.y + slot.h / 2 + 16);
      } else if (tSlot && tSlot.level < maxLv) {
        const upCost = TURRET.upgradeCosts[tSlot.level - 1];
        const canUp = game.gold >= upCost;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#e0e8f0';
        ctx.fillText('炮塔 Lv.' + tSlot.level, slot.x + slot.w / 2, slot.y + slot.h / 2 - 14);
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillStyle = canUp ? '#ffd94a' : '#665';
        ctx.fillText(formatGold(upCost), slot.x + slot.w / 2, slot.y + slot.h / 2 + 16);
      } else if (tSlot) {
        const atMax = tSlot.level >= TURRET.damages.length;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#a0ffa0';
        ctx.fillText('炮塔 Lv.' + tSlot.level, slot.x + slot.w / 2, slot.y + slot.h / 2 - 12);
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillStyle = atMax ? '#a0ffa0' : '#8ab8e0';
        ctx.fillText(atMax ? '满级' : '需升级基地', slot.x + slot.w / 2, slot.y + slot.h / 2 + 14);
      } else if (!prevBuilt) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('需先建前面的', slot.x + slot.w / 2, slot.y + slot.h / 2);
      } else {
        ctx.font = 'bold 36px system-ui, sans-serif';
        ctx.fillStyle = canBuild ? '#7ec8ff' : '#556';
        ctx.fillText('+', slot.x + slot.w / 2, slot.y + slot.h / 2 - 12);

        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = canBuild ? '#ffd94a' : '#665';
        ctx.fillText(formatGold(cost), slot.x + slot.w / 2, slot.y + slot.h / 2 + 20);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ---------- 技能按钮 ----------
  if (ui.skillButton) {
    const sb = ui.skillButton;
    const locked = game.playerEra < 1;
    const ready = !locked && game.skillCd <= 0 && game.skillTimer <= 0;
    const active = !locked && game.skillTimer > 0;
    const cooling = !locked && game.skillCd > 0 && game.skillTimer <= 0;

    ctx.fillStyle = active ? 'rgba(40,80,45,0.95)'
                  : ready  ? 'rgba(30,50,90,0.95)'
                           : 'rgba(20,22,30,0.8)';
    roundRect(sb.x, sb.y, sb.w, sb.h, 10);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = active ? 'rgba(120,255,140,0.95)'
                    : ready  ? 'rgba(120,200,255,0.95)'
                             : 'rgba(90,90,100,0.6)';
    roundRect(sb.x, sb.y, sb.w, sb.h, 10);
    ctx.stroke();

    if (cooling) {
      const p = 1 - game.skillCd / SKILL.cooldown;
      ctx.save();
      roundRect(sb.x, sb.y, sb.w, sb.h, 10);
      ctx.clip();
      ctx.fillStyle = 'rgba(80,140,255,0.22)';
      ctx.fillRect(sb.x, sb.y + sb.h * (1 - p), sb.w, sb.h * p);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (locked) {
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('🔒', sb.x + sb.w / 2, sb.y + sb.h / 2 - 14);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Lv.2 解锁', sb.x + sb.w / 2, sb.y + sb.h / 2 + 16);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h - 12);
    } else if (active) {
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillStyle = '#c0ffc8';
      ctx.fillText('⚡', sb.x + sb.w / 2, sb.y + sb.h / 2 - 16);
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#c0ffc8';
      ctx.fillText(game.skillTimer.toFixed(1) + 's', sb.x + sb.w / 2, sb.y + sb.h / 2 + 18);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#c0ffc8';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h - 12);
    } else if (ready) {
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = '#7ec8ff';
      ctx.fillText('⚡', sb.x + sb.w / 2, sb.y + sb.h / 2 - 18);
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = '#c6dcff';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h / 2 + 22);
    } else {
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillStyle = '#8898b0';
      ctx.fillText(Math.ceil(game.skillCd) + 's', sb.x + sb.w / 2, sb.y + sb.h / 2 - 6);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h - 12);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    drawTurretHotkey(sb, 'F');
  }

  // ---------- 升级基地 ----------
  const ub = ui.upgradeButton;
  if (ub) {
    const nextEra = game.playerEra + 1;
    const maxed = nextEra >= ERAS.length;
    const need = maxed ? 0 : [110, 100, 140, 150][nextEra - 1];
    const pts = game.upgradePoints;
    const tokenCost = maxed ? 0 : CONFIG.upgradeTokenCostByLevel[game.playerEra];
    const canUp = !maxed && pts >= need && game.gold >= tokenCost;

    ctx.fillStyle = maxed
      ? 'rgba(20,22,30,0.75)'
      : (canUp ? 'rgba(70,45,15,0.94)' : 'rgba(25,22,18,0.8)');
    roundRect(ub.x, ub.y, ub.w, ub.h, 12);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = maxed
      ? 'rgba(90,90,100,0.6)'
      : (canUp ? 'rgba(255,200,80,0.95)' : 'rgba(120,100,60,0.6)');
    roundRect(ub.x, ub.y, ub.w, ub.h, 12);
    ctx.stroke();

    if (!maxed) {
      const p = clamp(pts / need, 0, 1);
      ctx.save();
      roundRect(ub.x, ub.y, ub.w, ub.h, 12);
      ctx.clip();
      ctx.fillStyle = canUp ? 'rgba(255,200,80,0.28)' : 'rgba(160,140,80,0.18)';
      ctx.fillRect(ub.x, ub.y + ub.h * (1 - p), ub.w, ub.h * p);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = maxed ? '#888' : (canUp ? '#ffe08a' : '#a89060');
    ctx.fillText(maxed ? '已达最高等级' : '升 级 基 地', ub.x + ub.w / 2, ub.y + 32);

    if (!maxed) {
      ctx.font = 'bold 12px system-ui, sans-serif';
      drawTokenCost(formatGold(tokenCost) + '  ' + Math.floor(pts) + '/' + need,
                    ub.x + ub.w / 2, ub.y + 55,
                    (game.gold >= tokenCost) ? '#ffd94a' : '#7a6a30', 26, 15);

      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = canUp ? '#cccccc' : '#666';
      ctx.fillText(`→ Lv.${nextEra + 1}`, ub.x + ub.w / 2, ub.y + 76);
    }

    drawTurretHotkey(ub, 'Q');
  }

  // ---------- 结算 ----------
  if (game.over) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 屏幕上方结果文案
    const won = game.winner === 'player';
    const enemyName = ENEMY_BASE_NAMES[game.enemyEra] || '西装藤壶';
    const resultText = won
      ? `成功打败${enemyName}！`
      : '再接再厉！下次一定可以！';
    const resultColor = won ? '#ffd94a' : '#ff8a7e';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(resultText, W / 2, H * 0.12);
    ctx.fillStyle = resultColor;
    ctx.fillText(resultText, W / 2, H * 0.12);

    // CG 图（胜利 / 战败）
    const cgH = Math.min(H * 0.52, 430);
    const cgW = cgH * 1.05;
    const cgX = W / 2 - cgW / 2;
    const cgY = H * 0.24;
    const cg = won ? ASSETS.cgVictory : ASSETS.cgDefeat;

    if (imgReady(cg)) {
      const d = fitSprite(cg, cgW, cgH);
      ctx.drawImage(cg, W / 2 - d.w / 2, cgY + (cgH - d.h) / 2, d.w, d.h);
    } else {
      ctx.fillStyle = 'rgba(20,30,50,0.9)';
      ctx.fillRect(cgX, cgY, cgW, cgH);
      ctx.strokeStyle = 'rgba(140,200,255,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeRect(cgX, cgY, cgW, cgH);
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(160,200,240,0.55)';
      ctx.fillText('CG 图占位', W / 2, cgY + cgH / 2);
    }

    // 重开按钮（CG 下方）
    const rb = ui.restartButton;
    rb.y = cgY + cgH + 30;
    ctx.fillStyle = 'rgba(60,80,120,0.95)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#8ccfff';
    ctx.lineWidth = 2.5;
    roundRect(rb.x, rb.y, rb.w, rb.h, 12);
    ctx.stroke();

    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('再 来 一 局', W / 2, rb.y + 34);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/* ---------------- 重开 ---------------- */
function restart() {
  game.started = true;
  startBgm();
  game.gold = CONFIG.startGold;
  game.enemyGold = CONFIG.enemyStartGold;
  game.goldTick = 0;
  game.upgradePoints = 0;
  game.enemyTimeShift = 0;
  game.playerEra = 0;
  game.enemyEra = 0;
  game.playerCavalryUnlocked = false;
  game.enemyCavalryUnlocked = false;
  game.playerCavalryUnlockLeft = 0;
  game.enemyCavalryUnlockLeft = ENEMY_CAVALRY_UNLOCK_TIME;
  game.units.length = 0;
  game.projectiles.length = 0;
  game.particles.length = 0;
  game.floatTexts.length = 0;
  game.whales.length = 0;
  game.whaleTimer = rand(WHALE.intervalMin, WHALE.intervalMax);
  game.turrets = [null, null, null];
  game.enemyTurretCd = 0;
  game.skillCd = 0;
  game.skillTimer = 0;
  game.skillAnnounce = 0;
  game.skillUnlockAnnounce = 0;
  game.enemyLevelAnnounce = 0;
  game.enemyEraFlash = 0;
  game.whaleAnnounce = 0;
  game.time = 0;
  game.over = false;
  game.winner = null;

  spawnQueue.player.length = 0;
  spawnQueue.enemy.length = 0;
  spawnOrderCounter = 0;

  resetBases();
  resetAI();

  camX = 0;
  keys.a = false;
  keys.d = false;
  gameSpeed = 1;

  layoutUI();
}