export function canAccessVmRecord(record, actor, options = {}) {
  if (!record || !actor) return false;
  const owner = String(record.ownerEmail || '').trim().toLowerCase();
  const email = String(actor.email || '').trim().toLowerCase();
  const isOwner = Boolean(record.status !== 'unassigned' && owner && email && owner === email);
  if (isOwner) return true;
  if (actor.isAdmin) {
    const fn = typeof options === 'function' ? options : options?.isAdminEmail;
    const ownerIsAdmin = fn
      ? (typeof fn === 'function' ? Boolean(fn(owner)) : (fn instanceof Set ? fn.has(owner) : (Array.isArray(fn) ? fn.includes(owner) : false)))
      : Boolean(record.ownerIsAdmin);
    if (owner && ownerIsAdmin) return false;
    if (options && typeof options === 'object' && options.requireAdminGrant) {
      if (typeof options.isGrantAllowed === 'function') {
        return Boolean(options.isGrantAllowed(record.id, record));
      }
      return Boolean(record.adminAccessAllowed);
    }
    return true;
  }
  return false;
}

export function validateDesktopSession(session, actor, record, now = Date.now(), options = {}) {
  if (!session || session.used || Number(session.expiresAt) <= Number(now)) return { ok: false, status: 401, code: 'expired' };
  if (!actor || !record || session.sid !== actor.sid || session.actorEmail !== actor.email) return { ok: false, status: 403, code: 'forbidden' };
  if (record.id !== session.recordId || Number(record.vmid) !== Number(session.vmid) || record.node !== session.node) return { ok: false, status: 403, code: 'forbidden' };
  if (session.ownerEmail !== undefined && session.ownerEmail !== record.ownerEmail) return { ok: false, status: 403, code: 'forbidden' };
  if (session.authSessionKey && session.authSessionKey !== actor.authSessionKey) return { ok: false, status: 403, code: 'forbidden' };
  if (!canAccessVmRecord(record, actor, options)) return { ok: false, status: 403, code: 'forbidden' };
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
export const VM_DAILY_MAX_SECONDS = 6 * 3600;                // 6 hours per day = 21,600 seconds
export const VM_EXTENSION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 extension per 24 hours
export const VM_COOLDOWN_DURATION_MS = 30 * 60 * 1000;       // 30 minutes cooldown
export const VM_OFFPAGE_INACTIVITY_MS = 10 * 60 * 1000;      // 10 minutes off-page auto-shutdown
export const VM_DEFAULT_CPU_CORES = 6;
export const VM_DEFAULT_MEMORY_MB = 16384;                   // 16 GB RAM
export const VM_DEFAULT_BALLOON_MB = 4096;                   // 4 GB minimum balloon
export const VM_DEFAULT_DISK_GB = 64;                       // 64 GB disk

export function getRemainingDailyVmSeconds(usedSeconds, { isAdmin = false, dailyMaxSeconds = VM_DAILY_MAX_SECONDS } = {}) {
  if (isAdmin) return Infinity;
  const used = Math.max(0, Math.floor(Number(usedSeconds) || 0));
  return Math.max(0, dailyMaxSeconds - used);
}

export function isDailyVmLimitReached(usedSeconds, { isAdmin = false, dailyMaxSeconds = VM_DAILY_MAX_SECONDS } = {}) {
  if (isAdmin) return false;
  return (Number(usedSeconds) || 0) >= dailyMaxSeconds;
}

export function getVmDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

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

export function isVmAdminAccessAllowed(recordId, grants = {}) {
  if (!recordId) return false;
  return Boolean(grants[String(recordId)]?.allowed);
}

export function isVmAdminAccessRequested(recordId, grants = {}) {
  if (!recordId) return false;
  return Boolean(grants[String(recordId)]?.requested);
}

export function shouldNotifyCapacityAlert(email, now = Date.now(), lastMap = new Map(), cooldownMs = 60_000) {
  const norm = String(email || 'unknown').trim().toLowerCase();
  const lastTime = lastMap.get(norm) || 0;
  if (now - lastTime < cooldownMs) return false;
  lastMap.set(norm, now);
  return true;
}

export function formatCapacityFullAlert(userEmail, actionDesc = 'use a computer', maxLimit = VM_MAX_CONCURRENT_RUNNING) {
  const norm = String(userEmail || 'unknown').trim().toLowerCase();
  return {
    title: 'VM Capacity Alert',
    message: `VM capacity full (${maxLimit}/${maxLimit}): ${norm} attempted to ${actionDesc}.`,
    priority: 'high',
  };
}

export function formatAdminUsageNotice(adminEmail, vmName = 'your computer', operation = 'accessed') {
  return {
    title: 'Admin Used Your Computer',
    message: `Administrator ${adminEmail} accessed your computer "${vmName}" (${operation}).`,
  };
}

export function formatAdminAccessRequest(adminEmail, vmName = 'your computer') {
  return {
    title: 'Admin Access Request',
    message: `Administrator ${adminEmail} requested access to your computer "${vmName}". You can allow or revoke access in your Computer settings.`,
  };
}
