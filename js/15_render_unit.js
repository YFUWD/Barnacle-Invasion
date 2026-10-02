/* =========================================================
   15 渲染 · 单位
   ---------------------------------------------------------
   有立绘就画立绘（等比缩放 + 底边对齐），否则画色块占位。
   立绘一律按"朝右"入库；dir < 0 的阵营在这里水平镜像，所以敌人看起来朝左。
   血条只在掉血后才显示。
   ========================================================= */

/* 立绘绘制盒（等比塞进这个盒子，底边贴地面） */
const UNIT_SPRITE_BOX = {
  melee:   { w: 96,  h: 128 },
  ranged:  { w: 96,  h: 118 },
  cavalry: { w: 310, h: 195 },
};

/* 武器：盒子尺寸 + 握把在贴图上的位置（0~1）+ 基础旋转 + 前后微调。
   握把落在"手"那个点上，旋转也绕这个点 —— 挥砍看起来才是握着的。
   fwd/up 是在"旋转之前"的坐标系里把武器往前/往上挪一点。
   盒子尺寸按**贴图自身的朝向**给（rot 会在之后套上）：pencilHead 转 90°，
   所以它的 w/h 是"横过来之后"的高/长。 */
const WEAPON_DRAW = {
  // 玩家 MC 剑图标：剑柄在左下角，握点在 (0.20, 0.77) 附近
  melee:  { w: 46, h: 46, gx: 0.20, gy: 0.77, rot: 0, fwd: 0, up: 0 },
  // 敌方近战藤壶：铅笔竖着握在身前，笔尖朝上
  pencil: { w: 15, h: 58, gx: 0.50, gy: 0.82, rot: 0, fwd: 0, up: 0 },
  // 敌方远程藤壶：铅笔横着顶在头顶，笔尖朝前（转 90° 后笔尖朝右，
  // 敌人整体水平镜像一次，画出来正好朝左 = 它前进的方向）
  // lift 是相对"立绘盒顶边"抬多高；立绘本身顶部还有 ~4px 透明边，
  // 所以取 0 时铅笔正好压在藤壶头顶上。
  pencilHead: { w: 14, h: 62, gx: 0.50, gy: 0.50, rot: Math.PI / 2,
                anchor: 'head', lift: 0 },
  // 玩家拉弓帧：MC 图标的木弓身在上左、弓弦在下右（弓背朝着拿弓的人），
  // 对"朝右"的角色来说是反的 —— 转 180° 之后弓背朝前、弓弦在角色这一侧，箭也朝前。
  // 盒子 58：再大太抢戏，50 又会糊掉。
  bow:    { w: 58, h: 58, gx: 0.50, gy: 0.50, rot: Math.PI, fwd: 12, up: 2 },
};

/* 手的位置（贴在贴图上的比例）。代码里用 (x - 0.5) * 立绘宽 换算，
   所以这里存的就是"贴图归一化坐标"：对着 unit_player_soldier_walk1.png
   打网格量出来，拳头中心在 (0.87, 0.485)。 */
const HAND_ANCHOR = { x: 0.87, y: 0.485 };

/* 当前该画哪张立绘：优先受伤帧，走路时轮播 4 帧，站定用第 1 帧 */
function pickUnitFrame(u, set) {
  if (u.hitFlash > 0 && imgReady(set.hurt)) return set.hurt;
  const frames = (set.walk || []).filter(imgReady);
  if (!frames.length) return null;
  if (u.state === 'walk' && frames.length > 1) {
    return frames[Math.floor(u.animT * 8) % frames.length];
  }
  return frames[0];
}

/* 当前该画哪张武器 */
function pickWeapon(u) {
  const era = clamp(u.era | 0, 0, 4);
  if (u.team === 'player') {
    if (u.def.melee) return ASSETS.weapons.playerMelee[era];
    // 远程：按攻击冷却的进度取拉弓帧（进度 0 = 刚射完 / 待机，进度 1 = 拉满）
    // 注意不能用 u.state —— 远程兵一直在走，state 永远是 'walk'
    const frames = ASSETS.weapons.playerBow;
    if (!frames.length) return null;
    const p = u.cd > 0 ? clamp(1 - u.cd / u.def.atkCd, 0, 1) : 0;
    const i = Math.min(frames.length - 1, Math.floor(p * frames.length));
    return frames[i] || firstReady(frames);
  }
  return ASSETS.weapons.enemyPencil[era];
}

/* 这套配置该把武器挂在哪个点上：
   · 默认 "手" —— 贴图上的比例 (fx, fy) 换算成以"脚下"为原点的画布坐标
   · "头顶" —— 立绘正中上方（远程藤壶把铅笔顶在头上） */
function weaponAnchor(cfg, w, h, dir) {
  if (cfg.anchor === 'head') {
    return { x: 0, y: -h - (cfg.lift || 0) };
  }
  return {
    x: dir * (HAND_ANCHOR.x - 0.5) * w + dir * (cfg.fwd || 0),
    y: (HAND_ANCHOR.y - 1) * h - (cfg.up || 0),
  };
}

