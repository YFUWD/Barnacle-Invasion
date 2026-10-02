/* =========================================================
   18 玩家操作
   ---------------------------------------------------------
   鼠标 / 触屏：点底部按钮出兵，点右下角升级基地
   键盘：A/D 移动视角，1~2 出兵，U 升级，R / 空格 重开
   ========================================================= */

/* 从菜单开始一局：设定难度并重置 */
function startGame(diff) {
  game.difficulty = diff;
  restart();
  unlockAudio();     // 点击菜单这一刻才算"用户手势"，这时才能出声
  startBgm();
}

function trySpawn(id) {
  if (game.over) return;
  const def = UNIT_DB[id];
  // 骑兵未解锁时，按钮/快捷键改为触发解锁
  if (def.isCavalry && !game.playerCavalryUnlocked) {
    tryUnlockCavalry('player');
    return;
  }
  enqueueSpawn(id, 'player');
}

function tryUpgrade() {
  if (game.over) return;

  const next = game.playerEra + 1;
  if (next >= ERAS.length) return;

  // 升级：消耗升级点数（90 / 100 / 140 / 150）+ Token（按当前等级 50/100/150/150/300K）
  const need = [110, 100, 140, 150][next - 1];
  const tokenCost = CONFIG.upgradeTokenCostByLevel[game.playerEra];
  if (game.upgradePoints < need) return;
  if (game.gold < tokenCost) return;

  game.upgradePoints -= need;
  game.gold -= tokenCost;
  game.playerEra = next;
  SFX.upgrade();
  game.playerCavalryUnlocked = false;    // 升级后骑兵需要重新解锁
  game.playerCavalryUnlockLeft = 0;      // 清掉正在进行的倒计时

  // 升到 Lv.2 时提示技能解锁
  if (game.playerEra === 1) {
    game.skillUnlockAnnounce = 4.0;
  }

  // 基地血量按当前百分比映射到新等级上限
  const pb = bases.player;
  const ratio = pb.hp / pb.maxHp;
  pb.maxHp = CONFIG.baseHpByEra[game.playerEra];
  pb.hp = pb.maxHp * ratio;

  layoutUI();          // 兵种按钮换一批，热区要重算
}

/* ---------------- 指针 ---------------- */
canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();       // 第一次点击就是"用户手势"，先把音频上下文建起来
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // 菜单界面：点击难度按钮开始（按钮位置现算，不依赖 ui.menuButtons）
  if (!game.started) {
    const mbw = 170, mbh = 70, mgap = 24;
    const totalMW = mbw * 3 + mgap * 2;
    const startMX = W / 2 - totalMW / 2;
    const mby = H / 2 + 30;
    const diffs = ['easy', 'normal', 'hard'];
    for (let i = 0; i < 3; i++) {
      const bx = startMX + i * (mbw + mgap);
      if (mx >= bx && mx <= bx + mbw && my >= mby && my <= mby + mbh) {
        startGame(diffs[i]);
        return;
      }
    }
    return;
  }

  if (game.over) {
    if (ui.restartButton && hitTest(mx, my, ui.restartButton)) { SFX.click(); restart(); }
    return;
  }

  // 技能按钮
  if (ui.skillButton && hitTest(mx, my, ui.skillButton)) {
    tryActivateSkill();
    return;
  }

  // 炮塔槽位（左下角）
  if (ui.turretSlots) {
    for (const slot of ui.turretSlots) {
      if (hitTest(mx, my, slot)) {
        const t = game.turrets[slot.slot];
        if (!t) tryBuildTurret(slot.slot);
        else tryUpgradeTurret(slot.slot);
        return;
      }
    }
  }

  for (const btn of ui.unitButtons) {
    if (hitTest(mx, my, btn)) { trySpawn(btn.id); return; }
  }
  if (ui.upgradeButton && hitTest(mx, my, ui.upgradeButton)) tryUpgrade();
});

/* ---------------- 键盘 ---------------- */
window.addEventListener('keydown', (e) => {
  if (e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.key === 'd' || e.key === 'D') keys.d = true;

  // 静音开关：M（任何界面都能按）
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }

  // 菜单界面：按 1/2/3 选难度
  if (!game.started) {
    if (e.key === '1') { startGame('easy');   return; }
    if (e.key === '2') { startGame('normal'); return; }
    if (e.key === '3') { startGame('hard');   return; }
    return;
  }

  if (game.over) {
    if (e.key === 'r' || e.key === 'R' || e.key === ' ') { SFX.click(); restart(); }
    return;
  }

  // 速度切换：1 = 1 倍速，2 = 2 倍速，3 = 10 倍速
  if (e.key === '1') { gameSpeed = 1;  return; }
  if (e.key === '2') { gameSpeed = 2;  return; }
  if (e.key === '3') { gameSpeed = 10; return; }

  // 技能：F
  if (e.key === 'f' || e.key === 'F') { tryActivateSkill(); return; }

  // 炮塔：W = 后（slot 2），E = 中（slot 1），R = 前（slot 0）。空槽建造、已建升级
  if (e.key === 'w' || e.key === 'W') {
    const t = game.turrets[2];
    if (!t) tryBuildTurret(2); else tryUpgradeTurret(2);
    return;
  }
  if (e.key === 'e' || e.key === 'E') {
    const t = game.turrets[1];
    if (!t) tryBuildTurret(1); else tryUpgradeTurret(1);
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    const t = game.turrets[0];
    if (!t) tryBuildTurret(0); else tryUpgradeTurret(0);
    return;
  }

  // 出兵：Z / X / C 对应第 1/2/3 个按钮
  const keyMap = { z: 0, x: 1, c: 2 };
  const ki = keyMap[e.key.toLowerCase()];
  if (ki !== undefined && ki < ui.unitButtons.length) {
    trySpawn(ui.unitButtons[ki].id);
    return;
  }

  // 升级基地：Q
  if (e.key === 'q' || e.key === 'Q') tryUpgrade();
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.key === 'd' || e.key === 'D') keys.d = false;
});

// 切到别的窗口时松开按键，免得视角自己飘
window.addEventListener('blur', () => {
  keys.a = false;
  keys.d = false;
});

window.addEventListener('resize', resize);
