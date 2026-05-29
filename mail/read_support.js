#!/usr/bin/env node
// Usage:
//   node read_support.js              — list unread emails (JSON array)
//   node read_support.js --all        — list all emails (JSON array)
//   node read_support.js --uid <uid>  — fetch full body of one email

const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

const USER = process.env.SUPPORT_EMAIL;
const PASS = process.env.SUPPORT_PASS;

if (!USER || !PASS) {
  console.error('Set SUPPORT_EMAIL and SUPPORT_PASS in .env'); process.exit(1);
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
    const body    = headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw;
    const getHeader = name => {
      const m = new RegExp('^' + name + ':\\s*(.+)', 'mi').exec(headers);
      return m ? m[1].trim() : '';
    };
    console.log(JSON.stringify({
      uid:       fetchUid,
      from:      getHeader('From'),
      to:        getHeader('To'),
      subject:   getHeader('Subject'),
      date:      getHeader('Date'),
      messageId: getHeader('Message-ID'),
      body:      body.trim(),
    }));
  } else {
    const query = fetchAll ? { all: true } : { seen: false };
    const messages = [];
    for await (const msg of client.fetch(query, {
      uid: true, flags: true, envelope: true, bodyParts: ['TEXT'],
    })) {
      const body    = msg.bodyParts?.get('TEXT')?.toString() || '';
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

run().catch(e => { console.error(e.message); process.exit(1); });
