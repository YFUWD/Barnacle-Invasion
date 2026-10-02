/* =========================================================
   03 素材加载
   ---------------------------------------------------------
   把 素材/ 里的美术挂到 01_config.js 的 ASSETS 槽位上。
   加载是异步的：图没就绪时 imgReady() 返回 false，
   所有绘制函数会自动退回程序绘制的占位图形，绝不会报错。

   注意：图片不存在（404）也不影响游戏 —— 浏览器只是保持槽位原值。

   命名约定：
     · 立绘一律朝右（drawUnit 对 dir<0 的阵营做镜像，敌人因此朝左）
     · 带 _1.._5 后缀的按等级索引（1 = Lv.1）
     · 素材由 _tools/build_assets.py 从 藤壶的入侵素材库/ 生成，别手工改名
   ========================================================= */

const ASSET_DIR = '素材/';

/* 每个槽位对应的文件；结构和 ASSETS 一一对应，加素材只要往这里加一行。
   null = 该等级没有立绘，绘制函数会退回程序绘制的占位图形 */
const ASSET_FILES = {
  sky:     'sky.png',
  terrain: { pink: 'terrain_pink.png', white: 'terrain_white.png', red: 'terrain_red.png' },

  // 基地立绘（按等级；我方 Lv.1/Lv.2 没有立绘）
  bases: {
    player: [null, null, 'base_player_3.png', 'base_player_4.png', 'base_player_5.png'],
    enemy:  ['base_enemy_1.png', 'base_enemy_2.png', 'base_enemy_3.png',
             'base_enemy_4.png', 'base_enemy_5.png'],
  },

  units: {
    // 玩家步兵：走路 4 帧 + 受伤帧（蓝发 Lv.1~4 / 黑发 Lv.5）
    soldier:  { walk: ['unit_player_soldier_walk1.png', 'unit_player_soldier_walk2.png',
                       'unit_player_soldier_walk3.png', 'unit_player_soldier_walk4.png'],
                hurt: 'unit_player_soldier_hurt.png' },
    soldier5: { walk: ['unit_player_soldier5_walk1.png', 'unit_player_soldier5_walk2.png',
                       'unit_player_soldier5_walk3.png', 'unit_player_soldier5_walk4.png'],
                hurt: 'unit_player_soldier_hurt.png' },
    cavalry:  'unit_player_cavalry.png',
    cavalry5: 'unit_player_cavalry5.png',

    // 敌方兵种：按等级（1 = Lv.1）
    enemyMelee:   ['unit_enemy_melee_1.png', 'unit_enemy_melee_2.png', 'unit_enemy_melee_3.png',
                   'unit_enemy_melee_4.png', 'unit_enemy_melee_5.png'],
    enemyRanged:  ['unit_enemy_ranged_1.png', 'unit_enemy_ranged_2.png', 'unit_enemy_ranged_3.png',
                   'unit_enemy_ranged_4.png', 'unit_enemy_ranged_5.png'],
    enemyCavalry: ['unit_enemy_cavalry_1.png', 'unit_enemy_cavalry_2.png', 'unit_enemy_cavalry_3.png',
                   'unit_enemy_cavalry_4.png', 'unit_enemy_cavalry_5.png'],
  },

  weapons: {
    playerMelee: ['weapon_player_melee_1.png', 'weapon_player_melee_2.png', 'weapon_player_melee_3.png',
                  'weapon_player_melee_4.png', 'weapon_player_melee_5.png'],
    playerBow:   ['weapon_player_bow_0.png', 'weapon_player_bow_1.png',
                  'weapon_player_bow_2.png', 'weapon_player_bow_3.png'],
    enemyPencil: ['weapon_enemy_pencil_1.png', 'weapon_enemy_pencil_2.png', 'weapon_enemy_pencil_3.png',
                  'weapon_enemy_pencil_4.png', 'weapon_enemy_pencil_5.png'],
  },

  projectiles: {
    arrow:    'proj_player_arrow.png',
    spectral: 'proj_player_spectral.png',
    pencil:   ['proj_enemy_pencil_1.png', 'proj_enemy_pencil_2.png', 'proj_enemy_pencil_3.png',
               'proj_enemy_pencil_4.png', 'proj_enemy_pencil_5.png'],
  },

  // 炮塔立绘 + 炮塔子弹
  turrets: {
    player:     'turret_player.png',
    playerShot: 'proj_turret_player.png',
    enemy:     ['turret_enemy_1.png', 'turret_enemy_2.png', 'turret_enemy_3.png',
                'turret_enemy_4.png', 'turret_enemy_5.png'],
    enemyShot: ['proj_turret_enemy_1.png', 'proj_turret_enemy_2.png', 'proj_turret_enemy_3.png',
                'proj_turret_enemy_4.png', 'proj_turret_enemy_5.png'],
  },

  whale:     'whale_event.png',
  tokenIcon: 'token_icon.png',
  skillBg:   'skill_bg.png',
  cgVictory: 'cg_victory.png',
  cgDefeat:  'cg_defeat.png',
};

function imgReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

/* 加载失败过的素材（重试后仍然失败才记进来）。
   排查"某个兵种变成色块"时，在控制台敲 __assetFailures 就能看到是哪几张图。
   天空/地形这 4 张本来就允许没有（会程序绘制），不算失败，免得清单里全是噪音。 */
const ASSET_LOAD_FAILURES = [];
const OPTIONAL_ASSETS = ['sky.png', 'terrain_pink.png', 'terrain_white.png', 'terrain_red.png'];
if (typeof window !== 'undefined') window.__assetFailures = ASSET_LOAD_FAILURES;

/* 从一串图里挑第一张已经加载好的（没有就返回 null） */
function firstReady(list) {
  if (!list) return null;
  for (const img of list) { if (imgReady(img)) return img; }
  return null;
}

/* 建一张图并挂到槽位；onload 后槽位保持这张图，onerror 时回退为 null。
   失败会重试一次（带时间戳绕开缓存）—— 手机网络抖一下、
   或者刚部署完 CDN 还没同步时，一次失败不该让这个兵种整局都是色块。 */
function loadInto(slot, owner, key, src, retried) {
  const img = new Image();
  img.onload  = () => { owner[key] = img; };
  img.onerror = () => {
    if (retried) {
      owner[key] = null;
      const base = src.split('/').pop().split('?')[0];
      if (OPTIONAL_ASSETS.indexOf(base) < 0) ASSET_LOAD_FAILURES.push(src);
      return;
    }
    const sep = src.indexOf('?') >= 0 ? '&' : '?';
    loadInto(slot, owner, key, src + sep + 'r=' + Date.now(), true);
  };
  img.src = src;
  slot[key] = img;          // 先挂着，绘制函数用 imgReady 判断是否可用
}

/* 加载一组同构槽位（数组对数组，对象对对象） */
function loadTree(files, slot) {
  if (Array.isArray(files)) {
    files.forEach((f, i) => {
      if (!f) { slot[i] = null; return; }
      loadInto(slot, slot, i, ASSET_DIR + f);
    });
  } else {
    for (const k of Object.keys(files)) {
      const f = files[k];
      if (f === null || f === undefined) { slot[k] = null; continue; }
      if (typeof f === 'string') loadInto(slot, slot, k, ASSET_DIR + f);
      else loadTree(f, slot[k]);
    }
  }
}

function loadAssets() {
  loadTree(ASSET_FILES, ASSETS);
}
