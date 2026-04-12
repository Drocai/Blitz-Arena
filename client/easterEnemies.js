/**
 * Easter Arcade – Enemy System
 * Defines enemy types, AI behaviors, spawning logic.
 * Each enemy type forces a different player response.
 */

const EasterEnemies = (function () {
  let _nextId = 0;

  function spawnEnemy(type, arenaW, arenaD, playerX, playerZ) {
    const cfg = EASTER.ENEMIES[type];
    if (!cfg) return null;

    // Spawn from random arena edge, away from player
    const pos = _pickEdgeSpawn(arenaW, arenaD, playerX, playerZ);

    return {
      id: _nextId++,
      type: type,
      x: pos.x,
      z: pos.z,
      hp: cfg.hp,
      maxHp: cfg.hp,
      speed: cfg.speed,
      radius: cfg.radius,
      score: cfg.score,
      color: cfg.color,
      behavior: cfg.behavior,
      alive: true,
      spawnTime: performance.now(),

      // Behavior state
      shieldHp: cfg.shieldHits || 0,
      shielded: cfg.behavior === 'shielded' ? true : false,
      ambushState: cfg.behavior === 'ambush' ? 'idle' : null,
      ambushTimer: 0,
      lungeDir: { x: 0, z: 0 },
      zigzagOffset: Math.random() * Math.PI * 2,
      stolenCombo: false,
    };
  }

  function _pickEdgeSpawn(arenaW, arenaD, playerX, playerZ) {
    const hw = arenaW / 2 - 1;
    const hd = arenaD / 2 - 1;
    let bestX, bestZ, bestDist = 0;

    // Try several random edge positions, pick furthest from player
    for (let i = 0; i < 5; i++) {
      let x, z;
      const side = Math.floor(Math.random() * 4);
      switch (side) {
        case 0: x = -hw; z = (Math.random() * 2 - 1) * hd; break; // left
        case 1: x = hw; z = (Math.random() * 2 - 1) * hd; break;  // right
        case 2: x = (Math.random() * 2 - 1) * hw; z = -hd; break; // top
        case 3: x = (Math.random() * 2 - 1) * hw; z = hd; break;  // bottom
      }
      const dist = Math.hypot(x - playerX, z - playerZ);
      if (dist > bestDist) {
        bestDist = dist;
        bestX = x;
        bestZ = z;
      }
    }
    return { x: bestX, z: bestZ };
  }

  function updateEnemy(enemy, dt, playerX, playerZ, arenaW, arenaD, now) {
    if (!enemy.alive) return;

    const cfg = EASTER.ENEMIES[enemy.type];
    const hw = arenaW / 2 - 0.5;
    const hd = arenaD / 2 - 0.5;

    switch (enemy.behavior) {
      case 'zigzag':
        _updateZigzag(enemy, dt, playerX, playerZ, cfg, now);
        break;
      case 'shielded':
        _updateShielded(enemy, dt, playerX, playerZ);
        break;
      case 'thief':
        _updateThief(enemy, dt, playerX, playerZ);
        break;
      case 'ambush':
        _updateAmbush(enemy, dt, playerX, playerZ, cfg, now);
        break;
      default:
        _moveToward(enemy, dt, playerX, playerZ, enemy.speed);
    }

    // Clamp to arena
    enemy.x = Math.max(-hw, Math.min(hw, enemy.x));
    enemy.z = Math.max(-hd, Math.min(hd, enemy.z));
  }

  function _moveToward(enemy, dt, tx, tz, speed) {
    const dx = tx - enemy.x;
    const dz = tz - enemy.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) {
      enemy.x += (dx / dist) * speed * dt;
      enemy.z += (dz / dist) * speed * dt;
    }
  }

  // Chick: fast zig-zag movement toward player
  function _updateZigzag(enemy, dt, px, pz, cfg, now) {
    const dx = px - enemy.x;
    const dz = pz - enemy.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;

    const dirX = dx / dist;
    const dirZ = dz / dist;

    // Perpendicular for zig-zag
    const perpX = -dirZ;
    const perpZ = dirX;
    const t = (now / 1000) * cfg.zigzagFreq + enemy.zigzagOffset;
    const zigzag = Math.sin(t) * cfg.zigzagAmp;

    const moveX = dirX + perpX * zigzag * 0.3;
    const moveZ = dirZ + perpZ * zigzag * 0.3;
    const moveDist = Math.hypot(moveX, moveZ);

    enemy.x += (moveX / moveDist) * enemy.speed * dt;
    enemy.z += (moveZ / moveDist) * enemy.speed * dt;
  }

  // Golden Egg: slow tank, moves toward player. Shield absorbs first N hits.
  function _updateShielded(enemy, dt, px, pz) {
    _moveToward(enemy, dt, px, pz, enemy.speed);
  }

  // Basket Thief: beelines toward player, steals combo/powerup on contact
  function _updateThief(enemy, dt, px, pz) {
    _moveToward(enemy, dt, px, pz, enemy.speed);
  }

  // Jack Rabbit: idle then lunge
  function _updateAmbush(enemy, dt, px, pz, cfg, now) {
    if (enemy.ambushState === 'idle') {
      enemy.ambushTimer += dt * 1000;
      if (enemy.ambushTimer >= cfg.idleTime) {
        // Start lunge toward player
        enemy.ambushState = 'lunging';
        enemy.ambushTimer = 0;
        const dx = px - enemy.x;
        const dz = pz - enemy.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          enemy.lungeDir = { x: dx / dist, z: dz / dist };
        }
      }
    } else if (enemy.ambushState === 'lunging') {
      enemy.ambushTimer += dt * 1000;
      enemy.x += enemy.lungeDir.x * cfg.lungeSpeed * dt;
      enemy.z += enemy.lungeDir.z * cfg.lungeSpeed * dt;
      if (enemy.ambushTimer >= cfg.lungeDuration) {
        enemy.ambushState = 'idle';
        enemy.ambushTimer = 0;
      }
    }
  }

  // Returns true if enemy dies
  function damageEnemy(enemy, damage) {
    if (!enemy.alive) return false;

    if (enemy.shielded && enemy.shieldHp > 0) {
      enemy.shieldHp -= damage;
      if (enemy.shieldHp <= 0) {
        enemy.shielded = false;
      }
      return false;
    }

    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      return true;
    }
    return false;
  }

  // Generate wave enemies based on wave number
  function generateWave(waveNum, arenaW, arenaD, playerX, playerZ, modifier) {
    const baseCount = EASTER.WAVE_BASE_ENEMIES;
    let count = Math.min(
      Math.floor(baseCount * Math.pow(EASTER.WAVE_ENEMY_SCALE, waveNum - 1)),
      EASTER.WAVE_MAX_ENEMIES
    );

    if (modifier && modifier.effect && modifier.effect.enemyCountMult) {
      count = Math.floor(count * modifier.effect.enemyCountMult);
    }

    const enemies = [];
    const types = _getTypesForWave(waveNum);

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const enemy = spawnEnemy(type, arenaW, arenaD, playerX, playerZ);
      if (enemy) {
        // Scale HP with wave number (mild)
        const hpScale = 1 + (waveNum - 1) * 0.08;
        enemy.hp = Math.ceil(enemy.hp * hpScale);
        enemy.maxHp = enemy.hp;
        if (enemy.shielded) {
          enemy.shieldHp = Math.ceil(EASTER.ENEMIES[type].shieldHits * hpScale);
        }
        enemies.push(enemy);
      }
    }

    return enemies;
  }

  function _getTypesForWave(wave) {
    // Gradually introduce enemy types
    if (wave <= 1) return ['chick'];
    if (wave <= 2) return ['chick', 'chick', 'jack_rabbit'];
    if (wave <= 3) return ['chick', 'chick', 'jack_rabbit', 'basket_thief'];
    if (wave <= 4) return ['chick', 'jack_rabbit', 'basket_thief', 'golden_egg'];
    // After wave 4, all types with increasing variety
    return ['chick', 'chick', 'jack_rabbit', 'jack_rabbit', 'basket_thief', 'golden_egg', 'golden_egg'];
  }

  return {
    spawnEnemy,
    updateEnemy,
    damageEnemy,
    generateWave,
  };
})();
