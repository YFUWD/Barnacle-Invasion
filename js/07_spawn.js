/* =========================================================
   07 出兵系统
   ---------------------------------------------------------
   沿用原型的做法：队列是"串行计时 + 允许重叠"。
     - 花钱进队列，出兵的计时从排到队首那一刻才开始算
     - 到点就生成，出生点固定在基地外沿，
       不管前面有没有人挡路（士兵可以堆在一起）
   ========================================================= */

/* 造一个单位（返回对象，不自动入队） */
function createUnitAt(typeId, team, x) {
  const def = UNIT_DB[typeId];
  const dir = team === 'player' ? 1 : -1;
  const eraIdx = getEraIndexByType(typeId);

  // 难度缩放：
  //   敌方 —— 简单 0.8×，其中 Lv.4 / Lv.5 的敌人再压到 0.7×；普通 1.0×；困难 1.1×
  //           普通难度 Lv.5 的骑兵再单独削一档（钱多又肉又痛，见 CONFIG.normalLv5CavalryNerf）
  //   我方 —— 简单模式下 Lv.5 补 1.2×，免得后期打不动
  let hpScale = 1, dmgScale = 1;
  if (team === 'enemy') {
    hpScale = dmgScale = (game.difficulty === 'easy' && eraIdx >= 3)
      ? 0.7
      : (CONFIG.difficultyScale[game.difficulty] || 1);

    if (game.difficulty === 'normal' && eraIdx === 4 && def.isCavalry) {
      const nerf = CONFIG.normalLv5CavalryNerf;
      hpScale  *= nerf.hp;
      dmgScale *= nerf.dmg;
    }
  } else if (game.difficulty === 'easy' && eraIdx >= 4) {
    hpScale = dmgScale = CONFIG.easyPlayerLv5Buff;
  }

  return {
    type: typeId,
    def,
    team,
    dir,
    x,
    y: 0,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    dmg: def.dmg * dmgScale,
    cd: Math.random() * 0.4,   // 出场时给一点随机攻击延迟，避免齐射
    state: 'walk',
    hitFlash: 0,
    animT: Math.random() * 10, // 走路上下晃动的相位
    dead: false,
    isBase: false,
    era: eraIdx,
    spawnOrder: ++spawnOrderCounter,
  };
}

/* 出生点：基地正中心（相当于基地开了个门，单位从门里走出来）。
   同阵营基地不再阻挡本单位，所以能从中心走出来；
   敌方单位仍然被基地矩形挡在外面，最多贴到基地边缘。 */
function getSpawnX(typeId, team) {
  const base = team === 'player' ? bases.player : bases.enemy;
  return base.x;
}

/* 每帧推进两个队列 */
function processSpawnQueues() {
  for (const team of ['player', 'enemy']) {
    const q = spawnQueue[team];
    while (q.length > 0) {
      const item = q[0];

      // 排到队首时才开始计时
      if (item.readyAt === null) item.readyAt = game.time + CONFIG.spawnDelay;
      if (game.time < item.readyAt) break;

      q.shift();
      const x = getSpawnX(item.typeId, team);
      game.units.push(createUnitAt(item.typeId, team, x));
    }
  }
}

/* 出兵花费：按等级查表（K 为单位） */
const COST_TABLE = {
  melee:   [50, 80, 140, 180, 240],
  ranged:  [60, 100, 160, 200, 300],
  cavalry: [140, 240, 400, 500, 600],
};

/* 骑兵解锁费用：按当前等级（Lv.1~5） */
const CAVALRY_UNLOCK_COSTS = [75000, 100000, 120000, 150000, 200000];

/* 骑兵解锁倒计时：我方 15 秒（点解锁后计时）；敌方 45 秒（升级后自动计时） */
const PLAYER_CAVALRY_UNLOCK_TIME = 15;
const ENEMY_CAVALRY_UNLOCK_TIME  = 45;

/* 升到 nextEraIndex 需要的升级点数：首级 90，之后每级 +20 */
function upgradePointsNeeded(nextEraIndex) {
  return 90 + (nextEraIndex - 1) * 20;
}

function unitCostFor(typeId, team) {
  const def = UNIT_DB[typeId];
  const era = getEraIndexByType(typeId);
  let row;
  if (def.isCavalry)   row = COST_TABLE.cavalry;
  else if (def.melee)  row = COST_TABLE.melee;
  else                 row = COST_TABLE.ranged;
  let cost = row[era] * 1000;
  // 技能生效期：我方士兵价格 ×0.8，向下取整到 K
  if (team === 'player' && game.skillTimer > 0) {
    cost = Math.floor(cost * SKILL.discount / 1000) * 1000;
  }
  return cost;
}

/* 骑兵解锁费用（按当前等级） */
function cavalryUnlockCost(team) {
  const era = (team === 'player') ? game.playerEra : game.enemyEra;
  return [75000, 100000, 120000, 150000, 200000][era];
}

/* 骑兵是否已解锁 */
function isCavalryUnlocked(team) {
  return team === 'player' ? game.playerCavalryUnlocked : game.enemyCavalryUnlocked;
}

/* 骑兵是否正在解锁中 */
function isCavalryUnlocking(team) {
  const left = team === 'player' ? game.playerCavalryUnlockLeft : game.enemyCavalryUnlockLeft;
  return left > 0;
}

/* 我方某兵种在队列里的出兵进度（0~1）。
   不在队列里返回 -1；在队列里但不是队首返回 0；是队首则返回实际倒计时进度。 */
function playerSpawnProgress(typeId) {
  const q = spawnQueue.player;
  for (let i = 0; i < q.length; i++) {
    if (q[i].typeId !== typeId) continue;
    if (i === 0 && q[i].readyAt !== null) {
      return clamp(1 - (q[i].readyAt - game.time) / CONFIG.spawnDelay, 0, 1);
    }
    return 0;
  }
  return -1;
}

/* 尝试开始解锁骑兵（扣钱并开始倒计时）；成功返回 true。
   注意：这里只启动倒计时，真正解锁由 update() 里倒计时归零时完成。 */
function tryUnlockCavalry(team) {
  if (isCavalryUnlocked(team)) return false;
  if (isCavalryUnlocking(team)) return false;
  const cost = cavalryUnlockCost(team);
  const gold = team === 'player' ? game.gold : game.enemyGold;
  if (gold < cost) return false;

  if (team === 'player') {
    game.gold -= cost;
    game.playerCavalryUnlockLeft = PLAYER_CAVALRY_UNLOCK_TIME;
  } else {
    game.enemyGold -= cost;
    game.enemyCavalryUnlockLeft = ENEMY_CAVALRY_UNLOCK_TIME;
  }
  SFX.unlock();
  return true;
}

/* 入队（扣钱 + 判队列上限）。返回是否成功 */
function enqueueSpawn(typeId, team) {
  const isPlayer = team === 'player';
  const gold = isPlayer ? game.gold : game.enemyGold;
  const cost = unitCostFor(typeId, team);

  if (gold < cost) return false;
  if (spawnQueue[team].length >= CONFIG.maxQueue) return false;

  if (isPlayer) game.gold -= cost;
  else game.enemyGold -= cost;

  spawnQueue[team].push({ typeId, readyAt: null });
  if (isPlayer) SFX.spawn();
  return true;
}

/* 某个兵种当前在队列里排了几个（UI 上的小红点） */
function queuedCount(team, typeId) {
  let n = 0;
  for (const item of spawnQueue[team]) {
    if (item.typeId === typeId) n++;
  }
  return n;
}
