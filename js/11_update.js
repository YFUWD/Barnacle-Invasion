/* =========================================================
   11 每帧更新：单位 AI / 移动碰撞 / 主更新 / 结算
   ========================================================= */

/* ---------------- 移动（含基地和单位的软阻挡） ---------------- */
function moveUnitWithCollision(u, dt, allUnits) {
  const step = u.dir * u.def.speed * dt;
  if (step === 0) return;

  const startX = u.x;
  let finalX = startX + step;
  const uHalf = u.def.w * 0.5;

  // 基地是墙壁（同阵营基地不阻挡）
  for (const base of [bases.player, bases.enemy]) {
    if (base.dead) continue;
    if (base.team === u.team) continue;
    if (step > 0) {
      const wall = base.x - base.w * 0.5 - uHalf;
      if (startX <= wall && finalX > wall) finalX = wall;
    } else {
      const wall = base.x + base.w * 0.5 + uHalf;
      if (startX >= wall && finalX < wall) finalX = wall;
    }
  }

  // 友军之间不穿过；同阵营只让 spawnOrder 更小的友军阻挡
  for (let i = 0; i < allUnits.length; i++) {
    const o = allUnits[i];
    if (o === u || o.dead) continue;
    if (o.team === u.team && o.spawnOrder > u.spawnOrder) continue;

    const minDist = unitMinDist(u, o);

    if (step > 0) {
      if (o.x >= startX - 0.5) {
        const limit = o.x - minDist;
        if (finalX > limit) finalX = Math.max(limit, startX);
      }
    } else {
      if (o.x <= startX + 0.5) {
        const limit = o.x + minDist;
        if (finalX < limit) finalX = Math.min(limit, startX);
      }
    }
  }

  u.x = finalX;
}

/* ---------------- 单个单位的决策 ---------------- */
function updateUnit(u, dt, foes, allUnits) {
  u.animT += dt;
  if (u.hitFlash > 0) u.hitFlash -= dt;
  if (u.cd > 0) u.cd -= dt;

  const d = u.def;
  const enemyBase = u.team === 'player' ? bases.enemy : bases.player;

  // 找最近的敌人
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i];
    if (f.dead) continue;
    const dist = Math.abs(f.x - u.x);
    if (dist < bestD) { bestD = dist; best = f; }
  }

  const baseEdgeDist = Math.abs(enemyBase.x - u.x) - enemyBase.w * 0.5;

  // 近战范围：至少覆盖接触距离（两个宽单位）
  let unitRange = d.range;
  if (d.melee && best) {
    const contactDist = (u.def.w + best.def.w) * 0.5 + BODY.gap;
    unitRange = Math.max(d.range, contactDist + 2);
  }
  // 打基地范围：近战至少覆盖自身半宽
  let baseRange = d.range;
  if (d.melee) {
    baseRange = Math.max(d.range, u.def.w * 0.5 + 2);
  }

  const canAttackUnitMelee  = best !== null && bestD <= unitRange;
  const canAttackUnitRanged = !!(d.rangedRange && best !== null && bestD <= d.rangedRange);
  const canAttackBase       = baseEdgeDist <= baseRange;

  if (canAttackUnitMelee) {
    if (u.cd <= 0) { attack(u, best, false); u.cd = d.atkCd; }
  } else if (canAttackUnitRanged) {
    // 骑兵：够不到近战范围但够得到远程范围 → 半伤投射物
    if (u.cd <= 0) { attack(u, best, true); u.cd = d.atkCd; }
  } else if (canAttackBase) {
    if (u.cd <= 0) { attack(u, enemyBase, false); u.cd = d.atkCd; }
  }

  // 近战：能打就不动；远程：一直推进（边走边打）
  const shouldMove = d.melee ? !(canAttackUnitMelee || canAttackBase) : true;

  if (shouldMove) {
    moveUnitWithCollision(u, dt, allUnits);
    u.state = 'walk';
  } else {
    u.state = 'attack';
  }
}

