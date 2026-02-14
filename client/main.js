/**
 * Blitz Arena – Main Game Loop
 * Input handling, game state management, render loop.
 * Supports WASD+Mouse (desktop) and twin-stick touch (mobile).
 */

(function () {
  'use strict';

  // --- State ---
  let gameState = 'waiting'; // waiting | countdown | playing | ended
  let localPlayer = { x: 0, z: 0, rotation: 0, characterId: null };
  let players = [];
  let inputMove = { x: 0, z: 0 };
  let aimDir = { x: 0, z: -1 };
  let lastFireTime = 0;
  let mouseAim = { x: 0, z: 0 };
  let isMobile = false;

  // Desktop input state
  const keys = {};

  // Mobile joystick state
  let moveStickActive = false;
  let aimStickActive = false;
  let moveStickDir = { x: 0, z: 0 };
  let aimStickDir = { x: 0, z: 0 };

  // --- Init ---

  function init() {
    UI.init();
    Renderer.init();

    isMobile = UI.isMobile();

    // Parse room from URL
    const params = new URLSearchParams(window.location.search);
    let room = params.get('room') || 'cupid';

    // Show room link
    const shareUrl = `${window.location.origin}?room=${encodeURIComponent(room)}`;
    UI.showWaiting(shareUrl);

    // Setup multiplayer callbacks
    Multiplayer.setCallbacks({
      onConnectionChange: handleConnectionChange,
      onPlayerJoined: handlePlayerJoined,
      onPlayerLeft: handlePlayerLeft,
      onStateUpdate: handleStateUpdate,
      onProjectileSpawn: handleProjectileSpawn,
      onHitConfirm: handleHitConfirm,
      onMatchCountdown: handleMatchCountdown,
      onMatchStart: handleMatchStart,
      onMatchEnd: handleMatchEnd,
      onRoomFull: handleRoomFull,
    });

    // Connect
    Multiplayer.connect(room);

    // Setup input
    if (isMobile) {
      setupMobileInput();
    } else {
      setupDesktopInput();
    }

    // Rematch button
    UI.getRematchBtn().addEventListener('click', () => {
      Multiplayer.sendRematch();
      UI.hideMatchEnd();
      gameState = 'waiting';
    });

    // Start render loop
    requestAnimationFrame(gameLoop);
  }

  // --- Game Loop ---

  function gameLoop() {
    requestAnimationFrame(gameLoop);

    if (gameState === 'playing') {
      processInput();
      sendLocalState();
    }

    Renderer.update();
  }

  function processInput() {
    const speed = GAME_CONFIG.PLAYER_SPEED;
    const dt = 1 / 60; // approximate

    if (isMobile) {
      inputMove.x = moveStickDir.x;
      inputMove.z = moveStickDir.z;
    } else {
      inputMove.x = 0;
      inputMove.z = 0;
      if (keys['KeyW'] || keys['ArrowUp']) inputMove.z = -1;
      if (keys['KeyS'] || keys['ArrowDown']) inputMove.z = 1;
      if (keys['KeyA'] || keys['ArrowLeft']) inputMove.x = -1;
      if (keys['KeyD'] || keys['ArrowRight']) inputMove.x = 1;

      // Normalize diagonal
      const len = Math.sqrt(inputMove.x * inputMove.x + inputMove.z * inputMove.z);
      if (len > 1) {
        inputMove.x /= len;
        inputMove.z /= len;
      }
    }

    // Apply movement
    localPlayer.x += inputMove.x * speed * dt;
    localPlayer.z += inputMove.z * speed * dt;

    // Clamp to arena
    const hw = GAME_CONFIG.ARENA_WIDTH / 2 - GAME_CONFIG.PLAYER_RADIUS;
    const hd = GAME_CONFIG.ARENA_DEPTH / 2 - GAME_CONFIG.PLAYER_RADIUS;
    localPlayer.x = Math.max(-hw, Math.min(hw, localPlayer.x));
    localPlayer.z = Math.max(-hd, Math.min(hd, localPlayer.z));

    // Rotation based on aim direction
    if (isMobile) {
      if (aimStickActive && (aimStickDir.x !== 0 || aimStickDir.z !== 0)) {
        aimDir.x = aimStickDir.x;
        aimDir.z = aimStickDir.z;
        localPlayer.rotation = Math.atan2(aimDir.x, aimDir.z);
      } else if (inputMove.x !== 0 || inputMove.z !== 0) {
        aimDir.x = inputMove.x;
        aimDir.z = inputMove.z;
        localPlayer.rotation = Math.atan2(aimDir.x, aimDir.z);
      }
    } else {
      localPlayer.rotation = Math.atan2(mouseAim.x, mouseAim.z);
      aimDir.x = mouseAim.x;
      aimDir.z = mouseAim.z;
    }

    // Update local player visual immediately (no interpolation lag)
    const localId = Multiplayer.getLocalPlayerId();
    if (localId) {
      Renderer.setPlayerImmediate(localId, localPlayer.x, localPlayer.z);
      Renderer.updatePlayerTarget(localId, localPlayer.x, localPlayer.z, localPlayer.rotation);
    }
  }

  function sendLocalState() {
    Multiplayer.sendMove(localPlayer.x, localPlayer.z, localPlayer.rotation);
  }

  // --- Desktop Input ---

  function setupDesktopInput() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;

      // Space = fire
      if (e.code === 'Space' && gameState === 'playing') {
        tryFire();
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    // Mouse for aiming + click to fire
    window.addEventListener('mousemove', (e) => {
      // Convert screen coords to world-relative aim direction
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 5) {
        mouseAim.x = dx / len;
        mouseAim.z = dy / len;
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && gameState === 'playing') {
        tryFire();
      }
    });
  }

  // --- Mobile Input ---

  function setupMobileInput() {
    UI.showMobileControls();

    const moveZone = UI.getMoveZone();
    const aimZone = UI.getAimZone();
    const fireBtn = UI.getFireBtn();

    // Virtual joystick - move
    setupTouchJoystick(moveZone, (dx, dz, active) => {
      moveStickActive = active;
      moveStickDir.x = dx;
      moveStickDir.z = dz;
    });

    // Virtual joystick - aim
    setupTouchJoystick(aimZone, (dx, dz, active) => {
      aimStickActive = active;
      aimStickDir.x = dx;
      aimStickDir.z = dz;

      // Auto-fire when aiming
      if (active && gameState === 'playing') {
        tryFire();
      }
    });

    // Fire button
    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameState === 'playing') tryFire();
    });
  }

  function setupTouchJoystick(element, callback) {
    let touchId = null;
    let centerX = 0;
    let centerY = 0;
    const maxDist = 50;

    // Draw joystick base
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');

    function drawJoystick(ox, oy) {
      ctx.clearRect(0, 0, 140, 140);

      // Outer ring
      ctx.strokeStyle = 'rgba(255,105,180,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(70, 70, 55, 0, Math.PI * 2);
      ctx.stroke();

      // Inner thumb
      ctx.fillStyle = 'rgba(255,105,180,0.5)';
      ctx.beginPath();
      ctx.arc(70 + ox * 0.7, 70 + oy * 0.7, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    drawJoystick(0, 0);
    element.appendChild(canvas);

    element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = element.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    }, { passive: false });

    element.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId) {
          let dx = touch.clientX - centerX;
          let dy = touch.clientY - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
          }
          const nx = dx / maxDist;
          const ny = dy / maxDist;
          callback(nx, ny, true);
          drawJoystick(dx, dy);
        }
      }
    }, { passive: false });

    const endHandler = (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId) {
          touchId = null;
          callback(0, 0, false);
          drawJoystick(0, 0);
        }
      }
    };

    element.addEventListener('touchend', endHandler);
    element.addEventListener('touchcancel', endHandler);
  }

  function tryFire() {
    const now = Date.now();
    if (now - lastFireTime < GAME_CONFIG.FIRE_COOLDOWN) return;
    lastFireTime = now;

    const len = Math.sqrt(aimDir.x * aimDir.x + aimDir.z * aimDir.z);
    if (len < 0.01) return;

    Multiplayer.sendFire(aimDir.x / len, aimDir.z / len);
  }

  // --- Network Event Handlers ---

  function handleConnectionChange(status) {
    UI.setConnection(status);
  }

  function handlePlayerJoined(msg) {
    const localId = Multiplayer.getLocalPlayerId();
    players = msg.players || [];

    // Create visuals for all players
    for (const p of players) {
      Renderer.getOrCreatePlayer(p.id, p.characterId);
    }

    UI.updateScoreboard(players, localId);

    if (players.length < 2) {
      UI.showWaiting(
        `${window.location.origin}?room=${encodeURIComponent(Multiplayer.getRoomId())}`
      );
    }
  }

  function handlePlayerLeft(msg) {
    Renderer.removePlayer(msg.playerId);
    players = msg.players || [];
    const localId = Multiplayer.getLocalPlayerId();
    UI.updateScoreboard(players, localId);

    if (gameState === 'playing' || gameState === 'countdown') {
      gameState = 'waiting';
      Renderer.clearAllProjectiles();
      UI.showCenterMessage('Opponent Left', 'Waiting for new challenger...', 3000);
    }

    if (players.length < 2) {
      UI.showWaiting(
        `${window.location.origin}?room=${encodeURIComponent(Multiplayer.getRoomId())}`
      );
    }
  }

  function handleStateUpdate(msg) {
    const localId = Multiplayer.getLocalPlayerId();

    // Update player positions (remote players only – local is predicted)
    for (const p of msg.players) {
      Renderer.getOrCreatePlayer(p.id, p.characterId);

      if (p.id !== localId) {
        Renderer.updatePlayerTarget(p.id, p.x, p.z, p.rotation);
      }
    }

    // Sync projectiles
    const getCharId = (ownerId) => {
      const owner = msg.players.find(p => p.id === ownerId);
      return owner ? owner.characterId : 'cupid_prime';
    };
    Renderer.syncProjectiles(msg.projectiles || [], getCharId);

    // Update scores
    UI.updateScores(msg.players, localId);

    // Update timer
    if (msg.timeRemaining !== undefined) {
      UI.updateTimer(msg.timeRemaining);
    }
  }

  function handleProjectileSpawn(proj) {
    // Find owner's character
    const owner = players.find(p => p.id === proj.ownerId);
    const charId = owner ? owner.characterId : 'cupid_prime';
    Renderer.spawnProjectile(proj.id, proj.ownerId, proj.x, proj.z, proj.vx, proj.vz, charId);
  }

  function handleHitConfirm(msg) {
    // Find the target's character for correct hit effect
    const target = players.find(p => p.id === msg.targetId);
    const shooter = players.find(p => p.id === msg.shooterId);
    const charId = shooter ? shooter.characterId : 'cupid_prime';

    Renderer.removeProjectile(msg.projectileId);
    Renderer.spawnHitEffect(msg.x, msg.z, charId);
  }

  function handleMatchCountdown(count) {
    gameState = 'countdown';
    UI.hideWaiting();
    UI.hideMatchEnd();

    if (isMobile) UI.showMobileControls();

    // Initialize local player position from current character assignment
    const localId = Multiplayer.getLocalPlayerId();
    const localCharId = Multiplayer.getLocalCharacterId();
    const isFirst = localCharId === 'cupid_prime';
    localPlayer.x = isFirst ? -GAME_CONFIG.PLAYER_SPAWN_OFFSET : GAME_CONFIG.PLAYER_SPAWN_OFFSET;
    localPlayer.z = 0;
    localPlayer.rotation = isFirst ? 0 : Math.PI;
    localPlayer.characterId = localCharId;

    Renderer.clearAllProjectiles();

    UI.showCenterMessage(String(count), 'Get Ready!');

    // Build scoreboard
    UI.updateScoreboard(players, localId);
  }

  function handleMatchStart() {
    gameState = 'playing';
    UI.hideCenterMessage();
    UI.showCenterMessage('FIGHT!', '♥', 1500);
  }

  function handleMatchEnd(result) {
    gameState = 'ended';
    const localId = Multiplayer.getLocalPlayerId();
    UI.showMatchEnd(result, localId);
    Renderer.clearAllProjectiles();
  }

  function handleRoomFull() {
    UI.showCenterMessage('Room Full', 'This room already has 2 players. Try a different room.');
  }

  // --- Boot ---
  window.addEventListener('DOMContentLoaded', init);
})();
