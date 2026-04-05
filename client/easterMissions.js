/**
 * Easter Arcade – Mission & Modifier System
 * Rotating mini-missions per run and run modifiers for variety.
 */

const EasterMissions = (function () {

  function pickMissions(count) {
    const pool = EASTER.MISSION_POOL.slice();
    const picked = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const mission = Object.assign({}, pool.splice(idx, 1)[0]);
      mission.progress = 0;
      mission.completed = false;
      picked.push(mission);
    }
    return picked;
  }

  function getUnlockedModifiers() {
    const data = EasterProgress.getData();
    return EASTER.MODIFIERS.filter(m => data.unlockedModifiers.includes(m.id));
  }

  // Create a tracker object for in-run mission tracking
  function createTracker(missions) {
    return {
      missions: missions,
      // Wave-specific trackers (reset each wave)
      waveDamageTaken: 0,
      waveKillsByType: {},
      waveKillCount: 0,
      waveStartTime: 0,
      waveMinCombo: Infinity,
      // Run-wide trackers
      killStreak: 0, // kills without taking damage
      powerupsCollected: 0,
      bossActive: false,
      usedPowerupDuringBoss: false,
    };
  }

  function onWaveStart(tracker) {
    tracker.waveDamageTaken = 0;
    tracker.waveKillsByType = {};
    tracker.waveKillCount = 0;
    tracker.waveStartTime = performance.now();
    tracker.waveMinCombo = Infinity;
  }

  function onEnemyKill(tracker, enemyType, comboCount) {
    tracker.waveKillCount++;
    tracker.waveKillsByType[enemyType] = (tracker.waveKillsByType[enemyType] || 0) + 1;
    tracker.killStreak++;
    if (comboCount > 0) {
      tracker.waveMinCombo = Math.min(tracker.waveMinCombo, comboCount);
    }

    // Check missions
    for (const m of tracker.missions) {
      if (m.completed) continue;
      switch (m.type) {
        case 'kill_type_total':
        case 'kill_type_wave':
          // Total tracked at wave end for wave-type
          break;
        case 'kill_streak':
          if (tracker.killStreak >= m.target) {
            m.progress = m.target;
            m.completed = true;
          } else {
            m.progress = tracker.killStreak;
          }
          break;
      }
    }
  }

  function onComboUpdate(tracker, comboCount) {
    for (const m of tracker.missions) {
      if (m.completed) continue;
      if (m.type === 'combo_reach') {
        m.progress = Math.max(m.progress, comboCount);
        if (comboCount >= m.target) m.completed = true;
      }
    }
  }

  function onDamageTaken(tracker) {
    tracker.waveDamageTaken++;
    tracker.killStreak = 0;

    // Update kill_streak mission
    for (const m of tracker.missions) {
      if (m.completed) continue;
      if (m.type === 'kill_streak') {
        // Don't reset progress (it's the best streak)
      }
    }
  }

  function onPowerupCollected(tracker) {
    tracker.powerupsCollected++;
    if (tracker.bossActive) {
      tracker.usedPowerupDuringBoss = true;
    }

    for (const m of tracker.missions) {
      if (m.completed) continue;
      if (m.type === 'collect_powerups') {
        m.progress = tracker.powerupsCollected;
        if (m.progress >= m.target) m.completed = true;
      }
    }
  }

  function onBossStart(tracker) {
    tracker.bossActive = true;
    tracker.usedPowerupDuringBoss = false;
  }

  function onBossDefeated(tracker) {
    for (const m of tracker.missions) {
      if (m.completed) continue;
      if (m.type === 'boss_no_powerup' && !tracker.usedPowerupDuringBoss) {
        m.progress = 1;
        m.completed = true;
      }
    }
    tracker.bossActive = false;
  }

  function onWaveCleared(tracker, waveNum) {
    const elapsed = performance.now() - tracker.waveStartTime;

    for (const m of tracker.missions) {
      if (m.completed) continue;
      switch (m.type) {
        case 'no_damage_wave':
          if (tracker.waveDamageTaken === 0) {
            m.progress++;
            if (m.progress >= m.target) m.completed = true;
          }
          break;
        case 'kill_type_wave':
          if ((tracker.waveKillsByType[m.targetType] || 0) >= m.target) {
            m.progress = m.target;
            m.completed = true;
          }
          break;
        case 'kill_type_total':
          m.progress = (m.progress || 0) + (tracker.waveKillsByType[m.targetType] || 0);
          if (m.progress >= m.target) m.completed = true;
          break;
        case 'reach_wave':
          m.progress = waveNum;
          if (waveNum >= m.target) m.completed = true;
          break;
        case 'speed_clear':
          if (elapsed <= m.target) {
            m.progress = 1;
            m.completed = true;
          }
          break;
        case 'perfect_combo_wave':
          if (tracker.waveKillCount > 0 && tracker.waveMinCombo >= m.target) {
            m.progress = 1;
            m.completed = true;
          }
          break;
      }
    }
  }

  function onScoreUpdate(tracker, totalScore) {
    for (const m of tracker.missions) {
      if (m.completed) continue;
      if (m.type === 'reach_score') {
        m.progress = totalScore;
        if (totalScore >= m.target) m.completed = true;
      }
    }
  }

  function getCompletedRewards(tracker) {
    let totalCoins = 0;
    const completed = [];
    for (const m of tracker.missions) {
      if (m.completed) {
        totalCoins += m.reward;
        completed.push(m);
      }
    }
    return { totalCoins, completed };
  }

  return {
    pickMissions,
    getUnlockedModifiers,
    createTracker,
    onWaveStart,
    onEnemyKill,
    onComboUpdate,
    onDamageTaken,
    onPowerupCollected,
    onBossStart,
    onBossDefeated,
    onWaveCleared,
    onScoreUpdate,
    getCompletedRewards,
  };
})();
