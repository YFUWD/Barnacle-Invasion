/* =========================================================
   06 基地
   ========================================================= */

const bases = {
  player: {
    x: CONFIG.playerBaseX, w: 325, h: 230,
    hp: CONFIG.baseHp, maxHp: CONFIG.baseHp,
    team: 'player', isBase: true, dead: false, hitFlash: 0,
  },
  enemy: {
    x: CONFIG.enemyBaseX, w: 325, h: 230,
    hp: CONFIG.baseHp, maxHp: CONFIG.baseHp,
    team: 'enemy', isBase: true, dead: false, hitFlash: 0,
  },
};

/* 基地挨打 / 打没了都在这里结算（applyDamage 见 08_combat.js） */
function damageBase(base, dmg, fromTeam) {
  if (base.dead) return;
  // 前三级基地受到的伤害 -50%
  const era = base.team === 'player' ? game.playerEra : game.enemyEra;
  if (era < 3) dmg *= 0.5;
  // 简单难度：我方基地受到的伤害额外 -30%（×0.7）
  if (game.difficulty === 'easy' && base.team === 'player') dmg *= 0.7;
  base.hp -= dmg;
  base.hitFlash = 0.13;
  if (base.hp <= 0) {
    base.hp = 0;
    base.dead = true;
    endGame(fromTeam);
  }
}

/* 把基地恢复到开局状态（重开用） */
function resetBases() {
  const baseHp = CONFIG.baseHpByEra[0];
  for (const b of [bases.player, bases.enemy]) {
    b.maxHp = baseHp;
    b.hp = baseHp;
    b.dead = false;
    b.hitFlash = 0;
  }
}
