/**
 * Blitz Arena – Server
 * Express static file server + WebSocket game server.
 * Handles room management, game loop, and state broadcast.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');
const url = require('url');
const RoomManager = require('./roomManager');
const CONFIG = require('../shared/gameConfig');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const app = express();
const server = http.createServer(app);

// --- Static Files ---
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// Health check for deployment platforms
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ server });
const rooms = new RoomManager();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(roomId, data, excludeId = null) {
  const room = rooms.rooms.get(roomId);
  if (!room) return;

  const msg = JSON.stringify(data);
  for (const [pid, player] of room.players) {
    if (pid !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(msg);
    }
  }
}

// --- Rate Limiting ---
const MAX_MESSAGES_PER_SECOND = 60;
const connectionsByIp = new Map();
const MAX_CONNECTIONS_PER_IP = 4;

function getRateLimiter(ws) {
  if (!ws._rateLimiter) {
    ws._rateLimiter = { count: 0, resetTime: Date.now() + 1000 };
  }
  const rl = ws._rateLimiter;
  if (Date.now() > rl.resetTime) {
    rl.count = 0;
    rl.resetTime = Date.now() + 1000;
  }
  return rl;
}

wss.on('connection', (ws, req) => {
  // Per-IP connection limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const ipCount = (connectionsByIp.get(ip) || 0) + 1;
  if (ipCount > MAX_CONNECTIONS_PER_IP) {
    ws.close(1008, 'Too many connections');
    return;
  }
  connectionsByIp.set(ip, ipCount);
  ws.on('close', () => {
    const count = (connectionsByIp.get(ip) || 1) - 1;
    if (count <= 0) connectionsByIp.delete(ip);
    else connectionsByIp.set(ip, count);
  });

  const params = url.parse(req.url, true).query;
  const rawRoom = params.room || 'default';
  const roomId = String(rawRoom).slice(0, 64);

  // Add player
  const player = rooms.addPlayer(roomId, ws);

  if (!player) {
    send(ws, { type: CONFIG.MSG.ROOM_FULL });
    ws.close();
    return;
  }

  console.log(`[${roomId}] Player ${player.id} joined as ${player.characterId}`);

  // Notify the joining player of their info
  send(ws, {
    type: CONFIG.MSG.PLAYER_JOINED,
    playerId: player.id,
    characterId: player.characterId,
    roomId,
    players: getPlayerList(roomId),
  });

  // Notify other players
  broadcast(roomId, {
    type: CONFIG.MSG.PLAYER_JOINED,
    playerId: player.id,
    characterId: player.characterId,
    players: getPlayerList(roomId),
  }, player.id);

  // Auto-start when 2 players
  const room = rooms.getRoom(roomId);
  if (room.players.size === CONFIG.MAX_PLAYERS && room.state === 'waiting') {
    rooms.startCountdown(roomId, broadcast);
  }

  // --- Message Handler ---
  ws.on('message', (raw) => {
    // Rate limit messages
    const rl = getRateLimiter(ws);
    if (++rl.count > MAX_MESSAGES_PER_SECOND) return;

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const pid = ws._playerId;
    const rid = ws._roomId;

    switch (msg.type) {
      case CONFIG.MSG.MOVE:
        rooms.updatePlayerPosition(rid, pid, msg.x, msg.z, msg.rotation);
        break;

      case CONFIG.MSG.FIRE: {
        const proj = rooms.fireProjectile(rid, pid, msg.dirX, msg.dirZ);
        if (proj) {
          broadcast(rid, {
            type: CONFIG.MSG.PROJECTILE_SPAWN,
            projectile: {
              id: proj.id,
              ownerId: proj.ownerId,
              x: proj.x,
              z: proj.z,
              vx: proj.vx,
              vz: proj.vz,
            },
          });
        }
        break;
      }

      case CONFIG.MSG.HEARTBEAT:
        rooms.heartbeat(rid, pid);
        break;

      case CONFIG.MSG.REMATCH:
        if (rooms.handleRematch(rid)) {
          const r = rooms.getRoom(rid);
          if (r.players.size === CONFIG.MAX_PLAYERS) {
            rooms.startCountdown(rid, broadcast);
          }
        }
        break;
    }
  });

  // --- Disconnect ---
  ws.on('close', () => {
    const pid = ws._playerId;
    const rid = ws._roomId;
    if (pid && rid) {
      console.log(`[${rid}] Player ${pid} left`);
      rooms.removePlayer(rid, pid);
      broadcast(rid, {
        type: CONFIG.MSG.PLAYER_LEFT,
        playerId: pid,
        players: getPlayerList(rid),
      });
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

function getPlayerList(roomId) {
  const room = rooms.rooms.get(roomId);
  if (!room) return [];
  const list = [];
  for (const [, p] of room.players) {
    list.push({
      id: p.id,
      characterId: p.characterId,
      score: p.score,
    });
  }
  return list;
}

// --- Game Loop (Server Tick) ---
const tickInterval = 1000 / CONFIG.TICK_RATE;

setInterval(() => {
  for (const roomId of rooms.getActiveRooms()) {
    const room = rooms.rooms.get(roomId);
    if (!room) continue;

    if (room.state === 'playing') {
      const { hits } = rooms.tick(roomId);

      // Broadcast hits
      for (const hit of hits) {
        broadcast(roomId, {
          type: CONFIG.MSG.HIT_CONFIRM,
          ...hit,
        });
      }

      // Check if match ended
      if (room.state === 'ended') {
        const results = rooms.getMatchResults(roomId);
        broadcast(roomId, {
          type: CONFIG.MSG.MATCH_END,
          ...results,
        });
        rooms.stopMatch(roomId);
      }
    }

    // Broadcast state to all rooms with players
    if (room.players.size > 0) {
      const state = rooms.getState(roomId);
      if (state) {
        broadcast(roomId, {
          type: CONFIG.MSG.STATE_UPDATE,
          ...state,
        });
      }
    }
  }
}, tickInterval);

// --- Stale Connection Cleanup ---
setInterval(() => {
  const stale = rooms.cleanStale();
  for (const { roomId, playerId, ws } of stale) {
    console.log(`[${roomId}] Cleaning stale player ${playerId}`);
    rooms.removePlayer(roomId, playerId);
    broadcast(roomId, {
      type: CONFIG.MSG.PLAYER_LEFT,
      playerId,
      players: getPlayerList(roomId),
    });
    try { ws.close(); } catch {}
  }
}, CONFIG.HEARTBEAT_INTERVAL);

// --- Graceful Shutdown ---
function shutdown(signal) {
  console.log(`\n  ${signal} received, shutting down gracefully...`);

  // Notify all connected players
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1001, 'Server shutting down');
    }
  }

  wss.close(() => {
    server.close(() => {
      console.log('  Server closed.');
      process.exit(0);
    });
  });

  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Start ---
server.listen(PORT, () => {
  console.log(`\n  ♥ Blitz Arena running on port ${PORT}`);
  console.log(`  → http://localhost:${PORT}?room=cupid\n`);
});
