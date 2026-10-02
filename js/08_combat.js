/* =========================================================
   08 战斗：伤害 / 粒子 / 攻击 / 投射物 / 夹取
   ========================================================= */

/* ---------------- 伤害结算 ---------------- */
function applyDamage(target, dmg, fromTeam) {
  if (!target || target.dead) return;

  if (target.isBase) {
    damageBase(target, dmg, fromTeam);
    return;
  }

  target.hp -= dmg;
  target.hitFlash = 0.13;
  SFX.hit();

  if (target.hp <= 0) {
    target.hp = 0;
    target.dead = true;
    SFX.die();
    const lv = (target.era || 0) + 1;
    const reward = 10000 * lv;
    const isCav = !!(target.def && target.def.isCavalry);
    if (fromTeam === 'player') {
      game.gold += reward;
      if (game.playerEra < ERAS.length - 1) {
        const needTable = [110, 100, 140, 150];
        const cap = needTable[game.playerEra];
        const gain = isCav ? 2 : 1;
        game.upgradePoints = Math.min(cap, game.upgradePoints + gain);
      }
      spawnFloatText(target.x, -target.def.h * 0.5, '+' + formatGold(reward), '#7ee0ff');
    } else if (fromTeam === 'enemy') {
      game.enemyGold += reward;
      game.enemyTimeShift += isCav ? 3 : 2;
    }
    spawnParticles(target.x, -target.def.h * 0.5, target.def.color, 10, 150);
  }
}

/* ---------------- 飘字 ---------------- */
function spawnFloatText(x, y, text, color) {
  game.floatTexts.push({
    x, y, text,
    color: color || '#ffd94a',
    life: 1.0,
    maxLife: 1.0,
    vy: -60,
  });
}

function updateFloatTexts(dt) {
  const fs = game.floatTexts;
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    f.life -= dt;
    if (f.life <= 0) continue;
    f.y += f.vy * dt;
  }
  game.floatTexts = fs.filter(f => f.life > 0);
}

/* ---------------- 粒子 ---------------- */
function spawnParticles(x, y, color, count, spread) {
  for (let i = 0; i < count; i++) {
    game.particles.push({
      x, y,
      vx: rand(-spread, spread),
      vy: rand(-spread * 0.9, -spread * 0.15),
      life: rand(0.35, 0.7),
      maxLife: 0.7,
      color,
      size: rand(2, 5),
    });
  }
}

function updateParticles(dt) {
  const ps = game.particles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 520 * dt;
  }
  game.particles = ps.filter(p => p.life > 0);
}

/* ---------------- 一次攻击 ---------------- */
function attack(u, target, useRanged) {
  const d = u.def;

  // 近战：直接结算全额伤害
  if (d.melee && !useRanged) {
    applyDamage(target, u.dmg, u.team);
    const ty = target.isBase ? -target.h * 0.55 : -target.def.h * 0.6;
    spawnParticles(target.x, ty, '#ffe07a', 4, 110);
    return;
  }

  // 远程投射物：骑兵的 ranged 模式伤害减半
  const dmg = useRanged ? u.dmg * 0.5 : u.dmg;
  const sprite = projectileSpriteFor(u);
  SFX.shoot();
  game.projectiles.push({
    x: u.x + u.dir * 14,
    y: -d.h * 0.72,
    target,
    dmg,
    team: u.team,
    speed: d.projSpeed || 500,
    color: d.projColor || '#e0c890',
    size: d.projSize || 5,
    splash: d.splash || 0,
    img: sprite.img,          // 有贴图就用贴图，没有就走原来的线段 / 圆点
    imgRot: sprite.rot,       // 贴图自带的朝向补偿（箭矢图标是斜 45°）
    dead: false,
  });
}

/* 远程兵该扔什么：玩家丢箭（5 级换光灵箭），敌方丢藤壶铅笔 */
function projectileSpriteFor(u) {
  const era = clamp(u.era | 0, 0, 4);
  if (u.team === 'player') {
    return era >= 4
      ? { img: ASSETS.projectiles.spectral, rot: Math.PI / 4 }
      : { img: ASSETS.projectiles.arrow,    rot: Math.PI / 4 };
  }
  return { img: ASSETS.projectiles.pencil[era], rot: 0 };
}

