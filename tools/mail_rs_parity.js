#!/usr/bin/env bun
// mail_rs_parity.js — Step 2 verification: compare the Rust mitch-mail
// service's dry-run send artifacts against the original JS implementations.
//
// Usage: bun tools/mail_rs_parity.js [rsUrl]
//   rsUrl defaults to http://127.0.0.1:6902
//
// Checks (per sender): html_body byte-identical to formatHtmlEmail() as it
// lives in each mail/*.js file; text_body exact suffix per sender/flags;
// from/subject/headers exact strings. Requires the mitch-mail service.

import fs from 'fs';
import path from 'path';

const RS_URL = process.argv[2] || process.env.MAIL_RS_URL || 'http://127.0.0.1:6902';
const BASE = path.join(import.meta.dir, '..');

// Extract a top-level `function name(...) {...}` (balanced braces) from a
// mail script, unmodified.
function extractFunction(file, name) {
  const src = fs.readFileSync(path.join(BASE, file), 'utf8');
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces for ${name} in ${file}`);
}

// The original template functions, evaluated as-is from their files.
const formatFrom = file =>
  new Function(
    'subject', 'textBody', 'unsubscribeUrl', 'primaryUrl', 'altUrl',
    `${extractFunction(file, 'formatHtmlEmail')}; return formatHtmlEmail(subject, textBody, unsubscribeUrl, primaryUrl, altUrl);`,
  );
const formatGmail = formatFrom('mail/send_email.js');
const formatNoreply = formatFrom('mail/noreply_send.js');
const formatSupport = formatFrom('mail/support_send.js');

let failures = 0;
function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ok  ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}`);
    console.error(`  expected: ${JSON.stringify(String(expected).slice(0, 400))}`);
    console.error(`  actual:   ${JSON.stringify(String(actual).slice(0, 400))}`);
  }
}

