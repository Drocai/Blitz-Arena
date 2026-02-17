# Blitz Arena Audit & Review

Date: 2026-02-17
Scope: `server/`, `client/`, `shared/`, runtime/deployment configs.

## Executive summary

Blitz Arena has a clean and understandable architecture for a small realtime game: room state is centralized in `RoomManager`, protocol constants are shared, and server-side simulation is authoritative for hit detection.

Primary risk areas identified during audit were **WebSocket abuse controls** and **input normalization**. Hardening updates were implemented in this review.

## What was reviewed

- WebSocket lifecycle, connection limits, message handling
- Room management and game-state transitions
- Input validation and trust boundaries
- DoS-oriented controls (payload size, message rate)
- Deployment/runtime basics and maintainability

## Implemented hardening changes

1. **WebSocket max payload cap** (`1KB`) to reduce JSON parse and memory abuse risk.
2. **Room ID sanitization** to only allow `a-z`, `A-Z`, `0-9`, `_`, and `-` (fallback to `default` if invalid).
3. **Rate-limit enforcement escalation**: clients exceeding per-second message limits are disconnected.
4. **Message guardrails**: ignore incoming messages until server-side player/room identity is attached.

## Findings

### Closed

- **[High] Unbounded per-message payload size over WebSocket**
  - Impact: large payloads can increase memory pressure and JSON parsing cost.
  - Status: **fixed** via `maxPayload`.

- **[Medium] Room identifier accepted without allowlist validation**
  - Impact: malformed or odd room IDs can degrade observability and produce unnecessary room cardinality.
  - Status: **fixed** via `sanitizeRoomId` + regex allowlist.

- **[Medium] Soft-only message rate limiting**
  - Impact: abusive clients could continue flooding despite dropped messages.
  - Status: **fixed** by closing connections once threshold is exceeded.

### Open recommendations

- Add per-room token or invite protection if public deployment expects hostile traffic.
- Add lightweight metrics (active rooms, dropped/closed connections by reason).
- Add automated tests for `sanitizeRoomId` and abusive message scenarios.
- Consider proxy-aware trusted IP extraction strategy when behind CDNs/LBs.

## Overall assessment

- **Architecture:** Good for a compact realtime game.
- **Security posture:** Improved to a reasonable baseline for hobby/small-scale deployment after this patch.
- **Next priority:** observability + minimal automated regression tests.