/* ---------------- 投射物 ---------------- */
function updateProjectiles(dt) {
  const ps = game.projectiles;

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.dead) continue;
    if (!p.target || p.target.dead) { p.dead = true; continue; }

    const tx = p.target.x;
    const ty = p.target.isBase ? -p.target.h * 0.5 : -p.target.def.h * 0.5;

    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;

    if (dist <= step + 6) {
      if (p.splash) {
        for (const o of game.units) {
          if (o.dead || o.team === p.team) continue;
          if (Math.abs(o.x - p.x) < p.splash) applyDamage(o, p.dmg * 0.65, p.team);
        }
        const eb = p.team === 'player' ? bases.enemy : bases.player;
        if (!eb.dead && Math.abs(eb.x - p.x) < p.splash + eb.w * 0.5) {
          applyDamage(eb, p.dmg * 0.65, p.team);
        }
        spawnParticles(p.x, p.y, '#ffb347', 16, 230);
      }

      applyDamage(p.target, p.dmg, p.team);
      spawnParticles(tx, ty, p.color, 5, 130);
      p.dead = true;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }

  game.projectiles = ps.filter(p => !p.dead);
}

function separateUnits(list) {
  // intentionally left blank（允许重叠）
}

/* ---------------- 炮塔 ---------------- */
function getTurretPos(slot) {
  const base = bases.player;
  const offsets = [base.w * 0.5 - 20, base.w * 0.5 - 90, base.w * 0.5 - 160];
  return {
    x: base.x + offsets[slot],
    y: -base.h - TURRET.h * 0.5,
  };
}

/* 敌方炮塔位置（贴敌方基地左缘，朝向我方） */
function getEnemyTurretPos() {
  const base = bases.enemy;
  return {
    x: base.x - base.w * 0.5 + 20,
    y: -base.h - TURRET.h * 0.5,
  };
}

function tryBuildTurret(slot) {
  if (game.over) return false;
  if (game.turrets[slot]) return false;
  if (slot > 0 && !game.turrets[slot - 1]) return false;
  const cost = TURRET.slotCosts[slot];
  if (game.gold < cost) return false;
  game.gold -= cost;
  game.turrets[slot] = { slot, cd: 0, level: 1, buildTimer: TURRET.buildTime };
  SFX.unlock();
  return true;
}

function tryUpgradeTurret(slot) {
  if (game.over) return false;
  const t = game.turrets[slot];
  if (!t) return false;
  if (t.buildTimer > 0) return false;
  if (t.level >= game.playerEra + 1) return false;
  if (t.level >= TURRET.damages.length) return false;
  const cost = TURRET.upgradeCosts[t.level - 1];
  if (game.gold < cost) return false;
  game.gold -= cost;
  t.level += 1;
  SFX.upgrade();
  return true;
}

function updateTurrets(dt) {
  for (const t of game.turrets) {
    if (!t) continue;

    if (t.buildTimer > 0) {
      t.buildTimer -= dt;
      if (t.buildTimer < 0) t.buildTimer = 0;
      continue;
    }

    if (t.cd > 0) t.cd -= dt;
    if (t.cd > 0) continue;

    const cx = bases.player.x;
    const effRange = TURRET.range + (t.level - 1) * 10;
    let best = null;
    let bestD = Infinity;

    for (const u of game.units) {
      if (u.dead || u.team !== 'enemy') continue;
      const d = Math.abs(u.x - cx);
      if (d <= effRange && d < bestD) { bestD = d; best = u; }
    }
    const eb = bases.enemy;
    if (!eb.dead) {
      const d = Math.abs(eb.x - cx) - eb.w * 0.5;
      if (d <= effRange && d < bestD) { bestD = d; best = eb; }
    }
    if (!best) continue;

    const dmg = TURRET.damages[t.level - 1] || TURRET.damages[0];
    const pos = getTurretPos(t.slot);
    game.projectiles.push({
      x: pos.x,
      y: pos.y,
      target: best,
      dmg,
      team: 'player',
      speed: TURRET.projSpeed,
      color: TURRET.projColor,
      size: TURRET.projSize,
      img: ASSETS.turrets.playerShot,   // 深度思考图标
      imgRot: 0,
      splash: 0,
      dead: false,
    });
    t.cd = TURRET.atkCd;
  }

  // 敌方炮塔（固定 1 个，等级 = 敌方基地等级）
  if (!bases.enemy.dead) {
    if (game.enemyTurretCd > 0) {
      game.enemyTurretCd -= dt;
      if (game.enemyTurretCd < 0) game.enemyTurretCd = 0;
    }

    if (game.enemyTurretCd === 0) {
      const cx = bases.enemy.x;
      const lvl = Math.max(1, Math.min(TURRET.damages.length, game.enemyEra + 1));
      const effRange = TURRET.range + (lvl - 1) * 10;
      let best = null;
      let bestD = Infinity;

      for (const u of game.units) {
        if (u.dead || u.team !== 'player') continue;
        const d = Math.abs(u.x - cx);
        if (d <= effRange && d < bestD) { bestD = d; best = u; }
      }
      const pb = bases.player;
      if (!pb.dead) {
        const d = Math.abs(pb.x - cx) - pb.w * 0.5;
        if (d <= effRange && d < bestD) { bestD = d; best = pb; }
      }

      if (best) {
        const dmg = TURRET.damages[lvl - 1];
        const pos = getEnemyTurretPos();
        game.projectiles.push({
          x: pos.x,
          y: pos.y,
          target: best,
          dmg,
          team: 'enemy',
          speed: TURRET.projSpeed,
          color: '#ff8a7e',
          size: TURRET.projSize,
          img: ASSETS.turrets.enemyShot[game.enemyEra],   // 更小的 6 号藤壶（同等级颜色）
          imgRot: 0,
          splash: 0,
          dead: false,
        });
        SFX.turret();
        game.enemyTurretCd = TURRET.atkCd;
      }
    }
  }
}

