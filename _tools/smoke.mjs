/* =========================================================
   藤壶的入侵 · 无头冒烟测试
   ---------------------------------------------------------
   用法（在项目根目录）：
     node _tools/smoke.mjs

   把 19 个 js 在一个 vm 沙箱里跑起来（canvas 用 Proxy 假实现，
   所有绘制调用都被吞掉），然后模拟一段真实节奏的对局，检查：

     1. 19 个文件按 index.html 的顺序能跑起来，加载不抛异常
     2. 长时间跑 update() + render() 不抛异常
     3. 经济、基地血量、队列数量不会出现异常值
     4. 近战/远程都能造成伤害，强攻部队能拆基地
     5. restart() 能清干净，基地爆掉能正确判胜负

   注意：这里只做"不会崩、状态合理"的检查，不检查平衡性或手感。
   （原型本身就有"密集出兵会在基地门口挤成一堆"的行为，
     拆分时刻意保持原样，所以不做"必须没有重叠"这类断言。）
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

let errors = 0;
const fail = (m) => { errors++; console.log('  ✗ ' + m); };
const ok   = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

/* ---------------- 假的 canvas ---------------- */
function makeCtx() {
  const gradient = { addColorStop() {} };
  const target = {
    measureText: (t) => ({ width: String(t).length * 8 }),
    createLinearGradient: () => gradient,
    createPattern: () => ({}),
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      const fn = () => {};
      t[k] = fn;
      return fn;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const ctxStub = makeCtx();
const canvasStub = {
  width: 1440, height: 810,
  clientWidth: 1440, clientHeight: 810,
  getContext: () => ctxStub,
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 810 }),
};

const sandbox = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, Infinity, NaN,
  parseInt, parseFloat, isNaN, isFinite,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,   // 手动驱动，绝不让它自己跑循环
  cancelAnimationFrame() {},
  setTimeout, clearTimeout,
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } set src(_v) {} },
  document: {
    getElementById: (id) => (id === 'game' ? canvasStub : {}),
    addEventListener() {},
  },
  devicePixelRatio: 1,
  innerWidth: 1440, innerHeight: 810,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};

vm.createContext(sandbox);

