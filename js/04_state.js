/* =========================================================
   04 全局状态
   ---------------------------------------------------------
   只放"数据"，不放逻辑：状态被 05~11 的模块读写，
   渲染模块（12~17）只读它。
   ========================================================= */

/* ---------------- 相机 ---------------- */
let camX = 0;

/* ---------------- 游戏速度（隐藏功能：按 2 = 2 倍速，按 3 = 10 倍速） ---------------- */
let gameSpeed = 1;

/* ---------------- 键盘 ---------------- */
const keys = { a: false, d: false };

/* ---------------- 出兵队列 ---------------- */
// 每项：{ typeId, readyAt }  readyAt === null 表示还没排到计时起点
let spawnOrderCounter = 0;
const spawnQueue = { player: [], enemy: [] };

/* ---------------- 主体游戏状态 ---------------- */
const game = {
  started: false,                    // 是否已从菜单进入对局
  difficulty: 'normal',              // 难度：'easy' | 'normal' | 'hard'
  gold: CONFIG.startGold,            // 我方 Token
  enemyGold: CONFIG.enemyStartGold,  // 敌方金币（AI 花）
  goldTick: 0,                       // 我方 Token 计时累计器（每 0.2 秒 +1000）
  upgradePoints: 0,                  // 我方升级点数（每 1 秒 +1，击杀敌人 +1，每级需 90）
  enemyTimeShift: 0,                 // 敌方升级时间偏移（负值 = 提前升级）
  playerEra: 0,                  // 我方基地等级索引（0 = Lv.1）
  enemyEra: 0,                   // 敌方基地等级索引
  units: [],                     // 双方单位（基地不在这个数组里，见 06_base.js）
  projectiles: [],               // 飞行物
  particles: [],                 // 粒子
  floatTexts: [],                // 飘字（击杀奖励提示等）
  whales: [],                    // 奶鲸（下落事件）
  whaleTimer: rand(WHALE.intervalMin, WHALE.intervalMax),   // 距下次奶鲸事件的剩余秒数
  turrets: [null, null, null],   // 玩家炮塔（3 个槽位，未建为 null）
  enemyTurretCd: 0,              // 敌方炮塔攻击冷却
  skillCd: 0,                    // 技能剩余冷却（秒）
  skillTimer: 0,                 // 技能剩余生效时间（秒）
  skillAnnounce: 0,              // 技能释放大字提示剩余时间（秒）
  skillUnlockAnnounce: 0,        // 技能解锁提示剩余时间（秒）
  enemyLevelAnnounce: 0,         // 敌方升级提示剩余时间（秒）
  enemyEraFlash: 0,              // 敌方升级时"右侧远景闪新形象"的剩余时间（秒）
  whaleAnnounce: 0,              // 奶鲸来袭提示剩余时间（秒）
  playerCavalryUnlocked: false,  // 我方骑兵是否已解锁（每次升级重置）
  enemyCavalryUnlocked: false,   // 敌方骑兵是否已解锁（每次升级重置）
  playerCavalryUnlockLeft: 0,    // 我方骑兵解锁剩余秒数（>0 表示正在解锁）
  enemyCavalryUnlockLeft: 0,     // 敌方骑兵解锁剩余秒数（>0 表示正在解锁）
  time: 0,                       // 本局已进行秒数
  over: false,
  winner: null,                  // 'player' | 'enemy'
};

/* ---------------- UI 热区 ---------------- */
// 由 17_ui.js 的 layoutUI() 每次 resize / 升级时重算
const ui = { unitButtons: [], upgradeButton: null, restartButton: null };
