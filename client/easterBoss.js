/**
 * Easter Arcade – Boss Encounter System
 * Multi-phase boss with distinct attack patterns.
 * Boss appears every BOSS_EVERY waves and scales with each appearance.
 */

const EasterBoss = (function () {
  let _projId = 100000;

  function createBoss(bossCount, arenaW, arenaD) {
    const cfg = EASTER.BOSS;
    const hp = cfg.baseHp + cfg.hpScale * (bossCount - 1);

    return {
      id: 'boss',
      type: 'boss',
      x: 0,
      z: -(arenaD / 2 - 3),
      hp: hp,
      maxHp: hp,
      speed: cfg.speed,
      radius: cfg.radius,
      score: cfg.score + (bossCount - 1) * 200,
      color: cfg.color,
      alive: true,
      bossCount: bossCount,

      // Phase tracking
      phase: 0,
      phaseTimer: 0,
      moveAngle: 0,
      fireTimer: 0,
      summonTimer: 0,

      // Circle strafe center
      orbitCenterX: 0,
      orbitCenterZ: 0,
      orbitRadius: 6,

      // Arena shrink
      arenaShrink: 0,

      // Defeat state
      defeated: false,
      defeatTimer: 0,
    };
  }

  function getCurrentPhase(boss) {
    const hpPercent = boss.hp / boss.maxHp;
    const phases = EASTER.BOSS.phases;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (hpPercent <= phases[i].hpPercent) {
        return i;
      }
    }
    return 0;
  }

  function updateBoss(boss, dt, playerX, playerZ, arenaW, arenaD, now) {
    if (!boss.alive) return { projectiles: [], summons: [] };

    const newPhase = getCurrentPhase(boss);
    const phaseChanged = newPhase !== boss.phase;
    boss.phase = newPhase;

    const phaseCfg = EASTER.BOSS.phases[boss.phase];
    const result = { projectiles: [], summons: [], phaseChanged: phaseChanged };

    // Arena shrink in enrage
    boss.arenaShrink = phaseCfg.arenaShrinK || 0;

    // Update movement
    switch (phaseCfg.pattern) {
      case 'circle_strafe':
        _circleStrafe(boss, dt, playerX, playerZ, arenaW, arenaD);
        break;
      case 'summon_and_fire':
        _summonAndFire(boss, dt, playerX, playerZ, arenaW, arenaD);
        // Summon adds periodically
        boss.summonTimer += dt * 1000;
        if (boss.summonTimer >= 4000) {
          boss.summonTimer = 0;
          result.summons = _generateSummons(phaseCfg.summonCount, arenaW, arenaD, playerX, playerZ);
        }
        break;
      case 'enrage':
        _enrageMove(boss, dt, playerX, playerZ, arenaW, arenaD);
        boss.summonTimer += dt * 1000;
        if (boss.summonTimer >= 3000) {
          boss.summonTimer = 0;
          result.summons = _generateSummons(phaseCfg.summonCount, arenaW, arenaD, playerX, playerZ);
        }
        break;
    }

    // Fire projectiles
    boss.fireTimer += dt * 1000;
    if (boss.fireTimer >= phaseCfg.fireRate) {
      boss.fireTimer = 0;
      result.projectiles = _firePattern(boss, playerX, playerZ, phaseCfg);
    }

    // Clamp boss to arena
    const hw = arenaW / 2 - boss.radius - boss.arenaShrink;
    const hd = arenaD / 2 - boss.radius - boss.arenaShrink;
    boss.x = Math.max(-hw, Math.min(hw, boss.x));
    boss.z = Math.max(-hd, Math.min(hd, boss.z));

    return result;
  }

  function _circleStrafe(boss, dt, px, pz, arenaW, arenaD) {
    boss.moveAngle += dt * 1.2;
    boss.orbitCenterX += (px - boss.orbitCenterX) * dt * 0.3;
    boss.orbitCenterZ += (pz - boss.orbitCenterZ) * dt * 0.3;
    boss.x = boss.orbitCenterX + Math.cos(boss.moveAngle) * boss.orbitRadius;
    boss.z = boss.orbitCenterZ + Math.sin(boss.moveAngle) * boss.orbitRadius;
  }

  function _summonAndFire(boss, dt, px, pz, arenaW, arenaD) {
    boss.moveAngle += dt * 1.5;
    boss.orbitCenterX += (px - boss.orbitCenterX) * dt * 0.4;
    boss.orbitCenterZ += (pz - boss.orbitCenterZ) * dt * 0.4;
    boss.orbitRadius = 5;
    boss.x = boss.orbitCenterX + Math.cos(boss.moveAngle) * boss.orbitRadius;
    boss.z = boss.orbitCenterZ + Math.sin(boss.moveAngle) * boss.orbitRadius;
  }

  function _enrageMove(boss, dt, px, pz) {
    // Aggressive chase toward player
    const dx = px - boss.x;
    const dz = pz - boss.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 2) {
      boss.x += (dx / dist) * boss.speed * 1.5 * dt;
      boss.z += (dz / dist) * boss.speed * 1.5 * dt;
    }
  }

  function _firePattern(boss, px, pz, phaseCfg) {
    const projectiles = [];
    const cfg = EASTER.BOSS;
    const dx = px - boss.x;
    const dz = pz - boss.z;
    const baseAngle = Math.atan2(dz, dx);

    for (let i = 0; i < phaseCfg.projCount; i++) {
      const spread = (i - (phaseCfg.projCount - 1) / 2) * phaseCfg.projSpread;
      const angle = baseAngle + spread;
      projectiles.push({
        id: _projId++,
        ownerId: 'boss',
        x: boss.x,
        z: boss.z,
        vx: Math.cos(angle) * cfg.projSpeed,
        vz: Math.sin(angle) * cfg.projSpeed,
        radius: cfg.projRadius,
        damage: cfg.projDamage,
        createdAt: performance.now(),
        lifetime: 3000,
        color: '#9B59B6',
      });
    }
    return projectiles;
  }

  function _generateSummons(count, arenaW, arenaD, px, pz) {
    const summons = [];
    for (let i = 0; i < count; i++) {
      const enemy = EasterEnemies.spawnEnemy('chick', arenaW, arenaD, px, pz);
      if (enemy) summons.push(enemy);
    }
    return summons;
  }

  function damageBoss(boss, damage) {
    if (!boss.alive) return false;
    boss.hp -= damage;
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.alive = false;
      boss.defeated = true;
      return true;
    }
    return false;
  }

  return {
    createBoss,
    updateBoss,
    damageBoss,
    getCurrentPhase,
  };
})();
