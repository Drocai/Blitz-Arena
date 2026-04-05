/**
 * Easter Arcade – Core Game Engine
 * Manages game loop, state machine, collision, input, spawning, scoring.
 * Runs entirely client-side — no server game logic.
 */

const EasterGame = (function () {
  // --- State ---
  let gameState = 'prerun'; // prerun | countdown | playing | wave_clear | boss_warning | gameover
  let player = null;
  let enemies = [];
  let projectiles = [];
  let enemyProjectiles = [];
  let powerups = [];
  let boss = null;
  let bossCount = 0;

  // Wave tracking
  let waveNum = 0;
  let waveTimer = 0;

  // Combo
  let comboCount = 0;
  let comboTimer = 0;
  let comboWindow = EASTER.COMBO_WINDOW;

  // Score & coins
  let score = 0;
  let runCoins = 0;
  let enemiesKilledRun = 0;
  let bossesKilledRun = 0;

  // Active power-up
  let activePowerup = null; // { type, expiresAt }

  // Modifier
  let selectedModifier = null;
  let modifierEffects = { coinMultiplier: 1, enemyCountMult: 1, scoreMult: 1, powerupDropMult: 1, comboRateMult: 1 };

  // Missions
  let currentMissions = [];
  let missionTracker = null;

  // Upgrade effects
  let upgradeEffects = { pickupRadiusMult: 1, projSpeedMult: 1, comboWindowBonus: 0, startingShield: false };

  // Input state
  const keys = {};
  let mouseX = 0, mouseZ = 0;
  let mouseDown = false;
  let spaceDown = false;
  let aimAngle = 0;

  // Timing
  let lastTime = 0;
  let nextProjId = 0;
  let lastFireTime = 0;

  // --- Init ---
  function init() {
    EasterProgress.load();

    EasterRenderer.init('easter-canvas');

    EasterUI.init({
      onStartGame: startRun,
      onSelectModifier: function (modId) {
        const mod = EASTER.MODIFIERS.find(function (m) { return m.id === modId; });
        selectedModifier = mod || null;
      },
    });

    // Input listeners
    window.addEventListener('keydown', function (e) {
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ' || e.code === 'Space') { spaceDown = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', function (e) {
      keys[e.key.toLowerCase()] = false;
      if (e.key === ' ' || e.code === 'Space') spaceDown = false;
    });

    const canvas = document.getElementById('easter-canvas');
    canvas.addEventListener('mousemove', function (e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseZ = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      aimAngle = Math.atan2(mouseX, -mouseZ);
    });
    canvas.addEventListener('mousedown', function () { mouseDown = true; });
    canvas.addEventListener('mouseup', function () { mouseDown = false; });

    showPreRun();
    requestAnimationFrame(gameLoop);
  }

  function showPreRun() {
    gameState = 'prerun';
    currentMissions = EasterMissions.pickMissions(EASTER.MISSIONS_PER_RUN);
    const modifiers = EasterMissions.getUnlockedModifiers();
    selectedModifier = modifiers.length > 0 ? modifiers[0] : null;
    EasterUI.showPreRun(currentMissions, modifiers, selectedModifier);
  }

  function startRun() {
    // Reset everything
    EasterRenderer.cleanup();

    upgradeEffects = EasterProgress.getUpgradeEffects();
    comboWindow = EASTER.COMBO_WINDOW + upgradeEffects.comboWindowBonus;

    player = {
      x: 0, z: 5,
      rotation: 0,
      hp: EASTER.PLAYER_MAX_HP,
      maxHp: EASTER.PLAYER_MAX_HP,
      invulnUntil: 0,
      hasShield: upgradeEffects.startingShield,
    };

    enemies = [];
    projectiles = [];
    enemyProjectiles = [];
    powerups = [];
    boss = null;
    bossCount = 0;
    waveNum = 0;
    comboCount = 0;
    comboTimer = 0;
    score = 0;
    runCoins = 0;
    enemiesKilledRun = 0;
    bossesKilledRun = 0;
    activePowerup = null;
    lastFireTime = 0;

    modifierEffects = { coinMultiplier: 1, enemyCountMult: 1, scoreMult: 1, powerupDropMult: 1, comboRateMult: 1 };
    if (selectedModifier && selectedModifier.effect) {
      Object.assign(modifierEffects, selectedModifier.effect);
    }

    missionTracker = EasterMissions.createTracker(currentMissions);

    EasterUI.hidePreRun();
    EasterUI.hideGameOver();
    EasterUI.updateScore(0);
    EasterUI.updateHP(player.hp, player.maxHp);
    EasterUI.updateCombo(0, 0, comboWindow);
    EasterUI.updateCoins(EasterProgress.getData().easterCoins);
    EasterUI.hideBossBar();
    EasterUI.hideVignette();
    EasterUI.updateMissionsHud(currentMissions);

    // Start countdown
    gameState = 'countdown';
    EasterUI.showCenterMessage('3', '', 1000);
    setTimeout(function () { EasterUI.showCenterMessage('2', '', 1000); }, 1000);
    setTimeout(function () { EasterUI.showCenterMessage('1', '', 1000); }, 2000);
    setTimeout(function () {
      EasterUI.showCenterMessage('GO!', '', 800);
      gameState = 'playing';
      nextWave();
    }, 3000);
  }

  // --- Wave Management ---
  function nextWave() {
    waveNum++;
    EasterMissions.onWaveStart(missionTracker);

    const newEnemies = EasterEnemies.generateWave(waveNum, EASTER.ARENA_WIDTH, EASTER.ARENA_DEPTH, player.x, player.z, selectedModifier);
    for (const e of newEnemies) {
      enemies.push(e);
      EasterRenderer.addEnemy(e);
    }

    EasterUI.updateWave(waveNum);
    EasterUI.showCenterMessage('Wave ' + waveNum, '', 1500);

    // Check badge
    if (waveNum >= 10) EasterProgress.awardBadge('wave_10');
    if (waveNum >= 20) EasterProgress.awardBadge('wave_20');
  }

  function onWaveCleared() {
    // Wave clear bonus
    const bonus = 100 * waveNum;
    score += bonus;
    EasterRenderer.spawnFloatingText(player.x, player.z, '+' + bonus + ' CLEAR!', '#50C878');
    EasterUI.updateScore(score);

    EasterMissions.onWaveCleared(missionTracker, waveNum);
    EasterMissions.onScoreUpdate(missionTracker, score);
    EasterUI.updateMissionsHud(currentMissions);

    // Check if next wave is boss
    if ((waveNum + 1) % EASTER.BOSS_EVERY === 0) {
      gameState = 'wave_clear';
      waveTimer = 1500;
    } else {
      gameState = 'wave_clear';
      waveTimer = EASTER.WAVE_PREP_TIME;
    }
  }

  function spawnBoss() {
    bossCount++;
    boss = EasterBoss.createBoss(bossCount, EASTER.ARENA_WIDTH, EASTER.ARENA_DEPTH);
    EasterRenderer.addEnemy(boss);
    EasterUI.showBossBar(EASTER.BOSS.name, 1);
    EasterMissions.onBossStart(missionTracker);
    EasterUI.showCenterMessage(EASTER.BOSS.name, 'Phase 1', 2000);
    gameState = 'playing';
    waveNum++;
    EasterMissions.onWaveStart(missionTracker);
  }

  // --- Projectiles ---
  function fireProjectile() {
    const now = performance.now();
    let cooldown = EASTER.FIRE_COOLDOWN;
    if (activePowerup && activePowerup.type === 'rapid_fire') cooldown /= 2;

    if (now - lastFireTime < cooldown) return;
    lastFireTime = now;

    const speed = EASTER.PROJECTILE_SPEED * upgradeEffects.projSpeedMult;
    const isTriple = activePowerup && activePowerup.type === 'triple_egg';
    const spreads = isTriple ? [-0.25, 0, 0.25] : [0];
    const color = EasterProgress.getSelectedEggColor();

    for (const spread of spreads) {
      const angle = aimAngle + spread;
      const proj = {
        id: nextProjId++,
        x: player.x,
        z: player.z,
        vx: Math.sin(angle) * speed,
        vz: -Math.cos(angle) * speed,
        radius: EASTER.PROJECTILE_RADIUS,
        createdAt: now,
        lifetime: EASTER.PROJECTILE_LIFETIME,
        color: color,
      };
      projectiles.push(proj);
      EasterRenderer.addProjectile(proj);
    }
  }

  // --- Power-ups ---
  function tryDropPowerup(x, z, forceGuaranteed) {
    let chance = EASTER.POWERUP_DROP_CHANCE * modifierEffects.powerupDropMult;
    if (!forceGuaranteed && Math.random() > chance) return;

    const types = Object.keys(EASTER.POWERUPS);
    const weights = types.map(function (t) { return EASTER.POWERUPS[t].dropWeight; });
    const totalWeight = weights.reduce(function (a, b) { return a + b; }, 0);
    let r = Math.random() * totalWeight;
    let chosenType = types[0];
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosenType = types[i]; break; }
    }

    const pu = {
      id: nextProjId++,
      type: chosenType,
      x: x,
      z: z,
      color: EASTER.POWERUPS[chosenType].color,
      name: EASTER.POWERUPS[chosenType].name,
      createdAt: performance.now(),
      radius: 0.4 * upgradeEffects.pickupRadiusMult,
    };
    powerups.push(pu);
    EasterRenderer.addPowerup(pu);
  }

  function collectPowerup(pu) {
    if (pu.type === 'shield') {
      player.hasShield = true;
    } else {
      activePowerup = {
        type: pu.type,
        expiresAt: performance.now() + EASTER.POWERUPS[pu.type].duration,
      };
    }
    EasterProgress.trackPowerupType(pu.type);
    EasterMissions.onPowerupCollected(missionTracker);
    EasterRenderer.spawnCollectEffect(pu.x, pu.z, pu.color);
    EasterRenderer.spawnFloatingText(pu.x, pu.z, pu.name + '!', pu.color);
    EasterUI.updateMissionsHud(currentMissions);

    // Check all_powerups badge
    const data = EasterProgress.getData();
    if (data.powerupTypesCollected.length >= Object.keys(EASTER.POWERUPS).length) {
      EasterProgress.awardBadge('all_powerups');
    }
  }

  // --- Damage & Collision ---
  function damagePlayer(amount) {
    const now = performance.now();
    if (now < player.invulnUntil) return;

    if (player.hasShield) {
      player.hasShield = false;
      player.invulnUntil = now + EASTER.INVULN_DURATION;
      EasterRenderer.spawnHitParticles(player.x, player.z, '#00CED1', 8);
      return;
    }

    player.hp -= amount;
    player.invulnUntil = now + EASTER.INVULN_DURATION;
    EasterMissions.onDamageTaken(missionTracker);
    EasterRenderer.spawnHitParticles(player.x, player.z, '#FF4444', 6);
    EasterRenderer.triggerShake(0.3);
    EasterUI.updateHP(player.hp, player.maxHp);

    if (player.hp <= 2) {
      EasterUI.showVignette('rgba(255,0,0,0.3)');
    }

    if (player.hp <= 0) {
      endGame();
    }
  }

  function handleThiefContact(enemy) {
    const now = performance.now();
    if (now < player.invulnUntil) return;

    // Steal combo and active powerup
    if (comboCount > 0) {
      EasterRenderer.spawnFloatingText(player.x, player.z, 'Combo stolen!', '#8B4513');
      comboCount = 0;
      comboTimer = 0;
    }
    if (activePowerup) {
      EasterRenderer.spawnFloatingText(player.x, player.z, 'Power-up stolen!', '#8B4513');
      activePowerup = null;
    }
    player.invulnUntil = now + EASTER.INVULN_DURATION / 2;
    EasterRenderer.triggerShake(0.15);
  }

  function onEnemyKilled(enemy) {
    enemiesKilledRun++;
    EasterProgress.trackEnemyType(enemy.type);

    // Combo
    comboCount = Math.min(comboCount + (modifierEffects.comboRateMult > 1 ? 2 : 1), EASTER.COMBO_MAX);
    comboTimer = comboWindow;
    EasterMissions.onComboUpdate(missionTracker, comboCount);
    EasterMissions.onEnemyKill(missionTracker, enemy.type, comboCount);

    // Score
    let points = enemy.score * Math.max(1, comboCount) * modifierEffects.scoreMult;
    if (activePowerup && activePowerup.type === 'golden_basket') points *= 2;
    points = Math.floor(points);
    score += points;

    EasterRenderer.spawnFloatingText(enemy.x, enemy.z, '+' + points, comboCount >= 5 ? '#FFD700' : '#FFFFFF');
    EasterRenderer.spawnDeathEffect(enemy.x, enemy.z, enemy.color);
    EasterRenderer.removeEnemyMesh(enemy.id);

    if (comboCount >= 5) EasterRenderer.triggerShake(0.15 + comboCount * 0.02);

    // Combo badge
    if (comboCount >= 10) EasterProgress.awardBadge('combo_x10');

    // Score badges
    if (score >= 10000) EasterProgress.awardBadge('score_10k');
    if (score >= 50000) EasterProgress.awardBadge('score_50k');

    // Enemy types badge
    const data = EasterProgress.getData();
    if (data.enemyTypesKilled.length >= Object.keys(EASTER.ENEMIES).length) {
      EasterProgress.awardBadge('all_enemies');
    }

    EasterMissions.onScoreUpdate(missionTracker, score);
    EasterUI.updateScore(score);
    EasterUI.updateMissionsHud(currentMissions);

    // Power-up drop
    const isLastEnemy = enemies.filter(function (e) { return e.alive; }).length === 0 && !boss;
    const forceFirst = EASTER.POWERUP_FIRST_WAVE_GUARANTEED && waveNum === 1 && isLastEnemy;
    tryDropPowerup(enemy.x, enemy.z, forceFirst);
  }

  function onBossDefeated() {
    bossesKilledRun++;
    const points = Math.floor(boss.score * modifierEffects.scoreMult);
    score += points;

    EasterRenderer.spawnBossDeathEffect(boss.x, boss.z);
    EasterRenderer.freezeFrame(300);
    EasterRenderer.triggerShake(1.5);
    EasterRenderer.removeEnemyMesh('boss');
    EasterRenderer.spawnFloatingText(boss.x, boss.z, '+' + points + ' BOSS!', '#FFD700');
    EasterUI.hideBossBar();
    EasterUI.showCenterMessage('BOSS DEFEATED!', '+' + points + ' points', 2000);

    EasterProgress.awardBadge('first_boss');
    EasterMissions.onBossDefeated(missionTracker);
    EasterMissions.onScoreUpdate(missionTracker, score);
    EasterUI.updateScore(score);
    EasterUI.updateMissionsHud(currentMissions);

    // Clear boss projectiles
    for (const ep of enemyProjectiles) {
      EasterRenderer.removeEnemyProjectileMesh(ep.id);
    }
    enemyProjectiles = [];

    // Drop guaranteed powerup
    tryDropPowerup(boss.x, boss.z, true);

    boss = null;
    onWaveCleared();
  }

  function endGame() {
    gameState = 'gameover';

    // Calculate coins
    let coins = Math.floor(score / EASTER.COINS_PER_SCORE) * modifierEffects.coinMultiplier;

    // Wave milestone coins
    for (const [wave, bonus] of Object.entries(EASTER.WAVE_MILESTONE_COINS)) {
      if (waveNum >= parseInt(wave)) coins += bonus;
    }

    // Boss kill coins
    coins += bossesKilledRun * EASTER.BOSS_KILL_COINS;

    // Mission rewards
    const missionRewards = EasterMissions.getCompletedRewards(missionTracker);
    coins += missionRewards.totalCoins;

    coins = Math.floor(coins);
    runCoins = coins;

    // Award badges
    EasterProgress.awardBadge('first_game');
    const progressData = EasterProgress.getData();
    if (progressData.currentStreak >= 3) EasterProgress.awardBadge('streak_3');
    if (progressData.currentStreak >= 7) EasterProgress.awardBadge('streak_7');

    // No damage wave badge (from missions tracker)
    for (const m of currentMissions) {
      if (m.id === 'no_damage_wave' && m.completed) EasterProgress.awardBadge('no_damage_wave');
    }

    EasterProgress.recordRun(score, waveNum, coins, enemiesKilledRun, bossesKilledRun);

    EasterUI.showGameOver(score, waveNum, coins, currentMissions, EasterProgress.getData().highScore);
    EasterUI.hideVignette();
  }

  // --- Game Loop ---
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (EasterRenderer.isFrozen()) {
      EasterRenderer.render();
      return;
    }

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (gameState === 'playing') {
      updatePlaying(dt, timestamp);
    } else if (gameState === 'wave_clear' || gameState === 'boss_warning') {
      waveTimer -= dt * 1000;
      if (waveTimer <= 0) {
        if (gameState === 'wave_clear' && (waveNum + 1) % EASTER.BOSS_EVERY === 0) {
          gameState = 'boss_warning';
          waveTimer = 2000;
          EasterUI.showCenterMessage('WARNING', 'BOSS APPROACHING', 2000);
          EasterUI.showVignette('rgba(155,89,182,0.3)');
        } else if (gameState === 'boss_warning') {
          EasterUI.hideVignette();
          spawnBoss();
        } else {
          nextWave();
          gameState = 'playing';
        }
      }
    }

    // Always render
    EasterRenderer.updateParticles(dt);
    EasterRenderer.render();
    EasterUI.renderFloatingTexts(EasterRenderer.getFloatingTexts());
  }

  function updatePlaying(dt, now) {
    // --- Input ---
    const mobile = EasterUI.getMobileInput();
    let moveX = 0, moveZ = 0;
    let wantsFire = mouseDown || spaceDown;

    if (mobile) {
      moveX = mobile.move.x;
      moveZ = mobile.move.z;
      if (mobile.aimActive) {
        aimAngle = Math.atan2(mobile.aim.x, -mobile.aim.z);
        wantsFire = true;
      }
    } else {
      if (keys['w'] || keys['arrowup']) moveZ = -1;
      if (keys['s'] || keys['arrowdown']) moveZ = 1;
      if (keys['a'] || keys['arrowleft']) moveX = -1;
      if (keys['d'] || keys['arrowright']) moveX = 1;
    }

    // Normalize diagonal movement
    const moveDist = Math.hypot(moveX, moveZ);
    if (moveDist > 0) {
      moveX /= moveDist;
      moveZ /= moveDist;
    }

    // Move player
    player.x += moveX * EASTER.PLAYER_SPEED * dt;
    player.z += moveZ * EASTER.PLAYER_SPEED * dt;

    // Clamp to arena
    const hw = EASTER.ARENA_WIDTH / 2 - 0.5;
    const hd = EASTER.ARENA_DEPTH / 2 - 0.5;
    const shrink = boss && boss.alive ? boss.arenaShrink || 0 : 0;
    player.x = Math.max(-(hw - shrink), Math.min(hw - shrink, player.x));
    player.z = Math.max(-(hd - shrink), Math.min(hd - shrink, player.z));
    player.rotation = aimAngle;

    // Fire
    if (wantsFire) fireProjectile();

    // --- Update Enemies ---
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      EasterEnemies.updateEnemy(enemy, dt, player.x, player.z, EASTER.ARENA_WIDTH, EASTER.ARENA_DEPTH, now);
      EasterRenderer.updateEnemyMesh(enemy);
    }

    // --- Update Boss ---
    if (boss && boss.alive) {
      const bossResult = EasterBoss.updateBoss(boss, dt, player.x, player.z, EASTER.ARENA_WIDTH, EASTER.ARENA_DEPTH, now);

      // Boss projectiles
      for (const bp of bossResult.projectiles) {
        enemyProjectiles.push(bp);
        EasterRenderer.addEnemyProjectile(bp);
      }

      // Boss summons
      for (const summon of bossResult.summons) {
        enemies.push(summon);
        EasterRenderer.addEnemy(summon);
      }

      // Phase change feedback
      if (bossResult.phaseChanged) {
        EasterRenderer.freezeFrame(80);
        EasterRenderer.triggerShake(0.6);
        EasterUI.showCenterMessage('Phase ' + (boss.phase + 1), '', 1500);
      }

      EasterRenderer.updateEnemyMesh(boss);
      EasterRenderer.setArenaShrink(boss.arenaShrink || 0);
      EasterUI.showBossBar(EASTER.BOSS.name, boss.hp / boss.maxHp);
    }

    // --- Update Projectiles ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // Lifetime / bounds check
      const age = now - p.createdAt;
      const oob = Math.abs(p.x) > EASTER.ARENA_WIDTH / 2 + 1 || Math.abs(p.z) > EASTER.ARENA_DEPTH / 2 + 1;
      if (age > p.lifetime || oob) {
        EasterRenderer.removeProjectileMesh(p.id);
        projectiles.splice(i, 1);
        continue;
      }
      EasterRenderer.updateProjectileMesh(p);
    }

    // --- Update Enemy Projectiles ---
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = enemyProjectiles[i];
      ep.x += ep.vx * dt;
      ep.z += ep.vz * dt;
      const age = now - ep.createdAt;
      const oob = Math.abs(ep.x) > EASTER.ARENA_WIDTH / 2 + 1 || Math.abs(ep.z) > EASTER.ARENA_DEPTH / 2 + 1;
      if (age > (ep.lifetime || 3000) || oob) {
        EasterRenderer.removeEnemyProjectileMesh(ep.id);
        enemyProjectiles.splice(i, 1);
        continue;
      }
      EasterRenderer.updateEnemyProjectileMesh(ep);
    }

    // --- Update Powerups ---
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      if (now - pu.createdAt > EASTER.POWERUP_LIFETIME) {
        EasterRenderer.removePowerupMesh(pu.id);
        powerups.splice(i, 1);
        continue;
      }
      EasterRenderer.updatePowerupMesh(pu);
    }

    // --- Collision: Player Projectiles vs Enemies ---
    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
      const p = projectiles[pi];
      let hit = false;

      // vs enemies
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(p.x - enemy.x, p.z - enemy.z);
        if (dist < p.radius + enemy.radius) {
          const killed = EasterEnemies.damageEnemy(enemy, EASTER.PROJECTILE_DAMAGE);
          if (killed) {
            onEnemyKilled(enemy);
          } else {
            EasterRenderer.spawnHitParticles(p.x, p.z, enemy.color, 4);
          }
          hit = true;
          break;
        }
      }

      // vs boss
      if (!hit && boss && boss.alive) {
        const dist = Math.hypot(p.x - boss.x, p.z - boss.z);
        if (dist < p.radius + boss.radius) {
          const defeated = EasterBoss.damageBoss(boss, EASTER.PROJECTILE_DAMAGE);
          EasterRenderer.spawnHitParticles(p.x, p.z, boss.color, 5);
          if (defeated) onBossDefeated();
          hit = true;
        }
      }

      if (hit) {
        EasterRenderer.removeProjectileMesh(p.id);
        projectiles.splice(pi, 1);
      }
    }

    // --- Collision: Enemies vs Player ---
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.z - player.z);
      if (dist < enemy.radius + EASTER.PLAYER_RADIUS) {
        if (enemy.behavior === 'thief') {
          handleThiefContact(enemy);
        } else {
          damagePlayer(1);
        }
      }
    }

    // --- Collision: Enemy Projectiles vs Player ---
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = enemyProjectiles[i];
      const dist = Math.hypot(ep.x - player.x, ep.z - player.z);
      if (dist < (ep.radius || 0.3) + EASTER.PLAYER_RADIUS) {
        damagePlayer(ep.damage || 1);
        EasterRenderer.removeEnemyProjectileMesh(ep.id);
        enemyProjectiles.splice(i, 1);
      }
    }

    // --- Collision: Powerups vs Player ---
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      const dist = Math.hypot(pu.x - player.x, pu.z - player.z);
      if (dist < pu.radius + EASTER.PLAYER_RADIUS) {
        collectPowerup(pu);
        EasterRenderer.removePowerupMesh(pu.id);
        powerups.splice(i, 1);
      }
    }

    // --- Egg Magnet effect ---
    if (activePowerup && activePowerup.type === 'egg_magnet') {
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        for (const p of projectiles) {
          const dist = Math.hypot(p.x - enemy.x, p.z - enemy.z);
          if (dist < 3 && dist > 0.3) {
            const pull = 2 * dt;
            enemy.x += ((p.x - enemy.x) / dist) * pull;
            enemy.z += ((p.z - enemy.z) / dist) * pull;
          }
        }
      }
    }

    // --- Combo Timer ---
    if (comboCount > 0) {
      comboTimer -= dt * 1000;
      if (comboTimer <= 0) {
        comboCount = 0;
        comboTimer = 0;
      }
    }
    EasterUI.updateCombo(comboCount, comboTimer, comboWindow);

    // --- Active Powerup Timer ---
    if (activePowerup && activePowerup.expiresAt > 0 && now >= activePowerup.expiresAt) {
      activePowerup = null;
    }
    if (activePowerup) {
      const timeLeft = activePowerup.expiresAt > 0 ? activePowerup.expiresAt - now : 0;
      EasterUI.updateActivePowerup(EASTER.POWERUPS[activePowerup.type].name, timeLeft);
    } else {
      EasterUI.updateActivePowerup(null, 0);
    }

    // --- Update Player Mesh ---
    const isInvuln = now < player.invulnUntil;
    EasterRenderer.updatePlayer(player.x, player.z, player.rotation, player.hasShield, isInvuln);

    // --- Low HP vignette ---
    if (player.hp <= 2 && player.hp > 0) {
      EasterUI.showVignette('rgba(255,0,0,' + (0.2 + Math.sin(now / 300) * 0.1) + ')');
    } else if (player.hp > 2) {
      EasterUI.hideVignette();
    }

    // --- Check wave clear ---
    if (gameState === 'playing') {
      const allDead = enemies.every(function (e) { return !e.alive; });
      const bossAlive = boss && boss.alive;
      if (allDead && !bossAlive) {
        onWaveCleared();
      }
    }
  }

  // --- Auto-start ---
  init();

  return { };
})();
