/* =========================================================
   17 UI：尺寸 / 布局 / 面板 / 按钮 / 重开
   ---------------------------------------------------------
   同一个链接同时服务 PC 和手机（打开时自动判断）：

     · PC / 平板：布局跟着窗口大小走（和以前一样）
     · 手机竖屏：底部按钮排成三排、字号收紧、拖动画面平移视角
     · 手机横屏：还是原来那一排，只是整体缩放

   手机还能开关「强制横屏」：
     优先用原生屏幕旋转（Android Chrome，需要先进全屏），
     不支持时（iOS Safari / 桌面浏览器）退回"画面在画布内转 90°"，
     所以两种情况看起来都是横的。
   ========================================================= */

/* ---------------- 设备 / 朝向状态 ---------------- */
const MOBILE = {
  touch: false,           // 有触摸能力：显示角落的横屏开关、提示语改成"拖动"
  phone: false,           // 触摸 + 小屏 → 用手机布局
  forceLandscape: false,  // 玩家开关：强制横屏
  rotated: false,         // 正在用"画布内旋转 90°"兜底
  nativeLock: false,      // 原生旋转锁定是否成功
  sw: 0, sh: 0,           // 画布 CSS 尺寸（设备物理朝向）
  safe: { top: 0, right: 0, bottom: 0, left: 0 },   // 物理朝向的安全区（刘海/小白条）
  panning: false,         // 正在拖动画面
};

const FORCE_LS_KEY = 'barnacle.forceLandscape';

function detectDevice() {
  const mq = (q) => (typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false);
  let touchPoints = 0, ua = '';
  try { touchPoints = navigator.maxTouchPoints || 0; } catch (e) { touchPoints = 0; }
  try { ua = navigator.userAgent || ''; } catch (e) { ua = ''; }

  // 判断"触摸设备"只用这三条：
  //   · 主指针是粗的 + 没有 hover（手机/平板的典型特征）
  //   · UA 里写着手机系统
  //   · 触点数 ≥ 2（真实的触摸屏都报 5、10 这种；Chrome 桌面/模拟环境可能虚报 1）
  // 故意不用 'ontouchstart' in window —— 桌面 Chrome/Edge 上它永远是 true。
  const coarse = mq('(pointer: coarse)') && mq('(hover: none)');
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|Windows Phone/i.test(ua);
  MOBILE.touch = coarse || uaMobile || touchPoints >= 2;

  // 只按"触摸 + 短边很小"判定手机，平板和触屏笔记本都走宽屏布局
  const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
  MOBILE.phone = MOBILE.touch && Math.min(vw, vh) <= 500;
}

/* 安全区：css 里用 env() 读进 --sat 等自定义属性，这里再取出来给布局用 */
function readSafeArea() {
  let cs = null;
  try { cs = getComputedStyle(document.documentElement); } catch (e) { return; }
  if (!cs || !cs.getPropertyValue) return;
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  MOBILE.safe = {
    top:    num(cs.getPropertyValue('--sat')),
    right:  num(cs.getPropertyValue('--sar')),
    bottom: num(cs.getPropertyValue('--sab')),
    left:   num(cs.getPropertyValue('--sal')),
  };
}

/* 安全区换算到"游戏视口"坐标系（画面转了 90° 时四个边要跟着换） */
function viewSafe() {
  const s = MOBILE.safe;
  if (!MOBILE.rotated) return { top: s.top, right: s.right, bottom: s.bottom, left: s.left };
  // 画面顺时针转 90°：物理上边→视口左边，物理右边→视口上边，依此类推
  return { top: s.right, right: s.bottom, bottom: s.left, left: s.top };
}

/* 屏幕坐标 → 游戏视口坐标（转了 90° 时要把 x/y 换过来） */
function screenToView(sx, sy) {
  if (MOBILE.rotated) return { x: sy, y: MOBILE.sw - sx };
  return { x: sx, y: sy };
}

/* 视口窄（手机竖屏）时"世界"会被整体缩小，这个比例由 10_camera.js 的
   worldZoom() 提供：布局（UI 热区）本身不缩放，所以这里用不到它。 */

/* ---------------- 强制横屏 ---------------- */
function initForceLandscape() {
  let saved = null;
  try { saved = localStorage.getItem(FORCE_LS_KEY); } catch (e) { saved = null; }
  MOBILE.forceLandscape = saved === '1';
}

function saveForceLandscape() {
  try { localStorage.setItem(FORCE_LS_KEY, MOBILE.forceLandscape ? '1' : '0'); } catch (e) { /* 隐私模式无所谓 */ }
}

async function setForceLandscape(on) {
  MOBILE.forceLandscape = !!on;
  saveForceLandscape();

  if (MOBILE.forceLandscape) {
    // 原生横屏：Android Chrome 支持，而且必须先进全屏（这个调用来自用户手势）
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        MOBILE.nativeLock = true;
      }
    } catch (e) {
      MOBILE.nativeLock = false;   // iOS Safari 等：退回画面旋转
    }
  } else {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
    try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen(); } catch (e) { /* ignore */ }
    MOBILE.nativeLock = false;
  }
  resize();
}

function toggleForceLandscape() { return setForceLandscape(!MOBILE.forceLandscape); }

