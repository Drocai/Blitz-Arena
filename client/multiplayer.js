/**
 * Blitz Arena – Multiplayer Client
 * WebSocket connection, message handling, state synchronization.
 */

const Multiplayer = (() => {
  let ws = null;
  let localPlayerId = null;
  let localCharacterId = null;
  let roomId = null;
  let connected = false;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;

  // Callbacks
  let onPlayerJoined = null;
  let onPlayerLeft = null;
  let onStateUpdate = null;
  let onProjectileSpawn = null;
  let onHitConfirm = null;
  let onMatchCountdown = null;
  let onMatchStart = null;
  let onMatchEnd = null;
  let onRoomFull = null;
  let onConnectionChange = null;

  function connect(room) {
    roomId = room;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?room=${encodeURIComponent(room)}`;

    if (onConnectionChange) onConnectionChange('connecting');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected = true;
      reconnectAttempts = 0;
      if (onConnectionChange) onConnectionChange('connected');

      // Start heartbeat
      heartbeatTimer = setInterval(() => {
        send({ type: GAME_CONFIG.MSG.HEARTBEAT });
      }, GAME_CONFIG.HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      handleMessage(msg);
    };

    ws.onclose = () => {
      connected = false;
      clearInterval(heartbeatTimer);
      if (onConnectionChange) onConnectionChange('disconnected');

      // Auto-reconnect
      if (reconnectAttempts < MAX_RECONNECT) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(() => connect(roomId), delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case GAME_CONFIG.MSG.PLAYER_JOINED:
        if (!localPlayerId && msg.playerId) {
          // First join message with our ID
          localPlayerId = msg.playerId;
          localCharacterId = msg.characterId;
        }
        if (onPlayerJoined) onPlayerJoined(msg);
        break;

      case GAME_CONFIG.MSG.PLAYER_LEFT:
        if (onPlayerLeft) onPlayerLeft(msg);
        break;

      case GAME_CONFIG.MSG.STATE_UPDATE:
        if (onStateUpdate) onStateUpdate(msg);
        break;

      case GAME_CONFIG.MSG.PROJECTILE_SPAWN:
        if (onProjectileSpawn) onProjectileSpawn(msg.projectile);
        break;

      case GAME_CONFIG.MSG.HIT_CONFIRM:
        if (onHitConfirm) onHitConfirm(msg);
        break;

      case GAME_CONFIG.MSG.MATCH_COUNTDOWN:
        if (onMatchCountdown) onMatchCountdown(msg.count);
        break;

      case GAME_CONFIG.MSG.MATCH_START:
        if (onMatchStart) onMatchStart();
        break;

      case GAME_CONFIG.MSG.MATCH_END:
        if (onMatchEnd) onMatchEnd(msg);
        break;

      case GAME_CONFIG.MSG.ROOM_FULL:
        if (onRoomFull) onRoomFull();
        break;
    }
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function sendMove(x, z, rotation) {
    send({
      type: GAME_CONFIG.MSG.MOVE,
      x, z, rotation,
    });
  }

  function sendFire(dirX, dirZ) {
    send({
      type: GAME_CONFIG.MSG.FIRE,
      dirX, dirZ,
    });
  }

  function sendRematch() {
    send({ type: GAME_CONFIG.MSG.REMATCH });
  }

  function disconnect() {
    clearInterval(heartbeatTimer);
    clearTimeout(reconnectTimer);
    reconnectAttempts = MAX_RECONNECT; // prevent reconnect
    if (ws) ws.close();
  }

  function setCallbacks(cbs) {
    onPlayerJoined = cbs.onPlayerJoined || null;
    onPlayerLeft = cbs.onPlayerLeft || null;
    onStateUpdate = cbs.onStateUpdate || null;
    onProjectileSpawn = cbs.onProjectileSpawn || null;
    onHitConfirm = cbs.onHitConfirm || null;
    onMatchCountdown = cbs.onMatchCountdown || null;
    onMatchStart = cbs.onMatchStart || null;
    onMatchEnd = cbs.onMatchEnd || null;
    onRoomFull = cbs.onRoomFull || null;
    onConnectionChange = cbs.onConnectionChange || null;
  }

  return {
    connect,
    disconnect,
    send,
    sendMove,
    sendFire,
    sendRematch,
    setCallbacks,
    getLocalPlayerId: () => localPlayerId,
    getLocalCharacterId: () => localCharacterId,
    getRoomId: () => roomId,
    isConnected: () => connected,
  };
})();
