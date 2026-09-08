// mail/_rs_shim.js — forwarding shim for the Rust mail service (mitch-mail).
//
// The CLI send scripts call tryForward() right after argv parsing: if the
// mitch-mail service (plan Step 2 of the Rust rewrite) accepts the request we
// exit; otherwise the script falls through to the original nodemailer body
// below, so email keeps working whether or not the Rust service is running.
//
// Fallback policy: fall back ONLY when the service is unreachable (network
// error). A 5xx response means the service itself tried and failed — the
// script exits 1 with that error rather than double-sending via nodemailer.

const RS_URL = process.env.MAIL_RS_URL || 'http://127.0.0.1:6902';

async function fetchWithTimeout(url, opts, timeoutMs) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
}

/** GET /watch/status — true when the Rust IMAP watcher is healthy. */
export async function rsWatcherActive(timeoutMs = 2000) {
  try {
    const res = await fetchWithTimeout(`${RS_URL}/watch/status`, { method: 'GET' }, timeoutMs);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Forward a send request to the mitch-mail service.
 *   sender: 'gmail' | 'noreply' | 'support'
 *   args:   { to, subject, bodyArgs, inReplyTo, alt, raw }
 * Exits the process when forwarded; otherwise returns (caller falls back).
 * Stdin is consumed once here when the body comes from a pipe, and stashed
 * on globalThis so the fallback getBody() can reuse it.
 */
export async function tryForward(sender, args) {
  const { to, subject, bodyArgs, inReplyTo = null, alt = false, raw = false } = args;
  let body = null;
  if (bodyArgs.length > 0) {
    body = bodyArgs.join(' ');
  } else {
    body = await new Promise(res => {
      let d = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', c => (d += c));
      process.stdin.on('end', () => res(d.trim()));
      // TTY safety: never hang waiting on an interactive stdin when the
      // body argument was required anyway.
      if (process.stdin.isTTY) res('');
    });
  }
  globalThis.__mitchMailBody = body;

  try {
    const res = await fetchWithTimeout(
      `${RS_URL}/send`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sender, to, subject, body, inReplyTo, alt, raw, dry_run: false }),
      },
      30_000,
    );
    if (res.ok) {
      console.log(`Sent to ${to}`);
      process.exit(0);
    }
    const errText = (await res.text()).trim();
    console.error(`mitch-mail service error ${res.status}: ${errText}`);
    process.exit(1);
  } catch (e) {
    console.error(`mitch-mail unreachable (${e.message}) — falling back to nodemailer`);
  }
}