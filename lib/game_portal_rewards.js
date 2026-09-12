export const GAME_PORTAL_REWARD_PER_MINUTE = 2;
export const GAME_PORTAL_DAILY_CAP = 240;
export const GAME_PORTAL_HEARTBEAT_MIN_MS = 5_000;
export const GAME_PORTAL_HEARTBEAT_MAX_MS = 45_000;

export function gamePortalDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function normalizeGamePortalTitle(value) {
  return String(value || '')
    .replace(/[<>\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function settleGamePortalHeartbeat(previous, now, input = {}) {
  const game = normalizeGamePortalTitle(input.game);
  const active = input.active === true && !!game;
  const dailyEarned = Math.max(0, Number(input.dailyEarned) || 0);
  const next = {
    game,
    active,
    lastSeen: now,
    accruedMs: active ? Math.max(0, Number(previous?.accruedMs) || 0) : 0,
  };

  if (!active) return { next, earned: 0, minutes: 0 };
  if (!previous?.active || previous.game !== game) {
    next.accruedMs = 0;
    return { next, earned: 0, minutes: 0 };
  }

  const delta = now - Number(previous.lastSeen || 0);
  if (delta < GAME_PORTAL_HEARTBEAT_MIN_MS || delta > GAME_PORTAL_HEARTBEAT_MAX_MS) {
    if (delta > GAME_PORTAL_HEARTBEAT_MAX_MS) next.accruedMs = 0;
    return { next, earned: 0, minutes: 0 };
  }

  next.accruedMs += delta;
  const completeMinutes = Math.floor(next.accruedMs / 60_000);
  const available = Math.max(0, GAME_PORTAL_DAILY_CAP - dailyEarned);
  const paidMinutes = Math.min(completeMinutes, Math.floor(available / GAME_PORTAL_REWARD_PER_MINUTE));
  const earned = paidMinutes * GAME_PORTAL_REWARD_PER_MINUTE;
  next.accruedMs = available > 0 ? next.accruedMs - paidMinutes * 60_000 : 0;
  return { next, earned, minutes: paidMinutes };
}
