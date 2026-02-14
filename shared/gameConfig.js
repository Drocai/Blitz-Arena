/**
 * Blitz Arena – Shared Game Configuration
 * Single source of truth for all game constants.
 * Used by both server and client.
 */

const GAME_CONFIG = {
  // Arena
  ARENA_WIDTH: 30,
  ARENA_DEPTH: 20,
  ARENA_WALL_HEIGHT: 3,

  // Players
  PLAYER_SPEED: 8,
  PLAYER_RADIUS: 0.6,
  PLAYER_SPAWN_OFFSET: 8,

  // Projectiles
  PROJECTILE_SPEED: 16,
  PROJECTILE_RADIUS: 0.25,
  PROJECTILE_LIFETIME: 3000, // ms
  FIRE_COOLDOWN: 350, // ms between shots

  // Match
  MAX_PLAYERS: 2,
  WIN_SCORE: 10,
  MATCH_DURATION: 180, // seconds (3 minutes)
  COUNTDOWN_DURATION: 3, // pre-match countdown

  // Network
  TICK_RATE: 20, // server broadcasts per second (50ms)
  HEARTBEAT_INTERVAL: 5000,
  HEARTBEAT_TIMEOUT: 15000,
  INTERPOLATION_FACTOR: 0.15,

  // Characters
  CHARACTERS: {
    cupid_prime: {
      id: 'cupid_prime',
      name: 'Cupid Prime',
      palette: { primary: '#FF69B4', secondary: '#FFD700', accent: '#FFF0F5' },
      projectileColor: '#FF1493',
      hitEffect: 'spark',
    },
    dark_cupid: {
      id: 'dark_cupid',
      name: 'Dark Cupid',
      palette: { primary: '#2D0040', secondary: '#8B00FF', accent: '#4A0066' },
      projectileColor: '#9400D3',
      hitEffect: 'smoke',
    },
  },

  // Theme
  THEME: {
    name: 'valentines',
    skyColor: 0x1a0011,
    ambientColor: 0x664466,
    groundColor: 0x2a0020,
    accentColor: '#FF69B4',
    fogColor: 0x1a0011,
    fogNear: 20,
    fogFar: 50,
  },

  // Message types
  MSG: {
    JOIN: 'join',
    MOVE: 'move',
    FIRE: 'fire',
    HEARTBEAT: 'heartbeat',
    REMATCH: 'rematch',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    STATE_UPDATE: 'state_update',
    PROJECTILE_SPAWN: 'projectile_spawn',
    PROJECTILE_HIT: 'projectile_hit',
    HIT_CONFIRM: 'hit_confirm',
    MATCH_START: 'match_start',
    MATCH_COUNTDOWN: 'match_countdown',
    MATCH_END: 'match_end',
    ROOM_FULL: 'room_full',
    ERROR: 'error',
  },
};

// Support both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONFIG;
}
