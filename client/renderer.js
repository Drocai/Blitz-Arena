/**
 * Blitz Arena – Renderer
 * Three.js scene: arena, billboard characters, projectiles, particle effects.
 * Procedural textures – no external image assets needed.
 */

const Renderer = (() => {
  let scene, camera, renderer, clock;
  let arenaGroup, playerMeshes, projectileMeshes, effectsGroup;
  const playerTargets = {};
  const activeEffects = [];
  const activeProjectiles = new Map();

  // --- Procedural Texture Generators ---

  function createCharacterTexture(characterId) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    const cfg = GAME_CONFIG.CHARACTERS[characterId];
    const p = cfg.palette;

    // Body
    ctx.fillStyle = p.primary;
    ctx.beginPath();
    ctx.ellipse(64, 130, 30, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = p.secondary;
    ctx.globalAlpha = 0.7;
    // Left wing
    ctx.beginPath();
    ctx.ellipse(28, 100, 22, 36, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.ellipse(100, 100, 22, 36, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(64, 60, 28, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = characterId === 'cupid_prime' ? '#333' : '#FF00FF';
    ctx.beginPath();
    ctx.arc(54, 55, 5, 0, Math.PI * 2);
    ctx.arc(74, 55, 5, 0, Math.PI * 2);
    ctx.fill();

    // Halo / Crown
    if (characterId === 'cupid_prime') {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(64, 30, 20, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#8B00FF';
      // Small horns
      ctx.beginPath();
      ctx.moveTo(44, 38); ctx.lineTo(38, 18); ctx.lineTo(52, 35);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(84, 38); ctx.lineTo(90, 18); ctx.lineTo(76, 35);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function createProjectileTexture(characterId) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const color = GAME_CONFIG.CHARACTERS[characterId].projectileColor;

    // Heart shape
    ctx.fillStyle = color;
    ctx.beginPath();
    const cx = 32, cy = 28;
    ctx.moveTo(cx, cy + 14);
    ctx.bezierCurveTo(cx - 20, cy - 2, cx - 20, cy - 18, cx, cy - 8);
    ctx.bezierCurveTo(cx + 20, cy - 18, cx + 20, cy - 2, cx, cy + 14);
    ctx.fill();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function createGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base
    const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 360);
    grad.addColorStop(0, '#3a0028');
    grad.addColorStop(1, '#1a0011');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,105,180,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }

    // Scattered small hearts
    ctx.fillStyle = 'rgba(255,105,180,0.06)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const s = 4 + Math.random() * 8;
      ctx.font = `${s}px serif`;
      ctx.fillText('♥', x, y);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  // --- Init ---

  function init() {
    const canvas = document.getElementById('game-canvas');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(GAME_CONFIG.THEME.skyColor);
    scene.fog = new THREE.Fog(
      GAME_CONFIG.THEME.fogColor,
      GAME_CONFIG.THEME.fogNear,
      GAME_CONFIG.THEME.fogFar
    );

    // Camera – isometric-ish top-down
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 22, 16);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio <= 1,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    clock = new THREE.Clock();
    playerMeshes = new Map();
    projectileMeshes = new Map();

    // Lighting
    const ambient = new THREE.AmbientLight(GAME_CONFIG.THEME.ambientColor, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xFFCCDD, 0.8);
    dirLight.position.set(5, 15, 8);
    scene.add(dirLight);

    const pinkLight = new THREE.PointLight(0xFF69B4, 0.5, 30);
    pinkLight.position.set(0, 8, 0);
    scene.add(pinkLight);

    // Arena
    buildArena();

    // Effects group
    effectsGroup = new THREE.Group();
    scene.add(effectsGroup);

    // Resize
    window.addEventListener('resize', onResize);
  }

  function buildArena() {
    arenaGroup = new THREE.Group();
    const W = GAME_CONFIG.ARENA_WIDTH;
    const D = GAME_CONFIG.ARENA_DEPTH;
    const wallH = GAME_CONFIG.ARENA_WALL_HEIGHT;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(W, D);
    const groundMat = new THREE.MeshStandardMaterial({
      map: createGroundTexture(),
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    arenaGroup.add(ground);

    // Walls (translucent glowing borders)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xFF69B4,
      transparent: true,
      opacity: 0.15,
      emissive: 0xFF69B4,
      emissiveIntensity: 0.3,
    });

    const wallData = [
      { w: W, d: 0.2, x: 0, z: -D / 2 },  // front
      { w: W, d: 0.2, x: 0, z: D / 2 },   // back
      { w: 0.2, d: D, x: -W / 2, z: 0 },  // left
      { w: 0.2, d: D, x: W / 2, z: 0 },   // right
    ];

    for (const wd of wallData) {
      const geo = new THREE.BoxGeometry(wd.w, wallH, wd.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(wd.x, wallH / 2, wd.z);
      arenaGroup.add(mesh);
    }

    // Corner pillars
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      emissive: 0xFFD700,
      emissiveIntensity: 0.2,
    });

    const corners = [
      [-W / 2, -D / 2], [W / 2, -D / 2],
      [-W / 2, D / 2], [W / 2, D / 2],
    ];

    for (const [cx, cz] of corners) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, wallH + 0.5, 8),
        pillarMat
      );
      pillar.position.set(cx, (wallH + 0.5) / 2, cz);
      arenaGroup.add(pillar);
    }

    // Center decorative heart (flat)
    const heartShape = new THREE.Shape();
    const s = 1.5;
    heartShape.moveTo(0, s * 0.4);
    heartShape.bezierCurveTo(0, s * 0.7, -s * 0.6, s * 0.7, -s * 0.6, s * 0.4);
    heartShape.bezierCurveTo(-s * 0.6, 0, 0, -s * 0.2, 0, -s * 0.6);
    heartShape.bezierCurveTo(0, -s * 0.2, s * 0.6, 0, s * 0.6, s * 0.4);
    heartShape.bezierCurveTo(s * 0.6, s * 0.7, 0, s * 0.7, 0, s * 0.4);

    const heartGeo = new THREE.ShapeGeometry(heartShape);
    const heartMat = new THREE.MeshStandardMaterial({
      color: 0xFF69B4,
      transparent: true,
      opacity: 0.12,
      emissive: 0xFF69B4,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
    });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.rotation.x = -Math.PI / 2;
    heartMesh.position.y = 0.02;
    arenaGroup.add(heartMesh);

    scene.add(arenaGroup);
  }

  // --- Player Management ---

  function getOrCreatePlayer(playerId, characterId) {
    if (playerMeshes.has(playerId)) return playerMeshes.get(playerId);

    if (!charTextures[characterId]) {
      charTextures[characterId] = createCharacterTexture(characterId);
    }
    const mat = new THREE.SpriteMaterial({ map: charTextures[characterId], transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 2.4, 1);
    sprite.position.y = 1.2;

    // Shadow circle
    const shadowGeo = new THREE.CircleGeometry(0.5, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;

    const group = new THREE.Group();
    group.add(sprite);
    group.add(shadow);
    scene.add(group);

    const data = { group, sprite, characterId };
    playerMeshes.set(playerId, data);
    playerTargets[playerId] = { x: 0, z: 0, rotation: 0 };

    return data;
  }

  function removePlayer(playerId) {
    const data = playerMeshes.get(playerId);
    if (data) {
      scene.remove(data.group);
      playerMeshes.delete(playerId);
      delete playerTargets[playerId];
    }
  }

  function updatePlayerTarget(playerId, x, z, rotation) {
    if (!playerTargets[playerId]) {
      playerTargets[playerId] = { x, z, rotation };
    }
    playerTargets[playerId].x = x;
    playerTargets[playerId].z = z;
    playerTargets[playerId].rotation = rotation;
  }

  function setPlayerImmediate(playerId, x, z) {
    const data = playerMeshes.get(playerId);
    if (data) {
      data.group.position.x = x;
      data.group.position.z = z;
    }
    if (playerTargets[playerId]) {
      playerTargets[playerId].x = x;
      playerTargets[playerId].z = z;
    }
  }

  // --- Projectile Management ---

  const projTextures = {};
  const charTextures = {};

  function spawnProjectile(id, ownerId, x, z, vx, vz, characterId) {
    if (projectileMeshes.has(id)) return;

    if (!projTextures[characterId]) {
      projTextures[characterId] = createProjectileTexture(characterId);
    }

    const mat = new THREE.SpriteMaterial({
      map: projTextures[characterId],
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.6, 0.6, 0.6);
    sprite.position.set(x, 0.8, z);
    scene.add(sprite);

    // Trail particles
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(30 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.PointsMaterial({
      color: GAME_CONFIG.CHARACTERS[characterId].projectileColor,
      size: 0.15,
      transparent: true,
      opacity: 0.5,
    });
    const trail = new THREE.Points(trailGeo, trailMat);
    scene.add(trail);

    projectileMeshes.set(id, {
      sprite, trail, vx, vz,
      trailPositions: [],
      characterId,
    });
  }

  function removeProjectile(id) {
    const data = projectileMeshes.get(id);
    if (data) {
      scene.remove(data.sprite);
      scene.remove(data.trail);
      data.sprite.material.dispose();
      data.trail.geometry.dispose();
      data.trail.material.dispose();
      projectileMeshes.delete(id);
    }
  }

  // --- Hit Effects ---

  function spawnHitEffect(x, z, characterId) {
    const charCfg = GAME_CONFIG.CHARACTERS[characterId];
    const color = new THREE.Color(charCfg.projectileColor);

    const count = 12;
    const particles = [];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.08, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.8, z);

      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      mesh.userData.vx = Math.cos(angle) * speed;
      mesh.userData.vy = 2 + Math.random() * 3;
      mesh.userData.vz = Math.sin(angle) * speed;
      mesh.userData.life = 0.6 + Math.random() * 0.3;

      effectsGroup.add(mesh);
      particles.push(mesh);
    }

    activeEffects.push({
      particles,
      elapsed: 0,
      type: charCfg.hitEffect,
    });
  }

  // --- Update Loop ---

  function update() {
    const dt = clock.getDelta();
    const lerp = GAME_CONFIG.INTERPOLATION_FACTOR;

    // Interpolate player positions
    for (const [pid, data] of playerMeshes) {
      const target = playerTargets[pid];
      if (!target) continue;

      data.group.position.x += (target.x - data.group.position.x) * lerp;
      data.group.position.z += (target.z - data.group.position.z) * lerp;
    }

    // Update projectile positions locally
    for (const [id, data] of projectileMeshes) {
      data.sprite.position.x += data.vx * dt;
      data.sprite.position.z += data.vz * dt;

      // Update trail
      data.trailPositions.unshift({
        x: data.sprite.position.x,
        y: data.sprite.position.y,
        z: data.sprite.position.z,
      });
      if (data.trailPositions.length > 10) data.trailPositions.pop();

      const positions = data.trail.geometry.attributes.position.array;
      for (let i = 0; i < 30; i++) {
        const tp = data.trailPositions[Math.min(i, data.trailPositions.length - 1)];
        if (tp) {
          positions[i * 3] = tp.x;
          positions[i * 3 + 1] = tp.y;
          positions[i * 3 + 2] = tp.z;
        }
      }
      data.trail.geometry.attributes.position.needsUpdate = true;

      // Remove if way out of bounds
      const hw = GAME_CONFIG.ARENA_WIDTH / 2 + 5;
      const hd = GAME_CONFIG.ARENA_DEPTH / 2 + 5;
      if (Math.abs(data.sprite.position.x) > hw || Math.abs(data.sprite.position.z) > hd) {
        removeProjectile(id);
      }
    }

    // Update hit effects
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const effect = activeEffects[i];
      effect.elapsed += dt;

      let allDead = true;
      for (const p of effect.particles) {
        p.userData.life -= dt;
        if (p.userData.life <= 0) {
          p.visible = false;
          continue;
        }
        allDead = false;

        p.position.x += p.userData.vx * dt;
        p.position.y += p.userData.vy * dt;
        p.position.z += p.userData.vz * dt;
        p.userData.vy -= 9.8 * dt; // gravity

        p.material.opacity = Math.max(0, p.userData.life / 0.8);
        const s = 0.5 + p.userData.life;
        p.scale.set(s, s, s);
      }

      if (allDead) {
        for (const p of effect.particles) {
          effectsGroup.remove(p);
          p.geometry.dispose();
          p.material.dispose();
        }
        activeEffects.splice(i, 1);
      }
    }

    // Render
    renderer.render(scene, camera);
  }

  // --- Sync projectiles with server state ---
  function syncProjectiles(serverProjectiles, getCharacterId) {
    const serverIds = new Set(serverProjectiles.map(p => p.id));

    // Remove projectiles not in server state
    for (const [id] of projectileMeshes) {
      if (!serverIds.has(id)) {
        removeProjectile(id);
      }
    }

    // Update existing / spawn new
    for (const sp of serverProjectiles) {
      const existing = projectileMeshes.get(sp.id);
      if (existing) {
        // Gentle correction to server position
        existing.sprite.position.x += (sp.x - existing.sprite.position.x) * 0.3;
        existing.sprite.position.z += (sp.z - existing.sprite.position.z) * 0.3;
        existing.vx = sp.vx;
        existing.vz = sp.vz;
      }
      // Don't re-spawn – they come via PROJECTILE_SPAWN message
    }
  }

  function clearAllProjectiles() {
    for (const [id] of projectileMeshes) {
      removeProjectile(id);
    }
  }

  function clearAllPlayers() {
    for (const [id] of playerMeshes) {
      removePlayer(id);
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return {
    init,
    update,
    getOrCreatePlayer,
    removePlayer,
    updatePlayerTarget,
    setPlayerImmediate,
    spawnProjectile,
    removeProjectile,
    syncProjectiles,
    clearAllProjectiles,
    clearAllPlayers,
    spawnHitEffect,
  };
})();