/* ---------------- 技能：梁文（谷）时段 ---------------- */
function tryActivateSkill() {
  if (game.over) return false;
  if (!game.started) return false;
  if (game.playerEra < 1) return false;   // Lv.2 起才能用
  if (game.skillCd > 0) return false;
  game.skillCd = SKILL.cooldown;
  game.skillTimer = SKILL.duration;
  game.skillAnnounce = 2.5;
  spawnFloatText(bases.player.x, -bases.player.h - 40, '梁文时段', '#7ee0ff');
  SFX.skill();
  return true;
}

/* ---------------- 奶鲸事件 ---------------- */
function spawnWhales() {
  const w = WHALE.w;
  const minX = bases.player.x + bases.player.w * 0.5 + w * 0.5 + 20;
  const maxX = bases.enemy.x - bases.enemy.w * 0.5 - w * 0.5 - 20;
  if (maxX <= minX) return;

  game.whaleAnnounce = 2.2;   // 屏幕中上方提示"理中客奶鲸来了！！！"

  const count = WHALE.countMin + Math.floor(Math.random() * (WHALE.countMax - WHALE.countMin + 1));
  const placed = [];

  for (let i = 0; i < count; i++) {
    let x = 0;
    let tries = 0;
    do {
      x = rand(minX, maxX);
      tries++;
    } while (tries < 40 && placed.some(px => Math.abs(px - x) < w + 10));
    if (tries >= 40) continue;

    placed.push(x);
    game.whales.push({
      x,
      y: -WHALE.h - 800,
      w,
      h: WHALE.h,
      state: 'falling',
      stayTimer: 0,
      alpha: 1,
      dead: false,
    });
  }
}

function updateWhales(dt) {
  for (const wh of game.whales) {
    if (wh.state === 'falling') {
      wh.y += WHALE.fallSpeed * dt;
      if (wh.y >= 0) {
        wh.y = 0;
        wh.state = 'landed';
        wh.stayTimer = 0;

        for (const u of game.units) {
          if (u.dead) continue;
          const uHalf = u.def.w * 0.5;
          if (u.x + uHalf > wh.x - wh.w * 0.5 && u.x - uHalf < wh.x + wh.w * 0.5) {
            const dmg = u.maxHp * WHALE.dmgPercent + WHALE.dmgFlat;
            applyDamage(u, dmg, 'whale');
          }
        }
        spawnParticles(wh.x, -wh.h * 0.5, '#7ec8ff', 18, 240);
      }
    } else if (wh.state === 'landed') {
      wh.stayTimer += dt;
      if (wh.stayTimer > WHALE.stayTime) {
        wh.alpha -= dt / WHALE.fadeTime;
        if (wh.alpha <= 0) {
          wh.alpha = 0;
          wh.dead = true;
          SFX.whale();
        }
      }
    }
  }
  game.whales = game.whales.filter(wh => !wh.dead);
}

function clampUnitsToBases(units) {
  for (const u of units) {
    if (u.dead) continue;
    const uHalf = u.def.w * 0.5;

    for (const base of [bases.player, bases.enemy]) {
      if (base.dead) continue;
      if (base.team === u.team) continue;
      if (!overlapsBase(u.x, uHalf, base)) continue;

      const baseL = base.x - base.w * 0.5;
      const baseR = base.x + base.w * 0.5;
      if (u.x < base.x) u.x = baseL - uHalf - 1;
      else              u.x = baseR + uHalf + 1;
    }
  }
}