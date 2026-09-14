import { createHmac, timingSafeEqual } from 'node:crypto';

export function guestPreview(token, secret, now = Date.now()) {
  const sign = value => createHmac('sha256', secret).update(value).digest('hex');
  const [issued, signature = ''] = String(token || '').split('.');
  const expected = sign(issued || '');
  const valid = /^\d{13}$/.test(issued || '') && /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) && Number(issued) <= now;
  const startedAt = valid ? Number(issued) : now;
  return { token: `${startedAt}.${sign(String(startedAt))}`, expiresAt: startedAt + 60000, serverNow: now };
}
