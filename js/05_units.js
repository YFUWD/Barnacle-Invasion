/* =========================================================
   05 兵种数据表 / 基地等级
   ---------------------------------------------------------
   等级（ERAS）：升级基地才能解锁下一级的两个兵种。
     Lv.1 近战 + 远程 …… Lv.5 最强
   数值全部沿用原型，未做任何调整。
   ========================================================= */

const ERAS = [
  { level: 1, cost: 0,       units: ['club', 'sling',     'cavalry1'] },
  { level: 2, cost: 300000,  units: ['spear', 'bow',      'cavalry2'] },
  { level: 3, cost: 550000,  units: ['sword', 'crossbow', 'cavalry3'] },
  { level: 4, cost: 800000,  units: ['knight', 'musketeer','cavalry4'] },
  { level: 5, cost: 1050000, units: ['rifleman', 'cannon','cavalry5'] },
];

/* 根据兵种 id 反查所属等级索引（0~3） */
function getEraIndexByType(typeId) {
  for (let i = 0; i < ERAS.length; i++) {
    if (ERAS[i].units.includes(typeId)) return i;
  }
  return 0;
}

/* ---------------- 立绘查询 ---------------- */

/* 字段说明：
     cost  花费        hp 血量      dmg 单次伤害   range 射程（像素）
     atkCd 攻击间隔(s)  speed 移动速度  w/h 碰撞盒尺寸
     melee true = 近战（贴脸打），false = 远程（发射投射物）
     projSpeed / projColor / projSize / splash 仅远程兵种使用

   w 是"碰撞盒宽度"，也是单位之间的最小间距的一半来源（见 unitMinDist）。
   它现在按立绘画出来的宽度取（步兵立绘 ≈94px、骑兵 ≈300px），
   这样挤在一起时立绘刚好贴住、不会糊成一团；近战射程会自动跟着放宽
   （见 11_update.js 的 contactDist），所以不用另外调 range。
*/
const UNIT_DB = {
  // 大肥鱼：中价，主抗线。HP 最高，1v1 能赢弓手
  club:     { name:'大肥鱼', cost:35,  hp:250,  dmg:20, range:50, atkCd:1.0, speed:65, w:84, h:100, color:'#8b5a2b', melee:true },
  spear:    { name:'大肥鱼', cost:85,  hp:400,  dmg:30, range:50, atkCd:1.0, speed:65, w:84, h:100, color:'#b07a3c', melee:true },
  sword:    { name:'大肥鱼', cost:170, hp:600,  dmg:45, range:50, atkCd:1.0, speed:65, w:84, h:100, color:'#9aa0a8', melee:true },
  knight:   { name:'大肥鱼', cost:380, hp:850,  dmg:65, range:50, atkCd:1.0, speed:65, w:84, h:100, color:'#c8cdd4', melee:true },
  rifleman: { name:'大肥鱼', cost:700, hp:1200, dmg:90, range:50, atkCd:1.0, speed:65, w:84, h:100, color:'#4f6b4a', melee:true },

  // 身寸鲸鲸：中价，主后方输出。脆皮，靠射程输出
  sling:    { name:'身寸鲸鲸', cost:55,  hp:80,  dmg:40,  range:320, atkCd:1.5, speed:60, w:84, h:100, color:'#a9784a', melee:false, projSpeed:340,  projColor:'#8d8d8d', projSize:5 },
  bow:      { name:'身寸鲸鲸', cost:120, hp:130, dmg:55,  range:350, atkCd:1.5, speed:60, w:84, h:100, color:'#c09050', melee:false, projSpeed:580,  projColor:'#e0c890', projSize:4 },
  crossbow: { name:'身寸鲸鲸', cost:230, hp:200, dmg:75,  range:390, atkCd:1.5, speed:60, w:84, h:100, color:'#8f8f9a', melee:false, projSpeed:720,  projColor:'#cfd6dd', projSize:5 },
  musketeer:{ name:'身寸鲸鲸', cost:420, hp:300, dmg:100, range:440, atkCd:1.5, speed:60, w:84, h:100, color:'#7a5c3c', melee:false, projSpeed:950,  projColor:'#ffd76a', projSize:5 },
  cannon:   { name:'身寸鲸鲸', cost:900, hp:420, dmg:135, range:480, atkCd:1.5, speed:60, w:84, h:100, color:'#3a3a44', melee:false, projSpeed:1100, projColor:'#ffe08a', projSize:6 },

  // 鲸小子骑士：纯近战，无投射物；横向 4 身位（立绘 ≈300px 宽，所以碰撞盒也放宽）
  // 近战为主，但也能远程攻击（伤害减半）。
  // rangedRange = 440：即使前方隔着一个友方骑兵（中心距 256），
  // 仍能打到友方骑兵前面一个骑兵身位（256）处的敌人（256+256=512 > 440，
  // 所以 5 级那种需要贴更近；这是沿用原型的取值，只把碰撞盒跟着立绘改了）。
  cavalry1: { name:'鲸小子骑士', cost:0, hp:600,  dmg:60,  range:50, atkCd:1.5, speed:65, w:240, h:100, color:'#7a5c3c', melee:true, isCavalry:true, rangedRange:440, projSpeed:600, projColor:'#e0c890', projSize:6 },
  cavalry2: { name:'鲸小子骑士', cost:0, hp:900,  dmg:90,  range:50, atkCd:1.5, speed:65, w:240, h:100, color:'#8a6a4a', melee:true, isCavalry:true, rangedRange:440, projSpeed:600, projColor:'#e0c890', projSize:6 },
  cavalry3: { name:'鲸小子骑士', cost:0, hp:1350, dmg:135, range:50, atkCd:1.5, speed:65, w:240, h:100, color:'#9a8a6a', melee:true, isCavalry:true, rangedRange:440, projSpeed:600, projColor:'#cfd6dd', projSize:6 },
  cavalry4: { name:'鲸小子骑士', cost:0, hp:2000, dmg:200, range:50, atkCd:1.5, speed:65, w:240, h:100, color:'#b0a890', melee:true, isCavalry:true, rangedRange:440, projSpeed:600, projColor:'#ffd76a', projSize:6 },
  cavalry5: { name:'鲸小子骑士', cost:0, hp:3000, dmg:300, range:50, atkCd:1.5, speed:65, w:240, h:100, color:'#7a6a4a', melee:true, isCavalry:true, rangedRange:440, projSpeed:600, projColor:'#ffe08a', projSize:6 },
};