/* ---------------- 尺寸 ---------------- */
function resize() {
  detectDevice();
  dpr = window.devicePixelRatio || 1;
  MOBILE.sw = canvas.clientWidth || window.innerWidth || 1;
  MOBILE.sh = canvas.clientHeight || window.innerHeight || 1;

  // 强制横屏 + 当前是竖屏 → 画面在画布内转 90°（原生旋转成功的机器不会走到这里）
  MOBILE.rotated = MOBILE.forceLandscape && MOBILE.sh > MOBILE.sw;

  W = MOBILE.rotated ? MOBILE.sh : MOBILE.sw;
  H = MOBILE.rotated ? MOBILE.sw : MOBILE.sh;

  canvas.width = Math.round(MOBILE.sw * dpr);
  canvas.height = Math.round(MOBILE.sh * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (MOBILE.rotated) {
    // 转完 (0,0)-(W,H) 正好铺满整块画布
    ctx.translate(MOBILE.sw, 0);
    ctx.rotate(Math.PI / 2);
  }

  groundY = Math.round(H * 0.74);
  readSafeArea();
  layoutUI();
}

/* ---------------- 按钮热区 ---------------- */
function layoutUI() {
  ui.unitButtons = [];
  ui.forceBtn = null;

  const safe = viewSafe();
  if (MOBILE.phone && H > W) layoutPhonePortrait(safe);
  else                       layoutWide(safe);

  layoutMenu(safe);
  layoutOrientToggle(safe);
}

/* 宽屏（PC / 平板 / 手机横屏）：底部一整排，整体缩放去适配宽度 */
function layoutWide(safe) {
  const LEFT_W = 4 * 96 + 3 * 12;      // 炮塔×3 + 技能
  const RIGHT_W = 162;                  // 升级基地
  const MID_W = 108 + 12 + 108 + 12 + 176;   // 近战 + 远程 + 骑兵（骑兵更宽）
  const want = 20 + LEFT_W + 24 + MID_W + 24 + RIGHT_W + 20;
  // 手机横屏这种很窄的情况允许缩得更狠一点，保证一排塞得下
  const s = clamp((W - safe.left - safe.right - 20) / want, 0.45, 1.25);

  const tSize = Math.round(96 * s);
  const tGap = Math.round(12 * s);
  const bh = Math.round(112 * s);
  const gap = Math.round(12 * s);
  const bw = Math.round(108 * s);      // 近战 / 远程
  const cw = Math.round(176 * s);      // 骑兵（横向 4 身位，按钮跟着拉长）
  const y = H - bh - 16 - safe.bottom;

  // 左边一组：炮塔 W/E/R + 技能
  const tX = safe.left + 20;
  const tY = H - tSize - 16 - safe.bottom;
  ui.turretSlots = [
    { slot: 2, x: tX,                      y: tY, w: tSize, h: tSize },  // W 后
    { slot: 1, x: tX + (tSize + tGap),     y: tY, w: tSize, h: tSize },  // E 中
    { slot: 0, x: tX + (tSize + tGap) * 2, y: tY, w: tSize, h: tSize },  // R 前
  ];
  ui.skillButton = { x: tX + (tSize + tGap) * 3, y: tY, w: tSize, h: tSize };

  // 右边：升级基地
  const ubW = Math.round(RIGHT_W * s);
  ui.upgradeButton = { x: W - safe.right - 20 - ubW, y, w: ubW, h: bh };
  ui.restartButton = { x: W / 2 - 90, y: H / 2 + 80, w: 180, h: 52 };

  // 中间：放在"左边一组"和"升级基地"之间的空档里居中
  const leftEnd = tX + LEFT_W * s;
  const rightStart = ui.upgradeButton.x;
  const ids = ERAS[game.playerEra].units;
  const midW = bw + gap + bw + gap + cw;
  const free = Math.max(midW, rightStart - leftEnd - 16);
  let x = leftEnd + (free - midW) / 2;

  for (const id of ids) {
    const isCav = UNIT_DB[id].isCavalry;
    const w = isCav ? cw : bw;
    ui.unitButtons.push({ id, x, y, w, h: bh });
    x += w + gap;
  }
}

/* 手机竖屏：底部改成三排（出兵 / 炮塔 / 技能+升级），热区都按手指来放大 */
function layoutPhonePortrait(safe) {
  const pad = safe.left + 10;                    // 左边距（含刘海）
  const innerW = Math.max(240, W - safe.left - safe.right - 20);
  const gap = 10;

  // 第一排（最下）：出兵，三个等宽按钮 —— 最常用的放最好按的位置
  const bh = Math.round(clamp(H * 0.135, 74, 124));
  const unitY = H - safe.bottom - 12 - bh;
  const bw = (innerW - gap * 2) / 3;
  const ids = ERAS[game.playerEra].units;
  ids.forEach((id, i) => {
    ui.unitButtons.push({ id, x: pad + i * (bw + gap), y: unitY, w: bw, h: bh });
  });

  // 第二排：炮塔 ×3（后 / 中 / 前，和宽屏同一顺序）
  const th = Math.round(clamp(H * 0.095, 54, 88));
  const row2Y = unitY - gap - th;
  const tw = (innerW - gap * 2) / 3;
  ui.turretSlots = [
    { slot: 2, x: pad,                     y: row2Y, w: tw, h: th },   // W 后
    { slot: 1, x: pad + tw + gap,          y: row2Y, w: tw, h: th },   // E 中
    { slot: 0, x: pad + (tw + gap) * 2,    y: row2Y, w: tw, h: th },   // R 前
  ];

  // 第三排：技能 + 升级基地
  const row3Y = row2Y - gap - th;
  const halfW = (innerW - gap) / 2;
  ui.skillButton =  { x: pad,                 y: row3Y, w: halfW, h: th };
  ui.upgradeButton = { x: pad + halfW + gap,  y: row3Y, w: halfW, h: th };

  ui.restartButton = { x: W / 2 - 90, y: H / 2 + 80, w: 180, h: 52 };
}

/* 难度菜单：竖屏竖着排，宽屏横着排（和以前一样） */
function layoutMenu(safe) {
  const ids = ['easy', 'normal', 'hard'];
  const labels = { easy: '简单', normal: '普通', hard: '困难' };

  if (H > W) {
    const bw = Math.min(W - safe.left - safe.right - 60, 300);
    const bh = 64, bgap = 16;
    const top = H * 0.38;
    const x = W / 2 - bw / 2;
    ui.menuButtons = ids.map((diff, i) => ({
      diff, label: labels[diff], x, y: top + i * (bh + bgap), w: bw, h: bh,
    }));
    ui.menuHintY = top + 3 * (bh + bgap) + 14;
  } else {
    const mbw = 170, mbh = 70, mgap = 24;
    const totalMW = mbw * 3 + mgap * 2;
    const startMX = W / 2 - totalMW / 2;
    const mby = H / 2 + 30;
    ui.menuButtons = ids.map((diff, i) => ({
      diff, label: labels[diff], x: startMX + i * (mbw + mgap), y: mby, w: mbw, h: mbh,
    }));
    // 和以前一样：提示语在 H/2 + 150（也就是 mby + mbh + 50）
    ui.menuHintY = mby + mbh + 50;
  }
}

/* 强制横屏开关：菜单/结算里是居中药丸，对局中是右上角小药丸 */
function layoutOrientToggle(safe) {
  if (!MOBILE.touch) return;
  if (game.started) {
    const w = 98, h = 32;
    ui.forceBtn = { x: W - safe.right - 14 - w, y: safe.top + 10, w, h };
  } else {
    const w = Math.min(W - safe.left - safe.right - 60, 250);
    const h = 46;
    // 竖屏放在提示语下面；横屏屏幕矮，就占提示语那一行的位置（横屏本来也不显示提示语）
    const y = H > W ? ui.menuHintY + 12 : Math.min(ui.menuHintY - 10, H - h - 16 - safe.bottom);
    ui.forceBtn = { x: W / 2 - w / 2, y, w, h };
  }
}


/* ---------------- 开始菜单 ---------------- */
function drawMenu() {
  const safe = viewSafe();
  const narrow = H > W;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0e1a33');
  g.addColorStop(1, '#1d2f55');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题：窄屏按宽度缩字号，别顶出屏幕
  const titlePx = Math.round(clamp((W - safe.left - safe.right - 40) / 5.4, 32, 64));
  const titleY = narrow ? Math.max(H * 0.20, safe.top + titlePx) : H / 2 - 130;
  const subY   = narrow ? titleY + Math.round(titlePx * 1.2) : H / 2 - 40;

  ctx.font = `bold ${titlePx}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(4, titlePx * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText('藤壶的入侵', W / 2, titleY);
  ctx.fillStyle = '#ffd94a';
  ctx.fillText('藤壶的入侵', W / 2, titleY);

  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText('选择难度', W / 2, subY);
  ctx.fillStyle = '#c6dcff';
  ctx.fillText('选择难度', W / 2, subY);

  for (const b of ui.menuButtons) {
    let accent = '#6eb4ff';
    if (b.diff === 'easy')   accent = '#7ee08a';
    if (b.diff === 'hard')   accent = '#ff8a7e';

    ctx.fillStyle = 'rgba(20,32,58,0.9)';
    roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    roundRect(b.x, b.y, b.w, b.h, 12);
    ctx.stroke();

    ctx.font = `bold ${Math.round(clamp(b.h * 0.34, 16, 24))}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + Math.round(b.h * 0.07));
  }

  // 提示语：触摸设备不用讲键盘快捷键（开关自己带说明）
  if (!MOBILE.touch || narrow) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#8898b0';
    const hint = MOBILE.touch
      ? '点难度开始（打开下方开关可以横过来玩）'
      : '点击难度开始（或按 1 / 2 / 3）';
    ctx.fillText(hint, W / 2, ui.menuHintY);
  }

  // 触摸设备：强制横屏开关
  drawOrientToggle();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* 强制横屏开关（只在触摸设备上出现；菜单里是居中药丸，对局里是右上角小药丸） */
