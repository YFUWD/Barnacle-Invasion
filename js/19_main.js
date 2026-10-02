/* =========================================================
   19 启动 + 主循环
   ---------------------------------------------------------
   固定步长在 11_update.js，这里只负责：
     算 dt → 走 update → 画一帧 → 下一帧
   ========================================================= */

let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;

  // 切标签页回来时 dt 会很大，夹住避免一帧穿模
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;

  update(dt * gameSpeed);
  render();

  requestAnimationFrame(loop);
}

/* ---------------- 启动 ---------------- */
loadAssets();       // 异步，加载不出来就用程序绘制的占位图形
resize();           // 会顺带 layoutUI()
requestAnimationFrame(loop);