async function dryRun(payload) {
  const res = await fetch(`${RS_URL}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, dry_run: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`dry run failed ${res.status}: ${body.error}`);
  return body.dry_run;
}

const PRIMARY = 'https://mitch.pro';
const ALT = 'https://mitchdog.com';
const BODY = "Hello!\n\nSecond para\nwith <angles> & quotes 'here'";

// The service mints a real token per recipient; extract it from the first
// response and reuse it for every JS-side expectation.
let TOKEN = null;
function tokenFor(headers) {
  if (TOKEN) return TOKEN;
  const lu = headers.find(([k]) => k === 'List-Unsubscribe');
  TOKEN = lu[1].match(/<https:\/\/mitch\.pro\/unsubscribe\/([0-9a-f]+)>/)[1];
  return TOKEN;
}
const UNSUB = () => `${PRIMARY}/unsubscribe/${tokenFor(lastHeaders)}`;
let lastHeaders = [];

const cases = [
  {
    name: 'gmail',
    payload: { sender: 'gmail', to: 'parity@example.com', subject: 'Parity gmail', body: BODY, inReplyTo: '<ref-1>' },
    expectHtml: () => formatGmail('Parity gmail', BODY, UNSUB(), PRIMARY, ALT),
    expectText: () => `${BODY}\n\n---\nVisit ${UNSUB()} to unsubscribe.\nAlso available at ${ALT}/unsubscribe/${TOKEN}\nFor support: email SUPPORT to support@mitch.pro or mitchell.fogler@student.rjuhsd.us\n2014 Capitol Ave #100, Sacramento, CA 95811`,
    expectFrom: () => `mitch.pro <${process.env.GMAIL_USER || 'GMAIL_USER'}>`,
    expectHeaders: () => [
      'X-Priority: 1 (Highest)', 'X-MSMail-Priority: High', 'Importance: High',
      `List-Unsubscribe: <${UNSUB()}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click', 'In-Reply-To: <ref-1>', 'References: <ref-1>',
    ],
  },
  {
    name: 'gmail -a',
    payload: { sender: 'gmail', to: 'parity@example.com', subject: 'Parity alt', body: BODY, alt: true },
    expectHtml: () => formatGmail('Parity alt', BODY, UNSUB(), PRIMARY, ALT),
    expectText: () => BODY,
    expectFrom: () => { const u = process.env.GMAIL_USER_ALT || 'alt-gmail-user'; return `${u} <${u}>`; },
    expectHeaders: () => [
      'X-Priority: 1 (Highest)', 'X-MSMail-Priority: High', 'Importance: High',
      `List-Unsubscribe: <${UNSUB()}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ],
    checkSubjectZwsp: true,
  },
  {
    name: 'gmail --raw',
    payload: { sender: 'gmail', to: 'parity@example.com', subject: 'Parity raw', body: BODY, raw: true },
    expectHtml: () => formatGmail('Parity raw', BODY, null, PRIMARY, ALT),
    expectText: () => BODY,
    expectFrom: () => `mitch.pro <${process.env.GMAIL_USER || 'GMAIL_USER'}>`,
    expectHeaders: () => [
      'X-Priority: 1 (Highest)', 'X-MSMail-Priority: High', 'Importance: High',
      `List-Unsubscribe: <${UNSUB()}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ],
  },
  {
    name: 'noreply',
    payload: { sender: 'noreply', to: 'parity@example.com', subject: 'Parity noreply', body: BODY },
    expectHtml: () => formatNoreply('Parity noreply', BODY, UNSUB(), PRIMARY, ALT),
    expectText: () => `${BODY}\n\n---\nVisit ${UNSUB()} to unsubscribe.\nAlso available at ${ALT}/unsubscribe/${TOKEN}\n2014 Capitol Ave #100, Sacramento, CA 95811`,
    expectFrom: () => 'mitch.pro <noreply@mitch.pro>',
    expectHeaders: () => [
      `List-Unsubscribe: <${UNSUB()}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ],
  },
  {
    name: 'support',
    payload: { sender: 'support', to: 'parity@example.com', subject: 'Parity support', body: BODY },
    expectHtml: () => formatSupport('Parity support', BODY, UNSUB(), PRIMARY, ALT),
    expectText: () => `${BODY}\n\n---\nVisit ${UNSUB()} to unsubscribe.\nAlso available at ${ALT}/unsubscribe/${TOKEN}\nFor support: support@mitch.pro or mitchell.fogler@student.rjuhsd.us\n2014 Capitol Ave #100, Sacramento, CA 95811`,
    expectFrom: () => 'mitch.pro Support <support@mitch.pro>',
    expectHeaders: () => [
      `List-Unsubscribe: <${UNSUB()}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ],
  },
  {
    name: 'support --raw',
    payload: { sender: 'support', to: 'parity@example.com', subject: 'Parity support raw', body: BODY, raw: true },
    expectHtml: () => formatSupport('Parity support raw', BODY, null, PRIMARY, ALT),
    expectText: () => BODY,
    expectFrom: () => 'mitch.pro Support <support@mitch.pro>',
    expectHeaders: () => [
      `List-Unsubscribe: <${UNSUB()}>, <mailto:support@mitch.pro?subject=unsubscribe>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ],
  },
];

console.log(`mail_rs_parity against ${RS_URL}`);
for (const c of cases) {
  console.log(`- ${c.name}`);
  const art = await dryRun(c.payload);
  lastHeaders = art.headers;
  tokenFor(art.headers);
  const compare = (label, actual, expected) => {
    if (actual === expected) console.log(`  ok  ${label}`);
    else {
      failures++;
      console.error(`FAIL  ${label}`);
      console.error(`  expected: ${JSON.stringify(String(expected).slice(0, 300))}`);
      console.error(`  actual:   ${JSON.stringify(String(actual).slice(0, 300))}`);
    }
  };
  compare('html', art.html_body, c.expectHtml());
  compare('text', art.text_body, c.expectText());
  compare('from', art.from, c.expectFrom());
  if (c.checkSubjectZwsp) {
    const base = c.payload.subject;
    const ok = art.subject.startsWith(base) && [...art.subject.slice(base.length)].every(ch => ch === '​');
    console.log(`  ${ok ? 'ok' : 'FAIL'}  subject zwsp jitter`);
    if (!ok) failures++;
  } else {
    compare('subject', art.subject, c.payload.subject);
  }
  const actualHeaders = art.headers.map(([k, v]) => `${k}: ${v}`);
  for (const h of c.expectHeaders()) {
    console.log(`  ${actualHeaders.includes(h) ? 'ok' : 'FAIL'}  header ${h.split(':')[0]}`);
    if (!actualHeaders.includes(h)) failures++;
  }
}

console.log(failures === 0 ? '\nALL PARITY CHECKS PASSED' : `\n${failures} PARITY FAILURES`);
process.exit(failures === 0 ? 0 : 1);