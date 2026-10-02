/* =========================================================
   10 自由视角相机
   ---------------------------------------------------------
   按住 A / D 才动，松手就停在原地（不会自动跟兵）。
   ========================================================= */

function maxCameraX() {
  return Math.max(0, CONFIG.worldWidth - W);
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
