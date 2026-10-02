/* =========================================================
   01 基础配置 / 画布 / 素材槽位
   ---------------------------------------------------------
   世界坐标从 0 到 CONFIG.worldWidth，相机 camX 决定看哪一段。
   基地等级越高能造的兵越强（ERAS / UNIT_DB 见 05_units.js）。

   坐标全部沿用原型：
     - 地图 3000 宽，中间白色区 720（1140~1860）
     - 左右两段各 1140，基地往里推到 240 / 2760
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/* ---------------- 视口 / 地面 ---------------- */
let W = 0;          // CSS 像素宽（逻辑宽）
let H = 0;          // CSS 像素高（逻辑高）
let groundY = 0;    // 地面线的屏幕 y
let dpr = 1;        // devicePixelRatio

/* ---------------- 世界配置 ---------------- */
const CONFIG = {
  worldWidth: 3000,     // ★ 3600 → 3000
  pinkEnd: 1140,        // ★ 1440 → 1140（左粉宽度）
  whiteEnd: 1860,       // ★ 2160 → 1860（1140 + 720）
  playerBaseX: 162.5,   // ★ 240 → 162.5（基地左缘贴世界左边界 0，面向敌方的右缘保持 325）
  enemyBaseX: 2837.5,   // ★ 2760 → 2837.5（基地右缘贴世界右边界 3000，面向我方的左缘保持 2675）
  goldRate: 26,                 // 已废弃（保留兼容）
  startGold: 30000,             // 双方初始 Token（30K）
  enemyStartGold: 30000,        // 与玩家同步
  goldPerTick: 1000,            // 每 tick 获得 1000 Token（双方共用）
  goldTickInterval: 0.2,        // tick 间隔（秒）
  // 我方每次升级额外消耗的 Token（按当前等级索引 0~4）
  upgradeTokenCostByLevel: [50000, 100000, 150000, 150000, 300000],
  // 我方每次升级额外消耗的 Token（按当前等级索引 0~4）
  upgradeTokenCostByLevel: [50000, 100000, 150000, 150000, 300000],
  baseHp: 1000,                                  // = baseHpByEra[0]
  baseHpByEra: [1000, 2000, 3500, 5500, 8000],   // 各等级基地最大血量

  // 难度：只影响敌方单位的攻击力与生命值
  difficultyScale: { easy: 0.8, normal: 1.0, hard: 1.1 },

  // 敌方财富倍率：按"难度 → 等级索引 0~4"（Lv.1~Lv.5）
  // 普通难度 Lv.5 从 1.2 砍到 0.7：那一级敌人钱多到只会攒钱出骑兵，
  // 5 分钟一个步兵都不出（实测），所以干脆掐它的钱袋子。
  enemyWealthByDifficulty: {
    easy:   [0.9, 1.0, 1.1, 1.2, 1.2],
    normal: [0.9, 1.0, 1.1, 1.2, 0.7],
    hard:   [0.9, 1.0, 1.1, 1.2, 1.2],
  },

  // 普通难度：敌方 Lv.5 骑兵再单独削一档（hp / dmg 各乘一个系数）
  // 3000 血 / 300 伤 → 2100 血 / 210 伤（我方自己的 Lv.5 骑兵不受影响）
  normalLv5CavalryNerf: { hp: 0.7, dmg: 0.7 },

  // 简单模式：我方 Lv.5 的攻击力与生命值补偿（后期不至于打不动）
  easyPlayerLv5Buff: 1.2,

  // 难度：敌方升级时间加成（秒，按目标等级索引 0~4）
  // 简单难度下每级分别延后 0 / 10 / 20 / 20 / 20 秒
  difficultyUpgradeBonus: {
    easy:   [0, 10, 20, 20, 20],
    normal: [0, 0, 0, 0, 0],
    hard:   [0, 0, 0, 0, 0],
  },
  camSpeed: 950,
  spawnDelay: 1.0,
  maxQueue: 10,
};

// 敌方基地自动升级的时间点（秒），对应 ERAS[0..4]。
// Lv.2 +20、Lv.3 +40、Lv.4 +30，Lv.5 不变
const ENEMY_LEVEL_TIMES = [0, 140, 240, 360, 510];

// 士兵之间的最小间距（软阻挡用）
const BODY = { gap: 16 };

// 炮塔（玩家建筑，最多 2 个，在基地门口上方）
const TURRET = {
  maxCount: 2,
  slotCosts: [100000, 300000, 600000],   // 第 1 个 100K，第 2 个 300K，第 3 个 600K（第二个的两倍）
  w: 60,
  h: 90,
  range: 660,                    // 以基地为中心的半径（440 × 1.5）
  damages: [10, 20, 30, 40, 50], // 按炮塔自身等级 Lv.1~5
  atkCd: 1.0,
  projSpeed: 700,
  projColor: '#ffd76a',
  projSize: 6,
  buildTime: 10,                                 // 建造耗时（秒）
  upgradeCosts: [100000, 200000, 350000, 600000], // 炮塔 Lv.1→2 / 2→3 / 3→4 / 4→5
};

