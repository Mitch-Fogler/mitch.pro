#!/usr/bin/env node
// Usage: node make_team_token.js <name>
//        node make_team_token.js --list
//        node make_team_token.js --revoke <token>

const { randomBytes } = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const FILE = path.join(BASE, 'team_tokens.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}
function save(d) {
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

const args = process.argv.slice(2);
if (!args.length) { console.error('Usage: node make_team_token.js <name>'); process.exit(1); }

if (args[0] === '--list') {
  const tokens = load();
  const entries = Object.entries(tokens);
  if (!entries.length) { console.log('No team tokens.'); process.exit(0); }
  for (const [tok, data] of entries) {
    const date = new Date(data.created).toLocaleString();
    console.log(`${data.name.padEnd(20)} ${date}  ${tok}`);
  }
  process.exit(0);
}

if (args[0] === '--revoke') {
  if (!args[1]) { console.error('Usage: node make_team_token.js --revoke <name|token>'); process.exit(1); }
  const tokens = load();
  const arg = args[1];
  // try exact token match first, then case-insensitive name match
  let key = tokens[arg] ? arg : null;
  if (!key) {
    const lower = arg.toLowerCase();
    key = Object.keys(tokens).find(k => tokens[k].name.toLowerCase() === lower) || null;
  }
  if (!key) { console.error(`Not found: ${arg}`); process.exit(1); }
  const name = tokens[key].name;
  delete tokens[key];
  save(tokens);
  console.log(`Revoked token for ${name}.`);
  process.exit(0);
}

const name  = args[0].trim();
const token = randomBytes(24).toString('hex');
const tokens = load();
tokens[token] = { name, created: Date.now() };
save(tokens);
console.log(`Token for ${name}:`);
console.log(`  ${token}`);
console.log(`  Link: https://mitch.pro/team/?t=${token}`);
