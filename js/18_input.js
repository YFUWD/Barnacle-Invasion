/* =========================================================
   18 玩家操作
   ---------------------------------------------------------
   鼠标 / 触屏：点底部按钮出兵、点右下角升级基地、点炮塔槽位、点技能；
                在空处按住拖动 = 平移视角（手机没有 A/D 键，靠这个看战场）
   键盘：A/D 移动视角，Z/X/C 出兵，Q 升级，W/E/R 炮塔，F 技能，
        1/2/3 变速，M 静音，L 强制横屏，R / 空格 重开

   注意：画面在手机竖屏"强制横屏"时是转过 90° 的，
   所以指针坐标要先过 screenToView() 换算成游戏视口坐标再用（见 17_ui.js）。
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

/* ---------------- 指针（鼠标 / 触屏） ---------------- */
// 按住空处拖动 = 平移视角；点按钮是"按下即生效"（和以前一样）
let dragPan = null;

function eventToView(e) {
  const rect = canvas.getBoundingClientRect();
  return screenToView(e.clientX - rect.left, e.clientY - rect.top);
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();       // 第一次点击就是"用户手势"，先把音频上下文建起来
  const p = eventToView(e);

  // 之前选过"全屏横屏"的话，第一次触摸时才能真正进全屏 + 原生旋转
  retryNativeLock();

  // 「要不要全屏横屏」询问框：盖在最上层，先处理它
  if (MOBILE.askOpen) {
    for (const b of (ui.askButtons || [])) {
      if (hitTest(p.x, p.y, b)) { SFX.click(); answerAskFullscreen(b.id === 'yes'); return; }
    }
    answerAskFullscreen(false);    // 点空白处 = 先不用（之后还能点右上角开关）
    return;
  }

  // 「倍速」开关（手机，在横屏开关左边）：2× ⇄ 5×
  if (ui.speedBtn && MOBILE.touch && hitTest(p.x, p.y, ui.speedBtn)) {
    SFX.click();
    gameSpeed = (gameSpeed >= 4) ? 2 : 5;
    return;
  }

  // 「强制横屏」开关（触摸设备才有，菜单 / 对局 / 结算界面都点得到）
  if (ui.forceBtn && MOBILE.touch && hitTest(p.x, p.y, ui.forceBtn)) {
    SFX.click();
    toggleForceLandscape();
    return;
  }

  // 菜单界面：点击难度按钮开始
  if (!game.started) {
    for (const b of ui.menuButtons) {
      if (hitTest(p.x, p.y, b)) { startGame(b.diff); return; }
    }
    return;
  }

  if (game.over) {
    if (ui.restartButton && hitTest(p.x, p.y, ui.restartButton)) { SFX.click(); restart(); }
    return;
  }

  // 技能按钮
  if (ui.skillButton && hitTest(p.x, p.y, ui.skillButton)) {
    tryActivateSkill();
    return;
  }

  // 炮塔槽位（左下角）
  if (ui.turretSlots) {
    for (const slot of ui.turretSlots) {
      if (hitTest(p.x, p.y, slot)) {
        const t = game.turrets[slot.slot];
        if (!t) tryBuildTurret(slot.slot);
        else tryUpgradeTurret(slot.slot);
        return;
      }
    }
  }

  for (const btn of ui.unitButtons) {
    if (hitTest(p.x, p.y, btn)) { trySpawn(btn.id); return; }
  }
  if (ui.upgradeButton && hitTest(p.x, p.y, ui.upgradeButton)) { tryUpgrade(); return; }

  // 没点到任何按钮 → 开始拖动画面（触摸屏唯一的平移视角方式）
  dragPan = { id: e.pointerId, startX: p.x, camStart: camX, moved: false };
  if (canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 不支持就算了 */ }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragPan || e.pointerId !== dragPan.id) return;
  const p = eventToView(e);
  const dx = p.x - dragPan.startX;              // 视口方向上的位移（转过 90° 时已换算过）
  if (!dragPan.moved && Math.abs(dx) < 6) return;   // 手指没怎么动，不算拖动
  dragPan.moved = true;
  MOBILE.panning = true;
  // 世界被缩小了 z 倍，所以视口里拖 dx 等于世界里的 dx / z
  camX = clamp(dragPan.camStart - dx / worldZoom(), 0, maxCameraX());
});

function endPan(e) {
  if (!dragPan) return;
  if (e && e.pointerId !== undefined && e.pointerId !== dragPan.id) return;
  dragPan = null;
  MOBILE.panning = false;
}
canvas.addEventListener('pointerup', endPan);
canvas.addEventListener('pointercancel', endPan);
canvas.addEventListener('pointerleave', endPan);

/* ---------------- 键盘 ---------------- */
window.addEventListener('keydown', (e) => {
  // 询问框开着：只认「全屏横屏 / 先不用」
  if (MOBILE.askOpen) {
    if (e.key === '1' || e.key === 'y' || e.key === 'Y' || e.key === 'Enter') { answerAskFullscreen(true); return; }
    if (e.key === '2' || e.key === 'n' || e.key === 'N' || e.key === 'Escape' || e.key === ' ') { answerAskFullscreen(false); return; }
    return;
  }

  if (e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.key === 'd' || e.key === 'D') keys.d = true;

  // 静音开关：M（任何界面都能按）
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }

  // 强制横屏开关：L（手机上没键盘也无所谓，右上角有按钮）
  if (e.key === 'l' || e.key === 'L') { toggleForceLandscape(); return; }

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

  // 速度切换：1 = 1 倍速，2 = 2 倍速（默认），3 = 10 倍速，4 = 5 倍速
  if (e.key === '1') { gameSpeed = 1;  return; }
  if (e.key === '2') { gameSpeed = 2;  return; }
  if (e.key === '3') { gameSpeed = 10; return; }
  if (e.key === '4') { gameSpeed = 5;  return; }

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
