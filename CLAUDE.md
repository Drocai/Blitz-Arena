# CLAUDE.md - Blitz Arena

## Project Overview

Blitz Arena is a multiplayer and single-player browser arena game with seasonal themes. It features two game modes:

1. **Valentine's Showdown** — Real-time 1v1 multiplayer arena battle (Cupid Prime vs Dark Cupid). Server-authoritative, WebSocket-based. First-to-10-hits or best score after 3 minutes.
2. **Easter Egg Hunt** — Solo arcade wave-based mode. Client-side game logic. Fight enemy waves, chain combos, defeat bosses, earn coins, unlock upgrades and cosmetics.

**Tech stack:** Node.js, Express, WebSocket (ws), Three.js, vanilla JavaScript. No frameworks, no TypeScript, no build step.

## Directory Structure

```
├── server/
│   ├── server.js          # Express HTTP + WebSocket server, message routing, rate limiting
│   ├── roomManager.js     # Valentine's game state: rooms, players, projectiles, collision, scoring
│   └── package.json       # Server dependencies (express, ws, uuid)
├── client/
│   ├── index.html         # Landing page — mode selection (Valentine's vs Easter)
│   ├── valentine.html     # Valentine's 1v1 mode entry point (inline CSS, script loading)
│   ├── easter.html        # Easter arcade mode entry point (inline CSS, script loading)
│   │
│   │  # Valentine's 1v1 files:
│   ├── main.js            # Valentine's game loop, input handling (WASD/mouse + mobile joysticks)
│   ├── renderer.js        # Valentine's Three.js scene: arena, characters, projectiles, effects
│   ├── multiplayer.js     # WebSocket client, message sending/receiving, auto-reconnect
│   ├── ui.js              # Valentine's HUD, scoreboard, timer, match overlays, mobile controls
│   │
│   │  # Easter arcade files (client-side game logic, no server dependency):
│   ├── easterGame.js      # Core arcade engine: game loop, state machine, collision, input, spawning
│   ├── easterRenderer.js  # Easter Three.js scene: grass arena, eggs, bunnies, particles
│   ├── easterUI.js        # Arcade HUD: wave, combo, score, HP, missions, progression panel
│   ├── easterEnemies.js   # 4 enemy types with distinct AI behaviors + wave generation
│   ├── easterBoss.js      # Multi-phase boss encounters with attack patterns
│   ├── easterProgress.js  # localStorage progression: unlocks, upgrades, badges, streaks
│   ├── easterMissions.js  # Mission system + run modifiers
│   └── assets/            # Placeholder directory (all assets are procedurally generated)
├── shared/
│   ├── gameConfig.js      # Valentine's mode constants (server + client)
│   └── easterConfig.js    # Easter arcade constants (enemies, waves, bosses, progression)
├── Dockerfile             # Production container (node:18-alpine)
├── railway.json           # Railway deployment config
├── render.yaml            # Render deployment config
└── package.json           # Root scripts and postinstall hook
```

## Development Commands

```bash
npm install          # Installs root + server dependencies (via postinstall hook)
npm run dev          # Start dev server with --watch auto-reload (port 3000)
npm start            # Start production server
```

No build step required. Client files are served as static assets by Express.

**Testing locally:**
- Landing page: `http://localhost:3000`
- Valentine's 1v1: open two tabs to `http://localhost:3000/valentine.html?room=test`
- Easter Arcade: `http://localhost:3000/easter.html`

## Architecture

### Two Game Modes

**Valentine's Showdown (Multiplayer)**
- Server-authoritative: server owns all game state
- Client sends input, server broadcasts state at 20 Hz
- WebSocket protocol with JSON messages
- 2-player rooms created dynamically from `?room=` URL parameter

**Easter Egg Hunt (Solo Arcade)**
- Client-side game logic (no server game state)
- Server only serves static files
- All game simulation runs in the browser at 60 FPS
- Progression persisted via localStorage

### Valentine's State Machine
Room states: `waiting` → `countdown` (3s) → `playing` (180s max) → `ended` → (rematch) → `countdown`

### Easter State Machine
Game states: `prerun` (mission/modifier selection) → `countdown` → `playing` → `wave_clear` → `boss_warning` (every 5 waves) → `playing` → `gameover`

### Easter Game Systems
- **Enemies:** 4 types with distinct behaviors (Chick/zigzag, Golden Egg/shielded, Basket Thief/steal combo, Jack Rabbit/ambush lunge)
- **Boss:** Multi-phase (circle strafe → summon adds → enrage with arena shrink), appears every 5 waves
- **Combo:** Consecutive kills within 2s increase multiplier (max x10). Score = base × combo × modifier
- **Power-ups:** 5 types (Rapid Fire, Triple Egg, Egg Magnet, Golden Basket, Shield) dropped on enemy kill
- **Progression:** Unlockable egg skins, passive upgrades (4 types, 3 levels each), badges, daily streaks, coins
- **Missions:** 3 rotating mini-missions per run from a pool of 15
- **Modifiers:** 4 run modifiers that change gameplay (unlocked at wave milestones)

### WebSocket Protocol (Valentine's only)

All messages are JSON with a `type` field. Message types are defined in `shared/gameConfig.js` as `CONFIG.MSG`.

**Client → Server:** `move`, `fire`, `heartbeat`, `rematch`
**Server → Client:** `player_joined`, `player_left`, `state_update`, `projectile_spawn`, `hit_confirm`, `match_countdown`, `match_start`, `match_end`, `room_full`, `error`

