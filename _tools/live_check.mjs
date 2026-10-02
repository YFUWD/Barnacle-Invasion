/* =========================================================
   线上核对：把 GitHub Pages 上真正部署的那份打开、快进到中场、
   截图，并汇报每个素材槽位是加载成功还是退回了程序绘制。

   用法（在项目根目录）：
     node _tools/live_check.mjs
     node _tools/live_check.mjs https://yfuwd.github.io/Barnacle-Invasion/ 我的截图.png

   为什么需要它：本地一切都对，不代表线上对 —— 素材少传、路径大小写、
   Pages 的 Jekyll 处理都会让线上悄悄退回色块（游戏不会报错）。
   这个脚本直接问线上的页面"你到底加载到了几张图"。

   依赖：本机装了 Edge（Windows 默认路径自动探测）+ Node 20.11 以上。
   ========================================================= */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PAGE_URL = process.argv[2] || 'https://yfuwd.github.io/Barnacle-Invasion/';
const OUT_PNG = process.argv[3] || path.join(import.meta.dirname, '_shots', 'live_check.png');
const PORT = 9333;

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/* 在页面里跑的脚本：统计素材槽位 → 开局 → 快进 85 秒 → 相机对准中场 → 冻结 → 渲染 */
const DRIVE = `(() => {
  const report = [];
  const walk = (o, p) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && v.tagName === 'IMG') report.push(p + k + '=' + (imgReady(v) ? 'ok' : (v.complete ? 'ERR' : 'loading')));
      else if (v === null) report.push(p + k + '=null');
      else if (typeof v === 'object') walk(v, p + k + '.');
    }
  };
  walk(ASSETS, '');
  window.__bad = report.filter(s => s.endsWith('=null') || s.endsWith('=ERR'));
  window.__all = report;
  startGame('normal');
  for (let i = 0; i < 85 * 60; i++) {
    if (i % 90 === 0 && !game.over) { trySpawn('club'); trySpawn('sling'); }
    update(1 / 60);
  }
  const xs = game.units.map(u => u.x).sort((a, b) => a - b);
  if (xs.length) camX = clamp(xs[Math.floor(xs.length / 2)] - W / 2, 0, CONFIG.worldWidth - W);
  update = () => {};
  render();
  return 't=' + game.time.toFixed(0) + 's units=' + game.units.length;
})()`;

const edge = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!edge) {
  console.error('✗ 找不到 Edge / Chrome，改 EDGE_CANDIDATES 里的路径');
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'livecheck-'));
const child = spawn(edge, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--hide-scrollbars',
  `--user-data-dir=${profile}`, '--window-size=1280,720',
  `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('CDP 端口没起来');
}

let ws;
try {
  const page = await cdpTarget();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  console.log(`打开 ${PAGE_URL}`);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: PAGE_URL });
  await new Promise((res) => {
    const h = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); }
    };
    ws.addEventListener('message', h);
  });
  await sleep(4000);    // 等素材请求全部落地

  const title = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
  const drive = await send('Runtime.evaluate', { expression: DRIVE, returnByValue: true });
  if (drive.exceptionDetails) throw new Error('页面里执行失败：' + (drive.exceptionDetails.exception?.description || ''));
  const bad = await send('Runtime.evaluate', { expression: '(window.__bad || []).join("\\n")', returnByValue: true });
  const all = await send('Runtime.evaluate', { expression: 'window.__all.length', returnByValue: true });

  console.log(`页面标题：${title.result?.value}`);
  console.log(`开局与快进：${drive.result?.value}`);
  const badList = String(bad.result?.value || '').split('\n').filter(Boolean);
  console.log(`素材槽位 ${all.result?.value} 个，加载失败 ${badList.length} 个` + (badList.length ? '：' : ' ✅'));
  for (const b of badList) console.log('  ✗ ' + b);

  await sleep(600);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });
  fs.writeFileSync(OUT_PNG, Buffer.from(shot.data, 'base64'));
  console.log(`截图：${OUT_PNG}`);

  // 只把"本地有、线上没有"的算成问题：天空/地形/低等级基地本来就该走程序绘制
  console.log(`\n提示：sky / terrain / 低等级基地立绘 本来就没有图片文件，`);
  console.log(`      它们出现在上面是正常的；要盯的是士兵、武器、骑兵这一类。`);
  process.exitCode = 0;
} catch (e) {
  console.error('✗ ' + e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch { /* ignore */ }
  try { child.kill(); } catch { /* ignore */ }
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
