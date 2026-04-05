/**
 * Easter Arcade – Three.js Renderer
 * Procedurally generates Easter-themed arena, characters, projectiles, effects.
 * All assets are runtime-generated — no external images.
 */

const EasterRenderer = (function () {
  let scene, camera, renderer;
  let playerMesh, playerGlow;
  const enemyMeshes = new Map();
  const projectileMeshes = new Map();
  const enemyProjMeshes = new Map();
  const powerupMeshes = new Map();
  const particles = [];
  const floatingTexts = [];
  let bossMesh = null;
  let bossHpBar = null;
  let arenaGroup;
  let wallMeshes = [];
  let shakeIntensity = 0;
  let shakeDecay = 0;
  let _freezeFrameUntil = 0;

  // Reusable geometry
  let sphereGeo, boxGeo, planeGeo;

  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(EASTER.THEME.skyColor);
    scene.fog = new THREE.Fog(EASTER.THEME.fogColor, EASTER.THEME.fogNear, EASTER.THEME.fogFar);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 22, 16);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambient = new THREE.AmbientLight(EASTER.THEME.ambientColor, 0.7);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xFFFFDD, 0.8);
    sun.position.set(10, 20, 8);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88AAFF, 0.3);
    fill.position.set(-8, 10, -5);
    scene.add(fill);

    // Shared geometry
    sphereGeo = new THREE.SphereGeometry(1, 12, 8);
    boxGeo = new THREE.BoxGeometry(1, 1, 1);
    planeGeo = new THREE.PlaneGeometry(1, 1);

    _buildArena();
    _buildPlayer();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function _buildArena() {
    arenaGroup = new THREE.Group();
    const w = EASTER.ARENA_WIDTH;
    const d = EASTER.ARENA_DEPTH;

    // Ground — green grass
    const groundGeo = new THREE.PlaneGeometry(w + 4, d + 4);
    const groundTex = _createGrassTexture();
    const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    arenaGroup.add(ground);

    // Walls — wooden fence look
    const wallH = EASTER.ARENA_WALL_HEIGHT;
    const wallColor = EASTER.THEME.wallColor;
    const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });

    const walls = [
      { sx: w + 0.4, sy: wallH, sz: 0.4, px: 0, pz: -d / 2 },
      { sx: w + 0.4, sy: wallH, sz: 0.4, px: 0, pz: d / 2 },
      { sx: 0.4, sy: wallH, sz: d, px: -w / 2, pz: 0 },
      { sx: 0.4, sy: wallH, sz: d, px: w / 2, pz: 0 },
    ];

    wallMeshes = [];
    for (const wl of walls) {
      const geo = new THREE.BoxGeometry(wl.sx, wl.sy, wl.sz);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(wl.px, wl.sy / 2, wl.pz);
      arenaGroup.add(mesh);
      wallMeshes.push(mesh);
    }

    // Corner posts — colorful Easter egg pillars
    const postGeo = new THREE.CylinderGeometry(0.3, 0.4, wallH + 0.5, 8);
    const colors = EASTER.THEME.flowerColors;
    const corners = [
      [-w / 2, -d / 2], [w / 2, -d / 2],
      [-w / 2, d / 2], [w / 2, d / 2],
    ];
    corners.forEach((c, i) => {
      const mat = new THREE.MeshLambertMaterial({ color: colors[i % colors.length] });
      const post = new THREE.Mesh(postGeo, mat);
      post.position.set(c[0], (wallH + 0.5) / 2, c[1]);
      arenaGroup.add(post);
    });

    // Scatter small flowers on the ground
    for (let i = 0; i < 40; i++) {
      const fx = (Math.random() - 0.5) * (w - 2);
      const fz = (Math.random() - 0.5) * (d - 2);
      const fColor = colors[Math.floor(Math.random() * colors.length)];
      const flowerGeo = new THREE.SphereGeometry(0.12, 6, 4);
      const flowerMat = new THREE.MeshLambertMaterial({ color: fColor });
      const flower = new THREE.Mesh(flowerGeo, flowerMat);
      flower.position.set(fx, 0.08, fz);
      arenaGroup.add(flower);
    }

    scene.add(arenaGroup);
  }

  function _createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base green
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 256, 256);

    // Grass variation
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = 60 + Math.random() * 40;
      ctx.fillStyle = `rgb(${shade}, ${130 + Math.random() * 60}, ${shade})`;
      ctx.fillRect(x, y, 2, 4);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  function _buildPlayer() {
    // Easter bunny — simple sphere body with ear cones
    const bodyMat = new THREE.MeshLambertMaterial({ color: '#FFFFFF' });
    playerMesh = new THREE.Group();

    const body = new THREE.Mesh(sphereGeo, bodyMat);
    body.scale.set(0.5, 0.6, 0.5);
    body.position.y = 0.5;
    playerMesh.add(body);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.1, 0.5, 6);
    const earMat = new THREE.MeshLambertMaterial({ color: '#FFB6C1' });
    const earL = new THREE.Mesh(earGeo, earMat);
    earL.position.set(-0.15, 1.15, 0);
    earL.rotation.z = 0.15;
    playerMesh.add(earL);

    const earR = new THREE.Mesh(earGeo, earMat);
    earR.position.set(0.15, 1.15, 0);
    earR.rotation.z = -0.15;
    playerMesh.add(earR);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#222222' });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 0.65, 0.4);
    playerMesh.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.12, 0.65, 0.4);
    playerMesh.add(eyeR);

    // Glow ring for shield / invuln
    const glowGeo = new THREE.RingGeometry(0.6, 0.75, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: '#00CED1', transparent: true, opacity: 0, side: THREE.DoubleSide });
    playerGlow = new THREE.Mesh(glowGeo, glowMat);
    playerGlow.rotation.x = -Math.PI / 2;
    playerGlow.position.y = 0.05;
    playerMesh.add(playerGlow);

    scene.add(playerMesh);
  }

  function updatePlayer(x, z, rotation, hasShield, isInvuln) {
    playerMesh.position.set(x, 0, z);
    playerMesh.rotation.y = rotation;

    // Shield / invuln glow
    if (hasShield) {
      playerGlow.material.opacity = 0.4 + Math.sin(performance.now() / 200) * 0.2;
      playerGlow.material.color.setHex(0x00CED1);
    } else if (isInvuln) {
      playerGlow.material.opacity = 0.3 + Math.sin(performance.now() / 100) * 0.3;
      playerGlow.material.color.setHex(0xFF4444);
    } else {
      playerGlow.material.opacity = 0;
    }
  }

  function addEnemy(enemy) {
    const group = new THREE.Group();
    const color = enemy.color;

    if (enemy.type === 'boss') {
      // Boss: large ornate egg
      const bodyMat = new THREE.MeshLambertMaterial({ color: color });
      const body = new THREE.Mesh(sphereGeo, bodyMat);
      body.scale.set(enemy.radius, enemy.radius * 1.3, enemy.radius);
      body.position.y = enemy.radius;
      group.add(body);

      // Crown
      const crownGeo = new THREE.ConeGeometry(0.4, 0.6, 5);
      const crownMat = new THREE.MeshLambertMaterial({ color: '#FFD700' });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = enemy.radius * 2 + 0.3;
      group.add(crown);

      bossMesh = group;
    } else {
      // Egg-shaped enemies
      const mat = new THREE.MeshLambertMaterial({ color: color });
      const body = new THREE.Mesh(sphereGeo, mat);
      body.scale.set(enemy.radius, enemy.radius * 1.2, enemy.radius);
      body.position.y = enemy.radius;
      group.add(body);

      // Shield indicator for golden_egg
      if (enemy.shielded) {
        const shieldGeo = new THREE.SphereGeometry(1, 10, 8);
        const shieldMat = new THREE.MeshBasicMaterial({
          color: '#FFD700',
          transparent: true,
          opacity: 0.25,
          wireframe: true,
        });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.scale.set(enemy.radius + 0.2, enemy.radius * 1.2 + 0.2, enemy.radius + 0.2);
        shield.position.y = enemy.radius;
        shield.name = 'shield';
        group.add(shield);
      }

      // Jack Rabbit charge indicator
      if (enemy.behavior === 'ambush') {
        const indicGeo = new THREE.RingGeometry(0.3, 0.4, 8);
        const indicMat = new THREE.MeshBasicMaterial({ color: '#FF0000', transparent: true, opacity: 0, side: THREE.DoubleSide });
        const indic = new THREE.Mesh(indicGeo, indicMat);
        indic.rotation.x = -Math.PI / 2;
        indic.position.y = 0.05;
        indic.name = 'chargeIndicator';
        group.add(indic);
      }
    }

    group.position.set(enemy.x, 0, enemy.z);
    scene.add(group);
    enemyMeshes.set(enemy.id, group);
  }

  function updateEnemyMesh(enemy) {
    const mesh = enemyMeshes.get(enemy.id);
    if (!mesh) return;

    mesh.position.set(enemy.x, 0, enemy.z);

    // Update shield visibility
    const shieldMesh = mesh.getObjectByName('shield');
    if (shieldMesh) {
      shieldMesh.visible = enemy.shielded;
    }

    // Jack Rabbit charge-up indicator
    const chargeIndic = mesh.getObjectByName('chargeIndicator');
    if (chargeIndic && enemy.behavior === 'ambush') {
      if (enemy.ambushState === 'idle') {
        const cfg = EASTER.ENEMIES.jack_rabbit;
        const progress = enemy.ambushTimer / cfg.idleTime;
        chargeIndic.material.opacity = progress * 0.7;
        chargeIndic.scale.set(1 + progress, 1 + progress, 1);
      } else {
        chargeIndic.material.opacity = 0;
      }
    }

    // Bobbing animation
    const bobY = Math.sin(performance.now() / 300 + enemy.id) * 0.05;
    mesh.children[0].position.y = enemy.radius + bobY;
  }

  function removeEnemyMesh(enemyId) {
    const mesh = enemyMeshes.get(enemyId);
    if (mesh) {
      scene.remove(mesh);
      enemyMeshes.delete(enemyId);
    }
    if (bossMesh && enemyId === 'boss') {
      bossMesh = null;
    }
  }

  function addProjectile(proj) {
    const color = proj.color || EasterProgress.getSelectedEggColor();
    const mat = new THREE.MeshBasicMaterial({ color: color });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    const r = proj.radius || EASTER.PROJECTILE_RADIUS;
    mesh.scale.set(r, r * 1.3, r);
    mesh.position.set(proj.x, 0.4, proj.z);
    scene.add(mesh);
    projectileMeshes.set(proj.id, mesh);
  }

  function updateProjectileMesh(proj) {
    const mesh = projectileMeshes.get(proj.id);
    if (mesh) {
      mesh.position.set(proj.x, 0.4, proj.z);
    }
  }

  function removeProjectileMesh(projId) {
    const mesh = projectileMeshes.get(projId);
    if (mesh) {
      scene.remove(mesh);
      projectileMeshes.delete(projId);
    }
  }

  function addEnemyProjectile(proj) {
    const mat = new THREE.MeshBasicMaterial({ color: proj.color || '#9B59B6' });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    const r = proj.radius || 0.3;
    mesh.scale.set(r, r, r);
    mesh.position.set(proj.x, 0.5, proj.z);
    scene.add(mesh);
    enemyProjMeshes.set(proj.id, mesh);
  }

  function updateEnemyProjectileMesh(proj) {
    const mesh = enemyProjMeshes.get(proj.id);
    if (mesh) mesh.position.set(proj.x, 0.5, proj.z);
  }

  function removeEnemyProjectileMesh(projId) {
    const mesh = enemyProjMeshes.get(projId);
    if (mesh) {
      scene.remove(mesh);
      enemyProjMeshes.delete(projId);
    }
  }

  function addPowerup(pu) {
    const mat = new THREE.MeshLambertMaterial({ color: pu.color, emissive: pu.color, emissiveIntensity: 0.3 });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.set(0.35, 0.45, 0.35);
    mesh.position.set(pu.x, 0.6, pu.z);
    scene.add(mesh);
    powerupMeshes.set(pu.id, mesh);
  }

  function updatePowerupMesh(pu) {
    const mesh = powerupMeshes.get(pu.id);
    if (mesh) {
      mesh.position.y = 0.6 + Math.sin(performance.now() / 400) * 0.15;
      mesh.rotation.y = performance.now() / 600;
    }
  }

  function removePowerupMesh(puId) {
    const mesh = powerupMeshes.get(puId);
    if (mesh) {
      scene.remove(mesh);
      powerupMeshes.delete(puId);
    }
  }

  // --- Particle Effects ---
  function spawnHitParticles(x, z, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 3 + Math.random() * 4;
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.set(0.08, 0.08, 0.08);
      mesh.position.set(x, 0.5, z);
      scene.add(mesh);
      particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.3,
        age: 0,
      });
    }
  }

  function spawnDeathEffect(x, z, color) {
    spawnHitParticles(x, z, color, 12);
    // Extra confetti
    const confettiColors = EASTER.THEME.flowerColors;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const c = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.scale.set(0.08, 0.08, 0.04);
      mesh.position.set(x, 0.5, z);
      scene.add(mesh);
      particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 4 + Math.random() * 4,
        vz: Math.sin(angle) * speed,
        life: 1.0,
        age: 0,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  function spawnBossDeathEffect(x, z) {
    // Massive explosion
    const colors = ['#FFD700', '#FF69B4', '#9B59B6', '#FF6347', '#87CEEB'];
    for (let wave = 0; wave < 3; wave++) {
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (3 + wave * 2) + Math.random() * 4;
        const c = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(sphereGeo, mat);
        const s = 0.1 + Math.random() * 0.1;
        mesh.scale.set(s, s, s);
        mesh.position.set(x, 0.5 + wave * 0.3, z);
        scene.add(mesh);
        particles.push({
          mesh,
          vx: Math.cos(angle) * speed,
          vy: 3 + Math.random() * 5 + wave * 2,
          vz: Math.sin(angle) * speed,
          life: 1.2 + wave * 0.3,
          age: wave * 0.15, // Negative = delayed start
          delay: wave * 0.15,
        });
      }
    }
  }

  function spawnCollectEffect(x, z, color) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.set(0.06, 0.06, 0.06);
      mesh.position.set(x, 0.6, z);
      scene.add(mesh);
      particles.push({
        mesh,
        vx: Math.cos(angle) * 2,
        vy: 3 + Math.random() * 2,
        vz: Math.sin(angle) * 2,
        life: 0.5,
        age: 0,
      });
    }
  }

  function spawnFloatingText(x, z, text, color) {
    floatingTexts.push({
      x, z,
      text,
      color,
      y: 1.5,
      life: 1.0,
      age: 0,
    });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Handle delayed particles
      if (p.delay && p.delay > 0) {
        p.delay -= dt;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;

      p.age += dt;
      if (p.age >= p.life) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 12 * dt; // gravity

      if (p.spin) {
        p.mesh.rotation.z += p.spin * dt;
      }

      const t = p.age / p.life;
      p.mesh.material.opacity = 1 - t;
      const s = 1 - t * 0.5;
      const baseScale = p.mesh.scale.x / (1 - (p.age - dt) / p.life * 0.5 || 1);
    }

    // Update floating texts (handled by UI overlay)
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.age += dt;
      ft.y += dt * 2;
      if (ft.age >= ft.life) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  // --- Screen Shake ---
  function triggerShake(intensity) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDecay = shakeIntensity;
  }

  function freezeFrame(durationMs) {
    _freezeFrameUntil = performance.now() + durationMs;
  }

  function isFrozen() {
    return performance.now() < _freezeFrameUntil;
  }

  // --- Arena shrink for boss enrage ---
  function setArenaShrink(amount) {
    if (wallMeshes.length < 4) return;
    const w = EASTER.ARENA_WIDTH;
    const d = EASTER.ARENA_DEPTH;
    wallMeshes[0].position.z = -(d / 2 - amount);
    wallMeshes[1].position.z = d / 2 - amount;
    wallMeshes[2].position.x = -(w / 2 - amount);
    wallMeshes[3].position.x = w / 2 - amount;
  }

  function render() {
    if (isFrozen()) return;

    // Apply screen shake
    const baseX = 0;
    const baseZ = 16;
    if (shakeIntensity > 0.01) {
      camera.position.x = baseX + (Math.random() - 0.5) * shakeIntensity;
      camera.position.z = baseZ + (Math.random() - 0.5) * shakeIntensity;
      shakeIntensity *= 0.9;
    } else {
      camera.position.x = baseX;
      camera.position.z = baseZ;
      shakeIntensity = 0;
    }

    renderer.render(scene, camera);
  }

  function getFloatingTexts() {
    return floatingTexts;
  }

  function worldToScreen(x, y, z) {
    const vec = new THREE.Vector3(x, y, z);
    vec.project(camera);
    return {
      x: (vec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function cleanup() {
    // Remove all dynamic meshes
    for (const [, m] of enemyMeshes) scene.remove(m);
    for (const [, m] of projectileMeshes) scene.remove(m);
    for (const [, m] of enemyProjMeshes) scene.remove(m);
    for (const [, m] of powerupMeshes) scene.remove(m);
    for (const p of particles) scene.remove(p.mesh);
    enemyMeshes.clear();
    projectileMeshes.clear();
    enemyProjMeshes.clear();
    powerupMeshes.clear();
    particles.length = 0;
    floatingTexts.length = 0;
    bossMesh = null;
    setArenaShrink(0);
  }

  return {
    init,
    updatePlayer,
    addEnemy,
    updateEnemyMesh,
    removeEnemyMesh,
    addProjectile,
    updateProjectileMesh,
    removeProjectileMesh,
    addEnemyProjectile,
    updateEnemyProjectileMesh,
    removeEnemyProjectileMesh,
    addPowerup,
    updatePowerupMesh,
    removePowerupMesh,
    spawnHitParticles,
    spawnDeathEffect,
    spawnBossDeathEffect,
    spawnCollectEffect,
    spawnFloatingText,
    updateParticles,
    triggerShake,
    freezeFrame,
    isFrozen,
    setArenaShrink,
    render,
    getFloatingTexts,
    worldToScreen,
    cleanup,
  };
})();