## Code Conventions

- **Naming:** camelCase for variables/functions, UPPER_SNAKE_CASE for constants
- **Server modules:** ES6 class pattern (`RoomManager` class)
- **Client modules:** IIFE + closure pattern (each file is a self-contained module exposing a public API)
- **Shared config:** UMD pattern (works in Node.js and browsers via conditional `module.exports`)
- **Semicolons** are used consistently throughout
- **One concern per file** �� rendering, networking, UI, enemies, boss, progression, and game logic are separated
- **Script load order matters** — scripts in HTML load in dependency order

### Script Load Order
**Valentine's:** `gameConfig → ui → renderer → multiplayer → main`
**Easter:** `easterConfig → easterProgress → easterMissions → easterEnemies → easterBoss → easterRenderer → easterUI → easterGame`

## Configuration

### gameConfig.js (Valentine's)

Single source of truth for Valentine's mode balance, arena, networking, characters, and theme.

| Constant | Value | Purpose |
|----------|-------|---------|
| `PLAYER_SPEED` | 8 | Units/sec movement speed |
| `PROJECTILE_SPEED` | 16 | Units/sec projectile speed |
| `FIRE_COOLDOWN` | 350 | ms between shots |
| `WIN_SCORE` | 10 | Hits to win |
| `MATCH_DURATION` | 180 | Seconds per match |
| `TICK_RATE` | 20 | Server updates per second |

### easterConfig.js (Easter Arcade)

Single source of truth for Easter mode: enemies, waves, bosses, power-ups, progression, missions, modifiers, theme.

| Constant | Value | Purpose |
|----------|-------|---------|
| `PLAYER_SPEED` | 9 | Units/sec player speed |
| `PLAYER_MAX_HP` | 5 | Starting health |
| `PROJECTILE_SPEED` | 18 | Egg projectile speed |
| `FIRE_COOLDOWN` | 300 | ms between shots |
| `COMBO_WINDOW` | 2000 | ms to maintain combo |
| `BOSS_EVERY` | 5 | Boss appears every N waves |
| `WAVE_BASE_ENEMIES` | 4 | Enemies in wave 1 |
| `POWERUP_DROP_CHANCE` | 0.25 | Per enemy kill |

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Server listen port |
| `NODE_ENV` | — | `production` for deployed environments |

## Security (per AUDIT_REVIEW.md)

- **Rate limiting:** 60 messages/sec per WebSocket connection; escalation disconnects abusive clients
- **Connection limiting:** Max 4 WebSocket connections per IP
- **Payload cap:** 1024 bytes max per WebSocket message
- **Room ID sanitization:** Alphanumeric + underscore/hyphen only, max 64 chars
- **Input validation:** Position/direction values checked for NaN/Infinity, clamped to arena bounds
- **Heartbeat cleanup:** Stale connections removed after 15s timeout (checked every 5s)

## Important Patterns

- **No build step** — plain JavaScript served directly; no bundler, transpiler, or compile step
- **Procedural assets** — all graphics generated at runtime via Three.js and Canvas; no external image files
- **Holiday-reskin architecture** — each game mode has its own config, renderer, UI, and game logic; shared patterns but independent implementations
- **No database** — Valentine's game state is ephemeral in-memory Maps; Easter progression uses localStorage
- **No TypeScript** — entire codebase is vanilla JavaScript
- **No tests** — testing is manual (two browser tabs for Valentine's, single tab for Easter)
- **No linting** — no ESLint, Prettier, or other code quality tooling configured

## Common Tasks

### Adjust Valentine's Game Balance
Edit values in `shared/gameConfig.js`. Changes apply to both server and client. Restart the server.

### Adjust Easter Game Balance
Edit values in `shared/easterConfig.js`. Changes apply on browser refresh (client-side only).

### Add a New Easter Enemy Type
1. Add config to `EASTER.ENEMIES` in `shared/easterConfig.js` (hp, speed, radius, score, color, behavior)
2. Implement behavior in `easterEnemies.js` (add case to `updateEnemy` switch)
3. Add to wave generation in `_getTypesForWave()` in `easterEnemies.js`
4. Add visual rendering in `easterRenderer.js` `addEnemy()`

### Add a New Power-Up
1. Add config to `EASTER.POWERUPS` in `shared/easterConfig.js`
2. Handle effect in `easterGame.js` (in projectile/movement/scoring logic)
3. Track in `easterProgress.js` `trackPowerupType()`

### Add a New Badge
1. Add to `EASTER.BADGES` in `shared/easterConfig.js`
2. Add award condition in `easterGame.js` badge checking logic
3. Display auto-handled by `easterUI.js` progression panel

### Add a Seasonal Theme (Holiday Reskin)
1. Create `shared/<theme>Config.js` with theme constants
2. Create `client/<theme>*.js` files (Game, Renderer, UI, Enemies, etc.)
3. Create `client/<theme>.html` entry point
4. Add mode card to `client/index.html` landing page
5. Add route in `server/server.js`

## Deployment

The app deploys as a single Node.js process. Configs exist for:
- **Docker:** `Dockerfile` (node:18-alpine, exposes port 3000)
- **Railway:** `railway.json` (NIXPACKS builder, health check at `/health`)
- **Render:** `render.yaml` (free plan, health check at `/health`)

Health check endpoint: `GET /health` returns `{ status: 'ok' }`.