/* 绘制武器：近战跟着攻击动作挥舞，远程按冷却换拉弓帧 */
function drawWeapon(u, w, h) {
  const def = u.def;
  const dir = u.dir;
  const img = pickWeapon(u);
  const cfg = def.melee ? (u.team === 'player' ? WEAPON_DRAW.melee : WEAPON_DRAW.pencil)
                        : (u.team === 'player' ? WEAPON_DRAW.bow : WEAPON_DRAW.pencilHead);

  const anchor = weaponAnchor(cfg, w, h, dir);
  const handX = anchor.x;
  const handY = anchor.y;

  if (!imgReady(img)) {
    // ---- 没有素材时的程序占位 ----
    ctx.save();
    ctx.translate(handX, handY);
    if (dir < 0) ctx.scale(-1, 1);

    if (def.melee) {
      let angle = -0.2;
      if (u.state === 'attack') {
        const progress = 1 - Math.max(0, u.cd) / def.atkCd;
        angle = Math.sin(progress * Math.PI * 2 - Math.PI / 2) * (Math.PI / 3);
      }
      ctx.rotate(angle);
      let bladeColor;
      if (u.team === 'player') {
        // 按等级：木剑 / 石剑 / 铁剑 / 钻石剑 / 下界合金剑
        const playerBladeColors = ['#8b5a2b', '#9aa0a8', '#f0f0f0', '#4aa8ff', '#1a1a1a'];
        bladeColor = playerBladeColors[u.era] || '#c0c0c0';
      } else {
        bladeColor = '#ffd700';
      }
      ctx.strokeStyle = bladeColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(28, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = u.team === 'player' ? '#8b5a2b' : '#2a2a2a';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, -8);
      ctx.lineTo(14, 8);
      ctx.closePath();
      ctx.fill();
      if (u.team === 'player') {
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(14, -8);
        ctx.lineTo(14, 8);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  // ---- 有素材：握把/挂点对准锚点，旋转也绕这个点 ----
  const d = fitSprite(img, cfg.w, cfg.h);

  ctx.save();
  ctx.translate(handX, handY);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.rotate(cfg.rot);

  if (def.melee) {
    let angle = -0.2;
    if (u.state === 'attack') {
      const progress = 1 - Math.max(0, u.cd) / def.atkCd;
      angle = Math.sin(progress * Math.PI * 2 - Math.PI / 2) * (Math.PI / 3);
    }
    ctx.rotate(angle);
  }

  ctx.drawImage(img, -d.w * cfg.gx, -d.h * cfg.gy, d.w, d.h);
  ctx.restore();
}

function drawUnit(u) {
  const sx = u.x - camX;
  if (sx < -120 || sx > W + 120) return;   // 视野外不画

  const def = u.def;
  const w = def.w;
  const h = def.h;
  const sy = groundY;
  const bob = u.state === 'walk' ? Math.sin(u.animT * 14) * 1.6 : 0;

  const set = unitSpriteSet(u);
  const img = pickUnitFrame(u, set);

  // 血条要挂到"画出来的立绘顶上"，不是碰撞盒顶上 ——
  // 步兵立绘 128 高、骑兵 195 高，用 def.h(=100) 会把血条压在脸上
  let barTop = sy - h;

  if (imgReady(img)) {
    const box = def.isCavalry ? UNIT_SPRITE_BOX.cavalry
                              : (def.melee ? UNIT_SPRITE_BOX.melee : UNIT_SPRITE_BOX.ranged);
    const d = fitSprite(img, box.w, box.h);
    barTop = sy + bob - d.h;

    // 影子（按立绘实际宽度）
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.min(d.w * 0.45, def.w * 0.62), 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 立绘
    ctx.save();
    ctx.translate(sx, sy + bob);
    if (u.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -d.w / 2, -d.h, d.w, d.h);
    ctx.restore();

    // 武器：在"原点已落在脚下、未镜像"的坐标系里画（镜像由 drawWeapon 自己做）
    ctx.save();
    ctx.translate(sx, sy + bob);
    drawWeapon(u, d.w, d.h);
    ctx.restore();

    // 远程兵开火前的小亮点
    if (!def.melee && u.cd > def.atkCd - 0.10 && u.state === 'attack') {
      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(u.dir > 0 ? d.w * 0.42 : -d.w * 0.42, -d.h * 0.62, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.translate(sx, sy + bob);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体颜色：玩家 1~4 级蓝色、5 级彩色兵（暂用黑色）；
    //           敌方 1~4 级按等级换色、5 级彩色兵（暂用黑色）
    let bodyColor;
    if (u.team === 'player') {
      bodyColor = u.era === 4 ? '#000000' : '#3b82f6';
    } else {
      const enemyColors = ['#c0c0c0', '#2f855a', '#1e3a8a', '#6b21a8', '#000000'];
      bodyColor = enemyColors[u.era] || '#c0c0c0';
    }
    const fill = u.hitFlash > 0 ? '#ffffff' : bodyColor;
    ctx.fillStyle = fill;
    ctx.fillRect(-w / 2, -h, w, h);

    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 1, -h + 1, w - 2, h - 2);

    // 玩家士兵身体内部加数字（等级 1~4）
    if (u.team === 'player') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.era + 1, 0, -h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // 朝向标记
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    const markW = Math.max(3, w * 0.18);
    ctx.fillRect(u.dir > 0 ? w / 2 - markW - 2 : -w / 2 + 2, -h + 3, markW, 5);

    // 远程兵开火前的小亮点
    if (!def.melee && u.cd > def.atkCd - 0.10 && u.state === 'attack') {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(u.dir > 0 ? w * 0.7 : -w * 0.7, -h * 0.65, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    drawWeapon(u, w, h);

    ctx.restore();
  }

  // ---- 血条（挂在立绘顶上，骑兵就在骑手头顶上）----
  if (u.hp < u.maxHp) {
    const bw = Math.max(w + 10, 28);
    const bx = sx - bw / 2;
    const by = barTop - 11;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);

    const r = clamp(u.hp / u.maxHp, 0, 1);
    ctx.fillStyle = u.team === 'player' ? '#4ade80' : '#f87171';
    ctx.fillRect(bx, by, bw * r, 4);
  }
}
