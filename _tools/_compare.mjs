/* =========================================================
   A/B 对拍：原始单文件原型  vs  拆分后的 19 个模块
   ---------------------------------------------------------
   用法：node _tools/_compare.mjs <原始原型.html> [帧数]

   两边都用同一颗种子的 Math.random、同一串玩家操作，
   然后逐帧比对：时间 / 金币 / 等级 / 每个单位的坐标血量冷却状态 /
   投射物 / 粒子 / 出兵队列 / 相机。
   任何一帧不一致都会打印出来。
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const ORIGINAL = process.argv[2];
const FRAMES = Number(process.argv[3] || 2400);
const VERBOSE = !!process.env.VERBOSE;

if (!ORIGINAL || !fs.existsSync(ORIGINAL)) {
  console.error('用法: node _tools/_compare.mjs <原始原型.html> [帧数]');
  process.exit(2);
}

/* ---------------- 固定种子的 Math.random ---------------- */
function seededMath() {
  let s = 0x2f6e2b1;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const M = Object.create(Math);
  M.random = random;
  return M;
}

/* ---------------- 假 canvas ---------------- */
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

function makeSandbox() {
  const ctxStub = makeCtx();
  const canvasStub = {
    width: 1440, height: 810, clientWidth: 1440, clientHeight: 810,
    getContext: () => ctxStub,
    addEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 810 }),
  };
  const sandbox = {
    console,
    Math: seededMath(),
    Date, JSON, Object, Array, String, Number, Boolean, Set, Map, Infinity, NaN,
    parseInt, parseFloat, isNaN, isFinite,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,      // 手动驱动，不让它自己跑循环
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
  return sandbox;
}

/* ---------------- 载入两边的源码 ---------------- */
function originalSource() {
  const html = fs.readFileSync(ORIGINAL, 'utf8');
  const chunks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return chunks.filter((c) => c.trim()).map((c) => ({ name: '原型内联脚本', src: c }));
}

function splitSources() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="js\/([^"?]+)/g)].map((m) => m[1]);
  return files.map((f) => ({ name: f, src: fs.readFileSync(path.join(JS_DIR, f), 'utf8') }));
}

function loadInto(sandbox, sources) {
  for (const s of sources) vm.runInContext(s.src, sandbox, { filename: s.name });
}

/* ---------------- 状态快照 ---------------- */
const SNAPSHOT = `(() => {
  const r = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
  return JSON.stringify({
    time: r(game.time), gold: r(game.gold), enemyGold: r(game.enemyGold),
    pEra: game.playerEra, eEra: game.enemyEra,
    over: game.over, winner: game.winner, cam: r(camX),
    hpP: r(bases.player.hp), hpE: r(bases.enemy.hp),
    deadP: bases.player.dead, deadE: bases.enemy.dead,
    aiTimer: r(ai.timer),
    units: game.units.map((u) => [u.type, u.team, r(u.x), r(u.hp), r(u.cd), u.state, u.dead]),
    proj: game.projectiles.map((p) => [r(p.x), r(p.y), p.team, r(p.dmg), p.dead]),
    part: game.particles.map((p) => [r(p.x), r(p.y), r(p.vx), r(p.vy), r(p.life)]),
    qP: spawnQueue.player.map((i) => [i.typeId, i.readyAt === null ? null : r(i.readyAt)]),
    qE: spawnQueue.enemy.map((i) => [i.typeId, i.readyAt === null ? null : r(i.readyAt)]),
  });
})()`;

/* ---------------- 玩家操作序列（两边完全一样） ---------------- */
// 注意：原型的 trySpawn 没有 return 值（返回 undefined），所以这里
// 不能写 a || b（短路会跳过第二个），必须分开调用，否则对拍结果没意义。
const OPS = `
  if (i === 0) { trySpawn('club', 'player'); }
  if (i % 90 === 0) {
    const ids = ERAS[game.playerEra].units;
    trySpawn(ids[1], 'player');
    trySpawn(ids[0], 'player');
  }
  if (i === 600)  { game.gold += 5000; tryUpgrade(); }
  if (i === 1500) { game.gold += 5000; tryUpgrade(); }
  if (i === 3000) { game.gold += 20000; tryUpgrade(); tryUpgrade(); }
  if (i === 300)  { keys.d = true; }
  if (i === 400)  { keys.d = false; keys.a = true; }
  if (i === 700)  { keys.a = false; }
`;

