/**
 * Easter Arcade – UI System
 * HUD, combo display, wave announcements, progression panel, mobile controls.
 */

const EasterUI = (function () {
  let _elements = {};
  let _floatingTextCtx = null;
  let _mobileControlsActive = false;
  let _moveJoystick = null;
  let _aimJoystick = null;

  // Callbacks
  let _onStartGame = null;
  let _onSelectModifier = null;
  let _onPurchaseEgg = null;
  let _onSelectEgg = null;
  let _onPurchaseUpgrade = null;

  function init(callbacks) {
    _onStartGame = callbacks.onStartGame;
    _onSelectModifier = callbacks.onSelectModifier;

    _elements = {
      hud: document.getElementById('easter-hud'),
      score: document.getElementById('e-score'),
      wave: document.getElementById('e-wave'),
      combo: document.getElementById('e-combo'),
      comboBar: document.getElementById('e-combo-bar'),
      hp: document.getElementById('e-hp'),
      coins: document.getElementById('e-coins'),
      powerupBar: document.getElementById('e-powerup-bar'),
      bossBar: document.getElementById('e-boss-bar'),
      bossHpFill: document.getElementById('e-boss-hp-fill'),
      bossName: document.getElementById('e-boss-name'),
      centerMsg: document.getElementById('e-center-msg'),
      centerTitle: document.getElementById('e-center-title'),
      centerSub: document.getElementById('e-center-sub'),
      gameOver: document.getElementById('e-gameover'),
      goScore: document.getElementById('e-go-score'),
      goWave: document.getElementById('e-go-wave'),
      goCoins: document.getElementById('e-go-coins'),
      goMissions: document.getElementById('e-go-missions'),
      goHighScore: document.getElementById('e-go-highscore'),
      restartBtn: document.getElementById('e-restart-btn'),
      menuBtn: document.getElementById('e-menu-btn'),
      preRun: document.getElementById('e-prerun'),
      missionList: document.getElementById('e-mission-list'),
      modifierList: document.getElementById('e-modifier-list'),
      startBtn: document.getElementById('e-start-btn'),
      progressBtn: document.getElementById('e-progress-btn'),
      progressPanel: document.getElementById('e-progress-panel'),
      progressClose: document.getElementById('e-progress-close'),
      tabEggs: document.getElementById('e-tab-eggs'),
      tabUpgrades: document.getElementById('e-tab-upgrades'),
      tabBadges: document.getElementById('e-tab-badges'),
      eggsGrid: document.getElementById('e-eggs-grid'),
      upgradesGrid: document.getElementById('e-upgrades-grid'),
      badgesGrid: document.getElementById('e-badges-grid'),
      progressCoins: document.getElementById('e-progress-coins'),
      mobileControls: document.getElementById('e-mobile-controls'),
      moveZone: document.getElementById('e-move-zone'),
      aimZone: document.getElementById('e-aim-zone'),
      missionsHud: document.getElementById('e-missions-hud'),
      floatCanvas: document.getElementById('e-float-canvas'),
      vignette: document.getElementById('e-vignette'),
    };

    // Floating text canvas
    if (_elements.floatCanvas) {
      _elements.floatCanvas.width = window.innerWidth;
      _elements.floatCanvas.height = window.innerHeight;
      _floatingTextCtx = _elements.floatCanvas.getContext('2d');
      window.addEventListener('resize', () => {
        _elements.floatCanvas.width = window.innerWidth;
        _elements.floatCanvas.height = window.innerHeight;
      });
    }

    // Button handlers
    if (_elements.startBtn) {
      _elements.startBtn.addEventListener('click', () => {
        if (_onStartGame) _onStartGame();
      });
    }
    if (_elements.restartBtn) {
      _elements.restartBtn.addEventListener('click', () => {
        if (_onStartGame) _onStartGame();
      });
    }
    if (_elements.menuBtn) {
      _elements.menuBtn.addEventListener('click', () => {
        window.location.href = '/';
      });
    }

    // Progress panel
    if (_elements.progressBtn) {
      _elements.progressBtn.addEventListener('click', () => _showProgressPanel());
    }
    if (_elements.progressClose) {
      _elements.progressClose.addEventListener('click', () => _hideProgressPanel());
    }

    // Tab switching
    if (_elements.tabEggs) _elements.tabEggs.addEventListener('click', () => _switchTab('eggs'));
    if (_elements.tabUpgrades) _elements.tabUpgrades.addEventListener('click', () => _switchTab('upgrades'));
    if (_elements.tabBadges) _elements.tabBadges.addEventListener('click', () => _switchTab('badges'));

    // Mobile detection
    _detectMobile();
  }

  function _detectMobile() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile && _elements.mobileControls) {
      _mobileControlsActive = true;
      _elements.mobileControls.classList.add('active');
      _initJoysticks();
    }
  }

  function _initJoysticks() {
    _moveJoystick = _createJoystick(_elements.moveZone);
    _aimJoystick = _createJoystick(_elements.aimZone);
  }

  function _createJoystick(container) {
    if (!container) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 140;
    canvas.style.opacity = '0.5';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const state = { x: 0, z: 0, active: false, touchId: null };
    const cx = 70, cy = 70, radius = 50;

    function draw() {
      ctx.clearRect(0, 0, 140, 140);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(80,200,120,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const knobX = cx + state.x * radius * 0.7;
      const knobY = cy + state.z * radius * 0.7;
      ctx.beginPath();
      ctx.arc(knobX, knobY, 18, 0, Math.PI * 2);
      ctx.fillStyle = state.active ? 'rgba(80,200,120,0.6)' : 'rgba(80,200,120,0.3)';
      ctx.fill();
    }

    function handleTouch(e) {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        const tx = touch.clientX - rect.left - cx;
        const ty = touch.clientY - rect.top - cy;
        const dist = Math.hypot(tx, ty);
        const clamped = Math.min(dist, radius);
        if (dist > 0) {
          state.x = (tx / dist) * (clamped / radius);
          state.z = (ty / dist) * (clamped / radius);
        }
        state.active = true;
        state.touchId = touch.identifier;
      }
      draw();
    }

    function handleEnd(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier === state.touchId) {
          state.x = 0;
          state.z = 0;
          state.active = false;
          state.touchId = null;
        }
      }
      draw();
    }

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleEnd);
    canvas.addEventListener('touchcancel', handleEnd);

    draw();
    return state;
  }

  function getMobileInput() {
    if (!_mobileControlsActive) return null;
    return {
      move: _moveJoystick ? { x: _moveJoystick.x, z: _moveJoystick.z } : { x: 0, z: 0 },
      aim: _aimJoystick ? { x: _aimJoystick.x, z: _aimJoystick.z } : { x: 0, z: 0 },
      aimActive: _aimJoystick ? _aimJoystick.active : false,
    };
  }

  function isMobile() {
    return _mobileControlsActive;
  }

  // --- HUD Updates ---
  function updateScore(score) {
    if (_elements.score) _elements.score.textContent = score.toLocaleString();
  }

  function updateWave(wave) {
    if (_elements.wave) _elements.wave.textContent = 'Wave ' + wave;
  }

  function updateCombo(combo, timeLeft, maxTime) {
    if (_elements.combo) {
      if (combo > 1) {
        _elements.combo.textContent = 'x' + combo;
        _elements.combo.classList.add('active');
        _elements.combo.style.transform = 'scale(' + (1 + Math.min(combo * 0.05, 0.5)) + ')';
        if (combo >= 5) _elements.combo.classList.add('mega');
        else _elements.combo.classList.remove('mega');
      } else {
        _elements.combo.classList.remove('active', 'mega');
        _elements.combo.textContent = '';
        _elements.combo.style.transform = '';
      }
    }
    if (_elements.comboBar) {
      const pct = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;
      _elements.comboBar.style.width = pct + '%';
      _elements.comboBar.style.opacity = combo > 1 ? '1' : '0';
    }
  }

  function updateHP(hp, maxHp) {
    if (_elements.hp) {
      let hearts = '';
      for (let i = 0; i < maxHp; i++) {
        hearts += i < hp ? '<span class="heart full">&#x1F49A;</span>' : '<span class="heart empty">&#x1F5A4;</span>';
      }
      _elements.hp.innerHTML = hearts;
    }
  }

  function updateCoins(coins) {
    if (_elements.coins) _elements.coins.textContent = coins;
  }

  function updateActivePowerup(name, timeLeft) {
    if (_elements.powerupBar) {
      if (name && timeLeft > 0) {
        _elements.powerupBar.textContent = name + ' ' + (timeLeft / 1000).toFixed(1) + 's';
        _elements.powerupBar.classList.add('active');
      } else {
        _elements.powerupBar.textContent = '';
        _elements.powerupBar.classList.remove('active');
      }
    }
  }

  function showBossBar(name, hpPercent) {
    if (_elements.bossBar) {
      _elements.bossBar.classList.add('visible');
      if (_elements.bossName) _elements.bossName.textContent = name;
      if (_elements.bossHpFill) _elements.bossHpFill.style.width = (hpPercent * 100) + '%';
    }
  }

  function hideBossBar() {
    if (_elements.bossBar) _elements.bossBar.classList.remove('visible');
  }

  function showCenterMessage(title, sub, duration) {
    if (_elements.centerMsg) {
      if (_elements.centerTitle) _elements.centerTitle.textContent = title;
      if (_elements.centerSub) _elements.centerSub.textContent = sub || '';
      _elements.centerMsg.classList.add('visible');
      if (duration) {
        setTimeout(() => {
          _elements.centerMsg.classList.remove('visible');
        }, duration);
      }
    }
  }

  function hideCenterMessage() {
    if (_elements.centerMsg) _elements.centerMsg.classList.remove('visible');
  }

  function showVignette(color) {
    if (_elements.vignette) {
      _elements.vignette.style.boxShadow = 'inset 0 0 80px ' + color;
      _elements.vignette.classList.add('active');
    }
  }

  function hideVignette() {
    if (_elements.vignette) _elements.vignette.classList.remove('active');
  }

  // --- Pre-run Screen ---
  function showPreRun(missions, modifiers, selectedModifier) {
    if (_elements.preRun) _elements.preRun.classList.add('visible');
    if (_elements.gameOver) _elements.gameOver.classList.remove('visible');
    if (_elements.hud) _elements.hud.style.display = 'none';

    // Render missions
    if (_elements.missionList) {
      _elements.missionList.innerHTML = missions.map(m =>
        '<div class="mission-item"><span class="mission-icon">&#x1F3AF;</span> ' + m.desc +
        ' <span class="mission-reward">+' + m.reward + ' coins</span></div>'
      ).join('');
    }

    // Render modifiers
    if (_elements.modifierList) {
      _elements.modifierList.innerHTML = modifiers.map(m =>
        '<button class="modifier-btn' + (selectedModifier && selectedModifier.id === m.id ? ' selected' : '') +
        '" data-id="' + m.id + '">' +
        '<div class="mod-name">' + m.name + '</div>' +
        '<div class="mod-desc">' + m.desc + '</div>' +
        '</button>'
      ).join('');

      _elements.modifierList.querySelectorAll('.modifier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const modId = btn.dataset.id;
          _elements.modifierList.querySelectorAll('.modifier-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          if (_onSelectModifier) _onSelectModifier(modId);
        });
      });
    }
  }

  function hidePreRun() {
    if (_elements.preRun) _elements.preRun.classList.remove('visible');
    if (_elements.hud) _elements.hud.style.display = '';
  }

  // --- Game Over Screen ---
  function showGameOver(score, wave, coinsEarned, missions, highScore) {
    if (_elements.gameOver) _elements.gameOver.classList.add('visible');
    if (_elements.hud) _elements.hud.style.display = 'none';

    if (_elements.goScore) _elements.goScore.textContent = score.toLocaleString();
    if (_elements.goWave) _elements.goWave.textContent = wave;
    if (_elements.goCoins) _elements.goCoins.textContent = '+' + coinsEarned;
    if (_elements.goHighScore) _elements.goHighScore.textContent = highScore.toLocaleString();

    if (_elements.goMissions) {
      _elements.goMissions.innerHTML = missions.map(m =>
        '<div class="mission-result ' + (m.completed ? 'done' : 'fail') + '">' +
        (m.completed ? '&#x2705;' : '&#x274C;') + ' ' + m.desc +
        (m.completed ? ' <span class="mission-reward">+' + m.reward + '</span>' : '') +
        '</div>'
      ).join('');
    }
  }

  function hideGameOver() {
    if (_elements.gameOver) _elements.gameOver.classList.remove('visible');
  }

  // --- Missions HUD (in-game) ---
  function updateMissionsHud(missions) {
    if (_elements.missionsHud) {
      _elements.missionsHud.innerHTML = missions.map(m => {
        const pct = m.target > 0 ? Math.min(100, (m.progress / m.target) * 100) : 0;
        return '<div class="mission-hud-item ' + (m.completed ? 'done' : '') + '">' +
          '<span class="mh-check">' + (m.completed ? '&#x2705;' : '&#x2B1C;') + '</span> ' +
          m.desc + '</div>';
      }).join('');
    }
  }

  // --- Floating Text Rendering ---
  function renderFloatingTexts(texts) {
    if (!_floatingTextCtx) return;
    const ctx = _floatingTextCtx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const ft of texts) {
      const screen = EasterRenderer.worldToScreen(ft.x, ft.y, ft.z);
      const alpha = 1 - (ft.age / ft.life);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(ft.text, screen.x, screen.y);
      ctx.fillText(ft.text, screen.x, screen.y);
    }
    ctx.globalAlpha = 1;
  }

  // --- Progress Panel ---
  function _showProgressPanel() {
    if (_elements.progressPanel) {
      _elements.progressPanel.classList.add('visible');
      _renderProgressContent();
    }
  }

  function _hideProgressPanel() {
    if (_elements.progressPanel) _elements.progressPanel.classList.remove('visible');
  }

  function _switchTab(tab) {
    ['eggs', 'upgrades', 'badges'].forEach(t => {
      const tabEl = _elements['tab' + t.charAt(0).toUpperCase() + t.slice(1)];
      const gridEl = _elements[t + 'Grid'];
      if (tabEl) tabEl.classList.toggle('active', t === tab);
      if (gridEl) gridEl.style.display = t === tab ? '' : 'none';
    });
  }

  function _renderProgressContent() {
    const data = EasterProgress.getData();
    if (_elements.progressCoins) _elements.progressCoins.textContent = data.easterCoins;

    // Eggs
    if (_elements.eggsGrid) {
      _elements.eggsGrid.innerHTML = EASTER.EGG_SKINS.map(skin => {
        const unlocked = data.unlockedEggs.includes(skin.id);
        const selected = data.selectedEgg === skin.id;
        return '<div class="egg-item ' + (unlocked ? 'unlocked' : 'locked') + (selected ? ' selected' : '') + '" data-id="' + skin.id + '">' +
          '<div class="egg-preview" style="background:' + skin.color + '"></div>' +
          '<div class="egg-name">' + skin.name + '</div>' +
          (unlocked ? (selected ? '<div class="egg-status">Equipped</div>' : '<button class="egg-select-btn">Select</button>') :
            '<div class="egg-cost">' + skin.cost + ' coins</div><button class="egg-buy-btn">Buy</button>') +
          '</div>';
      }).join('');

      _elements.eggsGrid.querySelectorAll('.egg-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('.egg-item').dataset.id;
          EasterProgress.selectEgg(id);
          _renderProgressContent();
        });
      });

      _elements.eggsGrid.querySelectorAll('.egg-buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.closest('.egg-item').dataset.id;
          if (EasterProgress.purchaseEgg(id)) {
            _renderProgressContent();
          }
        });
      });
    }

    // Upgrades
    if (_elements.upgradesGrid) {
      _elements.upgradesGrid.innerHTML = Object.entries(EASTER.UPGRADES).map(([key, cfg]) => {
        const level = data.upgrades[key] || 0;
        const maxed = level >= cfg.maxLevel;
        const cost = maxed ? 0 : cfg.costs[level];
        return '<div class="upgrade-item">' +
          '<div class="upgrade-name">' + cfg.name + '</div>' +
          '<div class="upgrade-desc">' + cfg.desc + '</div>' +
          '<div class="upgrade-level">Lv ' + level + '/' + cfg.maxLevel + '</div>' +
          (maxed ? '<div class="upgrade-maxed">MAX</div>' :
            '<button class="upgrade-buy-btn" data-id="' + key + '">' + cost + ' coins</button>') +
          '</div>';
      }).join('');

      _elements.upgradesGrid.querySelectorAll('.upgrade-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (EasterProgress.purchaseUpgrade(btn.dataset.id)) {
            _renderProgressContent();
          }
        });
      });
    }

    // Badges
    if (_elements.badgesGrid) {
      _elements.badgesGrid.innerHTML = EASTER.BADGES.map(badge => {
        const earned = data.badges.includes(badge.id);
        return '<div class="badge-item ' + (earned ? 'earned' : '') + '">' +
          '<div class="badge-icon">' + (earned ? '&#x1F3C6;' : '&#x1F512;') + '</div>' +
          '<div class="badge-name">' + badge.name + '</div>' +
          '<div class="badge-desc">' + badge.desc + '</div>' +
          '</div>';
      }).join('');
    }
  }

  return {
    init,
    getMobileInput,
    isMobile,
    updateScore,
    updateWave,
    updateCombo,
    updateHP,
    updateCoins,
    updateActivePowerup,
    showBossBar,
    hideBossBar,
    showCenterMessage,
    hideCenterMessage,
    showVignette,
    hideVignette,
    showPreRun,
    hidePreRun,
    showGameOver,
    hideGameOver,
    updateMissionsHud,
    renderFloatingTexts,
  };
})();
