// lib/webauthn.js
//
// Pure helpers for the passkey / security-key (WebAuthn) login flow.
// Kept library-free of request objects so unit tests can exercise them
// directly; server.js adapts them to its request plumbing.

import { createHash, randomBytes } from 'crypto';

// WebAuthn credentials are origin-bound: pick the RP ID whose registrable
// host matches the request host. rpOrigins are the allowed https origins
// (e.g. https://mitch.pro and https://mitchdog.com).
export function rpForHost(hostname, rpOrigins) {
  const h = String(hostname || '').toLowerCase().split(':')[0];
  for (const origin of rpOrigins) {
    let u;
    try { u = new URL(origin); } catch { continue; }
    if (u.protocol === 'https:' && h === u.hostname) return { rpId: u.hostname, origin: u.origin };
  }
  return null;
}

// Challenges are issued per-browser-flow and must be single-use: only the
// SHA-256 of each issued challenge is retained, so a dump of runtime state
// or the database never reveals a replayable value.
export function makeChallengeStore(ttlMs = 3 * 60 * 1000) {
  const pending = new Map();
  return {
    issue(kind, email = '', rpId = '', challenge = randomBytes(32).toString('base64url')) {
      const now = Date.now();
      for (const [key, rec] of pending) {
        if (now > rec.expires) pending.delete(key);
      }
      const key = createHash('sha256').update(challenge).digest('hex');
      pending.set(key, { kind, email: email || '', rpId, expires: now + ttlMs });
      return challenge;
    },
    take(challenge, kind) {
      const key = createHash('sha256').update(String(challenge || '')).digest('hex');
      const rec = pending.get(key);
      if (!rec || rec.kind !== kind || Date.now() > rec.expires) {
        pending.delete(key);
        return null;
      }
      pending.delete(key); // single-use
      return { ...rec, key };
    },
    size() { return pending.size; },
  };
}

// Never ship public keys or other raw material to the client list view.
export function publicCredentialView(c) {
  return {
    id: c.id,
    name: c.name || 'Passkey',
    rpId: c.rpId || '',
    deviceType: c.deviceType || '',
    backedUp: !!c.backedUp,
    transports: c.transports || null,
    createdAt: c.createdAt || 0,
    lastUsedAt: c.lastUsedAt || null,
  };
}

// "Passkey — Chrome on Windows" style default label for the Settings list.
export function guessCredentialName(userAgent) {
  const ua = String(userAgent || '').slice(0, 120);
  let platform = '';
  if (/iPhone|iPad/.test(ua)) platform = 'iOS';
  else if (/Android/.test(ua)) platform = 'Android';
  else if (/Macintosh/.test(ua)) platform = 'macOS';
  else if (/Windows/.test(ua)) platform = 'Windows';
  else if (/Linux/.test(ua)) platform = 'Linux';
  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  const bits = [platform, browser].filter(Boolean).join(' · ');
  return bits ? `Passkey — ${bits}` : 'Passkey';
}