function drawOrientToggle() {
  const b = ui.forceBtn;
  if (!b || !MOBILE.touch) return;
  if (b.y + b.h > H) return;      // 屏幕太矮就不画，别压住别的按钮

  const on = MOBILE.forceLandscape;
  const inGame = game.started;

  ctx.save();
  ctx.fillStyle = on ? 'rgba(30,60,40,0.92)' : 'rgba(24,32,48,0.92)';
  roundRect(b.x, b.y, b.w, b.h, b.h / 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = on ? 'rgba(120,230,150,0.95)' : 'rgba(140,200,255,0.75)';
  roundRect(b.x, b.y, b.w, b.h, b.h / 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${inGame ? 13 : 16}px system-ui, sans-serif`;
  ctx.fillStyle = on ? '#c0ffc8' : '#c6dcff';
  const label = inGame
    ? (on ? '⤡ 横屏开' : '⤢ 横屏关')
    : (on ? '强制横屏：开' : '强制横屏：关');
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* 在按钮上叠加阴影进度条 */
function drawButtonProgressMask(btn, progress) {
  if (progress <= 0) return;
  if (progress >= 1) return;
  const doneW = btn.w * progress;
  ctx.save();
  roundRect(btn.x, btn.y, btn.w, btn.h, 12);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(btn.x + doneW, btn.y, btn.w - doneW, btn.h);
  ctx.restore();
}

/* 炮塔/技能按钮左上角快捷键提示 */
function drawTurretHotkey(slot, label) {
  const kx = slot.x + 6;
  const ky = slot.y + 6;
  const kw = 22, kh = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(kx, ky, kw, kh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  roundRect(kx, ky, kw, kh, 4);
  ctx.stroke();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, kx + kw / 2, ky + kh / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* 出兵按钮左上角快捷键提示 */
function drawUnitHotkey(btn, idx) {
  const keys = ['Z', 'X', 'C'];
  const label = keys[idx];
  if (!label) return;
  const kx = btn.x + 6;
  const ky = btn.y + 6;
  const kw = 22, kh = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(kx, ky, kw, kh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  roundRect(kx, ky, kw, kh, 4);
  ctx.stroke();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, kx + kw / 2, ky + kh / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/* ---------------- 出兵按钮 / 升级按钮 / 结算界面 ---------------- */

/* 画"鲸元券图标 + 数量"（整体以 cx 居中）。没有图标就退回金币 emoji */
function drawTokenCost(text, cx, y, color, iconBoxW, iconBoxH) {
  const icon = ASSETS.tokenIcon;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (imgReady(icon)) {
    const d = fitSprite(icon, iconBoxW || 46, iconBoxH || 26);
    const tw = ctx.measureText(text).width;
    const x0 = cx - (d.w + 6 + tw) / 2;
    ctx.drawImage(icon, x0, y - d.h * 0.78, d.w, d.h);
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillText(text, x0 + d.w + 6, y);
    ctx.textAlign = 'center';
    return;
  }
  ctx.fillStyle = color;
  ctx.fillText('🪙' + text, cx, y);
}

function drawUI() {
  if (!game.started) { drawMenu(); return; }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 手机上整块 HUD 收紧（字号 ×hs），并把右上角让给「强制横屏」开关
  const hs = MOBILE.phone ? clamp(Math.min(W, H) / 620, 0.62, 1) : 1;
  const safe = viewSafe();
  // 手机上右上角被「强制横屏」开关占着，右侧那两行就挪到左上角 HUD 下面（不抢宽度）
  const pillBelow = MOBILE.phone && game.started && ui.forceBtn;
  const pillW = (!pillBelow && game.started && ui.forceBtn) ? ui.forceBtn.w + 12 : 0;
  const hudR = W - safe.right - 22 - pillW;

  // Token（图标是鲸元券）
  const goldPx = Math.round(32 * hs);
  const goldY = Math.round(safe.top + 14 + goldPx);
  ctx.font = `bold ${goldPx}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(3, Math.round(goldPx * 0.19));
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  const goldText = formatGold(game.gold);
  const tokenIcon = ASSETS.tokenIcon;
  if (imgReady(tokenIcon)) {
    const d = fitSprite(tokenIcon, Math.round(62 * hs), Math.round(36 * hs));
    ctx.drawImage(tokenIcon, 22, goldY - d.h * 0.78, d.w, d.h);
    ctx.strokeText(goldText, 22 + d.w + 9, goldY);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(goldText, 22 + d.w + 9, goldY);
  } else {
    const goldLabel = `🪙 ${goldText}`;
    ctx.strokeText(goldLabel, 22, goldY);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(goldLabel, 22, goldY);
  }

  // 我方版本
  const eraPx = Math.round(24 * hs);
  const eraY = goldY + Math.round(34 * hs);
  ctx.font = `bold ${eraPx}px system-ui, sans-serif`;
  const eraText = `我方版本：${PLAYER_BASE_NAMES[game.playerEra] || 'DeepSeek-V2'}`;
  ctx.lineWidth = Math.max(3, Math.round(eraPx * 0.2));
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(eraText, 22, eraY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(eraText, 22, eraY);

  // 视角提示（触摸设备提示"拖动画面"）
  const manualActive = keys.a || keys.d || MOBILE.panning;
  const hintPx = Math.round(16 * hs);
  ctx.font = `bold ${hintPx}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(3, Math.round(hintPx * 0.25));
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  const camText = manualActive
    ? '视角移动中…'
    : (MOBILE.touch ? '拖动画面移动视角' : '按 A / D 自由移动视角');
  const camY = eraY + Math.round(30 * hs);
  ctx.strokeText(camText, 22, camY);
  ctx.fillStyle = manualActive ? '#7ee0ff' : '#c8d4e0';
  ctx.fillText(camText, 22, camY);

  // 右上角：敌方形象 + 难度（难度动态左移，避免和敌方形象重叠）
  ctx.textAlign = 'right';
  const rightPx = Math.round(20 * hs);
  ctx.font = `bold ${rightPx}px system-ui, sans-serif`;
  const eText = `敌方形象：${ENEMY_BASE_NAMES[game.enemyEra] || '西装藤壶'}`;
  const eWidth = ctx.measureText(eText).width;
  const eY = pillBelow
    ? camY + Math.round(28 * hs)      // 手机上放到左上角 HUD 下面，和"我方版本"错开
    : safe.top + Math.round(40 * hs);
  ctx.lineWidth = Math.max(3, Math.round(rightPx * 0.25));
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(eText, hudR, eY);
  ctx.fillStyle = '#a8c8ff';
  ctx.fillText(eText, hudR, eY);

  const diffNames  = { easy: '简单', normal: '普通', hard: '困难' };
  const diffColors = { easy: '#7ee08a', normal: '#a8c8ff', hard: '#ff8a7e' };
  const dName  = diffNames[game.difficulty]  || '普通';
  const dColor = diffColors[game.difficulty] || '#a8c8ff';
  const dText  = '难度：' + dName;
  // 手机上是两行（都在开关下面），宽屏是同一行左移
  const dY = pillBelow ? eY + Math.round(26 * hs) : eY;
  const dX = pillBelow ? hudR : hudR - eWidth - 28;
  ctx.strokeText(dText, dX, dY);
  ctx.fillStyle = dColor;
  ctx.fillText(dText, dX, dY);
  ctx.textAlign = 'left';

  // ---------- 技能释放：屏幕中央大字 ----------
  if (game.skillAnnounce > 0) {
    const a = Math.min(1, game.skillAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(64 * hs)}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(4, Math.round(64 * hs * 0.16));
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText('现在是，梁文谷时刻！', W / 2, H * 0.32);
    ctx.fillStyle = '#7ee0ff';
    ctx.fillText('现在是，梁文谷时刻！', W / 2, H * 0.32);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 技能解锁提示 ----------
  if (game.skillUnlockAnnounce > 0) {
    const a = Math.min(1, game.skillUnlockAnnounce / 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(24 * hs)}px system-ui, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText('技能已解锁：梁文谷时刻（按 F 释放）', W / 2, H * 0.42);
    ctx.fillStyle = '#7ee0ff';
    ctx.fillText('技能已解锁：梁文谷时刻（按 F 释放）', W / 2, H * 0.42);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 基地可升级：左侧脉动提示 ----------
  const nextEraHint = game.playerEra + 1;
  if (nextEraHint < ERAS.length) {
    const needHint = [110, 100, 140, 150][nextEraHint - 1];
    const tokenHint = CONFIG.upgradeTokenCostByLevel[game.playerEra];
    if (game.upgradePoints >= needHint && game.gold >= tokenHint) {
      const a = 0.55 + 0.45 * Math.sin(game.time * 8);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(22 * hs)}px system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText('DeepSeek 可升级！', 24, H * 0.55);
      ctx.fillStyle = '#ffd94a';
      ctx.fillText('DeepSeek 可升级！', 24, H * 0.55);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  // ---------- 敌方升级：右侧提示 ----------
  if (game.enemyLevelAnnounce > 0) {
    const a = Math.min(1, game.enemyLevelAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(22 * hs)}px system-ui, sans-serif`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText('藤壶开始变异了！', W - 24, H * 0.55);
    ctx.fillStyle = '#ff8a7e';
    ctx.fillText('藤壶开始变异了！', W - 24, H * 0.55);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 奶鲸来袭：屏幕中上方提示 ----------
  if (game.whaleAnnounce > 0) {
    const a = Math.min(1, game.whaleAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(36 * hs)}px system-ui, sans-serif`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText('理中客奶鲸来了！！！', W / 2, H * 0.18);
    ctx.fillStyle = '#7ec8ff';
    ctx.fillText('理中客奶鲸来了！！！', W / 2, H * 0.18);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ---------- 出兵按钮 ----------
  for (let bi = 0; bi < ui.unitButtons.length; bi++) {
    const btn = ui.unitButtons[bi];
    const def = UNIT_DB[btn.id];

    if (def.isCavalry && !game.playerCavalryUnlocked) {
      const unlockCost = cavalryUnlockCost('player');
      const unlocking = isCavalryUnlocking('player');
      const canUnlock = !unlocking && game.gold >= unlockCost;

      ctx.fillStyle = 'rgba(25,20,15,0.9)';
      roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = (canUnlock || unlocking) ? 'rgba(255,200,80,0.9)' : 'rgba(120,100,60,0.6)';
      roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.stroke();

      if (unlocking) {
        const p = 1 - game.playerCavalryUnlockLeft / PLAYER_CAVALRY_UNLOCK_TIME;
        drawButtonProgressMask(btn, p);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lk = btn.h / 112;
      ctx.font = `bold ${Math.round(34 * lk)}px system-ui, sans-serif`;
      ctx.fillStyle = (canUnlock || unlocking) ? '#ffd94a' : '#8a7a55';
      ctx.fillText('🔒', btn.x + btn.w / 2, btn.y + Math.round(34 * lk));
      ctx.textBaseline = 'alphabetic';

      if (unlocking) {
        ctx.font = `bold ${Math.round(13 * lk)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffe08a';
        ctx.fillText('解锁中…', btn.x + btn.w / 2, btn.y + btn.h - Math.round(26 * lk));

        ctx.font = `bold ${Math.round(14 * lk)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffd94a';
        ctx.fillText(game.playerCavalryUnlockLeft.toFixed(1) + 's',
                     btn.x + btn.w / 2, btn.y + btn.h - Math.round(8 * lk));
      } else {
        ctx.font = `bold ${Math.round(13 * lk)}px system-ui, sans-serif`;
        ctx.fillStyle = canUnlock ? '#ffe08a' : '#8a7a55';
        ctx.fillText('解锁骑兵', btn.x + btn.w / 2, btn.y + btn.h - Math.round(26 * lk));

        ctx.font = `bold ${Math.round(14 * lk)}px system-ui, sans-serif`;
        drawTokenCost(formatGold(unlockCost), btn.x + btn.w / 2,
                      btn.y + btn.h - Math.round(8 * lk),
                      canUnlock ? '#ffd94a' : '#7a6a30',
                      Math.round(30 * lk), Math.round(17 * lk));
      }
      drawUnitHotkey(btn, bi);
      continue;
    }

    const cost = unitCostFor(btn.id, 'player');
    const canAfford = game.gold >= cost;
    const queueFull = spawnQueue.player.length >= CONFIG.maxQueue;
    const enabled = canAfford && !queueFull;

    ctx.fillStyle = enabled ? 'rgba(28,38,58,0.92)' : 'rgba(20,22,30,0.75)';
    roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = enabled ? 'rgba(110,200,255,0.9)' : 'rgba(90,90,100,0.6)';
    roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.stroke();

    // 按钮尺寸会跟着屏幕缩放，这里统一按"基准高 112"换算
    const k = btn.h / 112;

    // 骑兵立绘是横的（384×253），塞进步兵那个 36×48 的小盒子会只剩 36×24，
    // 文字先排好，贴图区域的上限要按文字顶部来算，避免压在一起
    const era = clamp(game.playerEra | 0, 0, 4);
    const tag = ERA_TAGS[era] || ('Lv.' + (era + 1));
    const padX = Math.round(8 * k);
    const maxTextW = btn.w - padX * 2;
    const setFont = (px) => { ctx.font = `bold ${px}px system-ui, sans-serif`; };

    // 优先一行 "V2 大肥鱼"；放不下就拆成两行（版本 / 兵种）并缩字号
    let namePx = Math.round(14 * k);
    let lines;
    setFont(namePx);
    const oneLine = tag + ' ' + def.name;
    if (ctx.measureText(oneLine).width <= maxTextW) {
      lines = [oneLine];
    } else {
      lines = [tag, def.name];
      const widest = () => Math.max(ctx.measureText(tag).width, ctx.measureText(def.name).width);
      while (widest() > maxTextW && namePx > 9) { namePx--; setFont(namePx); }
    }

    const lineH = Math.round(namePx * 1.12);
    const lastBaseY = btn.y + btn.h - Math.round(26 * k);
    const textTop = lastBaseY - (lines.length - 1) * lineH - namePx;

    // ---- 贴图（底边贴住文字上沿）----
    const isCav = def.isCavalry;
    const iconTop = btn.y + Math.round(10 * k);
    const iconAvail = Math.max(Math.round(22 * k), textTop - Math.round(4 * k) - iconTop);
    const iconMaxW = btn.w - padX * 2;
    const iconW = Math.min(Math.round((isCav ? 106 : 40) * k), iconMaxW);

    const img = firstReady(unitSpriteSetByType('player', btn.id).walk);
    if (imgReady(img)) {
      const d = fitSprite(img, iconW, iconAvail);
      ctx.drawImage(img, btn.x + btn.w / 2 - d.w / 2, iconTop + iconAvail - d.h, d.w, d.h);
    } else {
      const d = fitSprite({ naturalWidth: 1, naturalHeight: 1.4 }, iconW, iconAvail);
      const fx = btn.x + btn.w / 2 - d.w / 2;
      const fy = iconTop + iconAvail - d.h;
      ctx.fillStyle = def.color;
      ctx.fillRect(fx, fy, d.w, d.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.38)';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx + 1, fy + 1, d.w - 2, d.h - 2);
    }

    const spawnP = playerSpawnProgress(btn.id);
    if (spawnP > 0) {
      drawButtonProgressMask(btn, spawnP);
    }

    // ---- 士兵名（含等级版本标签）----
    ctx.textAlign = 'center';
    setFont(namePx);
    lines.forEach((txt, i) => {
      const y = lastBaseY - (lines.length - 1 - i) * lineH;
      // 版本标签用淡一点的颜色，兵种名保持原来的亮/灰
      ctx.fillStyle = (i === 0 && lines.length > 1)
        ? (enabled ? '#9fd0ff' : '#5c6b80')
        : (enabled ? '#ffffff' : '#888');
      ctx.fillText(txt, btn.x + btn.w / 2, y);
    });

    ctx.font = `bold ${Math.round(14 * k)}px system-ui, sans-serif`;
    drawTokenCost(formatGold(cost), btn.x + btn.w / 2, btn.y + btn.h - Math.round(8 * k),
                  enabled ? '#ffd94a' : '#7a6a30',
                  Math.round(31 * k), Math.round(17 * k));

    const qCount = queuedCount('player', btn.id);
    if (qCount > 0) {
      const br = Math.round(15 * k);
      const bx = btn.x + btn.w - br - 2;
      const by = btn.y + br + 2;

      ctx.fillStyle = '#ff5b4a';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(14 * k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(qCount, bx, by + 1);
      ctx.textBaseline = 'alphabetic';
    }

    drawUnitHotkey(btn, bi);
  }

  // ---------- 炮塔槽位 ----------
  if (ui.turretSlots) {
    for (const slot of ui.turretSlots) {
      drawTurretHotkey(slot, slot.slot === 2 ? 'W' : (slot.slot === 1 ? 'E' : 'R'));
      const built = !!game.turrets[slot.slot];
      const prevBuilt = slot.slot === 0 || !!game.turrets[slot.slot - 1];
      const cost = TURRET.slotCosts[slot.slot];
      const canAfford = game.gold >= cost;
      const canBuild = !built && prevBuilt && canAfford;

      ctx.fillStyle = built
        ? 'rgba(40,70,45,0.9)'
        : (canBuild ? 'rgba(28,38,58,0.92)' : 'rgba(20,22,30,0.75)');
      roundRect(slot.x, slot.y, slot.w, slot.h, 8);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = built
        ? 'rgba(120,220,120,0.9)'
        : (canBuild ? 'rgba(110,200,255,0.9)' : 'rgba(90,90,100,0.6)');
      roundRect(slot.x, slot.y, slot.w, slot.h, 8);
      ctx.stroke();

      if (game.turrets[slot.slot] && game.turrets[slot.slot].buildTimer > 0) {
        const bp = 1 - game.turrets[slot.slot].buildTimer / TURRET.buildTime;
        ctx.save();
        roundRect(slot.x, slot.y, slot.w, slot.h, 8);
        ctx.clip();
        ctx.fillStyle = 'rgba(100,180,255,0.35)';
        ctx.fillRect(slot.x, slot.y + slot.h * (1 - bp), slot.w, slot.h * bp);
        ctx.restore();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const tSlot = game.turrets[slot.slot];
      const maxLv = Math.min(TURRET.damages.length, game.playerEra + 1);

      if (tSlot && tSlot.buildTimer > 0) {
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#c6dcff';
        ctx.fillText('建造中', slot.x + slot.w / 2, slot.y + slot.h / 2 - 14);
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = '#7ec8ff';
        ctx.fillText(tSlot.buildTimer.toFixed(1) + 's', slot.x + slot.w / 2, slot.y + slot.h / 2 + 16);
      } else if (tSlot && tSlot.level < maxLv) {
        const upCost = TURRET.upgradeCosts[tSlot.level - 1];
        const canUp = game.gold >= upCost;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#e0e8f0';
        ctx.fillText('炮塔 Lv.' + tSlot.level, slot.x + slot.w / 2, slot.y + slot.h / 2 - 14);
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillStyle = canUp ? '#ffd94a' : '#665';
        ctx.fillText(formatGold(upCost), slot.x + slot.w / 2, slot.y + slot.h / 2 + 16);
      } else if (tSlot) {
        const atMax = tSlot.level >= TURRET.damages.length;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = '#a0ffa0';
        ctx.fillText('炮塔 Lv.' + tSlot.level, slot.x + slot.w / 2, slot.y + slot.h / 2 - 12);
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillStyle = atMax ? '#a0ffa0' : '#8ab8e0';
        ctx.fillText(atMax ? '满级' : '需升级基地', slot.x + slot.w / 2, slot.y + slot.h / 2 + 14);
      } else if (!prevBuilt) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('需先建前面的', slot.x + slot.w / 2, slot.y + slot.h / 2);
      } else {
        ctx.font = 'bold 36px system-ui, sans-serif';
        ctx.fillStyle = canBuild ? '#7ec8ff' : '#556';
        ctx.fillText('+', slot.x + slot.w / 2, slot.y + slot.h / 2 - 12);

        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = canBuild ? '#ffd94a' : '#665';
        ctx.fillText(formatGold(cost), slot.x + slot.w / 2, slot.y + slot.h / 2 + 20);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ---------- 技能按钮 ----------
  if (ui.skillButton) {
    const sb = ui.skillButton;
    const locked = game.playerEra < 1;
    const ready = !locked && game.skillCd <= 0 && game.skillTimer <= 0;
    const active = !locked && game.skillTimer > 0;
    const cooling = !locked && game.skillCd > 0 && game.skillTimer <= 0;

    ctx.fillStyle = active ? 'rgba(40,80,45,0.95)'
                  : ready  ? 'rgba(30,50,90,0.95)'
                           : 'rgba(20,22,30,0.8)';
    roundRect(sb.x, sb.y, sb.w, sb.h, 10);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = active ? 'rgba(120,255,140,0.95)'
                    : ready  ? 'rgba(120,200,255,0.95)'
                             : 'rgba(90,90,100,0.6)';
    roundRect(sb.x, sb.y, sb.w, sb.h, 10);
    ctx.stroke();

    if (cooling) {
      const p = 1 - game.skillCd / SKILL.cooldown;
      ctx.save();
      roundRect(sb.x, sb.y, sb.w, sb.h, 10);
      ctx.clip();
      ctx.fillStyle = 'rgba(80,140,255,0.22)';
      ctx.fillRect(sb.x, sb.y + sb.h * (1 - p), sb.w, sb.h * p);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (locked) {
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('🔒', sb.x + sb.w / 2, sb.y + sb.h / 2 - 14);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('Lv.2 解锁', sb.x + sb.w / 2, sb.y + sb.h / 2 + 16);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h - 12);
    } else if (active) {
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillStyle = '#c0ffc8';
      ctx.fillText('⚡', sb.x + sb.w / 2, sb.y + sb.h / 2 - 16);
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillStyle = '#c0ffc8';
      ctx.fillText(game.skillTimer.toFixed(1) + 's', sb.x + sb.w / 2, sb.y + sb.h / 2 + 18);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#c0ffc8';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h - 12);
    } else if (ready) {
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = '#7ec8ff';
      ctx.fillText('⚡', sb.x + sb.w / 2, sb.y + sb.h / 2 - 18);
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillStyle = '#c6dcff';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h / 2 + 22);
    } else {
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillStyle = '#8898b0';
      ctx.fillText(Math.ceil(game.skillCd) + 's', sb.x + sb.w / 2, sb.y + sb.h / 2 - 6);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('谷', sb.x + sb.w / 2, sb.y + sb.h - 12);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    drawTurretHotkey(sb, 'F');
  }

  // ---------- 升级基地 ----------
  const ub = ui.upgradeButton;
  if (ub) {
    const nextEra = game.playerEra + 1;
    const maxed = nextEra >= ERAS.length;
    const need = maxed ? 0 : [110, 100, 140, 150][nextEra - 1];
    const pts = game.upgradePoints;
    const tokenCost = maxed ? 0 : CONFIG.upgradeTokenCostByLevel[game.playerEra];
    const canUp = !maxed && pts >= need && game.gold >= tokenCost;

    ctx.fillStyle = maxed
      ? 'rgba(20,22,30,0.75)'
      : (canUp ? 'rgba(70,45,15,0.94)' : 'rgba(25,22,18,0.8)');
    roundRect(ub.x, ub.y, ub.w, ub.h, 12);
    ctx.fill();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = maxed
      ? 'rgba(90,90,100,0.6)'
      : (canUp ? 'rgba(255,200,80,0.95)' : 'rgba(120,100,60,0.6)');
    roundRect(ub.x, ub.y, ub.w, ub.h, 12);
    ctx.stroke();

    if (!maxed) {
      const p = clamp(pts / need, 0, 1);
      ctx.save();
      roundRect(ub.x, ub.y, ub.w, ub.h, 12);
      ctx.clip();
      ctx.fillStyle = canUp ? 'rgba(255,200,80,0.28)' : 'rgba(160,140,80,0.18)';
      ctx.fillRect(ub.x, ub.y + ub.h * (1 - p), ub.w, ub.h * p);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = maxed ? '#888' : (canUp ? '#ffe08a' : '#a89060');
    ctx.fillText(maxed ? '已达最高等级' : '升 级 基 地', ub.x + ub.w / 2, ub.y + 32);

    if (!maxed) {
      ctx.font = 'bold 12px system-ui, sans-serif';
      drawTokenCost(formatGold(tokenCost) + '  ' + Math.floor(pts) + '/' + need,
                    ub.x + ub.w / 2, ub.y + 55,
                    (game.gold >= tokenCost) ? '#ffd94a' : '#7a6a30', 26, 15);

      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = canUp ? '#cccccc' : '#666';
      ctx.fillText(`→ Lv.${nextEra + 1}`, ub.x + ub.w / 2, ub.y + 76);
    }

    drawTurretHotkey(ub, 'Q');
  }

  // ---------- 结算 ----------
  if (game.over) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 屏幕上方结果文案
    const won = game.winner === 'player';
    const enemyName = ENEMY_BASE_NAMES[game.enemyEra] || '西装藤壶';
    const resultText = won
      ? `成功打败${enemyName}！`
      : '再接再厉！下次一定可以！';
    const resultColor = won ? '#ffd94a' : '#ff8a7e';
    ctx.font = `bold ${Math.round(36 * hs)}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(4, Math.round(36 * hs * 0.19));
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(resultText, W / 2, H * 0.12);
    ctx.fillStyle = resultColor;
    ctx.fillText(resultText, W / 2, H * 0.12);

    // CG 图（胜利 / 战败）
    const cgH = Math.min(H * 0.52, 430);
    const cgW = Math.min(cgH * 1.05, W - 40);      // 竖屏时别超出屏幕
    const cgX = W / 2 - cgW / 2;
    const cgY = H * 0.24;
    const cg = won ? ASSETS.cgVictory : ASSETS.cgDefeat;

    if (imgReady(cg)) {
      const d = fitSprite(cg, cgW, cgH);
      ctx.drawImage(cg, W / 2 - d.w / 2, cgY + (cgH - d.h) / 2, d.w, d.h);
    } else {
      ctx.fillStyle = 'rgba(20,30,50,0.9)';
      ctx.fillRect(cgX, cgY, cgW, cgH);
      ctx.strokeStyle = 'rgba(140,200,255,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeRect(cgX, cgY, cgW, cgH);
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(160,200,240,0.55)';
      ctx.fillText('CG 图占位', W / 2, cgY + cgH / 2);
    }

    // 重开按钮（CG 下方）
    const rb = ui.restartButton;
    rb.y = cgY + cgH + 30;
    ctx.fillStyle = 'rgba(60,80,120,0.95)';
    roundRect(rb.x, rb.y, rb.w, rb.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#8ccfff';
    ctx.lineWidth = 2.5;
    roundRect(rb.x, rb.y, rb.w, rb.h, 12);
    ctx.stroke();

    ctx.font = `bold ${Math.round(20 * hs)}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('再 来 一 局', W / 2, rb.y + 34);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 触摸设备：右上角「强制横屏」开关画在最上层（对局、结算界面都点得到）
  drawOrientToggle();
}

/* ---------------- 重开 ---------------- */
function restart() {
  game.started = true;
  startBgm();
  game.gold = CONFIG.startGold;
  game.enemyGold = CONFIG.enemyStartGold;
  game.goldTick = 0;
  game.upgradePoints = 0;
  game.enemyTimeShift = 0;
  game.playerEra = 0;
  game.enemyEra = 0;
  game.playerCavalryUnlocked = false;
  game.enemyCavalryUnlocked = false;
  game.playerCavalryUnlockLeft = 0;
  game.enemyCavalryUnlockLeft = ENEMY_CAVALRY_UNLOCK_TIME;
  game.units.length = 0;
  game.projectiles.length = 0;
  game.particles.length = 0;
  game.floatTexts.length = 0;
  game.whales.length = 0;
  game.whaleTimer = rand(WHALE.intervalMin, WHALE.intervalMax);
  game.turrets = [null, null, null];
  game.enemyTurretCd = 0;
  game.skillCd = 0;
  game.skillTimer = 0;
  game.skillAnnounce = 0;
  game.skillUnlockAnnounce = 0;
  game.enemyLevelAnnounce = 0;
  game.enemyEraFlash = 0;
  game.whaleAnnounce = 0;
  game.time = 0;
  game.over = false;
  game.winner = null;

  spawnQueue.player.length = 0;
  spawnQueue.enemy.length = 0;
  spawnOrderCounter = 0;

  resetBases();
  resetAI();

  camX = 0;
  keys.a = false;
  keys.d = false;
  gameSpeed = 1;

  layoutUI();
}

/* ---------------- 启动：设备判定 + 监听屏幕变化 ---------------- */
detectDevice();
initForceLandscape();

// 手机旋转、地址栏收起、进/出全屏都要重算布局（同一帧里的多次触发合并成一次）
let resizePending = false;
function scheduleResize() {
  if (resizePending) return;
  resizePending = true;
  const run = () => { resizePending = false; resize(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else run();
}

window.addEventListener('orientationchange', scheduleResize);
if (window.visualViewport && window.visualViewport.addEventListener) {
  window.visualViewport.addEventListener('resize', scheduleResize);
}
document.addEventListener('fullscreenchange', scheduleResize);
if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.addEventListener) {
  screen.orientation.addEventListener('change', scheduleResize);
}
// 长按不要弹系统菜单（手机上会盖住按钮）
canvas.addEventListener('contextmenu', (e) => e.preventDefault());