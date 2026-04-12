/**
 * Blitz Arena – Easter Arcade Configuration
 * Single source of truth for the Easter wave-based arcade mode.
 * Client-side only (no server game logic for arcade).
 */

const EASTER = {
  // Arena
  ARENA_WIDTH: 32,
  ARENA_DEPTH: 22,
  ARENA_WALL_HEIGHT: 3,

  // Player
  PLAYER_SPEED: 9,
  PLAYER_RADIUS: 0.55,
  PLAYER_MAX_HP: 5,
  INVULN_DURATION: 800, // ms after taking damage

  // Projectiles
  PROJECTILE_SPEED: 18,
  PROJECTILE_RADIUS: 0.2,
  PROJECTILE_LIFETIME: 2500, // ms
  FIRE_COOLDOWN: 300, // ms between shots
  PROJECTILE_DAMAGE: 1,

  // Combo
  COMBO_WINDOW: 2000, // ms to land next hit before combo resets
  COMBO_MAX: 10,
  COMBO_SCORE_MULTIPLIER: true, // score = base * combo

  // Waves
  WAVE_PREP_TIME: 3000, // ms between waves
  WAVE_BASE_ENEMIES: 4,
  WAVE_ENEMY_SCALE: 1.3, // enemies per wave = base * scale^(wave-1), capped
  WAVE_MAX_ENEMIES: 30,
  BOSS_EVERY: 5, // boss appears every N waves

  // Enemy types
  ENEMIES: {
    chick: {
      id: 'chick',
      name: 'Chick',
      hp: 1,
      speed: 5.5,
      radius: 0.4,
      score: 10,
      color: '#FFD700',
      behavior: 'zigzag',
      zigzagAmp: 2.5,
      zigzagFreq: 3,
    },
    golden_egg: {
      id: 'golden_egg',
      name: 'Golden Egg',
      hp: 5,
      speed: 2.5,
      radius: 0.65,
      score: 50,
      color: '#DAA520',
      behavior: 'shielded',
      shieldHits: 3, // hits to break shield before vulnerable
    },
    basket_thief: {
      id: 'basket_thief',
      name: 'Basket Thief',
      hp: 2,
      speed: 4.5,
      radius: 0.5,
      score: 30,
      color: '#8B4513',
      behavior: 'thief',
    },
    jack_rabbit: {
      id: 'jack_rabbit',
      name: 'Jack Rabbit',
      hp: 2,
      speed: 3,
      radius: 0.5,
      score: 40,
      color: '#888888',
      behavior: 'ambush',
      idleTime: 1500, // ms before lunge
      lungeSpeed: 18,
      lungeDuration: 400, // ms
    },
  },

  // Boss
  BOSS: {
    name: 'Easter Bunny King',
    baseHp: 40,
    hpScale: 15, // added per boss appearance
    speed: 3,
    radius: 1.2,
    score: 500,
    color: '#9B59B6',
    phases: [
      { hpPercent: 1.0, pattern: 'circle_strafe', fireRate: 800, projCount: 3, projSpread: 0.4 },
      { hpPercent: 0.6, pattern: 'summon_and_fire', fireRate: 600, projCount: 5, projSpread: 0.3, summonCount: 3 },
      { hpPercent: 0.3, pattern: 'enrage', fireRate: 350, projCount: 7, projSpread: 0.5, summonCount: 4, arenaShrinK: 3 },
    ],
    projSpeed: 10,
    projRadius: 0.3,
    projDamage: 1,
  },

  // Power-ups
  POWERUPS: {
    rapid_fire: {
      id: 'rapid_fire',
      name: 'Rapid Fire',
      duration: 5000,
      color: '#FF4500',
      icon: 'R',
      dropWeight: 3,
    },
    triple_egg: {
      id: 'triple_egg',
      name: 'Triple Egg',
      duration: 5000,
      color: '#1E90FF',
      icon: 'T',
      dropWeight: 3,
    },
    egg_magnet: {
      id: 'egg_magnet',
      name: 'Egg Magnet',
      duration: 5000,
      color: '#FF69B4',
      icon: 'M',
      dropWeight: 2,
    },
    golden_basket: {
      id: 'golden_basket',
      name: 'Golden Basket',
      duration: 8000,
      color: '#FFD700',
      icon: 'G',
      dropWeight: 2,
    },
    shield: {
      id: 'shield',
      name: 'Shield',
      duration: 0, // instant / permanent until hit
      color: '#00CED1',
      icon: 'S',
      dropWeight: 2,
    },
  },
  POWERUP_DROP_CHANCE: 0.25, // chance per enemy kill
  POWERUP_LIFETIME: 8000, // ms before despawn
  POWERUP_FIRST_WAVE_GUARANTEED: true,

  // Missions
  MISSION_POOL: [
    { id: 'combo_x5', desc: 'Reach combo x5', type: 'combo_reach', target: 5, reward: 20 },
    { id: 'combo_x8', desc: 'Reach combo x8', type: 'combo_reach', target: 8, reward: 40 },
    { id: 'no_damage_wave', desc: 'Clear a wave without damage', type: 'no_damage_wave', target: 1, reward: 35 },
    { id: 'kill_chicks_5', desc: 'Defeat 5 Chicks in one wave', type: 'kill_type_wave', targetType: 'chick', target: 5, reward: 25 },
    { id: 'kill_golden_3', desc: 'Defeat 3 Golden Eggs', type: 'kill_type_total', targetType: 'golden_egg', target: 3, reward: 30 },
    { id: 'collect_powerups_3', desc: 'Collect 3 power-ups', type: 'collect_powerups', target: 3, reward: 25 },
    { id: 'boss_no_powerup', desc: 'Beat a boss without power-ups', type: 'boss_no_powerup', target: 1, reward: 60 },
    { id: 'survive_wave_10', desc: 'Reach wave 10', type: 'reach_wave', target: 10, reward: 50 },
    { id: 'score_5000', desc: 'Score 5,000 points', type: 'reach_score', target: 5000, reward: 30 },
    { id: 'kill_streak_10', desc: 'Kill 10 enemies without damage', type: 'kill_streak', target: 10, reward: 40 },
    { id: 'kill_thief', desc: 'Defeat 3 Basket Thieves', type: 'kill_type_total', targetType: 'basket_thief', target: 3, reward: 25 },
    { id: 'kill_rabbits_3', desc: 'Defeat 3 Jack Rabbits', type: 'kill_type_total', targetType: 'jack_rabbit', target: 3, reward: 30 },
    { id: 'perfect_wave', desc: 'Get combo x3+ on every kill in a wave', type: 'perfect_combo_wave', target: 3, reward: 45 },
    { id: 'speed_clear', desc: 'Clear a wave in under 10 seconds', type: 'speed_clear', target: 10000, reward: 35 },
    { id: 'survive_wave_20', desc: 'Reach wave 20', type: 'reach_wave', target: 20, reward: 80 },
  ],
  MISSIONS_PER_RUN: 3,

  // Modifiers
  MODIFIERS: [
    { id: 'golden_frenzy', name: 'Golden Egg Frenzy', desc: '2x coin earnings', unlockWave: 0, effect: { coinMultiplier: 2 } },
    { id: 'bunny_stampede', name: 'Bunny Stampede', desc: '50% more enemies, 50% more score', unlockWave: 5, effect: { enemyCountMult: 1.5, scoreMult: 1.5 } },
    { id: 'basket_storm', name: 'Basket Storm', desc: '3x power-up drop rate', unlockWave: 10, effect: { powerupDropMult: 3 } },
    { id: 'double_combo', name: 'Double Combo', desc: 'Combo multiplier increases 2x faster', unlockWave: 15, effect: { comboRateMult: 2 } },
  ],

  // Progression
  COINS_PER_SCORE: 100, // 1 coin per 100 score
  WAVE_MILESTONE_COINS: { 5: 20, 10: 50, 15: 80, 20: 120, 25: 160 },
  BOSS_KILL_COINS: 30,

  EGG_SKINS: [
    { id: 'basic', name: 'Basic Egg', color: '#FFFFFF', cost: 0 },
    { id: 'golden', name: 'Golden Egg', color: '#FFD700', cost: 50 },
    { id: 'crystal', name: 'Crystal Egg', color: '#87CEEB', cost: 100 },
    { id: 'rainbow', name: 'Rainbow Egg', color: '#FF69B4', cost: 200 },
    { id: 'chocolate', name: 'Chocolate Egg', color: '#8B4513', cost: 150 },
    { id: 'diamond', name: 'Diamond Egg', color: '#B9F2FF', cost: 500 },
  ],

  UPGRADES: {
    basketSize: { name: 'Basket Size', desc: 'Pickup radius +15%', maxLevel: 3, costs: [100, 200, 300], effect: 0.15 },
    eggSpeed: { name: 'Egg Speed', desc: 'Projectile speed +10%', maxLevel: 3, costs: [100, 200, 300], effect: 0.10 },
    comboTimer: { name: 'Combo Timer', desc: 'Combo window +0.5s', maxLevel: 3, costs: [150, 250, 350], effect: 500 },
    startingShield: { name: 'Starting Shield', desc: 'Begin each run with a shield', maxLevel: 1, costs: [300], effect: 1 },
  },

  BADGES: [
    { id: 'first_game', name: 'First Steps', desc: 'Complete your first run' },
    { id: 'first_boss', name: 'Boss Slayer', desc: 'Defeat your first boss' },
    { id: 'combo_x10', name: 'Combo Master', desc: 'Reach a x10 combo' },
    { id: 'wave_10', name: 'Wave Rider', desc: 'Reach wave 10' },
    { id: 'wave_20', name: 'Wave Crusher', desc: 'Reach wave 20' },
    { id: 'no_damage_wave', name: 'Untouchable', desc: 'Clear a wave without taking damage' },
    { id: 'streak_3', name: 'Regular', desc: 'Play 3 days in a row' },
    { id: 'streak_7', name: 'Dedicated', desc: 'Play 7 days in a row' },
    { id: 'score_10k', name: 'High Roller', desc: 'Score 10,000 in a single run' },
    { id: 'score_50k', name: 'Legend', desc: 'Score 50,000 in a single run' },
    { id: 'all_enemies', name: 'Bestiary', desc: 'Defeat every enemy type' },
    { id: 'all_powerups', name: 'Collector', desc: 'Collect every power-up type' },
  ],

  // Theme
  THEME: {
    name: 'easter',
    skyColor: 0x87CEEB,
    ambientColor: 0xCCDDCC,
    groundColor: 0x4CAF50,
    accentColor: '#50C878',
    fogColor: 0xC8E6C9,
    fogNear: 25,
    fogFar: 55,
    wallColor: 0x8B6914,
    grassColor: '#4CAF50',
    flowerColors: ['#FF69B4', '#FFD700', '#FF6347', '#9370DB', '#87CEEB'],
  },
};

// Support both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EASTER;
}
