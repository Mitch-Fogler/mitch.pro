#!/usr/bin/env bun
// Sends email FROM support@mitch.pro (alias) via mitch@mitch.pro Hostinger SMTP.
// Usage: node support_send.js [--in-reply-to <msgid>] <to> <subject> [body]
//   or:  echo "body" | node support_send.js <to> <subject>
import {
  configureDataStore,
  appendAppLog,
  queryAppLogs,
  readDocument,
  writeDocument,
  rebuildCoreTablesFromDocuments,
} from '../lib/data_store.js';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

const USER = process.env.NOREPLY_USER;
const PASS = process.env.NOREPLY_PASS;
const SMTP_HOST = process.env.MAIL_SMTP_HOST || 'mail.mitch.pro';

if (!USER || !PASS) {
  console.error('Set NOREPLY_USER and NOREPLY_PASS in environment/dotenv'); process.exit(1);
}

let _site = {primary:'https://mitch.pro', alternate:'https://mitch.88chan.me'};
try { _site = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'site.json'), 'utf8')); } catch(e) {}
const PRIMARY = _site.primary.replace(/\/$/, '');
const ALT     = _site.alternate.replace(/\/$/, '');

const rawArgs    = process.argv.slice(2);
const replyToIdx = rawArgs.indexOf('--in-reply-to');
const inReplyTo  = replyToIdx >= 0 ? rawArgs.splice(replyToIdx, 2)[1] : null;
const [to, subject, ...bodyArgs] = rawArgs;

if (!to || !subject) {
  console.error('Usage: node support_send.js [--in-reply-to <msgid>] <to> <subject> [body]');
  process.exit(1);
}

async function getBody() {
  if (bodyArgs.length > 0) return bodyArgs.join(' ');
  return new Promise(res => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => res(data.trim()));
  });
}

(async () => {
  const rawBody = await getBody();
  
  // Generate and store a secure unsubscribe token
  const crypto = require('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  const tokenPath = path.join(__dirname, '..', 'data', 'unsubscribe_tokens.json');
  let unsubTokens = {};
  try {
    unsubTokens = readDocument(tokenPath, ["33e219637cee2070a5d6c0f365ebe254", "33e219637cee2070a5d6c0f365ebe254"]);
  } catch(e) {}
  unsubTokens[to.toLowerCase().trim()] = token;
  try {
    writeDocument(tokenPath, JSON.stringify(unsubTokens, null, 2));
  } catch(e) {
    console.error("Failed to write unsubscribe token:", e.message);
  }

  const body = rawBody + `\n\n---\nVisit ${PRIMARY}/unsubscribe/?email=${encodeURIComponent(to)}&token=${token} to unsubscribe.\nAlso available at ${ALT}/unsubscribe/?email=${encodeURIComponent(to)}&token=${token}\n2014 Capitol Ave #100, Sacramento, CA 95811`;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `mitch.pro <noreply@mitch.pro>`,
    to, subject,
    text: body,
    headers: {
      'List-Unsubscribe': `<https://mitch.pro/unsubscribe.html?email=${encodeURIComponent(to)}&token=${token}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(inReplyTo ? { 'In-Reply-To': inReplyTo, 'References': inReplyTo } : {}),
    },
  });

  console.log(`Sent to ${to}`);
})().catch(e => { console.error(e.message); process.exit(1); });
