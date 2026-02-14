# ♥ Blitz Arena – Valentine's Showdown

Real-time 1v1 multiplayer browser arena battle game. Cupid Prime vs Dark Cupid. First to 10 hits or highest score when the 3-minute timer expires wins.

Built with **Node.js**, **WebSockets (ws)**, and **Three.js**. Zero external asset dependencies – all characters, projectiles, and arenas are procedurally generated.

---

## Quick Start

```bash
# Install dependencies
npm run install:server

# Start server (serves client automatically)
npm start

# Open in browser
# Player 1: http://localhost:3000?room=cupid
# Player 2: http://localhost:3000?room=cupid (different tab/device)
```

Development mode with auto-reload:

```bash
npm run dev
```

---

## How It Works

### Multiplayer Flow

1. Player opens URL with `?room=<name>` query parameter
2. WebSocket connects and joins the room
3. When 2 players are in the room, a 3-second countdown begins
4. Match runs for 3 minutes or until someone scores 10 hits
5. Match end overlay shows results with rematch button

### Controls

| Platform | Move | Aim | Fire |
|----------|------|-----|------|
| Desktop | WASD / Arrow Keys | Mouse | Click / Space |
| Mobile | Left joystick | Right joystick (auto-fires) | Center button |

### Characters

| Character | Palette | Projectile | Hit Effect |
|-----------|---------|------------|------------|
| **Cupid Prime** | Pink / Gold | Heart arrow | Sparks |
| **Dark Cupid** | Black / Violet | Shadow heart | Smoke |

Player 1 always spawns as Cupid Prime, Player 2 as Dark Cupid.

---

## Architecture

```
blitz-arena/
  server/
    server.js          # Express + WebSocket server + game loop
    roomManager.js     # Room, player, projectile, match state management
    package.json
  client/
    index.html         # Entry point + all CSS
    main.js            # Game loop, input handling, lifecycle
    renderer.js        # Three.js scene, characters, effects
    multiplayer.js     # WebSocket client + message handling
    ui.js              # HUD, scoreboard, overlays, mobile controls
    assets/            # Placeholder dirs for custom sprites
      characters/
      arenas/
      projectiles/
  shared/
    gameConfig.js      # Shared constants (server + client)
  package.json         # Root scripts for deployment
  README.md
```

### Network Protocol

**Client → Server:**

| Message | Fields | Purpose |
|---------|--------|---------|
| `move` | `x, z, rotation` | Position update |
| `fire` | `dirX, dirZ` | Fire projectile |
| `heartbeat` | – | Keep-alive |
| `rematch` | – | Request new match |

**Server → Client:**

| Message | Fields | Purpose |
|---------|--------|---------|
| `player_joined` | `playerId, characterId, players[]` | Player connected |
| `player_left` | `playerId, players[]` | Player disconnected |
| `state_update` | `players[], projectiles[], timeRemaining, state` | Tick broadcast |
| `projectile_spawn` | `id, ownerId, x, z, vx, vz` | New projectile |
| `hit_confirm` | `projectileId, shooterId, targetId, x, z` | Hit registered |
| `match_countdown` | `count` | Pre-match countdown |
| `match_start` | – | Match begins |
| `match_end` | `winnerId, players[], isTie, reason` | Match finished |

Server ticks at **20 Hz** (50ms). Clients render at 60fps with interpolation.

---

## Deployment

### Railway

```bash
# Push to GitHub, then in Railway:
# 1. New Project → Deploy from GitHub
# 2. Set root directory to /
# 3. Railway auto-detects Node.js
# 4. Start command: npm start
# PORT is automatically set by Railway
```

### Fly.io

Create `fly.toml` in root:

```toml
app = "blitz-arena"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

Then:

```bash
fly launch
fly deploy
```

### Render / Generic

- Build command: `cd server && npm install`
- Start command: `cd server && node server.js`
- Environment: Set `PORT` if needed (default 3000)

The WebSocket URL auto-derives from `window.location`, so `ws://` on local and `wss://` on HTTPS deploy – no config needed.

---

## Customization

### Swap Character Sprites

Replace the procedural textures in `renderer.js`:

1. Add PNG sprites (512px height, transparent background) to `client/assets/characters/`
2. In `renderer.js`, modify `createCharacterTexture()`:

```javascript
function createCharacterTexture(characterId) {
  // Replace procedural generation with:
  const loader = new THREE.TextureLoader();
  return loader.load(`/assets/characters/${characterId}.png`);
}
```

Required sprite states for full animation (current version uses single frame):
- `idle.png` – Standing
- `run.png` – Moving
- `attack.png` – Firing
- `hit.png` – Taking damage

### Add Seasonal Themes

Themes are defined in `shared/gameConfig.js` under `THEME`:

```javascript
THEME: {
  name: 'halloween',
  skyColor: 0x0a0a1a,
  ambientColor: 0x332244,
  groundColor: 0x1a1a0a,
  accentColor: '#FF6600',
  fogColor: 0x0a0a1a,
  fogNear: 15,
  fogFar: 40,
}
```

Theme changes modify:
- Arena colors and fog
- UI accent colors (update CSS variables)
- Ground texture pattern (modify `createGroundTexture()`)

Theme changes do NOT affect:
- Game mechanics
- Networking
- Character roster

### Adjust Game Balance

All tunable values live in `shared/gameConfig.js`:

- `PLAYER_SPEED` – Movement speed
- `PROJECTILE_SPEED` – Arrow velocity
- `FIRE_COOLDOWN` – Ms between shots
- `WIN_SCORE` – Hits to win
- `MATCH_DURATION` – Timer in seconds
- `PLAYER_RADIUS` / `PROJECTILE_RADIUS` – Hitbox sizes

---

## Performance Notes

- Procedural textures keep bundle at zero external assets
- All textures ≤ 512px
- Sprite billboards instead of 3D character models (minimal draw calls)
- Pixel ratio capped at 2x for mobile
- Antialias disabled on high-DPI screens
- Server tick rate 20Hz balances accuracy vs bandwidth
- Client-side prediction with server reconciliation

---

## License

MIT
