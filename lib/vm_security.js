export function canAccessVmRecord(record, actor) {
  if (!record || !actor) return false;
  const owner = String(record.ownerEmail || '').trim().toLowerCase();
  const email = String(actor.email || '').trim().toLowerCase();
  return Boolean(actor.isAdmin || (record.status !== 'unassigned' && owner && email && owner === email));
}

export function validateDesktopSession(session, actor, record, now = Date.now()) {
  if (!session || session.used || Number(session.expiresAt) <= Number(now)) return { ok: false, status: 401, code: 'expired' };
  if (!actor || !record || session.sid !== actor.sid || session.actorEmail !== actor.email) return { ok: false, status: 403, code: 'forbidden' };
  if (record.id !== session.recordId || Number(record.vmid) !== Number(session.vmid) || record.node !== session.node) return { ok: false, status: 403, code: 'forbidden' };
  if (session.ownerEmail !== undefined && session.ownerEmail !== record.ownerEmail) return { ok: false, status: 403, code: 'forbidden' };
  if (session.authSessionKey && session.authSessionKey !== actor.authSessionKey) return { ok: false, status: 403, code: 'forbidden' };
  if (!canAccessVmRecord(record, actor)) return { ok: false, status: 403, code: 'forbidden' };
  return { ok: true, status: 101, code: 'ok' };
}

export class VmOperationGate {
  constructor(cooldownMs = 3000) {
    this.cooldownMs = Math.max(0, Number(cooldownMs) || 0);
    this.active = new Map();
  }

  acquire(key, action, now = Date.now()) {
    const current = this.active.get(String(key));
    if (current && (current.pending || Number(now) - current.finishedAt < this.cooldownMs)) return false;
    this.active.set(String(key), { action: String(action || ''), startedAt: Number(now), pending: true });
    return true;
  }

  release(key, now = Date.now()) {
    const current = this.active.get(String(key));
    if (current) this.active.set(String(key), { ...current, pending: false, finishedAt: Number(now) });
  }

  cleanup(now = Date.now()) {
    for (const [key, state] of this.active) if (!state.pending && Number(now) - state.finishedAt >= this.cooldownMs) this.active.delete(key);
  }
}

export const VM_MAX_CONCURRENT_RUNNING = 6;
export const VM_EXTENSION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 extension per 24 hours
export const VM_COOLDOWN_DURATION_MS = 30 * 60 * 1000;       // 30 minutes cooldown
export const VM_OFFPAGE_INACTIVITY_MS = 10 * 60 * 1000;      // 10 minutes off-page auto-shutdown

export function isEligibleForFreeVm(email, { isAdmin = false, isPremium = false } = {}) {
  if (!email) return false;
  if (isAdmin) return true;
  const e = String(email).trim().toLowerCase();
  if (e.endsWith('@student.rjuhsd.us') || e.endsWith('@student.mitch.pro')) return true;
  if (isPremium) return true;
  return false;
}

export function canUserExtend(lastExtensionAt, { isAdmin = false, now = Date.now(), cooldownMs = VM_EXTENSION_COOLDOWN_MS } = {}) {
  if (isAdmin) return true;
  if (!lastExtensionAt) return true;
  return (Number(now) - Number(lastExtensionAt)) >= cooldownMs;
}

export function computeCooldownRemaining(cooldownUntil, { isAdmin = false, now = Date.now() } = {}) {
  if (isAdmin) return 0;
  if (!cooldownUntil) return 0;
  const remMs = Number(cooldownUntil) - Number(now);
  return remMs > 0 ? Math.ceil(remMs / 1000) : 0;
}

export function isVmInactive(lastSeen, { now = Date.now(), timeoutMs = VM_OFFPAGE_INACTIVITY_MS } = {}) {
  if (!lastSeen) return false;
  return (Number(now) - Number(lastSeen)) >= timeoutMs;
}
