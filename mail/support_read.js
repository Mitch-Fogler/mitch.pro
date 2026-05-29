#!/usr/bin/env node
// Reads emails from support@mitch.pro via Hostinger IMAP.
// Usage:
//   node support_read.js              — list unread emails (JSON array)
//   node support_read.js --all        — list all emails (JSON array)
//   node support_read.js --uid <uid>  — fetch full body of one email

const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

const USER = process.env.HOSTINGER_USER;  // mitch@mitch.pro
const PASS = process.env.HOSTINGER_PASS;

if (!USER || !PASS) {
  console.error('Set HOSTINGER_USER and HOSTINGER_PASS in .env'); process.exit(1);
}

const args     = process.argv.slice(2);
const fetchAll = args.includes('--all');
const uidIdx   = args.indexOf('--uid');
const fetchUid = uidIdx >= 0 ? args[uidIdx + 1] : null;

async function run() {
  const client = new ImapFlow({
    host: 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });

  await client.connect();
  await client.mailboxOpen('INBOX');

  if (fetchUid) {
    const msg = await client.fetchOne(fetchUid, { source: true }, { uid: true });
    const raw = msg?.source?.toString() || '';
    const headerEnd = raw.indexOf('\r\n\r\n');
    const headers = headerEnd >= 0 ? raw.slice(0, headerEnd) : '';
    const rawBody = headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw;
    const getHeader = name => {
      const m = new RegExp('^' + name + ':\\s*(.+)', 'mi').exec(headers);
      return m ? m[1].trim() : '';
    };
    // Pass full raw message to extractText so it can find multipart boundaries
    console.log(JSON.stringify({
      uid:       fetchUid,
      from:      getHeader('From'),
      to:        getHeader('To'),
      subject:   getHeader('Subject'),
      date:      getHeader('Date'),
      messageId: getHeader('Message-ID'),
      body:      extractText(raw),
    }));
  } else {
    const query = fetchAll ? { all: true } : { seen: false };
    const messages = [];
    for await (const msg of client.fetch(query, {
      uid: true, flags: true, envelope: true, bodyParts: ['TEXT'],
    })) {
      const body    = extractText(msg.bodyParts?.get('TEXT')?.toString() || '');
      const fromRaw = msg.envelope?.from?.[0];
      messages.push({
        uid:       msg.uid,
        from:      fromRaw?.address || '',
        fromName:  fromRaw?.name || '',
        to:        msg.envelope?.to?.map(a => a.address).join(', ') || '',
        subject:   msg.envelope?.subject || '(no subject)',
        date:      msg.envelope?.date?.toISOString() || '',
        messageId: msg.envelope?.messageId || '',
        seen:      msg.flags?.has('\\Seen') || false,
        body:      body.slice(0, 500),
      });
    }
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    console.log(JSON.stringify(messages));
  }

  await client.logout();
}

// Extract plain text from a raw MIME body (handles multipart and single-part)
function extractText(raw) {
  if (!raw) return '';
  raw = raw.toString();

  // If multipart, find all text/plain sections
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const parts = raw.split(new RegExp('--' + boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const texts = [];
    for (const part of parts) {
      if (/content-type:\s*text\/plain/i.test(part)) {
        const bodyStart = part.indexOf('\r\n\r\n') >= 0
          ? part.indexOf('\r\n\r\n') + 4
          : part.indexOf('\n\n') + 2;
        if (bodyStart > 1) texts.push(part.slice(bodyStart).trim());
      }
    }
    if (texts.length) return texts.join('\n').trim();
  }

  // Single-part: strip MIME headers if present (section after first blank line)
  if (/^content-type:/im.test(raw)) {
    const sep = raw.indexOf('\r\n\r\n') >= 0 ? '\r\n\r\n' : '\n\n';
    const idx = raw.indexOf(sep);
    if (idx >= 0) return raw.slice(idx + sep.length).trim();
  }

  return raw.trim();
}

run().catch(e => { console.error(e.message); process.exit(1); });