function stepScript(i) {
  return `(() => { const i = ${i};\n${OPS}\nupdate(1/60); render(); })()`;
}

/* ---------------- 逐帧对拍 ---------------- */
const origBox = makeSandbox();
const splitBox = makeSandbox();
const origSrcs = originalSource();
const splitSrcs = splitSources();

loadInto(origBox, origSrcs);
loadInto(splitBox, splitSrcs);
if (VERBOSE) {
  console.log('原始原型启动：' + vm.runInContext(`'gold=' + game.gold + ' units=' + game.units.length`, origBox));
  console.log('拆分版启动  ：' + vm.runInContext(`'gold=' + game.gold + ' units=' + game.units.length`, splitBox));
  console.log('原始原型内联脚本数：' + origSrcs.length + '，拆分版文件数：' + splitSrcs.length);
}

console.log(`\n对拍 ${FRAMES} 帧（同种子 + 同一串操作）\n`);

/* 把整段操作拼成一个大脚本，在里面逐步记录，方便定位第一处分歧 */
const TRACED = FRAMES > 0 ? `
{
  const __t = [];
  const __snap = (tag) => __t.push(tag + ' gold=' + game.gold.toFixed(3) +
    ' q=[' + spawnQueue.player.map(x => x.typeId).join(',') + '] over=' + game.over);
  __snap('起手      ');
  trySpawn('club', 'player');                       __snap('① 手写 club');
  { const ids = ERAS[game.playerEra].units;
    __t.push('ERAS[0].units=' + JSON.stringify(ids));
    trySpawn(ids[1], 'player');                     __snap('② 之后    ');
    trySpawn(ids[0], 'player');                     __snap('③ 之后    ');
  }
  update(1/60);                                     __snap('④ update后');
  console.log(__t.join('\\n    '));
}
` : '';

const diffs = [];
let firstDiffFrame = -1;

for (let i = 0; i < FRAMES; i++) {
  const step = stepScript(i);
  vm.runInContext(step, origBox, { filename: 'step-original' });
  vm.runInContext(step, splitBox, { filename: 'step-split' });

  const a = vm.runInContext(SNAPSHOT, origBox);
  const b = vm.runInContext(SNAPSHOT, splitBox);
  if (a !== b) {
    if (firstDiffFrame < 0) firstDiffFrame = i;
    if (diffs.length < 3) diffs.push({ frame: i, original: a, split: b });
  }
}

if (diffs.length === 0) {
  console.log(`✅ 前 ${FRAMES} 帧逐帧完全一致`);
  console.log('   （时间 / 金币 / 等级 / 相机 / 基地血量 / 每个单位的坐标·血量·冷却·状态 /');
  console.log('     投射物 / 粒子 / 双方出兵队列 / AI 计时器）');
  if (VERBOSE) {
    console.log('\n【跑完后的终态】');
    console.log('  原始原型: ' + vm.runInContext(
      `JSON.stringify({gold: Math.round(game.gold), pEra: game.playerEra, eEra: game.enemyEra,
        units: game.units.length, over: game.over, winner: game.winner,
        hpP: Math.round(bases.player.hp), hpE: Math.round(bases.enemy.hp)})`, origBox));
    console.log('  拆分版  : ' + vm.runInContext(
      `JSON.stringify({gold: Math.round(game.gold), pEra: game.playerEra, eEra: game.enemyEra,
        units: game.units.length, over: game.over, winner: game.winner,
        hpP: Math.round(bases.player.hp), hpE: Math.round(bases.enemy.hp)})`, splitBox));
  }
} else {
  console.log(`❌ 第 ${firstDiffFrame} 帧开始出现差异（共 ${diffs.length} 处，最多列 3 处）\n`);
  for (const d of diffs) {
    console.log(`  ── 第 ${d.frame} 帧 ──`);
    const pa = JSON.parse(d.original), pb = JSON.parse(d.split);
    for (const k of Object.keys(pa)) {
      const x = JSON.stringify(pa[k]), y = JSON.stringify(pb[k]);
      if (x !== y) console.log(`    · ${k}\n        原型: ${x.slice(0, 200)}\n        拆分: ${y.slice(0, 200)}`);
    }
  }
}

process.exit(diffs.length === 0 ? 0 : 1);
