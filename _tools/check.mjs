/* =========================================================
   藤壶的入侵 · 自检脚本
   ---------------------------------------------------------
   用法（在项目根目录）：
     node _tools/check.mjs

   做三件事：
     1. 用 vm.Script 逐文件做语法检查（只编译不执行，所以不需要浏览器 API）
     2. 交叉检查 index.html 的 <script> 顺序 与 js/ 目录是否一致
     3. 粗查跨文件引用：本文件里"裸调用"的顶层函数，
        是否在它之前定义过（函数声明会提升，故留一份前向引用白名单）
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

let errors = 0;
const fail = (msg) => { errors++; console.log('  ✗ ' + msg); };
const pass = (msg) => console.log('  ✓ ' + msg);

/* 故意的前向引用：函数声明会提升，调用点晚于定义点也没问题 */
const FORWARD_OK = new Set(['layoutUI', 'endGame', 'update', 'render', 'drawUI', 'loadAssets']);

/* 宿主环境 / 语言内置的裸调用（不带前导点） */
const BUILTIN = new Set([
  // JS 语言
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'alert',
  // 浏览器
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'fetch',
  'addEventListener', 'removeEventListener', 'matchMedia',
  // 本项目文件里"看起来像裸调用"的成员访问（正则匹配不到前导点的情况）
  'getElementById', 'getContext', 'getBoundingClientRect', 'setTransform',
]);

/* 去掉注释和字符串字面量，避免把 CSS 颜色、中文说明误判成函数调用 */
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

/* ---------- 1. 语法 ---------- */
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort();
console.log(`\n[1/3] 语法检查（${files.length} 个文件）`);
for (const f of files) {
  const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  try {
    new vm.Script(src, { filename: f });
    pass(f);
  } catch (e) {
    fail(`${f} → ${e.message}`);
  }
}

/* ---------- 2. 加载顺序 ---------- */
console.log('\n[2/3] index.html 加载顺序');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const listed = [...html.matchAll(/<script src="js\/([^"?]+)/g)].map(m => m[1]);
if (listed.length === 0) fail('index.html 里没找到 js/ 脚本');

const missing = files.filter(f => !listed.includes(f));
const extra = listed.filter(f => !files.includes(f));
if (missing.length) fail('js/ 里有文件没被 index.html 引入：' + missing.join(', '));
if (extra.length) fail('index.html 引用了不存在的文件：' + extra.join(', '));
if (!missing.length && !extra.length) pass(`顺序一致，共 ${listed.length} 个文件`);

/* ---------- 3. 跨文件引用 ---------- */
console.log('\n[3/3] 跨文件引用（粗查：只查裸调用）');
// 允许前置缩进：函数内部的局部 const/let/function 也算"本地已定义"，
// 否则会把 toX(...) 这种循环里的局部小工具函数误报成"未定义"
const DEF_RE = /^[ \t]*(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
// (?<![.\w$]) 保证不是 obj.method() 这种成员调用；
// (?!\s*\() 之外还要排掉语言关键字（for / while / return / typeof ...）
const KEYWORDS = 'for|while|if|else|return|switch|catch|typeof|do|in|of|new|delete|void|await|yield|throw|case';
const CALL_RE = new RegExp(
  `(?<![.\\w$])(?!(?:${KEYWORDS})\\b)([a-z][A-Za-z0-9_$]{2,})\\s*\\(`, 'g');

let refErrors = 0;
const definedSoFar = new Set();

for (const f of listed) {
  const raw = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  const src = stripNoise(raw);

  const localDefs = new Set();
  for (const m of src.matchAll(DEF_RE)) {
    const name = m[1] || m[2];
    if (name) localDefs.add(name);
  }

  const used = new Set();
  for (const m of src.matchAll(CALL_RE)) used.add(m[1]);

  const unknown = [];
  for (const name of used) {
    if (localDefs.has(name)) continue;
    if (definedSoFar.has(name)) continue;
    if (FORWARD_OK.has(name)) continue;
    if (BUILTIN.has(name)) continue;
    unknown.push(name);
  }
  if (unknown.length) {
    refErrors += unknown.length;
    fail(`${f} 用到但未定义：${unknown.join(', ')}`);
  }

  for (const n of localDefs) definedSoFar.add(n);
}
if (!refErrors) pass('没有发现"用了但没定义"的顶层函数');

/* ---------- 汇总 ---------- */
console.log('\n' + (errors === 0 ? '全部通过 ✅' : `发现 ${errors} 个问题 ❌`));
process.exit(errors === 0 ? 0 : 1);
