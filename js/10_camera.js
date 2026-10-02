/* =========================================================
   10 自由视角相机
   ---------------------------------------------------------
   按住 A / D 才动，松手就停在原地（不会自动跟兵）；
   触屏则是在画面空白处按住拖动（见 18_input.js 的 dragPan）。
   手机竖屏时整个"世界"会被缩小（见下面的 worldZoom），
   否则 390px 宽的屏幕只看得到 390 世界像素，等于没法玩。
   ========================================================= */

/* 手机竖屏时把世界缩小，保证至少看得见这么多世界像素宽。
   数值越小 = 画面越大（基地/立绘越大）。480 是手机上"基地够大、
   又不至于只能看到两个兵"的折中值。
   只有手机布局会缩 —— 电脑和平板（MOBILE.phone = false）返回 1，
   一点都不会变。 */
const WORLD_MIN_VIEW = 480;
function worldZoom() {
  if (!(W > 0)) return 1;
  if (!MOBILE.phone) return 1;          // 电脑端：不缩放，保持原样
  return clamp(W / WORLD_MIN_VIEW, 0.55, 1);
}

function maxCameraX() {
  // 世界缩小了 z 倍，所以可见的世界宽度是 W / z，而不是 W
  return Math.max(0, CONFIG.worldWidth - W / worldZoom());
}

function updateCamera(dt) {
  if (!keys.a && !keys.d) return;

  let dir = 0;
  if (keys.a) dir -= 1;
  if (keys.d) dir += 1;

  camX = clamp(camX + dir * CONFIG.camSpeed * dt, 0, maxCameraX());
}

/* 小地图 / 边缘提示用：把世界坐标换成屏幕坐标 */
function worldToScreen(x) {
  return x - camX;
}