/* ---------------- 立绘查询 ----------------
   放在这一层是因为要用到上面的 ERAS / UNIT_DB / getEraIndexByType，
   而 check.mjs 要求"用到的函数必须在更早的文件里定义"。 */

/* 某个单位该用哪套立绘：{ walk: [img...], hurt: img|null }
   玩家步兵按等级分蓝（Lv.1~4）/ 黑（Lv.5）两套；敌方按等级取对应颜色的藤壶 */
function unitSpriteSet(u) {
  const era = clamp(u.era | 0, 0, 4);
  if (u.team === 'player') {
    // 骑兵：鲸鱼（用户）一直是蓝的，只有背上的大肥鱼 5 级换成黑发 Harness
    if (u.def.isCavalry) {
      return { walk: [era >= 4 ? ASSETS.units.cavalry5 : ASSETS.units.cavalry], hurt: null };
    }
    const set = era >= 4 ? ASSETS.units.soldier5 : ASSETS.units.soldier;
    return { walk: set.walk, hurt: set.hurt };
  }
  if (u.def.isCavalry) return { walk: [ASSETS.units.enemyCavalry[era]], hurt: null };
  const img = u.def.melee ? ASSETS.units.enemyMelee[era] : ASSETS.units.enemyRanged[era];
  return { walk: [img], hurt: null };
}

/* 出兵按钮上那张小图标：不带单位实例，只按阵营 + 兵种 id 查 */
function unitSpriteSetByType(team, typeId) {
  const def = UNIT_DB[typeId];
  return unitSpriteSet({ team, def, era: getEraIndexByType(typeId) });
}