// 奶鲸事件（随机砸下的大蓝方块）
const WHALE = {
  intervalMin: 40,     // 出现间隔下限（秒）
  intervalMax: 70,     // 出现间隔上限（秒）
  countMin: 1,         // 每次出现数量下限
  countMax: 3,         // 每次出现数量上限
  w: 180,              // 宽度（约 3 个骑兵）
  h: 130,              // 高度
  fallSpeed: 1500,     // 下落速度（px/s）
  stayTime: 0.5,       // 落地后完整显示的时间（秒）
  fadeTime: 0.5,       // 淡出时间（秒）
  dmgPercent: 0.6,     // 伤害 = 最大生命 × 0.6
  dmgFlat: 20,         // 再 +20
};

// 我方技能：梁文（谷）时段
const SKILL = {
  cooldown: 120,       // 冷却时间（秒）
  duration: 20,        // 生效时间（秒）
  discount: 0.5,       // 士兵价格乘数（5 折）
};

/* ---------------- 双方基地名称（按等级索引 0~4）---------------- */
const PLAYER_BASE_NAMES = [
  'DeepSeek-V2',
  'DeepSeek-R1',
  'DeepSeek-V4.0 Pro',
  'DeepSeek-V4.1 Flash',
  'DeepSeek Harness',
];
const ENEMY_BASE_NAMES = [
  '西装藤壶',
  '三唐神海',
  '离钟毛蓝',
  '君子瓶251',
  '炫彩西装藤壶',
];

/* 我方等级的短标签：出兵按钮上显示成 "V2 大肥鱼" 这样 */
const ERA_TAGS = ['V2', 'R1', 'Pro', 'Flash', 'Harness'];

/* ---------------- 三段地形的配色 ---------------- */
const COLORS = {
  left:      '#2f6fb8',
  leftTop:   '#4a90d9',
  leftStripe:'#e8f2ff',
  white:     '#f2f2f4',
  whiteTop:  '#ffffff',
  right:     '#1f4d8a',
  rightTop:  '#3568a8',
  rightStripe:'#12161c',
};

/* 背景压暗滤镜：铺在"天空 + 地形"之上、单位之下，所以画面暗一点、
   角色和 UI 依然是亮的。设成 null 就完全关掉。 */
const BG_DIM = 'rgba(58,62,74,0.20)';

/* ---------------- 素材槽位 ---------------- */
// 全部为 null 也能正常玩：所有绘制函数都有程序绘制的占位图形。
// 图片放在 素材/ 下，文件名写在 03_assets.js 的 ASSET_FILES 里。
//
// 两条约定：
//   · era = 0~4 就是 Lv.1~Lv.5（和 ERAS 的索引一致）
//   · 立绘一律"朝右"。drawUnit 会对 dir < 0 的阵营做水平镜像，
//     所以敌人那张朝右的图，画出来正好朝左（面向我方）。
const ASSETS = {
  sky: null,                                       // 天空整图（省略则程序绘制）
  terrain: { pink: null, white: null, red: null }, // 三段地形贴图（repeat）

  // 基地立绘，按等级索引。我方 Lv.1/Lv.2 留空，只有方块 + 程序绘制外观
  bases: {
    player: [null, null, null, null, null],
    enemy:  [null, null, null, null, null],
  },

  units: {
    // 玩家步兵：蓝发（Lv.1~4）与黑发（Lv.5）各一套走路 4 帧，共用一张受伤帧
    soldier:  { walk: [], hurt: null },
    soldier5: { walk: [], hurt: null },
    cavalry:  null,                 // 玩家骑兵（鲸鱼娘骑用户）
    cavalry5: null,                 // 玩家骑兵 Lv.5（黑发 Harness 骑手，鲸鱼不变）
    // 敌方兵种，按等级索引
    enemyMelee:   [],               // 近战：藤壶 #01
    enemyRanged:  [],               // 远程：藤壶 #02
    enemyCavalry: [],               // 骑兵：龟龟（按等级染色）+ 背上藤壶
  },

  weapons: {
    playerMelee: [],                // 木 / 石 / 铁 / 钻石 / 下界合金剑，按等级
    playerBow:   [],                // 拉弓 4 帧
    enemyPencil: [],                // 藤壶铅笔，按等级
  },

  projectiles: {
    arrow: null,                    // 玩家箭矢（Lv.1~4）
    spectral: null,                 // 光灵箭（Lv.5）
    pencil: [],                     // 敌方投掷的铅笔，按等级
  },

  // 炮塔立绘 + 炮塔发射的子弹
  turrets: {
    player: null,                   // 我方炮塔（萌鲸鱼）
    playerShot: null,               // 我方炮塔子弹（深度思考图标）
    enemy: [],                      // 敌方炮塔（6 号藤壶），按等级
    enemyShot: [],                  // 敌方炮塔子弹（更小的 6 号藤壶），按等级
  },

  whale: null,                      // 奶鲸事件立绘
  tokenIcon: null,                  // Token 图标（鲸元券）
  skillBg: null,                    // 技能「梁文谷时刻」背景
  cgVictory: null,                  // 胜利 CG（结算界面）
  cgDefeat: null,                   // 战败 CG（结算界面）
};
