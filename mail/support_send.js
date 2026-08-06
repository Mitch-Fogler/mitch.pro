#!/usr/bin/env bun
// Sends email FROM support@mitch.pro (alias) via mitch@mitch.pro Hostinger SMTP.
// Usage: node support_send.js [--in-reply-to <msgid>] <to> <subject> [body]
//   or:  echo "body" | node support_send.js <to> <subject>

import path from 'path';
import {
  configureDataStore,
  readDocument,
  writeDocument,
} from '../lib/data_store.js';

configureDataStore({ baseDir: path.join(__dirname, '..') });

import dns from 'dns';
try { if (dns && dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first'); } catch(e) {}

const nodemailer = require('nodemailer');
const fs = require('fs');

function loadDopplerEnv() {
  process.env.DOPPLER_ENABLE_DNS_RESOLVER = 'true';
  if (process.env.SUPPORT_USER && process.env.SUPPORT_PASS) return;
  const { execSync } = require('child_process');
  try {
    const raw = execSync('doppler secrets download --format json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const secrets = JSON.parse(raw);
    for (const [k, v] of Object.entries(secrets)) {
      if (!process.env[k]) process.env[k] = String(v);
    }
    return;
  } catch(e) {}
  try {
    const raw = execSync('sudo -n doppler secrets download --format json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const secrets = JSON.parse(raw);
    for (const [k, v] of Object.entries(secrets)) {
      if (!process.env[k]) process.env[k] = String(v);
    }
  } catch(e) {}
}

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

loadDopplerEnv();

const USER = (process.env.SUPPORT_USER || '').trim().replace(/^["']|["']$/g, '');
const PASS = (process.env.SUPPORT_PASS || '').trim().replace(/^["']|["']$/g, '');
const rawHost = (process.env.MAIL_SMTP_HOST || 'mail.mitch.pro').trim().replace(/^["']|["']$/g, '');
const SMTP_HOST = rawHost || 'mail.mitch.pro';

let _site = {primary:'https://mitch.pro', alternate:'https://mitch.88chan.me'};
try { _site = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'site.json'), 'utf8')); } catch(e) {}
const PRIMARY = _site.primary.replace(/\/$/, '');
const ALT     = _site.alternate.replace(/\/$/, '');

if (!USER || !PASS) {
  console.error('Set SUPPORT_USER and SUPPORT_PASS in environment/dotenv/doppler'); process.exit(1);
}

const rawArgs    = process.argv.slice(2);
const replyToIdx = rawArgs.indexOf('--in-reply-to');
const inReplyTo  = replyToIdx >= 0 ? rawArgs.splice(replyToIdx, 2)[1] : null;
const rawIdx     = rawArgs.indexOf('--raw');
const useRaw     = rawIdx >= 0;
if (useRaw) rawArgs.splice(rawIdx, 1);
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

  const body = useRaw ? rawBody : rawBody + `\n\n---\nVisit ${PRIMARY}/unsubscribe/${token} to unsubscribe.\nAlso available at ${ALT}/unsubscribe/${token}\nFor support: support@mitch.pro or mitchell.fogler@student.rjuhsd.us\n2014 Capitol Ave #100, Sacramento, CA 95811`;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: USER, pass: PASS },
  });

  await transporter.sendMail({
    from: `mitch.pro Support <support@mitch.pro>`,
    to, subject,
    text: body,
    headers: {
      'List-Unsubscribe': `<https://mitch.pro/unsubscribe/${token}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(inReplyTo ? { 'In-Reply-To': inReplyTo, 'References': inReplyTo } : {}),
    },
  });

  console.log(`Sent to ${to}`);
})().catch(e => { console.error(e.message); process.exit(1); });