/* ---------------- 主更新 ---------------- */
function update(dt) {
  if (!game.started) return;

  updateCamera(dt);

  if (game.over) return;

  game.time += dt;

  // 双方 Token：每 0.2 秒入账一次
  game.goldTick += dt;
  while (game.goldTick >= CONFIG.goldTickInterval) {
    game.goldTick -= CONFIG.goldTickInterval;

    const playerPerTick = CONFIG.goldPerTick + game.playerEra * 500;
    const enemyWealthMult = [0.9, 1.0, 1.1, 1.2, 1.2][game.enemyEra] || 0.9;
    const enemyPerTick  = (CONFIG.goldPerTick + game.enemyEra * 500) * enemyWealthMult;

    game.gold += playerPerTick;
    game.enemyGold += enemyPerTick;

    spawnFloatText(
      bases.player.x + rand(-40, 40),
      -bases.player.h + 20 + rand(-10, 10),
      '+' + formatGold(playerPerTick),
      '#ffd94a'
    );
  }

  // 我方升级点数：每 1 秒 +1，上限 = 当前所需点数
  if (game.playerEra < ERAS.length - 1) {
    const needTable = [110, 100, 140, 150];
    const cap = needTable[game.playerEra];
    if (game.upgradePoints < cap) {
      game.upgradePoints = Math.min(cap, game.upgradePoints + dt);
    }
  }

  // 基地回血：按等级每秒恢复 Lv 点
  const regenP = game.playerEra + 1;
  const regenE = game.enemyEra + 1;
  if (!bases.player.dead && bases.player.hp < bases.player.maxHp) {
    bases.player.hp = Math.min(bases.player.maxHp, bases.player.hp + regenP * dt);
  }
  if (!bases.enemy.dead && bases.enemy.hp < bases.enemy.maxHp) {
    bases.enemy.hp = Math.min(bases.enemy.maxHp, bases.enemy.hp + regenE * dt);
  }

  // 技能计时
  if (game.skillCd > 0) game.skillCd -= dt;
  if (game.skillTimer > 0) game.skillTimer -= dt;
  if (game.skillAnnounce > 0) game.skillAnnounce -= dt;
  if (game.skillUnlockAnnounce > 0) game.skillUnlockAnnounce -= dt;
  if (game.enemyLevelAnnounce > 0) game.enemyLevelAnnounce -= dt;
  if (game.enemyEraFlash > 0) game.enemyEraFlash -= dt;
  if (game.whaleAnnounce > 0) game.whaleAnnounce -= dt;

  // 敌方基地自动升级
  const upgradeBonus = (CONFIG.difficultyUpgradeBonus[game.difficulty] || [0, 0, 0, 0, 0]);
  while (game.enemyEra < ERAS.length - 1 &&
         game.time + game.enemyTimeShift >=
           ENEMY_LEVEL_TIMES[game.enemyEra + 1] + upgradeBonus[game.enemyEra + 1]) {
    game.enemyEra++;
    game.enemyCavalryUnlocked = false;
    game.enemyCavalryUnlockLeft = ENEMY_CAVALRY_UNLOCK_TIME;
    game.enemyLevelAnnounce = 3.5;   // 右侧"藤壶开始变异了！"提示
    game.enemyEraFlash = 3;          // 右侧远景闪 3 秒新形象
    SFX.bossLevel();

    const eb = bases.enemy;
    const ratio = eb.hp / eb.maxHp;
    eb.maxHp = CONFIG.baseHpByEra[game.enemyEra];
    eb.hp = eb.maxHp * ratio;
  }

  // 骑兵解锁倒计时
  if (!game.enemyCavalryUnlocked && game.enemyCavalryUnlockLeft <= 0) {
    game.enemyCavalryUnlockLeft = ENEMY_CAVALRY_UNLOCK_TIME;
  }
  if (!game.playerCavalryUnlocked && game.playerCavalryUnlockLeft > 0) {
    game.playerCavalryUnlockLeft -= dt;
    if (game.playerCavalryUnlockLeft <= 0) {
      game.playerCavalryUnlockLeft = 0;
      game.playerCavalryUnlocked = true;
    }
  }
  if (!game.enemyCavalryUnlocked && game.enemyCavalryUnlockLeft > 0) {
    game.enemyCavalryUnlockLeft -= dt;
    if (game.enemyCavalryUnlockLeft <= 0) {
      game.enemyCavalryUnlockLeft = 0;
      game.enemyCavalryUnlocked = true;
    }
  }

  if (bases.player.hitFlash > 0) bases.player.hitFlash -= dt;
  if (bases.enemy.hitFlash > 0) bases.enemy.hitFlash -= dt;

  processSpawnQueues();
  aiUpdate(dt);

  const all = game.units;
  const pUnits = [];
  const eUnits = [];
  for (const u of all) {
    if (u.dead) continue;
    (u.team === 'player' ? pUnits : eUnits).push(u);
  }

  for (const u of pUnits) updateUnit(u, dt, eUnits, all);
  for (const u of eUnits) updateUnit(u, dt, pUnits, all);

  // separateUnits(all);   // 允许重叠
  clampUnitsToBases(all);

  updateTurrets(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  updateFloatTexts(dt);

  // 奶鲸事件
  game.whaleTimer -= dt;
  if (game.whaleTimer <= 0) {
    spawnWhales();
    game.whaleTimer = rand(WHALE.intervalMin, WHALE.intervalMax);
  }
  updateWhales(dt);

  if (all.some(u => u.dead)) {
    game.units = all.filter(u => !u.dead);
  }
}

/* ---------------- 结算 ---------------- */
function endGame(winnerTeam) {
  game.over = true;
  game.winner = winnerTeam;
  if (winnerTeam === 'player') SFX.victory();
  else SFX.defeat();
}