/**
 * Easter Arcade – Progression System
 * Persists unlocks, upgrades, badges, and stats via localStorage.
 */

const EasterProgress = (function () {
  const STORAGE_KEY = 'blitzArena_progress';

  const DEFAULT_DATA = {
    totalScore: 0,
    highScore: 0,
    highestWave: 0,
    totalGamesPlayed: 0,
    totalEnemiesKilled: 0,
    totalBossesKilled: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: null,

    unlockedEggs: ['basic'],
    selectedEgg: 'basic',

    upgrades: {
      basketSize: 0,
      eggSpeed: 0,
      comboTimer: 0,
      startingShield: 0,
    },

    badges: [],
    easterCoins: 0,

    // Track which modifiers are unlocked
    unlockedModifiers: ['golden_frenzy'],

    // Lifetime tracking for badges
    enemyTypesKilled: [],
    powerupTypesCollected: [],
  };

  let _data = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults for any new fields
        _data = Object.assign({}, DEFAULT_DATA, parsed);
        _data.upgrades = Object.assign({}, DEFAULT_DATA.upgrades, parsed.upgrades || {});
        _data.unlockedEggs = parsed.unlockedEggs || DEFAULT_DATA.unlockedEggs;
        _data.badges = parsed.badges || [];
        _data.unlockedModifiers = parsed.unlockedModifiers || DEFAULT_DATA.unlockedModifiers;
        _data.enemyTypesKilled = parsed.enemyTypesKilled || [];
        _data.powerupTypesCollected = parsed.powerupTypesCollected || [];
      } else {
        _data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    } catch (e) {
      _data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    return _data;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch (e) {
      // Storage full or unavailable
    }
  }

  function getData() {
    if (!_data) load();
    return _data;
  }

  function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (_data.lastPlayedDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (_data.lastPlayedDate === yesterday) {
      _data.currentStreak++;
    } else {
      _data.currentStreak = 1;
    }
    _data.bestStreak = Math.max(_data.bestStreak, _data.currentStreak);
    _data.lastPlayedDate = today;
    save();
  }

  function recordRun(score, wave, coinsEarned, enemiesKilled, bossesKilled) {
    _data.totalScore += score;
    _data.highScore = Math.max(_data.highScore, score);
    _data.highestWave = Math.max(_data.highestWave, wave);
    _data.totalGamesPlayed++;
    _data.totalEnemiesKilled += enemiesKilled;
    _data.totalBossesKilled += bossesKilled;
    _data.easterCoins += coinsEarned;

    // Unlock modifiers based on highest wave
    for (const mod of EASTER.MODIFIERS) {
      if (wave >= mod.unlockWave && !_data.unlockedModifiers.includes(mod.id)) {
        _data.unlockedModifiers.push(mod.id);
      }
    }

    updateStreak();
    save();
  }

  function awardBadge(badgeId) {
    if (!_data.badges.includes(badgeId)) {
      _data.badges.push(badgeId);
      save();
      return true;
    }
    return false;
  }

  function trackEnemyType(type) {
    if (!_data.enemyTypesKilled.includes(type)) {
      _data.enemyTypesKilled.push(type);
      save();
    }
  }

  function trackPowerupType(type) {
    if (!_data.powerupTypesCollected.includes(type)) {
      _data.powerupTypesCollected.push(type);
      save();
    }
  }

  function purchaseEgg(eggId) {
    const skin = EASTER.EGG_SKINS.find(s => s.id === eggId);
    if (!skin || _data.unlockedEggs.includes(eggId)) return false;
    if (_data.easterCoins < skin.cost) return false;
    _data.easterCoins -= skin.cost;
    _data.unlockedEggs.push(eggId);
    save();
    return true;
  }

  function selectEgg(eggId) {
    if (_data.unlockedEggs.includes(eggId)) {
      _data.selectedEgg = eggId;
      save();
      return true;
    }
    return false;
  }

  function purchaseUpgrade(upgradeId) {
    const upgradeCfg = EASTER.UPGRADES[upgradeId];
    if (!upgradeCfg) return false;
    const currentLevel = _data.upgrades[upgradeId] || 0;
    if (currentLevel >= upgradeCfg.maxLevel) return false;
    const cost = upgradeCfg.costs[currentLevel];
    if (_data.easterCoins < cost) return false;
    _data.easterCoins -= cost;
    _data.upgrades[upgradeId] = currentLevel + 1;
    save();
    return true;
  }

  function getUpgradeEffects() {
    return {
      pickupRadiusMult: 1 + (_data.upgrades.basketSize || 0) * EASTER.UPGRADES.basketSize.effect,
      projSpeedMult: 1 + (_data.upgrades.eggSpeed || 0) * EASTER.UPGRADES.eggSpeed.effect,
      comboWindowBonus: (_data.upgrades.comboTimer || 0) * EASTER.UPGRADES.comboTimer.effect,
      startingShield: (_data.upgrades.startingShield || 0) > 0,
    };
  }

  function getSelectedEggColor() {
    const skin = EASTER.EGG_SKINS.find(s => s.id === _data.selectedEgg);
    return skin ? skin.color : '#FFFFFF';
  }

  function resetProgress() {
    _data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    save();
  }

  return {
    load,
    save,
    getData,
    recordRun,
    awardBadge,
    trackEnemyType,
    trackPowerupType,
    purchaseEgg,
    selectEgg,
    purchaseUpgrade,
    getUpgradeEffects,
    getSelectedEggColor,
    resetProgress,
    updateStreak,
  };
})();
