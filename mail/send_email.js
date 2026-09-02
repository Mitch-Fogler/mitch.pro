#!/usr/bin/env bun
// Usage: node send_email.js <to> <subject> <body>
//   or: echo "body" | node send_email.js <to> <subject>
import path from 'path';
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

function loadDopplerEnv() {
  process.env.DOPPLER_ENABLE_DNS_RESOLVER = 'true';
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) return;
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
    return;
  } catch(e) {}
  if (process.stdout.isTTY) {
    try {
      const raw = execSync('sudo doppler secrets download --format json', { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
      const secrets = JSON.parse(raw);
      for (const [k, v] of Object.entries(secrets)) {
        if (!process.env[k]) process.env[k] = String(v);
      }
    } catch(e) {}
  }
}

try {
  const envPath = path.join(__dirname, '..', '.env');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
} catch(e) {}

loadDopplerEnv();

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

const rawGmailUser = useAlt ? process.env.GMAIL_USER_ALT : process.env.GMAIL_USER;
const rawGmailPass = useAlt ? process.env.GMAIL_PASS_ALT : process.env.GMAIL_PASS;

const GMAIL_USER = (rawGmailUser || '').trim().replace(/^["']|["']$/g, '');
const GMAIL_PASS = (rawGmailPass || '').trim().replace(/^["']|["']$/g, '');
const GMAIL_NAME = useAlt ? GMAIL_USER : "mitch.pro";

if (!GMAIL_USER || !GMAIL_PASS) {
  const suffix = useAlt ? '_ALT' : '';
  console.error(`Set GMAIL_USER${suffix} and GMAIL_PASS${suffix} env vars in Doppler/.env`);
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

function formatHtmlEmail(subject, textBody, unsubscribeUrl, primaryUrl, altUrl) {
  if (textBody.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(textBody)) {
    return textBody;
  }

  const escapedText = textBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const paragraphs = escapedText.split(/\n\n+/).map(p => {
    return `<p style="margin: 0 0 16px; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  let footerHtml = '';
  const PRIMARY = (primaryUrl || 'https://mitch.pro').replace(/\/$/, '');
  const ALT     = (altUrl || 'https://mitchdog.com').replace(/\/$/, '');
  if (unsubscribeUrl) {
    footerHtml = `
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
        <p style="margin: 0 0 8px;">
          Delivered by <a href="${ALT}" style="color: #64748b; text-decoration: underline; font-weight: 600;">mitchdog.com</a> | <a href="${PRIMARY}" style="color: #64748b; text-decoration: underline;">mitch.pro</a>
        </p>
        <p style="margin: 0 0 8px;">
          To opt-out of these communications, you can <a href="${unsubscribeUrl}" style="color: #38bdf8; text-decoration: underline;">unsubscribe from this list</a>.
        </p>
        <p style="margin: 0;">
          For support: email SUPPORT to <a href="mailto:support@mitch.pro" style="color: #64748b; text-decoration: none;">support@mitch.pro</a> or mitchell.fogler@student.rjuhsd.us
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: #475569;">
          2014 Capitol Ave #100, Sacramento, CA 95811
        </p>
      </div>
    `;
  } else {
    footerHtml = `
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
        <p style="margin: 0 0 8px;">
          Delivered by <a href="${ALT}" style="color: #64748b; text-decoration: underline; font-weight: 600;">mitchdog.com</a> | <a href="${PRIMARY}" style="color: #64748b; text-decoration: underline;">mitch.pro</a>
        </p>
        <p style="margin: 0;">
          For support: email SUPPORT to <a href="mailto:support@mitch.pro" style="color: #64748b; text-decoration: none;">support@mitch.pro</a>
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: #475569;">
          2014 Capitol Ave #100, Sacramento, CA 95811
        </p>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en" style="background:#06060c;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="only light">
  <meta name="supported-color-schemes" content="only light">
  <style> :root { color-scheme: only light; supported-color-schemes: only light; } </style>
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06060c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#06060c" style="background-color: #06060c; border-collapse: collapse;">
    <tr>
      <td align="center" bgcolor="#06060c" style="background-color: #06060c; padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #0f172a; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <tr>
            <td height="6" style="background: linear-gradient(to right, #a855f7, #38bdf8);"></td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 16px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="https://mitchdog.com/favicon.ico" width="24" height="24" style="vertical-align: middle; margin-right: 10px; border-radius: 4px;" alt="mitch.pro">
                    <span style="font-size: 24px; font-weight: 800; color: #ffffff; vertical-align: middle; letter-spacing: -0.02em;">mitch.pro</span>
                    <span style="font-size: 24px; font-weight: 300; color: #64748b; vertical-align: middle; margin: 0 8px;">/</span>
                    <span style="font-size: 24px; font-weight: 800; color: #38bdf8; vertical-align: middle; letter-spacing: -0.02em;">mitchdog.com</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
              ${paragraphs}
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
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

  let htmlBody = undefined;
  if (!useRaw) {
    const unsubUrl = `${PRIMARY}/unsubscribe/${token}`;
    htmlBody = formatHtmlEmail(subject, rawBody, unsubUrl, PRIMARY, ALT);
  } else {
    htmlBody = formatHtmlEmail(subject, rawBody, null, PRIMARY, ALT);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });

  const zwsp = '​'.repeat(Math.floor(Math.random() * 8) + 1);
  await transporter.sendMail({
    from: `${GMAIL_NAME} <${GMAIL_USER}>`,
    to, subject: useAlt ? subject + zwsp : subject,
    text: body,
    html: htmlBody,
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
