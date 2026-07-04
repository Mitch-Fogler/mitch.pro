import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { configureDataStore, readDocument, writeDocument } from '../lib/data_store.js';

const BASE = import.meta.dir ? join(import.meta.dir, '..') : process.cwd();
const DATA_DIR = process.env.DATA_DIR || join(BASE, 'data');
configureDataStore({ baseDir: BASE, dataDir: DATA_DIR });
const COSMETICS_FILE = join(DATA_DIR, 'cosmetics.json');
const PASSWORDS_FILE = join(DATA_DIR, 'passwords.json');

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function defaultCosmetics() {
  return {
    colors: [],
    badges: [],
    chatEffects: [],
    profileEffects: [],
    themes: [],
    tools: [],
    activeColor: '',
    activeBadge: '',
    activeChatEffect: '',
    activeProfileEffect: '',
    activeTheme: '',
    activeTool: '',
    activeAi: ''
  };
}

function normalizeCosmetics(entry = {}) {
  const base = defaultCosmetics();
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key])) {
      base[key] = Array.isArray(entry[key]) ? [...new Set(entry[key].filter(Boolean))] : [];
    } else {
      base[key] = typeof entry[key] === 'string' ? entry[key] : '';
    }
  }
  return base;
}

function run() {
  if (!existsSync(PASSWORDS_FILE)) {
    console.error('passwords.json not found. Make sure you run this in the correct directory or set DATA_DIR.');
    process.exit(1);
  }

  const passwords = readDocument(PASSWORDS_FILE, {});
  const emails = Object.keys(passwords);
  console.log(`Found ${emails.length} registered users.`);

  let cosmetics = {};
  if (existsSync(COSMETICS_FILE)) {
    try {
      cosmetics = readDocument(COSMETICS_FILE, {});
    } catch (e) {
      console.warn('Failed to parse cosmetics.json, starting fresh:', e.message);
    }
  }

  let count = 0;
  for (const email of emails) {
    const norm = normalizeEmail(email);
    const userCosm = normalizeCosmetics(cosmetics[norm]);
    if (!userCosm.badges.includes('og_badge')) {
      userCosm.badges.push('og_badge');
      cosmetics[norm] = userCosm;
      count++;
    }
  }

  writeDocument(COSMETICS_FILE, cosmetics);
  console.log(`Successfully added OG Badge to ${count} users.`);
}

run();
