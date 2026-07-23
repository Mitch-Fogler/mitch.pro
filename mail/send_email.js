#!/usr/bin/env bun
// Usage: node send_email.js <to> <subject> <body>
//   or: echo "body" | node send_email.js <to> <subject>
import {
  configureDataStore,
  appendAppLog,
  queryAppLogs,
  readDocument,
  writeDocument,
  rebuildCoreTablesFromDocuments,
} from '../lib/data_store.js';

configureDataStore({ baseDir: path.join(__dirname, '..') });

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

let _site = {primary:'https://mitch.pro', alternate:'https://mitchdog.com'};
try { _site = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'site.json'), 'utf8')); } catch(e) {}
const PRIMARY = _site.primary.replace(/\/$/, '');
const ALT     = _site.alternate.replace(/\/$/, '');

const rawArgs = process.argv.slice(2);
const replyToIdx = rawArgs.indexOf('--in-reply-to');
const inReplyTo  = replyToIdx >= 0 ? rawArgs.splice(replyToIdx, 2)[1] : null;
const altIdx = rawArgs.indexOf('-a');
const useAlt = altIdx >= 0;
if (useAlt) rawArgs.splice(altIdx, 1);
const rawIdx = rawArgs.indexOf('--raw');
const useRaw = rawIdx >= 0;
if (useRaw) rawArgs.splice(rawIdx, 1);
const [to, subject, ...bodyArgs] = rawArgs;

if (!to || !subject) {
  console.error('Usage: node send_email.js <to> <subject> [body]');
  process.exit(1);
}

const GMAIL_USER = useAlt ? process.env.GMAIL_USER_ALT : process.env.GMAIL_USER;
const GMAIL_PASS = useAlt ? process.env.GMAIL_PASS_ALT : process.env.GMAIL_PASS;
const GMAIL_NAME = useAlt ? GMAIL_USER : "mitch.pro"

if (!GMAIL_USER || !GMAIL_PASS) {
  const suffix = useAlt ? '_ALT' : '';
  console.error(`Set GMAIL_USER${suffix} and GMAIL_PASS${suffix} env vars`);
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
  
  // Load or generate a persistent secure unsubscribe token
  const crypto = require('crypto');
  const tokenPath = path.join(__dirname, '..', 'data', 'unsubscribe_tokens.json');
  let unsubTokens = {};
  try {
    unsubTokens = readDocument(tokenPath, {});
  } catch(e) {}
  if (!unsubTokens || typeof unsubTokens !== 'object' || Array.isArray(unsubTokens)) {
    unsubTokens = {};
  }
  const recipient = to.toLowerCase().trim();
  let token = unsubTokens[recipient];
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    unsubTokens[recipient] = token;
    try {
      writeDocument(tokenPath, unsubTokens);
    } catch(e) {
      console.error("Failed to write unsubscribe token:", e.message);
    }
  }

  const body = (useAlt || useRaw) ? rawBody : rawBody + `\n\n---\nVisit ${PRIMARY}/unsubscribe/${token} to unsubscribe.\nAlso available at ${ALT}/unsubscribe/${token}\nFor support: email SUPPORT to support@mitch.pro or mitchell.fogler@student.rjuhsd.us\n2014 Capitol Ave #100, Sacramento, CA 95811`;
  console.log(body);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });

  const zwsp = '​'.repeat(Math.floor(Math.random() * 8) + 1);
  await transporter.sendMail({
    from: `${GMAIL_NAME} <${GMAIL_USER}>`,
    to, subject: useAlt ? subject + zwsp : subject,
    text: body,
    priority: 'high',
    headers: {
      'X-Priority': '1', 'Importance': 'high',
      'List-Unsubscribe': `<https://mitch.pro/unsubscribe/${token}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(!useAlt && inReplyTo ? { 'In-Reply-To': inReplyTo, 'References': inReplyTo } : {}),
    },
  });

  console.log(`Sent to ${to}`);
})().catch(e => { console.error(e.message); process.exit(1); });
