/**
 * Blitz Arena – Room Manager
 * Manages rooms, players, projectiles, scoring, and match lifecycle.
 */

const { v4: uuidv4 } = require('uuid');
const CONFIG = require('../shared/gameConfig');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  /** Get or create a room */
  getRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        players: new Map(),
        projectiles: new Map(),
        state: 'waiting', // waiting | countdown | playing | ended
        matchTimer: null,
        countdownTimer: null,
        startTime: null,
        timeRemaining: CONFIG.MATCH_DURATION,
      });
    }
    return this.rooms.get(roomId);
  }

  /** Add player to room. Returns player object or null if full. */
  addPlayer(roomId, ws) {
    const room = this.getRoom(roomId);

    if (room.players.size >= CONFIG.MAX_PLAYERS) {
      return null;
    }

    const playerId = uuidv4().slice(0, 8);
    const playerIndex = room.players.size; // 0 or 1
    const characterKey = playerIndex === 0 ? 'cupid_prime' : 'dark_cupid';
    const spawnX = playerIndex === 0 ? -CONFIG.PLAYER_SPAWN_OFFSET : CONFIG.PLAYER_SPAWN_OFFSET;

    const player = {
      id: playerId,
      roomId,
      characterId: characterKey,
      x: spawnX,
      z: 0,
      rotation: playerIndex === 0 ? 0 : Math.PI,
      score: 0,
      ws,
      lastHeartbeat: Date.now(),
      lastFireTime: 0,
    };

    room.players.set(playerId, player);
    ws._playerId = playerId;
    ws._roomId = roomId;

    return player;
  }

  /** Remove player from room */
  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.delete(playerId);

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.stopMatch(roomId);
      this.rooms.delete(roomId);
      return;
    }

    // If match was active, end it
    if (room.state === 'playing' || room.state === 'countdown') {
      this.stopMatch(roomId);
      room.state = 'waiting';
      room.projectiles.clear();
    }
  }

  /** Update player movement */
  updatePlayerPosition(roomId, playerId, x, z, rotation) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    // Validate inputs
    if (typeof x !== 'number' || typeof z !== 'number' || typeof rotation !== 'number' ||
        !isFinite(x) || !isFinite(z) || !isFinite(rotation)) return;

    // Clamp to arena bounds
    const hw = CONFIG.ARENA_WIDTH / 2 - CONFIG.PLAYER_RADIUS;
    const hd = CONFIG.ARENA_DEPTH / 2 - CONFIG.PLAYER_RADIUS;

    player.x = Math.max(-hw, Math.min(hw, x));
    player.z = Math.max(-hd, Math.min(hd, z));
    player.rotation = rotation;
  }

  /** Fire projectile */
  fireProjectile(roomId, playerId, dirX, dirZ) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'playing') return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    // Validate direction inputs
    if (typeof dirX !== 'number' || typeof dirZ !== 'number' ||
        !isFinite(dirX) || !isFinite(dirZ)) return null;

    const now = Date.now();
    if (now - player.lastFireTime < CONFIG.FIRE_COOLDOWN) return null;
    player.lastFireTime = now;

    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len < 0.01) return null;
    const nx = dirX / len;
    const nz = dirZ / len;

    const projId = uuidv4().slice(0, 8);
    const projectile = {
      id: projId,
      ownerId: playerId,
      x: player.x + nx * 1.0,
      z: player.z + nz * 1.0,
      vx: nx * CONFIG.PROJECTILE_SPEED,
      vz: nz * CONFIG.PROJECTILE_SPEED,
      createdAt: now,
    };

    room.projectiles.set(projId, projectile);
    return projectile;
  }

  /** Tick – update projectiles, check collisions */
  tick(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'playing') return { hits: [] };

    const dt = 1 / CONFIG.TICK_RATE;
    const now = Date.now();
    const hits = [];
    const expiredProjectiles = [];

    // Update projectiles
    for (const [projId, proj] of room.projectiles) {
      proj.x += proj.vx * dt;
      proj.z += proj.vz * dt;

      // Out of bounds
      const hw = CONFIG.ARENA_WIDTH / 2;
      const hd = CONFIG.ARENA_DEPTH / 2;
      if (Math.abs(proj.x) > hw || Math.abs(proj.z) > hd) {
        expiredProjectiles.push(projId);
        continue;
      }

      // Lifetime expired
      if (now - proj.createdAt > CONFIG.PROJECTILE_LIFETIME) {
        expiredProjectiles.push(projId);
        continue;
      }

      // Hit detection against other players
      for (const [pid, p] of room.players) {
        if (pid === proj.ownerId) continue;

        const dx = proj.x - p.x;
        const dz = proj.z - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const hitDist = CONFIG.PLAYER_RADIUS + CONFIG.PROJECTILE_RADIUS;

        if (dist < hitDist) {
          // Hit!
          const shooter = room.players.get(proj.ownerId);
          if (shooter) {
            shooter.score++;
          }

          hits.push({
            projectileId: projId,
            shooterId: proj.ownerId,
            targetId: pid,
            x: proj.x,
            z: proj.z,
          });

          expiredProjectiles.push(projId);

          // Check win condition
          if (shooter && shooter.score >= CONFIG.WIN_SCORE) {
            room.state = 'ended';
          }
          break;
        }
      }
    }

    // Remove expired projectiles
    for (const id of expiredProjectiles) {
      room.projectiles.delete(id);
    }

    // Update timer
    if (room.startTime) {
      const elapsed = (now - room.startTime) / 1000;
      room.timeRemaining = Math.max(0, CONFIG.MATCH_DURATION - elapsed);

      if (room.timeRemaining <= 0 && room.state === 'playing') {
        room.state = 'ended';
      }
    }

    return { hits };
  }

  /** Get serialized state for broadcast */
  getState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const players = [];
    for (const [, p] of room.players) {
      players.push({
        id: p.id,
        characterId: p.characterId,
        x: p.x,
        z: p.z,
        rotation: p.rotation,
        score: p.score,
      });
    }

    const projectiles = [];
    for (const [, proj] of room.projectiles) {
      projectiles.push({
        id: proj.id,
        ownerId: proj.ownerId,
        x: proj.x,
        z: proj.z,
        vx: proj.vx,
        vz: proj.vz,
      });
    }

    return {
      players,
      projectiles,
      state: room.state,
      timeRemaining: Math.ceil(room.timeRemaining),
    };
  }

  /** Start countdown then match */
  startCountdown(roomId, broadcastFn) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.state = 'countdown';
    room.projectiles.clear();
    let count = CONFIG.COUNTDOWN_DURATION;

    // Reset scores and positions
    let i = 0;
    for (const [, p] of room.players) {
      p.score = 0;
      p.x = i === 0 ? -CONFIG.PLAYER_SPAWN_OFFSET : CONFIG.PLAYER_SPAWN_OFFSET;
      p.z = 0;
      p.rotation = i === 0 ? 0 : Math.PI;
      i++;
    }

    broadcastFn(roomId, {
      type: CONFIG.MSG.MATCH_COUNTDOWN,
      count,
    });

    room.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        broadcastFn(roomId, {
          type: CONFIG.MSG.MATCH_COUNTDOWN,
          count,
        });
      } else {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        this.startMatch(roomId, broadcastFn);
      }
    }, 1000);
  }

  /** Start active match */
  startMatch(roomId, broadcastFn) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.state = 'playing';
    room.startTime = Date.now();
    room.timeRemaining = CONFIG.MATCH_DURATION;

    broadcastFn(roomId, {
      type: CONFIG.MSG.MATCH_START,
    });
  }

  /** Stop match timers */
  stopMatch(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.matchTimer) {
      clearInterval(room.matchTimer);
      room.matchTimer = null;
    }
    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
    }
  }

  /** Get match results */
  getMatchResults(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const players = [];
    let winnerId = null;
    let highScore = -1;

    for (const [, p] of room.players) {
      players.push({ id: p.id, characterId: p.characterId, score: p.score });
      if (p.score > highScore) {
        highScore = p.score;
        winnerId = p.id;
      }
    }

    // Check for tie
    const scores = players.map(p => p.score);
    const isTie = scores.length === 2 && scores[0] === scores[1];

    return {
      players,
      winnerId: isTie ? null : winnerId,
      isTie,
      reason: room.timeRemaining <= 0 ? 'timeout' : 'score',
    };
  }

  /** Handle rematch request */
  handleRematch(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'ended') return false;

    room.projectiles.clear();
    room.state = 'waiting';
    return true;
  }

  /** Update heartbeat timestamp */
  heartbeat(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(playerId);
    if (player) {
      player.lastHeartbeat = Date.now();
    }
  }

  /** Clean stale connections */
  cleanStale() {
    const now = Date.now();
    const stale = [];

    for (const [roomId, room] of this.rooms) {
      for (const [playerId, player] of room.players) {
        if (now - player.lastHeartbeat > CONFIG.HEARTBEAT_TIMEOUT) {
          stale.push({ roomId, playerId, ws: player.ws });
        }
      }
    }

    return stale;
  }

  /** Get all active room IDs */
  getActiveRooms() {
    return Array.from(this.rooms.keys());
  }
}

module.exports = RoomManager;
