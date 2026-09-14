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
