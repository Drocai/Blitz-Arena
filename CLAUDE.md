# CLAUDE.md - Blitz Arena

## Project Overview

Blitz Arena is a real-time 1v1 multiplayer browser arena battle game with a Valentine's Day theme (Cupid Prime vs Dark Cupid). Players join rooms via URL parameter, and matches are first-to-10-hits or best score after 3 minutes.

**Tech stack:** Node.js, Express, WebSocket (ws), Three.js, vanilla JavaScript. No frameworks, no TypeScript, no build step.

## Directory Structure

```
├── server/
│   ├── server.js          # Express HTTP + WebSocket server, message routing, rate limiting
│   ├── roomManager.js     # Game state engine: rooms, players, projectiles, collision, scoring
│   └── package.json       # Server dependencies (express, ws, uuid)
├── client/
│   ├── index.html         # SPA entry point, inline CSS, script loading order
│   ├── main.js            # Game loop, input handling (WASD/mouse + mobile joysticks)
│   ├── renderer.js        # Three.js scene: arena, characters, projectiles, effects
│   ├── multiplayer.js     # WebSocket client, message sending/receiving, auto-reconnect
│   ├── ui.js              # HUD, scoreboard, timer, match overlays, mobile controls
│   └── assets/            # Placeholder directory (all assets are procedurally generated)
├── shared/
│   └── gameConfig.js      # Single source of truth for all game constants (server + client)
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

To test locally: open two browser tabs to `http://localhost:3000?room=test`.

## Architecture

### Server-Authoritative Model

- **Server** owns all game state: player positions, projectile physics, collision detection, scoring
- **Client** sends input (move direction, fire command) and renders the authoritative state
- Server broadcasts `state_update` at 20 Hz (50ms tick rate)
- Client renders at 60 FPS with interpolation (`INTERPOLATION_FACTOR: 0.15`)

### Game State Machine

Room states: `waiting` → `countdown` (3s) → `playing` (180s max) → `ended` → (rematch) → `countdown`

### WebSocket Protocol

All messages are JSON with a `type` field. Message types are defined in `shared/gameConfig.js` as `CONFIG.MSG`.

**Client → Server:** `move`, `fire`, `heartbeat`, `rematch`
**Server → Client:** `player_joined`, `player_left`, `state_update`, `projectile_spawn`, `hit_confirm`, `match_countdown`, `match_start`, `match_end`, `room_full`, `error`

### Room System

- Rooms are created dynamically from the `?room=` URL parameter
- Room IDs validated against `/^[a-zA-Z0-9_-]{1,64}$/`, default: `'default'`
- Max 2 players per room
- Rooms auto-delete when the last player leaves
- All state is in-memory (no database)

## Code Conventions

- **Naming:** camelCase for variables/functions, UPPER_SNAKE_CASE for constants
- **Server modules:** ES6 class pattern (`RoomManager` class)
- **Client modules:** IIFE + closure pattern (each file is a self-contained module)
- **Shared config:** UMD pattern in `gameConfig.js` (works in Node.js and browsers)
- **No semicolons are omitted** — semicolons are used consistently
- **Error handling:** try-catch for JSON parsing, minimal elsewhere
- **One concern per file** — rendering, networking, UI, and game logic are separated

## Configuration

### gameConfig.js (shared/gameConfig.js)

This is the single source of truth for game balance, arena dimensions, networking, characters, and theme. Both server and client import it. Key values:

| Constant | Value | Purpose |
|----------|-------|---------|
| `PLAYER_SPEED` | 8 | Units/sec movement speed |
| `PROJECTILE_SPEED` | 16 | Units/sec projectile speed |
| `FIRE_COOLDOWN` | 350 | ms between shots |
| `WIN_SCORE` | 10 | Hits to win |
| `MATCH_DURATION` | 180 | Seconds per match |
| `TICK_RATE` | 20 | Server updates per second |
| `ARENA_WIDTH` / `ARENA_HEIGHT` | 30 / 20 | Arena dimensions |

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
- **Message guardrails:** Messages ignored before player identity is established

## Important Patterns

- **No build step** — plain JavaScript served directly; no bundler, transpiler, or compile step
- **Procedural assets** — all graphics (characters, projectiles, arena) generated at runtime via Three.js and Canvas; no external image files
- **No database** — all game state is ephemeral in-memory Maps; nothing persists across server restarts
- **No TypeScript** — entire codebase is vanilla JavaScript
- **No tests** — no test framework or test files exist; testing is manual (two browser tabs)
- **No linting** — no ESLint, Prettier, or other code quality tooling configured
- **Script load order matters** — in `index.html`, scripts load in dependency order: gameConfig → ui → renderer → multiplayer → main
- **WebSocket URL auto-detection** — client derives `ws://` or `wss://` from `window.location.protocol`

## Common Tasks

### Adjust Game Balance
Edit values in `shared/gameConfig.js`. Changes apply to both server and client automatically. Restart the server after changes.

### Add a New Character
1. Add a new entry to `CONFIG.CHARACTERS` in `shared/gameConfig.js` with palette, projectile color, and hit effect type
2. Update `renderer.js` to handle the new character's texture generation in `createCharacterTexture()`
3. Update character assignment logic in `server/roomManager.js` `addPlayer()` (currently alternates between two characters)

### Change the Theme
Modify the `CONFIG.THEME` object in `shared/gameConfig.js` (sky color, ground color, fog, accent colors).

### Add a New Message Type
1. Add the type string to `CONFIG.MSG` in `shared/gameConfig.js`
2. Handle sending in `client/multiplayer.js`
3. Handle receiving in `server/server.js` message dispatch switch
4. Update game logic in `server/roomManager.js` as needed

## Deployment

The app deploys as a single Node.js process. Configs exist for:
- **Docker:** `Dockerfile` (node:18-alpine, exposes port 3000)
- **Railway:** `railway.json` (NIXPACKS builder, health check at `/health`)
- **Render:** `render.yaml` (free plan, health check at `/health`)

Health check endpoint: `GET /health` returns `{ status: 'ok', rooms, players }`.
