/**
 * Blitz Arena – UI Module
 * Handles HUD, scoreboard, timer, center messages, match end overlay,
 * waiting screen, connection status, and mobile controls.
 */

const UI = (() => {
  // --- Elements ---
  const els = {};

  function init() {
    els.scoreboard = document.getElementById('scoreboard');
    els.connDot = document.getElementById('conn-dot');
    els.connText = document.getElementById('conn-text');
    els.centerMsg = document.getElementById('center-msg');
    els.centerTitle = document.getElementById('center-title');
    els.centerSub = document.getElementById('center-sub');
    els.matchEndOverlay = document.getElementById('match-end-overlay');
    els.matchResult = document.getElementById('match-result');
    els.matchScoresFinal = document.getElementById('match-scores-final');
    els.rematchBtn = document.getElementById('rematch-btn');
    els.waitingScreen = document.getElementById('waiting-screen');
    els.roomLink = document.getElementById('room-link');
    els.mobileControls = document.getElementById('mobile-controls');
    els.fireBtn = document.getElementById('fire-btn');
  }

  // --- Connection Status ---
  function setConnection(status) {
    els.connDot.className = status; // connected | disconnected | connecting
    const labels = { connected: 'Connected', disconnected: 'Disconnected', connecting: 'Connecting' };
    els.connText.textContent = labels[status] || status;
  }

  // --- Scoreboard ---
  function updateScoreboard(players, localId) {
    if (!players || players.length === 0) {
      els.scoreboard.innerHTML = '';
      return;
    }

    let html = '';
    // Sort: local player first for consistent layout
    const sorted = [...players].sort((a, b) => {
      if (a.id === localId) return -1;
      if (b.id === localId) return 1;
      return 0;
    });

    for (const p of sorted) {
      const char = GAME_CONFIG.CHARACTERS[p.characterId];
      const name = char ? char.name : p.characterId;
      const isLocal = p.id === localId;
      html += `
        <div class="score-block ${p.characterId} ${isLocal ? 'local' : ''}">
          <span class="score-name">${name}${isLocal ? ' (You)' : ''}</span>
          <span class="score-value">${p.score || 0}</span>
        </div>
      `;
    }

    // Timer in center
    html = sorted.length > 0 ?
      html.split('</div>').slice(0, 1).join('</div>') + '</div>' +
      '<div id="timer">3:00</div>' +
      sorted.slice(1).map(p => {
        const char = GAME_CONFIG.CHARACTERS[p.characterId];
        const name = char ? char.name : p.characterId;
        const isLocal = p.id === localId;
        return `<div class="score-block ${p.characterId} ${isLocal ? 'local' : ''}">
          <span class="score-name">${name}${isLocal ? ' (You)' : ''}</span>
          <span class="score-value">${p.score || 0}</span>
        </div>`;
      }).join('') : html;

    els.scoreboard.innerHTML = html;
  }

  function updateTimer(seconds) {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    timerEl.classList.toggle('warning', seconds <= 30);
  }

  function updateScores(players, localId) {
    const blocks = els.scoreboard.querySelectorAll('.score-block');
    if (!players) return;

    // Update just score values
    for (const p of players) {
      for (const block of blocks) {
        if (block.classList.contains(p.characterId)) {
          const val = block.querySelector('.score-value');
          if (val) val.textContent = p.score || 0;
        }
      }
    }
  }

  // --- Center Message ---
  let centerTimeout = null;

  function showCenterMessage(title, sub, duration = 0) {
    els.centerTitle.textContent = title;
    els.centerSub.textContent = sub || '';
    els.centerMsg.classList.add('visible');

    if (centerTimeout) clearTimeout(centerTimeout);
    if (duration > 0) {
      centerTimeout = setTimeout(() => {
        els.centerMsg.classList.remove('visible');
      }, duration);
    }
  }

  function hideCenterMessage() {
    els.centerMsg.classList.remove('visible');
    if (centerTimeout) clearTimeout(centerTimeout);
  }

  // --- Match End ---
  function showMatchEnd(result, localId) {
    let text, sub;

    if (result.isTie) {
      text = "IT'S A TIE!";
    } else if (result.winnerId === localId) {
      text = '♥ YOU WIN! ♥';
    } else {
      text = 'YOU LOSE';
    }

    const scores = result.players
      .map(p => {
        const char = GAME_CONFIG.CHARACTERS[p.characterId];
        return `${char ? char.name : 'Player'}: ${p.score}`;
      })
      .join('  vs  ');

    els.matchResult.textContent = text;
    els.matchScoresFinal.textContent = scores;
    els.matchEndOverlay.classList.add('visible');
  }

  function hideMatchEnd() {
    els.matchEndOverlay.classList.remove('visible');
  }

  // --- Waiting Screen ---
  function showWaiting(roomUrl) {
    els.waitingScreen.classList.remove('hidden');
    els.roomLink.textContent = `Share: ${roomUrl}`;
    els.roomLink.onclick = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(roomUrl);
        els.roomLink.textContent = 'Copied! ✓';
        setTimeout(() => {
          els.roomLink.textContent = `Share: ${roomUrl}`;
        }, 2000);
      }
    };
  }

  function hideWaiting() {
    els.waitingScreen.classList.add('hidden');
  }

  // --- Mobile Detection + Controls ---
  function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
  }

  function showMobileControls() {
    if (isMobile()) {
      els.mobileControls.classList.add('active');
    }
  }

  function hideMobileControls() {
    els.mobileControls.classList.remove('active');
  }

  return {
    init,
    setConnection,
    updateScoreboard,
    updateTimer,
    updateScores,
    showCenterMessage,
    hideCenterMessage,
    showMatchEnd,
    hideMatchEnd,
    showWaiting,
    hideWaiting,
    showMobileControls,
    hideMobileControls,
    isMobile,
    getRematchBtn: () => els.rematchBtn,
    getFireBtn: () => els.fireBtn,
    getMoveZone: () => document.getElementById('move-zone'),
    getAimZone: () => document.getElementById('aim-zone'),
  };
})();
