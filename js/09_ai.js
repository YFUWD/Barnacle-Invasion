/* =========================================================
   09 敌方 AI
   ---------------------------------------------------------
   每次计时到，先 roll 一个"目标兵种"（不看价格），
   买得起就出，买不起就攒着——下次计时再检查同一个目标。
   这样贵的兵（弓手）不会被便宜兵（战士）永远挤掉。
   每出 7 个兵强制 1 个骑兵。
   ========================================================= */

const ai = { timer: 2.0, spawnCounter: 0, pendingPick: null };

function resetAI() {
  ai.timer = 2.0;
  ai.spawnCounter = 0;
  ai.pendingPick = null;
}

function aiUpdate(dt) {
  ai.timer -= dt;
  if (ai.timer > 0) return;
  ai.timer = rand(1.0, 2.2);

  if (spawnQueue.enemy.length >= CONFIG.maxQueue) return;

  // 当前等级可出且已解锁的兵种
  const ids = ERAS[game.enemyEra].units.filter(id => {
    if (UNIT_DB[id].isCavalry && !game.enemyCavalryUnlocked) return false;
    return true;
  });
  if (!ids.length) return;

  ai.spawnCounter++;

  // 每 7 个强制出 1 个骑兵（未解锁时不强制）
  const cavalryId = ERAS[game.enemyEra].units.find(id => UNIT_DB[id].isCavalry);
  const cavalryDue = ai.spawnCounter >= 7 && cavalryId && game.enemyCavalryUnlocked;
  if (cavalryDue) {
    if (unitCostFor(cavalryId, 'enemy') <= game.enemyGold) {
      enqueueSpawn(cavalryId, 'enemy');
      ai.spawnCounter = 0;
      ai.pendingPick = null;
    }
    return;
  }

  // 已有目标：继续攒钱出它
  if (ai.pendingPick) {
    if (!ids.includes(ai.pendingPick)) {
      ai.pendingPick = null;   // 目标兵种已不可出（如骑兵被锁），重新 roll
    } else if (unitCostFor(ai.pendingPick, 'enemy') <= game.enemyGold) {
      enqueueSpawn(ai.pendingPick, 'enemy');
      ai.pendingPick = null;
      return;
    } else {
      return;   // 攒钱中，下次计时再检查
    }
  }

  // 重新 roll 一个目标（不看价格）
  const pick = ids[Math.floor(Math.random() * ids.length)];
  if (unitCostFor(pick, 'enemy') <= game.enemyGold) {
    enqueueSpawn(pick, 'enemy');
  } else {
    ai.pendingPick = pick;   // 买不起，记住它，攒钱
  }
}