/* ---------------- 按 index.html 的顺序拼一个大文件 ---------------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const listed = [...html.matchAll(/<script src="js\/([^"?]+)/g)].map((m) => m[1]);
const chunks = listed.map((f) => `/* ===== ${f} ===== */\n${fs.readFileSync(path.join(JS_DIR, f), 'utf8')}\n`);

console.log(`\n[1/4] 沙箱加载 ${listed.length} 个模块`);
try {
  vm.runInContext(chunks.join('\n'), sandbox, { filename: 'bundle.js' });
  ok('加载并执行完成，没有抛异常');
} catch (e) {
  fail('执行时抛异常：' + e.stack.split('\n').slice(0, 3).join(' | '));
  process.exit(1);
}

const get = (expr) => vm.runInContext(expr, sandbox);

/* 现版本进游戏要先过难度菜单：update() 在 game.started 为 false 时直接 return，
   所以必须先真正开一局，否则时间、经济、敌方升级全都不会推进。 */
try {
  get("startGame('normal')");
  if (get('game.started') !== true) throw new Error('game.started 仍是 false');
  ok("startGame('normal') 开局成功（等价于点菜单里的「普通」）");
} catch (e) {
  fail('开局失败：' + e.message);
  process.exit(1);
}

/* ---------------- 模拟 6 分钟 ---------------- */
console.log('\n[2/4] 模拟 21600 帧（6 分钟，接近真实操作节奏）');
const DT = 1 / 60;
const frames = 21600;
const startHp = get('CONFIG.baseHp');
const maxQueue = get('CONFIG.maxQueue');

let spawnedPlayer = 0;
let upgradeTries = 0;
let firstPlayerBaseHit = null;
let firstEnemyBaseHit = null;
let simulatedFrames = 0;
let minGapEver = { player: Infinity, enemy: Infinity };
let frozenFrames = 0;

try {
  // 先花掉开局那点金币（模拟玩家先出一波兵）
  get(`trySpawn('club', 'player'); trySpawn('sling', 'player');`);

  for (let i = 0; i < frames; i++) {
    simulatedFrames = i + 1;
    if (get('game.over')) break;

    // 假玩家：每 3 秒按当前等级点两个基础兵种；每 5 秒试一次升级基地
    // （升级现在同时要"升级点数"和 Token，不够会被拒绝，属正常）
    if (i % 180 === 0) {
      // 注意：trySpawn 没有返回值（undefined），只能靠"金币有没有少"来判断出没出兵
      const ids = get(`ERAS[game.playerEra].units`);
      const goldBefore = get('game.gold');
      get(`trySpawn(${JSON.stringify(ids[0])})`);
      if (get('game.gold') < goldBefore) spawnedPlayer++;
      get(`trySpawn(${JSON.stringify(ids[1])})`);
    }
    if (i % 300 === 0 && get('game.playerEra') + 1 < get('ERAS.length')) {
      const eraBefore = get('game.playerEra');
      get('tryUpgrade()');
      if (get('game.playerEra') > eraBefore) upgradeTries++;
    }

    get(`update(${DT})`);
    if (i % 4 === 0) get('render()');   // 渲染路径也定期跑

    // 记录队伍间距（只观察，不断言"必须没重叠"）
    if (i % 30 === 0) {
      const gaps = get(`(() => {
        const out = {};
        for (const team of ['player', 'enemy']) {
          const xs = game.units.filter(u => u.team === team).map(u => u.x).sort((a, b) => a - b);
          let g = Infinity;
          for (let k = 1; k < xs.length; k++) g = Math.min(g, xs[k] - xs[k - 1]);
          out[team] = g;
        }
        return out;
      })()`);
      let bad = false;
      for (const team of ['player', 'enemy']) {
        if (gaps[team] < minGapEver[team]) minGapEver[team] = gaps[team];
        if (gaps[team] < 0.05) bad = true;   // 完全重合（间距 0）
      }
      if (bad) frozenFrames++;
    }

    if (firstPlayerBaseHit === null && get('bases.player.hp') < startHp) firstPlayerBaseHit = i / 60;
    if (firstEnemyBaseHit === null && get('bases.enemy.hp') < startHp) firstEnemyBaseHit = i / 60;
  }
  ok(`跑了 ${simulatedFrames} 帧（${(simulatedFrames / 60).toFixed(0)} 秒）没有抛异常`);
  note(`我方成功出兵 ${spawnedPlayer} 次，基地升级成功 ${upgradeTries} 次`);
  note(`基地首次挨打：我 ${firstPlayerBaseHit === null ? '未被打到' : firstPlayerBaseHit.toFixed(0) + 's'}，` +
       `敌 ${firstEnemyBaseHit === null ? '未被打到' : firstEnemyBaseHit.toFixed(0) + 's'}`);
} catch (e) {
  fail('模拟过程中抛异常：' + e.stack.split('\n').slice(0, 3).join(' | '));
  process.exit(1);
}

/* ---------------- 状态检查 ---------------- */
console.log('\n[3/4] 状态检查');
const st = {
  time: +get('game.time').toFixed(1),
  playerEra: get('game.playerEra'),
  enemyEra: get('game.enemyEra'),
  gold: Math.round(get('game.gold')),
  enemyGold: Math.round(get('game.enemyGold')),
  units: get('game.units.length'),
  playerUnits: get('game.units.filter(u => u.team === "player").length'),
  enemyUnits: get('game.units.filter(u => u.team === "enemy").length'),
  baseHp: Math.round(get('bases.player.hp')),
  enemyBaseHp: Math.round(get('bases.enemy.hp')),
  queueP: get('spawnQueue.player.length'),
  queueE: get('spawnQueue.enemy.length'),
  over: get('game.over'),
  winner: get('game.winner'),
};
note(JSON.stringify(st));

if (st.time < 60) fail(`时间没推进（game.time = ${st.time}）`); else ok('时间在推进');
if (st.gold < 0 || st.enemyGold < 0) fail('金币出现负数'); else ok('金币没有负数');
if (st.over) {
  note(`对局在 ${st.time}s 就结束了（${st.winner === 'player' ? '我方' : '敌方'}获胜），` +
       `跳过"敌方是否按时升级"的判定（下面 [4/4] 有单独的时间表测试）`);
} else if (st.enemyEra < 2) {
  fail(`敌方没按时自动升级（enemyEra = ${st.enemyEra}）`);
} else {
  ok(`敌方基地按时间表升到 Lv.${st.enemyEra + 1}`);
}
if (st.queueP > maxQueue || st.queueE > maxQueue) fail('出兵队列超出上限');
else ok('出兵队列没有超上限');
if (st.baseHp < 0 || st.enemyBaseHp < 0) fail('基地血量出现负数');
else ok('基地血量没有负数');
note(`队伍最小间距（只做观察）：我 ${minGapEver.player === Infinity ? '-' : minGapEver.player.toFixed(1)}px，` +
     `敌 ${minGapEver.enemy === Infinity ? '-' : minGapEver.enemy.toFixed(1)}px`);
note(`出现"两个兵完全重合"的采样帧数：${frozenFrames}（原型本身允许重叠，这不是错误）`);

/* ---------------- 关键机制单测 ---------------- */
console.log('\n[4/4] 关键机制单测');

/* 远程兵能打出投射物 */
const projTest = get(`(() => {
  restart();
  game.units.length = 0;
  game.projectiles.length = 0;
  const u = createUnitAt('sling', 'player', 500);
  const t = createUnitAt('club', 'enemy', 620);      // 在 200 射程内
  game.units.push(u, t);
  u.cd = 0;
  for (let i = 0; i < 30; i++) updateUnit(u, 1/60, [t], game.units);
  return game.projectiles.length;
})()`);
if (projTest > 0) ok(`远程兵能生成投射物（当前 ${projTest} 发在飞）`); else fail('远程兵没有产生投射物');

/* 近战能造成伤害 */
const meleeTest = get(`(() => {
  game.units.length = 0;
  const a = createUnitAt('club', 'player', 900);
  const b = createUnitAt('club', 'enemy', 930);
  game.units.push(a, b);
  a.cd = 0; b.cd = 0;
  const before = b.hp;
  for (let i = 0; i < 60; i++) updateUnit(a, 1/60, [b], game.units);
  return { before, after: b.hp };
})()`);
if (meleeTest.after < meleeTest.before) ok(`近战能造成伤害（${meleeTest.before} → ${meleeTest.after}）`);
else fail('近战打不掉血');

/* 强攻部队能拆掉敌方基地 */
const baseRush = get(`(() => {
  restart();
  game.units.length = 0;
  for (let i = 0; i < 6; i++) game.units.push(createUnitAt('cannon', 'player', 2500 + i * 60));
  const before = bases.enemy.hp;
  for (let i = 0; i < 600; i++) update(1/60);
  return { before, after: Math.round(bases.enemy.hp), over: game.over, winner: game.winner };
})()`);
if (baseRush.after < baseRush.before) ok(`强攻部队能打掉敌方基地血量（${baseRush.before} → ${baseRush.after}）`);
else fail('部队走到基地跟前却不打基地');

/* 敌方强攻会触发失败结算 */
const baseLose = get(`(() => {
  restart();
  game.units.length = 0;
  for (let i = 0; i < 6; i++) game.units.push(createUnitAt('cannon', 'enemy', 500 - i * 60));
  for (let i = 0; i < 3600; i++) { update(1/60); if (game.over) break; }
  return { over: game.over, winner: game.winner, playerHp: Math.round(bases.player.hp) };
})()`);
if (baseLose.over && baseLose.winner === 'enemy') ok(`敌方强攻能打爆基地并触发结算（我方剩 ${baseLose.playerHp}）`);
else fail('敌方部队没打爆我方基地：' + JSON.stringify(baseLose));

/* 钱不够 / 队列满时出兵必须失败 */
const guardTest = get(`(() => {
  restart();
  game.gold = 0;
  const broke = enqueueSpawn('club', 'player');
  game.gold = 99999999;          // 一个 Lv.1 战士 50K，塞满 10 个队列绰绰有余
  spawnQueue.player.length = 0;
  for (let i = 0; i < CONFIG.maxQueue + 5; i++) enqueueSpawn('club', 'player');
  const full = spawnQueue.player.length;
  spawnQueue.player.length = 0;
  return { broke, full };
})()`);
if (guardTest.broke === false) ok('金币不足时出兵被正确拒绝'); else fail('金币不足竟然出兵成功了');
if (guardTest.full === maxQueue) ok(`队列上限生效（最多 ${guardTest.full} 个）`);
else fail(`队列上限没生效（${guardTest.full}）`);

/* 骑兵解锁：鼠标点按钮和按 C 都走 tryUnlockCavalry()，这条路径必须真的能跑通
   （曾经因为函数里引用了不存在的变量，鼠标和键盘一起静默失效，两个自检都没发现） */
const cavalryTest = get(`(() => {
  restart();
  const id = ERAS[game.playerEra].units.find(u => UNIT_DB[u].isCavalry);
  game.gold = 500000;                                   // 开局只有 30K，先给够解锁费

  const beforeGold = game.gold;
  const started = tryUnlockCavalry('player');           // 点 C / 点按钮走的就是这个
  const afterGold = game.gold;
  const countdown = game.playerCavalryUnlockLeft;
  const duringLock = isCavalryUnlocking('player');

  // 倒计时结束后应该真的解锁，并且这时候才能出兵
  game.playerCavalryUnlockLeft = 0;
  game.playerCavalryUnlocked = true;
  const queued = enqueueSpawn(id, 'player');

  restart();
  return { started, spent: beforeGold - afterGold, countdown, duringLock, queued };
})()`);
if (cavalryTest.err) fail('骑兵解锁测试：' + cavalryTest.err);
else if (cavalryTest.started === true && cavalryTest.spent > 0 && cavalryTest.countdown > 0 && cavalryTest.duringLock === true) {
  ok(`骑兵解锁真的启动了（扣 ${cavalryTest.spent} Token，倒计时 ${cavalryTest.countdown.toFixed(0)}s）`);
} else {
  fail('骑兵解锁没启动：' + JSON.stringify(cavalryTest));
}
if (cavalryTest.queued === true) ok('解锁后骑兵能正常入队');
else fail('解锁后骑兵仍然入不了队：' + JSON.stringify(cavalryTest));

/* 敌方基地按时间表自动升级（0 / 140 / 240 / 360 / 510 秒） */
const eraTimeline = get(`(() => {
  restart();
  const seq = [];
  for (const t of [0, 139, 140, 239, 240, 359, 360, 509, 510]) {
    game.time = t;      // 直接把时间拨到检查点，再走一帧让 update() 结算升级
    update(1/60);
    seq.push(game.enemyEra);
  }
  restart();
  return seq;
})()`);
const eraWant = [0, 0, 1, 1, 2, 2, 3, 3, 4];
if (JSON.stringify(eraTimeline) === JSON.stringify(eraWant)) {
  ok(`敌方基地按时间表自动升级（0/140/240/360/510s → Lv.${eraTimeline.map(e => e + 1).join('→Lv.')}）`);
} else {
  fail('敌方自动升级时间表不对：' + JSON.stringify(eraTimeline) + '，期望 ' + JSON.stringify(eraWant));
}

/* restart 要清干净 */
const resetTest = get(`(() => {
  restart();
  return {
    gold: game.gold, time: game.time, units: game.units.length,
    proj: game.projectiles.length, part: game.particles.length,
    over: game.over, q: spawnQueue.player.length + spawnQueue.enemy.length,
    hpP: bases.player.hp, hpE: bases.enemy.hp,
    eraP: game.playerEra, eraE: game.enemyEra, cam: camX,
  };
})()`);
const C = get('CONFIG');
const resetOk = resetTest.gold === C.startGold && resetTest.time === 0 &&
  resetTest.units === 0 && resetTest.proj === 0 && resetTest.part === 0 &&
  resetTest.over === false && resetTest.q === 0 && resetTest.cam === 0 &&
  resetTest.hpP === C.baseHp && resetTest.hpE === C.baseHp &&
  resetTest.eraP === 0 && resetTest.eraE === 0;
if (resetOk) ok('restart() 把局面清干净了'); else fail('restart() 有残留：' + JSON.stringify(resetTest));

/* 胜负判定 */
const winTest = get(`(() => {
  restart();
  applyDamage(bases.enemy, 99999, 'player');
  const a = { over: game.over, winner: game.winner, dead: bases.enemy.dead };
  restart();
  applyDamage(bases.player, 99999, 'enemy');
  const b = { over: game.over, winner: game.winner, dead: bases.player.dead };
  restart();
  return { a, b };
})()`);
if (winTest.a.over && winTest.a.winner === 'player' && winTest.b.winner === 'enemy') {
  ok('基地被打爆后能正确判定胜负');
} else {
  fail('胜负判定不对：' + JSON.stringify(winTest));
}

console.log('\n' + (errors === 0 ? '冒烟测试全部通过 ✅' : `发现 ${errors} 个问题 ❌`));
process.exit(errors === 0 ? 0 : 1);
