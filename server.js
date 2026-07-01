#!/usr/bin/env bun
import { createHmac, createHash, randomBytes, timingSafeEqual, createECDH } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync, rmSync, readdirSync, appendFileSync } from 'fs';
import { join, basename } from 'path';
import { spawnSync, spawn } from 'child_process';
import os from 'os';
import webpush from 'web-push';
import { Client as SSHClient } from 'ssh2';
import { isIP } from 'net';

const BASE = import.meta.dir;
const WEBROOT = join(BASE, 'webserver');
const DATA_DIR = process.env.DATA_DIR || join(BASE, 'data');
const LOGS_DIR = join(BASE, 'logs');
try { mkdirSync(LOGS_DIR, { recursive: true }); } catch {}

try {
  const env = readFileSync(join(BASE, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}

let VAPID_PUBLIC  = (process.env.VAPID_PUBLIC_KEY  || '').trim();
let VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY || '').trim();

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  try {
    const keys = webpush.generateVAPIDKeys();
    VAPID_PUBLIC = keys.publicKey;
    VAPID_PRIVATE = keys.privateKey;
    process.env.VAPID_PUBLIC_KEY = VAPID_PUBLIC;
    process.env.VAPID_PRIVATE_KEY = VAPID_PRIVATE;
    
    // Append to .env file
    const envPath = join(BASE, '.env');
    let envContent = '';
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, 'utf8');
      if (!envContent.endsWith('\n')) envContent += '\n';
    }
    envContent += `VAPID_PUBLIC_KEY="${VAPID_PUBLIC}"\n`;
    envContent += `VAPID_PRIVATE_KEY="${VAPID_PRIVATE}"\n`;
    writeFileSync(envPath, envContent, 'utf8');
    console.log('[startup] Auto-generated VAPID keys and saved to .env');
  } catch (err) {
    console.error('[startup] Failed to auto-generate VAPID keys:', err);
  }
}

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:support@mitch.pro', VAPID_PUBLIC, VAPID_PRIVATE);
}
const GEMINI_KEY       = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODELS    = [['gemini-2.0-flash', false], ['gemini-2.0-flash-lite', true]];
const GROQ_KEY         = (process.env.GROQ_API_KEY || '').trim();
const GROQ_MODELS      = [['llama-3.3-70b-versatile', true], ['llama-3.1-8b-instant', true]];
const RECAPTCHA_SECRET = (process.env.RECAPTCHA_SECRET_KEY || process.env.SECRET_KEY || '').trim();

// Core Data Files
const TOKENS_FILE           = join(DATA_DIR, 'tokens.json');
const PASSWORDS_FILE         = join(DATA_DIR, 'passwords.json');
const SIGNUP_CODES_FILE      = join(DATA_DIR, 'signup_codes.json');
const NEWSLETTER_UNSUB_FILE   = join(DATA_DIR, 'newsletter_unsub.json');
const NAMES_FILE             = join(DATA_DIR, 'names.json');
const BLACKLIST_FILE         = join(DATA_DIR, 'blacklist.json');
const USER_STATS_FILE        = join(DATA_DIR, 'user_stats.json');
const ACHIEVEMENTS_FILE      = join(DATA_DIR, 'achievements.json');
const SESSION_LOG_FILE       = join(DATA_DIR, 'sessions.json');
const PROXY_LOG_FILE         = join(DATA_DIR, 'proxy_logs.json');
const COINS_FILE             = join(DATA_DIR, 'coins.json');
const UNLIMITED_IDS_FILE     = join(DATA_DIR, 'unlimited_ids.json');
const ID_SECRET_FILE         = join(DATA_DIR, 'id_secret.key');
const GAMES_FILE             = join(BASE, 'games');
const GAMES_LOCAL_FILE       = join(BASE, 'games_local');
const GAMES_EXTERNAL_FILE    = join(BASE, 'games_external');
const GAME_CATEGORIES_FILE   = join(DATA_DIR, 'game_categories.json');
const GAME_CATEGORIES_LOCAL  = join(DATA_DIR, 'game_categories_local.json');
const GAME_CATEGORIES_EXTERNAL = join(DATA_DIR, 'game_categories_external.json');
const REVOKED_FILE           = join(DATA_DIR, 'revoked.json');
const APPEALS_FILE           = join(DATA_DIR, 'appeals.json');
const APPLICATIONS_FILE      = join(DATA_DIR, 'applications.json');
const PROFILES_FILE          = join(DATA_DIR, 'profiles.json');
const COIN_GIFTS_FILE        = join(DATA_DIR, 'coin_gifts.json');
const DAILY_LOGINS_FILE      = join(DATA_DIR, 'daily_logins.json');
const DMS_FILE               = join(DATA_DIR, 'dms.json');
const GROUPS_FILE            = join(DATA_DIR, 'groups.json');
const E2E_KEYS_FILE          = join(DATA_DIR, 'e2e_keys.json');
const CANVAS_HISTORY_FILE    = join(DATA_DIR, 'canvas_history.jsonl');
const UNLOCKED_AI_FILE       = join(DATA_DIR, 'unlocked_ai.json');
const SEARCH_INTENT_FILE     = join(DATA_DIR, 'search_intent.json');
const HEATMAP_FILE           = join(DATA_DIR, 'heatmap.json');
const ADMIN_ACTION_LOG_FILE   = join(DATA_DIR, 'admin_actions.json');
const MODERATORS_FILE        = join(DATA_DIR, 'moderators.json');
const MODERATOR_PANEL_FILE   = join(DATA_DIR, 'moderator_panel.json');
const MODERATOR_REQUESTS_FILE = join(DATA_DIR, 'moderator_requests.json');
const GENERATIONS_FILE       = join(DATA_DIR, 'generations.json');
const INVALIDATED_FILE       = join(DATA_DIR, 'invalidated_ids.json');
const ADMINS_FILE            = join(DATA_DIR, 'admins.json');
const PASSPHRASE_FILE        = join(DATA_DIR, 'admin_passphrase.json');
const FRIENDS_FILE           = join(DATA_DIR, 'friends.json');
const FRIEND_REQUESTS_FILE   = join(DATA_DIR, 'friend_requests.json');
const CANVAS_PIXELS_FILE     = join(DATA_DIR, 'canvas_pixels.json');
const CANVAS_LOCKS_FILE      = join(DATA_DIR, 'canvas_locks.json');
const PREMIUM_CHAT_FILE      = join(DATA_DIR, 'premium_chat.json');
const PUBLIC_CHAT_FILE       = join(DATA_DIR, 'public_chat.json');
const MARKETPLACE_FILE       = join(DATA_DIR, 'marketplace.json');
const COSMETICS_FILE         = join(DATA_DIR, 'cosmetics.json');
const EMOJIS_FILE            = join(DATA_DIR, 'emojis.json');
const SEARCH_INTENT_LOG_FILE = join(DATA_DIR, 'search_intent.json');
const DM_CLEARED_FILE        = join(DATA_DIR, 'dm_cleared.json');
const CHAT_REPORTS_FILE      = join(DATA_DIR, 'chat_reports.json');
const PUSH_SUBS_FILE         = join(DATA_DIR, 'push_subs.json');
const NUDGE_FILE             = join(DATA_DIR, 'nudge_sent.json');
const HASHES_FILE            = join(DATA_DIR, 'valid_hashes.json');
const MASTER_SESSION_LOG     = join(DATA_DIR, 'master_sessions.jsonl');
const GLOBAL_GAME_STATS_FILE = join(DATA_DIR, 'global_game_stats.json');
const CLICKER_FILE           = join(DATA_DIR, 'clicker_sessions.json');
const RICHARD_FILE           = join(DATA_DIR, 'richard_sessions.json');
const CHEAT_LOGS_FILE        = join(DATA_DIR, 'cheat_logs.json');
const E2E_LOG_FILE           = join(DATA_DIR, 'e2e_log.json');
const AI_LOG_FILE            = join(DATA_DIR, 'ai_log.json');
const INVITE_CODES_FILE      = join(DATA_DIR, 'invite_codes.json');   // { normEmail -> code }
const INVITE_CLAIMS_FILE     = join(DATA_DIR, 'invite_claims.json');  // { normNewEmail -> { refNorm, ts, paid } }
const PREMIUM_COLORS         = new Set([
  '#ffd700', '#ffc0cb', '#ff69b4', '#00ffff', '#7fffd4', '#adff2f',
  '#ff4500', '#da70d6', '#40e0d0', '#f0e68c', '#e6e6fa', '#b8860b'
]);
const INVITE_SENT_FILE       = join(DATA_DIR, 'invite_sent.json');    // { normEmail -> [sentTo, ...] }
const ADMIN_KEY_FILE         = join(BASE, 'admin', 'admin.key');
const PREMIUM_GIFTS_SENT_FILE = join(DATA_DIR, 'premium_gifts_sent.json');
const MAINTENANCE_FILE       = join(DATA_DIR, 'soft_maintenance.json');
let softMaintenanceActive    = false;
try {
  if (existsSync(MAINTENANCE_FILE)) {
    softMaintenanceActive = JSON.parse(readFileSync(MAINTENANCE_FILE, 'utf8')).active === true;
  }
} catch {}
const PORT = Number(process.env.PORT || 6800);
const HOST = "0.0.0.0";
const USERDATA_DIR = "/opt/userdata";
const NTFY_TOPIC = (process.env.NTFY_TOPIC || '').trim();
const SUPPORT_USER = (process.env.SUPPORT_USER || '').trim();
const SUPPORT_PASS = (process.env.SUPPORT_PASS || '').trim();
const GOOGLE_CLIENT_ID = '561391673402-eufe4daah7oinpq0ddb7v2l6gspr01gh.apps.googleusercontent.com';
const NOTIFICATION_ORIGIN = 'https://mitchdog.com';

const SEND_SCRIPT           = join(BASE, 'mail', 'send_email.js');
const NOREPLY_SCRIPT        = join(BASE, 'mail', 'noreply_send.js');

const PROTECTED_FILES = new Set(['senpai-cafe.webp', 'adrian-lopez.webp']);
const TEST_ACCOUNT_EMAIL = 'tingtongsuperman@linux.com';
const WHITELISTED_IPS = new Set(['66.60.183.124']);

// ID secret
let ID_SECRET;
try { ID_SECRET = readFileSync(ID_SECRET_FILE); }
catch { ID_SECRET = randomBytes(32); writeFileSync(ID_SECRET_FILE, ID_SECRET); }

// Session tracking
const sessionLastSeen  = {};
const lastLoggedPing   = new Map(); // id -> { page, ts }
const userPlaytime     = new Map(); // id -> accumulated_ms
const ADRIAN_TECH = {
  desk_1: { name: "Reinforced Desk", cost: 100, icon: "🪑", target: "desk", mult: 2, unlock: { id: "desk", n: 1 } },
  desk_2: { name: "Ergonomic Chair", cost: 500, icon: "💺", target: "desk", mult: 2, unlock: { id: "desk", n: 10 } },
  desk_3: { name: "Dual Monitor", cost: 10000, icon: "🖥️", target: "desk", mult: 2, unlock: { id: "desk", n: 25 } },
  chrome_1: { name: "Speed Extension", cost: 1000, icon: "⚡", target: "chromebook", mult: 2, unlock: { id: "chromebook", n: 1 } },
  chrome_2: { name: "Overclocked RAM", cost: 5000, icon: "🧠", target: "chromebook", mult: 2, unlock: { id: "chromebook", n: 10 } },
  fiber_1: { name: "Cat6 Cables", cost: 11000, icon: "🔌", target: "fiber", mult: 2, unlock: { id: "fiber", n: 1 } },
  fiber_2: { name: "Router Pro", cost: 55000, icon: "📡", target: "fiber", mult: 2, unlock: { id: "fiber", n: 10 } },
  ai_1: { name: "Neural Network", cost: 120000, icon: "🤖", target: "ai_bot", mult: 2, unlock: { id: "ai_bot", n: 1 } },
  ai_2: { name: "Quantum Training", cost: 600000, icon: "✨", target: "ai_bot", mult: 2, unlock: { id: "ai_bot", n: 10 } },
  mitch_1: { name: "Mitch's Advice", cost: 5000, icon: "💡", target: "global", mult: 2, unlock: { id: "desk", n: 5 } },
  mitch_2: { name: "Community Server", cost: 500000, icon: "🌐", target: "global", mult: 2, unlock: { id: "mainframe", n: 5 } },
  star_1: { name: "Pulsar Harvest", cost: 1e15, icon: "💫", target: "neutron_star", mult: 2, unlock: { id: "neutron_star", n: 1 } },
  star_2: { name: "Quasar Focus", cost: 5e15, icon: "💠", target: "neutron_star", mult: 2, unlock: { id: "neutron_star", n: 10 } },
  void_1: { name: "Void Insight", cost: 1e18, icon: "🌑", target: "black_hole", mult: 2, unlock: { id: "black_hole", n: 1 } },
  googol_1: { name: "Infinite Logic", cost: 1e85, icon: "♾️", target: "global", mult: 10, unlock: { id: "beyond_googol", n: 1 } }
};
const ADRIAN_UPGRADES = {
  desk: { name: "Student Desk", baseCost: 15, power: 0.1, type: "c", desc: "Basic study station." },
  chromebook: { name: "Chromebook Script", baseCost: 100, power: 1, type: "a", desc: "Automated clicking script." },
  fiber: { name: "Fiber Connection", baseCost: 1100, power: 8, type: "a", desc: "Ultra-low latency clicks." },
  ai_bot: { name: "Assistant Bot", baseCost: 12000, power: 47, type: "a", desc: "AI-driven productivity." },
  mainframe: { name: "High-End Mainframe", baseCost: 130000, power: 260, type: "a", desc: "Enterprise-grade speed." },
  quantum: { name: "Quantum Core", baseCost: 1400000, power: 1400, type: "a", desc: "Beyond human limits." },
  cloud_farm: { name: "Cloud Computing Farm", baseCost: 20000000, power: 7800, type: "a", desc: "Distributed clicking power." },
  satellite: { name: "Orbital Uplink", baseCost: 330000000, power: 44000, type: "a", desc: "Interstellar bandwidth." },
  dyson: { name: "Dyson Swarm", baseCost: 5100000000, power: 260000, type: "a", desc: "Total solar output clicks." },
  singularity: { name: "AI Singularity", baseCost: 75000000000, power: 1600000, type: "a", desc: "Infinite intelligence." },
  multiverse: { name: "Multiverse Bridge", baseCost: 1e12, power: 10000000, type: "a", desc: "Harvesting other timelines." },
  neutron_star: { name: "Neutron Star Forge", baseCost: 1.4e13, power: 65000000, type: "a", desc: "High-density clicking." },
  antimatter: { name: "Antimatter Engine", baseCost: 1.7e17, power: 430000000, type: "a", desc: "Pure annihilation speed." },
  black_hole: { name: "Black Hole Event Horizon", baseCost: 2.1e18, power: 2.9e9, type: "a", desc: "Time-dilated clicking." },
  galactic_cluster: { name: "Galactic Cluster", baseCost: 2.6e22, power: 2.1e10, type: "a", desc: "A trillion worlds clicking." },
  supercluster: { name: "Laniakea Supercluster", baseCost: 3.1e24, power: 1.5e11, type: "a", desc: "The great attractor." },
  dimension_rip: { name: "Dimensional Rip", baseCost: 7.1e28, power: 1.1e12, type: "a", desc: "Bleeding points from 2D." },
  hyper_dimension: { name: "11th Dimension", baseCost: 1.2e32, power: 8.3e12, type: "a", desc: "Multi-dimensional input." },
  string_theory: { name: "String Theory Core", baseCost: 1.9e38, power: 6.4e13, type: "a", desc: "Vibrating atoms." },
  quantum_foam: { name: "Quantum Foam", baseCost: 5.4e42, power: 5.1e14, type: "a", desc: "Clicking at the Planck scale." },
  beyond_googol: { name: "Beyond Googol", baseCost: 1e80, power: 1e30, type: "a", desc: "Numbers without names." },
  infinite_set: { name: "Infinite Set", baseCost: 1e100, power: 1e45, type: "a", desc: "Cantor would be proud." },
  aleph_null: { name: "Aleph Null", baseCost: 1e140, power: 1e65, type: "a", desc: "Counting the uncountable." },
  quantum_singularity: { name: "Quantum Singularity", baseCost: 1e200, power: 1e85, type: "a", desc: "Crushing logic." },
  omnipresence: { name: "Omnipresence", baseCost: 1e260, power: 1e135, type: "a", desc: "Everywhere at once." }
};

let clickerSessions = new Map();
let typingSessions  = new Map(); // normEmail -> { dailyCount, lastTs }
let logicSessions   = new Map(); // normEmail -> { puzzlesDone, lastSolvedTs }
let logicDictionary = new Set();

function loadLogicDictionary() {
  try {
    const txt = readFileSync(join(DATA_DIR, 'wordle_dictionary.txt'), 'utf8');
    logicDictionary = new Set(txt.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length === 5));
  } catch { console.warn('[logic] dictionary not found'); }
}
loadLogicDictionary();

const TYPING_FILE = join(DATA_DIR, 'typing_sessions.json');
const LOGIC_FILE = join(DATA_DIR, 'logic_sessions.json');
const PIANO_FILE = join(DATA_DIR, 'piano_sessions.json');

let pianoSessions = new Map(); // normEmail -> { dailyCount, lastTs }
function loadPianoSessions() {
  try {
    const data = loadJson(PIANO_FILE, {});
    pianoSessions = new Map(Object.entries(data));
  } catch { pianoSessions = new Map(); }
}
function savePianoSessions() {
  saveJson(PIANO_FILE, Object.fromEntries(pianoSessions));
}

function loadTypingSessions() {
  try {
    const data = loadJson(TYPING_FILE, {});
    typingSessions = new Map(Object.entries(data));
  } catch { typingSessions = new Map(); }
}
function saveTypingSessions() {
  saveJson(TYPING_FILE, Object.fromEntries(typingSessions));
}
function loadClickerSessions() {
  try {
    const data = loadJson(CLICKER_FILE, {});
    clickerSessions = new Map(Object.entries(data));
  } catch { clickerSessions = new Map(); }
}
function saveClickerSessions() {
  saveJson(CLICKER_FILE, Object.fromEntries(clickerSessions));
}

function loadTypingSessions() {
  try {
    const data = loadJson(TYPING_FILE, {});
    typingSessions = new Map(Object.entries(data));
  } catch { typingSessions = new Map(); }
}
function saveTypingSessions() {
  saveJson(TYPING_FILE, Object.fromEntries(typingSessions));
}

function loadLogicSessions() {
  try {
    const data = loadJson(LOGIC_FILE, {});
    logicSessions = new Map(Object.entries(data));
  } catch { logicSessions = new Map(); }
}
function saveLogicSessions() {
  saveJson(LOGIC_FILE, Object.fromEntries(logicSessions));
}

let richardSessions = new Map();
function loadRichardSessions() {
  try {
    const data = loadJson(RICHARD_FILE, {});
    richardSessions = new Map(Object.entries(data));
  } catch { richardSessions = new Map(); }
}
function saveRichardSessions() {
  saveJson(RICHARD_FILE, Object.fromEntries(richardSessions));
}

function getAdrianPower(s) {
  let sClick = 1, sAuto = 0, sMult = 1;
  const buildMults = {};

  for (const [id, count] of Object.entries(s.upgrades || {})) {
    const tech = ADRIAN_TECH[id];
    if (tech && count > 0) {
      if (tech.target === 'global') sMult *= tech.mult;
      else buildMults[tech.target] = (buildMults[tech.target] || 1) * tech.mult;
    }
  }

  for (const [id, count] of Object.entries(s.upgrades || {})) {
    const d = ADRIAN_UPGRADES[id]; if (!d) continue;
    const m = buildMults[id] || 1;
    if (d.type === 'c') sClick += (count * d.power * m);
    if (d.type === 'a') sAuto += (count * d.power * m);
  }

  return { click: sClick * sMult, auto: sAuto * sMult };
}

function applyAdrianOffline(s, email) {
  const now = Date.now();
  const diff = now - s.lastTs;
  if (diff < 15000) return 0;

  const offlineSecs = Math.min(diff / 1000, 43200);
  const isPremium = isPremiumEmail(email);
  const { auto: sAuto } = getAdrianPower(s);

  const premMult = isPremium ? 2.0 : 1.0;
  const efficiency = isPremium ? 1.0 : 0.5;

  const offlineGain = sAuto * premMult * offlineSecs * efficiency;
  const SAFE_CAP = 1e290;
  
  if (offlineGain > 0) {
    s.points = Math.min(SAFE_CAP, s.points + offlineGain);
    s.lastTs = now;
    return offlineGain;
  }
  s.lastTs = now;
  return 0;
}

function logCheat(email, game, details, ip = 'unknown') {
  try {
    const logs = loadJson(CHEAT_LOGS_FILE, []);
    logs.unshift({
      email: email || 'unknown',
      game: game || 'unknown',
      details: details || '',
      ts: Date.now(),
      ip: ip || 'unknown'
    });
    saveJson(CHEAT_LOGS_FILE, logs.slice(0, 1000));
    console.warn(`[cheat-detector] ${email} flagged in ${game}: ${details}`);
  } catch (e) {
    console.error('[logCheat] failed:', e);
  }
}

const RICHARD_BUSINESSES = {
  lemon: { name: "Lemon Squeezer", baseCost: 4, baseRevenue: 1, baseSpeed: 0.6 },
  news: { name: "Newspaper Delivery", baseCost: 60, baseRevenue: 60, baseSpeed: 3 },
  carwash: { name: "Car Wash", baseCost: 720, baseRevenue: 540, baseSpeed: 6 },
  pizza: { name: "Pizza Delivery", baseCost: 8640, baseRevenue: 4320, baseSpeed: 12 },
  donut: { name: "Donut Shop", baseCost: 103680, baseRevenue: 51840, baseSpeed: 24 },
  shrimp: { name: "Shrimp Boat", baseCost: 1244160, baseRevenue: 622080, baseSpeed: 96 },
  hockey: { name: "Hockey Team", baseCost: 14929920, baseRevenue: 7464960, baseSpeed: 384 },
  movie: { name: "Movie Studio", baseCost: 179159040, baseRevenue: 89579520, baseSpeed: 1536 },
  bank: { name: "Bank", baseCost: 2149908480, baseRevenue: 1074954240, baseSpeed: 6144 },
  oil: { name: "Oil Company", baseCost: 25798901760, baseRevenue: 29668737024, baseSpeed: 36864 }
};

function getRichardSpeed(id, level, baseSpeed) {
  let divisor = 1;
  const milestones = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000];
  for (const m of milestones) {
    if (level >= m) {
      divisor *= 2;
    } else {
      break;
    }
  }
  return Math.max(0.05, baseSpeed / divisor);
}

function getRichardPower(s, checkManagers = false) {
  let cashPerSec = 0;
  const ownedUpgrades = new Set(s.upgrades || []);
  
  // calculate global upgrades
  let globalMult = 1;
  if (ownedUpgrades.has('all_1')) globalMult *= 2;
  if (ownedUpgrades.has('all_2')) globalMult *= 3;
  if (ownedUpgrades.has('all_3')) globalMult *= 5;

  for (const [id, info] of Object.entries(RICHARD_BUSINESSES)) {
    const level = s.levels?.[id] || 0;
    const hasManager = s.managers?.[id] || false;
    if (level > 0 && (!checkManagers || hasManager)) {
      let mult = 1;
      // apply business specific upgrades
      if (id === 'lemon' && ownedUpgrades.has('lemon_1')) mult *= 3;
      if (id === 'news' && ownedUpgrades.has('news_1')) mult *= 3;
      if (id === 'carwash' && ownedUpgrades.has('carwash_1')) mult *= 3;
      if (id === 'pizza' && ownedUpgrades.has('pizza_1')) mult *= 3;
      if (id === 'donut' && ownedUpgrades.has('donut_1')) mult *= 3;
      if (id === 'shrimp' && ownedUpgrades.has('shrimp_1')) mult *= 3;
      if (id === 'hockey' && ownedUpgrades.has('hockey_1')) mult *= 3;
      if (id === 'movie' && ownedUpgrades.has('movie_1')) mult *= 3;
      if (id === 'bank' && ownedUpgrades.has('bank_1')) mult *= 3;
      if (id === 'oil' && ownedUpgrades.has('oil_1')) mult *= 3;
      
      const revenue = level * info.baseRevenue * mult * globalMult;
      const speed = getRichardSpeed(id, level, info.baseSpeed);
      cashPerSec += (revenue / speed);
    }
  }
  return cashPerSec;
}

function applyRichardOffline(s, email) {
  const now = Date.now();
  const diff = now - s.lastTs;
  if (diff < 15000) return 0;

  const offlineSecs = Math.min(diff / 1000, 43200); // 12h cap
  const isPremium = isPremiumEmail(email);
  const cashPerSec = getRichardPower(s, true);

  const premMult = isPremium ? 2.0 : 1.0;
  const efficiency = isPremium ? 1.0 : 0.5;

  const offlineGain = cashPerSec * premMult * offlineSecs * efficiency;
  const SAFE_CAP = 1e290;
  
  if (offlineGain > 0) {
    s.cash = Math.min(SAFE_CAP, (s.cash || 0) + offlineGain);
    s.lastTs = now;
    return offlineGain;
  }
  s.lastTs = now;
  return 0;
}

function processAdrianSync(s, clientPoints, email, claim = false) {
  const now = Date.now();
  
  if (now - s.lastTs > 30000) {
    applyAdrianOffline(s, email);
  }

  const isPremium = isPremiumEmail(email);
  const premMult = isPremium ? 2.0 : 1.0;
  const { click: sClick, auto: sAuto } = getAdrianPower(s);

  const elapsed = (now - s.lastTs) / 1000;
  const maxPossibleGain = ((sAuto * elapsed) + (sClick * 60 * elapsed)) * premMult; 
  const actualGain = clientPoints - s.points;
  
  const SAFE_CAP = 1e290;

  if (actualGain > maxPossibleGain * 3.0) {
    logCheat(email, 'Adrian Clicker 2.0', `Attempted impossible gain of ${actualGain.toExponential(2)} points (max possible: ${maxPossibleGain.toExponential(2)})`);
    s.points = Math.min(SAFE_CAP, s.points + maxPossibleGain);
  } else {
    s.points = Math.min(SAFE_CAP, Math.max(s.points, clientPoints));
  }

  let coinsToGrant = 0;

  // Compute how many playtime coins have been earned (but only pay them out on claim)
  const sessionElapsed = now - (s.startTime || now);
  const totalPlaytimeCoins = Math.floor(sessionElapsed / 600000);
  const pendingPlaytimeBonus = totalPlaytimeCoins - (s.playtimeCoins || 0);

  if (claim) {
    while (true) {
      // Semi-exponential: Cost grows by 4% per coin owned
      const costOfNext = Math.floor(10 * Math.pow(1.04, s.coins));
      if (s.points >= costOfNext) {
        s.points -= costOfNext;
        s.coins++;
        coinsToGrant++;
      } else {
        break;
      }
    }

    // Pay out any accumulated playtime bonus only when the user claims
    if (pendingPlaytimeBonus > 0) {
      coinsToGrant += pendingPlaytimeBonus;
      s.playtimeCoins = (s.playtimeCoins || 0) + pendingPlaytimeBonus;
    }
  }

  if (coinsToGrant > 0) {
    const bonusCount = isPremium ? coinsToGrant * 2 : coinsToGrant;
    addCoins(email, bonusCount);
    updateStat(email, 'clicker_coins', bonusCount);
    console.log(`[clicker] ${email} earned ${bonusCount} MitchCoins (Claim: ${claim}, Playtime: ${pendingPlaytimeBonus > 0})`);
  }

  if (actualGain > 0) {
    updateStat(email, 'clicker_points', Math.floor(actualGain));
  }
  s.lastTs = now;

  return s;
}
const PLAYTIME_COIN_INTERVAL = 300000; // 5 minutes
const SESSION_GAP = 600;

// Puzzle state for verification
const activePuzzles = new Map(); // email -> {fen, ts}
const bjGames = new Map();
const pokerGames = new Map();
const casinoHistory = new Map();

// AI rate limiting
const aiUserTimes  = {};
let   aiGlobalTimes = [];
const AI_USER_MAX = 8, AI_USER_WIN = 3600;
const AI_GLOB_MAX = 12, AI_GLOB_WIN = 60;

// E2E state
const e2eUsers    = {};
const e2eMessages = {};

// ── Chess-VS state ────────────────────────────────────────────────────────────
const CHESS_VS_FILE = join(BASE, 'data', 'chess_vs.json');
const cvGames = {};       // gameId -> game
const cvChallenges = {};  // id -> challenge
const cvChats = {};       // gameId -> msg[]
try { Object.assign(cvGames, loadJson(CHESS_VS_FILE, {})); } catch {}
function cvSave() {
  const out = {};
  for (const [id, g] of Object.entries(cvGames)) if (g.type === 'corr') out[id] = g;
  saveJson(CHESS_VS_FILE, out);
}
function cvCheckTimeout(g) {
  if (g.status !== 'active' || !g.tc) return;
  const startedAt = g.type === 'corr' ? g.clockStartedAt : g.lastMoveAt;
  if (!startedAt) return;
  const t = g.turn, rem = g.clocks[t] - (Date.now() - startedAt);
  if (rem <= 0) { 
    g.status = 'over'; g.result = t === 'w' ? '0-1' : '1-0'; g.reason = 'timeout'; 
    const winner = g.result === '1-0' ? g.white : g.black;
    const bet = g.bet || 0;
    let winBonus = 50 + (bet * 2);
    if (areFriends(g.white, g.black)) {
      winBonus = Math.floor(winBonus * 1.5);
    }
    addCoins(winner, winBonus);
    updateStat(winner, 'chess_wins', 1);
    if (g.type === 'corr') cvSave();
  }
}

const cvOnline = {};  // email -> last_seen ms

// ── Battleship state ──────────────────────────────────────────────────────────
const bsChallenges = {}; // id -> { id, from, to, bet, createdAt }
const bsGames = {};      // gameId -> game object
const bsOnline = {};     // email -> last_seen ms

// ── Jeopardy state ────────────────────────────────────────────────────────────
const jeopardyLobbies = {}; // gameId -> lobby object
let jeopardyClueCache = []; // flat array of { category, clue, answer, value }
let jeopardyLastFetch = 0;
const JEOPARDY_CACHE_TTL = 24 * 60 * 60 * 1000; // refresh daily

// Fetch and parse jeopardy clues from GitHub TSV dataset (async, runs at startup)
async function loadJeopardyClues() {
  try {
    const cleanPath = join(DATA_DIR, 'jeopardy_kids_clean.json');
    if (existsSync(cleanPath)) {
      jeopardyClueCache = loadJson(cleanPath, []);
      jeopardyLastFetch = Date.now();
      console.log(`[Jeopardy] Loaded ${jeopardyClueCache.length} clues from clean local cache`);
      return;
    }

    const localPath = join(DATA_DIR, 'kids_teen_matches.tsv');
    let text;
    if (existsSync(localPath)) {
      text = readFileSync(localPath, 'utf8');
      console.log(`[Jeopardy] Loaded database from local cache tsv`);
    } else {
      console.log(`[Jeopardy] Downloading kids/teen clue database from GitHub...`);
      const url = 'https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/refs/heads/main/kids_teen_matches.tsv';
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed: ' + res.status);
      text = await res.text();
      try { writeFileSync(localPath, text, 'utf8'); } catch(we) { console.error('[Jeopardy] failed to write local tsv:', we); }
    }
    const lines = text.split('\n');
    const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const roundIdx = header.indexOf('round');
    const valIdx = header.indexOf('clue_value');
    const catIdx = header.indexOf('category');
    const clueIdx = header.indexOf('answer'); // 'answer' contains the clue text
    const ansIdx = header.indexOf('question'); // 'question' contains the target answer
    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length < 5) continue;
      const round = (cols[roundIdx] || '').trim();
      // Only use regular Jeopardy (1) and Double Jeopardy (2) rounds (not Final/Tiebreaker)
      if (round !== '1' && round !== '2') continue;
      const clue = (cols[clueIdx] || '').trim();
      const answer = (cols[ansIdx] || '').trim();
      const category = (cols[catIdx] || '').trim().toUpperCase();
      const rawVal = parseInt((cols[valIdx] || '0').replace(/\D/g, ''), 10);
      if (!clue || !answer || !category || !rawVal) continue;
      parsed.push({ category, clue, answer, value: rawVal });
    }

    // Sample 25,000 clues to keep memory low and parse time under 3ms
    const sampled = parsed.sort(() => Math.random() - 0.5).slice(0, 25000);
    saveJson(cleanPath, sampled);

    // Clean up the TSV file to prevent disk bloat
    try { if (existsSync(localPath)) rmSync(localPath); } catch {}

    jeopardyClueCache = sampled;
    jeopardyLastFetch = Date.now();
    console.log(`[Jeopardy] Created clean cache with ${sampled.length} clues`);
  } catch (e) {
    console.error('[Jeopardy] Failed to load clues:', e.message);
  }
}

// Build a random Jeopardy board: 6 categories × 5 clues with dollar values 200/400/600/800/1000
function buildJeopardyBoard() {
  if (jeopardyClueCache.length < 100) return null;
  // Group by category
  const byCategory = {};
  for (const c of jeopardyClueCache) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }
  // Pick categories with at least 5 clues
  const eligible = Object.keys(byCategory).filter(k => byCategory[k].length >= 5);
  if (eligible.length < 6) return null;
  // Shuffle and take 6
  const shuffled = eligible.sort(() => Math.random() - 0.5).slice(0, 6);
  const VALUES = [200, 400, 600, 800, 1000];
  const board = {};
  const dailyDoubles = [];
  // Pick 1-2 random daily double positions
  const ddCount = Math.random() < 0.5 ? 1 : 2;
  while (dailyDoubles.length < ddCount) {
    const cat = shuffled[Math.floor(Math.random() * 6)];
    const val = VALUES[Math.floor(Math.random() * 5)];
    const key = `${cat}|${val}`;
    if (!dailyDoubles.includes(key)) dailyDoubles.push(key);
  }
  for (const cat of shuffled) {
    const clues = byCategory[cat].sort(() => Math.random() - 0.5);
    board[cat] = VALUES.map((val, i) => {
      const c = clues[i];
      const key = `${cat}|${val}`;
      return {
        value: val,
        clue: c.clue,
        answer: c.answer,
        answered: false,
        dailyDouble: dailyDoubles.includes(key),
        answeredBy: null,
      };
    });
  }
  return { categories: shuffled, board, dailyDoubles };
}

// Get a random clue from cache that is NOT in the board's categories
function getFinalJeopardyClue(boardCategories) {
  if (jeopardyClueCache.length === 0) return null;
  const filtered = jeopardyClueCache.filter(c => !boardCategories.includes(c.category));
  if (filtered.length === 0) return jeopardyClueCache[Math.floor(Math.random() * jeopardyClueCache.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Fuzzy answer matching: strip articles, punctuation, normalize whitespace
async function jeopardyAnswerMatches(given, correct) {
  // Local anti-injection and meta-response filters
  const lowerGiven = given.toLowerCase().trim();
  if (lowerGiven.includes('[') || lowerGiven.includes(']') || lowerGiven.includes('{') || lowerGiven.includes('}')) return false;
  if (lowerGiven.includes('correct answer') || lowerGiven.includes('right answer') || 
      lowerGiven === 'yes' || lowerGiven === 'no' || lowerGiven === 'true' || lowerGiven === 'false') {
    return false;
  }

  const normalize = s => s.toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const g = normalize(given);
  const c = normalize(correct);
  if (g === c) return true;
  // Allow if one contains the other (for short answers)
  if (c.length > 3 && g.includes(c)) return true;
  if (g.length > 3 && c.includes(g)) return true;
  // Levenshtein distance ≤ 2 for short answers
  if (Math.abs(g.length - c.length) <= 3) {
    let dist = 0;
    for (let i = 0; i < Math.max(g.length, c.length); i++) {
      if (g[i] !== c[i]) dist++;
    }
    if (dist <= 2) return true;
  }

  // Fallback to Groq AI check
  if (!GROQ_KEY) return false;
  try {
    const prompt = `You are evaluating a Jeopardy contestant's response.
Target Answer: "${correct}"
Contestant's Response: "${given}"

Is the response correct or "good enough" (e.g., matching synonym, matching abbreviation like FDR, last name only where appropriate, minor spelling mistake, or exact match)?
Respond with exactly one word: "YES" or "NO". Do not output any explanation or extra text.`;
    const messages = [{ role: 'user', content: prompt }];
    const [aiResponse] = await callGroq(messages, "You are a Jeopardy judge who evaluates answers strictly but fairly.");
    if (aiResponse) {
      const clean = aiResponse.trim().toUpperCase();
      if (clean.includes('YES')) return true;
    }
  } catch (e) {
    console.error('[Jeopardy AI Check Error]', e);
  }
  return false;
}

// Load clues at startup and refresh daily
loadJeopardyClues();
setInterval(() => {
  if (Date.now() - jeopardyLastFetch > JEOPARDY_CACHE_TTL) loadJeopardyClues();
}, 60 * 60 * 1000);


const userPresence = {}; // normalizedEmail -> { lastSeen: ms, playing: string }

function touchUserPresence(email, playing = '') {
  if (!email) return;
  const norm = normalizeEmail(email);
  const now = Date.now();
  const prev = userPresence[norm];
  const wasOffline = !prev || (now - prev.lastSeen > 120000);

  userPresence[norm] = {
    lastSeen: now,
    playing: String(playing || '').trim()
  };

  cvOnline[email] = now;
  cvOnline[norm] = now;

  if (wasOffline) {
    notifyFriendsOnline(email);
  }
}

function notifyFriendsOnline(email) {
  try {
    const norm = normalizeEmail(email);
    const friends = loadJson(FRIENDS_FILE, {});
    const myList = friends[norm] || [];
    const senderName = maskEmail(email);
    const subs = loadJson(PUSH_SUBS_FILE, {});

    for (const friend of myList) {
      const friendNorm = normalizeEmail(friend);
      const sub = subs[friend] || subs[friendNorm];
      if (sub && VAPID_PUBLIC) {
        webpush.sendNotification(sub, JSON.stringify({
          title: 'Friend Online',
          body: `${senderName} is now online!`,
          url: notificationUrl('/'),
        })).catch(e => {
          if (e.statusCode === 410 || e.statusCode === 404) {
            delete subs[friend];
            delete subs[friendNorm];
            saveJson(PUSH_SUBS_FILE, subs);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error in notifyFriendsOnline:', err);
  }
}

function areFriends(playerA, playerB) {
  if (!playerA || !playerB) return false;
  const normA = normalizeEmail(playerA);
  const normB = normalizeEmail(playerB);
  const friends = loadJson(FRIENDS_FILE, {});
  const listA = friends[normA] || [];
  const listB = friends[normB] || [];
  return listA.some(f => normalizeEmail(f) === normB) || listB.some(f => normalizeEmail(f) === normA);
}

// VPN cache
let knownVpnIps   = new Set();
let knownCleanIps = new Set();
const checkingIps = new Set();
try { knownVpnIps   = new Set(JSON.parse(readFileSync(KNOWN_VPN_FILE, 'utf8'))); }   catch {}
try { knownCleanIps = new Set(JSON.parse(readFileSync(KNOWN_CLEAN_FILE, 'utf8'))); } catch {}

// ── Admin Global State ────────────────────────────────────────────────────────
let globalCoinMultiplier = 1.0;
let happyHourActive = false;
let computedHappyHour = 12; // Default to 12 PM (lunch hour)
const trafficHistory = []; // [timestamp, timestamp, ...]
let casinoEnabled = true;
let casinoIntake = 0;
let casinoPayout = 0;
try {
  const cst = loadJson(join(BASE, 'data', 'casino_stats.json'), { intake: 0, payout: 0 });
  casinoIntake = cst.intake;
  casinoPayout = cst.payout;
} catch {}

function saveCasinoStats() { saveJson(join(BASE, 'data', 'casino_stats.json'), { intake: casinoIntake, payout: casinoPayout }); }

const trafficFeed = []; // { user, page, ts }
const bettingFeed = []; // { user, game, amount, outcome, ts }
let shadowBans = new Set();
try { shadowBans = new Set(loadJson(join(BASE, 'data', 'shadow_bans.json'), [])); } catch {}

let casinoRigChance = 0; // 0% by default

const proxBlocklist = new Set();
try { Object.assign(proxBlocklist, new Set(loadJson(join(BASE, 'data', 'prox_blocklist.json'), []))); } catch {}
let featuredGameHref = '';

let globalGameStats = {};
function saveGlobalGameStats() {
  saveJson(GLOBAL_GAME_STATS_FILE, globalGameStats);
}

function updateGlobalGameStats(pg) {
  if (!pg) return;
  let p = pg;
  for (const dom of ['https://mitch.pro', 'https://mitch.88chan.me']) {
    if (p.startsWith(dom)) p = p.slice(dom.length);
  }
  if (p.startsWith('/proxy/gamemonetize/')) {
    p = p.replace('/proxy/gamemonetize/', 'https://html5.gamemonetize.co/');
  }
  const isGame = p.startsWith('https://html5.gamemonetize.co/') || (p.includes('/games/') && p !== '/games/' && p !== '/games' && !p.startsWith('/games/index.html'));
  if (isGame) {
    p = p.split('#')[0].split('?')[0];
    if (p.endsWith('/index.html')) p = p.slice(0, -10);
    if (!p.endsWith('/')) p += '/';
    globalGameStats[p] = (globalGameStats[p] || 0) + 1;
    saveGlobalGameStats();
  }
}

function loadGlobalGameStats() {
  try {
    globalGameStats = loadJson(GLOBAL_GAME_STATS_FILE, {});
    // Fallback: if file is empty, try parsing from master log
    if (Object.keys(globalGameStats).length === 0 && existsSync(MASTER_SESSION_LOG)) {
      const content = readFileSync(MASTER_SESSION_LOG, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          updateGlobalGameStats(e.page);
        } catch {}
      }
      console.log(`[stats] Re-indexed game stats from master log (${Object.keys(globalGameStats).length} games)`);
    } else {
      console.log(`[stats] Loaded ${Object.keys(globalGameStats).length} game counters from file.`);
    }
  } catch (e) { console.error('[stats] failed to load stats:', e); }
}

const allSockets = new Set();
function saveShadowBans() { saveJson(join(BASE, 'data', 'shadow_bans.json'), Array.from(shadowBans)); }

function logTraffic(user, page) {
  trafficFeed.unshift({ user, page, ts: Date.now() });
  if (trafficFeed.length > 50) trafficFeed.pop();
}

function logBet(user, game, amount, outcome) {
  bettingFeed.unshift({ user, game, amount, outcome, ts: Date.now() });
  if (bettingFeed.length > 50) bettingFeed.pop();
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'anonymous';
  const parts = email.split('@');
  const local = parts[0];
  const domain = parts[1];
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function logProxyVisit(email, path) {
  try {
    const logs = loadJson(PROXY_LOG_FILE, []);
    const list = Array.isArray(logs) ? logs : [];
    list.push({
      email: maskEmail(email),
      path: String(path || '/').slice(0, 300),
      ts: Date.now(),
      at: new Date().toISOString()
    });
    saveJsonSync(PROXY_LOG_FILE, list.slice(-5000));
  } catch (e) {
    console.warn('[proxy] failed to log visit:', e?.message || e);
  }
}

// Rate limiting
const rlLog  = {};
const banned = {};
const NEWSLETTER_BAN_WINDOW   = 60;
const NEWSLETTER_BAN_THRESH   = 10;
const NEWSLETTER_BAN_DURATION = 7 * 24 * 3600;

const RATE_LIMITS = {
  '/api/request-access':       [3,   600],
  '/api/claim-token':          [10,  3600],
  '/api/pass':                 [60,  60],
  '/api/e2e/verify-password':  [5,   60],
  '/api/content':              [120, 60],
  '/api/ping':                 [120, 60],
  '/api/ai':                   [20,  60],
  '/api/script':               [600, 60],
  '/api/admin/js':             [5,   60],
  '/api/admin/trigger-daily-summary': [10, 60],
  '/api/admin/gift-coins':     [10,  60],
  '/api/admin/grant-premium':  [10,  60],
  '/api/admin/revoke-premium': [10,  60],
  '/api/admin/send-notification': [20, 60],
  '/api/admin/unsend-notification': [20, 60],
  '/api/newsletter-signup':    [3,   60],
  '/api/newsletter/unsubscribe-secure': [10, 600],
  '/api/newsletter/unsubscribe-direct': [10, 600],
  '/api/invite/send':          [5,   3600],
  '/api/invite/set-code':      [3,   60],
  '/api/apply':                [2,   3600],
  '/api/suggest':              [3,   60],
  '/api/migrateid':            [20,  60],
  '/api/vpn-check':            [30,  60],
  '/api/me/coins':             [30,  60],
  '/api/daily-login/state':    [120, 60],
  '/api/daily-login/claim':    [30,  60],
  '/api/me/logout-other':      [5,   60],
  '/api/leaderboard':          [10,  60],
  '/api/friends/list':             [30,  60],
  '/api/friends/request':          [10,  60],
  '/api/friends/request/cancel':   [15,  60],
  '/api/friends/requests/pending': [30,  60],
  '/api/friends/request/respond':  [15,  60],
  '/api/friends/remove':           [10,  60],
  '/api/presence/heartbeat':       [60,  60],
  '/api/premium-chat/history': [60,  60],
  '/api/premium-chat/send':    [3,   10],
  '/api/public-chat/history':  [60,  60],
  '/api/public-chat/send':     [3,   10],
  '/api/dm/send':              [3,   10],
  '/api/marketplace/list':     [1,   30],
  '/api/marketplace/buy':      [1,   30],
  '/api/marketplace/mediate':  [1,   30],
  '/api/marketplace/appeal':   [1,   30],
  '/api/marketplace/items':    [60,  60],
  '/api/chess/puzzle-solved':  [15,  3600],
  '/api/games/lillians-logic/solve': [10, 60],
  '/api/chess-vs/challenge':   [5,   600],
  '/api/chess-vs/move':        [60,  60],
  '/api/canvas/pixel':         [1000, 60], // 1000 pixels per minute by default
  '/api/canvas/pixels/bulk':   [1000, 60], // 1000 bulk draw requests per minute
  '/api/canvas/history':       [10,  60],
  '/api/battleship/challenge':  [5,   600],
  '/api/battleship/respond':    [10,  60],
  '/api/battleship/place':      [5,   60],
  '/api/battleship/fire':       [60,  60],
  '/api/battleship/state':      [60,  60],
  '/api/battleship/resign':     [5,   60],
  '/api/jeopardy/create':       [5,   600],
  '/api/jeopardy/join':         [10,  60],
  '/api/jeopardy/start':        [5,   60],
  '/api/jeopardy/select':       [30,  60],
  '/api/jeopardy/buzz':         [30,  60],
  '/api/jeopardy/answer':       [30,  60],
  '/api/jeopardy/wager':        [10,  60],
  '/api/jeopardy/visibility':   [120,  60],
  '/api/jeopardy/state':        [300,  60],
  '/api/jeopardy/final/wager':  [10,  60],
  '/api/jeopardy/final/answer': [10,  60],
  '__default__':               [100, 60],
};

const CHESS_RATE_WINDOW = 4;
const CHESS_RATE_MAX    = 2;
const chessRl = {};

const NUDGE_SUBJECT = "Haven't seen you on mitch.pro";
const NUDGE_BODY = `Hey,

We noticed you haven't stopped by mitch.pro in a while, just wanted to make sure everything's good.

If you have any issues logging in, you can email support@mitch.pro or mitchell.fogler@student.rjuhsd.us.

Otherwise, come check out what's new, there have been a few additions lately.

— mitch.pro`;
const NUDGE_DAYS = 7;

const BAD_NICS = new Set(['awgnagae']);
try {
  JSON.parse(readFileSync(join(BASE, 'data', 'bad_words.json'), 'utf8')).forEach(w => BAD_NICS.add(w));
} catch { console.log('error opening file data/bad_words.json'); }

// Puzzle database
let puzzles    = [];
let puzzleRats = [];
const PUZZLE_FILE = join(BASE, 'webserver/games/chess-bot/puzzles.json');
try {
  puzzles    = JSON.parse(readFileSync(PUZZLE_FILE, 'utf8'));
  puzzleRats = puzzles.map(p => p[2]);
  console.log(`Loaded ${puzzles.length.toLocaleString()} puzzles`);
} catch (e) { console.log(`Puzzles not loaded: ${e}`); }

const EMAIL_WHITELIST_BUILTIN = new Set(['avel.krasnoperov@student.rjuhsd.us']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function threadKey(subject) {
  return (subject || '').replace(/^(re|fwd?):\s*/i, '').trim().toLowerCase();
}

function loadJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

async function saveJson(file, data) {
  const tmp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file);
  } catch (e) {
    console.error(`[saveJson] error writing ${file}: ${e.message}`);
    if (existsSync(tmp)) rmSync(tmp);
  }
}

function saveJsonSync(file, data) {
  const tmp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
  try {
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file);
  } catch (e) {
    console.error(`[saveJsonSync] error writing ${file}: ${e.message}`);
    if (existsSync(tmp)) rmSync(tmp);
  }
}

function site() {
  return loadJson(join(BASE, 'data', 'site.json'),
    { primary: 'https://mitch.pro', alternate: 'https://mitch.88chan.me', name: 'mitch.pro' });
}
function emailSig() { const s = site(); return `\n— ${s.name}`; }
function emailFooter() {
  const s = site();
  return `\n\nAlso accessible at ${s.alternate}\n\nFor support email support@mitch.pro or mitchell.fogler@student.rjuhsd.us`;
}
function siteUrl(email) {
  const s = site();
  return String(email).toLowerCase().endsWith('@student.rjuhsd.us') ? s.alternate : s.primary;
}

function notificationUrl(path = '/') {
  const clean = String(path || '/');
  return NOTIFICATION_ORIGIN + (clean.startsWith('/') ? clean : '/' + clean);
}

function stripPlus(email) {
  if (!email.includes('@')) return email;
  const at = email.lastIndexOf('@');
  return email.slice(0, at).split('+')[0] + '@' + email.slice(at + 1);
}

async function isSecurePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  const badPath = join(DATA_DIR, 'bad_passwords.json');
  let badPasswords = [];
  try {
    if (existsSync(badPath)) {
      badPasswords = JSON.parse(readFileSync(badPath, 'utf8'));
    }
  } catch {}
  if (badPasswords.map(p => p.toLowerCase()).includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common and insecure.' };
  }

  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'User-Agent': 'mitch.pro-password-validator' }
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const [partsuff, countStr] = line.trim().split(':');
        if (partsuff === suffix) {
          const count = parseInt(countStr || '0', 10);
          if (count > 0) {
            return { valid: false, error: 'This password has been leaked in a data breach ' + count + ' times and is unsafe to use.' };
          }
        }
      }
    }
  } catch (e) {
    console.error('[hibp] API check failed:', e);
  }

  return { valid: true };
}

let passwordsCache = null;
function loadPasswords() {
  if (passwordsCache) return passwordsCache;
  passwordsCache = loadJson(PASSWORDS_FILE, {});
  return passwordsCache;
}
function savePasswords(p) {
  passwordsCache = p;
  saveJson(PASSWORDS_FILE, p);
}

function normalizeEmail(email) {
  if (!email) return '';
  let e = String(email).toLowerCase().trim();
  if (!e.includes('@')) return e;
  const at = e.lastIndexOf('@');
  const localRaw = e.slice(0, at).split('+')[0];
  const domainRaw = e.slice(at + 1);
  const local = localRaw.replace(/\./g, '');
  const reservedMitchPro = new Set(['admin', 'support', 'noreply', 'mitch']);
  const domain = ((domainRaw === 'student.mitch.pro' || domainRaw === 'mitch.pro') && !reservedMitchPro.has(local))
    ? 'student.rjuhsd.us'
    : domainRaw;
  return local + '@' + domain;
}

function maskEmail(email) {
  if (!email) return '';
  return email.replace(/@student\.rjuhsd\.us$/i, '@student.mitch.pro');
}
function loadAdminPassphrase() {
  return loadJson(PASSPHRASE_FILE, {});
}

function saveAdminPassphraseForUser(norm, entry) {
  const data = loadAdminPassphrase();
  data[norm] = entry;
  saveJson(PASSPHRASE_FILE, data);
}

async function verifyAdminPassphrase(req, passphrase = '') {
  const cookies = getCookies(req);
  const sid = cookies['studentId'] || cookies['id'] || '';
  const email = emailFromSid(sid) || 'admin';
  const norm = normalizeEmail(email);

  const data = loadAdminPassphrase();
  const entry = data[norm] || {};
  const hash = String(entry.hash || '');
  if (!hash) return false;
  const pass = String(passphrase || req.headers.get('X-Admin-Passphrase') || '').trim();
  if (!pass) return false;
  try { return await Bun.password.verify(pass, hash); }
  catch { return false; }
}

function makeId() {
  const raw = randomBytes(16).toString('hex');
  const sig  = createHmac('sha256', ID_SECRET).update(raw).digest('hex').slice(0, 16);
  return raw + '.' + sig;
}

function makeEmailId(email, gen = 0) {
  const key       = gen === 0 ? email : `${email}:v${gen}`;
  const emailHash = createHash('sha256').update(key).digest('hex').slice(0, 24);
  const raw       = 'e' + emailHash;
  const sig       = createHmac('sha256', ID_SECRET).update(raw).digest('hex').slice(0, 16);
  return raw + '.' + sig;
}

function validId(token) {
  if (!token || !String(token).includes('.')) return false;
  token = String(token);
  const lastDot = token.lastIndexOf('.');
  const raw = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac('sha256', ID_SECRET).update(raw).digest('hex').slice(0, 16);
  try { return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
  catch { return false; }
}

function userdataPath(idVal) {
  try {
    const key = createHash('sha256').update(idVal).digest('hex').slice(0, 32);
    const d   = join(USERDATA_DIR, key);
    mkdirSync(d, { recursive: true });
    return join(d, 'data.json');
  } catch { return null; }
}

// File-backed data helpers
function loadTokens()    { return tokensCache; }
function saveTokens(t)    { tokensCache = t; saveJson(TOKENS_FILE, t); }
function loadRevoked()    { return loadJson(REVOKED_FILE, {}); }
function saveRevoked(r)   { saveJson(REVOKED_FILE, r); }
function isRevoked(id)    { return id in loadRevoked(); }
function loadAppeals()    { return loadJson(APPEALS_FILE, []); }
function saveAppeals(a)   { saveJson(APPEALS_FILE, a); }

function saveApplications(apps) {
  applications = apps;
  saveJson(APPLICATIONS_FILE, apps);
}

function loadBlacklist()  { return loadJson(BLACKLIST_FILE, {}); }
function saveBlacklist(b) { saveJson(BLACKLIST_FILE, b); }
function bannedInfoForEmail(email) {
  if (!email) return null;
  const bl = loadBlacklist();
  const norm = normalizeEmail(email);
  return bl[norm] || bl[String(email).toLowerCase()] || null;
}
function isBannedEmail(email) { return !!bannedInfoForEmail(email); }
function bannedInfoForSid(sid) {
  if (!sid || !validId(sid)) return null;
  const email = emailFromSid(sid);
  return email ? bannedInfoForEmail(email) : null;
}

let cachedNames = null;
let lastNamesLoad = 0;
function getCachedNames() {
  const now = Date.now();
  if (!cachedNames || now - lastNamesLoad > 2000) {
    cachedNames = loadJson(NAMES_FILE, {});
    lastNamesLoad = now;
  }
  return cachedNames;
}

let lastKnownIps = {};
try {
  lastKnownIps = loadJson(join(DATA_DIR, 'last_known_ips.json'), {});
} catch {}

function saveLastKnownIps() {
  saveJson(join(DATA_DIR, 'last_known_ips.json'), lastKnownIps);
}

function loadBannedIps() {
  return loadJson(join(DATA_DIR, 'banned_ips.json'), {});
}

function saveBannedIps(ips) {
  saveJson(join(DATA_DIR, 'banned_ips.json'), ips);
}

function bannedInfoForIp(ip) {
  if (!ip) return null;
  const bannedIps = loadBannedIps();
  return bannedIps[ip] || null;
}
function loadGenerations() { return loadJson(GENERATIONS_FILE, {}); }
function saveGenerations(g){ saveJson(GENERATIONS_FILE, g); }
function loadInvalidated() { return loadJson(INVALIDATED_FILE, {}); }
function saveInvalidated(inv) {
  const now = Date.now() / 1000;
  for (const [id, ts] of Object.entries(inv)) {
    if (now - ts > 1209600) delete inv[id];
  }
  saveJson(INVALIDATED_FILE, inv);
}
function isInvalidated(id) { return id in loadInvalidated(); }

function loadUnlimitedIds() {
  try { return new Set(JSON.parse(readFileSync(UNLIMITED_IDS_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function addUnlimitedId(sid) {
  const ids = loadUnlimitedIds();
  if (!ids.has(sid)) { ids.add(sid); saveJson(UNLIMITED_IDS_FILE, [...ids]); }
}
function isUnlimitedId(sid) { return loadUnlimitedIds().has(sid); }

function isAutoApprove() {
  try { return readFileSync(AUTO_APPROVE_FILE, 'utf8').trim() === '1'; }
  catch { return true; }
}

function checkAdminPw(pw) {
  try { return pw && readFileSync(ADMIN_KEY_FILE, 'utf8').trim() === pw; }
  catch { return false; }
}

function loadNudge()   { return loadJson(NUDGE_FILE, {}); }
function saveNudge(d)  { saveJson(NUDGE_FILE, d); }

function nudgeClear(email) {
  if (!email || !email.includes('@')) return;
  const nudged = loadNudge();
  if (email.toLowerCase() in nudged) {
    delete nudged[email.toLowerCase()];
    saveNudge(nudged);
  }
}

// ── Economy & Gamification helpers ────────────────────────────────────────────

const ACHIEVEMENT_DEFINITIONS = {
  'painter_1': { name: 'Painter I', desc: 'Place 100 pixels', bonus: 100, goal: 100, stat: 'pixels' },
  'painter_2': { name: 'Painter II', desc: 'Place 1000 pixels', bonus: 500, goal: 1000, stat: 'pixels' },
  'chess_win_1': { name: 'First Win', desc: 'Win your first chess game', bonus: 100, goal: 1, stat: 'chess_wins' },
  'chess_win_2': { name: 'Grandmaster', desc: 'Win 10 chess games', bonus: 500, goal: 10, stat: 'chess_wins' },
  'puzzle_master': { name: 'Puzzle Master', desc: 'Solve 50 puzzles', bonus: 250, goal: 50, stat: 'puzzles_solved' },
  'casino_novice': { name: 'High Roller I', desc: 'Play 10 casino games', bonus: 100, goal: 10, stat: 'casino_bets' },
  'casino_regular': { name: 'High Roller II', desc: 'Play 100 casino games', bonus: 500, goal: 100, stat: 'casino_bets' },
  'casino_winner': { name: 'Lucky Streak', desc: 'Win 50 casino games', bonus: 250, goal: 50, stat: 'casino_wins' },
  'clicker_1': { name: 'Clicker Novice', desc: 'Reach 1,000,000 clicker points', bonus: 100, goal: 1000000, stat: 'clicker_points' },
  'clicker_2': { name: 'Clicker Master', desc: 'Reach 100,000,000 clicker points', bonus: 500, goal: 100000000, stat: 'clicker_points' },
  'typing_1': { name: 'Typist Novice', desc: 'Play 10 typing races', bonus: 100, goal: 10, stat: 'typing_races' },
  'typing_2': { name: 'Typist Master', desc: 'Play 100 typing races', bonus: 500, goal: 100, stat: 'typing_races' },
  'logic_1': { name: 'Logic Novice', desc: 'Solve 10 logic puzzles', bonus: 100, goal: 10, stat: 'logic_puzzles' },
  'logic_2': { name: 'Logic Master', desc: 'Solve 100 logic puzzles', bonus: 500, goal: 100, stat: 'logic_puzzles' },
  'richard_1': { name: 'Rich Friends', desc: 'Earn 1,000 coins from Richard', bonus: 100, goal: 1000, stat: 'richard_coins' },
  'richard_2': { name: 'Royal Riches', desc: 'Earn 10,000 coins from Richard', bonus: 500, goal: 10000, stat: 'richard_coins' },
  'piano_1': { name: 'Pianist Novice', desc: 'Play 10 piano games', bonus: 100, goal: 10, stat: 'piano_games' },
  'piano_2': { name: 'Pianist Master', desc: 'Play 100 piano games', bonus: 500, goal: 100, stat: 'piano_games' },
  'battleship_1': { name: 'Commodore', desc: 'Win 1 battleship game', bonus: 100, goal: 1, stat: 'battleship_wins' },
  'battleship_2': { name: 'Fleet Admiral', desc: 'Win 10 battleship games', bonus: 500, goal: 10, stat: 'battleship_wins' },
  'jeopardy_1': { name: 'Smart Contestant', desc: 'Win 1 Jeopardy game', bonus: 100, goal: 1, stat: 'jeopardy_wins' },
  'jeopardy_2': { name: 'Jeopardy Legend', desc: 'Win 10 Jeopardy games', bonus: 500, goal: 10, stat: 'jeopardy_wins' }
};

function loadCoins() { return coinsCache; }
function saveCoins(c) { coinsCache = c; saveJson(COINS_FILE, c); }
function getCoins(email) { if (!email) return 0; return loadCoins()[normalizeEmail(email)] || 0; }
function addCoins(email, amount, reason = '') {
  if (!email) return;
  const norm = normalizeEmail(email);
  const coins = loadCoins();
  const stats = loadUserStats();
  const personalHH = (stats[norm]?.personal_happy_hour_until || 0) > Date.now();
  const mult = personalHH ? Math.max(globalCoinMultiplier, 2.0) : globalCoinMultiplier;
  const adjusted = (amount > 0) ? (amount * mult) : amount;
  const before = coins[norm] || 0;
  coins[norm] = Number(( before + adjusted ).toFixed(4));
  saveCoins(coins);

  // Track lifetime earned in stats
  if (amount > 0) {
    if (!stats[norm]) stats[norm] = {};
    stats[norm].lifetime_earned = (stats[norm].lifetime_earned || 0) + adjusted;
    saveUserStats(stats);
  }

  // Append to coin log
  try {
    const ts = new Date().toISOString();
    const sign = adjusted >= 0 ? '+' : '';
    const logLine = `${ts}\t${norm}\t${sign}${adjusted.toFixed(4)}\t${before.toFixed(4)} -> ${coins[norm].toFixed(4)}\t${reason || 'unspecified'}\n`;
    appendFileSync(join(LOGS_DIR, 'coins.log'), logLine, 'utf8');
  } catch {}
}

function sendUserNotification(email, message) {
  if (!email) return;
  const norm = normalizeEmail(email);
  const payload = JSON.stringify({ type: 'admin_broadcast', message });
  for (const ws of allSockets) {
    if (ws.data && ws.data.isBroadcast && ws.data.email && normalizeEmail(ws.data.email) === norm) {
      try { ws.send(payload); } catch {}
    }
  }
}

function triggerNotificationRefresh() {
  const payload = JSON.stringify({ type: 'refresh_notifications' });
  for (const ws of allSockets) {
    if (ws.data && ws.data.isBroadcast) {
      try { ws.send(payload); } catch {}
    }
  }
}

function autoFinalizeMarketplace() {
  try {
    const list = loadJson(MARKETPLACE_FILE, []);
    let modified = false;
    const now = Date.now();
    const expiryWindow = 24 * 3600 * 1000; // 24 hours

    for (const listing of list) {
      if (listing.status === 'pending' && listing.bought_at && (now - listing.bought_at > expiryWindow)) {
        // Finalize transaction
        listing.status = 'finalized';
        listing.finalized_at = now;
        listing.updated_at = now;
        modified = true;

        // 1. Transfer coins to seller (bypass Happy Hour multiplier)
        const coins = loadCoins();
        const sellerNorm = normalizeEmail(listing.seller);
        coins[sellerNorm] = Number(((coins[sellerNorm] || 0) + listing.price).toFixed(4));
        saveCoins(coins);

        // 2. Award item if cosmetic
        if (listing.type === 'cosmetic' && listing.itemId) {
          const item = shopItemById(listing.itemId);
          if (item && SHOP_TYPE_CONFIG[item.costType]) {
            const cosm = loadJson(COSMETICS_FILE, {});
            const buyerNorm = normalizeEmail(listing.buyer);
            const owned = normalizeCosmetics(cosm[buyerNorm] || {});
            const bucket = SHOP_TYPE_CONFIG[item.costType].bucket;
            if (!owned[bucket].includes(listing.itemId)) {
              owned[bucket].push(listing.itemId);
            }
            cosm[buyerNorm] = owned;
            saveJson(COSMETICS_FILE, cosm);
          }
        }
      }
    }

    if (modified) {
      saveJson(MARKETPLACE_FILE, list);
    }
  } catch (e) {
    console.error('[marketplace] error in auto-finalize sweep:', e);
  }
}

function addCoinGiftNotice(targetEmail, amount, adminEmail, reason) {
  const norm = normalizeEmail(targetEmail);
  if (!norm) return null;
  const gifts = loadJson(COIN_GIFTS_FILE, {});
  if (!Array.isArray(gifts[norm])) gifts[norm] = [];
  const notice = {
    id: randomBytes(12).toString('hex'),
    amount: Number(amount),
    from: adminEmail || 'admin',
    reason: reason || 'admin gift',
    ts: Date.now(),
    read: false,
  };
  gifts[norm].unshift(notice);
  gifts[norm] = gifts[norm].slice(0, 50);
  saveJson(COIN_GIFTS_FILE, gifts);
  return notice;
}

function addAdminNotification(targetEmail, title, message, adminEmail, batchId = '', url = '') {
  const norm = normalizeEmail(targetEmail);
  if (!norm) return null;
  const gifts = loadJson(COIN_GIFTS_FILE, {});
  if (!Array.isArray(gifts[norm])) gifts[norm] = [];
  const notice = {
    id: randomBytes(12).toString('hex'),
    kind: 'admin_notice',
    title: title || 'Admin notification',
    message,
    from: adminEmail || 'admin',
    source: 'mitchdog.com',
    url: url || notificationUrl('/'),
    batchId,
    ts: Date.now(),
    read: false,
  };
  gifts[norm].unshift(notice);
  gifts[norm] = gifts[norm].slice(0, 50);
  saveJson(COIN_GIFTS_FILE, gifts);
  return notice;
}

function pushAdminNotification(targetEmail, title, message) {
  if (!VAPID_PUBLIC) return;
  const subs = loadJson(PUSH_SUBS_FILE, {});
  const norm = normalizeEmail(targetEmail);
  const sub = subs[targetEmail] || subs[norm];
  if (!sub) return;
  webpush.sendNotification(sub, JSON.stringify({
    title: title || 'Admin notification',
    body: String(message || '').slice(0, 120),
    url: notificationUrl('/'),
  })).catch(e => {
    if (e.statusCode === 410 || e.statusCode === 404) {
      delete subs[targetEmail];
      delete subs[norm];
      saveJson(PUSH_SUBS_FILE, subs);
    }
  });
}

function publicSessionId(id) {
  if (!id) return 'unknown';
  return createHash('sha256').update(String(id)).digest('hex').slice(0, 12);
}

function logAdminAction(actor, action, details = {}) {
  const logs = loadJson(ADMIN_ACTION_LOG_FILE, []);
  logs.unshift({
    id: randomBytes(8).toString('hex'),
    ts: Date.now(),
    actor: actor || 'admin',
    action,
    details,
  });
  saveJson(ADMIN_ACTION_LOG_FILE, logs.slice(0, 1000));
}

function buildAdvancedAdminData() {
  const sessions = loadJson(SESSION_LOG_FILE, [])
    .slice(-500)
    .reverse()
    .map(entry => ({
      session: publicSessionId(entry.id),
      ip: String(entry.ip || '').slice(0, 80),
      page: String(entry.page || '').slice(0, 220),
      timestamp: entry.timestamp || null,
    }));

  const adminActions = loadJson(ADMIN_ACTION_LOG_FILE, [])
    .slice(0, 250)
    .map(entry => ({
      id: entry.id || '',
      ts: entry.ts || 0,
      actor: entry.actor || 'admin',
      action: entry.action || 'admin_action',
      details: entry.details || {},
    }));

  const canvasReports = [];

  const chatReports = loadJson(CHAT_REPORTS_FILE, [])
    .slice(-150)
    .reverse()
    .map(report => ({
      type: 'chat',
      ts: report.ts || 0,
      reportedBy: report.reportedBy || report.reporter || '',
      reason: report.reason || 'Chat report',
      context: report.context || [],
      status: report.status || 'Needs review',
    }));

  const encryptedDmMetadata = loadJson(DMS_FILE, [])
    .slice(-300)
    .reverse()
    .map(msg => {
      const image = msg.image && typeof msg.image === 'object' ? msg.image : null;
      const imageData = image ? String(image.data || '') : '';
      return {
        channel: 'encrypted_dm',
        sender: msg.from || '',
        recipient: msg.to || '',
        ts: msg.ts || 0,
        read: !!msg.read,
        contentVisible: true,
        text: String(msg.text || '').slice(0, 2000),
        textLength: String(msg.text || '').length,
        hasImage: !!imageData,
        imageName: image ? String(image.name || 'image').slice(0, 120) : '',
        imageMime: image ? String(image.mime || '') : '',
        imageBytes: imageData ? Buffer.byteLength(imageData, 'utf8') : 0,
      };
    });

  const premiumChatMetadata = loadJson(PREMIUM_CHAT_FILE, [])
    .slice(-150)
    .reverse()
    .map(msg => ({
      channel: 'premium_chat',
      sender: msg.email || msg.name || '',
      recipient: 'premium_room',
      ts: msg.ts || 0,
      read: true,
      contentVisible: true,
      text: String(msg.text || '').slice(0, 2000),
      textLength: String(msg.text || '').length,
      hasImage: false,
      imageName: '',
      imageMime: '',
      imageBytes: 0,
    }));

  const gifts = loadJson(COIN_GIFTS_FILE, {});
  const sentNotifications = [];
  const seenNotices = new Set();
  for (const [targetEmail, notices] of Object.entries(gifts)) {
    if (!Array.isArray(notices)) continue;
    for (const notice of notices) {
      if (notice.kind !== 'admin_notice') continue;
      const key = notice.batchId || notice.id;
      if (seenNotices.has(key + ':' + targetEmail)) continue;
      seenNotices.add(key + ':' + targetEmail);
      sentNotifications.push({
        id: String(notice.id || ''),
        batchId: String(notice.batchId || ''),
        targetEmail,
        title: notice.title || 'Admin notification',
        from: notice.from || 'admin',
        source: notice.source || 'mitchdog.com',
        ts: notice.ts || 0,
        read: !!notice.read,
      });
    }
  }
  sentNotifications.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const now = Date.now();
  const recentPages = sessions.filter(s => {
    const t = Date.parse(s.timestamp || '');
    return t && now - t < 60 * 60 * 1000;
  }).length;
  const uniqueSessions = new Set(sessions.map(s => s.session)).size;
  const pageCounts = {};
  for (const s of sessions.slice(-1000)) {
    const page = String(s.page || 'unknown');
    pageCounts[page] = (pageCounts[page] || 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([page, count]) => ({ page, count }));
  const activeUsers = Object.entries(loadUserStats())
    .filter(([, info]) => info && info.last_active_at && now - info.last_active_at < 2 * 60 * 1000)
    .map(([email, info]) => ({ email, lastActiveAt: info.last_active_at }))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .slice(0, 50);
  const bannedAccounts = Object.entries(loadBlacklist())
    .map(([email, info]) => ({
      email,
      reason: info?.reason || 'Banned by admin',
      bannedAt: info?.banned_at || info?.blacklisted_at || 0,
      by: info?.by || info?.admin || 'admin',
    }))
    .sort((a, b) => (b.bannedAt || 0) - (a.bannedAt || 0));

  return {
    generatedAt: now,
    policy: {
      visitorAnalytics: 'Page, timestamp, raw IP address, and pseudonymous session IDs are shown for security monitoring, abuse prevention, and site health.',
      adminActions: 'Admin actions are logged so privileged changes can be reviewed later.',
      chatMetadata: 'Chat sender, recipient, time, read status, message text, and attachment metadata are shown for security monitoring.',
      consent: 'This monitoring should match the site terms and be limited to authorized admins with a security or moderation need.',
    },
    stats: {
      sessions: sessions.length,
      uniqueSessions,
      recentPages,
      adminActions: adminActions.length,
      reports: chatReports.length,
      chatMetadata: encryptedDmMetadata.length + premiumChatMetadata.length,
      sentNotifications: sentNotifications.length,
      bannedAccounts: bannedAccounts.length,
      activeUsers: activeUsers.length,
      cheatLogs: loadJson(CHEAT_LOGS_FILE, []).length,
    },
    topPages,
    activeUsers,
    bannedAccounts,
    sessions,
    adminActions,
    reports: chatReports
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 250),
    canvasReports: [],
    chatReports: chatReports.slice(0, 250),
    sentNotifications: sentNotifications.slice(0, 250),
    chatMetadata: encryptedDmMetadata.concat(premiumChatMetadata)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 350),
    heatmap: loadJson(HEATMAP_FILE, {}),
    cheatLogs: loadJson(CHEAT_LOGS_FILE, []).slice(0, 250),
  };
}

function loadAchievements() { return loadJson(ACHIEVEMENTS_FILE, {}); }
function saveAchievements(a) { saveJson(ACHIEVEMENTS_FILE, a); }
function getAchievements(email) { if (!email) return []; return loadAchievements()[normalizeEmail(email)] || []; }
function awardAchievement(email, achId, bonus = 0) {
  if (!email) return false;
  const norm = normalizeEmail(email);
  const achs = loadAchievements();
  if (!achs[norm]) achs[norm] = [];
  if (achs[norm].includes(achId)) return false;
  achs[norm].push(achId);
  saveAchievements(achs);
  if (bonus > 0) addCoins(norm, bonus);
  return true;
}

function loadUserStats() { return userStats; }
function saveUserStats(s) { userStats = s; saveJson(USER_STATS_FILE, s); }
function touchActiveEmail(email, now = Date.now()) {
  if (!email) return;
  const norm = normalizeEmail(email);
  const stats = loadUserStats();
  if (!stats[norm]) stats[norm] = {};
  if (now - (stats[norm].last_active_at || 0) < 10000) return;
  stats[norm].last_active_at = now;
  saveUserStats(stats);
}
function updateStat(email, key, inc = 1) {
  if (!email) return 0;
  const norm = normalizeEmail(email);
  const stats = loadUserStats();
  if (!stats[norm]) stats[norm] = {};
  stats[norm][key] = (stats[norm][key] || 0) + inc;
  saveUserStats(stats);
  const total = stats[norm][key];
  
  // Check for achievements
  for (const [id, def] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
    if (def.stat === key && total >= def.goal) {
      awardAchievement(norm, id, def.bonus);
    }
  }
  return total;
}

function addPaintingCoin(email) {
  if (!email) return;
  const norm = normalizeEmail(email);
  const now = new Date().toISOString().split('T')[0];
  const stats = loadUserStats();
  if (!stats[norm]) stats[norm] = {};
  if (stats[norm].last_paint_day !== now) {
    stats[norm].last_paint_day = now;
    stats[norm].day_paint_count = 0;
    saveUserStats(stats);
  }
  // Cap at 1000 pixels per day (200 coins)
  if ((stats[norm].day_paint_count || 0) < 1000) {
    const s = loadUserStats();
    s[norm].day_paint_count = (s[norm].day_paint_count || 0) + 1;
    saveUserStats(s);
    addCoins(email, 0.2);
  }
  updateStat(email, 'pixels', 1);
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

function rateLimited(rateKey, endpoint) {
  const [maxReq, window] = RATE_LIMITS[endpoint] || RATE_LIMITS['__default__'];
  let limit = rateKey === 'anon' ? Math.floor(maxReq / 5) : maxReq;
  const key  = `${rateKey}::${endpoint}`;
  const now  = Date.now() / 1000;
  let ts = (rlLog[key] || []).filter(t => now - t < window);
  if (ts.length >= limit) { rlLog[key] = ts; return true; }
  ts.push(now);
  rlLog[key] = ts;
  return false;
}

function newsletterCheckAndBan(ip) {
  const key = `newsletter_abuse::${ip}`;
  const now  = Date.now() / 1000;
  let ts = (rlLog[key] || []).filter(t => now - t < NEWSLETTER_BAN_WINDOW);
  ts.push(now);
  rlLog[key] = ts;
  if (ts.length >= NEWSLETTER_BAN_THRESH) {
    banned[ip] = now + NEWSLETTER_BAN_DURATION;
    delete rlLog[key];
    return true;
  }
  return false;
}

function isNewsletterBanned(ip) {
  const until = banned[ip];
  if (!until) return false;
  if (Date.now() / 1000 < until) return true;
  delete banned[ip];
  return false;
}

setInterval(() => {
  const cutoff = Date.now() / 1000 - 3600;
  for (const key of Object.keys(rlLog)) {
    rlLog[key] = rlLog[key].filter(t => t > cutoff);
    if (!rlLog[key].length) delete rlLog[key];
  }
}, 300_000);

// ── VPN checking ──────────────────────────────────────────────────────────────

function isPrivateIp(ip) {
  return ip === '127.0.0.1' || ip === '::1' ||
         ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('100.');
}

async function isVpnOrProxy(ip) {
  if (isPrivateIp(ip)) return false;
  if (knownCleanIps.has(ip)) return false;
  if (knownVpnIps.has(ip))   { console.log(`[ip-api] ${ip} blocked (cached)`); return true; }
  try {
    const url = `http://ip-api.com/json/${ip}?fields=status,proxy,hosting,query`;
    console.log(`[ip-api] checking ${ip}`);
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    const result = Boolean(data.proxy || data.hosting);
    console.log(`[ip-api] ${ip} mitch.prox-flag=${data.proxy} hosting=${data.hosting} -> blocked=${result}`);
    if (result) { knownVpnIps.add(ip);   saveJson(KNOWN_VPN_FILE,   [...knownVpnIps].sort()); }
    else        { knownCleanIps.add(ip); saveJson(KNOWN_CLEAN_FILE, [...knownCleanIps].sort()); }
    return result;
  } catch (e) { console.log(`[ip-api] error for ${ip}: ${e}`); return false; }
}

function checkVpnAsync(ip) {
  if (knownVpnIps.has(ip) || knownCleanIps.has(ip) || checkingIps.has(ip)) return;
  checkingIps.add(ip);
  isVpnOrProxy(ip).finally(() => checkingIps.delete(ip));
}

setInterval(() => {
  try { knownVpnIps   = new Set(JSON.parse(readFileSync(KNOWN_VPN_FILE, 'utf8'))); }   catch {}
  try { knownCleanIps = new Set(JSON.parse(readFileSync(KNOWN_CLEAN_FILE, 'utf8'))); } catch {}
}, 60_000);

// ── Email helpers ─────────────────────────────────────────────────────────────

function loadEmailWhitelist() {
  try { return new Set(JSON.parse(readFileSync(join(BASE, 'data', 'email_whitelist.json'), 'utf8')).map(e => e.toLowerCase())); }
  catch { return new Set(); }
}

function emailHasProfanity(email) {
  const el = email.toLowerCase();
  if (EMAIL_WHITELIST_BUILTIN.has(el) || loadEmailWhitelist().has(el)) return false;
  try {
    const bad   = JSON.parse(readFileSync(join(BASE, 'data', 'bad_words.json'), 'utf8'));
    const local = email.split('@')[0].toLowerCase();
    for (const w of bad) { if (local.includes(w.toLowerCase())) return w; }
  } catch {}
  return false;
}

function emailScript(to) {
  const domain = to.includes('@') ? to.split('@').pop().toLowerCase() : '';
  return domain === 'student.rjuhsd.us' ? SEND_SCRIPT : NOREPLY_SCRIPT;
}

function sendEmailBg(to, subject, body) {
  const matched = emailHasProfanity(to);
  if (matched) {
    ntfy(`Email to ${to} dropped — "${matched}" in name`, { title: 'Profanity drop', priority: 'high' });
    return;
  }
  const proc = spawn('/usr/bin/node', [emailScript(to), to, subject, body], { stdio: 'ignore' });
  proc.unref();
  proc.on('error', () => {});
}

// ── ntfy / recaptcha ──────────────────────────────────────────────────────────

async function ntfy(msg, { title, priority } = {}) {
  if (!NTFY_TOPIC) return;
  try {
    const headers = { 'Content-Type': 'text/plain' };
    if (title)                          headers['Title']    = title;
    if (priority && priority !== 'default') headers['Priority'] = priority;
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST', headers, body: msg, signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

async function verifyRecaptcha(token, ip) {
  if (ip && (WHITELISTED_IPS.has(ip) || ip === '127.0.0.1' || ip === '::1')) return true;

  const secretKey = (process.env.SECRET_KEY || '').trim();
  const recaptchaSecretKey = (process.env.RECAPTCHA_SECRET_KEY || '').trim();

  if (!secretKey && !recaptchaSecretKey) return true;
  if (!token) return false;

  const callVerify = async (secret, signal) => {
    if (!secret) return false;
    try {
      const verifyUrl = process.env.RECAPTCHA_VERIFY_URL || 'https://www.google.com/recaptcha/api/siteverify';
      const resp = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
        signal,
      });
      const data = await resp.json();
      if (data.success !== true) return false;
      if (typeof data.score === 'number' && data.score < 0.5) {
        console.log(`[recaptcha] Blocked low score token: ${data.score}`);
        return false;
      }
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw e;
      }
      return false;
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    if (recaptchaSecretKey) {
      const ok = await callVerify(recaptchaSecretKey, controller.signal);
      if (ok) return true;
    }

    if (secretKey) {
      const ok = await callVerify(secretKey, controller.signal);
      if (ok) return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') {
      console.log(`[recaptcha] Verification timed out after 5s`);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return false;
}

// ── AI ────────────────────────────────────────────────────────────────────────

function checkAiRate(uid, unlimited = false) {
  if (unlimited) return [true, null];
  const now = Date.now() / 1000;
  aiGlobalTimes = aiGlobalTimes.filter(t => now - t < AI_GLOB_WIN);
  if (aiGlobalTimes.length >= AI_GLOB_MAX) return [false, 'global'];
  const times = (aiUserTimes[uid] || []).filter(t => now - t < AI_USER_WIN);
  if (times.length >= AI_USER_MAX) return [false, 'user'];
  aiGlobalTimes.push(now);
  times.push(now);
  aiUserTimes[uid] = times;
  return [true, null];
}

async function callGemini(messages, system = '') {
  if (!GEMINI_KEY) return [null, null, true];
  for (const [model, degraded] of GEMINI_MODELS) {
    const url     = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const payload = { contents: messages };
    if (system) payload.system_instruction = { parts: [{ text: system }] };
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });
      if (resp.status === 429 || resp.status === 503) continue;
      if (resp.status === 400 || resp.status === 403) break;
      if (!resp.ok) continue;
      const data = await resp.json();
      const text = data.candidates[0].content.parts[0].text;
      return [text, model, degraded];
    } catch { continue; }
  }
  return [null, null, true];
}

function geminiToOai(messages, system = '') {
  const oai = [];
  if (system) oai.push({ role: 'system', content: system });
  for (const m of messages) {
    const role  = m.role === 'model' ? 'assistant' : 'user';
    const parts = m.parts || [];
    const text  = parts[0]?.text || m.content || '';
    oai.push({ role, content: text });
  }
  return oai;
}

async function callGroq(messages, system = '') {
  if (!GROQ_KEY) return [null, null, true];
  const oaiMsgs = geminiToOai(messages, system);
  for (const [model, degraded] of GROQ_MODELS) {
    const payload = { model, messages: oaiMsgs, max_tokens: 1024 };
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
          'User-Agent': 'python-requests/2.31.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });
      if (resp.status === 429 || resp.status === 503) continue;
      if (resp.status === 400 || resp.status === 401 || resp.status === 403) break;
      if (!resp.ok) continue;
      const data = await resp.json();
      return [data.choices[0].message.content, model, degraded];
    } catch { continue; }
  }
  return [null, null, true];
}

async function callAi(messages, system = '') {
  const [text, model, degraded] = await callGemini(messages, system);
  if (text !== null) return [text, model, degraded];
  return callGroq(messages, system);
}

const AI_TOOLS = [
  { type: 'function', function: {
    name: 'fetch_page',
    description: 'Fetch the readable text content of any mitch.pro page. Use this to look up current info, game lists, FAQ answers, etc.',
    parameters: { type: 'object', required: ['path'],
      properties: { path: { type: 'string',
        description: 'Site-relative path, e.g. "/faq.html", "/games/", "/use-agreement.html"' } } } } },
  { type: 'function', function: {
    name: 'submit_suggestion',
    description: 'Submit a suggestion or feedback on behalf of the user. Confirm with the user before submitting.',
    parameters: { type: 'object', required: ['text', 'type'],
      properties: {
        text: { type: 'string', description: 'The suggestion text (max 2000 chars)' },
        type: { type: 'string', enum: ['feedback', 'add_page', 'broken_game', 'general'],
          description: 'feedback=general feedback, add_page=request a new page/game, broken_game=report a broken game, general=anything else' } } } } }
];

function execAiTool(name, args, uid, email) {
  if (name === 'fetch_page') {
    let rawPath = (args.path || '').trim().replace(/^\//, '');
    if (rawPath.includes('..')) return 'Error: invalid path.';
    let full = join(WEBROOT, rawPath);
    try {
      if (statSync(full).isDirectory()) full = join(full, 'index.html');
    } catch { if (!rawPath.endsWith('.html')) full = full + '.html'; }
    try {
      let content = readFileSync(full, 'utf8');
      content = content.replace(/<script[^>]*>.*?<\/script>/gis, '');
      content = content.replace(/<style[^>]*>.*?<\/style>/gis, '');
      content = content.replace(/<[^>]+>/g, ' ');
      content = content.replace(/[ \t]+/g, ' ');
      content = content.replace(/\n{3,}/g, '\n\n').trim();
      return content.slice(0, 5000);
    } catch (e) { return `Error reading page: ${e}`; }
  }
  if (name === 'submit_suggestion') {
    const text    = String(args.text || '').trim().slice(0, 2000);
    let sugType   = args.type || 'general';
    if (!['feedback', 'add_page', 'broken_game', 'general'].includes(sugType)) sugType = 'general';
    if (!text) return 'Error: empty suggestion.';
    const entry   = { id: uid, name: email || uid.slice(0, 8), type: sugType,
                      text: `[via AI assistant] ${text}`, ts: Date.now() / 1000 };
    const sugs    = loadJson(SUGGESTIONS_FILE, []);
    sugs.push(entry);
    saveJson(SUGGESTIONS_FILE, sugs);
    if (email) addCoins(email, 20);
    const labels  = { feedback: 'Feedback', add_page: 'Page Suggestion',
                      broken_game: 'Broken Game Report', general: 'Suggestion' };
    ntfy(`${email || 'user'}: ${text.slice(0, 100)}`, { title: `[AI] ${labels[sugType] || 'Suggestion'}` });
    return 'Suggestion submitted successfully.';
  }
  return `Unknown tool: ${name}`;
}

async function callAiAgentic(geminiMessages, system, uid, email) {
  if (!GROQ_KEY) return callAi(geminiMessages, system);
  const oaiMsgs    = geminiToOai(geminiMessages, system);
  let usedModel    = null;
  let anyDegraded  = false;
  for (let _turn = 0; _turn < 4; _turn++) {
    let resultMsg = null;
    for (const [model, mdeg] of GROQ_MODELS) {
      const payload = { model, messages: oaiMsgs, max_tokens: 1024,
                        tools: AI_TOOLS, tool_choice: 'auto' };
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': `Bearer ${GROQ_KEY}`,
                     'User-Agent': 'python-requests/2.31.0' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000),
        });
        if (resp.status === 429 || resp.status === 503) continue;
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) break;
        const data = await resp.json();
        resultMsg  = data.choices[0].message;
        usedModel  = model;
        anyDegraded = anyDegraded || mdeg;
        break;
      } catch { continue; }
    }
    if (!resultMsg) return callAi(geminiMessages, system);
    const toolCalls = resultMsg.tool_calls;
    if (!toolCalls) {
      let content = resultMsg.content || '';
      content = content.replace(/<function\b[^>]*>.*?<\/function>/gis, '').trim();
      return [content, usedModel, anyDegraded];
    }
    oaiMsgs.push({ role: 'assistant', content: resultMsg.content, tool_calls: toolCalls });
    for (const tc of toolCalls) {
      let targs = {};
      try { targs = JSON.parse(tc.function.arguments); } catch {}
      const toolResult = execAiTool(tc.function.name, targs, uid, email);
      oaiMsgs.push({ role: 'tool', content: String(toolResult), tool_call_id: tc.id });
    }
  }
  return [null, null, true];
}

// ── Chess engine ──────────────────────────────────────────────────────────────

const SF_PATH = '/usr/games/stockfish';
let sfEngine = null;
let sfBusy   = false;
const sfQueue = [];
let CHESS_ENGINE_OK = false;

class StockfishUCI {
  constructor() { this.proc = null; this.resolvers = []; this.buf = ''; }

  async init() {
    this.proc = spawn(SF_PATH, [], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.proc.stdout.on('data', chunk => {
      this.buf += chunk.toString();
      const lines = this.buf.split('\n');
      this.buf = lines.pop();
      for (const line of lines) this._dispatch(line.trim());
    });
    this.proc.on('error', () => {});
    await this._cmd('uci', 'uciok');
    await this._cmd('isready', 'readyok');
  }

  _dispatch(line) {
    if (!this.resolvers.length) return;
    const { test, lines, resolve } = this.resolvers[0];
    lines.push(line);
    if (test(line)) { this.resolvers.shift(); resolve(lines); }
  }

  _cmd(cmd, waitFor) {
    return new Promise(resolve => {
      this.resolvers.push({ test: l => l.startsWith(waitFor), lines: [], resolve });
      this.proc.stdin.write(cmd + '\n');
    });
  }

  send(cmd) { this.proc.stdin.write(cmd + '\n'); }

  waitFor(token) {
    return new Promise(resolve => {
      this.resolvers.push({ test: l => l.startsWith(token), lines: [], resolve });
    });
  }

  async pickMove(fen, elo) {
    if (elo >= 1320) {
      this.send(`setoption name UCI_LimitStrength value true`);
      this.send(`setoption name UCI_Elo value ${Math.min(3190, Math.floor(elo))}`);
      this.send(`setoption name MultiPV value 1`);
      this.send(`position fen ${fen}`);
      const p = this.waitFor('bestmove');
      this.send('go movetime 1500');
      const lines = await p;
      const bl = lines.find(l => l.startsWith('bestmove'));
      return bl ? bl.split(' ')[1] : null;
    } else {
      this.send('setoption name UCI_LimitStrength value false');
      this.send('setoption name Skill Level value 0');
      this.send('setoption name MultiPV value 5');
      this.send(`position fen ${fen}`);
      const p = this.waitFor('bestmove');
      this.send('go movetime 200');
      const lines = await p;
      // take last (deepest) result per multipv slot
      const pvMap = new Map();
      for (const line of lines) {
        if (!line.startsWith('info')) continue;
        const mpvM   = line.match(/\bmultipv (\d+)\b/);
        const scoreM = line.match(/\bscore cp (-?\d+)\b/);
        const pvM    = line.match(/\bpv (\S+)/);
        if (mpvM && scoreM && pvM)
          pvMap.set(parseInt(mpvM[1]), { cp: parseInt(scoreM[1]), move: pvM[1] });
      }
      const cands = [...pvMap.values()];
      if (!cands.length) {
        const bl = lines.find(l => l.startsWith('bestmove'));
        return bl ? bl.split(' ')[1] : null;
      }
      cands.sort((a, b) => b.cp - a.cp);
      const threshold = Math.max(100, (1400 - elo) * 0.55);
      const scale     = Math.max(0, (1300 - elo) / 600);
      const ws        = cands.map((_, i) => Math.exp(i * scale));
      const total     = ws.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let picked = cands.length - 1;
      for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) { picked = i; break; } }
      if (cands[0].cp - cands[picked].cp > threshold) picked = 0;
      return cands[picked].move;
    }
  }
}

async function getSfMove(fen, elo) {
  if (sfBusy) await new Promise(resolve => sfQueue.push(resolve));
  sfBusy = true;
  try { return await sfEngine.pickMove(fen, elo); }
  finally { sfBusy = false; if (sfQueue.length) sfQueue.shift()(); }
}

function chessRateOk(uid) {
  const now = Date.now() / 1000;
  const ts  = (chessRl[uid] || []).filter(t => now - t < CHESS_RATE_WINDOW);
  if (ts.length >= CHESS_RATE_MAX) return false;
  ts.push(now); chessRl[uid] = ts; return true;
}

(async () => {
  try { sfEngine = new StockfishUCI(); await sfEngine.init(); CHESS_ENGINE_OK = true; }
  catch { CHESS_ENGINE_OK = false; }
})();

// ── E2E crypto ────────────────────────────────────────────────────────────────

async function genServerKeypair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  );
  const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
  return { priv: kp.privateKey, pubHex: Buffer.from(raw).toString('hex') };
}

function deriveUserE2EKeys(email) {
  const seed = createHmac('sha256', ID_SECRET).update(email.toLowerCase().trim()).digest();
  return deriveE2EKeysFromSeed(seed);
}

function deriveE2EKeysFromSeed(seed) {
  const key = createECDH('prime256v1');
  key.setPrivateKey(seed);
  const pubKey = key.getPublicKey();
  
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: pubKey.slice(1, 33).toString('base64url'),
    y: pubKey.slice(33, 65).toString('base64url'),
    d: seed.toString('base64url')
  };
  
  return {
    jwk,
    pubKeyHex: pubKey.toString('hex')
  };
}

async function computeShared(privKey, peerPubHex) {
  const peerKey = await crypto.subtle.importKey(
    'raw', Buffer.from(peerPubHex, 'hex'),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, privKey, 256);
  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptServer(aesKey, ivHex, cipherHex, tagHex) {
  const combined = Buffer.concat([Buffer.from(cipherHex, 'hex'), Buffer.from(tagHex, 'hex')]);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(ivHex, 'hex'), tagLength: 128 }, aesKey, combined
  );
  return new TextDecoder().decode(plain);
}

function e2eKey(a, b) { return [a, b].sort().join(':'); }

setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const n of Object.keys(e2eUsers)) {
    if (e2eUsers[n].last_seen < cutoff) delete e2eUsers[n];
  }
}, 60_000);

// ── Daily traffic summary worker ───────────────────────────────────────────────
let lastDailySummarySentDate = ''; // e.g. '2026-05-27'

async function sendDailySummaryNotification() {
  try {
    const logs = loadJson(SESSION_LOG_FILE, []);
    const names = loadJson(NAMES_FILE, {});

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const registeredSet = new Set();
    let guestCount = 0;

    for (const entry of logs) {
      if (!entry.timestamp) continue;
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime >= startOfDay) {
        const id = entry.id || '';
        let email = emailFromSid(id);
        if (!email && names[id]) email = names[id];

        if (email) {
          registeredSet.add(email);
        } else {
          guestCount++;
        }
      }
    }

    const registeredCount = registeredSet.size;
    const totalUsersToday = registeredCount + guestCount;

    let summaryMessage = `Daily Site Summary\n`;
    summaryMessage += `------------------\n`;
    summaryMessage += `Total Unique Visitors: ${totalUsersToday}\n`;
    summaryMessage += `- Members: ${registeredCount}\n`;
    summaryMessage += `- Guests: ${guestCount}\n\n`;

    if (registeredCount > 0) {
      summaryMessage += `Members active today:\n`;
      summaryMessage += [...registeredSet].map(e => `• ${e}`).join('\n');
    } else {
      summaryMessage += `No members visited today.`;
    }

    await ntfy(summaryMessage, { title: 'Daily Traffic Summary', priority: 'default' });
    console.log(`[scheduler] Daily summary sent at ${now.toLocaleTimeString()}`);
  } catch (err) {
    console.error('[scheduler] Error sending daily summary:', err);
  }
}

function scheduleDailySummary() {
  setInterval(() => {
    try {
      const now = new Date();
      // Check if it is 4:00 PM (16:00) local time
      if (now.getHours() === 16 && now.getMinutes() === 0) {
        const dateStr = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        if (lastDailySummarySentDate !== dateStr) {
          lastDailySummarySentDate = dateStr;
          sendDailySummaryNotification();
        }
      }
    } catch (err) {
      console.error('[scheduler] Error in daily summary scheduler:', err);
    }
  }, 30000); // Check every 30 seconds
}

// ── Backup worker ─────────────────────────────────────────────────────────────
const BACKUP_DIR = join(BASE, 'backups');
async function backupWorker() {
  try {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
    const now = new Date();
    const folderName = now.toISOString().replace(/[:.]/g, '-');
    const folder = join(BACKUP_DIR, folderName);
    mkdirSync(folder, { recursive: true });

    const filesToBackup = [
      TOKENS_FILE, APPLICATIONS_FILE, PROFILES_FILE, NAMES_FILE,
      BLACKLIST_FILE, GENERATIONS_FILE, CANVAS_PIXELS_FILE, CHESS_VS_FILE, DMS_FILE,
      COINS_FILE, ACHIEVEMENTS_FILE, USER_STATS_FILE, CANVAS_LOCKS_FILE, FRIENDS_FILE,
      PREMIUM_CHAT_FILE, ADMIN_ACTION_LOG_FILE, CHAT_REPORTS_FILE, SESSION_LOG_FILE,
      MASTER_SESSION_LOG
    ];

    for (const file of filesToBackup) {
      if (existsSync(file)) {
        const dest = join(folder, basename(file));
        try {
          const content = readFileSync(file);
          writeFileSync(dest, content);
        } catch (e) {
          console.error(`[backup] failed to copy ${file}: ${e.message}`);
        }
      }
    }
    // Backup webserver content (Task Fix: include files even if symlinked)
    try {
      const webDest = join(folder, 'webserver');
      spawnSync('rsync', ['-avL', '--exclude=games/many', '--exclude=games/eag*', '--exclude=games/eag', WEBROOT + '/', webDest + '/']);
    } catch (e) { console.error(`[backup] webserver failed: ${e.message}`); }

    console.log(`[backup] created backup in ${folderName}`);    
    // Clean up old backups (keep last 14)
    const folders = readdirSync(BACKUP_DIR).map(f => join(BACKUP_DIR, f)).filter(f => statSync(f).isDirectory());
    folders.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    const toDelete = folders.slice(14);
    for (const f of toDelete) {
      rmSync(f, { recursive: true, force: true });
      console.log(`[backup] deleted old backup ${basename(f)}`);
    }
  } catch (e) { console.error(`[backup] worker error: ${e.message}`); }
}

async function premiumMaintenanceWorker() {
  try {
    const apps = loadJson(APPLICATIONS_FILE, []);
    const stats = loadUserStats();
    const now = Date.now();
    const WARN_MS = 5 * 86400 * 1000;
    const EXPIRY_MS = 7 * 86400 * 1000;
    let changed = false;

    for (const app of apps) {
      if (app.status !== 'approved' || !(app.type === 'premium' || app.grantPremium)) continue;
      if (app.neverExpire) continue;
      
      const email = app.email;
      const norm = normalizeEmail(email);
      const lastActive = stats[norm]?.last_active_at || app.approved_at || app.submitted_at || 0;
      const inactiveFor = now - lastActive;

      if (inactiveFor >= EXPIRY_MS) {
        console.log(`[premium] expiring ${email} due to inactivity (7d)`);
        app.status = 'expired';
        app.why_expired = 'Inactive for 7+ days';
        changed = true;
      } else if (inactiveFor >= WARN_MS) {
        const lastWarn = stats[norm]?.last_premium_warn || 0;
        if (now - lastWarn > 86400 * 1000) { // Warn at most once per 24h
           console.log(`[premium] warning ${email} about inactivity (5d)`);
           const subject = "Urgent: Your mitch.pro Premium is about to expire";
           const body = `Hi,\n\nOur records show you haven't logged in to mitch.pro for 5 days.\n\nIf you do not log on in the next 2 days, your Premium status will be automatically revoked.\n\nSimply visit mitch.pro and log in to keep your perks!`;
           spawn('/usr/bin/node', [join(BASE, 'mail', 'support_send.js'), email, subject, body]);
           if (!stats[norm]) stats[norm] = {};
           stats[norm].last_premium_warn = now;
           saveUserStats(stats);
        }
      }
    }
    if (changed) saveApplications(apps);
  } catch (e) { console.error(`[premium-worker] error: ${e.message}`); }
}

let isNudgeRunning = false;
async function nudgeWorker() {
  if (isNudgeRunning) return;
  isNudgeRunning = true;
  try {
    const logs   = loadJson(SESSION_LOG_FILE, []);
    const names  = loadJson(NAMES_FILE, {});
    const tokens = loadJson(TOKENS_FILE, {});

    const latestUid = {};
    for (const entry of logs) {
      const uid   = String(entry.id || '');
      const tsStr = entry.timestamp || '';
      if (!uid || !tsStr) continue;
      try {
        const ts = Date.parse(tsStr) / 1000;
        if (!latestUid[uid] || ts > latestUid[uid]) latestUid[uid] = ts;
      } catch {}
    }

    const latestByEmail = {};
    for (const [uid, ts] of Object.entries(latestUid)) {
      const label = names[uid] || '';
      if (label.includes('@')) {
        const lower = label.toLowerCase();
        if (!latestByEmail[lower] || ts > latestByEmail[lower]) latestByEmail[lower] = ts;
      }
    }

    const threshold = Date.now() / 1000 - NUDGE_DAYS * 86400;
    const nudged    = loadNudge();
    const toSend    = [];

    for (const d of Object.values(tokens)) {
      if (!d.claimed_domains && !d.used) continue;
      const email = (d.email || '').trim();
      if (!email) continue;
      const lower = email.toLowerCase();
      if (nudged[lower]) continue;
      const claimedTs = d.claimed_domains
        ? Math.min(...Object.values(d.claimed_domains))
        : (d.used_at || d.created_at || 0);
      if (Date.now() / 1000 - claimedTs < NUDGE_DAYS * 86400) continue;
      const last = latestByEmail[lower];
      if (last === undefined || last < threshold) toSend.push(email);
    }

    for (const email of toSend) {
      try {
        const r = spawnSync('node', [emailScript(email), email, NUDGE_SUBJECT, NUDGE_BODY],
                            { timeout: 30_000, encoding: 'utf8' });
        if (r.status === 0) {
          nudged[email.toLowerCase()] = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
          console.log(`[nudge] sent to ${email}`);
        } else {
          console.log(`[nudge] failed ${email}: ${(r.stderr || r.stdout || '').slice(0, 80)}`);
        }
      } catch (e) { console.log(`[nudge] error ${email}: ${e}`); }
    }

    if (toSend.length) saveNudge(nudged);
  } catch (e) { console.log(`[nudge] worker error: ${e}`); }
  finally {
    isNudgeRunning = false;
  }
}

// ── IMAP watcher ──────────────────────────────────────────────────────────────
if (SUPPORT_USER && SUPPORT_PASS) {
  (function startImapWatcher() {
    const watcher = spawn('/usr/bin/node', [join(BASE, 'mail', 'imap_watcher.js')], {
      detached: false,
    });
    watcher.on('exit', (code) => {
      console.log(`[imap-watcher] exited (${code}), restarting in 10s…`);
      setTimeout(startImapWatcher, 10_000);
    });
    console.log(`[imap-watcher] started (pid ${watcher.pid})`);
  })();
} else {
  console.log(`[imap-watcher] Silenced (SUPPORT_USER or SUPPORT_PASS not set in environment/dotenv)`);
}
const GMAIL_CACHE_FILE  = join(BASE, 'mail', 'check_email', 'emails.json');
const GMAIL_PAUSE_FILE  = join(BASE, 'mail', 'check_email', 'gmail_paused');
const GMAIL_SENT_FILE   = join(BASE, 'mail', 'check_email', 'gmail_sent.json');

const CANVAS_BANNED_FILE  = join(BASE, 'data', 'canvas_banned.json');
const CANVAS_REPORTS_FILE = join(BASE, 'data', 'canvas_reports.json');
const CANVAS_BOOKMARKS_FILE = join(BASE, 'data', 'canvas_bookmarks.json');
const CANVAS_ZONES_FILE = join(BASE, 'data', 'zones.json');
const canvasModTimes = {};  // painter -> last moderation timestamp
const canvasHeatmap = new Map(); // "x,y" -> ts

// In-memory canvas cache for performance
let canvasPixels = loadJson(CANVAS_PIXELS_FILE, {});
let canvasChunks = new Map(); // "cx,cy" -> { "wx,wy": pixelData }
let canvasBanned = loadJson(CANVAS_BANNED_FILE, {});
let canvasLocks  = loadJson(CANVAS_LOCKS_FILE, {});
let applications = loadJson(APPLICATIONS_FILE, []);
let tokensCache  = loadJson(TOKENS_FILE, {});
let userStats    = loadJson(USER_STATS_FILE, {});
let coinsCache   = loadJson(COINS_FILE, {});
let dailyLogins  = loadJson(DAILY_LOGINS_FILE, {});
function saveDailyLogins() {
  saveJson(DAILY_LOGINS_FILE, dailyLogins);
}

function getDailyReward(streak) {
  if (streak === 60) {
    return { coins: 5000, grantPremium: true };
  }
  if (streak > 60) {
    return { coins: 1000 + (streak - 60) * 100, grantPremium: false };
  }
  if (streak >= 31) {
    return { coins: 400 + (streak - 1) * 50, grantPremium: false };
  }
  if (streak >= 15) {
    return { coins: 200 + (streak - 1) * 30, grantPremium: false };
  }
  if (streak >= 8) {
    return { coins: 100 + (streak - 1) * 20, grantPremium: false };
  }
  return { coins: 50 + (streak - 1) * 15, grantPremium: false };
}

function grantPremiumStatus(targetEmail, reason, approvedBy = 'system') {
  const apps = applications;
  const targetRaw = targetEmail.toLowerCase().trim();
  const norm = normalizeEmail(targetRaw);
  if (isPremiumEmail(norm)) return;
  apps.unshift({
    name: targetRaw.split('@')[0],
    email: targetRaw,
    type: 'premium',
    status: 'approved',
    grantPremium: true,
    why: reason,
    submitted_at: Date.now(),
    approved_at: Date.now(),
    approved_by: approvedBy,
  });
  saveApplications(apps);
  try {
    const noticeTitle = 'Premium granted';
    const noticeMessage = `${approvedBy} granted you Premium. Reason: ${reason}`;
    addAdminNotification(targetRaw, noticeTitle, noticeMessage, approvedBy);
    pushAdminNotification(targetRaw, noticeTitle, noticeMessage);
  } catch (e) {
    console.error(`[grantPremiumStatus] Error sending notification: ${e.message}`);
  }
}

const zonePixelsMap = new Map();
const zoneChunksMap = new Map();

function getZonePixels(zoneId) {
  if (zonePixelsMap.has(zoneId)) {
    return zonePixelsMap.get(zoneId);
  }
  const file = join(BASE, 'data', `zone_pixels_${zoneId}.json`);
  const pixels = loadJson(file, {});
  zonePixelsMap.set(zoneId, pixels);
  
  const chunks = new Map();
  zoneChunksMap.set(zoneId, chunks);
  for (const [key, val] of Object.entries(pixels)) {
    const ci = key.indexOf(',');
    if (ci === -1) continue;
    const x = +key.slice(0, ci);
    const y = +key.slice(ci + 1);
    const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
    const ck = `${cx},${cy}`;
    if (!chunks.has(ck)) chunks.set(ck, {});
    chunks.get(ck)[key] = val;
  }
  return pixels;
}

function saveZonePixels(zoneId) {
  const pixels = zonePixelsMap.get(zoneId);
  if (!pixels) return;
  const file = join(BASE, 'data', `zone_pixels_${zoneId}.json`);
  saveJson(file, pixels);
}

function getZoneHistoryFile(zoneId) {
  return join(BASE, 'data', `zone_history_${zoneId}.jsonl`);
}

function checkZoneAccess(zoneId, email, sid) {
  const adminOk = isAnyAdminId(sid);
  if (adminOk) return true;
  
  const zones = loadJson(CANVAS_ZONES_FILE, {});
  const zone = zones[zoneId];
  if (!zone) return false;
  
  const normEmail = normalizeEmail(email || '');
  const normOwner = normalizeEmail(zone.owner || '');
  if (normEmail === normOwner) return true;
  
  if (zone.friendsOnly) {
    const friends = loadJson(join(BASE, 'data', 'friends.json'), {});
    const ownerFriends = friends[normOwner] || [];
    const userFriends = friends[normEmail] || [];
    const isFriendOfOwner = ownerFriends.includes(normEmail) || userFriends.includes(normOwner);
    if (isFriendOfOwner) return true;
  }
  
  const allowed = (zone.allowedUsers || []).map(e => normalizeEmail(e));
  if (allowed.includes(normEmail)) return true;
  
  return false;
}

function rebuildCanvasChunks() {
  canvasChunks.clear();
  const CHUNK = 64;
  for (const [key, d] of Object.entries(canvasPixels)) {
    const ci = key.indexOf(',');
    if (ci === -1) continue;
    const wx = +key.slice(0, ci), wy = +key.slice(ci + 1);
    const cx = Math.floor(wx / CHUNK), cy = Math.floor(wy / CHUNK);
    const ck = `${cx},${cy}`;
    if (!canvasChunks.has(ck)) canvasChunks.set(ck, {});
    canvasChunks.get(ck)[key] = d;
  }
}
rebuildCanvasChunks();

function setCanvasPixel(x, y, data, zoneId = null) {
  if (zoneId) {
    const pixels = getZonePixels(zoneId);
    const key = `${x},${y}`;
    pixels[key] = data;
    const chunks = zoneChunksMap.get(zoneId);
    const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
    const ck = `${cx},${cy}`;
    if (!chunks.has(ck)) chunks.set(ck, {});
    chunks.get(ck)[key] = data;
    
    try {
      const logEntry = JSON.stringify({
        x,
        y,
        color: data.color,
        ts: data.ts || Date.now(),
        painter: data.painter || '',
        email: data.email || ''
      }) + '\n';
      appendFileSync(getZoneHistoryFile(zoneId), logEntry, 'utf8');
    } catch (err) {
      console.error(`Failed to log zone ${zoneId} history:`, err);
    }
    return;
  }
  const key = `${x},${y}`;
  canvasPixels[key] = data;
  const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
  const ck = `${cx},${cy}`;
  if (!canvasChunks.has(ck)) canvasChunks.set(ck, {});
  canvasChunks.get(ck)[key] = data;

  try {
    const logEntry = JSON.stringify({
      x,
      y,
      color: data.color,
      ts: data.ts || Date.now(),
      painter: data.painter || '',
      email: data.email || ''
    }) + '\n';
    appendFileSync(CANVAS_HISTORY_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to log canvas history:', err);
  }
}

function deleteCanvasPixel(x, y, painter = '', email = '', zoneId = null) {
  if (zoneId) {
    const pixels = getZonePixels(zoneId);
    const key = `${x},${y}`;
    delete pixels[key];
    const chunks = zoneChunksMap.get(zoneId);
    const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
    const ck = `${cx},${cy}`;
    if (chunks.has(ck)) delete chunks.get(ck)[key];
    
    try {
      const logEntry = JSON.stringify({
        x,
        y,
        color: '',
        ts: Date.now(),
        painter,
        email
      }) + '\n';
      appendFileSync(getZoneHistoryFile(zoneId), logEntry, 'utf8');
    } catch (err) {
      console.error(`Failed to log zone ${zoneId} delete history:`, err);
    }
    return;
  }
  const key = `${x},${y}`;
  delete canvasPixels[key];
  const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
  const ck = `${cx},${cy}`;
  if (canvasChunks.has(ck)) delete canvasChunks.get(ck)[key];

  try {
    const logEntry = JSON.stringify({
      x,
      y,
      color: '',
      ts: Date.now(),
      painter,
      email
    }) + '\n';
    appendFileSync(CANVAS_HISTORY_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to log canvas erase history:', err);
  }
}

function saveCanvasPixels() { saveJson(CANVAS_PIXELS_FILE, canvasPixels); }
setInterval(saveCanvasPixels, 30000); // Save every 30s

function saveCanvasBans(data) {
  canvasBanned = data || {};
  saveJson(CANVAS_BANNED_FILE, canvasBanned);
}

function pixelColorValue(pixel) {
  if (!pixel) return '';
  if (typeof pixel === 'string') return pixel;
  return String(pixel.color || '');
}

function colorRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function isDarkCanvasColor(hex) {
  const c = colorRgb(hex);
  if (!c) return false;
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 < 90;
}

function isRedCanvasColor(hex) {
  const c = colorRgb(hex);
  if (!c) return false;
  return c.r > 140 && c.g < 95 && c.b < 95;
}

function normalizeCanvasGrid(pixelGrid) {
  const cells = [];
  if (Array.isArray(pixelGrid)) {
    for (const p of pixelGrid) {
      if (!p || typeof p !== 'object') continue;
      const x = Number(p.x), y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      cells.push({ x, y, color: pixelColorValue(p), painter: p.painter || '', email: maskEmail(p.email || '') });

    }
    return cells.slice(0, 5000);
  }
  if (pixelGrid && typeof pixelGrid === 'object') {
    for (const [key, val] of Object.entries(pixelGrid)) {
      const [xs, ys] = key.split(',');
      const x = Number(xs), y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      cells.push({ x, y, color: pixelColorValue(val), painter: val?.painter || '', email: maskEmail(val?.email || '') });

      if (cells.length >= 5000) break;
    }
  }
  return cells;
}

function canvasBounds(cells) {
  if (!cells.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of cells) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function connectedComponents(cells, predicate) {
  const points = new Map();
  for (const p of cells) if (!predicate || predicate(p)) points.set(`${p.x},${p.y}`, p);
  const seen = new Set();
  const comps = [];
  for (const [key, start] of points) {
    if (seen.has(key)) continue;
    const stack = [start], comp = [];
    seen.add(key);
    while (stack.length) {
      const p = stack.pop();
      comp.push(p);
      for (const [nx, ny] of [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]]) {
        const nk = `${nx},${ny}`;
        if (seen.has(nk) || !points.has(nk)) continue;
        seen.add(nk);
        stack.push(points.get(nk));
      }
    }
    comps.push(comp);
  }
  return comps;
}

function swastikaTemplates() {
  const base = [
    [1,1,1,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,1,1,1],
    [0,0,0,1,0,0,1],
    [0,0,0,1,0,0,1],
    [0,0,0,1,1,1,1],
  ];
  const rotate = grid => grid[0].map((_, i) => grid.map(row => row[i]).reverse());
  const flip = grid => grid.map(row => row.slice().reverse());
  const out = [];
  let g = base;
  for (let i = 0; i < 4; i++) {
    out.push(g);
    out.push(flip(g));
    g = rotate(g);
  }
  return out;
}

function detectSwastika(cells) {
  const dark = cells.filter(p => isDarkCanvasColor(p.color));
  if (dark.length < 12) return null;
  const components = connectedComponents(dark)
    .filter(comp => comp.length >= 12)
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
  if (!components.length) return null;
  let best = { score: 0, hits: 0, expected: 0, x: 0, y: 0 };
  const templates = swastikaTemplates();
  for (const comp of components) {
    const bounds = canvasBounds(comp);
    if (!bounds || bounds.width > 48 || bounds.height > 48) continue;
    const set = new Set(comp.map(p => `${p.x},${p.y}`));
    const maxSize = Math.min(17, Math.max(7, Math.max(bounds.width, bounds.height) + 4));
    for (let size = 7; size <= maxSize; size += 2) {
      const step = size / 7;
      const startX = Math.max(bounds.minX - size, bounds.minX - 10);
      const endX = Math.min(bounds.maxX + 1, bounds.maxX + 4);
      const startY = Math.max(bounds.minY - size, bounds.minY - 10);
      const endY = Math.min(bounds.maxY + 1, bounds.maxY + 4);
      for (let ox = startX; ox <= endX; ox++) {
        for (let oy = startY; oy <= endY; oy++) {
          for (const t of templates) {
            let hits = 0, expected = 0;
            for (let ty = 0; ty < 7; ty++) for (let tx = 0; tx < 7; tx++) {
              if (!t[ty][tx]) continue;
              expected++;
              const cx = Math.round(ox + tx * step);
              const cy = Math.round(oy + ty * step);
              let found = false;
              for (let dx = -1; dx <= 1 && !found; dx++) {
                for (let dy = -1; dy <= 1 && !found; dy++) {
                  if (set.has(`${cx + dx},${cy + dy}`)) found = true;
                }
              }
              if (found) hits++;
            }
            const score = expected ? hits / expected : 0;
            if (score > best.score) best = { score, hits, expected, x: ox, y: oy, size, bounds };
          }
        }
      }
    }
  }
  if (best.score >= 0.72 && best.hits >= 13) {
    return { kind: 'possible_hate_symbol', label: 'Possible swastika / hate symbol', score: best.score, evidence: best };
  }
  return null;
}

function detectCanvasIssues(cells, painter) {
  const reasons = [];
  const bounds = canvasBounds(cells);
  const targetCells = painter ? cells.filter(p => !p.painter || p.painter === painter || p.email === painter) : cells;
  const darkComps = connectedComponents(targetCells, p => isDarkCanvasColor(p.color));
  const redComps = connectedComponents(targetCells, p => isRedCanvasColor(p.color));
  const sw = detectSwastika(targetCells.length ? targetCells : cells);
  if (sw) reasons.push(sw);
  for (const comp of darkComps) {
    if (comp.length < 20) continue;
    const b = canvasBounds(comp);
    const density = comp.length / Math.max(1, b.width * b.height);
    if ((b.width >= 18 && b.height <= 5 && density > 0.55) || (b.height >= 18 && b.width <= 5 && density > 0.55)) {
      reasons.push({ kind: 'possible_text_or_symbol', label: 'Long solid dark stroke that may be text/symbol content', score: Math.min(0.95, density + 0.2), evidence: b });
      break;
    }
  }
  for (const comp of redComps) {
    if (comp.length >= 18) {
      const b = canvasBounds(comp);
      reasons.push({ kind: 'possible_graphic_red_content', label: 'Large red cluster that may need review', score: Math.min(0.9, comp.length / 60), evidence: b });
      break;
    }
  }
  return {
    flagged: reasons.length > 0,
    reasons,
    bounds,
    sample: targetCells.slice(-120).map(p => ({ x: p.x, y: p.y, color: p.color, painter: p.painter || '', email: p.email || '' })),
  };
}

function addCanvasReport(report) {
  const reports = loadJson(CANVAS_REPORTS_FILE, []);
  const now = Date.now();
  const bounds = report.bounds || null;
  const sameArea = r => {
    if (!bounds || !r.bounds) return false;
    const acx = Math.round((Number(bounds.minX) + Number(bounds.maxX)) / 2);
    const acy = Math.round((Number(bounds.minY) + Number(bounds.maxY)) / 2);
    const bcx = Math.round((Number(r.bounds.minX) + Number(r.bounds.maxX)) / 2);
    const bcy = Math.round((Number(r.bounds.minY) + Number(r.bounds.maxY)) / 2);
    return Math.abs(acx - bcx) <= 12 && Math.abs(acy - bcy) <= 12;
  };
  const dupe = reports.slice(-80).reverse().find(r =>
    r.status === 'Needs review' &&
    String(r.painter || '') === String(report.painter || '') &&
    String(r.reason || '') === String(report.reason || '') &&
    now - Number(r.ts || 0) < 10 * 60 * 1000 &&
    sameArea(r)
  );
  if (dupe) {
    dupe.ts = now;
    dupe.score = Math.max(Number(dupe.score || 0), Number(report.score || 0));
    dupe.reasons = Array.isArray(report.reasons) && report.reasons.length ? report.reasons : dupe.reasons;
    dupe.sample = Array.isArray(report.sample) && report.sample.length ? report.sample.slice(0, 160) : dupe.sample;
    saveJson(CANVAS_REPORTS_FILE, reports);
    return dupe;
  }
  const entry = {
    id: report.id || randomBytes(10).toString('hex'),
    type: 'canvas',
    ts: report.ts || now,
    status: report.status || 'Needs review',
    source: report.source || 'detector',
    painter: String(report.painter || ''),
    email: String(report.email || ''),
    reason: report.reason || 'Canvas moderation report',
    severity: report.severity || 'medium',
    score: Number(report.score || 0),
    reasons: Array.isArray(report.reasons) ? report.reasons : [],
    bounds: report.bounds || null,
    sample: Array.isArray(report.sample) ? report.sample.slice(0, 160) : [],
  };
  reports.push(entry);
  saveJson(CANVAS_REPORTS_FILE, reports.slice(-1000));
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of canvasHeatmap.entries()) {
    if (now - ts > 86400000) canvasHeatmap.delete(key);
  }
}, 3600000);

(function startGmailWatchers() {
  const checkDir = join(BASE, 'mail', 'check_email');
  function spawnPy(script, label) {
    const p = spawn('/usr/bin/python3', [join(checkDir, script)], { stdio: 'ignore', detached: false, cwd: checkDir });
    p.on('exit', (code) => {
      console.log(`[${label}] exited (${code}), restarting in 15s…`);
      setTimeout(() => spawnPy(script, label), 15_000);
    });
    console.log(`[${label}] started (pid ${p.pid})`);
  }
  //spawnPy('gmail_loop.py', 'gmail-loop');
  //spawnPy('watch_gmail_api.py', 'gmail-watch');
})();

// ── Auto-email workers ────────────────────────────────────────────────────────

const EMAIL_LOG_FILE = join(BASE, 'data', 'email_log.json');
function loadEmailLog() { return loadJson(EMAIL_LOG_FILE, {}); }
function saveEmailLog(d) { saveJson(EMAIL_LOG_FILE, d); }

function enrolledUsers() {
  const tokens = loadTokens();
  const unsub  = (() => { try { return new Set(JSON.parse(readFileSync(NEWSLETTER_UNSUB_FILE, 'utf8')).map(e => e.toLowerCase())); } catch { return new Set(); } })();
  const seen = new Set();
  const users = [];
  for (const [tok, data] of Object.entries(tokens)) {
    const email = (data.email || '').toLowerCase().trim();
    if (!email || seen.has(email) || unsub.has(email)) continue;
    if (!data.claimed_domains && !data.used) continue;
    seen.add(email);
    users.push({ email, tok });
  }
  return users;
}

function userdataForEmail(email) {
  const names = loadJson(NAMES_FILE, {});
  const lower = email.toLowerCase();
  for (const [uid, name] of Object.entries(names)) {
    if ((name || '').toLowerCase() === lower) {
      try {
        const fpath = userdataPath(uid);
        if (!fpath || !existsSync(fpath)) return {};
        return JSON.parse(readFileSync(fpath, 'utf8'));
      } catch { return {}; }
    }
  }
  return {};
}

// stable per-user slot 0..slots-1 based on email hash, to spread sends across intervals
function emailSlot(email, slots) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (Math.imul(h, 31) + email.charCodeAt(i)) >>> 0;
  return h % slots;
}

// weekly digest — fires once per Monday, spread across 6 ten-minute slots
async function weeklyDigestWorker() {
  try {
    const now  = new Date();
    if (now.getDay() !== 1) return;
    const currentSlot = Math.floor(now.getMinutes() / 10);
    const weekKey = `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2,'0')}`;
    const log  = loadEmailLog();
    const logs = loadJson(SESSION_LOG_FILE, []);
    const names = loadJson(NAMES_FILE, {});
    const weekAgo = Date.now() - 7 * 86400_000;

    const gamesByEmail = {};
    for (const entry of logs) {
      const ts = Date.parse(entry.timestamp || '');
      if (!ts || ts < weekAgo) continue;
      let pg = entry.page || '';
      for (const dom of ['https://mitch.pro', 'https://mitch.dnswish.com']) {
        if (pg.startsWith(dom)) pg = pg.slice(dom.length);
      }
      if (!pg.includes('/games/')) continue;
      const uid   = String(entry.id || '');
      const email = (names[uid] || '').toLowerCase();
      if (!email) continue;
      if (!gamesByEmail[email]) gamesByEmail[email] = {};
      try { pg = new URL(pg, 'http://x').pathname; } catch {}
      gamesByEmail[email][pg] = (gamesByEmail[email][pg] || 0) + 1;
    }

    for (const { email } of enrolledUsers()) {
      if (emailSlot(email, 6) !== currentSlot) continue;
      const ulog = log[email] || {};
      if (ulog.weekly_digest === weekKey) continue;
      const ud = userdataForEmail(email);
      const eloData = ud.chess_elo || null;
      const ccRaw   = ud.CookieClickerGame || ud['cookie-clicker'] || null;
      const cookies = ccRaw ? (ccRaw.cookies || ccRaw.cookieCount || 0) : 0;
      const visits  = gamesByEmail[email] || {};
      const totalVisits = Object.values(visits).reduce((a, b) => a + b, 0);
      if (!totalVisits && !eloData && !cookies) continue;

      const topGame = Object.entries(visits).sort((a, b) => b[1] - a[1])[0];
      let body = `Here's your mitch.pro week in review:\n\n`;
      if (totalVisits) {
        body += `🎮 Games: ${totalVisits} session${totalVisits !== 1 ? 's' : ''} this week`;
        if (topGame) body += ` (most played: ${topGame[0].split('/').filter(Boolean).pop()})`;
        body += '\n';
      }
      if (eloData && eloData.elo) body += `♟ Chess ELO: ${eloData.elo} (${eloData.wins || 0}W / ${eloData.losses || 0}L)\n`;
      if (cookies > 0) body += `🍪 Cookies: ${Math.floor(cookies).toLocaleString()}\n`;
      body += `\nSee you next week — ${siteUrl(email)}`;

      sendEmailBg(email, 'Your mitch.pro week in review', body);
      log[email] = { ...ulog, weekly_digest: weekKey };
      console.log(`[weekly] sent to ${email}`);
    }
    saveEmailLog(log);
  } catch (e) { console.log(`[weekly] error: ${e}`); }
}

// daily puzzle — fires between 7-9am, spread across 12 ten-minute slots
async function dailyPuzzleWorker() {
  try {
    if (!puzzles.length) return;
    const now = new Date();
    const h = now.getHours();
    if (h < 7 || h >= 9) return;
    const minuteInWindow = now.getMinutes() + (h - 7) * 60;
    const currentSlot = Math.floor(minuteInWindow / 10);
    const dayKey = now.toISOString().slice(0, 10);
    const log = loadEmailLog();
    let changed = false;
    const pool = puzzles.filter(p => p[2] >= 800 && p[2] <= 1400);
    if (!pool.length) return;
    for (const { email } of enrolledUsers()) {
      if (emailSlot(email, 12) !== currentSlot) continue;
      const ulog = log[email] || {};
      if (ulog.puzzle === dayKey) continue;
      const p = pool[Math.floor(Math.random() * pool.length)];
      const turn   = p[0].split(' ')[1] === 'w' ? 'White' : 'Black';
      const themes = (p[3] || []).slice(0, 3).join(', ');
      const body = `Here's today's chess puzzle (rating ~${p[2]}):\n\n${turn} to move and find the best continuation.\nFEN: ${p[0]}\nThemes: ${themes}\n\nSolve it at ${siteUrl(email)}/games/chess-bot/ (Puzzles tab)`;
      sendEmailBg(email, "Today's chess puzzle — mitch.pro", body);
      log[email] = { ...ulog, puzzle: dayKey };
      changed = true;
      console.log(`[puzzle] sent to ${email}`);
    }
    if (changed) saveEmailLog(log);
  } catch (e) { console.log(`[puzzle] error: ${e}`); }
}

// clock warning — email when <12h or <2h left in correspondence game
const CLOCK_WARN_HOURS = [12, 2];
async function clockWarnWorker() {
  try {
    const log = loadEmailLog();
    let changed = false;
    const now = Date.now();
    for (const [gameId, g] of Object.entries(cvGames)) {
      if (g.status !== 'active' || g.type !== 'corr' || !g.clockStartedAt) continue;
      const turnEmail = g.turn === 'w' ? g.white : g.black;
      if (!turnEmail) continue;
      const remaining = g.clocks[g.turn] - (now - g.clockStartedAt);
      const ulog = log[turnEmail] || {};
      const warned = new Set(ulog.clock_warn?.[gameId] || []);
      let newWarn = false;
      for (const h of CLOCK_WARN_HOURS) {
        if (remaining < h * 3600_000 && remaining > 0 && !warned.has(h)) {
          const opp = g.turn === 'w' ? g.black : g.white;
          const oppName = (opp || '').split('@')[0];
          sendEmailBg(turnEmail, `⏰ ${h}h left to move — mitch.pro chess`,
            `You have less than ${h} hour${h !== 1 ? 's' : ''} to make your move against ${oppName}.\n\nView the game: ${siteUrl(turnEmail)}/games/chess-bot/`);
          warned.add(h); newWarn = true;
          console.log(`[clock-warn] ${h}h → ${turnEmail} game ${gameId}`);
        }
      }
      if (newWarn) {
        const cw = { ...(ulog.clock_warn || {}) };
        cw[gameId] = [...warned];
        log[turnEmail] = { ...ulog, clock_warn: cw };
        changed = true;
      }
    }
    if (changed) saveEmailLog(log);
  } catch (e) { console.log(`[clock-warn] error: ${e}`); }
}

// DM digest — only fires when new unread messages have arrived since last digest
async function dmDigestWorker() {
  try {
    const dms    = loadJson(DMS_FILE, []);
    const log    = loadEmailLog();
    const now    = Date.now();
    const offlineCutoff = now - 3600_000;
    const msgAge        = now - 3600_000;
    let changed  = false;

    const unreadByRecip = {};
    for (const m of dms) {
      if (m.read || m.ts > msgAge) continue;
      if (!unreadByRecip[m.to]) unreadByRecip[m.to] = { senders: {}, latestTs: 0 };
      unreadByRecip[m.to].senders[m.from] = (unreadByRecip[m.to].senders[m.from] || 0) + 1;
      if (m.ts > unreadByRecip[m.to].latestTs) unreadByRecip[m.to].latestTs = m.ts;
    }

    for (const [recip, { senders, latestTs }] of Object.entries(unreadByRecip)) {
      const isOnline = (recip in e2eUsers) && (e2eUsers[recip].last_seen > offlineCutoff);
      if (isOnline) continue;
      const ulog = log[recip] || {};
      // skip if no new messages since last digest
      if (ulog.dm_digest_ts && latestTs <= ulog.dm_digest_ts) continue;
      const total = Object.values(senders).reduce((a, b) => a + b, 0);
      const names = Object.keys(senders).map(e => e.split('@')[0]).join(', ');
      sendEmailBg(recip, `💬 ${total} unread message${total !== 1 ? 's' : ''} on mitch.pro`,
        `You have ${total} unread message${total !== 1 ? 's' : ''} from ${names}.\n\nRead them at ${siteUrl(recip)}/encrypt.html`);
      log[recip] = { ...ulog, dm_digest_ts: latestTs };
      changed = true;
      console.log(`[dm-digest] ${total} msgs from ${Object.keys(senders).length} senders → ${recip}`);
    }
    if (changed) saveEmailLog(log);
  } catch (e) { console.log(`[dm-digest] error: ${e}`); }
}

setInterval(weeklyDigestWorker, 600_000);
setInterval(dailyPuzzleWorker, 600_000);
setInterval(clockWarnWorker, 600_000);
setInterval(dmDigestWorker, 1_800_000);

// ── Puzzle helpers ────────────────────────────────────────────────────────────

function bisectLeft(arr, val) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < val) lo = mid + 1; else hi = mid; }
  return lo;
}
function bisectRight(arr, val) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= val) lo = mid + 1; else hi = mid; }
  return lo;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const VPN_BLOCKED_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>VPN Detected<\/title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0a0a12;color:#e0e0f0;
  display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
  border-radius:16px;padding:2.5rem 2rem;width:100%;max-width:400px;text-align:center}
.icon{font-size:3rem;margin-bottom:1rem}
h1{font-size:1.4rem;font-weight:700;margin-bottom:.6rem;color:#fff}
p{color:rgba(200,200,220,.6);font-size:.9rem;line-height:1.6}
.btn{display:inline-block;margin-top:1.5rem;background:#7c3aed;color:#fff;
  border:none;border-radius:8px;padding:10px 24px;font-size:.9rem;
  cursor:pointer;text-decoration:none}
.btn:hover{background:#6d28d9}
<\/style><\/head>
<body><div class="card">
<div class="icon">\u{1F6E1}️<\/div>
<h1>VPN Detected</h1>
<p>Please disable your VPN or mitch.prox-style access tool and try again.<br>This site is not accessible over VPN.<\/p>
<a class="btn" href="javascript:location.reload()">Try Again<\/a>
<\/div><\/body><\/html>`;

function errorPage(code, title, detailHtml) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${code} — ${title}<\/title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0e0e14;color:#bababa;font-family:system-ui,sans-serif;padding:2rem;}
.box{text-align:center;max-width:420px;}
.code{font-size:5rem;font-weight:800;line-height:1;color:#2a2a38;margin-bottom:.5rem;}
h1{font-size:1.3rem;font-weight:700;color:#e8e6e3;margin:0 0 .75rem;}
p{font-size:.9rem;line-height:1.6;color:#888;margin:0 0 1.5rem;}
p a{color:#7c6aed;text-decoration:none;}p a:hover{text-decoration:underline;}
code{background:#1a1a24;padding:2px 6px;border-radius:4px;font-size:.85em;color:#a0a0c0;}
<\/style><\/head><body>
<div class="box"><div class="code">${code}<\/div>
<h1>${title}</h1><p>${detailHtml}<\/p><\/div>
<\/body><\/html>`;
}

function htmlEsc(v) {
  return String(v == null ? '' : v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bannedResponse(info) {
  const reasonText = String(info?.reason || 'This account is banned from the website.');
  const reason = htmlEsc(reasonText);
  const by = htmlEsc(info?.by || info?.admin || 'site admin');
  const alertText = JSON.stringify('This account is banned from the website. Reason: ' + reasonText).replaceAll('<', '\\u003c');
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Account Banned<\/title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111318;color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;}
.modal{width:min(440px,100%);background:#1b1f2a;border:1px solid rgba(248,113,113,.35);border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.45);padding:24px;text-align:center;}
.badge{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;background:rgba(239,68,68,.14);color:#fecaca;font-weight:900;margin-bottom:14px;}
h1{font-size:1.35rem;margin:0 0 10px;}
p{color:#cbd5e1;line-height:1.5;margin:0 0 12px;font-size:.94rem;}
.reason{background:#111827;border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:12px;margin:14px 0;color:#e5e7eb;text-align:left;}
.small{font-size:.78rem;color:#94a3b8;}
button{margin-top:8px;border:0;border-radius:9px;background:#ef4444;color:white;padding:10px 16px;font-weight:700;cursor:pointer;}
<\/style><\/head><body>
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ban-title">
  <div class="badge">!</div>
  <h1 id="ban-title">This account is banned from the website</h1>
  <p>Your account cannot access mitch.pro right now.</p>
  <div class="reason"><strong>Reason:</strong><br>${reason}</div>
  <p class="small">Issued by ${by}. Contact site staff if you think this was a mistake.</p>
  <button onclick="location.href='/appeal.html'">Appeal ban</button>
</div>
<script>alert(${alertText});<\/script>
<\/body><\/html>`, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function errResp(code, message, explain) {
  const titles = {
    400:'Bad Request', 401:'Not Authorised', 403:'Forbidden', 404:'Page Not Found',
    405:'Method Not Allowed', 429:'Too Many Requests', 500:'Server Error',
    502:'Bad Gateway', 503:'Service Unavailable',
  };
  const details = {
    400: 'The request could not be understood.',
    401: 'You need to be logged in to view this page. <a href="/enroll.html">Request access<\/a>.',
    403: "You don't have permission to access this. <a href=\"/\">Go home<\/a>.",
    404: "This page doesn't exist. <a href=\"/\">Go home<\/a>.",
    405: "That request method isn't allowed here.",
    429: "You're sending too many requests. Slow down and try again.",
    500: 'Something went wrong on our end. <a href="mailto:support@mitch.pro">Contact support<\/a> if it keeps happening.',
    502: 'Upstream error. Try again in a moment.',
    503: 'The service is temporarily unavailable. Try again shortly.',
  };
  const title  = titles[code]  || message || 'Error';
  const detail = details[code] || explain || message || 'An unexpected error occurred.';
  return new Response(errorPage(code, title, detail),
    { status: code, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function jsonResp(code, obj) {
  return new Response(JSON.stringify(obj),
    { status: code, headers: { 'Content-Type': 'application/json' } });
}

function getCookies(req) {
  const cookies = {};
  for (const part of (req.headers.get('Cookie') || '').split(';')) {
    const t = part.trim();
    if (t.includes('=')) {
      const eq = t.indexOf('=');
      cookies[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }

  // X-Admin-Key bypass: if X-Admin-Key header is present and valid, inject a mock admin studentId
  try {
    const adminKeyHeader = req.headers.get('X-Admin-Key');
    if (adminKeyHeader) {
      const adminKey = readFileSync(ADMIN_KEY_FILE, 'utf8').trim();
      if (adminKeyHeader === adminKey) {
        const mockAdminSid = makeEmailId('admin@mitch.pro', 0);
        cookies['studentId'] = mockAdminSid;
        cookies['id'] = mockAdminSid;
        
        const namesPath = join(DATA_DIR, 'names.json');
        const names = loadJson(namesPath, {});
        if (!names[mockAdminSid]) {
          names[mockAdminSid] = 'admin@mitch.pro';
          saveJson(namesPath, names);
        }
      }
    }
  } catch (e) {
    console.error('[auth] X-Admin-Key bypass failed:', e);
  }

  return cookies;
}

function authSidFromCookies(cookies) {
  return cookies['studentId'] || cookies['id'] || '';
}

function getRealIp(req) {
  return (req.headers.get('CF-Connecting-IP') ||
          req.headers.get('X-Real-IP') ||
          (req.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
          '127.0.0.1');
}

function getIdKey(req) {
  const cookies = getCookies(req);
  const val = cookies['studentId'] || cookies['id'] || '';
  if (validId(val)) return 'id:' + val;
  return 'anon';
}

function checkPasswordCookie(req, providedSid = null) {
  const cookies = getCookies(req);
  const adminSid = cookies['adminId'] || '';
  if (adminSid && validId(adminSid) && isAdminId(adminSid)) return true;

  const sid = providedSid || cookies['studentId'] || cookies['id'] || '';
  if (!sid) return false;
  
  if (!validId(sid)) return false;
  if (bannedInfoForSid(sid)) return false;
  
  const email = emailFromSid(sid);
  if (!email) return false;
  
  const passwords = loadPasswords();
  const norm = normalizeEmail(email);
  if (!passwords[norm]) {
    console.log(`[auth-debug] checkPasswordCookie failed for ${email}: no password hash in passwords.json (normalized: ${norm})`);
    return false;
  }
  
  return true;
}

const requestTimings = {}; // key -> { lastTime, intervals: [] }

function detectNonHumanTiming(key) {
  const now = Date.now();
  if (!requestTimings[key]) {
    requestTimings[key] = { lastTime: now, intervals: [] };
    return false;
  }
  const timing = requestTimings[key];
  const diff = now - timing.lastTime;
  timing.lastTime = now;

  // Ignore requests that are far apart (e.g. > 10 seconds)
  if (diff > 10000) {
    timing.intervals = [];
    return false;
  }

  timing.intervals.push(diff);
  if (timing.intervals.length > 5) {
    timing.intervals.shift();
  }

  // We need at least 4 intervals (5 requests) to detect timing regularity
  if (timing.intervals.length >= 4) {
    const min = Math.min(...timing.intervals);
    const max = Math.max(...timing.intervals);
    const spread = max - min;
    // If the spread between the fastest and slowest interval is under 50 milliseconds,
    // it's highly regular timing (less than 50ms jitter). A human cannot do this!
    if (spread < 50) {
      return true;
    }
  }
  return false;
}

function checkRateLimit(req, endpoint) {
  if (req._rateLimitChecked) return null;
  req._rateLimitChecked = true;
  const ip = getRealIp(req);
  if (WHITELISTED_IPS.has(ip)) return null;
  const ep = endpoint || new URL(req.url).pathname;

  // Anti-bot timing regularity check on non-polling action endpoints
  if (!ep.endsWith('/state') && !ep.includes('/inbox') && !ep.includes('/heartbeat') && !ep.includes('/groups') && !ep.includes('/canvas/')) {
    const timingKey = ip + ':' + ep;
    if (detectNonHumanTiming(timingKey)) {
      console.warn(`[Anti-Bot] Non-human timing detected from ${ip} on ${ep}`);
      return jsonResp(429, { error: 'Non-human request patterns detected' });
    }
  }

  if (rateLimited('ip:' + ip, ep) || rateLimited(getIdKey(req), ep))
    return jsonResp(429, { error: 'Too many requests, slow down' });
  return null;
}

function filterSites(raw, isAdmin, realAdmin = false, isPremium = false) {
  return raw.split('\n').map(ln => {
    if (ln.startsWith('admin iframe simulate/')) return realAdmin ? ln.slice('admin '.length) : null;
    if (ln.startsWith('admin ')) return isAdmin ? ln.slice('admin '.length) : null;
    if (!isPremium && (ln.startsWith('url /ultra/') || ln.startsWith('url /trad/'))) return null;
    return ln;
  }).filter(l => l !== null).join('\n');
}

function emailFromSid(sid) {
  if (!sid) return null;
  try {
    const names = getCachedNames();
    if (names[sid]) {
      const email = names[sid];
      const norm = normalizeEmail(email);
      const gens = loadGenerations();
      const currentGenRec = gens[norm] || {};
      const currentGen = (currentGenRec && typeof currentGenRec === 'object') ? (currentGenRec.gen || 0) : (currentGenRec || 0);
      if (sid === makeEmailId(norm, currentGen) || sid === makeEmailId(email, currentGen)) return email;
      return null;
    }
    const tokens = loadTokens();
    if (tokens[sid]) return tokens[sid].email;
    for (const t of Object.values(tokens)) {
      if (!t.infinite) continue;
      const norm = t.norm_email || normalizeEmail(t.email || '');
      const gen = t.claim_count || 0;
      if (sid === makeEmailId(norm, gen)) return t.email || norm;
    }
  } catch {}
  return null;
}

function getUidForEmail(email) {
  if (!email) return null;
  const norm = normalizeEmail(email);
  const gens = loadGenerations();
  const currentGenRec = gens[norm] || {};
  const currentGen = (currentGenRec && typeof currentGenRec === 'object') ? (currentGenRec.gen || 0) : (currentGenRec || 0);
  return makeEmailId(norm, currentGen);
}

function resolveTargetEmail(input) {
  if (!input) return null;
  const target = input.trim().toLowerCase();
  if (!target) return null;

  const passwords = loadPasswords();
  const emails = Object.keys(passwords).map(e => e.toLowerCase().trim());

  // 1. Direct match or normalized match
  if (passwords[target]) return target;
  const normTarget = normalizeEmail(target);
  if (passwords[normTarget]) return normTarget;

  // 2. Try match by maskEmail or getUidForEmail
  for (const email of emails) {
    if (normalizeEmail(email) === normTarget) return email;
    if (maskEmail(email).toLowerCase() === target) return email;
    if (getUidForEmail(email) === input.trim()) return email;
  }

  // 3. Try match by displayName in profiles.json (exact case-insensitive match)
  const profiles = loadJson(PROFILES_FILE, {});
  for (const [normEmail, profile] of Object.entries(profiles)) {
    if (profile.displayName && profile.displayName.toLowerCase().trim() === target) {
      if (passwords[normEmail]) return normEmail;
    }
  }

  // 4. Try match by local part of the email (e.g. "mitch" matching "mitch@mitch.pro")
  for (const email of emails) {
    const local = email.split('@')[0];
    if (local === target) return email;
  }

  // 5. Try match by display name substring (e.g. "mitch" matching "Mitch Fogler")
  for (const [normEmail, profile] of Object.entries(profiles)) {
    if (profile.displayName && profile.displayName.toLowerCase().includes(target)) {
      if (passwords[normEmail]) return normEmail;
    }
  }

  return null;
}

function hasEmailPrivacyEnabled(email) {
  try {
    const uid = getUidForEmail(email);
    if (!uid) return false;
    const fpath = userdataPath(uid);
    if (!fpath || !existsSync(fpath)) return false;
    const data = JSON.parse(readFileSync(fpath, 'utf8'));
    const snap = data._snapshot;
    if (snap && snap._prefPrivacy) {
      const pref = typeof snap._prefPrivacy === 'string' ? JSON.parse(snap._prefPrivacy) : snap._prefPrivacy;
      return !!pref.hideEmail;
    }
  } catch (e) {
    console.error('[privacy] failed to check email privacy:', e);
  }
  return false;
}

function emailFromHash(hash) {
  if (!hash) return null;
  if (hash.includes('@')) return hash;
  
  const names = loadJson(NAMES_FILE, {});
  if (names[hash]) return names[hash];

  const profiles = loadJson(PROFILES_FILE, {});
  for (const email of Object.keys(profiles)) {
    if (getUidForEmail(email) === hash) {
      return email;
    }
  }

  const stats = loadUserStats();
  for (const email of Object.keys(stats)) {
    if (getUidForEmail(email) === hash) {
      return email;
    }
  }

  const tokens = loadTokens();
  for (const t of Object.values(tokens)) {
    if (t.email) {
      if (getUidForEmail(t.email) === hash) {
        return t.email;
      }
    }
  }

  return null;
}

function processMemberFields(memberEmail, profile, viewerEmail) {
  if (!memberEmail) {
    return { displayName: null, email: '' };
  }
  const normTarget = normalizeEmail(memberEmail);
  const normViewer = viewerEmail ? normalizeEmail(viewerEmail) : '';
  const viewerCanSee = normViewer === normTarget || isAdminEmail(viewerEmail) || isModeratorEmail(viewerEmail);
  const privacyEnabled = hasEmailPrivacyEnabled(memberEmail);
  
  if (privacyEnabled && !viewerCanSee) {
    return {
      displayName: (profile && profile.displayName) || 'mitch.pro user',
      email: getUidForEmail(memberEmail)
    };
  } else {
    return {
      displayName: (profile && profile.displayName) || null,
      email: maskEmail(memberEmail)
    };
  }
}

function pruneDms(dms) {
  const counts = new Map();
  const keep = [];
  const now = Date.now();
  for (let i = dms.length - 1; i >= 0; i--) {
    const msg = dms[i];
    if (!msg) continue;
    if (msg.expiresAt && now > msg.expiresAt) continue; // Purge expired messages
    let convoId;
    if (msg.kind === 'group') {
      convoId = 'g::' + (msg.groupId || '');
    } else {
      const u1 = normalizeEmail(msg.from || '');
      const u2 = normalizeEmail(msg.to || '');
      convoId = 'd::' + [u1, u2].sort().join('::');
    }
    const count = counts.get(convoId) || 0;
    if (count < 100) {
      keep.unshift(msg);
      counts.set(convoId, count + 1);
    }
  }
  return keep;
}

function isPremiumEmail(email) {
  if (!email) return false;
  if (isAdminEmail(email) || isModeratorEmail(email)) return true;
  try {
    const norm = normalizeEmail(email);
    return applications.some(a =>
      normalizeEmail(a.email || '') === norm &&
      a.status === 'approved' &&
      (a.type === 'premium' || a.grantPremium === true)
    );
  } catch { return false; }
}

function moderatorEmails() {
  return loadJson(MODERATORS_FILE, []);
}

function isModeratorEmail(email) {
  if (!email) return false;
  const norm = normalizeEmail(email);
  return moderatorEmails().some(modEmail => normalizeEmail(modEmail) === norm);
}

function isModeratorId(sid) {
  if (!sid) return false;
  const email = emailFromSid(sid);
  return email ? isModeratorEmail(email) : false;
}

function isAnyAdminId(sid) {
  return isAdminId(sid) || isModeratorId(sid);
}

function isAdminId(sid) {
  if (!sid) return false;
  try {
    const names = loadJson(NAMES_FILE, {});
    const adminNorms = new Set(siteAdminEmails().map(email => normalizeEmail(email)));
    if (names[sid] && adminNorms.has(normalizeEmail(names[sid]))) {
      const email = names[sid];
      const norm = normalizeEmail(email);
      const gens = loadGenerations();
      const currentGenRec = gens[norm] || {};
      const currentGen = (currentGenRec && typeof currentGenRec === 'object') ? (currentGenRec.gen || 0) : (currentGenRec || 0);
      if (sid === makeEmailId(norm, currentGen) || sid === makeEmailId(email, currentGen)) return true;
      return false;
    }
    const tokens   = loadTokens();
    for (const t of Object.values(tokens)) {
      if (!t.infinite) continue;
      const norm = t.norm_email || normalizeEmail(t.email || '');
      if (!adminNorms.has(norm)) continue;
      const gen = t.claim_count || 0;
      if (sid === makeEmailId(norm, gen)) return true;
    }
  } catch {}
  return false;
}

function loadAdminConfig() {
  return loadJson(ADMINS_FILE, { owners: ['admin@mitch.pro'], admins: [] });
}

function adminMemberEmails() {
  return loadAdminConfig().admins || [];
}

function ownerMemberEmails() {
  return loadAdminConfig().owners || ['admin@mitch.pro'];
}

function siteAdminEmails() {
  return [...ownerMemberEmails(), ...adminMemberEmails()];
}

function isAdminEmail(email) {
  if (!email) return false;
  const norm = normalizeEmail(email);
  return siteAdminEmails().some(adminEmail => normalizeEmail(adminEmail) === norm);
}

function publicActiveColor(email, color) {
  const active = String(color || '');
  if (active === 'rainbow_name' && !isAdminEmail(email)) return null;
  return active || null;
}

function sanitizeCosmeticsForEmail(email, entry = {}) {
  const userCosm = normalizeCosmetics(entry);
  if (!isAdminEmail(email)) {
    userCosm.colors = userCosm.colors.filter(id => id !== 'rainbow_name');
    if (userCosm.activeColor === 'rainbow_name') userCosm.activeColor = '';
  }
  return userCosm;
}

function moderatorPanelConfig() {
  const raw = loadJson(MODERATOR_PANEL_FILE, { links: [] });
  const links = Array.isArray(raw.links) ? raw.links : [];
  return { links: sanitizeModeratorPanelLinks(links) };
}

function sanitizeModeratorPanelLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.map(link => ({
    label: String(link?.label || '').trim().slice(0, 60),
    href: String(link?.href || '').trim().slice(0, 180),
  })).filter(link =>
    link.label &&
    link.href.startsWith('/') &&
    !link.href.startsWith('//') &&
    !link.href.includes('\\')
  ).slice(0, 20);
}

const MODERATOR_ACTION_LABELS = {
  grant_premium: 'Grant premium',
  revoke_premium: 'Revoke premium',
  send_notification: 'Send notification',
  unsend_notification: 'Unsend notification',
  gift_coins: 'Give coins',
  burn_coins: 'Burn coins',
  economy_multiplier: 'Update coin multiplier',
  broadcast: 'Global broadcast',
  shadow_ban: 'Toggle shadow-ban',
  ban_account: 'Ban account',
  unban_account: 'Unban account',
  casino_rig: 'Set casino rig chance',
  casino_toggle: 'Toggle casino',
  prox_block: 'Block mitch.prox domain',
  content_mirror: 'Update mirror link',
  content_featured: 'Set featured game',
  moderator_role: 'Update moderator role',
  moderator_panel: 'Update moderator panel',
};

const MODERATOR_ACTION_BY_URL = {
  '/api/admin/grant-premium': 'grant_premium',
  '/api/admin/revoke-premium': 'revoke_premium',
  '/api/admin/send-notification': 'send_notification',
  '/api/admin/unsend-notification': 'unsend_notification',
  '/api/admin/gift-coins': 'gift_coins',
  '/api/admin/economy/burn': 'burn_coins',
  '/api/admin/economy/multiplier': 'economy_multiplier',
  '/api/admin/broadcast': 'broadcast',
  '/api/admin/shadow-ban': 'shadow_ban',
  '/api/admin/restricted-mode': 'shadow_ban',
  '/api/admin/ban-account': 'ban_account',
  '/api/admin/unban-account': 'unban_account',
  '/api/admin/casino/rig': 'casino_rig',
  '/api/admin/casino/toggle': 'casino_toggle',
  '/api/admin/prox/block': 'prox_block',
  '/api/admin/content/mirror': 'content_mirror',
  '/api/admin/content/featured': 'content_featured',
  '/api/admin/moderators': 'moderator_role',
  '/api/admin/moderator-panel': 'moderator_panel',
};

function adminActionError(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function canonicalEmail(raw, label = 'email') {
  const email = String(raw || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    adminActionError(400, 'valid ' + label + ' required');
  }
  return email;
}

function cleanModeratorActionPayload(action, payload = {}) {
  if (!MODERATOR_ACTION_LABELS[action]) adminActionError(400, 'unknown moderator action');
  const p = payload && typeof payload === 'object' ? payload : {};
  switch (action) {
    case 'grant_premium':
      return { targetEmail: canonicalEmail(p.targetEmail, 'target email'), reason: String(p.reason || '').trim().slice(0, 200) };
    case 'revoke_premium':
      return { email: canonicalEmail(p.email || p.targetEmail, 'email'), reason: String(p.reason || '').trim().slice(0, 200) };
    case 'send_notification':
      return {
        allUsers: p.allUsers === true,
        targetEmail: p.allUsers === true ? '' : canonicalEmail(p.targetEmail, 'target email'),
        title: String(p.title || 'Admin notification').trim().slice(0, 80),
        message: String(p.message || '').trim().slice(0, 1000),
      };
    case 'unsend_notification':
      return { id: String(p.id || '').trim().slice(0, 80), batchId: String(p.batchId || '').trim().slice(0, 80) };
    case 'gift_coins':
      return {
        targetEmail: canonicalEmail(p.targetEmail, 'target email'),
        amount: Number(p.amount),
        reason: String(p.reason || 'admin gift').trim().slice(0, 160),
      };
    case 'burn_coins':
      return { email: canonicalEmail(p.email, 'email'), amount: Number(p.amount) };
    case 'economy_multiplier':
      return { multiplier: Number(p.multiplier) };
    case 'broadcast':
      return { msg: String(p.msg || '').trim().slice(0, 500), type: String(p.type || 'normal').trim().slice(0, 30) };
    case 'shadow_ban':
      return { email: canonicalEmail(p.email, 'email') };
    case 'ban_account':
      return { email: canonicalEmail(p.email, 'email'), reason: String(p.reason || 'Banned by admin').trim().slice(0, 200) };
    case 'unban_account':
      return { email: canonicalEmail(p.email, 'email') };
    case 'casino_rig':
      return { chance: Number(p.chance) };
    case 'casino_toggle':
      return {};
    case 'prox_block': {
      const domain = String(p.domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').split(/[/?#]/)[0].slice(0, 180);
      return { domain };
    }
    case 'content_mirror':
      return { url: String(p.url || '').trim().slice(0, 500) };
    case 'content_featured':
      return { href: String(p.href || '').trim().slice(0, 240) };
    case 'moderator_role':
      return { email: canonicalEmail(p.email, 'email'), active: p.active === true };
    case 'moderator_panel':
      return { links: sanitizeModeratorPanelLinks(p.links) };
  }
  adminActionError(400, 'unknown moderator action');
}

function moderatorActionFromBody(body = {}) {
  const explicit = String(body.action || '').trim();
  if (explicit && MODERATOR_ACTION_LABELS[explicit]) return explicit;
  const targetUrl = String(body.targetUrl || body.url || '').trim();
  return MODERATOR_ACTION_BY_URL[targetUrl] || '';
}

function loadModeratorRequests() {
  const raw = loadJson(MODERATOR_REQUESTS_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function saveModeratorRequests(requests) {
  saveJsonSync(MODERATOR_REQUESTS_FILE, requests.slice(0, 1000));
}

function publicModeratorRequest(req) {
  return {
    id: req.id || '',
    requestedBy: req.requestedBy || '',
    requestedByEmail: req.requestedByEmail || '',
    action: req.action || '',
    label: req.label || MODERATOR_ACTION_LABELS[req.action] || 'Moderator action',
    payload: req.payload || {},
    status: req.status || 'pending',
    requestedAt: req.requestedAt || 0,
    resolvedAt: req.resolvedAt || 0,
    resolvedBy: req.resolvedBy || '',
    note: req.note || '',
    result: req.result || null,
    error: req.error || '',
  };
}

function createModeratorActionRequest(sid, body = {}) {
  const requestedByEmail = emailFromSid(sid) || 'moderator';
  const action = moderatorActionFromBody(body);
  if (!action) adminActionError(400, 'unknown moderator action');
  const payload = cleanModeratorActionPayload(action, body.payload || {});
  const entry = {
    id: randomBytes(10).toString('hex'),
    requestedBy: publicSessionId(sid),
    requestedByEmail,
    action,
    label: String(body.label || MODERATOR_ACTION_LABELS[action] || 'Moderator action').trim().slice(0, 100),
    payload,
    status: 'pending',
    requestedAt: Date.now(),
    resolvedAt: 0,
    resolvedBy: '',
    note: '',
    result: null,
    error: '',
  };
  const requests = loadModeratorRequests();
  requests.unshift(entry);
  saveModeratorRequests(requests);
  logAdminAction(requestedByEmail, 'moderator_request', { id: entry.id, action, label: entry.label });
  return publicModeratorRequest(entry);
}

function removeAdminNotice(payload, actor) {
  const id = String(payload.id || '').trim();
  const batchId = String(payload.batchId || '').trim();
  if (!id && !batchId) adminActionError(400, 'notification id or batch id required');
  const gifts = loadJson(COIN_GIFTS_FILE, {});
  let removed = 0;
  for (const [email, notices] of Object.entries(gifts)) {
    if (!Array.isArray(notices)) continue;
    gifts[email] = notices.filter(notice => {
      const match = notice.kind === 'admin_notice' &&
        ((id && String(notice.id) === id) || (batchId && String(notice.batchId || '') === batchId));
      if (match) removed++;
      return !match;
    });
  }
  saveJson(COIN_GIFTS_FILE, gifts);
  logAdminAction(actor, 'unsend_notification', { id, batchId, removed });
  return { ok: true, removed };
}

function sendAdminNotice(payload, actor) {
  const allUsers = payload.allUsers === true;
  const title = String(payload.title || 'Admin notification').trim().slice(0, 80) || 'Admin notification';
  const message = String(payload.message || '').trim().slice(0, 1000);
  if (!message) adminActionError(400, 'message required');
  const batchId = randomBytes(10).toString('hex');
  if (allUsers) {
    const tokens = loadTokens();
    const targets = new Set();
    for (const [tok, data] of Object.entries(tokens)) {
      const email = String(data.email || '').toLowerCase().trim();
      if (!email || isRevoked(tok)) continue;
      targets.add(email);
    }
    for (const email of targets) {
      addAdminNotification(email, title, message, actor, batchId);
      pushAdminNotification(email, title, message);
    }
    logAdminAction(actor, 'send_notification_all', { count: targets.size, title, batchId });
    return { ok: true, allUsers: true, count: targets.size, batchId };
  }
  const targetEmail = canonicalEmail(payload.targetEmail, 'target email');
  const notice = addAdminNotification(targetEmail, title, message, actor, batchId);
  pushAdminNotification(targetEmail, title, message);
  logAdminAction(actor, 'send_notification', { targetEmail, title, notificationId: notice?.id || '', batchId });
  return { ok: true, targetEmail, notificationId: notice?.id || '', batchId };
}

function executeModeratorApprovedAction(action, rawPayload, approverEmail, requesterEmail = '') {
  const payload = cleanModeratorActionPayload(action, rawPayload);
  const actor = approverEmail || 'admin';
  if (action === 'grant_premium') {
    if (!canGrantPremiumEmail(actor)) adminActionError(403, 'approver cannot grant premium');
    const targetRaw = payload.targetEmail;
    const targetEmail = normalizeEmail(targetRaw);
    const reason = payload.reason || 'free premium granted by admin';
    if (isPremiumEmail(targetEmail)) adminActionError(400, 'That user is already Premium.');
    const apps = applications;
    apps.unshift({
      name: targetEmail.split('@')[0],
      email: targetRaw,
      type: 'premium',
      status: 'approved',
      grantPremium: true,
      why: `Free premium granted by ${actor}: ${reason}`,
      submitted_at: Date.now(),
      approved_at: Date.now(),
      approved_by: actor,
    });
    saveApplications(apps);
    addAdminNotification(targetRaw, 'Premium granted', `${actor} granted you Premium. Reason: ${reason}`, actor);
    pushAdminNotification(targetRaw, 'Premium granted', `${actor} granted you Premium. Reason: ${reason}`);
    logAdminAction(actor, 'grant_premium', { targetEmail, reason, requestedBy: requesterEmail });
    return { ok: true, targetEmail: targetRaw };
  }
  if (action === 'revoke_premium') {
    if (!canGrantPremiumEmail(actor)) adminActionError(403, 'approver cannot revoke premium');
    const emailRaw = payload.email;
    const norm = normalizeEmail(emailRaw);
    const reason = payload.reason || 'premium revoked by admin';
    const apps = applications;
    let changed = false;
    for (const app of apps) {
      if (normalizeEmail(app.email || '') !== norm) continue;
      if (app.status !== 'approved' || !(app.type === 'premium' || app.grantPremium === true)) continue;
      app.status = 'revoked';
      app.revoked_at = Date.now();
      app.revoked_by = actor;
      app.why_revoked = reason;
      changed = true;
    }
    if (!changed) adminActionError(404, 'active premium user not found');
    saveApplications(apps);
    logAdminAction(actor, 'revoke_premium', { targetEmail: emailRaw, reason, requestedBy: requesterEmail });
    return { ok: true, targetEmail: emailRaw };
  }
  if (action === 'send_notification') return sendAdminNotice(payload, actor);
  if (action === 'unsend_notification') return removeAdminNotice(payload, actor);
  if (action === 'gift_coins') {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) adminActionError(400, 'amount must be a positive number');
    if (amount > 1_000_000_000) adminActionError(400, 'amount is too large');
    addCoins(payload.targetEmail, amount);
    addCoinGiftNotice(payload.targetEmail, amount, actor, payload.reason || 'admin gift');
    logAdminAction(actor, 'gift_coins', { targetEmail: payload.targetEmail, amount, reason: payload.reason, requestedBy: requesterEmail });
    return { ok: true, targetEmail: payload.targetEmail, amount, newBalance: getCoins(payload.targetEmail) };
  }
  if (action === 'burn_coins') {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) adminActionError(400, 'amount must be a positive number');
    addCoins(payload.email, -amount);
    logAdminAction(actor, 'burn_coins', { target: payload.email, amount, requestedBy: requesterEmail });
    return { ok: true, targetEmail: payload.email, amount, newBalance: getCoins(payload.email) };
  }
  if (action === 'economy_multiplier') {
    const multiplier = Number(payload.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 25) adminActionError(400, 'invalid multiplier');
    globalCoinMultiplier = multiplier;
    logAdminAction(actor, 'set_multiplier', { multiplier, requestedBy: requesterEmail });
    return { ok: true, multiplier };
  }
  if (action === 'broadcast') {
    const msg = payload.msg;
    if (!msg) adminActionError(400, 'message required');
    const type = payload.type === 'jumpscare' ? 'jumpscare' : 'normal';
    const socketPayload = JSON.stringify({ type: type === 'jumpscare' ? 'admin_jumpscare' : 'admin_broadcast', message: msg });
    for (const ws of allSockets) {
      if (ws.data && ws.data.isBroadcast) {
        try { ws.send(socketPayload); } catch {}
      }
    }
    logAdminAction(actor, type === 'jumpscare' ? 'jumpscare' : 'broadcast', { message: msg, requestedBy: requesterEmail });
    return { ok: true };
  }
  if (action === 'shadow_ban') {
    const target = normalizeEmail(payload.email);
    if (shadowBans.has(target)) shadowBans.delete(target);
    else shadowBans.add(target);
    saveShadowBans();
    logAdminAction(actor, 'shadow_ban', { target, active: shadowBans.has(target), requestedBy: requesterEmail });
    return { ok: true, active: shadowBans.has(target) };
  }
  if (action === 'ban_account') {
    const targetEmail = normalizeEmail(payload.email);
    if (isAdminEmail(targetEmail)) adminActionError(403, 'cannot ban admins or owners from this panel');
    const reason = payload.reason || 'Banned by admin';
    const bl = loadBlacklist();
    bl[targetEmail] = { reason, banned_at: Date.now(), by: actor };
    saveBlacklist(bl);
    addAdminNotification(targetEmail, 'Account banned', `Your account was banned. Reason: ${reason}`, actor);
    logAdminAction(actor, 'ban_account', { targetEmail, reason, requestedBy: requesterEmail });
    return { ok: true, targetEmail };
  }
  if (action === 'unban_account') {
    const targetEmail = normalizeEmail(payload.email);
    const bl = loadBlacklist();
    const existed = !!bl[targetEmail];
    delete bl[targetEmail];
    saveBlacklist(bl);
    logAdminAction(actor, 'unban_account', { targetEmail, existed, requestedBy: requesterEmail });
    return { ok: true, targetEmail, existed };
  }
  if (action === 'casino_rig') {
    const chance = Number(payload.chance);
    if (!Number.isFinite(chance) || chance < 0 || chance > 100) adminActionError(400, 'invalid chance');
    casinoRigChance = chance;
    logAdminAction(actor, 'set_casino_rig', { chance, requestedBy: requesterEmail });
    return { ok: true, chance };
  }
  if (action === 'casino_toggle') {
    casinoEnabled = !casinoEnabled;
    logAdminAction(actor, 'toggle_casino', { enabled: casinoEnabled, requestedBy: requesterEmail });
    return { ok: true, enabled: casinoEnabled };
  }
  if (action === 'prox_block') {
    if (!payload.domain) adminActionError(400, 'domain required');
    proxBlocklist.add(payload.domain);
    saveJsonSync(join(BASE, 'data', 'prox_blocklist.json'), Array.from(proxBlocklist));
    logAdminAction(actor, 'prox_block', { domain: payload.domain, requestedBy: requesterEmail });
    return { ok: true, domain: payload.domain };
  }
  if (action === 'content_mirror') {
    const newUrl = payload.url;
    if (!/^https?:\/\//i.test(newUrl)) adminActionError(400, 'valid mirror URL required');
    const sitesPath = join(BASE, 'data', 'sites');
    let contents = readFileSync(sitesPath, 'utf8');
    contents = contents.replace(/url https:\/\/docs\.google\.com\/document\/d\/[^\s]+ Mitch\.pro Mirrors/, `url ${newUrl} Mitch.pro Mirrors`);
    writeFileSync(sitesPath, contents);
    logAdminAction(actor, 'update_mirror', { url: newUrl, requestedBy: requesterEmail });
    return { ok: true, url: newUrl };
  }
  if (action === 'content_featured') {
    if (!payload.href) adminActionError(400, 'href required');
    featuredGameHref = payload.href;
    logAdminAction(actor, 'set_featured', { href: featuredGameHref, requestedBy: requesterEmail });
    return { ok: true, href: featuredGameHref };
  }
  if (action === 'moderator_role') {
    const targetRaw = String(payload.email || '').trim();
    const target = normalizeEmail(targetRaw);
    let mods = moderatorEmails();
    if (payload.active) {
      if (!mods.some(m => normalizeEmail(m) === target)) mods.push(targetRaw);
    } else {
      mods = mods.filter(m => normalizeEmail(m) !== target);
    }
    saveJsonSync(MODERATORS_FILE, mods);
    logAdminAction(actor, payload.active ? 'add_moderator' : 'remove_moderator', { target: targetRaw, requestedBy: requesterEmail });
    return { ok: true, moderators: mods };
  }
  if (action === 'moderator_panel') {
    const links = sanitizeModeratorPanelLinks(payload.links);
    saveJsonSync(MODERATOR_PANEL_FILE, { links });
    logAdminAction(actor, 'update_moderator_panel', { linkCount: links.length, requestedBy: requesterEmail });
    return { ok: true, links };
  }
  adminActionError(400, 'unknown moderator action');
}

function premiumGrantAdminEmails() {
  return [
    'admin@mitch.pro',
    'tyler.thompson1@student.rjuhsd.us',
  ];
}

function canGrantPremiumEmail(email) {
  if (!email || !isAdminEmail(email)) return false;
  const norm = normalizeEmail(email);
  return premiumGrantAdminEmails().some(adminEmail => normalizeEmail(adminEmail) === norm);
}

function canGrantPremiumId(sid) {
  if (!sid || !isAdminId(sid)) return false;
  return canGrantPremiumEmail(emailFromSid(sid) || '');
}

const SHOP_PRICE_MULTIPLIER = 1.85;
let SHOP_CATALOG = [
  { id: 'premium', name: 'Premium', section: 'Premium', type: 'premium', cost: 5000, desc: 'Unlock mitch.prox, Premium Chat, 2X typing/logic coin rewards, 2X Clicker/Riches offline gains, larger canvas brushes, exclusive profile frames/badges, and the epic chance to have an arcade game named after you!' },
  { id: 'neon_purple', name: 'Neon Purple Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 500, desc: 'A bright purple username for chat, profiles, and leaderboards.' },
  { id: 'electric_blue', name: 'Electric Blue Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 500, desc: 'A sharp electric-blue username style.' },
  { id: 'mint_flash', name: 'Mint Flash Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 550, desc: 'A clean mint username with a fresh glow.' },
  { id: 'rose_spark', name: 'Rose Spark Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 550, desc: 'A warm rose username style with a soft highlight.' },
  { id: 'ember_red', name: 'Ember Red Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 650, desc: 'A deep red username with a bolder presence.' },
  { id: 'void_white', name: 'Void White Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 750, desc: 'A high-contrast white username for dark pages.' },
  { id: 'gold_glow', name: 'Golden Glow Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 900, premiumOnly: true, desc: 'A premium gold username glow.' },
  { id: 'rainbow_name', name: 'Rainbow Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 2500, adminOnly: true, desc: 'An admin-only animated rainbow username.' },
  { id: 'verified_badge', name: 'Verified Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1000, desc: 'Adds a verified check badge beside your name.' },
  { id: 'og_badge', name: 'OG Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1000, desc: 'Show that you were here early.' },
  { id: 'artist_badge', name: 'Artist Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 900, desc: 'A badge for canvas builders and pixel artists.' },
  { id: 'chess_badge', name: 'Chess Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 900, desc: 'A badge for chess regulars.' },
  { id: 'builder_badge', name: 'Builder Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 950, desc: 'A badge for people who help build the community.' },
  { id: 'lucky_badge', name: 'Lucky Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1200, desc: 'A rare-feeling badge for casino winners.' },
  { id: 'premium_star_badge', name: 'Premium Star Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1400, premiumOnly: true, desc: 'A premium star badge for your profile and chats.' },
  { id: 'owner_fan_badge', name: 'Mitch Fan Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 800, desc: 'A simple badge for fans of the site.' },
  { id: 'chat_sparkles', name: 'Chat Sparkles', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 850, desc: 'Adds a subtle sparkle effect to your chat identity.' },
  { id: 'chat_shadow', name: 'Chat Shadow', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 850, desc: 'Adds a dark shadow accent to your chat identity.' },
  { id: 'chat_wave', name: 'Chat Wave', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 1000, desc: 'A gentle animated wave effect for your chat name.' },
  { id: 'chat_terminal', name: 'Terminal Chat Style', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 1100, desc: 'A monospace terminal-style chat accent.' },
  { id: 'chat_prism', name: 'Prism Chat Style', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 1600, premiumOnly: true, desc: 'A premium prism accent for chat.' },
  { id: 'profile_grid', name: 'Profile Grid Background', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 900, desc: 'Adds a clean grid effect to your profile.' },
  { id: 'profile_stars', name: 'Profile Starfield', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 1200, desc: 'Adds a starfield-style profile effect.' },
  { id: 'profile_scanlines', name: 'Profile Scanlines', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 950, desc: 'Adds a retro scanline texture to your profile.' },
  { id: 'profile_gold_frame', name: 'Gold Profile Frame', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 1800, premiumOnly: true, desc: 'A premium gold frame accent for your profile.' },
  { id: 'profile_neon_frame', name: 'Neon Profile Frame', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 1800, premiumOnly: true, desc: 'A premium neon frame accent for your profile.' },
  { id: 'focus_theme', name: 'Focus Theme', section: 'Site Themes', type: 'cosmetic', costType: 'site_theme', cost: 700, desc: 'A calm, low-distraction site accent.' },
  { id: 'arcade_theme', name: 'Arcade Theme', section: 'Site Themes', type: 'cosmetic', costType: 'site_theme', cost: 900, desc: 'A brighter arcade-style site accent.' },
  { id: 'midnight_theme', name: 'Midnight Theme', section: 'Site Themes', type: 'cosmetic', costType: 'site_theme', cost: 900, desc: 'A darker midnight accent for the site.' },
  { id: 'sarcastic_mentor', name: 'Sarcastic Mentor AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2000, desc: 'Unlock a witty assistant personality.' },
  { id: 'hacker_persona', name: 'Hacker Persona AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2000, desc: 'A movie-hacker flavored assistant voice.' },
  { id: 'study_coach', name: 'Study Coach AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 1800, desc: 'A calmer helper for homework and studying.' },
  { id: 'debug_helper', name: 'Debug Helper AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2200, desc: 'A coding-focused assistant personality.' },
  { id: 'story_mode', name: 'Story Mode AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 1800, desc: 'A more creative writing personality.' },
  { id: 'speedrun_ai', name: 'Speedrun AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2400, premiumOnly: true, desc: 'A premium fast-answer assistant personality.' },
  { id: 'vip_pass', name: 'VIP Casino Pass (24h)', section: 'Passes', type: 'pass', costType: 'vip_casino_pass', cost: 250, desc: 'Unlocks unlimited max bet amount in all casino games for 24 hours.' },
  { id: 'canvas_lock_pass', name: 'Canvas Lock Pass', section: 'Passes', type: 'cosmetic', costType: 'canvas_tool', cost: 1200, desc: 'Unlocks a saved canvas-tool preference toggle.' },
  { id: 'daily_bonus_plus', name: 'Daily Bonus Plus', section: 'Passes', type: 'cosmetic', costType: 'canvas_tool', cost: 1500, premiumOnly: true, desc: 'Unlocks a premium daily-bonus preference toggle.' },
  { id: 'streak_freeze', name: 'Streak Freeze', section: 'Utility', type: 'utility', costType: 'streak_freeze', cost: 150, desc: 'Automatically saves your Daily Login streak if you miss a day!' },
  { id: 'happy_hour_ticket', name: 'Personal Happy Hour (30m)', section: 'Utility', type: 'utility', costType: 'happy_hour_ticket', cost: 350, desc: 'Trigger a personal 30-minute Happy Hour for 2X coins on all games and canvas!' },
  { id: 'double_down_ticket', name: 'Double Down Ticket (30m)', section: 'Utility', type: 'utility', costType: 'double_down_ticket', cost: 500, desc: 'Active for 30 minutes. Doubles the payout of any casino game wins!' },
  { id: 'bad_beat_insurance', name: 'Bad Beat Insurance (30m)', section: 'Utility', type: 'utility', costType: 'bad_beat_insurance', cost: 300, desc: 'Active for 30 minutes. Refunds your entire bet if you lose any casino game round.' },
  { id: 'happy_hour_extension', name: 'Happy Hour Extension (15m)', section: 'Utility', type: 'utility', costType: 'happy_hour_extension', cost: 250, desc: 'Extends your active Personal Happy Hour by an additional 15 minutes. Requires active Happy Hour to purchase.' },
  { id: 'slots_free_spin', name: 'Slots Free Spins (5x)', section: 'Utility', type: 'utility', costType: 'slots_free_spin', cost: 200, desc: 'Adds 5 free spins to your account. Free spins let you play slots with zero coins at risk while keeping all winnings!' }
];
try {
  const catalogPath = join(DATA_DIR, 'shop_catalog.json');
  if (existsSync(catalogPath)) {
    const loaded = JSON.parse(readFileSync(catalogPath, 'utf8'));
    if (Array.isArray(loaded) && loaded.length > 0) {
      SHOP_CATALOG = loaded;
    }
  }
} catch (e) {
  console.error('[shop] failed to load dynamic shop catalog:', e);
}

const SHOP_TYPE_CONFIG = {
  name_color: { bucket: 'colors', active: 'activeColor' },
  chat_badge: { bucket: 'badges', active: 'activeBadge' },
  chat_effect: { bucket: 'chatEffects', active: 'activeChatEffect' },
  profile_effect: { bucket: 'profileEffects', active: 'activeProfileEffect' },
  site_theme: { bucket: 'themes', active: 'activeTheme' },
  canvas_tool: { bucket: 'tools', active: 'activeTool' }
};

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
    if (Array.isArray(base[key])) base[key] = Array.isArray(entry[key]) ? [...new Set(entry[key].filter(Boolean))] : [];
    else base[key] = typeof entry[key] === 'string' ? entry[key] : '';
  }
  return base;
}

function shopItemById(itemId) {
  return SHOP_CATALOG.find(item => item.id === String(itemId || ''));
}

function shopTierFor(item) {
  if (!item) return 'common';
  if (item.type === 'premium') return 'legendary';
  if (item.premiumOnly || ['rainbow_name', 'speedrun_ai', 'profile_gold_frame', 'profile_neon_frame', 'chat_prism'].includes(item.id)) return 'elite';
  if (['lucky_badge', 'chat_wave', 'debug_helper', 'daily_bonus_plus', 'profile_stars'].includes(item.id)) return 'rare';
  if (['vip_pass', 'arcade_theme', 'midnight_theme', 'verified_badge', 'og_badge'].includes(item.id)) return 'uncommon';
  return 'common';
}

function shopPerkFor(item) {
  if (!item) return '';
  const perks = {
    premium: 'Best value: unlocks premium tools, mitch.prox access, colors, and bigger brushes.',
    rainbow_name: 'Animated rainbow name. Flashiest name style in the market.',
    gold_glow: 'Premium gold glow that stands out on dark pages.',
    chat_prism: 'Premium prism chat accent with the most noticeable chat style.',
    profile_gold_frame: 'High-status profile frame for premium members.',
    profile_neon_frame: 'Bright neon profile frame with stronger profile presence.',
    speedrun_ai: 'Fast-response premium AI personality.',
    debug_helper: 'Stronger coding-focused assistant personality.',
    vip_pass: '24 hours of unlimited casino max bets.',
    daily_bonus_plus: 'Premium daily-bonus preference toggle.',
    canvas_lock_pass: 'Canvas-tool preference for protecting important pixel work.',
    quick_access_pass: 'Convenience toggle for faster navigation.',
  };
  return perks[item.id] || ({
    name_color: 'Changes your visible identity color.',
    chat_badge: 'Adds a visible badge beside your identity.',
    chat_effect: 'Adds a style effect to chat identity.',
    profile_effect: 'Upgrades your public profile look.',
    site_theme: 'Unlocks a site accent you can toggle on or off.',
    ai_personality: 'Unlocks a selectable AI assistant personality.',
    canvas_tool: 'Unlocks a canvas or site preference toggle.',
  }[item.costType] || '');
}

function shopBaseCostFor(item) {
  if (!item) return 0;
  const multipliers = {
    premium: 1.8,
    name_color: 2.05,
    chat_badge: 1.95,
    chat_effect: 2.1,
    profile_effect: 2.15,
    site_theme: 1.8,
    ai_personality: 2.35,
    vip_casino_pass: 3.2,
    canvas_tool: 2.2,
  };
  const idMultipliers = {
    rainbow_name: 2.35,
    gold_glow: 2.2,
    chat_prism: 2.35,
    profile_gold_frame: 2.35,
    profile_neon_frame: 2.35,
    debug_helper: 2.55,
    speedrun_ai: 2.7,
    daily_bonus_plus: 2.5,
  };
  const mult = item.priceMultiplier || idMultipliers[item.id] || multipliers[item.costType] || multipliers[item.type] || SHOP_PRICE_MULTIPLIER;
  return Math.max(1, Math.ceil((Number(item.cost || 0) * mult) / 25) * 25);
}

function premiumDiscountFor(item) {
  if (!item || item.type === 'premium') return 0;
  if (typeof item.premiumDiscount === 'number') return Math.max(0, Math.min(0.5, item.premiumDiscount));
  const idDiscounts = {
    rainbow_name: 0.06,
    gold_glow: 0.08,
    premium_star_badge: 0.10,
    chat_prism: 0.09,
    profile_gold_frame: 0.07,
    profile_neon_frame: 0.07,
    speedrun_ai: 0.05,
    debug_helper: 0.08,
    vip_pass: 0.04,
    daily_bonus_plus: 0.06,
    focus_theme: 0.20,
    arcade_theme: 0.18,
    midnight_theme: 0.18,
  };
  if (idDiscounts[item.id] !== undefined) return idDiscounts[item.id];
  const byType = {
    name_color: 0.12,
    chat_badge: 0.14,
    chat_effect: 0.15,
    profile_effect: 0.10,
    site_theme: 0.18,
    ai_personality: 0.09,
    canvas_tool: 0.11,
    vip_casino_pass: 0.04,
  };
  return item.premiumOnly ? 0.06 : (byType[item.costType] || 0.10);
}

function shopCostFor(item, email) {
  if (!item) return 0;
  let baseCost = shopBaseCostFor(item);

  if (item.id === 'streak_freeze' && email) {
    const norm = normalizeEmail(email);
    const data = dailyLogins[norm] || { lastClaimDate: '', streak: 0, streakFreezes: 0 };
    const freezes = data.streakFreezes || 0;
    if (freezes === 0) {
      baseCost = 150;
    } else if (freezes === 1) {
      baseCost = 600;
    } else if (freezes === 2) {
      baseCost = 2000;
    } else {
      baseCost = 5000;
    }
  }

  if (isPremiumEmail(email) && item.type !== 'premium') {
    return Math.max(1, Math.ceil(baseCost * (1 - premiumDiscountFor(item)) / 25) * 25);
  }
  return baseCost;
}

function shopItemsFor(email) {
  const premium = isPremiumEmail(email);
  const admin = isAdminEmail(email);
  return SHOP_CATALOG.filter(item => admin || !item.adminOnly).map(item => ({
    ...item,
    tier: shopTierFor(item),
    perk: shopPerkFor(item),
    originalCost: shopBaseCostFor(item),
    cost: shopCostFor(item, email),
    discountPct: premium && item.type !== 'premium' ? Math.round(premiumDiscountFor(item) * 100) : 0
  }));
}

function buildInventory(email) {
  const norm = normalizeEmail(email);
  const cosm = loadJson(COSMETICS_FILE, {});
  const unlockedAi = loadJson(UNLOCKED_AI_FILE, {});
  const userCosm = sanitizeCosmeticsForEmail(email, cosm[norm] || {});
  const ai = Array.isArray(unlockedAi[norm]) ? [...new Set(unlockedAi[norm].filter(Boolean))] : [];
  return { cosmetics: userCosm, ai };
}

function ownsShopItem(email, item, inventory = buildInventory(email)) {
  if (!item) return false;
  if (item.type === 'premium') return isPremiumEmail(email);
  if (item.costType === 'ai_personality') return inventory.ai.includes(item.id);
  if (item.costType === 'vip_casino_pass') {
    const stats = loadUserStats();
    return (stats[normalizeEmail(email)]?.vip_casino_until || 0) > Date.now();
  }
  if (item.costType === 'streak_freeze' || item.costType === 'happy_hour_ticket') {
    return false;
  }
  const cfg = SHOP_TYPE_CONFIG[item.costType];
  return !!cfg && inventory.cosmetics[cfg.bucket].includes(item.id);
}

// ── Static file serving ───────────────────────────────────────────────────────

function shouldInjectReadability(urlPath) {
  const path = (urlPath || '/').split('?')[0];
  if (path.startsWith('/games/') && path !== '/games/' && path !== '/games/index.html') return false;
  if (path.startsWith('/ttygames/')) return false;
  return true;
}

function injectReadability(html, urlPath) {
  if (!shouldInjectReadability(urlPath) || html.includes('/readability.css')) return html;
  const tag = '<link rel="stylesheet" href="/readability.css">';
  const hi = html.lastIndexOf('</head>');
  return hi >= 0 ? html.slice(0, hi) + tag + html.slice(hi) : tag + html;
}

function injectBroadcast(html) {
  if (html.includes('/broadcast.js')) return html;
  const tag = '<script src="/broadcast.js" defer></script>';
  const bi = html.lastIndexOf('</body>');
  return bi >= 0 ? html.slice(0, bi) + tag + html.slice(bi) : html + tag;
}

async function serveStatic(urlPath) {
  // Normalise path
  let filePath = join(WEBROOT, urlPath.replace(/^\//, ''));

  // Directory: check for index.html, then index.htm
  try {
    if (statSync(filePath).isDirectory()) {
      const withSlash = filePath.endsWith('/') ? filePath : filePath + '/';
      if (existsSync(join(withSlash, 'index.html'))) {
        filePath = join(withSlash, 'index.html');
      } else if (existsSync(join(withSlash, 'index.htm'))) {
        // Redirect, mirroring send_head override
        const target = (urlPath.endsWith('/') ? urlPath : urlPath + '/') + 'index.htm';
        return Response.redirect(target, 302);
      }
    }
  } catch {}

  const file = Bun.file(filePath);
  if (await file.exists()) {
    const ext = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'js': 'application/javascript; charset=utf-8',
      'css': 'text/css; charset=utf-8',
      'html': 'text/html; charset=utf-8',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'json': 'application/json; charset=utf-8'
    };
    const contentType = mimeTypes[ext] || file.type;
    const headers = { 'Content-Type': contentType };

    const isCode = ['html', 'js', 'css'].includes(ext) || contentType.includes('text/html') || contentType.includes('javascript') || contentType.includes('css');
    if (isCode) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else {
      headers['Cache-Control'] = 'public, max-age=2592000';
    }

    if (contentType.includes('text/html')) {
      const text = await file.text();
      const html = injectBroadcast(injectReadability(text, urlPath));
      return new Response(html, { headers });
    }
    return new Response(file, { headers });
  }
  return errResp(404, null, null);
}

function rewriteHtml(html, targetUrl) {
  try {
    const targetUrlObj = new URL(targetUrl);
    const targetScheme = targetUrlObj.protocol.slice(0, -1); // e.g. "https" or "http"
    const targetHost = targetUrlObj.host; // e.g. "example.com"
    
    // 1. Rewrite absolute URLs starting with http:// or https://
    let rewritten = html.replace(/(href|src|action|data-src|poster)\s*=\s*(['"])(https?:\/\/.*?)\2/gi, (match, attr, q, urlStr) => {
      try {
        const u = new URL(urlStr);
        const scheme = u.protocol.slice(0, -1);
        const rest = u.host + u.pathname + u.search + u.hash;
        return `${attr}=${q}/prox/${scheme}/${rest}${q}`;
      } catch {
        return match;
      }
    });

    // 2. Rewrite protocol-relative URLs starting with //
    rewritten = rewritten.replace(/(href|src|action|data-src|poster)\s*=\s*(['"])\/\/(.*?)\2/gi, (match, attr, q, urlStr) => {
      return `${attr}=${q}/prox/https/${urlStr}${q}`;
    });

    // 3. Rewrite root-relative URLs starting with / (but not /prox/ or /proxy/)
    rewritten = rewritten.replace(/(href|src|action|data-src|poster)\s*=\s*(['"])\/((?!prox\/|proxy\/).*?)\2/gi, (match, attr, q, pathStr) => {
      const rest = targetHost + '/' + pathStr;
      return `${attr}=${q}/prox/${targetScheme}/${rest}${q}`;
    });

    // 4. Rewrite CSS url(...) imports in HTML (absolute http/https)
    rewritten = rewritten.replace(/url\(\s*(['"]?)(https?:\/\/.*?)\1\s*\)/gi, (match, q, urlStr) => {
      try {
        const u = new URL(urlStr);
        const scheme = u.protocol.slice(0, -1);
        const rest = u.host + u.pathname + u.search + u.hash;
        return `url(${q}/prox/${scheme}/${rest}${q})`;
      } catch {
        return match;
      }
    });
    
    // 5. Rewrite root-relative CSS url(/...) imports in HTML (but not /prox/ or /proxy/)
    rewritten = rewritten.replace(/url\(\s*(['"]?)\/((?!prox\/|proxy\/).*?)\1\s*\)/gi, (match, q, pathStr) => {
      const rest = targetHost + '/' + pathStr;
      return `url(${q}/prox/${targetScheme}/${rest}${q})`;
    });

    // 6. Scrub the word "unblocked" case-insensitively from proxied HTML to prevent school administrator filter trips
    rewritten = rewritten.replace(/unblocked/gi, (match) => {
      if (match === 'Unblocked') return 'Open';
      if (match === 'UNBLOCKED') return 'OPEN';
      return 'open';
    });

    return rewritten;
  } catch (e) {
    return html;
  }
}

// ── Main fetch handler ────────────────────────────────────────────────────────

const banOpenPaths = new Set([
  '/appeal.html',
  '/api/appeal',
  '/api/pass',
]);

async function handleRequest(req, server) {
  const url    = new URL(req.url);
  const path   = url.pathname;
  const method = req.method;

  // Global rate limit check for all APIs
  if (path.startsWith('/api/')) {
    const rl = checkRateLimit(req, path);
    if (rl) return rl;
  }

  if (path === '/swift') {
    return Response.redirect('/swift/' + url.search, 301);
  }

  const ip = getRealIp(req);

  // Reject request if IP is banned (except for ban appeal paths)
  const ipBan = bannedInfoForIp(ip);
  if (ipBan && !banOpenPaths.has(path)) {
    return bannedResponse({
      reason: ipBan.reason || 'This IP address is banned from the website.',
      by: ipBan.by || 'site admin'
    });
  }

  // Dynamically track the user's last known IP address
  try {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (sid && validId(sid)) {
      const names = getCachedNames();
      const email = names[sid];
      if (email) {
        const norm = normalizeEmail(email);
        if (lastKnownIps[norm] !== ip) {
          lastKnownIps[norm] = ip;
          saveLastKnownIps();
        }
      }
    }
  } catch (e) {
    console.error('[traffic] Failed to update last known IP:', e);
  }

  // Enforce admin passphrase for all administrative API actions
  if (path.startsWith('/api/admin/') && path !== '/api/admin/passphrase-status') {
    try {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });

      // Passphrase enforcement applies to all full administrators
      if (isAdminId(sid)) {
        const email = emailFromSid(sid) || 'admin';
        const norm = normalizeEmail(email);
        const data = loadAdminPassphrase();
        const entry = data[norm] || {};

        if (!entry.hash) {
          return jsonResp(403, { error: 'passphrase_not_configured' });
        }

        const pass = String(req.headers.get('X-Admin-Passphrase') || '').trim();
        if (!pass || !await verifyAdminPassphrase(req, pass)) {
          return jsonResp(403, { error: 'invalid_passphrase' });
        }
      }
    } catch (e) {
      console.error('[auth] Admin passphrase check failed:', e);
      return jsonResp(500, { error: 'internal_error' });
    }
  }

  // ── mitch.prox Open General Proxy ──
  if (path === '/prox') {
    return Response.redirect('/prox/', 302);
  }

  if (path.startsWith('/prox/')) {
    if (path !== '/prox/' && path !== '/prox/index.html') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid) || !emailFromSid(sid)) {
        if (req.headers.get('accept')?.includes('text/html')) {
          return Response.redirect('/enroll/', 302);
        }
        return jsonResp(401, { error: 'Authentication required' });
      }

      const prefix = '/prox/';
      const sub = path.slice(prefix.length);
      const slashIdx = sub.indexOf('/');
      if (slashIdx === -1) {
        return jsonResp(400, { error: 'Invalid proxy URL format' });
      }
      const scheme = sub.slice(0, slashIdx);
      if (scheme !== 'http' && scheme !== 'https') {
        return jsonResp(400, { error: 'Unsupported scheme' });
      }
      const rest = sub.slice(slashIdx + 1);
      const targetUrl = `${scheme}://${rest}${url.search}`;

      try {
        const headers = new Headers();
        for (const [k, v] of req.headers.entries()) {
          if (!['host', 'cookie', 'authorization', 'referer', 'origin', 'accept-encoding'].includes(k.toLowerCase())) {
            headers.set(k, v);
          }
        }
        headers.set('User-Agent', req.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const upstreamRes = await fetch(targetUrl, {
          method: req.method,
          headers: headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null,
          redirect: 'follow'
        });

        const resHeaders = new Headers(upstreamRes.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.delete('content-security-policy');
        resHeaders.delete('x-frame-options');
        resHeaders.delete('content-encoding');
        resHeaders.delete('content-length');

        const contentType = upstreamRes.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          let html = await upstreamRes.text();
          html = rewriteHtml(html, targetUrl);
          return new Response(html, {
            status: upstreamRes.status,
            headers: resHeaders
          });
        } else {
          return new Response(upstreamRes.body, {
            status: upstreamRes.status,
            headers: resHeaders
          });
        }
      } catch (e) {
        return jsonResp(502, { error: 'Bad Gateway', message: 'Failed to proxy target URL: ' + String(e) });
      }
    }
  }

  // ── World's Hardest Captcha API Proxy ──
  if (path === '/api/token' ||
      path.startsWith('/api/puzzle/') ||
      path === '/api/solve' ||
      path === '/api/submit' ||
      path === '/api/stats' ||
      path === '/api/next' ||
      path.startsWith('/images/')) {
    const targetUrl = `https://www.worldshardestcaptcha.com${path}${url.search}`;
    try {
      const headers = new Headers();
      for (const [k, v] of req.headers.entries()) {
        if (!['host', 'cookie', 'referer', 'origin', 'accept-encoding'].includes(k.toLowerCase())) {
          headers.set(k, v);
        }
      }
      headers.set('User-Agent', req.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      headers.set('Origin', 'https://www.worldshardestcaptcha.com');
      headers.set('Referer', 'https://www.worldshardestcaptcha.com/');

      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers: headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null
      });

      const resHeaders = new Headers(upstreamRes.headers);
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.delete('content-security-policy');
      resHeaders.delete('x-frame-options');
      resHeaders.delete('content-encoding');
      resHeaders.delete('content-length');

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: resHeaders
      });
    } catch (e) {
      return jsonResp(502, { error: 'Bad Gateway', message: 'Failed to proxy captcha API: ' + String(e) });
    }
  }

  // ── GameMonetize Transparent Reverse Proxy ──
  if (path.startsWith('/proxy/gamemonetize/')) {
    const targetPath = path.slice('/proxy/gamemonetize/'.length);
    const targetUrl = `https://html5.gamemonetize.co/${targetPath}${url.search}`;
    try {
      const headers = new Headers();
      for (const [k, v] of req.headers.entries()) {
        if (!['host', 'cookie', 'authorization', 'referer', 'origin'].includes(k.toLowerCase())) {
          headers.set(k, v);
        }
      }
      
      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers: headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null
      });
      
      const resHeaders = new Headers(upstreamRes.headers);
      resHeaders.set('Access-Control-Allow-Origin', '*');
      resHeaders.delete('content-security-policy');
      resHeaders.delete('x-frame-options');
      resHeaders.delete('content-encoding');
      resHeaders.delete('content-length');
      
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: resHeaders
      });
    } catch (e) {
      return jsonResp(502, { error: 'Bad Gateway', message: 'Failed to proxy GameMonetize game: ' + String(e) });
    }
  }
  if (softMaintenanceActive) {
    const isExemptMaint = path === '/maintenance.html' ||
                          path === '/cookie-consent.js' ||
                          path === '/favicon.ico' ||
                          path === '/favicon.webp' ||
                          path.startsWith('/api/admin') ||
                          path.startsWith('/api/moderator') ||
                          path === '/api/login' ||
                          path === '/api/userdata' ||
                          (path.includes('.') && !path.endsWith('.html'));
    if (!isExemptMaint) {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) {
        if (path.startsWith('/api/')) {
          return jsonResp(503, { error: 'maintenance', message: 'System is currently undergoing offline maintenance.' });
        }
        return Response.redirect('/maintenance.html', 302);
      }
    }
  }
  let body = {};
  let parsedJsonBody = false;
  async function tryParseJson() {
    if (parsedJsonBody) return true;
    parsedJsonBody = true;
    try {
      body = await req.json();
      return true;
    } catch {
      body = {};
      return false;
    }
  }
  const initialCookies = getCookies(req);
  const initialSid = initialCookies['studentId'] || initialCookies['id'] || '';
  const initialBan = bannedInfoForSid(initialSid);
  if (initialBan && !banOpenPaths.has(path)) {
    if (path.startsWith('/api/')) {
      return jsonResp(path === '/api/pass' ? 200 : 403, {
        success: false,
        banned: true,
        error: 'account banned',
        reason: initialBan.reason || 'This account is banned from the website.',
      });
    }
    return bannedResponse(initialBan);
  }

  // ── Password Enforcement (Unified) ──────────────────────────────────────────
  const cleanPath = (path.endsWith('/') && path !== '/') ? path.slice(0, -1) : path;
  const isExempt = cleanPath === '/enroll' || 
                   cleanPath === '/larp' ||
                   cleanPath === '/larp/rezero' ||
                   cleanPath === '/bell' ||
                   cleanPath === '/api/bell/override' ||
                   cleanPath === '/claim' || 
                   cleanPath === '/api/signup' ||
                   cleanPath === '/api/bad-passwords' ||
                   cleanPath === '/api/verify-signup' ||
                   cleanPath === '/api/claim-token' || 
                   cleanPath === '/api/login' || 
                   cleanPath === '/api/request-access' || 
                   cleanPath === '/api/newid' || 
                   cleanPath === '/api/pass' ||
                   cleanPath === '/api/games' ||
                   cleanPath === '/api/log-click' ||
                   cleanPath === '/unsubscribe' ||
                   path.startsWith('/unsubscribe/') ||
                   cleanPath === '/api/newsletter/unsubscribe-direct' ||
                   cleanPath === '/api/newsletter/unsubscribe-secure' ||
                   cleanPath === '/api/token' ||
                   path.startsWith('/api/puzzle/') ||
                   cleanPath === '/api/solve' ||
                   cleanPath === '/api/submit' ||
                   cleanPath === '/api/stats' ||
                   cleanPath === '/api/next' ||
                   path.startsWith('/admin') || 
                   path.startsWith('/moderator') || 
                   path.startsWith('/api/admin') || 
                   path.startsWith('/api/moderator');
  
  const isAsset = path.includes('.') && !path.endsWith('.html');

  if (!isExempt && !isAsset && path !== '/ws' && path !== '/' && !checkPasswordCookie(req)) {
    if (path.startsWith('/api/')) {
      return jsonResp(403, { error: 'password required', message: 'Please set a password at /enroll/ to continue.' });
    }
    return Response.redirect('/enroll/', 302);
  }
  if (path === "/api/shop/items" && method === "GET") { 
    const cookies = getCookies(req);
    const sid = cookies["studentId"] || cookies["id"] || "";
    const email = validId(sid) ? emailFromSid(sid) : "";
    return jsonResp(200, {
      items: shopItemsFor(email || ''),
      premiumDiscountPct: 0,
      premiumDiscountNote: 'Premium discounts vary by item.'
    }); 
  } 
 
  if (path === "/api/me/inventory" && method === "GET") { 
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    if (!validId(sid)) return jsonResp(401, { error: "not logged in" }); 
    const email = emailFromSid(sid); 
    if (!email) return jsonResp(401, { error: "email not found" }); 
    const inventory = buildInventory(email);
    return jsonResp(200, inventory); 
  }

  // --- PLAYER MARKETPLACE ENDPOINTS ---
  if (path === "/api/marketplace/items" && method === "GET") {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    if (!validId(sid)) return jsonResp(401, { error: "not logged in" }); 
    const email = emailFromSid(sid); 
    if (!email) return jsonResp(401, { error: "email not found" }); 
    
    autoFinalizeMarketplace();
    const listings = loadJson(MARKETPLACE_FILE, []);
    const inventory = buildInventory(email);
    const coins = getCoins(email);

    const formattedings = listings.map(l => ({
      id: l.id,
      seller: maskEmail(l.seller),
      type: l.type,
      itemId: l.itemId,
      description: l.description,
      price: l.price,
      mediator: l.mediator ? maskEmail(l.mediator) : null,
      status: l.status,
      buyer: l.buyer ? maskEmail(l.buyer) : null,
      created_at: l.created_at,
      bought_at: l.bought_at,
      isSeller: normalizeEmail(l.seller) === normalizeEmail(email),
      isBuyer: l.buyer && normalizeEmail(l.buyer) === normalizeEmail(email),
      isMediator: l.mediator && normalizeEmail(l.mediator) === normalizeEmail(email)
    }));

    return jsonResp(200, { listings: formattedings, inventory, coins });
  }

  if (path === "/api/marketplace/list" && method === "POST") {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    if (!await tryParseJson()) return jsonResp(400, { error: "bad json" });
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    if (!validId(sid)) return jsonResp(401, { error: "not logged in" }); 
    const email = emailFromSid(sid); 
    if (!email) return jsonResp(401, { error: "email not found" }); 
    if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
      return jsonResp(400, { error: "reCAPTCHA failed. Please try again." });
    const norm = normalizeEmail(email);

    const listings = loadJson(MARKETPLACE_FILE, []);
    const activeCount = listings.filter(l => normalizeEmail(l.seller) === norm && l.status === 'active').length;
    if (activeCount >= 10) {
      return jsonResp(400, { error: "You cannot have more than 10 active listings on the marketplace." });
    }

    const { type, itemId, description, price, mediator } = body;
    
    if (type !== 'cosmetic' && type !== 'text') {
      return jsonResp(400, { error: "invalid listing type" });
    }
    const listingPrice = Number(price);
    if (isNaN(listingPrice) || listingPrice < 0) {
      return jsonResp(400, { error: "price must be a positive number" });
    }

    let mediatorEmail = null;
    if (mediator && String(mediator).trim()) {
      const medInput = String(mediator).trim().toLowerCase();
      if (medInput === norm) return jsonResp(400, { error: "you cannot mediate your own trade" });
      mediatorEmail = medInput;
    }

    if (type === 'cosmetic') {
      const item = shopItemById(itemId);
      if (!item) return jsonResp(400, { error: "invalid cosmetic item" });
      const cfg = SHOP_TYPE_CONFIG[item.costType];
      if (!cfg) return jsonResp(400, { error: "untradeable cosmetic item type" });

      const cosm = loadJson(COSMETICS_FILE, {});
      const owned = normalizeCosmetics(cosm[norm] || {});
      if (!owned[cfg.bucket].includes(itemId)) {
        return jsonResp(403, { error: "You do not own this cosmetic item!" });
      }

      // Strip item from seller
      owned[cfg.bucket] = owned[cfg.bucket].filter(id => id !== itemId);
      if (owned[cfg.active] === itemId) {
        owned[cfg.active] = "";
      }
      cosm[norm] = owned;
      saveJson(COSMETICS_FILE, cosm);
    } else {
      if (!description || !String(description).trim()) {
        return jsonResp(400, { error: "text listings require a description" });
      }
    }

    const newListing = {
      id: crypto.randomUUID().slice(0, 12),
      seller: email,
      type,
      itemId: type === 'cosmetic' ? itemId : null,
      description: String(description || '').slice(0, 500),
      price: listingPrice,
      mediator: mediatorEmail,
      status: 'active',
      buyer: null,
      created_at: Date.now(),
      bought_at: null,
      finalized_at: null,
      updated_at: Date.now()
    };

    listings.push(newListing);
    saveJson(MARKETPLACE_FILE, listings);
    return jsonResp(200, { ok: true, message: "Listing created successfully!" });
  }

  if (path === "/api/marketplace/buy" && method === "POST") {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    if (!await tryParseJson()) return jsonResp(400, { error: "bad json" });
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    if (!validId(sid)) return jsonResp(401, { error: "not logged in" }); 
    const email = emailFromSid(sid); 
    if (!email) return jsonResp(401, { error: "email not found" }); 
    if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
      return jsonResp(400, { error: "reCAPTCHA failed. Please try again." });
    const norm = normalizeEmail(email);

    const { listingId } = body;

    const listings = loadJson(MARKETPLACE_FILE, []);
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return jsonResp(404, { error: "listing not found" });
    if (listing.status !== 'active') return jsonResp(400, { error: "listing is no longer active" });
    if (normalizeEmail(listing.seller) === norm) return jsonResp(400, { error: "you cannot buy your own listing" });
    if (listing.mediator && normalizeEmail(listing.mediator) === norm) {
      return jsonResp(400, { error: "mediators cannot purchase the listings they mediate" });
    }

    const balance = getCoins(email);
    if (balance < listing.price) {
      return jsonResp(400, { error: `insufficient coins. Need ${listing.price}, have ${balance.toFixed(2)}.` });
    }

    // Deduct coins immediately from buyer
    addCoins(email, -listing.price);

    listing.buyer = email;
    listing.bought_at = Date.now();
    listing.updated_at = Date.now();

    if (listing.mediator) {
      // Hold in escrow
      listing.status = 'pending';
      saveJson(MARKETPLACE_FILE, listings);

      // Email notification
      const emailSubject = "Mitch.pro Marketplace — You are a mediator!";
      const emailBody = `Hello,

You have been selected as a mediator for a transaction on the mitch.pro Marketplace:
- Seller: ${maskEmail(listing.seller)}
- Buyer: ${maskEmail(email)}
- Price: ${listing.price} MitchCoins
- Item: ${listing.type === 'cosmetic' ? listing.itemId : 'Custom: ' + listing.description}

Please log in to https://mitch.pro/marketplace/ to resolve or undo this deal within 24 hours. If no action is taken, the trade will finalize automatically.

— Mitch.pro Team`;
      sendEmailBg(listing.mediator, emailSubject, emailBody);
      return jsonResp(200, { ok: true, message: "Purchase placed in mediator escrow successfully!" });
    } else {
      // Finalize immediately
      listing.status = 'finalized';
      listing.finalized_at = Date.now();
      saveJson(MARKETPLACE_FILE, listings);

      // 1. Transfer coins to seller (bypass happy hour multiplier)
      const coins = loadCoins();
      const sellerNorm = normalizeEmail(listing.seller);
      coins[sellerNorm] = Number(((coins[sellerNorm] || 0) + listing.price).toFixed(4));
      saveCoins(coins);

      // 2. Award item to buyer if cosmetic
      if (listing.type === 'cosmetic' && listing.itemId) {
        const item = shopItemById(listing.itemId);
        if (item && SHOP_TYPE_CONFIG[item.costType]) {
          const cosm = loadJson(COSMETICS_FILE, {});
          const owned = normalizeCosmetics(cosm[norm] || {});
          const bucket = SHOP_TYPE_CONFIG[item.costType].bucket;
          if (!owned[bucket].includes(listing.itemId)) {
            owned[bucket].push(listing.itemId);
          }
          cosm[norm] = owned;
          saveJson(COSMETICS_FILE, cosm);
        }
      }
      return jsonResp(200, { ok: true, message: "Purchase finalized successfully!" });
    }
  }

  if (path === "/api/marketplace/mediate" && method === "POST") {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    if (!validId(sid)) return jsonResp(401, { error: "not logged in" }); 
    const email = emailFromSid(sid); 
    if (!email) return jsonResp(401, { error: "email not found" }); 
    const norm = normalizeEmail(email);

    if (!await tryParseJson()) return jsonResp(400, { error: "bad json" });
    const { listingId, action } = body; // 'resolve' or 'undo'

    const listings = loadJson(MARKETPLACE_FILE, []);
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return jsonResp(404, { error: "listing not found" });
    if (listing.status !== 'pending') return jsonResp(400, { error: "this listing is not pending mediation" });
    if (!listing.mediator || normalizeEmail(listing.mediator) !== norm) {
      return jsonResp(403, { error: "you are not authorized as mediator for this trade" });
    }

    if (action === 'resolve') {
      listing.status = 'finalized';
      listing.finalized_at = Date.now();
      listing.updated_at = Date.now();
      saveJson(MARKETPLACE_FILE, listings);

      // Transfer coins to seller (bypass happy hour multiplier)
      const coins = loadCoins();
      const sellerNorm = normalizeEmail(listing.seller);
      coins[sellerNorm] = Number(((coins[sellerNorm] || 0) + listing.price).toFixed(4));
      saveCoins(coins);

      // Award cosmetic item to buyer
      if (listing.type === 'cosmetic' && listing.itemId) {
        const item = shopItemById(listing.itemId);
        if (item && SHOP_TYPE_CONFIG[item.costType]) {
          const cosm = loadJson(COSMETICS_FILE, {});
          const buyerNorm = normalizeEmail(listing.buyer);
          const owned = normalizeCosmetics(cosm[buyerNorm] || {});
          const bucket = SHOP_TYPE_CONFIG[item.costType].bucket;
          if (!owned[bucket].includes(listing.itemId)) {
            owned[bucket].push(listing.itemId);
          }
          cosm[buyerNorm] = owned;
          saveJson(COSMETICS_FILE, cosm);
        }
      }
      return jsonResp(200, { ok: true, message: "Transaction resolved and finalized!" });
    } else if (action === 'undo') {
      listing.status = 'undone';
      listing.updated_at = Date.now();
      saveJson(MARKETPLACE_FILE, listings);

      // Refund buyer (bypass happy hour multiplier)
      const coins = loadCoins();
      const buyerNorm = normalizeEmail(listing.buyer);
      coins[buyerNorm] = Number(((coins[buyerNorm] || 0) + listing.price).toFixed(4));
      saveCoins(coins);

      // Restore cosmetic item to seller
      if (listing.type === 'cosmetic' && listing.itemId) {
        const item = shopItemById(listing.itemId);
        if (item && SHOP_TYPE_CONFIG[item.costType]) {
          const cosm = loadJson(COSMETICS_FILE, {});
          const sellerNorm = normalizeEmail(listing.seller);
          const owned = normalizeCosmetics(cosm[sellerNorm] || {});
          const bucket = SHOP_TYPE_CONFIG[item.costType].bucket;
          if (!owned[bucket].includes(listing.itemId)) {
            owned[bucket].push(listing.itemId);
          }
          cosm[sellerNorm] = owned;
          saveJson(COSMETICS_FILE, cosm);
        }
      }
      return jsonResp(200, { ok: true, message: "Transaction undone and refunded successfully!" });
    } else {
      return jsonResp(400, { error: "invalid mediation action" });
    }
  }

  if (path === "/api/marketplace/appeal" && method === "POST") {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    if (!validId(sid)) return jsonResp(401, { error: "not logged in" }); 
    const email = emailFromSid(sid); 
    if (!email) return jsonResp(401, { error: "email not found" }); 
    const norm = normalizeEmail(email);

    if (!await tryParseJson()) return jsonResp(400, { error: "bad json" });
    const { listingId, reason } = body;

    const listings = loadJson(MARKETPLACE_FILE, []);
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return jsonResp(404, { error: "listing not found" });

    const isSeller = normalizeEmail(listing.seller) === norm;
    const isBuyer = listing.buyer && normalizeEmail(listing.buyer) === norm;
    if (!isSeller && !isBuyer) {
      return jsonResp(403, { error: "only the buyer or seller can appeal this transaction" });
    }

    listing.status = 'disputed';
    listing.updated_at = Date.now();
    saveJson(MARKETPLACE_FILE, listings);

    // Create moderator chat report
    const reports = loadJson(CHAT_REPORTS_FILE, []);
    const newReport = {
      id: 'appeal-' + listing.id,
      reason: 'Marketplace Dispute Appeal by ' + email + ': ' + String(reason || '').slice(0, 500),
      reportedBy: email,
      ts: Date.now(),
      status: 'Needs review',
      context: [
        {
          from: 'system',
          to: 'admin',
          text: `Listing ID: ${listing.id} | Seller: ${listing.seller} | Buyer: ${listing.buyer} | Item: ${listing.type === 'cosmetic' ? listing.itemId : 'Text: ' + listing.description} | Price: ${listing.price} coins | Mediator: ${listing.mediator || 'None'} | Status: disputed. Reason for appeal: ${reason}`,
          ts: Date.now(),
          reported: true
        }
      ]
    };
    reports.push(newReport);
    if (reports.length > 5000) reports.splice(0, reports.length - 5000);
    saveJson(CHAT_REPORTS_FILE, reports);

    ntfy(`Marketplace dispute appealed by ${email} for listing ${listing.id}`, { title: 'Security' });
    return jsonResp(200, { ok: true, message: "Transaction appealed to moderators successfully!" });
  }

  // Handle Global Broadcast WebSocket
  if (path === "/ws" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    const names = loadJson(NAMES_FILE, {});
    const myEmail = (names[sid] || '').toLowerCase();
    const success = server.upgrade(req, { data: { isBroadcast: true, email: myEmail } });
    if (success) return;
  }

  // Handle SSH Terminal Proxy WebSocket
  if (path === "/ssh/ws" && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    const names = loadJson(NAMES_FILE, {});
    const myEmail = (names[sid] || '').toLowerCase();
    if (!myEmail) {
      return jsonResp(401, { success: false, message: 'Authentication required' });
    }
    const success = server.upgrade(req, { data: { isSSH: true, email: myEmail } });
    if (success) return;
  }

  // ── Admin Panel Protection ──────────────────────────────────────────────────
  if (path === '/advanced-admin.html' || path === '/admin.html' || path === '/advanced-admin' || path.startsWith('/advanced-admin/')) {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!isAnyAdminId(sid)) {
      return Response.redirect('/', 302);
    }
  }

  if (path === '/moderator.html') {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!isAnyAdminId(sid)) {
      return Response.redirect('/', 302);
    }
  }

  // ── Ultimate mitch.prox routes (Premium Only) ──────────────────────────── 
  const PROXY_PATHS = ["/bare/", "/assets/", "/baremux/", "/epoxy/", "/libcurl/", "/baremod/", "/wisp/", "/scram/", "/trad/", "/jsmpeg.min.js", "/scripts"]; 
  if (path.startsWith("/ultra/") || PROXY_PATHS.some(p => path.startsWith(p))) { 
    const cookies = getCookies(req); 
    const sid = cookies["studentId"] || cookies["id"] || ""; 
    const email = emailFromSid(sid); 
    if (!email || !isPremiumEmail(email)) return jsonResp(403, { error: "Premium required to use mitch.prox" }); 
    
    // Log the visit
    logProxyVisit(email, path);

    // Handle WebSocket Upgrades
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      let wsPath = path;
      if (path === "/ultra/ws") wsPath = "/ws";
      console.log(`[proxy] Attempting WebSocket upgrade for ${email} on ${path} -> ${wsPath}`);
      const success = server.upgrade(req, { 
        data: { proxyTo: 8081, proxyPath: wsPath, email } 
      });
      if (success) {
        console.log(`[proxy] WebSocket upgrade successful for ${email}`);
        return;
      }
    } 
 
    // Handle HTTP mitch.prox forwarding 
    let targetPath = path; 
    if (path.startsWith("/ultra/")) { 
      targetPath = path.slice(6) || "/"; 
    } 
 
    try { 
      const port = 8081;
      const targetUrl = `http://127.0.0.1:${port}${targetPath}${url.search}`; 
      const proxyHeaders = new Headers(req.headers);
      proxyHeaders.set("host", `127.0.0.1:${port}`);
      for (const hopHeader of ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]) {
        proxyHeaders.delete(hopHeader);
      }
      const resp = await fetch(targetUrl, { 
        method: req.method, 
        headers: proxyHeaders, 
        body: req.body, 
        redirect: "manual" 
      }); 
      const headers = new Headers(resp.headers); 
      headers.delete("content-encoding"); 
      headers.delete("transfer-encoding"); 
      headers.delete("content-length");
      const contentType = headers.get("content-type") || "";
      if (path.startsWith("/ultra/") && method === "GET" && contentType.includes("text/html")) {
        const notice = `<style id="mitch-prox-responsibility-notice-style">
          @keyframes mitchProxNoticeIn{from{opacity:0;transform:translateY(14px) scale(.985);filter:blur(8px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
          @keyframes mitchProxNoticeOut{0%,42%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}100%{opacity:0;transform:translateY(-18px) scale(.975);filter:blur(10px);visibility:hidden}}
          #mitch-prox-responsibility-notice{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 35%,rgba(56,189,248,.18),transparent 34%),rgba(2,6,23,.78);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);pointer-events:auto;animation:mitchProxNoticeOut 4.6s cubic-bezier(.22,1,.36,1) forwards}
          #mitch-prox-responsibility-notice-card{width:min(560px,calc(100vw - 32px));border:1px solid rgba(148,163,184,.28);border-radius:18px;background:linear-gradient(135deg,rgba(15,23,42,.92),rgba(15,23,42,.72));box-shadow:0 26px 90px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.08);color:#f8fafc;padding:24px 26px;font:800 clamp(16px,2vw,22px)/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0;text-align:left;animation:mitchProxNoticeIn .55s cubic-bezier(.22,1,.36,1) both}
          #mitch-prox-responsibility-notice-card small{display:block;margin-top:10px;color:rgba(226,232,240,.68);font-size:13px;font-weight:750;text-transform:uppercase;letter-spacing:.08em}
          @media (prefers-reduced-motion:reduce){#mitch-prox-responsibility-notice,#mitch-prox-responsibility-notice-card{animation:none}#mitch-prox-responsibility-notice{opacity:0;visibility:hidden;pointer-events:none}}
        </style><div id="mitch-prox-responsibility-notice" role="status" aria-live="polite"><div id="mitch-prox-responsibility-notice-card">You are responsible for how you use this. mitch.pro is not responsible for harmful use, misuse, or attempts to bypass restrictions, security systems, or policies.<small>Access opens automatically</small></div></div><script>(function(){var n=document.getElementById("mitch-prox-responsibility-notice");if(!n)return;setTimeout(function(){n.style.pointerEvents="none";},3600);setTimeout(function(){if(n&&n.parentNode)n.parentNode.removeChild(n);},4800);}());<\/script>`;
        let html = await resp.text();
        // Scrub the word "unblocked" case-insensitively from mitch.prox Ultra responses
        html = html.replace(/unblocked/gi, (match) => {
          if (match === 'Unblocked') return 'Open';
          if (match === 'UNBLOCKED') return 'OPEN';
          return 'open';
        });
        if (!html.includes("mitch-prox-responsibility-notice")) {
          html = html.includes("</body>") ? html.replace("</body>", notice + "</body>") : html + notice;
        }
        return new Response(html, { status: resp.status, headers });
      }
      return new Response(resp.body, { status: resp.status, headers }); 
    } catch (e) { 
      return jsonResp(502, { error: "mitch.prox unreachable", details: e.message }); 
    } 
  } 


  if (path === '/api/admin/moderator-requests' && method === 'GET') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      const email = normalizeEmail(emailFromSid(sid) || '');
      const requests = loadModeratorRequests()
        .filter(req => isAdminId(sid) || normalizeEmail(req.requestedByEmail || '') === email)
        .slice(0, 250)
        .map(publicModeratorRequest);
      return jsonResp(200, { requests });
    }

    if (path === '/api/moderator/action-request' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isModeratorId(sid) || isAdminId(sid)) return jsonResp(403, { error: 'moderator approval mode only' });
      try {
        const requestEntry = createModeratorActionRequest(sid, body);
        return jsonResp(200, { ok: true, pending: true, request: requestEntry });
      } catch (err) {
        return jsonResp(err.status || 500, { error: err.message || 'request failed' });
      }
    }

    if (path === '/api/admin/moderator-requests/resolve' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      const id = String(body.id || '').trim();
      const decision = String(body.decision || '').trim().toLowerCase();
      const note = String(body.note || '').trim().slice(0, 300);
      if (!id || !['approve', 'reject'].includes(decision)) {
        return jsonResp(400, { error: 'request id and approve/reject decision required' });
      }
      const requests = loadModeratorRequests();
      const requestEntry = requests.find(req => String(req.id) === id);
      if (!requestEntry) return jsonResp(404, { error: 'request not found' });
      if (requestEntry.status !== 'pending') return jsonResp(409, { error: 'request already resolved' });
      const adminEmail = emailFromSid(sid) || 'admin';
      requestEntry.resolvedAt = Date.now();
      requestEntry.resolvedBy = adminEmail;
      requestEntry.note = note;
      if (decision === 'reject') {
        requestEntry.status = 'rejected';
        logAdminAction(adminEmail, 'moderator_request_rejected', { id, action: requestEntry.action, requestedBy: requestEntry.requestedByEmail });
        saveModeratorRequests(requests);
        return jsonResp(200, { ok: true, request: publicModeratorRequest(requestEntry) });
      }
      try {
        const result = executeModeratorApprovedAction(requestEntry.action, requestEntry.payload, adminEmail, requestEntry.requestedByEmail);
        requestEntry.status = 'approved';
        requestEntry.result = result;
        requestEntry.error = '';
        logAdminAction(adminEmail, 'moderator_request_approved', { id, action: requestEntry.action, requestedBy: requestEntry.requestedByEmail });
        saveModeratorRequests(requests);
        return jsonResp(200, { ok: true, result, request: publicModeratorRequest(requestEntry) });
      } catch (err) {
        requestEntry.status = 'failed';
        requestEntry.error = err.message || 'approval failed';
        logAdminAction(adminEmail, 'moderator_request_failed', { id, action: requestEntry.action, requestedBy: requestEntry.requestedByEmail, error: requestEntry.error });
        saveModeratorRequests(requests);
        return jsonResp(err.status || 500, { error: requestEntry.error, request: publicModeratorRequest(requestEntry) });
      }
    }

    if (path === '/api/coins/buy-premium' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      
      const COST = shopBaseCostFor(shopItemById('premium'));
      const balance = getCoins(email);
      if (balance < COST) return jsonResp(400, { error: `Insufficient coins. Need ${COST}, have ${balance.toFixed(2)}.` });
      
      if (isPremiumEmail(email)) return jsonResp(400, { error: 'You are already a Premium member!' });
      
      addCoins(email, -COST);
      const apps = applications;
      apps.unshift({
        name: email.split('@')[0], email: email.toLowerCase(),
        type: 'premium', status: 'approved', why: 'Purchased via Mitch Coins',
        submitted_at: Date.now(), approved_at: Date.now(),
      });
      saveApplications( apps);
      return jsonResp(200, { ok: true, message: 'Welcome to Premium!' });
    }

    if (path === '/api/coins/gift-premium' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      const norm = normalizeEmail(email);
      
      const targetEmail = (body.targetEmail || '').toLowerCase().trim();
      if (!targetEmail) return jsonResp(400, { error: 'Target email is required' });

      // Enforce limit of 1 gift ever
      const giftsSent = loadJson(PREMIUM_GIFTS_SENT_FILE, {});
      if (giftsSent[norm]) {
        return jsonResp(400, { error: `You have already gifted Premium to ${giftsSent[norm]}! You can only gift Premium to one person ever.` });
      }

      const COST = shopBaseCostFor(shopItemById('premium'));
      const balance = getCoins(email);
      if (balance < COST) return jsonResp(400, { error: `Insufficient coins. Need ${COST}, have ${balance.toFixed(2)}.` });
      
      if (isPremiumEmail(targetEmail)) return jsonResp(400, { error: 'That user is already a Premium member!' });
      
      addCoins(email, -COST);
      const apps = applications;
      apps.unshift({
        name: targetEmail.split('@')[0], email: targetEmail,
        type: 'premium', status: 'approved', why: `Gifted by ${email.split('@')[0]}`,
        submitted_at: Date.now(), approved_at: Date.now(),
      });
      saveApplications(apps);

      // Record gift sent
      giftsSent[norm] = targetEmail;
      saveJson(PREMIUM_GIFTS_SENT_FILE, giftsSent);

      // Send email to target user
      const emailSubject = 'You have been gifted Mitch.pro Premium! 🌟';
      const emailBody = `Hello!

Amazing news! Your friend (${email}) has gifted you a Lifetime Premium Membership to Mitch.pro!

Your Premium benefits are now fully active:
- Access to all Premium-only custom cosmetics (name colors, badges, themes, and effects).
- Access to the high-performance mitch.prox proxy (bare, wisp, ultra, etc.).
- Exclusive chat privileges and direct access to Premium features.

Head over to https://mitch.pro to check out your new Premium features!

Best,
Mitch.pro Team`;
      sendEmailBg(targetEmail, emailSubject, emailBody);

      return jsonResp(200, { ok: true, message: 'Premium gifted successfully!' });
    }

    // unified shop buy endpoint
    if (path === '/api/shop/buy' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      const norm = normalizeEmail(email);

      const { itemId } = body;
      const item = shopItemById(itemId);
      if (!item || item.type === 'premium') return jsonResp(400, { error: 'invalid shop item' });
      if (item.disabled && !isAdminEmail(email)) {
        return jsonResp(400, { error: 'This item is disabled / limited-edition and can only be bought player-to-player in the Marketplace!' });
      }
      if (item.adminOnly && !isAdminEmail(email)) {
        return jsonResp(403, { error: 'Admins and owners only.' });
      }
      if (item.premiumOnly && !isPremiumEmail(email) && !isAdminEmail(email)) {
        return jsonResp(403, { error: 'Premium required for this item.' });
      }
      const type = item.costType;
      const inventory = buildInventory(email);
      if (ownsShopItem(email, item, inventory)) return jsonResp(400, { error: 'You already own this item.' });

      const cost = shopCostFor(item, email);

      const balance = getCoins(email);
      if (balance < cost) return jsonResp(400, { error: `Insufficient coins. Need ${cost}, have ${balance.toFixed(2)}.` });

      // Check for existing ownership
      if (SHOP_TYPE_CONFIG[type]) {
        const cosm = loadJson(COSMETICS_FILE, {});
        const owned = normalizeCosmetics(cosm[norm] || {});
        const bucket = SHOP_TYPE_CONFIG[type].bucket;
        if (owned[bucket].includes(item.id)) return jsonResp(400, { error: 'You already own this item.' });
        owned[bucket].push(item.id);
        cosm[norm] = owned;
        saveJson(COSMETICS_FILE, cosm);
      } else if (type === 'ai_personality') {
        const unlocked = loadJson(UNLOCKED_AI_FILE, {});
        const mine = unlocked[norm] || [];
        if (mine.includes(item.id)) return jsonResp(400, { error: 'You already unlocked this personality.' });
        
        if (!unlocked[norm]) unlocked[norm] = [];
        unlocked[norm].push(item.id);
        saveJson(UNLOCKED_AI_FILE, unlocked);
      } else if (type === 'vip_casino_pass') {
        const stats = loadUserStats();
        if (!stats[norm]) stats[norm] = {};
        if (stats[norm].vip_casino_until > Date.now()) return jsonResp(400, { error: 'You already have an active VIP pass.' });
        stats[norm].vip_casino_until = Date.now() + (24 * 3600 * 1000);
        saveUserStats(stats);
      } else if (type === 'streak_freeze') {
        const data = dailyLogins[norm] || { lastClaimDate: '', streak: 0, streakFreezes: 0 };
        if ((data.streakFreezes || 0) >= 3) {
          return jsonResp(400, { error: 'You can only hold a maximum of 3 Streak Freezes.' });
        }
        data.streakFreezes = (data.streakFreezes || 0) + 1;
        dailyLogins[norm] = data;
        saveDailyLogins();
      } else if (type === 'happy_hour_ticket') {
        const stats = loadUserStats();
        if (!stats[norm]) stats[norm] = {};
        const currentHHUntil = stats[norm].personal_happy_hour_until || 0;
        const baseTime = Math.max(Date.now(), currentHHUntil);
        stats[norm].personal_happy_hour_until = baseTime + (30 * 60 * 1000);
        saveUserStats(stats);
      } else if (type === 'double_down_ticket') {
        const stats = loadUserStats();
        if (!stats[norm]) stats[norm] = {};
        const currentDoubleUntil = stats[norm].double_down_until || 0;
        const baseTime = Math.max(Date.now(), currentDoubleUntil);
        stats[norm].double_down_until = baseTime + (30 * 60 * 1000);
        saveUserStats(stats);
      } else if (type === 'bad_beat_insurance') {
        const stats = loadUserStats();
        if (!stats[norm]) stats[norm] = {};
        const currentInsuredUntil = stats[norm].bad_beat_insurance_until || 0;
        const baseTime = Math.max(Date.now(), currentInsuredUntil);
        stats[norm].bad_beat_insurance_until = baseTime + (30 * 60 * 1000);
        saveUserStats(stats);
      } else if (type === 'happy_hour_extension') {
        const stats = loadUserStats();
        if (!stats[norm]) stats[norm] = {};
        const currentHHUntil = stats[norm].personal_happy_hour_until || 0;
        if (currentHHUntil <= Date.now()) {
          return jsonResp(400, { error: 'You must have an active Personal Happy Hour to extend it.' });
        }
        stats[norm].personal_happy_hour_until = currentHHUntil + (15 * 60 * 1000);
        saveUserStats(stats);
      } else if (type === 'slots_free_spin') {
        const stats = loadUserStats();
        if (!stats[norm]) stats[norm] = {};
        stats[norm].slots_free_spins = (stats[norm].slots_free_spins || 0) + 5;
        saveUserStats(stats);
      }

      if (cost > 0) addCoins(email, -cost);
      return jsonResp(200, { ok: true, message: 'Purchase successful!', cost });
      }

      if (path === '/api/me/cosmetics/equip' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const norm = normalizeEmail(email);

      const { itemId, type } = body;
      const equipType = String(type || '');
      const cosm = loadJson(COSMETICS_FILE, {});
      const userCosm = sanitizeCosmeticsForEmail(email, cosm[norm] || {});

      if (SHOP_TYPE_CONFIG[equipType]) {
        const cfg = SHOP_TYPE_CONFIG[equipType];
        const nextItemId = String(itemId || '');
        const item = nextItemId ? shopItemById(nextItemId) : null;
        if (nextItemId && (!item || item.costType !== equipType)) return jsonResp(400, { error: 'invalid item' });
        if (nextItemId && item.adminOnly && !isAdminEmail(email)) return jsonResp(403, { error: 'Admins and owners only.' });
        if (nextItemId && !isAdminEmail(email) && !userCosm[cfg.bucket].includes(nextItemId)) {
          return jsonResp(403, { error: 'You do not own this item' });
        }
        userCosm[cfg.active] = nextItemId;
      } else if (equipType === 'ai_personality') {
        const nextItemId = String(itemId || '');
        const item = nextItemId ? shopItemById(nextItemId) : null;
        const unlocked = loadJson(UNLOCKED_AI_FILE, {});
        const mine = Array.isArray(unlocked[norm]) ? unlocked[norm] : [];
        if (nextItemId && (!item || item.costType !== 'ai_personality')) return jsonResp(400, { error: 'invalid item' });
        if (nextItemId && !isAdminEmail(email) && !mine.includes(nextItemId)) {
          return jsonResp(403, { error: 'You do not own this personality' });
        }
        userCosm.activeAi = nextItemId;
      } else {
        return jsonResp(400, { error: 'invalid type' });
      }

      cosm[norm] = userCosm;
      saveJson(COSMETICS_FILE, cosm);
      return jsonResp(200, { ok: true });
      }

    // POST /api/admin/trigger-daily-summary
    if (path === '/api/admin/trigger-daily-summary' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid) || !isAdminId(sid)) return jsonResp(401, { error: 'unauthorized' });

      await sendDailySummaryNotification();
      return jsonResp(200, { success: true, message: 'Daily traffic summary notification triggered successfully.' });
    }

    if (path === '/api/admin/grant-premium' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!canGrantPremiumId(sid)) return jsonResp(403, { error: 'forbidden' });

      const adminEmail = emailFromSid(sid) || 'admin';
      const targetRaw = String(body.targetEmail || '').toLowerCase().trim();
      const targetEmail = normalizeEmail(targetRaw);
      const reason = String(body.reason || 'free premium granted by admin').trim().slice(0, 200);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetRaw)) {
        return jsonResp(400, { error: 'valid target email required' });
      }
      if (isPremiumEmail(targetEmail)) return jsonResp(400, { error: 'That user is already Premium.' });
      if (!reason) return jsonResp(400, { error: 'reason required' });

      const apps = applications;
      apps.unshift({
        name: targetEmail.split('@')[0],
        email: targetRaw,
        type: 'premium',
        status: 'approved',
        grantPremium: true,
        why: `Free premium granted by ${adminEmail}: ${reason}`,
        submitted_at: Date.now(),
        approved_at: Date.now(),
        approved_by: adminEmail,
      });
      saveApplications(apps);
      const noticeTitle = 'Premium granted';
      const noticeMessage = `${adminEmail} granted you Premium. Reason: ${reason}`;
      addAdminNotification(targetRaw, noticeTitle, noticeMessage, adminEmail);
      pushAdminNotification(targetRaw, noticeTitle, noticeMessage);
      console.log(`[admin] ${adminEmail} granted free premium to ${targetEmail}: ${reason}`);
      logAdminAction(adminEmail, 'grant_premium', { targetEmail, reason });
      return jsonResp(200, { ok: true, targetEmail: targetRaw });
    }

    if (path === '/api/admin/gift-coins' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });

      const adminEmail = emailFromSid(sid) || 'admin';
      const targetRaw = String(body.targetEmail || '').toLowerCase().trim();
      const targetEmail = normalizeEmail(targetRaw);
      const amount = Number(body.amount);
      const reason = String(body.reason || 'admin gift').trim().slice(0, 160);

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetRaw)) {
        return jsonResp(400, { error: 'valid target email required' });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResp(400, { error: 'amount must be a positive number' });
      }
      if (amount > 1_000_000_000) {
        return jsonResp(400, { error: 'amount is too large' });
      }

      addCoins(targetRaw, amount);
      addCoinGiftNotice(targetRaw, amount, adminEmail, reason);
      console.log(`[admin] ${adminEmail} gifted ${amount} coins to ${targetEmail}: ${reason}`);
      logAdminAction(adminEmail, 'gift_coins', { targetEmail, targetRaw, amount, reason });
      return jsonResp(200, {
        ok: true,
        targetEmail: targetRaw,
        amount,
        newBalance: getCoins(targetRaw),
      });
      }

      // ── Advanced Admin Tools ───────────────────────────────────────────

      // GET /api/admin/economy/audit
      if (path === '/api/admin/economy/audit') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      const coins = loadCoins();
      let total = 0;
      const sorted = Object.entries(coins).sort((a,b) => b[1] - a[1]);
      sorted.forEach(e => total += e[1]);
      const top1Count = Math.ceil(sorted.length * 0.01) || 1;
      const top1Sum = sorted.slice(0, top1Count).reduce((s, e) => s + e[1], 0);
      return jsonResp(200, { 
      total, 
      topPercent: total > 0 ? (top1Sum / total) * 100 : 0, 
      richestUser: sorted[0] ? sorted[0][0] : 'none' 
      });
      }

      // POST /api/admin/economy/burn
      if (path === '/api/admin/economy/burn') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const adminEmail = emailFromSid(sid) || 'admin';
      const { email, amount } = body;
      const target = normalizeEmail(email);
      addCoins(target, -parseFloat(amount));
      logAdminAction(adminEmail, 'burn_coins', { target, amount });
      return jsonResp(200, { ok: true });
      }

      // POST /api/admin/broadcast
      if (path === '/api/admin/broadcast') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const adminEmail = emailFromSid(sid) || 'admin';
      const { msg, type } = body;
      const payload = JSON.stringify({ type: type === 'jumpscare' ? 'admin_jumpscare' : 'admin_broadcast', message: msg });
      for (const ws of allSockets) {
        if (ws.data && ws.data.isBroadcast) {
          try { ws.send(payload); } catch {}
        }
      }      logAdminAction(adminEmail, type === 'jumpscare' ? 'jumpscare' : 'broadcast', { message: msg });
      return jsonResp(200, { ok: true });
      }

    // POST /api/admin/casino/rig
    if (path === '/api/admin/casino/rig' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const chance = parseFloat(body.chance);
      if (isNaN(chance) || chance < 0 || chance > 100) return jsonResp(400, { error: 'invalid chance' });
      casinoRigChance = chance;
      logAdminAction(emailFromSid(sid) || 'admin', 'set_casino_rig', { chance });
      return jsonResp(200, { ok: true, chance });
    }



    // POST /api/admin/moderators
    if (path === '/api/admin/moderators' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const adminEmail = emailFromSid(sid) || 'admin';
      const targetRaw = String(body.email || '').trim();
      const target = normalizeEmail(targetRaw);
      const active = !!body.active;
      let mods = moderatorEmails();
      if (active) {
        if (!mods.some(m => normalizeEmail(m) === target)) mods.push(targetRaw);
      } else {
        mods = mods.filter(m => normalizeEmail(m) !== target);
      }
      await saveJson(MODERATORS_FILE, mods);
      logAdminAction(adminEmail, active ? 'add_moderator' : 'remove_moderator', { target: targetRaw });
      return jsonResp(200, { ok: true });
    }

    // GET /api/admin/moderators
    if (path === '/api/admin/moderators' && method === 'GET') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, { moderators: moderatorEmails() });
    }

    if (path === '/api/admin/moderator-panel' && method === 'GET') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, moderatorPanelConfig());
    }

    if (path === '/api/admin/moderator-panel' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const links = sanitizeModeratorPanelLinks(body.links);
      await saveJson(MODERATOR_PANEL_FILE, { links });
      logAdminAction(emailFromSid(sid) || 'admin', 'update_moderator_panel', { linkCount: links.length });
      return jsonResp(200, { ok: true, links });
    }

    // GET /api/admin/casino/rtp
    if (path === '/api/admin/casino/rtp') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, { intake: casinoIntake, payout: casinoPayout });
    }

    // GET /api/admin/resources
    if (path === '/api/admin/resources') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      const mem = process.memoryUsage();
      return jsonResp(200, { 
        memory: mem, 
        uptime: process.uptime(),
        load: os.loadavg() 
      });
    }

    // GET /api/admin/search-logs
    if (path === '/api/admin/search-logs') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, { logs: loadJson(SEARCH_INTENT_FILE, []) });
    }

    // GET /api/admin/live-feeds
    if (path === '/api/admin/live-feeds') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, { traffic: trafficFeed, bets: bettingFeed });
    }
    // POST /api/admin/economy/multiplier
    if (path === '/api/admin/economy/multiplier') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      globalCoinMultiplier = parseFloat(body.multiplier) || 1.0;
      logAdminAction(emailFromSid(sid) || 'admin', 'set_multiplier', { multiplier: globalCoinMultiplier });
      return jsonResp(200, { ok: true, multiplier: globalCoinMultiplier });
    }

    // POST /api/admin/casino/toggle
    if (path === '/api/admin/casino/toggle') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      casinoEnabled = !casinoEnabled;
      logAdminAction(emailFromSid(sid) || 'admin', 'toggle_casino', { enabled: casinoEnabled });
      return jsonResp(200, { ok: true, enabled: casinoEnabled });
    }

    // POST /api/admin/shadow-ban & /api/admin/restricted-mode
    if (path === '/api/admin/shadow-ban' || path === '/api/admin/restricted-mode') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const target = normalizeEmail(body.email);
      if (shadowBans.has(target)) shadowBans.delete(target);
      else shadowBans.add(target);
      saveShadowBans();
      const actor = emailFromSid(sid) || 'moderator';
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(actor, 'shadow_ban', {
        target,
        active: shadowBans.has(target),
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true, active: shadowBans.has(target) });
    }

    // POST /api/admin/ban-account
    if (path === '/api/admin/ban-account' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const adminEmail = emailFromSid(sid) || 'moderator';
      const emailRaw = String(body.email || '').toLowerCase().trim();
      const targetEmail = normalizeEmail(emailRaw);
      const reason = String(body.reason || 'Banned by staff').trim().slice(0, 200) || 'Banned by staff';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return jsonResp(400, { error: 'valid email required' });
      }
      if (isAdminEmail(targetEmail)) {
        return jsonResp(403, { error: 'cannot ban admins or owners from this panel' });
      }
      const bl = loadBlacklist();
      bl[targetEmail] = { reason, banned_at: Date.now(), by: adminEmail };
      saveBlacklist(bl);

      // If their last known IP isn't whitelisted, then IP ban them
      try {
        const targetIp = lastKnownIps[targetEmail];
        if (targetIp) {
          if (!WHITELISTED_IPS.has(targetIp)) {
            const bannedIps = loadBannedIps();
            bannedIps[targetIp] = {
              reason: `IP associated with banned account ${targetEmail}. Reason: ${reason}`,
              banned_at: Date.now(),
              by: adminEmail,
              email: targetEmail
            };
            saveBannedIps(bannedIps);
            console.log(`[ban] IP Banned ${targetIp} for user ${targetEmail}`);
          } else {
            console.log(`[ban] Skipping IP ban for ${targetEmail} because IP ${targetIp} is whitelisted.`);
          }
        }
      } catch (e) {
        console.error('[ban] Failed to apply IP ban:', e);
      }

      addAdminNotification(targetEmail, 'Account banned', `Your account was banned. Reason: ${reason}`, adminEmail);
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(adminEmail, 'ban_account', {
        targetEmail,
        reason,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true, targetEmail });
    }

    // POST /api/admin/unban-account
    if (path === '/api/admin/unban-account' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const adminEmail = emailFromSid(sid) || 'moderator';
      const emailRaw = String(body.email || '').toLowerCase().trim();
      const targetEmail = normalizeEmail(emailRaw);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return jsonResp(400, { error: 'valid email required' });
      }
      const bl = loadBlacklist();
      const existed = !!bl[targetEmail];
      delete bl[targetEmail];
      saveBlacklist(bl);

      // Remove any IP bans associated with this email
      try {
        const bannedIps = loadBannedIps();
        let ipBansRemoved = 0;
        for (const [ip, info] of Object.entries(bannedIps)) {
          if (info && info.email === targetEmail) {
            delete bannedIps[ip];
            ipBansRemoved++;
          }
        }
        if (ipBansRemoved > 0) {
          saveBannedIps(bannedIps);
          console.log(`[unban] Removed ${ipBansRemoved} IP ban(s) associated with ${targetEmail}`);
        }
      } catch (e) {
        console.error('[unban] Failed to remove associated IP bans:', e);
      }

      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(adminEmail, 'unban_account', {
        targetEmail,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: existed });
    }



    // GET /api/admin/prox/sessions
    if (path === '/api/admin/prox/sessions') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      try {
        const targetUrl = `http://127.0.0.1:8081/api/sessions`;
        const resp = await fetch(targetUrl);
        return new Response(resp.body, { status: resp.status, headers: resp.headers });
      } catch (e) {
        return jsonResp(502, { error: 'Stream server unreachable' });
      }
    }

    // POST /api/admin/prox/block
    if (path === '/api/admin/prox/block') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const domain = String(body.domain || '').toLowerCase().trim();
      proxBlocklist.add(domain);
      saveJson(join(BASE, 'data', 'prox_blocklist.json'), Array.from(proxBlocklist));
      const actor = emailFromSid(sid) || 'moderator';
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(actor, 'prox_block', {
        domain,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true });
    }

    // POST /api/admin/prox/unblock
    if (path === '/api/admin/prox/unblock') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const domain = String(body.domain || '').toLowerCase().trim();
      proxBlocklist.delete(domain);
      saveJson(join(BASE, 'data', 'prox_blocklist.json'), Array.from(proxBlocklist));
      const actor = emailFromSid(sid) || 'moderator';
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(actor, 'prox_unblock', {
        domain,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true });
    }

    // POST /api/admin/chat-reports/resolve
    if (path === '/api/admin/chat-reports/resolve') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const reportTs = Number(body.ts) || 0;
      const action = String(body.action || '').trim().toLowerCase(); // 'resolve' or 'delete'

      const reports = loadJson(CHAT_REPORTS_FILE, []);
      let found = false;
      
      if (action === 'delete') {
        const filtered = reports.filter(r => r.ts !== reportTs);
        saveJson(CHAT_REPORTS_FILE, filtered);
        logAdminAction(emailFromSid(sid) || 'admin', 'chat_report_delete', { ts: reportTs });
        return jsonResp(200, { ok: true, deleted: true });
      }

      const newReports = reports.map(r => {
        if (r.ts === reportTs) {
          found = true;
          return { ...r, status: 'Resolved' };
        }
        return r;
      });

      if (found) {
        saveJson(CHAT_REPORTS_FILE, newReports);
        logAdminAction(emailFromSid(sid) || 'admin', 'chat_report_resolve', { ts: reportTs });
        return jsonResp(200, { ok: true, resolved: true });
      }

      return jsonResp(404, { error: 'report not found' });
    }

    // POST /api/admin/content/mirror
    if (path === '/api/admin/content/mirror') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const newUrl = body.url;
      const sitesPath = join(BASE, 'data', 'sites');
      let contents = readFileSync(sitesPath, 'utf8');
      contents = contents.replace(/url https:\/\/docs\.google\.com\/document\/d\/[^\s]+ Mitch\.pro Mirrors/, `url ${newUrl} Mitch.pro Mirrors`);
      writeFileSync(sitesPath, contents);
      const actor = emailFromSid(sid) || 'moderator';
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(actor, 'update_mirror', {
        url: newUrl,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true });
    }

    // POST /api/admin/content/featured
    if (path === '/api/admin/content/featured') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      featuredGameHref = body.href;
      const actor = emailFromSid(sid) || 'moderator';
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(actor, 'set_featured', {
        href: featuredGameHref,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true });
    }

    // POST /api/admin/send-notification
    if (path === '/api/admin/send-notification' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });

      const adminEmail = emailFromSid(sid) || 'moderator';
      const allUsers = body.allUsers === true;
      const targetRaw = String(body.targetEmail || '').toLowerCase().trim();
      const title = String(body.title || 'Admin notification').trim().slice(0, 80);
      const message = String(body.message || '').trim().slice(0, 1000);
      const batchId = randomBytes(10).toString('hex');

      if (!allUsers && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetRaw)) {
        return jsonResp(400, { error: 'valid target email required' });
      }
      if (!message) return jsonResp(400, { error: 'message required' });

      const role = isAdminId(sid) ? 'admin' : 'moderator';
      if (allUsers) {
        const tokens = loadTokens();
        const targets = new Set();
        for (const [tok, data] of Object.entries(tokens)) {
          const email = String(data.email || '').toLowerCase().trim();
          if (!email || isRevoked(tok)) continue;
          targets.add(email);
        }
        for (const email of targets) {
          addAdminNotification(email, title || 'Admin notification', message, adminEmail, batchId);
          pushAdminNotification(email, title || 'Admin notification', message);
        }
        console.log(`[staff] ${adminEmail} sent notification to all users (${targets.size}): ${title || 'Admin notification'}`);
        logAdminAction(adminEmail, 'send_notification_all', {
          count: targets.size,
          title: title || 'Admin notification',
          batchId,
          ip: getRealIp(req),
          userAgent: req.headers.get('user-agent') || 'unknown',
          role
        });
        return jsonResp(200, { ok: true, allUsers: true, count: targets.size, batchId });
      }

      const notice = addAdminNotification(targetRaw, title || 'Admin notification', message, adminEmail, batchId);
      pushAdminNotification(targetRaw, title || 'Admin notification', message);
      console.log(`[staff] ${adminEmail} sent notification to ${targetRaw}: ${title || 'Admin notification'}`);
      logAdminAction(adminEmail, 'send_notification', {
        targetEmail: targetRaw,
        title: title || 'Admin notification',
        notificationId: notice?.id || '',
        batchId,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true, targetEmail: targetRaw, notificationId: notice?.id || '', batchId });
    }

    // POST /api/admin/unsend-notification
    if (path === '/api/admin/unsend-notification' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });

      const id = String(body.id || '').trim();
      const batchId = String(body.batchId || '').trim();
      if (!id && !batchId) return jsonResp(400, { error: 'notification id or batch id required' });

      const gifts = loadJson(COIN_GIFTS_FILE, {});
      let removed = 0;
      for (const [email, notices] of Object.entries(gifts)) {
        if (!Array.isArray(notices)) continue;
        const kept = notices.filter(notice => {
          const match = notice.kind === 'admin_notice' &&
            ((id && String(notice.id) === id) || (batchId && String(notice.batchId || '') === batchId));
          if (match) removed++;
          return !match;
        });
        gifts[email] = kept;
      }
      saveJson(COIN_GIFTS_FILE, gifts);
      const adminEmail = emailFromSid(sid) || 'moderator';
      const role = isAdminId(sid) ? 'admin' : 'moderator';
      logAdminAction(adminEmail, 'unsend_notification', {
        id,
        batchId,
        removed,
        ip: getRealIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        role
      });
      return jsonResp(200, { ok: true, removed });
    }

    if (path === '/api/admin/revoke-premium' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!canGrantPremiumId(sid)) return jsonResp(403, { error: 'forbidden' });

      const adminEmail = emailFromSid(sid) || 'admin';
      const emailRaw = String(body.email || body.targetEmail || '').toLowerCase().trim();
      const reason = String(body.reason || 'premium revoked by admin').trim().slice(0, 200);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return jsonResp(400, { error: 'valid email required' });
      }

      const norm = normalizeEmail(emailRaw);
      const apps = applications;
      let changed = false;
      for (const app of apps) {
        if (normalizeEmail(app.email || '') !== norm) continue;
        if (app.status !== 'approved' || !(app.type === 'premium' || app.grantPremium === true)) continue;
        app.status = 'revoked';
        app.revoked_at = Date.now();
        app.revoked_by = adminEmail;
        app.why_revoked = reason;
        changed = true;
      }
      if (!changed) return jsonResp(404, { error: 'active premium user not found' });
      saveApplications(apps);
      logAdminAction(adminEmail, 'revoke_premium', { targetEmail: emailRaw, reason });
      return jsonResp(200, { ok: true, targetEmail: emailRaw });
    }

  if (method === 'POST') {

    // POST /api/admin/maintenance-toggle
    if (path === '/api/admin/maintenance-toggle') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, error: 'bad json' });
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!validId(sid)) return jsonResp(401, { success: false, error: 'auth required' });
        if (!isAdminId(sid)) return jsonResp(403, { success: false, error: 'forbidden' });

        const active = body.active === true || body.active === 'true';
        softMaintenanceActive = active;
        saveJson(MAINTENANCE_FILE, { active });
        
        const adminEmail = emailFromSid(sid) || 'admin';
        logAdminAction(adminEmail, 'maintenance_toggle', { active });
        return jsonResp(200, { success: true, active });
      } catch (e) { return jsonResp(400, { success: false, error: String(e) }); }
    }

    // POST /api/admin/shop/catalog/save
    if (path === '/api/admin/shop/catalog/save') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, error: 'bad json' });
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!validId(sid)) return jsonResp(401, { success: false, error: 'auth required' });
        if (!isAdminId(sid)) return jsonResp(403, { success: false, error: 'forbidden' });

        const catalog = body.catalog;
        if (!Array.isArray(catalog)) return jsonResp(400, { success: false, error: 'catalog must be an array' });

        const adminEmail = emailFromSid(sid) || 'admin';
        const catalogPath = join(DATA_DIR, 'shop_catalog.json');
        
        if (catalog.length === 0) {
          // Reset to default
          try {
            if (existsSync(catalogPath)) {
              rmSync(catalogPath);
            }
          } catch {}
          // Reload hardcoded catalog
          SHOP_CATALOG = [
            { id: 'premium', name: 'Premium', section: 'Premium', type: 'premium', cost: 5000, desc: 'Unlock mitch.prox, Premium Chat, 2X typing/logic coin rewards, 2X Clicker/Riches offline gains, larger canvas brushes, exclusive profile frames/badges, and the epic chance to have an arcade game named after you!' },
            { id: 'neon_purple', name: 'Neon Purple Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 500, desc: 'A bright purple username for chat, profiles, and leaderboards.' },
            { id: 'electric_blue', name: 'Electric Blue Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 500, desc: 'A sharp electric-blue username style.' },
            { id: 'mint_flash', name: 'Mint Flash Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 550, desc: 'A clean mint username with a fresh glow.' },
            { id: 'rose_spark', name: 'Rose Spark Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 550, desc: 'A warm rose username style with a soft highlight.' },
            { id: 'ember_red', name: 'Ember Red Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 650, desc: 'A deep red username with a bolder presence.' },
            { id: 'void_white', name: 'Void White Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 750, desc: 'A high-contrast white username for dark pages.' },
            { id: 'gold_glow', name: 'Golden Glow Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 900, premiumOnly: true, desc: 'A premium gold username glow.' },
            { id: 'rainbow_name', name: 'Rainbow Name', section: 'Name Colors', type: 'cosmetic', costType: 'name_color', cost: 2500, adminOnly: true, desc: 'An admin-only animated rainbow username.' },
            { id: 'verified_badge', name: 'Verified Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1000, desc: 'Adds a verified check badge beside your name.' },
            { id: 'og_badge', name: 'OG Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1000, desc: 'Show that you were here early.' },
            { id: 'artist_badge', name: 'Artist Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 900, desc: 'A badge for canvas builders and pixel artists.' },
            { id: 'chess_badge', name: 'Chess Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 900, desc: 'A badge for chess regulars.' },
            { id: 'builder_badge', name: 'Builder Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 950, desc: 'A badge for people who help build the community.' },
            { id: 'lucky_badge', name: 'Lucky Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1200, desc: 'A rare-feeling badge for casino winners.' },
            { id: 'premium_star_badge', name: 'Premium Star Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 1400, premiumOnly: true, desc: 'A premium star badge for your profile and chats.' },
            { id: 'owner_fan_badge', name: 'Mitch Fan Badge', section: 'Badges', type: 'cosmetic', costType: 'chat_badge', cost: 800, desc: 'A simple badge for fans of the site.' },
            { id: 'chat_sparkles', name: 'Chat Sparkles', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 850, desc: 'Adds a subtle sparkle effect to your chat identity.' },
            { id: 'chat_shadow', name: 'Chat Shadow', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 850, desc: 'Adds a dark shadow accent to your chat identity.' },
            { id: 'chat_wave', name: 'Chat Wave', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 1000, desc: 'A gentle animated wave effect for your chat name.' },
            { id: 'chat_terminal', name: 'Terminal Chat Style', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 1100, desc: 'A monospace terminal-style chat accent.' },
            { id: 'chat_prism', name: 'Prism Chat Style', section: 'Chat Effects', type: 'cosmetic', costType: 'chat_effect', cost: 1600, premiumOnly: true, desc: 'A premium prism accent for chat.' },
            { id: 'profile_grid', name: 'Profile Grid Background', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 900, desc: 'Adds a clean grid effect to your profile.' },
            { id: 'profile_stars', name: 'Profile Starfield', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 1200, desc: 'Adds a starfield-style profile effect.' },
            { id: 'profile_scanlines', name: 'Profile Scanlines', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 950, desc: 'Adds a retro scanline texture to your profile.' },
            { id: 'profile_gold_frame', name: 'Gold Profile Frame', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 1800, premiumOnly: true, desc: 'A premium gold frame accent for your profile.' },
            { id: 'profile_neon_frame', name: 'Neon Profile Frame', section: 'Profile Effects', type: 'cosmetic', costType: 'profile_effect', cost: 1800, premiumOnly: true, desc: 'A premium neon frame accent for your profile.' },
            { id: 'focus_theme', name: 'Focus Theme', section: 'Site Themes', type: 'cosmetic', costType: 'site_theme', cost: 700, desc: 'A calm, low-distraction site accent.' },
            { id: 'arcade_theme', name: 'Arcade Theme', section: 'Site Themes', type: 'cosmetic', costType: 'site_theme', cost: 900, desc: 'A brighter arcade-style site accent.' },
            { id: 'midnight_theme', name: 'Midnight Theme', section: 'Site Themes', type: 'cosmetic', costType: 'site_theme', cost: 900, desc: 'A darker midnight accent for the site.' },
            { id: 'sarcastic_mentor', name: 'Sarcastic Mentor AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2000, desc: 'Unlock a witty assistant personality.' },
            { id: 'hacker_persona', name: 'Hacker Persona AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2000, desc: 'A movie-hacker flavored assistant voice.' },
            { id: 'study_coach', name: 'Story Mode AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 1800, desc: 'A study coach AI helper.' },
            { id: 'debug_helper', name: 'Debug Helper AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2200, desc: 'A coding-focused assistant personality.' },
            { id: 'story_mode', name: 'Story Mode AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 1800, desc: 'A more creative writing personality.' },
            { id: 'speedrun_ai', name: 'Speedrun AI', section: 'AI Personalities', type: 'ai', costType: 'ai_personality', cost: 2400, premiumOnly: true, desc: 'A premium fast-answer assistant personality.' },
            { id: 'vip_pass', name: 'VIP Casino Pass (24h)', section: 'Passes', type: 'pass', costType: 'vip_casino_pass', cost: 250, desc: 'Unlocks unlimited max bet amount in all casino games for 24 hours.' },
            { id: 'canvas_lock_pass', name: 'Canvas Lock Pass', section: 'Passes', type: 'cosmetic', costType: 'canvas_tool', cost: 1200, desc: 'Unlocks a saved canvas-tool preference toggle.' },
            { id: 'quick_access_pass', name: 'Quick Access Pass', section: 'Passes', type: 'cosmetic', costType: 'canvas_tool', cost: 800, desc: 'Unlocks a quick-access preference toggle.' },
            { id: 'daily_bonus_plus', name: 'Daily Bonus Plus', section: 'Passes', type: 'cosmetic', costType: 'canvas_tool', cost: 1500, premiumOnly: true, desc: 'Unlocks a premium daily-bonus preference toggle.' }
          ];
          logAdminAction(adminEmail, 'shop_catalog_reset', {});
        } else {
          SHOP_CATALOG = catalog;
          saveJson(catalogPath, catalog);
          logAdminAction(adminEmail, 'shop_catalog_save', { itemsCount: catalog.length });
        }
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, error: String(e) }); }
    }

    if (path === '/api/admin/passphrase-status' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) body = {};
      const passphrase = String(req.headers.get('X-Admin-Passphrase') || body.passphrase || '').trim();
      if (passphrase.length < 4) return jsonResp(400, { error: 'passphrase_too_short' });
      
      const email = emailFromSid(sid) || 'admin';
      const norm = normalizeEmail(email);
      const data = loadAdminPassphrase();
      const entry = data[norm] || {};
      
      if (!entry.hash) {
        saveAdminPassphraseForUser(norm, {
          hash: await Bun.password.hash(passphrase),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          setBy: email,
        });
        logAdminAction(email, 'set_admin_passphrase', {});
        return jsonResp(200, { ok: true, set: true });
      }
      if (!await verifyAdminPassphrase(req, passphrase)) return jsonResp(403, { error: 'invalid_passphrase' });
      return jsonResp(200, { ok: true, set: true });
    }

    if (path === '/api/admin/change-passphrase') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const current = String(req.headers.get('X-Admin-Passphrase') || '').trim();
      if (!await verifyAdminPassphrase(req, current)) return jsonResp(403, { error: 'invalid_passphrase' });
      const newPassphrase = String(body.newPassphrase || '').trim();
      if (newPassphrase.length < 4) return jsonResp(400, { error: 'passphrase_too_short' });
      
      const email = emailFromSid(sid) || 'admin';
      const norm = normalizeEmail(email);
      saveAdminPassphraseForUser(norm, {
        hash: await Bun.password.hash(newPassphrase),
        updatedAt: Date.now(),
        setBy: email,
      });
      logAdminAction(email, 'change_admin_passphrase', {});
      return jsonResp(200, { ok: true, set: true });
    }

    if (path === '/api/me/coin-gifts/read') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const norm = normalizeEmail(email);
      const ids = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
      const gifts = loadJson(COIN_GIFTS_FILE, {});
      const mine = Array.isArray(gifts[norm]) ? gifts[norm] : [];
      for (const notice of mine) {
        if (!ids.size || ids.has(String(notice.id))) notice.read = true;
      }
      gifts[norm] = mine;
      saveJson(COIN_GIFTS_FILE, gifts);
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/me/notifications/read') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const norm = normalizeEmail(email);

      const markAll = !!body.all;
      const coinGiftIds = new Set(Array.isArray(body.coinGiftIds) ? body.coinGiftIds.map(String) : []);
      const dmFroms = new Set(Array.isArray(body.dmFroms) ? body.dmFroms.map(v => normalizeEmail(v)) : []);

      const gifts = loadJson(COIN_GIFTS_FILE, {});
      const mineGifts = Array.isArray(gifts[norm]) ? gifts[norm] : [];
      let giftsChanged = false;
      for (const notice of mineGifts) {
        if (markAll || coinGiftIds.has(String(notice.id))) {
          if (!notice.read) giftsChanged = true;
          notice.read = true;
        }
      }
      if (giftsChanged) {
        gifts[norm] = mineGifts;
        saveJson(COIN_GIFTS_FILE, gifts);
      }

      const dms = loadJson(DMS_FILE, []);
      let dmsChanged = false;
      for (const m of dms) {
        if (normalizeEmail(m.to || '') !== norm || m.read) continue;
        if (markAll || dmFroms.has(normalizeEmail(m.from || ''))) {
          m.read = true;
          dmsChanged = true;
        }
      }
      if (dmsChanged) saveJson(DMS_FILE, dms);

      return jsonResp(200, { ok: true });
    }

    // /api/admin/simulate
    if (path === '/api/admin/simulate') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || '';
      const aid = cookies['adminId'] || '';
      if (!isAdminId(sid) && !isAdminId(aid)) {
        console.warn(`[admin] simulation attempt denied from ip=${ip}`);
        return jsonResp(403, { error: 'forbidden' });
      }
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return jsonResp(400, { error: 'email required' });
      
      const tokens = loadTokens();
      const norm = normalizeEmail(email);
      let targetTok = null;
      for (const [tok, d] of Object.entries(tokens)) {
        if (normalizeEmail(d.email || '') === norm) {
          targetTok = tok; break;
        }
      }
      
      const names = loadJson(NAMES_FILE, {});
      let studentId = null;
      for (const [id, em] of Object.entries(names)) {
        if (normalizeEmail(em) === norm) {
          studentId = id; break;
        }
      }

      if (!studentId) {
        if (!targetTok) {
          targetTok = randomBytes(24).toString('hex');
          tokens[targetTok] = { email, created_at: Date.now() / 1000, used: false };
          saveTokens(tokens);
        }
        const gen = tokens[targetTok].infinite ? 0 : (tokens[targetTok].gen || 0);
        studentId = makeEmailId(norm, gen);
        names[studentId] = email;
        saveJson(NAMES_FILE, names);
      }
      
      console.log(`[admin] simulation started: ${email} by ${sid ? 'admin' : 'simulated-admin'}`);
      return jsonResp(200, { token: studentId });
    }

    // /api/admin/js
    if (path === '/api/admin/js') {
      if (rateLimited('ip:' + ip, '/api/admin/js'))
        return jsonResp(429, { error: 'too many attempts' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!checkAdminPw(body.pw || '')) return jsonResp(403, { error: 'forbidden' });
      try {
        const js = readFileSync(join(BASE, 'admin', 'admin.js'));
        return new Response(js, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8',
                     'Cache-Control': 'no-store' }
        });
      } catch { return new Response('console.error("admin.js not found")',
        { headers: { 'Content-Type': 'application/javascript' } }); }
    }

    // /api/admin/data
    if (path === '/api/admin/data') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!checkAdminPw(body.pw || '')) return jsonResp(403, { error: 'forbidden' });
      const dtype = body.type || '';

      if (dtype === 'content') {
        try { const html = readFileSync(join(BASE, 'admin', 'admin_app.html'));
              return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
        catch { return new Response('<h1>admin_app.html not found</h1>',
          { headers: { 'Content-Type': 'text/html' } }); }
      }

      if (dtype === 'history') {
        const name     = body.name || '';
        const namesMap = loadJson(NAMES_FILE, {});
        const uids     = name ? new Set(Object.entries(namesMap).filter(([,v]) => v === name).map(([k]) => k)) : new Set();
        const logs     = loadJson(SESSION_LOG_FILE, []);
        const entries  = logs
          .filter(e => uids.has(String(e.id || '')))
          .map(e => ({ page: e.page || '', ts: e.timestamp || '', ip: e.ip || '' }))
          .reverse();
        return jsonResp(200, { history: entries });
      }

      if (dtype === 'users') {
        const names     = loadJson(NAMES_FILE, {});
        const logs      = loadJson(SESSION_LOG_FILE, []);
        const latestLog = {};
        for (const e of logs) {
          const uid = String(e.id || '');
          if (!uid) continue;
          try {
            const ts = Date.parse(e.timestamp) / 1000;
            if (!latestLog[uid] || ts > latestLog[uid][0]) latestLog[uid] = [ts, e.page || ''];
          } catch {}
        }
        const users = Object.entries(latestLog).map(([uid, [logts, page]]) => ({
          uid, name: names[uid] || uid.slice(0, 20), page, logts,
        }));
        users.sort((a, b) => (b.logts || 0) - (a.logts || 0));
        return jsonResp(200, { users });
      }

      if (dtype === 'suggestions') {
        const sugs  = loadJson(SUGGESTIONS_FILE, []);
        const names = loadJson(NAMES_FILE, {});
        for (const s of sugs)
          s.name = names[s.id || ''] || s.name || (s.id || '?').slice(0, 20);
        sugs.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        return jsonResp(200, { suggestions: sugs });
      }

      if (dtype === 'requests') {
        const tokens  = loadJson(TOKENS_FILE, {});
        const pending = Object.entries(tokens)
          .filter(([, d]) => !d.infinite && !(d.used && !d.claimed_domains))
          .map(([tok, d]) => ({ token: tok, email: d.email || '?', name: d.name || '',
                                enroll_ip: d.enroll_ip || '', created_at: d.created_at || 0 }));
        pending.sort((a, b) => a.created_at - b.created_at);
        const appeals    = loadJson(APPEALS_FILE, []);
        const unsubReqs  = loadJson(UNSUB_REQUESTS_FILE, []);
        const premiumMembers = applications.filter(a => a.status === 'approved' && (a.type === 'premium' || a.grantPremium));
        return jsonResp(200, { pending, appeals, unsub_requests: unsubReqs, premium_members: premiumMembers });
      }

      if (dtype === 'revoke') {
        const email = (body.email || '').trim().toLowerCase();
        if (!email) return jsonResp(400, { error: 'email required' });
        const apps = applications;
        const newApps = apps.filter(a => !(normalizeEmail(a.email || '') === normalizeEmail(email) && (a.type === 'premium' || a.grantPremium)));
        saveApplications(newApps);
        console.log(`[admin] revoked premium for ${email}`);
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'approve') {
        const { token: tok = '', email = '', action = '' } = body;
        const tokens = loadTokens();
        if (action === 'approve') {
          const newTok = randomBytes(24).toString('hex');
          tokens[newTok] = { email, created_at: Date.now() / 1000, used: false };
          if (tok in tokens) delete tokens[tok];
          saveTokens(tokens);
          const _s  = site();
          const link = `${siteUrl(email)}/claim.html?token=${newTok}`;
          sendEmailBg(email, `Your ${_s.name} Access Has Been Approved`,
            `Hi,\n\nYour access request has been approved. Click the link below to claim your account:\n\n${link}\n\nSave your token in case you need it later: ${newTok}${emailFooter()}${emailSig()}`);
          return jsonResp(200, { ok: true });
        }
        if (action === 'approve_team') {
          const newTok = randomBytes(24).toString('hex');
          tokens[newTok] = { email, created_at: Date.now() / 1000, used: false };
          if (tok in tokens) delete tokens[tok];
          saveTokens(tokens);
          // Silent: no email
          // Grant premium
          const norm = normalizeEmail(email);
          if (!applications.some(a => normalizeEmail(a.email) === norm)) {
            applications.unshift({
              name: email.split('@')[0], email: email.toLowerCase(),
              type: 'team', status: 'approved', grantPremium: true, neverExpire: true,
              why: 'Silent approved as Team via Admin', submitted_at: Date.now(), approved_at: Date.now()
            });
            saveApplications( applications);
          }
          return jsonResp(200, { ok: true });
        }
        if (action === 'deny') {
          if (tok in tokens) delete tokens[tok];
          saveTokens(tokens);
          const _s = site();
          sendEmailBg(email, `Your ${_s.name} Access Request Was Not Approved`,
            `Hi,\n\nUnfortunately, your access request to ${_s.name} was not approved at this time.\n\nIf you think this is a mistake, you can submit an appeal at:\n${siteUrl(email)}/appeal.html${emailFooter()}${emailSig()}`);
          return jsonResp(200, { ok: true });
        }
        if (action === 'blacklist') {
          const reason = body.reason || 'no reason given';
          if (tok in tokens) delete tokens[tok];
          saveTokens(tokens);
          const bl = loadJson(BLACKLIST_FILE, {});
          bl[email] = { reason, blacklisted_at: Date.now() / 1000 };
          writeFileSync(BLACKLIST_FILE, JSON.stringify(bl, null, 2));
          const _s = site();
          sendEmailBg(email, `Your ${_s.name} Access Request Was Not Approved`,
            `Hi,\n\nYour access request to ${_s.name} was not approved.\n\nReason: ${reason}${emailFooter()}${emailSig()}`);
          return jsonResp(200, { ok: true });
        }
        return jsonResp(400, { error: 'unknown action' });
      }

      if (dtype === 'appeal') {
        const { email = '', submitted_at = '', action = '' } = body;
        let appeals = loadJson(APPEALS_FILE, []);
        if (action === 'approve') {
          const revoked = loadJson(REVOKED_FILE, {});
          for (const k of Object.keys(revoked)) { if (revoked[k].email === email) delete revoked[k]; }
          saveRevoked(revoked);
          const tokens  = loadTokens();
          const newTok  = randomBytes(24).toString('hex');
          tokens[newTok] = { email, created_at: Date.now() / 1000, used: false };
          saveTokens(tokens);
          const _s  = site();
          const link = `${siteUrl(email)}/claim.html?token=${newTok}`;
          sendEmailBg(email, `Your ${_s.name} Appeal Has Been Approved`,
            `Hi,\n\nGreat news — your appeal has been approved and your access has been restored.\n\nClick the link below to claim your account:\n\n${link}\n\nSave your token in case you need it later: ${newTok}${emailFooter()}${emailSig()}`);
        }
        appeals = appeals.filter(a => !(a.email === email && String(a.submitted_at) === String(submitted_at)));
        saveAppeals(appeals);
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'unsub') {
        const { email: rawEmail = '', submitted_at = '', action = '' } = body;
        const email  = rawEmail.trim().toLowerCase();
        let reqs     = loadJson(UNSUB_REQUESTS_FILE, []);
        reqs = reqs.filter(r => !(r.email?.toLowerCase() === email && String(r.submitted_at) === String(submitted_at)));
        saveJson(UNSUB_REQUESTS_FILE, reqs);
        if (action === 'approve') {
          const unsub = loadJson(NEWSLETTER_UNSUB_FILE, []);
          if (!unsub.includes(email)) unsub.push(email);
          writeFileSync(NEWSLETTER_UNSUB_FILE, JSON.stringify([...new Set(unsub)].sort(), null, 2));
          const _s = site();
          sendEmailBg(email, `You've Been Unsubscribed from the ${_s.name} Newsletter`,
            `Hi,\n\nYou've been successfully unsubscribed from the ${_s.name} newsletter. You won't receive any further emails.\n\nIf you change your mind, you can re-subscribe at:\n${siteUrl(email)}/newsletter.html${emailSig()}`);
        } else {
          const _s = site();
          sendEmailBg(email, `Your ${_s.name} Unsubscribe Request`,
            `Hi,\n\nYour request to unsubscribe from the ${_s.name} newsletter was not processed.\n\nIf you believe this is an error, please reply to this email.${emailFooter()}${emailSig()}`);
        }
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'newsletter_list') {
        const extra    = loadJson(join(BASE, 'data', 'newsletter_extra.json'), []);
        const unsubSet = new Set(loadJson(NEWSLETTER_UNSUB_FILE, []));
        const tokens   = loadTokens();
        const emails   = []; const seen = new Set();
        for (const e of extra) {
          if (!unsubSet.has(e.toLowerCase()) && !seen.has(e.toLowerCase())) {
            seen.add(e.toLowerCase()); emails.push({ email: e, source: 'manual' });
          }
        }
        for (const d of Object.values(tokens)) {
          const e = (d.email || '').trim();
          if (e && !unsubSet.has(e.toLowerCase()) && !seen.has(e.toLowerCase())) {
            seen.add(e.toLowerCase()); emails.push({ email: e, source: 'enrolled' });
          }
        }
        emails.sort((a, b) => a.email.localeCompare(b.email));
        return jsonResp(200, { emails, count: emails.length, unsub: unsubSet.size });
      }

      if (dtype === 'newsletter_send') {
        const { subject = '', body: msgBody = '' } = body;
        if (!subject || !msgBody) return jsonResp(400, { error: 'subject and body required' });
        const extra    = loadJson(join(BASE, 'data', 'newsletter_extra.json'), []);
        const unsubSet = new Set(loadJson(NEWSLETTER_UNSUB_FILE, []));
        const tokens   = loadTokens();
        const seen     = new Set();
        const emails   = extra.filter(e => !unsubSet.has(e.toLowerCase()));
        for (const e of emails) seen.add(e.toLowerCase());
        for (const d of Object.values(tokens)) {
          const e = (d.email || '').trim();
          if (e && !unsubSet.has(e.toLowerCase()) && !seen.has(e.toLowerCase())) {
            seen.add(e.toLowerCase()); emails.push(e);
          }
        }
        for (const e of emails) sendEmailBg(e, subject, msgBody);
        return jsonResp(200, { message: `Sending to ${emails.length} recipients in background.` });
      }

      if (dtype === 'newsletter_add') {
        const email = (body.email || '').trim().toLowerCase();
        if (email) {
          const extra = loadJson(join(BASE, 'data', 'newsletter_extra.json'), []);
          if (!extra.includes(email)) extra.push(email);
          writeFileSync(join(BASE, 'data', 'newsletter_extra.json'),
            JSON.stringify([...new Set(extra)].sort(), null, 2));
        }
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'newsletter_remove') {
        const email = (body.email || '').trim().toLowerCase();
        const extra = loadJson(join(BASE, 'data', 'newsletter_extra.json'), []).filter(e => e.toLowerCase() !== email);
        writeFileSync(join(BASE, 'data', 'newsletter_extra.json'), JSON.stringify(extra, null, 2));
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'rl_list') {
        const byEp = {};
        for (const [key, ts] of Object.entries(rlLog)) {
          if (!ts.length) continue;
          const ep = key.split('::').slice(1).join('::');
          if (!byEp[ep]) byEp[ep] = { keys: 0, max_hits: 0 };
          byEp[ep].keys++;
          byEp[ep].max_hits = Math.max(byEp[ep].max_hits, ts.length);
        }
        const endpoints = Object.entries(byEp).sort().map(([ep, v]) => ({ endpoint: ep, ...v }));
        return jsonResp(200, { endpoints });
      }

      if (dtype === 'rl_reset') {
        const endpoint = body.endpoint || '';
        for (const k of Object.keys(rlLog)) { if (k.endsWith('::' + endpoint)) delete rlLog[k]; }
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'rl_reset_all') {
        for (const k of Object.keys(rlLog)) delete rlLog[k];
        return jsonResp(200, { ok: true });
      }

      if (dtype === 'gen_token') {
        const tokens = loadTokens();
        const tok    = randomBytes(24).toString('hex');
        tokens[tok]  = { email: 'admin@mitch.pro', norm_email: 'admin@mitch.pro',
                         gen: 0, created_at: Date.now() / 1000, used: false,
                         infinite: true, claim_count: 0 };
        saveTokens(tokens);
        return jsonResp(200, { url: 'https://mitch.88chan.me/claim.html?token=' + tok, token: tok });
      }

      return jsonResp(400, { error: 'unknown type' });
    }

    // /api/request-access
    // /api/login
    if (path === '/api/login') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password) {
          return jsonResp(400, { success: false, message: 'Email and password required.' });
        }
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip)) {
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        }
        if (rateLimited('ip:' + ip, path)) {
          return jsonResp(429, { success: false, message: 'Too many login attempts. Try again shortly.' });
        }

        const normEmail = normalizeEmail(email);
        const passwords = loadPasswords();
        const stored = passwords[normEmail];
        if (!stored) return jsonResp(401, { success: false, message: 'Invalid email or password.' });

        let ok = false;
        try { ok = await Bun.password.verify(password, stored); }
        catch { ok = password === stored; }
        if (!ok) return jsonResp(401, { success: false, message: 'Invalid email or password.' });

        const gens = loadGenerations();
        const genRec = gens[normEmail] || 0;
        const gen = (genRec && typeof genRec === 'object') ? (genRec.gen || 0) : (genRec || 0);
        const studentId = makeEmailId(normEmail, gen);
        const names = loadJson(NAMES_FILE, {});
        if (names[studentId] !== email) {
          names[studentId] = email;
          saveJson(NAMES_FILE, names);
        }
        return jsonResp(200, { success: true, id: studentId, email });
      } catch (e) {
        console.error('[login] failed:', e);
        return jsonResp(500, { success: false, message: 'Login failed. Try again.' });
      }
    }

    // /api/bad-passwords
    if (path === '/api/bad-passwords') {
      try {
        const badPath = join(DATA_DIR, 'bad_passwords.json');
        if (existsSync(badPath)) {
          return new Response(readFileSync(badPath, 'utf8'), { headers: { 'Content-Type': 'application/json' } });
        }
        return jsonResp(200, []);
      } catch (e) {
        return jsonResp(500, []);
      }
    }

    // /api/signup
    if (path === '/api/signup') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        let email = (body.email || '').trim().toLowerCase();
        const password = (body.password || '').trim();
        if (!email || !password)
          return jsonResp(400, { success: false, message: 'Email and password required.' });

        const pwdCheck = await isSecurePassword(password);
        if (!pwdCheck.valid)
          return jsonResp(400, { success: false, message: pwdCheck.error });

        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        if (rateLimited('ip:' + ip, path))
          return jsonResp(429, { success: false, message: 'Too many requests, slow down.' });

        const normEmail = normalizeEmail(email);
        const bl = loadBlacklist();
        if (normEmail in bl) return jsonResp(400, { success: false, message: 'Access denied.' });

        const passwords = loadPasswords();
        if (passwords[normEmail]) return jsonResp(400, { success: false, message: 'Account already exists. Please log in.' });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hash = await Bun.password.hash(password);

        const refCode = (body.refCode || '').trim().toUpperCase().slice(0, 32);
        const codes = loadJson(SIGNUP_CODES_FILE, {});
        codes[normEmail] = {
          code,
          hash,
          email,
          refCode: refCode || '',
          expires: Date.now() + (30 * 60 * 1000)
        };
        saveJson(SIGNUP_CODES_FILE, codes);

        const _s = site();
        sendEmailBg(email, `Your ${_s.name} Verification Code`,
          `Hi,\n\nYour verification code is: ${code}\n\nThis code expires in 30 minutes. Enter it on the sign-up page to complete your account setup.\n\nIf you didn't request this email, you can safely ignore it.${emailFooter()}${emailSig()}`);

        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/verify-signup
    if (path === '/api/verify-signup') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        const email = (body.email || '').trim().toLowerCase();
        const code = (body.code || '').trim();
        const normEmail = normalizeEmail(email);

        const codes = loadJson(SIGNUP_CODES_FILE, {});
        const entry = codes[normEmail];

        if (!entry || entry.code !== code)
          return jsonResp(400, { success: false, message: 'Invalid verification code.' });

        if (Date.now() > entry.expires) {
          delete codes[normEmail];
          saveJson(SIGNUP_CODES_FILE, codes);
          return jsonResp(400, { success: false, message: 'Verification code expired. Please sign up again.' });
        }

        const passwords = loadPasswords();
        passwords[normEmail] = entry.hash;
        savePasswords(passwords);

        // Create permanent token & name entry
        const tokens = loadTokens();
        const tok = randomBytes(24).toString('hex');
        tokens[tok] = { 
          email: entry.email, 
          norm_email: normEmail,
          created_at: Date.now() / 1000, 
          used: true,
          claimed_domains: [req.headers.get('Host') || 'mitch.pro']
        };
        saveTokens(tokens);

        const gens = loadGenerations();
        const gen = gens[normEmail] || 0;
        const studentId = makeEmailId(normEmail, gen);
        const names = loadJson(NAMES_FILE, {});
        names[studentId] = entry.email;
        saveJson(NAMES_FILE, names);

        delete codes[normEmail];
        saveJson(SIGNUP_CODES_FILE, codes);

        // ── Referral reward ────────────────────────────────────────────────
        try {
          const refCode = (entry.refCode || '').trim().toUpperCase();
          if (refCode) {
            const invCodes = loadJson(INVITE_CODES_FILE, {});
            // Find referrer by code (case-insensitive)
            const refNorm = Object.keys(invCodes).find(k => (invCodes[k] || '').toUpperCase() === refCode);
            if (refNorm && refNorm !== normEmail) {
              const invClaims = loadJson(INVITE_CLAIMS_FILE, {});
              if (!invClaims[normEmail]) {
                // First-time referral for this new account — pay both parties
                invClaims[normEmail] = { refNorm, ts: Date.now(), paid: true };
                saveJson(INVITE_CLAIMS_FILE, invClaims);
                addCoins(refNorm, 2000);
                addCoins(normEmail, 2000);
                sendEmailBg(refNorm,
                  '\ud83c\udf89 Your invite earned 2,000 MitchCoins!',
                  `Hi,\n\nGreat news \u2014 someone you invited just signed up for mitch.pro!\n\nYou've been awarded 2,000 MitchCoins as a thank you.\n\nKeep sharing your invite link to earn more.${emailSig()}`);
                ntfy(`Referral paid: ${refNorm} and ${normEmail} each earned 2000 coins for invite`, { title: 'Invite Reward' });
                console.log(`[invite] ${refNorm} and ${normEmail} each earned 2000 coins for referring`);
              }
            }
          }
        } catch (re) { console.error('[invite] referral reward error:', re); }

        ntfy(`New user verified: ${entry.email}`, { title: 'Signup Complete' });
        return jsonResp(200, { success: true, id: studentId });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/request-access (Repurposed for Password Reset)
    if (path === '/api/request-access') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        let email = (body.email || '').trim().toLowerCase();
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        if (rateLimited('ip:' + ip, path))
          return jsonResp(429, { success: false, message: 'Too many requests, slow down.' });

        const normEmail = normalizeEmail(email);
        const passwords = loadPasswords();
        if (!passwords[normEmail]) return jsonResp(400, { success: false, message: 'Account not found.' });

        const tokens = loadTokens();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const token = randomBytes(24).toString('hex');

        tokens[token] = { 
          email, 
          norm_email: normEmail, 
          otp,
          created_at: Date.now() / 1000, 
          expires: Date.now() + (30 * 60 * 1000),
          used: false,
          type: 'reset'
        };
        saveTokens(tokens);

        const _s = site();
        sendEmailBg(email, `Your ${_s.name} Reset Code`,
          `Hi,\n\nYour 6-digit password reset code is: ${otp}\n\nThis code expires in 30 minutes. Enter it on the reset page to set a new password.\n\nIf you didn't request this email, you can safely ignore it.${emailFooter()}${emailSig()}`);

        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }
    // /api/newsletter-signup
    if (path === '/api/newsletter-signup') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        const studentId = (body.studentId || '').trim();
        if (!validId(studentId) || isInvalidated(studentId) || isRevoked(studentId))
          return jsonResp(403, { success: false, message: 'Not signed in.' });
        const email = (body.email || '').trim().toLowerCase();
        if (!/^[a-z0-9._%+\-]+@student\.rjuhsd\.us$/.test(email) || email.length > 254)
          return jsonResp(400, { success: false, message: 'Invalid email ending.' });
        if (emailHasProfanity(email)) return jsonResp(200, { success: true });
        const EXTRA_FILE = join(BASE, 'data', 'newsletter_extra.json');
        const extra      = loadJson(EXTRA_FILE, []);
        const norm       = normalizeEmail(email);
        const existNorms = new Set(extra.map(e => normalizeEmail(e)));
        if (existNorms.has(norm)) return jsonResp(200, { success: true, already: true });
        extra.push(email);
        saveJson(EXTRA_FILE, [...new Set(extra)].sort());
        const _s = site();
        sendEmailBg(email, `You're Signed Up for the ${_s.name} Newsletter`,
          `Hi,\n\nYou're now subscribed to the ${_s.name} newsletter. You'll receive updates when new games or features are added.\n\nTo unsubscribe at any time, visit:\n${siteUrl(email)}/unsubscribe.html?email=${encodeURIComponent(email)}${emailSig()}`);
        ntfy(email, { title: 'Newsletter Signup' });
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // ── Invite system ─────────────────────────────────────────────────────────

    // POST /api/invite/set-code — premium users set custom code
    if (path === '/api/invite/set-code' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false });
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!validId(sid)) return jsonResp(401, { success: false, error: 'auth required' });
        const email = emailFromSid(sid);
        if (!email) return jsonResp(401, { success: false, error: 'identity missing' });
        if (!isPremiumEmail(email)) return jsonResp(403, { success: false, error: 'Premium only' });

        const norm = normalizeEmail(email);
        let desired = (body.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
        if (!desired || desired.length < 3) return jsonResp(400, { success: false, error: 'Code must be 3–20 alphanumeric characters.' });

        // Check uniqueness
        const invCodes = loadJson(INVITE_CODES_FILE, {});
        const taken = Object.entries(invCodes).find(([k, v]) => v.toUpperCase() === desired && k !== norm);
        if (taken) return jsonResp(409, { success: false, error: 'That code is already taken. Try another.' });

        invCodes[norm] = desired;
        saveJson(INVITE_CODES_FILE, invCodes);
        return jsonResp(200, { success: true, code: desired });
      } catch (e) { return jsonResp(400, { success: false }); }
    }

    // POST /api/invite/send — send invite email to a friend
    if (path === '/api/invite/send' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false });
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!validId(sid)) return jsonResp(401, { success: false, error: 'auth required' });
        const email = emailFromSid(sid);
        if (!email) return jsonResp(401, { success: false, error: 'identity missing' });
        const norm = normalizeEmail(email);

        const toEmail = (body.to || '').trim().toLowerCase();
        if (!toEmail || !/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(toEmail))
          return jsonResp(400, { success: false, error: 'Invalid email address.' });
        if (normalizeEmail(toEmail) === norm)
          return jsonResp(400, { success: false, error: "You can't invite yourself." });

        // Get inviter's code
        const invCodes = loadJson(INVITE_CODES_FILE, {});
        let code = invCodes[norm];
        if (!code) {
          code = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12)
               + Math.floor(Math.random() * 900 + 100).toString();
          invCodes[norm] = code;
          saveJson(INVITE_CODES_FILE, invCodes);
        }

        // Track sent invites (dedup — don't spam same person)
        const invSent = loadJson(INVITE_SENT_FILE, {});
        if (!invSent[norm]) invSent[norm] = [];
        const alreadySent = invSent[norm].includes(normalizeEmail(toEmail));

        const inviteLink = `https://mitch.pro/enroll?ref=${encodeURIComponent(code)}&email=${encodeURIComponent(toEmail)}`;
        const _s = site();
        const senderDisplay = email.split('@')[0];

        if (!alreadySent) {
          invSent[norm].push(normalizeEmail(toEmail));
          saveJson(INVITE_SENT_FILE, invSent);
        }

        sendEmailBg(toEmail,
          `${senderDisplay} invited you to join ${_s.name}`,
          `Hi,\n\n${senderDisplay} thinks you'd enjoy mitch.pro — a student site with games, tools, MitchCoins, and more.\n\nJoin using their invite link and you'll both earn 2,000 MitchCoins when you sign up:\n\n${inviteLink}\n\nJust pick a password and you're in.${emailFooter()}${emailSig()}`);

        console.log(`[invite] ${email} sent invite to ${toEmail}`);
        return jsonResp(200, { success: true, alreadySent });
      } catch (e) { return jsonResp(400, { success: false }); }
    }

    // /api/suggest
    if (path === '/api/suggest') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        const userId  = (body.id || '').trim();
        const sugType = (body.type || 'general').trim().slice(0, 50);
        const text    = (body.text || '').trim().slice(0, 2000);
        if (!text) return jsonResp(400, { success: false, message: 'Empty.' });
        if (userId && rateLimited(userId, path))
          return jsonResp(429, { success: false, message: 'Too many requests.' });
        const names = loadJson(NAMES_FILE, {});
        const entry = { id: userId, name: names[userId] || userId.slice(0, 12), type: sugType, text, ts: Date.now() / 1000 };
        const sugs  = loadJson(SUGGESTIONS_FILE, []);
        sugs.push(entry);
        saveJson(SUGGESTIONS_FILE, sugs); const em = emailFromSid(userId); if (em) addCoins(em, 20);
        const typeLabels = { feedback: 'Feedback', add_page: 'Page Suggestion', broken_game: 'Broken Game Report' };
        const label      = typeLabels[sugType] || 'Suggestion';
        const name       = entry.name || userId.slice(0, 8) || 'anonymous';
        ntfy(`${name}: ${text.slice(0, 100)}`, { title: label });
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/newsletter/unsubscribe-secure
    if (path === '/api/newsletter/unsubscribe-secure' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        // Bypassing Google reCAPTCHA as the unsubscribe flow now uses the interactive worldshardestcaptcha.com iframe.
        // We maintain cryptographic security by strictly verifying the user's password below.
        
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!checkPasswordCookie(req)) return jsonResp(401, { success: false, message: 'Auth required. Please log in again.' });

        const email = emailFromSid(sid);
        const norm = normalizeEmail(email);
        const password = body.password;

        if (!password) return jsonResp(400, { success: false, message: 'Password required.' });

        const passwords = loadPasswords();
        const stored = passwords[norm];
        if (!stored || !(await Bun.password.verify(password, stored)))
          return jsonResp(401, { success: false, message: 'Incorrect password.' });

        // Perform unsubscription
        const unsub = loadJson(NEWSLETTER_UNSUB_FILE, []);
        const lowEmail = email.toLowerCase().trim();
        if (!unsub.includes(lowEmail)) {
          unsub.push(lowEmail);
          saveJson(NEWSLETTER_UNSUB_FILE, [...new Set(unsub)].sort());
        }

        ntfy(`${email} unsubscribed (verified)`, { title: 'Newsletter' });
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/newsletter/unsubscribe-direct
    if (path === '/api/newsletter/unsubscribe-direct' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const email = body.email;
        const token = body.token;
        if (!email) return jsonResp(400, { success: false, message: 'Email required.' });
        if (!token) return jsonResp(400, { success: false, message: 'Unsubscribe token required.' });

        const normEmail = email.toLowerCase().trim();

        // Load and verify the unsubscribe token
        const tokensPath = join(BASE, 'data', 'unsubscribe_tokens.json');
        let unsubTokens = {};
        try { unsubTokens = loadJson(tokensPath, {}); } catch(e) {}

        const expectedToken = unsubTokens[normEmail];
        if (!expectedToken || expectedToken !== token) {
          return jsonResp(403, { success: false, message: 'Invalid or expired unsubscribe token.' });
        }

        const unsub = loadJson(NEWSLETTER_UNSUB_FILE, []);
        if (!unsub.includes(normEmail)) {
          unsub.push(normEmail);
          saveJson(NEWSLETTER_UNSUB_FILE, [...new Set(unsub)].sort());
        }

        // Invalidate token after successful unsubscribe
        delete unsubTokens[normEmail];
        saveJson(tokensPath, unsubTokens);

        ntfy(`${email} unsubscribed (direct link)`, { title: 'Newsletter' });
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/claim-token
    if (path === '/api/claim-token') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        let domain = (body.domain || '').trim().toLowerCase().split(':')[0];
        if (!domain) domain = (req.headers.get('Host') || 'unknown').split(':')[0];
        const token   = (body.token || '').trim();
        const tokens  = loadTokens();
        
        let entry = tokens[token];
        let tokenKey = token;
        
        // If not found directly, check if it's a 6-digit OTP code for a reset token
        if (!entry && /^\d{6}$/.test(token)) {
          const found = Object.entries(tokens).find(([k, t]) => 
            t.type === 'reset' && t.otp === token && !t.used && (t.expires ? Date.now() < t.expires : true)
          );
          if (found) {
            tokenKey = found[0];
            entry = found[1];
          }
        }

        if (!entry) return jsonResp(400, { success: false, message: 'Invalid token' });
        const infinite = entry.infinite || false;
        
        const email     = entry.email;
        const normEmail = entry.norm_email || normalizeEmail(email);
        
        // If it's a password reset token, save the new password and E2E keys
        if (entry.type === 'reset') {
          const newPassword = (body.password || '').trim();
          if (!newPassword) {
            return jsonResp(400, { success: false, message: 'Password is required.' });
          }
          const pwdCheck = await isSecurePassword(newPassword);
          if (!pwdCheck.valid) {
            return jsonResp(400, { success: false, message: pwdCheck.error });
          }
          const hash = await Bun.password.hash(newPassword);
          const passwords = loadPasswords();
          passwords[normEmail] = hash;
          savePasswords(passwords);

          entry.used = true;
          entry.used_at = Date.now() / 1000;
        } else if (!infinite) {
          if (entry.used && !entry.claimed_domains)
            return jsonResp(400, { success: false, message: 'Token already used' });
          if (Date.now() / 1000 - (entry.created_at || 0) > 1209600)
            return jsonResp(400, { success: false, message: 'Token expired (14d)' });
          if (!entry.claimed_domains) entry.claimed_domains = {};
          if (domain in entry.claimed_domains)
            return jsonResp(400, { success: false, message: 'Already claimed on this domain' });
          entry.claimed_domains[domain] = Date.now() / 1000;
        } else {
          entry.claim_count = (entry.claim_count || 0) + 1;
        }
        saveTokens(tokens);
        const gen       = entry.infinite ? 0 : (entry.gen || 0);
        const studentId = makeEmailId(normEmail, gen);
        const names     = loadJson(NAMES_FILE, {});
        if (!(studentId in names)) {
          names[studentId] = email;
          saveJson(NAMES_FILE, names);
        }
        if (infinite) addUnlimitedId(studentId);
        return jsonResp(200, { success: true, id: studentId, email });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/e2e/join
    if (path === '/api/e2e/join') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const nick   = (body.nickname || '').replace(/[^a-zA-Z0-9_@._-]/g, '').slice(0, 50);
        const pubKey = body.pubKey || '';
        const cookies = getCookies(req);
        const sid    = cookies['studentId'] || '';
        const names  = loadJson(NAMES_FILE, {});
        const email  = (sid && names[sid] ? names[sid] : '').toLowerCase();
        for (const s of BAD_NICS) { if (nick.toLowerCase().includes(s)) return jsonResp(400, { success: false, message: 'Bad Name' }); }
        if (!nick || !pubKey) return jsonResp(400, { success: false, message: 'Invalid' });
        const { priv, pubHex } = await genServerKeypair();
        e2eUsers[nick] = { pub_key: pubKey, priv_key: priv, server_pub_hex: pubHex,
                           last_seen: Date.now(), email };
        return jsonResp(200, { success: true, nickname: nick, serverPubKey: pubHex });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/e2e/heartbeat
    if (path === '/api/e2e/heartbeat') {
      try {
        if (!await tryParseJson()) return jsonResp(200, { success: true });
        const nick = body.nickname || '';
        if (nick in e2eUsers) e2eUsers[nick].last_seen = Date.now();
      } catch {}
      return jsonResp(200, { success: true });
    }

    // /api/e2e/register-key
    if (path === '/api/e2e/register-key' && method === 'POST') {
      try {
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { success: false, message: 'Auth required' });
        const names = loadJson(NAMES_FILE, {});
        const email = (names[sid] || '').toLowerCase().trim();
        if (!email) return jsonResp(403, { success: false, message: 'Email not found' });
        
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const { pubKeyHex, encryptedPrivateJwk, ivHex } = body;
        if (!pubKeyHex || !encryptedPrivateJwk || !ivHex) {
          return jsonResp(400, { success: false, message: 'Missing fields' });
        }
        
        const e2eKeysData = loadJson(E2E_KEYS_FILE, {});
        const norm = normalizeEmail(email);
        e2eKeysData[norm] = {
          pubKeyHex,
          encryptedPrivateJwk,
          ivHex,
          updatedAt: Date.now()
        };
        saveJson(E2E_KEYS_FILE, e2eKeysData);
        
        return jsonResp(200, { success: true });
      } catch (e) {
        return jsonResp(500, { success: false, message: String(e) });
      }
    }

    // /api/e2e/get-key
    if (path === '/api/e2e/get-key' && method === 'GET') {
      try {
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { success: false, message: 'Auth required' });
        const names = loadJson(NAMES_FILE, {});
        const email = (names[sid] || '').toLowerCase().trim();
        if (!email) return jsonResp(403, { success: false, message: 'Email not found' });
        
        const e2eKeysData = loadJson(E2E_KEYS_FILE, {});
        const norm = normalizeEmail(email);
        const entry = e2eKeysData[norm];
        if (!entry) {
          return jsonResp(404, { success: false, message: 'Not found' });
        }
        return jsonResp(200, {
          success: true,
          pubKeyHex: entry.pubKeyHex,
          encryptedPrivateJwk: entry.encryptedPrivateJwk,
          ivHex: entry.ivHex
        });
      } catch (e) {
        return jsonResp(500, { success: false, message: String(e) });
      }
    }

    // /api/e2e/verify-password
    if (path === '/api/e2e/verify-password' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { success: false, message: 'Auth required' });
        const names = loadJson(NAMES_FILE, {});
        const email = (names[sid] || '').toLowerCase().trim();
        if (!email) return jsonResp(403, { success: false, message: 'Email not found' });
        
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const password = body.password || '';
        if (!password) return jsonResp(400, { success: false, message: 'Password required' });
        
        const passwords = loadPasswords();
        const stored = passwords[normalizeEmail(email)];
        if (!stored || !(await Bun.password.verify(password, stored))) {
          return jsonResp(401, { success: false, message: 'Incorrect password' });
        }
        return jsonResp(200, { success: true });
      } catch (e) {
        return jsonResp(500, { success: false, message: String(e) });
      }
    }

    // /api/pass
    if (path === '/api/pass') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const cookies = getCookies(req);
        let hash = (body.hash || cookies['studentId'] || cookies['id'] || '').trim();

        if (checkPasswordCookie(req, hash)) {
          const email = emailFromSid(hash);
          let contents = '';
          try { contents = readFileSync(join(BASE, 'data', 'sites'), 'utf8'); } catch {}
          const aid = cookies['adminId'] || '';
          const admin = isAdminId(hash);
          const realAdmin = admin || isAdminId(aid);
          const premium = isPremiumEmail(email);
          return jsonResp(200, { success: true, content: filterSites(contents, admin, realAdmin, premium) });
        }
        
        // Detailed failure reasons for the UI
        if (!hash || !validId(hash)) return jsonResp(200, { success: false, error: 'no_valid_token' });
        const ban = bannedInfoForSid(hash);
        if (ban) return jsonResp(200, { success: false, banned: true, reason: ban.reason || 'Banned' });
        const email = emailFromSid(hash);
        if (!email || !loadPasswords()[normalizeEmail(email)]) {
           return jsonResp(200, { success: false, error: 'password_required', email });
        }
        return jsonResp(200, { success: false, error: 'unauthorized' });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/log-click (Heatmap)
    if (path === '/api/log-click' && method === 'POST') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
        const { page, x, y } = body;
        if (!page || typeof x !== 'number' || typeof y !== 'number') return jsonResp(400, { error: 'invalid data' });
        
        let heatmap = loadJson(HEATMAP_FILE, {});
        if (!heatmap[page]) heatmap[page] = [];
        heatmap[page].push({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
        if (heatmap[page].length > 1000) heatmap[page] = heatmap[page].slice(-1000);
        
        saveJson(HEATMAP_FILE, heatmap);
        return jsonResp(200, { ok: true });
      } catch (e) { return jsonResp(400, { error: String(e) }); }
    }

let gamesCache = null // massive import // final library refresh // force refresh // force reload;
function loadAllGamesList() {
  if (gamesCache) return gamesCache;
  const list = [];
  const seen = new Set();
  const files = [GAMES_FILE, GAMES_LOCAL_FILE, GAMES_EXTERNAL_FILE];
  for (const f of files) {
    try {
      if (!existsSync(f)) continue;
      const text = readFileSync(f, 'utf8');
      text.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;
        const parts = line.split(' ');
        if (parts.length < 3) return;
        const href = parts[1];
        if (seen.has(href)) return;
        seen.add(href);
        list.push({ type: parts[0], href, label: parts.slice(2).join(' ') });
      });
    } catch {}
  }
  gamesCache = list;
  return list;
}

    // /api/games
    if (path === '/api/games') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const cookies = getCookies(req);
        const hash = (body.hash || cookies['studentId'] || cookies['id'] || '').trim();

        if (checkPasswordCookie(req, hash)) {
          // If body contains reload:true, clear cache
          if (body.reload) gamesCache = null;

          const all = loadAllGamesList();
          const query = String(body.q || '').trim().toLowerCase();
          const category = String(body.cat || '').trim().toLowerCase();
          const offset = parseInt(body.offset) || 0;
          const limit = parseInt(body.limit) || 50;

          let filtered = all;
          
          // 1. Filter by Category
          if (category && category !== 'all') {
            const cats = loadJson(GAME_CATEGORIES_FILE, {});
            Object.assign(cats, loadJson(GAME_CATEGORIES_LOCAL, {}));
            Object.assign(cats, loadJson(GAME_CATEGORIES_EXTERNAL, {}));
            filtered = filtered.filter(g => {
              const c = cats[g.href] || cats[g.href.replace(/^\/games\//, '')] || 'other';
              return c.toLowerCase() === category;
            });
          }

          // 2. Filter by Search Query
          if (query) {
            filtered = filtered.filter(g => g.label.toLowerCase().includes(query));
          }

          const total = filtered.length;
          const chunk = filtered.slice(offset, offset + limit);
          
          let featured = '';
          if (offset === 0 && !query && (category === 'all' || !category)) {
            featured = all.slice()
              .sort((a,b) => {
                const va = globalGameStats[a.href] || globalGameStats[a.href.replace(/^\/games\//, '')] || 0;
                const vb = globalGameStats[b.href] || globalGameStats[b.href.replace(/^\/games\//, '')] || 0;
                return vb - va;
              })
              .slice(0, 8)
              .map(g => {
                let href = g.href;
                if (href.startsWith('https://html5.gamemonetize.co/')) {
                  href = href.replace('https://html5.gamemonetize.co/', '/proxy/gamemonetize/');
                }
                return `${g.type} ${href} ${g.label}`;
              }).join('\n');
          }

          // Convert back to text format for frontend compatibility
          const content = chunk.map(g => {
            let href = g.href;
            if (href.startsWith('https://html5.gamemonetize.co/')) {
              href = href.replace('https://html5.gamemonetize.co/', '/proxy/gamemonetize/');
            }
            return `${g.type} ${href} ${g.label}`;
          }).join('\n');

          return jsonResp(200, { 
            success: true, 
            content: content, 
            featured: featured,
            total: total,
            offset: offset,
            limit: limit,
            hasMore: (offset + limit) < total
          });
        }
        
        if (!hash || !validId(hash)) return jsonResp(200, { success: false, error: 'no_valid_token' });
        const email = emailFromSid(hash);
        if (!email || !loadPasswords()[normalizeEmail(email)]) {
           return jsonResp(200, { success: false, error: 'password_required', email });
        }
        return jsonResp(200, { success: false, error: 'unauthorized' });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/migrateid
    if (path === '/api/migrateid') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const old = qs.get('old') || '';
      if (validId(old)) return jsonResp(200, { id: old });
      if (!old) return jsonResp(200, { id: makeId() });
      if (!/^[a-z0-9]{8,40}$/.test(old)) return jsonResp(200, { id: makeId() });
      const newId = makeId();
      // Migrate names.json
      try {
        const names = loadJson(NAMES_FILE, {});
        if (old in names) { names[newId] = names[old]; delete names[old]; saveJson(NAMES_FILE, names); }
      } catch {}
      // Migrate session log
      try {
        const logs = loadJson(SESSION_LOG_FILE, []);
        let changed = false;
        for (const e of logs) { if (e.id === old) { e.id = newId; changed = true; } }
        if (changed) saveJson(SESSION_LOG_FILE, logs);
      } catch {}
      return jsonResp(200, { id: newId });
    }

    // /api/ping
    if (path === '/api/ping') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false });
        const id   = body.id || '';
        let page = body.page || '';
        if (page.startsWith('/proxy/gamemonetize/')) {
          page = page.replace('/proxy/gamemonetize/', 'https://html5.gamemonetize.co/');
        }
        const category = body.category || 'Utilities';

        try {
          const now = Date.now();
          trafficHistory.push(now);
          if (trafficHistory.length > 500) trafficHistory.shift();

          const logKey = `${id}:${page}`;
          const lastTs = lastLoggedPing.get(logKey) || 0;
          if (now - lastTs > 600000) {
            // Only store anonymous session presence — no ip or page for privacy
            const logEntry = { id, timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
            const logs = loadJson(SESSION_LOG_FILE, []);
            logs.push(logEntry);
            if (logs.length > 50000) logs.splice(0, logs.length - 50000);
            saveJson(SESSION_LOG_FILE, logs);

            // Game play counts (page only, no user identity stored)
            try { updateGlobalGameStats(page); } catch {}

            lastLoggedPing.set(logKey, now);
          }

          // Playtime Rewards (1 coin per 5m)
          const isGame = (page.includes('/games/') || page.startsWith('https://html5.gamemonetize.co/')) && page !== '/games/' && !page.includes('index.html');
          if (id && isGame) {
            const state = userPlaytime.get(id) || { ts: now, total: 0 };
            const delta = now - state.ts;
            // Anti-AFK: Only count if last ping was within 2 minutes
            if (delta > 0 && delta < 120000) {
              state.total += delta;
              if (state.total >= PLAYTIME_COIN_INTERVAL) {
                const email = emailFromSid(id);
                if (email) {
                  addCoins(email, 1.0);
                  console.log(`[economy] ${email} earned 1 coin for playtime`);
                }
                state.total -= PLAYTIME_COIN_INTERVAL;
              }
            }
            state.ts = now;
            userPlaytime.set(id, state);
          }

          const email = emailFromSid(id);
          logTraffic(email || id.slice(0, 8), page);
        } catch {}
        if (id && validId(id)) {
          const email = emailFromSid(id);
          if (email) {
            let playingGame = '';
            const pageLower = String(page || '').toLowerCase();
            if (pageLower.includes('/games/chess/')) playingGame = 'Chess';
            else if (pageLower.includes('/games/casino/') || pageLower.includes('/casino/')) playingGame = 'Casino';
            else if (pageLower.includes('/canvas/')) playingGame = 'Canvas';
            else if (pageLower.includes('/encrypt.html') || pageLower.includes('/encrypt/')) playingGame = 'Chat';
            else if (pageLower.includes('/games/')) {
              const matches = page.match(/\/games\/([^/]+)/);
              playingGame = matches ? matches[1] : 'Games';
            }
            touchUserPresence(email, playingGame || page);
          }
          const now          = Date.now() / 1000;
          const last         = sessionLastSeen[id] || 0;
          const isNewSession = (now - last) > SESSION_GAP;
          sessionLastSeen[id] = now;
          if (isNewSession) {
            const names = loadJson(NAMES_FILE, {});
            const cookies = getCookies(req);
            const sid = cookies['studentId'] || '';
            const aid = cookies['adminId'] || '';
            
            if (!names[id]) {
              // link tracking id to email via studentId cookie if not yet named
              if (sid && validId(sid) && names[sid]) {
                names[id] = names[sid];
                saveJson(NAMES_FILE, names);
              }
            }
            const name  = (aid && isAdminId(aid)) ? 'simulate' : (names[id] || id.slice(0, 12));
            const pg    = page.replace('https://mitch.pro','').replace('https://mitch.88chan.me','') || '/';
            if (name.includes('@')) nudgeClear(name);
          }
        }
        const em = emailFromSid(id);
        if (em) {
          const norm = normalizeEmail(em);
          if (!userStats[norm]) userStats[norm] = {};

          // Item 1: Playtime per category
          if (!userStats[norm].playtime) userStats[norm].playtime = {};
          userStats[norm].playtime[category] = (userStats[norm].playtime[category] || 0) + 1;

          const lastReward = userStats[norm].last_ping_reward || 0;
          const now = Date.now();
          if (now - lastReward >= 60000) { 
            addCoins(em, 0.25);
            userStats[norm].last_ping_reward = now;
          }
          if (now - (userStats[norm].last_active_at || 0) >= 10000) {
            userStats[norm].last_active_at = now;
          }
          saveUserStats(userStats);
        }        let challenges = [];
        if (em) {
          challenges = Object.values(cvChallenges)
            .filter(c => c.to === normalizeEmail(em))
            .map(c => ({ from: c.from, type: "c".type, id: c.id }));
        }

        return jsonResp(200, { success: true, challenges });
        } catch { return jsonResp(400, { success: false }); }
        }
    // /api/content
    if (path === '/api/content') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
        const hash    = body.hash || '';
        let reqPath   = (new URL(body.path || '', 'http://x')).pathname.replace(/^\//, '');
        if (!reqPath || reqPath.endsWith('/')) reqPath = reqPath + 'index.html';

        let authed = false, revoked = false;
        if (validId(hash)) {
          if (isRevoked(hash))     revoked = true;
          else if (!isInvalidated(hash)) authed = true;
        }
        if (!authed && !revoked) {
          const HASHES = loadJson(HASHES_FILE, ['ff71837a707b6fbf2fedd5a509b8ccce0c8c8040fad8eff8c83b6a2cf3bba70d']);
          if (HASHES.includes(hash)) authed = true;
        }

        if (revoked) return jsonResp(200, { content: errorPage(403, 'Access Revoked',
          'Your access has been revoked. If you think this is a mistake, you can '
          + '<a href="/appeal.html">submit an appeal<\/a>.'), revoked: true });
        if (!authed) return jsonResp(200, { content: errorPage(401, 'Not Enrolled',
          'You need an access token to view this page. '
          + '<a href="/enroll.html">Request access<\/a> or '
          + '<a href="/claim.html">claim a token<\/a>.') });

        const filePath = join(WEBROOT, reqPath);
        if (!existsSync(filePath)) return jsonResp(200, { content: errorPage(404, 'Page Not Found',
          `<code>${reqPath}<\/code> does not exist. <a href="/">Go home<\/a>.`) });

        const cookies = getCookies(req);
        const adminCookie = cookies['adminId'] || '';
        const isRealAdmin = isAnyAdminId(hash) || isAnyAdminId(adminCookie);
        if (reqPath.startsWith('simulate/') && !isRealAdmin) {
          return jsonResp(200, { content: errorPage(403, 'Forbidden', 'This tool is restricted to administrators.') });
        }

        let contents = readFileSync(filePath, 'utf8');

        // Inject server-side premium flag into canvas and chess
        const isCanvas = reqPath === 'canvas/' || reqPath === 'canvas/index.html';
        const isChess = reqPath === 'games/chess-bot/' || reqPath === 'games/chess-bot/index.html';
        if (isCanvas || isChess) {
          const email = emailFromSid(hash);
          const premiumVal = email ? isPremiumEmail(email) : false;
          // We use var so it hoists and can be checked anywhere on the page
          const inject = `<script>var IS_PREMIUM = ${premiumVal};<\/script>`;
          const hi = contents.indexOf('<\/head>');
          contents = hi >= 0 ? contents.slice(0, hi) + inject + contents.slice(hi) : inject + contents;
        }
        const syncTag  = '<script src="/sync.js" defer><\/script>';
        if (!contents.includes(syncTag)) {
          const bi = contents.lastIndexOf('<\/body>');
          contents = bi >= 0 ? contents.slice(0, bi) + syncTag + contents.slice(bi) : contents + syncTag;
        }
        const asstTag = '<script src="/assistant.js" defer><\/script>';
        if (!contents.includes('<script src="/assistant.js" defer><\/script>')) {
          const bi = contents.lastIndexOf('<\/body>');
          contents = bi >= 0 ? contents.slice(0, bi) + asstTag + contents.slice(bi) : contents + asstTag;
        }
        const bcastTag = '<script src="/broadcast.js" defer><\/script>';
        if (!contents.includes(bcastTag)) {
          const bi = contents.lastIndexOf('<\/body>');
          contents = bi >= 0 ? contents.slice(0, bi) + bcastTag + contents.slice(bi) : contents + bcastTag;
        }
        const agreeTag = '<div id="_agree_footer" style="position:fixed;bottom:5px;left:0;right:0;text-align:center;pointer-events:none;z-index:2147483647;font-size:.65rem;color:rgba(255,255,255,.15);font-family:system-ui,sans-serif;letter-spacing:.01em;">By using mitch.pro you agree to the <a href="/use-agreement.html" style="color:rgba(255,255,255,.15);pointer-events:all;" target="_blank">use agreement<\/a> and <a href="/privacy.html" style="color:rgba(255,255,255,.15);pointer-events:all;" target="_blank">privacy policy<\/a>.<\/div>';
        if (!contents.includes('_agree_footer')) {
          const bi = contents.lastIndexOf('<\/body>');
          contents = bi >= 0 ? contents.slice(0, bi) + agreeTag + contents.slice(bi) : contents + agreeTag;
        }
        return jsonResp(200, { content: contents, featured: featuredGameHref });
      } catch {
        return jsonResp(200, { content: errorPage(500, 'Server Error',
          'Something went wrong loading this page. Try refreshing, or '
          + '<a href="mailto:support@mitch.pro">contact support<\/a> if it keeps happening.') });
      }
    }

    // /api/e2e/send
    if (path === '/api/e2e/send') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        const { from: frm = '', to = '', data: msgData = '', iv = '' } = body;
        if (!frm || !to || !msgData || !iv)
          return jsonResp(400, { success: false, message: 'Missing fields' });
        if (!(frm in e2eUsers)) return jsonResp(401, { success: false, message: 'Not registered' });
        const entry = { from: frm, to, data: msgData, iv, timestamp: Date.now() };
        
        const k = e2eKey(frm, to);
        if (!e2eMessages[k]) e2eMessages[k] = [];
        e2eMessages[k].push(entry);
        if (e2eMessages[k].length > 500) e2eMessages[k] = e2eMessages[k].slice(-500);
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/apply
    if (path === '/api/apply') {
      if (rateLimited('ip:' + ip, '/api/apply')) return jsonResp(429, { error: 'Too many applications. Please wait before trying again.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      const { name, email, discord, why, skills, extra, type } = body;
      const isPremium = type === 'premium';
      if (!name?.trim() || !email?.trim() || !why?.trim()) return jsonResp(400, { error: 'Please fill in all required fields.' });
      if (!isPremium && (!discord?.trim() || !skills?.trim())) return jsonResp(400, { error: 'Please fill in all required fields.' });
      const application = {
        name: name.trim(), email: email.trim().toLowerCase(),
        discord: (discord || '').trim(), why: why.trim(),
        ...(skills?.trim() ? { skills: skills.trim() } : {}),
        extra: (extra || '').trim(),
        type: isPremium ? 'premium' : 'team',
        submitted_at: Date.now(),
      };
      const apps = applications;
      apps.unshift(application);
      saveApplications( apps);
      const ntfyTitle = isPremium ? 'New Premium Application' : 'New Team Application';
      ntfy(`${name.trim()} (${email.trim()})${discord?.trim() ? ' — ' + discord.trim() : ''}\n\n${why.trim().slice(0, 200)}`, {
        title: ntfyTitle,
        priority: 'high',
      });
      console.log(`[apply] New application from ${name.trim()} <${email.trim()}> (${discord.trim()})`);
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/profile' && method === 'POST') {
      const cookies = getCookies(req);
      const email = emailFromSid(cookies['studentId'] || '');
      if (!email) return jsonResp(401, { error: 'not logged in' });

      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const { displayName, bio, website, pfp, background } = body;
      const isPremium = isPremiumEmail(email);
      const norm = normalizeEmail(email);
      const profiles = loadJson(PROFILES_FILE, {});

      // Preserve profileBonusClaimed across saves
      const alreadyClaimed = profiles[norm]?.profileBonusClaimed || false;

      profiles[norm] = {
        email,
        displayName: (displayName || '').trim().slice(0, 40),
        bio: (bio || '').trim().slice(0, 300),
        website: (website || '').trim().slice(0, 100),
        pfp: (pfp || '').trim().slice(0, 200),
        background: isPremium ? (background || '').trim().slice(0, 200) : (profiles[norm]?.background || ''),
        updatedAt: Date.now(),
        profileBonusClaimed: alreadyClaimed,
      };

      // One-time profile setup bonus: award 500 coins when all four fields are filled
      const dn = profiles[norm].displayName;
      const bi = profiles[norm].bio;
      const ws = profiles[norm].website;
      const pp = profiles[norm].pfp;
      let bonusGranted = false;
      if (!alreadyClaimed && dn && bi && ws && pp) {
        addCoins(email, 500);
        profiles[norm].profileBonusClaimed = true;
        bonusGranted = true;
        console.log(`[profile] ${email} claimed profile setup bonus (+500 coins)`);
      }

      saveJson(PROFILES_FILE, profiles);
      return jsonResp(200, { ok: true, bonusGranted, bonusAmount: bonusGranted ? 500 : 0 });
    }
    if (path === '/api/friends/request' && method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      
      const resolved = resolveTargetEmail(body.email);
      if (!resolved) return jsonResp(400, { error: 'user not found' });
      const friendEmail = normalizeEmail(resolved);
      
      const norm = normalizeEmail(email);
      if (norm === friendEmail) return jsonResp(400, { error: 'cannot friend request yourself' });

      // Check if already friends
      const friends = loadJson(FRIENDS_FILE, {});
      const myList = friends[norm] || [];
      if (myList.some(f => normalizeEmail(f) === friendEmail)) {
        return jsonResp(400, { error: 'already friends' });
      }

      // Check if reverse request exists
      const requests = loadJson(FRIEND_REQUESTS_FILE, []);
      const reverseIdx = requests.findIndex(r => normalizeEmail(r.from) === friendEmail && normalizeEmail(r.to) === norm);
      if (reverseIdx !== -1) {
        // Auto-accept!
        requests.splice(reverseIdx, 1);
        saveJson(FRIEND_REQUESTS_FILE, requests);

        if (!friends[norm]) friends[norm] = [];
        if (!friends[norm].includes(friendEmail)) friends[norm].push(friendEmail);
        
        if (!friends[friendEmail]) friends[friendEmail] = [];
        if (!friends[friendEmail].includes(norm)) friends[friendEmail].push(norm);
        
        saveJson(FRIENDS_FILE, friends);

        // Send push notification to the other user
        const subs = loadJson(PUSH_SUBS_FILE, {});
        const sub = subs[friendEmail] || subs[normalizeEmail(friendEmail)];
        if (sub && VAPID_PUBLIC) {
          webpush.sendNotification(sub, JSON.stringify({
            title: 'Friend Request Accepted',
            body: `${maskEmail(email)} accepted your friend request!`,
            url: notificationUrl('/'),
          })).catch(() => {});
        }

        return jsonResp(200, { ok: true, status: 'accepted' });
      }

      // Check if duplicate request exists
      const dupIdx = requests.findIndex(r => normalizeEmail(r.from) === norm && normalizeEmail(r.to) === friendEmail);
      if (dupIdx !== -1) {
        return jsonResp(400, { error: 'request already sent' });
      }

      // Create new pending request
      requests.push({
        from: norm,
        to: friendEmail,
        timestamp: Date.now()
      });
      saveJson(FRIEND_REQUESTS_FILE, requests);

      // Notify the recipient via Web Push!
      const subs = loadJson(PUSH_SUBS_FILE, {});
      const sub = subs[friendEmail] || subs[normalizeEmail(friendEmail)];
      if (sub && VAPID_PUBLIC) {
        webpush.sendNotification(sub, JSON.stringify({
          title: 'New Friend Request',
          body: `${maskEmail(email)} sent you a friend request!`,
          url: notificationUrl('/'),
        })).catch(() => {});
      }

      return jsonResp(200, { ok: true, status: 'pending' });
    }

    if (path === '/api/friends/request/cancel' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const resolved = resolveTargetEmail(body.email);
      if (!resolved) return jsonResp(400, { error: 'invalid email' });
      const friendEmail = normalizeEmail(resolved);

      const norm = normalizeEmail(email);
      const requests = loadJson(FRIEND_REQUESTS_FILE, []);
      const reqIdx = requests.findIndex(r => normalizeEmail(r.from) === norm && normalizeEmail(r.to) === friendEmail);
      if (reqIdx === -1) {
        return jsonResp(400, { error: 'no pending request found to this user' });
      }

      // Remove request
      requests.splice(reqIdx, 1);
      saveJson(FRIEND_REQUESTS_FILE, requests);

      return jsonResp(200, { ok: true });
    }



    if (path === '/api/friends/request/respond' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const resolved = resolveTargetEmail(body.email);
      if (!resolved) return jsonResp(400, { error: 'invalid email' });
      const friendEmail = normalizeEmail(resolved);
      const action = String(body.action || '').trim().toLowerCase(); // 'accept' or 'reject'
      
      if (action !== 'accept' && action !== 'reject') return jsonResp(400, { error: 'invalid action' });
      
      const norm = normalizeEmail(email);
      const requests = loadJson(FRIEND_REQUESTS_FILE, []);
      const reqIdx = requests.findIndex(r => normalizeEmail(r.from) === friendEmail && normalizeEmail(r.to) === norm);
      if (reqIdx === -1) {
        return jsonResp(400, { error: 'no pending request found from this user' });
      }

      // Remove request
      requests.splice(reqIdx, 1);
      saveJson(FRIEND_REQUESTS_FILE, requests);

      if (action === 'accept') {
        const friends = loadJson(FRIENDS_FILE, {});
        if (!friends[norm]) friends[norm] = [];
        if (!friends[norm].includes(friendEmail)) friends[norm].push(friendEmail);

        if (!friends[friendEmail]) friends[friendEmail] = [];
        if (!friends[friendEmail].includes(norm)) friends[friendEmail].push(norm);

        saveJson(FRIENDS_FILE, friends);

        // Notify the requester
        const subs = loadJson(PUSH_SUBS_FILE, {});
        const sub = subs[friendEmail] || subs[normalizeEmail(friendEmail)];
        if (sub && VAPID_PUBLIC) {
          webpush.sendNotification(sub, JSON.stringify({
            title: 'Friend Request Accepted',
            body: `${maskEmail(email)} accepted your friend request!`,
            url: notificationUrl('/'),
          })).catch(() => {});
        }
      }

      return jsonResp(200, { ok: true });
    }

    if (path === '/api/friends/remove' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const resolved = resolveTargetEmail(body.email);
      if (!resolved) return jsonResp(400, { error: 'invalid email' });
      const friendEmail = normalizeEmail(resolved);

      const norm = normalizeEmail(email);
      const friends = loadJson(FRIENDS_FILE, {});
      
      let changed = false;
      if (friends[norm]) {
        const origLen = friends[norm].length;
        friends[norm] = friends[norm].filter(f => normalizeEmail(f) !== friendEmail);
        if (friends[norm].length !== origLen) changed = true;
      }
      if (friends[friendEmail]) {
        const origLen = friends[friendEmail].length;
        friends[friendEmail] = friends[friendEmail].filter(f => normalizeEmail(f) !== norm);
        if (friends[friendEmail].length !== origLen) changed = true;
      }

      if (changed) {
        saveJson(FRIENDS_FILE, friends);
      }
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/presence/heartbeat' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const playing = String(body.playing || '').trim();
      touchUserPresence(email, playing);
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/delete-account' && method === 'POST') {
      try {
        const cookies = getCookies(req);
        const uid     = cookies['studentId'] || cookies['id'] || '';
        if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
        if (!await tryParseJson()) return jsonResp(400, { error: 'Bad JSON' });
        const password = String(body.password || '');
        if (!password) return jsonResp(400, { error: 'Password required' });

        const email = emailFromSid(uid);
        if (!email) return jsonResp(401, { error: 'Email not found' });
        const norm = normalizeEmail(email);

        const passwords = loadPasswords();
        const stored = passwords[norm];
        if (!stored || !(await Bun.password.verify(password, stored))) {
          return jsonResp(401, { error: 'Password incorrect' });
        }

        // Wipe user data
        const tokens = loadTokens();
        for (const t of Object.keys(tokens)) {
          if (normalizeEmail(tokens[t].email) === norm) delete tokens[t];
        }
        saveTokens(tokens);

        const names = loadJson(NAMES_FILE, {});
        for (const n of Object.keys(names)) {
          if (normalizeEmail(names[n]) === norm || n === uid) delete names[n];
        }
        saveJson(NAMES_FILE, names);

        delete passwords[norm];
        savePasswords(passwords);

        const profiles = loadJson(PROFILES_FILE, {});
        delete profiles[norm];
        saveJson(PROFILES_FILE, profiles);

        const stats = loadUserStats();
        delete stats[norm];
        saveUserStats(stats);

        const cosm = loadJson(COSMETICS_FILE, {});
        delete cosm[norm];
        saveJson(COSMETICS_FILE, cosm);

        const coins = loadJson(COINS_FILE, {});
        delete coins[norm];
        saveJson(COINS_FILE, coins);

        // Remove from clicker sessions
        if (typeof clickerSessions !== 'undefined') {
          clickerSessions.delete(norm);
          saveClickerSessions();
        }

        ntfy(`Account deleted: ${email}`, { title: 'Security' });
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { error: String(e) }); }
    }

    if (path === '/api/premium-chat/send' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email || !isPremiumEmail(email)) return jsonResp(403, { error: 'Premium required' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip)) {
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      }
      const text = String(body.text || '').trim().slice(0, 1000);
      if (!text) return jsonResp(400, { error: 'empty message' });
      const normEmail = normalizeEmail(email);

      // Check if user is timed out or banned from this chatroom
      const chatroomBans = loadJson(join(DATA_DIR, 'chatroom_bans.json'), {});
      const premiumBans = chatroomBans.premium || {};
      const banEntry = premiumBans[normEmail];
      if (banEntry) {
        if (banEntry.type === 'ban') {
          return jsonResp(403, { error: 'You are banned from this chatroom.' });
        } else if (banEntry.type === 'timeout') {
          if (Date.now() < banEntry.expires) {
            return jsonResp(403, { error: `You are timed out from this chatroom for another ${Math.ceil((banEntry.expires - Date.now()) / 1000)} seconds.` });
          } else {
            // Timeout expired, clean it up
            delete premiumBans[normEmail];
            chatroomBans.premium = premiumBans;
            saveJson(join(DATA_DIR, 'chatroom_bans.json'), chatroomBans);
          }
        }
      }

      // Check last 10 messages spam limit
      const history = loadJson(PREMIUM_CHAT_FILE, []);
      if (history.length >= 10) {
        const last10 = history.slice(-10);
        const allMine = last10.every(m => normalizeEmail(m.email) === normEmail);
        if (allMine) {
          logCheat(email, 'chat_spam', 'User sent 10 consecutive messages in premium_chat', getRealIp(req));
          return jsonResp(400, { error: 'Spam detected. The last 10 messages in this chatroom are yours.' });
        }
      }

      const profiles = loadJson(PROFILES_FILE, {});
      const p = profiles[normEmail] || {};
      const name = p.displayName || email.split('@')[0];
      
      const cosm = loadJson(COSMETICS_FILE, {});
      const userCosm = cosm[normEmail] || {};
      
      const msg = { 
        id: randomBytes(8).toString('hex'),
        name, 
        email, 
        text, 
        ts: Date.now(),
        color: publicActiveColor(email, userCosm.activeColor),
        badge: userCosm.activeBadge || null
      };
      if (shadowBans.has(normEmail)) {
        return jsonResp(200, { ok: true }); // shadow success
      }
      history.push(msg);
      saveJson(PREMIUM_CHAT_FILE, history.slice(-1000));
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/public-chat/send' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip)) {
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      }
      const text = String(body.text || '').trim().slice(0, 1000);
      if (!text) return jsonResp(400, { error: 'empty message' });
      const normEmail = normalizeEmail(email);

      // Check if user is timed out or banned from this chatroom
      const chatroomBans = loadJson(join(DATA_DIR, 'chatroom_bans.json'), {});
      const publicBans = chatroomBans.public || {};
      const banEntry = publicBans[normEmail];
      if (banEntry) {
        if (banEntry.type === 'ban') {
          return jsonResp(403, { error: 'You are banned from this chatroom.' });
        } else if (banEntry.type === 'timeout') {
          if (Date.now() < banEntry.expires) {
            return jsonResp(403, { error: `You are timed out from this chatroom for another ${Math.ceil((banEntry.expires - Date.now()) / 1000)} seconds.` });
          } else {
            // Timeout expired, clean it up
            delete publicBans[normEmail];
            chatroomBans.public = publicBans;
            saveJson(join(DATA_DIR, 'chatroom_bans.json'), chatroomBans);
          }
        }
      }

      // Check last 10 messages spam limit
      const history = loadJson(PUBLIC_CHAT_FILE, []);
      if (history.length >= 10) {
        const last10 = history.slice(-10);
        const allMine = last10.every(m => normalizeEmail(m.email) === normEmail);
        if (allMine) {
          logCheat(email, 'chat_spam', 'User sent 10 consecutive messages in public_chat', getRealIp(req));
          return jsonResp(400, { error: 'Spam detected. The last 10 messages in this chatroom are yours.' });
        }
      }

      const profiles = loadJson(PROFILES_FILE, {});
      const p = profiles[normEmail] || {};
      const name = p.displayName || email.split('@')[0];
      
      const cosm = loadJson(COSMETICS_FILE, {});
      const userCosm = cosm[normEmail] || {};
      
      const msg = { 
        id: randomBytes(8).toString('hex'),
        name, 
        email, 
        text, 
        ts: Date.now(),
        color: publicActiveColor(email, userCosm.activeColor),
        badge: userCosm.activeBadge || null
      };
      if (shadowBans.has(normEmail)) {
        return jsonResp(200, { ok: true }); // shadow success
      }
      history.push(msg);
      saveJson(PUBLIC_CHAT_FILE, history.slice(-1000));

      // Broadcast via WebSocket
      const payload = JSON.stringify({
        type: 'public_chat',
        msg: {
          ...msg,
          email: maskEmail(msg.email || ''),
          color: publicActiveColor(msg.email || msg.name || '', msg.color)
        }
      });
      for (const ws of allSockets) {
        if (ws.data && ws.data.isBroadcast) {
          try { ws.send(payload); } catch {}
        }
      }

      return jsonResp(200, { ok: true });
    }


    // POST /api/chat/delete-message
    if (path === '/api/chat/delete-message' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      
      const room = String(body.room || '').trim().toLowerCase(); // 'public' or 'premium'
      const msgId = String(body.msgId || '').trim();
      if (!msgId || !['public', 'premium'].includes(room)) {
        return jsonResp(400, { error: 'msgId and valid room required' });
      }

      const file = room === 'public' ? PUBLIC_CHAT_FILE : PREMIUM_CHAT_FILE;
      const history = loadJson(file, []);
      const msgIndex = history.findIndex(m => m.id === msgId);
      if (msgIndex === -1) {
        return jsonResp(404, { error: 'message not found' });
      }

      const msg = history[msgIndex];
      history.splice(msgIndex, 1);
      saveJson(file, history);

      const actor = emailFromSid(sid) || 'moderator';
      logAdminAction(actor, `chat_delete_message_${room}`, { msgId, sender: msg.email, text: msg.text });

      // Broadcast update to WebSocket clients if public
      if (room === 'public') {
        const payload = JSON.stringify({
          type: 'public_chat_delete',
          msgId
        });
        for (const ws of allSockets) {
          if (ws.data && ws.data.isBroadcast) {
            try { ws.send(payload); } catch {}
          }
        }
      }

      return jsonResp(200, { ok: true });
    }

    // POST /api/chat/delete-user-messages
    if (path === '/api/chat/delete-user-messages' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const room = String(body.room || '').trim().toLowerCase();
      const userEmail = String(body.userEmail || '').trim();
      if (!userEmail || !['public', 'premium'].includes(room)) {
        return jsonResp(400, { error: 'userEmail and valid room required' });
      }

      const file = room === 'public' ? PUBLIC_CHAT_FILE : PREMIUM_CHAT_FILE;
      const history = loadJson(file, []);
      const normTarget = normalizeEmail(userEmail);
      const filtered = history.filter(m => normalizeEmail(m.email) !== normTarget);
      saveJson(file, filtered);

      const actor = emailFromSid(sid) || 'moderator';
      logAdminAction(actor, `chat_delete_user_messages_${room}`, { userEmail });

      // Broadcast update to WebSocket clients if public
      if (room === 'public') {
        const payload = JSON.stringify({
          type: 'public_chat_clear_user',
          userEmail: normTarget
        });
        for (const ws of allSockets) {
          if (ws.data && ws.data.isBroadcast) {
            try { ws.send(payload); } catch {}
          }
        }
      }

      return jsonResp(200, { ok: true });
    }

    // POST /api/chat/ban-user
    if (path === '/api/chat/ban-user' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const room = String(body.room || '').trim().toLowerCase();
      const userEmail = String(body.userEmail || '').trim();
      const isBan = !!body.ban;
      if (!userEmail || !['public', 'premium'].includes(room)) {
        return jsonResp(400, { error: 'userEmail and valid room required' });
      }

      const banFile = join(DATA_DIR, 'chatroom_bans.json');
      const chatroomBans = loadJson(banFile, {});
      if (!chatroomBans[room]) chatroomBans[room] = {};

      const normTarget = normalizeEmail(userEmail);
      const actor = emailFromSid(sid) || 'moderator';

      if (isBan) {
        chatroomBans[room][normTarget] = {
          type: 'ban',
          bannedBy: actor,
          ts: Date.now()
        };
        logAdminAction(actor, `chat_ban_user_${room}`, { userEmail });
      } else {
        delete chatroomBans[room][normTarget];
        logAdminAction(actor, `chat_unban_user_${room}`, { userEmail });
      }

      saveJson(banFile, chatroomBans);
      return jsonResp(200, { ok: true });
    }

    // POST /api/chat/timeout-user
    if (path === '/api/chat/timeout-user' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const room = String(body.room || '').trim().toLowerCase();
      const userEmail = String(body.userEmail || '').trim();
      const durationSeconds = Number(body.durationSeconds);
      if (!userEmail || !['public', 'premium'].includes(room) || isNaN(durationSeconds) || durationSeconds <= 0) {
        return jsonResp(400, { error: 'userEmail, valid room, and positive durationSeconds required' });
      }

      const banFile = join(DATA_DIR, 'chatroom_bans.json');
      const chatroomBans = loadJson(banFile, {});
      if (!chatroomBans[room]) chatroomBans[room] = {};

      const normTarget = normalizeEmail(userEmail);
      const actor = emailFromSid(sid) || 'moderator';

      chatroomBans[room][normTarget] = {
        type: 'timeout',
        expires: Date.now() + durationSeconds * 1000,
        timedOutBy: actor,
        ts: Date.now()
      };

      saveJson(banFile, chatroomBans);
      logAdminAction(actor, `chat_timeout_user_${room}`, { userEmail, durationSeconds });
      return jsonResp(200, { ok: true });
    }

    // POST /api/chat/warn-user
    if (path === '/api/chat/warn-user' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });

      const userEmail = String(body.userEmail || '').trim();
      const message = String(body.message || '').trim();
      if (!userEmail || !message) {
        return jsonResp(400, { error: 'userEmail and message required' });
      }

      const actor = emailFromSid(sid) || 'moderator';
      addAdminNotification(userEmail, 'Chatroom Warning', message, actor);
      pushAdminNotification(userEmail, 'Chatroom Warning', message);
      logAdminAction(actor, 'chat_warn_user', { targetEmail: userEmail, message });

      return jsonResp(200, { ok: true });
    }

    // GET /api/chat/bans
    if (path === '/api/chat/bans' && method === 'GET') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });

      const chatroomBans = loadJson(join(DATA_DIR, 'chatroom_bans.json'), {});
      return jsonResp(200, chatroomBans);
    }


    // /api/appeal
    if (path === '/api/appeal') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed. Please try again.' });
        const email  = (body.email || '').trim().toLowerCase();
        const reason = (body.reason || '').trim();
        if (!email || !reason)
          return jsonResp(400, { success: false, message: 'Email and reason required' });
        const appeals = loadAppeals();
        appeals.push({ email, reason, submitted_at: Date.now() / 1000 });
        saveAppeals(appeals);
        ntfy(`${email} — ${reason.slice(0, 100)}`, { title: 'Appeal Submitted' });
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/me/change-password
    if (path === '/api/me/change-password') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { success: false, message: 'bad json' });
        if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
          return jsonResp(400, { success: false, message: 'reCAPTCHA failed.' });
        
        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        if (!checkPasswordCookie(req)) return jsonResp(401, { success: false, message: 'Auth required.' });

        const email = emailFromSid(sid);
        const norm = normalizeEmail(email);
        const { currentPassword, newPassword, confirmPassword } = body;

        if (!currentPassword || !newPassword || !confirmPassword)
          return jsonResp(400, { success: false, message: 'All fields required.' });
        const pwdCheck = await isSecurePassword(newPassword);
        if (!pwdCheck.valid)
          return jsonResp(400, { success: false, message: pwdCheck.error });
        if (newPassword !== confirmPassword)
          return jsonResp(400, { success: false, message: 'New passwords do not match.' });

        const passwords = loadPasswords();
        const stored = passwords[norm];
        if (!stored || !(await Bun.password.verify(currentPassword, stored)))
          return jsonResp(401, { success: false, message: 'Current password incorrect.' });

        passwords[norm] = await Bun.password.hash(newPassword);
        savePasswords(passwords);
        
        // ntfy password change alert silenced at user request
        return jsonResp(200, { success: true });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/me/logout-other
    if (path === '/api/me/logout-other' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      try {
        if (!checkPasswordCookie(req)) return jsonResp(401, { success: false, message: 'Auth required.' });

        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';
        const email = emailFromSid(sid);
        if (!email) return jsonResp(401, { success: false, message: 'Auth required.' });

        const norm = normalizeEmail(email);

        // Increment user's session generation
        const gens = loadGenerations();
        const currentGenRec = gens[norm] || {};
        const currentGen = (currentGenRec && typeof currentGenRec === 'object') ? (currentGenRec.gen || 0) : (currentGenRec || 0);
        const nextGen = currentGen + 1;
        gens[norm] = {
          gen: nextGen,
          last_registered: Date.now() / 1000
        };
        saveGenerations(gens);

        // Create new session ID
        const newSid = makeEmailId(norm, nextGen);

        // Clean up old session mappings in NAMES_FILE for this user to save space and security
        const names = loadJson(NAMES_FILE, {});
        for (const [key, value] of Object.entries(names)) {
          if (value && normalizeEmail(value) === norm) {
            delete names[key];
          }
        }
        names[newSid] = email;
        saveJson(NAMES_FILE, names);

        // ntfy session logout alert silenced at user request
        return jsonResp(200, { success: true, id: newSid });
      } catch (e) { return jsonResp(400, { success: false, message: String(e) }); }
    }

    // /api/userdata (POST)
    if (path === '/api/userdata') {
      const cookies = getCookies(req);
      const uid     = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'Bad JSON' });
      if (typeof body !== 'object' || Array.isArray(body))
        return jsonResp(400, { error: 'Expected object' });
      const fpath = userdataPath(uid);
      if (!fpath) return jsonResp(503, { error: 'Storage unavailable' });
      let existing = {};
      try { if (existsSync(fpath)) existing = JSON.parse(readFileSync(fpath, 'utf8')); } catch {}
      Object.assign(existing, body);
      existing._updated = Date.now() / 1000;
      
      // Update newsletter unsub list based on preference
      try {
        const snap = body._snapshot || existing._snapshot;
        if (snap && snap._prefPrivacy) {
          const pref = typeof snap._prefPrivacy === 'string' ? JSON.parse(snap._prefPrivacy) : snap._prefPrivacy;
          const email = emailFromSid(uid);
          if (email) {
            const unsub = loadJson(NEWSLETTER_UNSUB_FILE, []);
            const lowEmail = email.toLowerCase().trim();
            let changed = false;
            if (pref.newsletter === false) {
              if (!unsub.includes(lowEmail)) { unsub.push(lowEmail); changed = true; }
            } else if (pref.newsletter === true) {
              const idx = unsub.indexOf(lowEmail);
              if (idx !== -1) { unsub.splice(idx, 1); changed = true; }
            }
            if (changed) saveJson(NEWSLETTER_UNSUB_FILE, [...new Set(unsub)].sort());
          }
        }
      } catch (e) { console.error('[userdata] failed to sync newsletter pref:', e); }

      const newJson = JSON.stringify(existing);
      const QUOTA   = 1_073_741_824;
      const used    = Buffer.byteLength(newJson, 'utf8');
      if (used > QUOTA) return jsonResp(413, { error: 'quota_exceeded', used, limit: QUOTA });
      writeFileSync(fpath, newJson);
      return jsonResp(200, { ok: true });
    }

    // /api/chess/move
    if (path === '/api/chess/move') {
      if (!CHESS_ENGINE_OK) return jsonResp(503, { error: 'Engine not available' });
      const cookies = getCookies(req);
      const uid     = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      if (!chessRateOk(uid)) return jsonResp(429, { error: 'Too many moves' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'Bad request' });
      const fen = String(body.fen || '').trim();
      const elo = parseInt(body.elo ?? 1500);
      try {
        const move = await getSfMove(fen, elo);
        return jsonResp(200, { move });
      } catch (e) { return jsonResp(500, { error: String(e) }); }
    }

    if (path === '/api/chess/bot-win' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      
      // Simple anti-cheat: track time since last bot win to prevent spam
      const norm = normalizeEmail(email);
      const now = Date.now();
      const lastWin = lastLoggedPing.get(`chess-win:${norm}`) || 0;
      if (now - lastWin < 15000) return jsonResp(400, { error: 'win registered too fast' });
      
      addCoins(email, 10.0);
      updateStat(email, 'chess_wins', 1);
      lastLoggedPing.set(`chess-win:${norm}`, now);
      return jsonResp(200, { ok: true, coins: getCoins(email) });
    }

    if (path === '/api/chess/puzzle-solved' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      
      const norm = normalizeEmail(email);
      const active = activePuzzles.get(norm);
      if (!active) return jsonResp(400, { error: 'no active puzzle' });
      
      const elapsed = Date.now() - active.ts;
      if (elapsed < 5000) return jsonResp(400, { error: 'solved too fast' });
      
      activePuzzles.delete(norm);
      addCoins(email, 5.0);
      updateStat(email, 'puzzles_solved', 1);
      return jsonResp(200, { ok: true, coins: getCoins(email) });
    }

    // /api/sms-reply
    if (path === '/api/sms-reply') {
      try {
        const raw = await req.text();
        let smsBody;
        try { smsBody = JSON.parse(raw); }
        catch { smsBody = Object.fromEntries(new URLSearchParams(raw)); }
        let phone = (smsBody.fromNumber || '').replace(/\D/g, '');
        if (phone.length === 11 && phone.startsWith('1')) phone = phone.slice(1);
        const text = String(smsBody.text || '').trim();
        if (phone && text) {
          const convos = loadJson(SMS_CONVOS_FILE, {});
          if (!convos[phone]) convos[phone] = { messages: [], unread: true };
          convos[phone].messages.push({ dir: 'in', text, ts: Math.floor(Date.now() / 1000) });
          convos[phone].unread = true;
          writeFileSync(SMS_CONVOS_FILE, JSON.stringify(convos));
          ntfy(`${phone}: ${text.slice(0, 120)}`, { title: 'SMS Reply' });
        }
      } catch {}
      return jsonResp(200, { ok: true });
    }

    // /api/ai
    if (path === '/api/ai') {
      try {
        if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
        const uid = body.studentId || '';
        
        if (!checkPasswordCookie(req, uid))
          return jsonResp(403, { error: 'Authentication required. Please set a password at /enroll/.' });

        const email = emailFromSid(uid);
        const unlimited = isUnlimitedId(uid);

        if (!unlimited && (!email || !isPremiumEmail(email))) {
          return jsonResp(403, { error: 'Premium required to use the AI Assistant.' });
        }

        if (!unlimited) { const rl = checkRateLimit(req, path); if (rl) return rl; }        const prompt       = String(body.prompt || '').trim().slice(0, 1500);
        const aiType       = body.type || 'assistant';
        const pageUrl      = String(body.page || '').trim().slice(0, 200);
        const pageHtml     = String(body.pageHtml || '').slice(0, 20000);
        const personality  = String(body.personality || 'friendly');
        const aiPrivacy    = !!body.privacy;
        let hist       = Array.isArray(body.history) ? body.history.slice(-8) : [];
        if (!prompt) return jsonResp(400, { error: 'Empty prompt.' });
        const [ok, reason] = checkAiRate(uid, unlimited);
        if (!ok) {
          const msg = reason === 'global'
            ? 'Server is busy, try in a minute.'
            : `AI quota reached (${AI_USER_MAX}/hr). Try again later.`;
          return jsonResp(429, { error: msg });
        }
        const userEmail = loadJson(NAMES_FILE, {})[uid] || '';
        const isPremium = userEmail ? isPremiumEmail(userEmail) : false;

        let sysP;
        if (isPremium && body.customSystemPrompt) {
          sysP = String(body.customSystemPrompt).trim().slice(0, 2000);
        } else if (aiType === 'html') {          sysP = ('You are an HTML/CSS/JS assistant in a live code editor on mitch.pro. '
                + 'When asked to write or modify code, output ONLY complete valid HTML (no markdown fences). '
                + 'When asked a question, answer briefly.');
        } else {
          sysP = (
            'You are the mitch.pro AI assistant — an expert on every part of this site.\n\n'
            + '## About mitch.pro\n'
            + 'A private invite-only website for RJUHSD students. Accessible at mitch.pro and mitch.88chan.me. '
            + 'Features: games, E2E encrypted chatroom, chess puzzles, tools, and more.\n\n'
            + '## Enrollment & Access\n'
            + 'Users request access at /enroll.html with their school email. Admin approves and sends a claim link. '
            + 'The claim link (claim.html?token=...) sets a signed studentId cookie that unlocks the site. '
            + 'Users can appeal bans at /appeal.html. Unlimited/admin tokens exist and bypass rate limits.\n\n'
            + '## Pages\n'
            + '/ (Home): greeting, clock, top-3 most-played games, site navigation\n'
            + '/games/ : full game library with categories and Most Played section (top 15)\n'
            + '/encrypt.html: real-time E2E encrypted chat (ECDH key exchange)\n'
            + '/unsubscribe.html: interactive chess puzzle — click pieces, right-click for arrows/highlights\n'
            + '/games/chess-bot/: chess vs AI with ELO tracking (stored in localStorage chess_elo)\n'
            + '/games/cookie-clicker/: Cookie Clicker; save synced via MitchSync\n'
            + '/games/minesweeper.html: evil minesweeper\n'
            + '/games/ddlc/: Doki Doki Literature Club\n'
            + '/games/eag/: Eaglercraft (browser Minecraft); server at mitch.pro/mc/ (trailing / required)\n'
            + '/games/sub/: Subway Surfers\n'
            + '/games/gta/: GTA\n'
            + '/games/blackjack/, /games/poker/, /games/slot-machine/ (1-4): card/casino games\n'
            + '/games/class-of-09/: Class of 09\n'
            + '/games/many/: 400+ additional games (bitlife, among us, bloons, 2048, run 3, etc.)\n'
            + 'Iframed games (open in page): kartbros.io, polytrack, tyronegames, veck.io, geometry dash, 1v1.lol, five nights at epsteins\n'
            + '/html-test.html: live HTML/CSS/JS editor with Auto Rename Tag and this AI assistant\n'
            + '/dh.html: Diffie-Hellman key exchange demo\n'
            + '/encrypt.html: encrypted messaging\n'
            + '/export.html: MitchSync export/import — back up all game saves\n'
            + '/faq.html: FAQ covering enrollment, tracking, privacy, IP logging\n'
            + '/feedback.html: submit feedback\n'
            + '/additions.html: suggest a new page\n'
            + '/newsletter.html: subscribe to site newsletter\n'
            + '/ab.html: About:Blank launcher — opens site in about:blank to bypass school filters\n'
            + '/use-agreement.html: site use agreement (data collection, acceptable use)\n'
            + '/pass.html: enter a shared access password\n\n'
            + '## Key Features\n'
            + 'MitchSync: game progress synced to server; export/import at /export.html\n'
            + 'Themes: theme picker (bottom-left star button) — multiple color themes\n'
            + 'E2E Chat: chatroom supports end-to-end encryption using DH key exchange\n'
            + 'About:Blank launcher: /ab.html opens pages inside about:blank tabs\n'
            + 'Chess ELO: tracked locally (chess_elo in localStorage), shown on home page\n'
            + 'Newsletter: email newsletter subscription via /newsletter.html\n'
            + 'Support: support@mitch.pro\n\n'
            + '## Your tools\n'
            + "You have two tools: fetch_page (reads any mitch.pro page to get current info) and "
            + "submit_suggestion (submits feedback/suggestions on the user's behalf — always confirm before submitting). "
            + 'Use fetch_page proactively when asked about specific page content or game availability.\n\n'
            + `Current page: ${pageUrl}\n`
            + (aiPrivacy ? '' : `User email: ${userEmail || 'unknown'}\n`)
            + (pageHtml && !aiPrivacy ? `\n## Current Page HTML\n${pageHtml}\n` : '')
            + '\n' + {
                friendly: 'Be warm, friendly, and concise. This is a small chat widget.',
                concise:  'Be extremely brief and direct. No filler words. This is a small chat widget.',
                detailed: 'Be thorough and detailed. Explain your reasoning fully. This is a small chat widget.',
                fun:      'Be playful, use light humor, and keep it fun. This is a small chat widget.',
              }[personality] || 'Be friendly, helpful, and concise. This is a small chat widget.'
          );
        }

        const messages = [];
        for (const h of hist) {
          if (typeof h !== 'object') continue;
          const role = h.role === 'user' ? 'user' : 'model';
          messages.push({ role, parts: [{ text: String(h.text || '').slice(0, 800) }] });
        }
        messages.push({ role: 'user', parts: [{ text: prompt }] });

        let text, model, degraded;
        if (aiType === 'assistant') {
          [text, model, degraded] = await callAiAgentic(messages, sysP, uid, userEmail);
          if (text === null && pageHtml) {
            const sysPnoHtml = sysP.replace(/\n## Current Page HTML[\s\S]*$/, '');
            [text, model, degraded] = await callAiAgentic(messages, sysPnoHtml, uid, userEmail);
          }
        } else {
          [text, model, degraded] = await callAi(messages, sysP);
          if (text === null && pageHtml) {
            const sysPnoHtml = sysP.replace(/\n## Current Page HTML[\s\S]*$/, '');
            [text, model, degraded] = await callAi(messages, sysPnoHtml);
          }
        }

        if (text === null) return jsonResp(503, { error: 'AI unavailable right now. Try again later.' });

        try {
          const entry = {
            ts: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            uid, email: userEmail || '', model, type: aiType,
            page: pageUrl, prompt, response: text, unlimited,
          };

          const logs = loadJson(AI_LOG_FILE, []);
          logs.push(entry);
          saveJson(AI_LOG_FILE, logs);
        } catch {}

        const resp = { response: text, model };
        if (degraded) { resp.degraded = true; resp.notice = ''; }
        return jsonResp(200, resp);
      } catch (e) {
        console.error('[ai] server error:', e && e.stack ? e.stack : e);
        return jsonResp(500, { error: 'AI server error: ' + (e && e.message ? e.message : 'unknown error') });
      }
    }

    if (path === '/api/daily-login/claim' && method === 'POST') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const cookies = getCookies(req);
      const uid     = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      const ban = bannedInfoForSid(uid);
      if (ban) return jsonResp(403, { error: 'account banned', banned: true });
      const email = emailFromSid(uid);
      if (!email) return jsonResp(401, { error: 'Email not found' });
      
      const norm = normalizeEmail(email);
      const data = dailyLogins[norm] || { lastClaimDate: '', streak: 0 };
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (data.lastClaimDate === todayStr) {
        return jsonResp(400, { error: 'Already claimed today' });
      }

      let freezeConsumed = false;
      if (data.lastClaimDate === yesterdayStr) {
        data.streak++;
      } else if (data.lastClaimDate === '') {
        data.streak = 1;
      } else {
        if ((data.streakFreezes || 0) > 0) {
          data.streakFreezes--;
          data.streak++;
          freezeConsumed = true;
        } else {
          data.streak = 1;
        }
      }
      data.lastClaimDate = todayStr;
      dailyLogins[norm] = data;
      saveDailyLogins();

      const reward = getDailyReward(data.streak);
      addCoins(email, reward.coins, `daily-login: streak Day ${data.streak}`);

      if (reward.grantPremium) {
        grantPremiumStatus(email, 'Earned via 60-day daily login streak', 'system');
      }

      let message = '';
      if (reward.grantPremium) {
        message = `Congratulations! You've logged in for 60 consecutive days and earned Premium Status + ${reward.coins} MitchCoins!`;
      } else if (freezeConsumed) {
        message = `❄️ Streak Freeze consumed! Your ${data.streak}-day streak was protected! Claimed Day ${data.streak} bonus: +${reward.coins} MitchCoins!`;
      } else {
        message = `Claimed Day ${data.streak} bonus: +${reward.coins} MitchCoins!`;
      }

      return jsonResp(200, {
        success: true,
        streak: data.streak,
        rewardCoins: reward.coins,
        grantedPremium: reward.grantedPremium,
        freezeConsumed,
        streakFreezes: data.streakFreezes || 0,
        message
      });
    }

  }


  const qs = url.searchParams;

  // ── GET routes ──────────────────────────────────────────────────────────────
  if (method === 'GET') {

    // GET /api/invite/my-code — returns current user's invite code
    if (path === '/api/invite/my-code') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false, error: 'auth required' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false, error: 'identity missing' });
      const norm = normalizeEmail(email);

      const invCodes = loadJson(INVITE_CODES_FILE, {});
      let code = invCodes[norm];
      if (!code) {
        // Auto-generate a code from their email prefix
        code = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12)
             + Math.floor(Math.random() * 900 + 100).toString();
        invCodes[norm] = code;
        saveJson(INVITE_CODES_FILE, invCodes);
      }

      const invClaims = loadJson(INVITE_CLAIMS_FILE, {});
      const signups = Object.values(invClaims).filter(c => c.refNorm === norm && c.paid).length;

      return jsonResp(200, {
        success: true,
        code,
        isPremium: isPremiumEmail(email),
        signups,
        inviteUrl: `https://mitch.pro/enroll?ref=${encodeURIComponent(code)}&email=THEIR_EMAIL`
      });
    }

    // GET /api/admin/maintenance-status
    if (path === '/api/admin/maintenance-status') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, { success: true, active: softMaintenanceActive });
    }

    // GET /api/admin/shop/catalog
    if (path === '/api/admin/shop/catalog') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, { success: true, catalog: SHOP_CATALOG });
    }

    // ── Team routes ────────────────────────────────────────────────────────────
    function checkTeamToken(req) {
      const auth = req.headers.get('Authorization') || '';
      const tok  = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      if (!tok) return null;
      const tokens = loadJson(TEAM_TOKENS_FILE, {});
      return tokens[tok] ? { token: tok, ...tokens[tok] } : null;
    }

    if (path === '/api/team/gmail') {
      if (!checkTeamToken(req)) return jsonResp(401, { error: 'Invalid team token' });
      const emails = loadJson(GMAIL_CACHE_FILE, []);
      return jsonResp(200, { messages: emails });
    }

    if (path === '/api/team/gmail-status') {
      if (!checkTeamToken(req)) return jsonResp(401, { error: 'Invalid team token' });
      const paused = existsSync(GMAIL_PAUSE_FILE);
      return jsonResp(200, { paused });
    }

    if (path === '/api/team/gmail-sent') {
      if (!checkTeamToken(req)) return jsonResp(401, { error: 'Invalid team token' });
      return jsonResp(200, loadJson(GMAIL_SENT_FILE, {}));
    }

    if (path === '/api/team/inbox') {
      if (!checkTeamToken(req)) return jsonResp(401, { error: 'Invalid team token' });
      try {
        const cached  = loadJson(TEAM_INBOX_CACHE, []);
        const handled = loadJson(TEAM_HANDLED_FILE, {});
        const messages = cached.map(m => ({
          ...m,
          handled: !!handled[String(m.uid)],
          senderPremium: isPremiumEmail(m.from || ''),
        }));
        return jsonResp(200, { messages });
      } catch (e) { return jsonResp(500, { error: String(e) }); }
    }

    if (path === '/api/team/email') {
      if (!checkTeamToken(req)) return jsonResp(401, { error: 'Invalid team token' });
      const uid = qs.get('uid');
      if (!uid) return jsonResp(400, { error: 'uid required' });
      const cached = loadJson(TEAM_INBOX_CACHE, []);
      const msg = cached.find(m => String(m.uid) === uid && m.mailbox === 'INBOX');
      if (!msg) return jsonResp(404, { error: 'not found' });
      return jsonResp(200, msg);
    }

    if (path === '/api/admin/passphrase-status') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      if (!isAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
      const email = emailFromSid(sid) || 'admin';
      const norm = normalizeEmail(email);
      const data = loadAdminPassphrase();
      const entry = data[norm] || {};
      return jsonResp(200, { set: !!entry.hash, updatedAt: entry.updatedAt || 0 });
    }

    if (path === '/api/me') {
      const cookies = getCookies(req);
      const uid     = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      const ban = bannedInfoForSid(uid);
      if (ban) return jsonResp(403, { error: 'account banned', banned: true, reason: ban.reason || 'This account is banned from the website.' });
      const email   = emailFromSid(uid);
      const isPremium = email ? isPremiumEmail(email) : false;
      const isAdmin = isAdminId(uid);
      const isModerator = isModeratorId(uid);
      const canGrantPremium = canGrantPremiumId(uid);
      const stats = email ? (loadUserStats()[normalizeEmail(email)] || {}) : {};
      
      let pubKeyHex = null;
      let legacyJwk = null;
      let encryptedPrivateJwk = null;
      let ivHex = null;
      if (email) {
        const legacyKeys = deriveUserE2EKeys(email);
        legacyJwk = legacyKeys.jwk;
        
        const e2eKeysData = loadJson(E2E_KEYS_FILE, {});
        const norm = normalizeEmail(email);
        const entry = e2eKeysData[norm];
        if (entry) {
          pubKeyHex = entry.pubKeyHex;
          encryptedPrivateJwk = entry.encryptedPrivateJwk;
          ivHex = entry.ivHex;
        } else {
          pubKeyHex = legacyKeys.pubKeyHex;
        }
      }

      return jsonResp(200, {
        email: maskEmail(email),
        isPremium,
        isAdmin,
        isModerator,
        canGrantPremium,
        vipUntil: stats.vip_casino_until || 0,
        jwk: legacyJwk,
        legacyJwk,
        pubKeyHex,
        encryptedPrivateJwk,
        ivHex,
        happyHour: {
          active: happyHourActive,
          message: happyHourActive 
            ? `HAPPY HOUR IS ACTIVE! Earn 2X Coins on games & canvas! (Runs ${formatSchoolHour(computedHappyHour)}) 🎰` 
            : `Happy Hour today: ${formatSchoolHour(computedHappyHour)} (Based on yesterday's least used school hour!) 🍻`
        }
      });
    }

    if (path === '/api/daily-login/state' && method === 'GET') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const cookies = getCookies(req);
      const uid     = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      const ban = bannedInfoForSid(uid);
      if (ban) return jsonResp(403, { error: 'account banned', banned: true });
      const email = emailFromSid(uid);
      if (!email) return jsonResp(401, { error: 'Email not found' });
      
      const norm = normalizeEmail(email);
      const data = dailyLogins[norm] || { lastClaimDate: '', streak: 0 };
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let canClaim = false;
      let streak = data.streak;
      let streakFrozen = false;
      const freezes = data.streakFreezes || 0;

      if (data.lastClaimDate !== todayStr) {
        canClaim = true;
        if (data.lastClaimDate !== yesterdayStr && data.lastClaimDate !== '') {
          if (freezes > 0) {
            streakFrozen = true;
          } else {
            streak = 0;
          }
        }
      }

      const nextStreak = canClaim ? streak + 1 : streak;
      const rewardInfo = getDailyReward(nextStreak);

      let message = '';
      if (canClaim) {
        if (streakFrozen) {
          message = `❄️ Streak Freeze active! Your ${streak}-day streak is protected. Claim Day ${nextStreak} Login Bonus!`;
        } else {
          message = `Claim your Day ${nextStreak} Login Bonus!`;
        }
      } else {
        message = `You claimed today's reward! Come back tomorrow. Current streak: ${data.streak} day${data.streak === 1 ? '' : 's'}.`;
      }

      return jsonResp(200, {
        canClaim,
        streak: data.streak,
        nextStreak,
        nextReward: rewardInfo.coins,
        grantPremium: rewardInfo.grantPremium,
        lastClaimDate: data.lastClaimDate,
        streakFreezes: freezes,
        streakFrozen,
        message
      });
    }

    if (path === '/api/moderator-panel') {
      const cookies = getCookies(req);
      const uid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      if (!isAnyAdminId(uid)) return jsonResp(403, { error: 'forbidden' });
      return jsonResp(200, moderatorPanelConfig());
      }

      if (path === '/api/admin/advanced-data') {
      const cookies = getCookies(req);
      const uid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      if (!isAnyAdminId(uid)) return jsonResp(403, { error: 'forbidden' });
      const email = emailFromSid(uid) || 'admin';
      logAdminAction(email, isAdminId(uid) ? 'view_advanced_admin_tools' : 'moderator_view_advanced_admin_tools', {});
      return jsonResp(200, buildAdvancedAdminData());
      }
    if (path === '/api/me/coin-gifts') {
      const cookies = getCookies(req);
      const uid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      const email = emailFromSid(uid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const gifts = loadJson(COIN_GIFTS_FILE, {});
      const notices = (gifts[normalizeEmail(email)] || [])
        .filter(g => !g.read)
        .slice(0, 10);
      return jsonResp(200, { notices });
    }

    if (path === '/api/me/notifications') {
      const cookies = getCookies(req);
      const uid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      const email = emailFromSid(uid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const norm = normalizeEmail(email);

      const gifts = loadJson(COIN_GIFTS_FILE, {});
      const notices = [];
      for (const g of (gifts[norm] || [])) {
        if (g.read) continue;
        if (g.kind === 'admin_notice') {
          notices.push({
            type: 'admin_notice',
            id: String(g.id),
            title: g.title || 'Admin notification',
            body: `From site admin via ${g.source || 'mitchdog.com'}`,
            detail: g.message || '',
            ts: g.ts || 0,
            url: g.url || notificationUrl('/'),
          });
          continue;
        }
        notices.push({
          type: 'coin_gift',
          id: String(g.id),
          title: 'Coin gift received',
          body: `${Number(g.amount || 0).toLocaleString()} coins from ${g.from || 'admin'}`,
          detail: `Reason: ${g.reason || 'admin gift'}`,
          ts: g.ts || 0,
        });
      }

      const dmBySender = {};
      for (const m of loadJson(DMS_FILE, [])) {
        if (normalizeEmail(m.to || '') !== norm || m.read) continue;
        const from = normalizeEmail(m.from || '');
        if (!from) continue;
        if (!dmBySender[from]) dmBySender[from] = { count: 0, latestTs: 0, latestText: '' };
        dmBySender[from].count++;
        if ((m.ts || 0) >= dmBySender[from].latestTs) {
          dmBySender[from].latestTs = m.ts || 0;
          let textToShow = m.text || '';
          try {
            const parsed = JSON.parse(textToShow);
            if (parsed && parsed.e2e) {
              textToShow = '[Secure Message]';
            }
          } catch (e) {}
          dmBySender[from].latestText = String(textToShow).slice(0, 120);
        }
      }
      for (const [from, info] of Object.entries(dmBySender)) {
        notices.push({
          type: 'dm',
          id: 'dm:' + from,
          from: maskEmail(from),
          title: `${info.count} encrypted chat message${info.count === 1 ? '' : 's'}`,
          body: `From ${maskEmail(from)}`,
          detail: info.latestText ? `Latest: ${info.latestText}` : '',
          ts: info.latestTs,
          url: notificationUrl('/encrypt.html'),
        });
      }
      notices.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return jsonResp(200, { notifications: notices.slice(0, 25), unread: notices.length });
    }

    if (path === '/api/userdata' && method === 'GET') {
      const cookies = getCookies(req);
      const uid     = cookies['studentId'] || cookies['id'] || '';
      if (!validId(uid)) return jsonResp(401, { error: 'Not authenticated' });
      const fpath = userdataPath(uid);
      if (!fpath) return jsonResp(503, { error: 'Storage unavailable' });
      let data = {};
      try { if (existsSync(fpath)) data = JSON.parse(readFileSync(fpath, 'utf8')); } catch {}
      const used = existsSync(fpath) ? statSync(fpath).size : 0;
      data._quota = { used, limit: 1_073_741_824 };
      return jsonResp(200, data);
    }

    if (path === '/api/admin/reset-ratelimit') {
      try {
        const key = qs.get('key') || '';
        let adminKey;
        try { adminKey = readFileSync(ADMIN_KEY_FILE, 'utf8').trim(); }
        catch { return jsonResp(500, { error: 'no admin key configured' }); }
        if (key !== adminKey) return jsonResp(403, { error: 'forbidden' });
        const endpoints = (qs.get('endpoints') || '/api/request-access,/api/newsletter-signup').split(',');
        let cleared = 0;
        for (const k of Object.keys(rlLog)) {
          if (endpoints.some(ep => k.endsWith('::' + ep))) { delete rlLog[k]; cleared++; }
        }
        return jsonResp(200, { cleared, endpoints });
      } catch (e) { return jsonResp(500, { error: String(e) }); }
    }

    if (path === '/api/newid') {
      return jsonResp(200, { id: makeId() });
    }

    if (path === '/api/game-categories') {
      const cats = loadJson(GAME_CATEGORIES_FILE, {});
      Object.assign(cats, loadJson(GAME_CATEGORIES_LOCAL, {}));
      Object.assign(cats, loadJson(GAME_CATEGORIES_EXTERNAL, {}));
      return jsonResp(200, { categories: cats });
    }

    if (path === '/api/puzzle') {
      if (!puzzles.length) return jsonResp(503, { error: 'Puzzle database not loaded' });
      let minR = parseInt(qs.get('min') || '0');
      let maxR = parseInt(qs.get('max') || '9999');
      if (isNaN(minR)) minR = 0;
      if (isNaN(maxR)) maxR = 9999;
      const lo = bisectLeft(puzzleRats, minR);
      const hi = bisectRight(puzzleRats, maxR);
      if (lo >= hi) return jsonResp(404, { error: 'No puzzles in that rating range' });
      const p = puzzles[lo + Math.floor(Math.random() * (hi - lo))];
      
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (validId(sid)) {
        const email = emailFromSid(sid);
        if (email) activePuzzles.set(normalizeEmail(email), { fen: p[0], ts: Date.now() });
      }
      
      return jsonResp(200, { fen: p[0], moves: p[1], rating: p[2], themes: p[3] });
    }

    if (path === '/api/game-stats') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      return jsonResp(200, { stats: globalGameStats });
    }

    // /api/members — all enrolled users + online status
    if (path === '/api/members') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const isAdmin = isAdminId(sid);
      const tokens = loadTokens();
      const now = Date.now();
      const viewerEmail = emailFromSid(sid);
      touchActiveEmail(viewerEmail, now);
      const stats = loadUserStats();
      const profiles = loadJson(PROFILES_FILE, {});
      const cosmetics = loadJson(COSMETICS_FILE, {});
      const onlineEmails = new Set();
      for (const [email, info] of Object.entries(stats)) {
        if (info && info.last_active_at && now - info.last_active_at < 2 * 60 * 1000) {
          onlineEmails.add(normalizeEmail(email));
        }
      }
      for (const u of Object.values(e2eUsers)) {
        if (u.email && now - u.last_seen < 60000) onlineEmails.add(normalizeEmail(u.email));
      }
      
      const dms = loadJson(DMS_FILE, []);
      const cleared = loadJson(DM_CLEARED_FILE, {});
      const myCleared = cleared[normalizeEmail(viewerEmail)] || {};
      const e2eKeysData = loadJson(E2E_KEYS_FILE, {});
      
      const seen = new Set();
      const members = [];
      for (const [tok, data] of Object.entries(tokens)) {
        const email = (data.email || '').toLowerCase().trim();
        if (!email || seen.has(email) || isRevoked(tok)) continue;
        if (email === TEST_ACCOUNT_EMAIL && !isAdmin) continue;
        seen.add(email);
        const norm = normalizeEmail(email);
        const profile = profiles[norm] || {};
        const cosm = cosmetics[norm] || {};
        let role = 'member';
        if (ownerMemberEmails().some(ownerEmail => normalizeEmail(ownerEmail) === normalizeEmail(email))) role = 'owner/developer';
        else if (adminMemberEmails().some(adminEmail => normalizeEmail(adminEmail) === normalizeEmail(email))) role = 'admin/developer';
        else if (isModeratorEmail(email)) role = 'moderator';
        else if (isPremiumEmail(email)) role = 'premium';
        
        const e2eLegacy = deriveUserE2EKeys(email);
        const e2eEntry = e2eKeysData[norm];
        const pubKey = e2eEntry ? e2eEntry.pubKeyHex : e2eLegacy.pubKeyHex;
        const legacyPubKey = e2eLegacy.pubKeyHex;
        
        const processed = processMemberFields(email, profile, viewerEmail);
        
        // Find last message and unread count
        const clearedAt = myCleared['dm:' + norm] || 0;
        const memberDMs = dms.filter(m => {
          if (m.kind === 'group') return false;
          return ((normalizeEmail(m.from) === normalizeEmail(viewerEmail) && normalizeEmail(m.to) === norm) ||
                  (normalizeEmail(m.from) === norm && normalizeEmail(m.to) === normalizeEmail(viewerEmail))) &&
                 (m.ts || 0) > clearedAt;
        });
        
        let lastMessage = null;
        if (memberDMs.length > 0) {
          let maxTs = 0;
          let maxMsg = null;
          for (const m of memberDMs) {
            if ((m.ts || 0) >= maxTs) {
              maxTs = m.ts || 0;
              maxMsg = m;
            }
          }
          if (maxMsg) {
            lastMessage = {
              ...maxMsg,
              from: maskEmail(maxMsg.from),
              to: maskEmail(maxMsg.to),
              readBy: (maxMsg.readBy || []).map(maskEmail)
            };
          }
        }
        
        const unread = memberDMs.filter(m => normalizeEmail(m.to) === normalizeEmail(viewerEmail) && !m.read).length;

        members.push({ 
          email: processed.email, 
          pfp: profile.pfp || '',
          online: onlineEmails.has(normalizeEmail(email)), 
          role,
          displayName: processed.displayName,
          color: publicActiveColor(email, cosm.activeColor),
          badge: cosm.activeBadge || null,
          pubKey,
          legacyPubKey,
          lastMessage,
          unread
        });
      }
      
      const backendRoleRank = (r) => {
        const roleStr = String(r || '');
        if (roleStr.includes('owner')) return 5;
        if (roleStr.includes('admin')) return 4;
        if (roleStr.includes('moderator')) return 3;
        if (roleStr.includes('premium')) return 2;
        return 1;
      };

      members.sort((a, b) => {
        const tsA = a.lastMessage ? (a.lastMessage.ts || 0) : 0;
        const tsB = b.lastMessage ? (b.lastMessage.ts || 0) : 0;
        if (tsB !== tsA) return tsB - tsA;
        const rankA = backendRoleRank(a.role);
        const rankB = backendRoleRank(b.role);
        if (rankB !== rankA) return rankB - rankA;
        if (b.online !== a.online) return Number(b.online) - Number(a.online);
        return a.email.localeCompare(b.email);
      });

      return jsonResp(200, { members });
    }
    // /api/premium-members — public list of approved premium users
    if (path === '/api/premium-members') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const apps = applications;
      const profiles = loadJson(PROFILES_FILE, {});
      const cosmetics = loadJson(COSMETICS_FILE, {});
      const viewerEmail = emailFromSid(sid);
      const members = apps
        .filter(a => a.status === 'approved' && (a.type === 'premium' || a.grantPremium === true) && a.email !== TEST_ACCOUNT_EMAIL)
        .map(a => {
          const norm = normalizeEmail(a.email || '');
          const profile = profiles[norm] || {};
          const cosm = cosmetics[norm] || {};
          const processed = processMemberFields(a.email, profile, viewerEmail);
          return { 
            displayName: processed.displayName, 
            email: processed.email,
            color: publicActiveColor(a.email, cosm.activeColor),
            badge: cosm.activeBadge || null
          };

        });
      return jsonResp(200, { members });
    }

    // /api/admin-members — public list of site administrators
    if (path === '/api/admin-members') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const profiles = loadJson(PROFILES_FILE, {});
      const cosmetics = loadJson(COSMETICS_FILE, {});
      const viewerEmail = emailFromSid(sid);
      const developerNorms = new Set(['tyler.thompson1@student.rjuhsd.us'].map(normalizeEmail));
      const members = adminMemberEmails()
        .filter(email => email !== TEST_ACCOUNT_EMAIL)
        .map(email => {
        const norm = normalizeEmail(email);
        const profile = profiles[norm] || {};
        const cosm = cosmetics[norm] || {};
        const processed = processMemberFields(email, profile, viewerEmail);
        return {
          displayName: processed.displayName,
          email: processed.email,
          role: developerNorms.has(norm) ? 'Admin/developer.' : 'Admin',
          color: publicActiveColor(email, cosm.activeColor),
          badge: cosm.activeBadge || null
        };

      });
      return jsonResp(200, { members });
    }

    // /api/moderator-members — public list of site moderators
    if (path === '/api/moderator-members') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const profiles = loadJson(PROFILES_FILE, {});
      const cosmetics = loadJson(COSMETICS_FILE, {});
      const viewerEmail = emailFromSid(sid);
      const excluded = new Set([...siteAdminEmails(), ...ownerMemberEmails()].map(email => normalizeEmail(email)));
      const seen = new Set();
      const members = moderatorEmails()
        .map(email => String(email || '').toLowerCase().trim())
        .filter(email => email && email !== TEST_ACCOUNT_EMAIL && !excluded.has(normalizeEmail(email)) && !seen.has(normalizeEmail(email)) && (seen.add(normalizeEmail(email)) || true))
        .map(email => {
          const norm = normalizeEmail(email);
          const profile = profiles[norm] || {};
          const cosm = cosmetics[norm] || {};
          const processed = processMemberFields(email, profile, viewerEmail);
          return {
            displayName: processed.displayName,
            email: processed.email,
            role: 'Moderator',
            color: publicActiveColor(email, cosm.activeColor),
            badge: cosm.activeBadge || null
          };

        });
      return jsonResp(200, { members });
    }

    // /api/owner-members — public list of site owners
    if (path === '/api/owner-members') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const profiles = loadJson(PROFILES_FILE, {});
      const cosmetics = loadJson(COSMETICS_FILE, {});
      const viewerEmail = emailFromSid(sid);
      const members = ownerMemberEmails()
        .filter(email => email !== TEST_ACCOUNT_EMAIL)
        .map(email => {
        const norm = normalizeEmail(email);
        const profile = profiles[norm] || {};
        const cosm = cosmetics[norm] || {};
        const processed = processMemberFields(email, profile, viewerEmail);
        return { 
          displayName: processed.displayName || 'mitch', 
          email: processed.email, 
          role: 'owner/developer',
          color: publicActiveColor(email, cosm.activeColor),
          badge: cosm.activeBadge || null
        };

      });
      return jsonResp(200, { members });
    }

    // /api/profile (own) and /api/profile/:email (public)
    if (path === '/api/profile') {
      const cookies = getCookies(req);
      const email = emailFromSid(cookies['studentId'] || '');
      if (!email) return jsonResp(401, { error: 'not logged in' });
      const profiles = loadJson(PROFILES_FILE, {});
      const norm = normalizeEmail(email);
      const profile = profiles[norm] || {
        displayName: email.split('@')[0],
        bio: 'Welcome to my profile!',
        pfp: '',
        background: ''
      };
      const cosm = loadJson(COSMETICS_FILE, {});
      const processed = processMemberFields(email, profile, email);
      return jsonResp(200, {
        ...profile,
        displayName: processed.displayName,
        email: processed.email,
        isPremium: isPremiumEmail(email),
        isAdmin: isAdminEmail(email),
        stats: loadUserStats()[norm] || {},
        achievements: getAchievements(email),
        totalAchievementsCount: Object.keys(ACHIEVEMENT_DEFINITIONS).length,
        activeColor: publicActiveColor(email, cosm[norm]?.activeColor),
        activeBadge: cosm[norm]?.activeBadge || null,
        profileBonusClaimed: profile.profileBonusClaimed || false,
      });
      }

      if (path.startsWith('/api/profile/')) {      const slug = decodeURIComponent(path.slice('/api/profile/'.length));
      const cookies = getCookies(req);
      const viewerEmail = emailFromSid(cookies['studentId'] || cookies['id'] || '');
      const actualEmail = emailFromHash(slug) || slug;
      const profiles = loadJson(PROFILES_FILE, {});
      const norm = normalizeEmail(actualEmail);
      const profile = profiles[norm] || {
        email: actualEmail,
        displayName: actualEmail.split('@')[0],
        bio: 'Welcome to my profile!',
        pfp: '',
        background: ''
      };
      const cosm = loadJson(COSMETICS_FILE, {});
      const processed = processMemberFields(actualEmail, profile, viewerEmail);
      return jsonResp(200, {
        ...profile,
        displayName: processed.displayName,
        email: processed.email,
        isPremium: isPremiumEmail(actualEmail),

        isAdmin: isAdminEmail(actualEmail),
        stats: loadUserStats()[norm] || {},
        achievements: getAchievements(actualEmail),
        totalAchievementsCount: Object.keys(ACHIEVEMENT_DEFINITIONS).length,
        activeColor: publicActiveColor(actualEmail, cosm[norm]?.activeColor),
        activeBadge: cosm[norm]?.activeBadge || null
      });
      }  } // end GET

  // ── DM / push / e2e query routes (any method) ─────────────────────────────

    // /api/dm/send — store a DM or group message and push-notify recipient(s)
    if (path === '/api/dm/send') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const senderEmail = (names[sid] || '').toLowerCase();
      if (!senderEmail) return jsonResp(403, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip)) {
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      }
      const groupId = body.groupId ? String(body.groupId) : '';
      const to   = groupId ? '' : (body.to || '').toLowerCase().trim();
      const rawText = String(body.text || '').trim();
      const image = body.image && typeof body.image === 'object' ? body.image : null;
      let safeImage = null;
      if (image && image.data) {
        const data = String(image.data || '');
        const mime = String(image.mime || '').toLowerCase();
        const name = String(image.name || 'image').slice(0, 80);
        if (!/^image\/(png|jpe?g|gif|webp)$/.test(mime)) return jsonResp(400, { error: 'unsupported image type' });
        if (!data.startsWith('data:' + mime + ';base64,')) return jsonResp(400, { error: 'invalid image data' });
        if (Buffer.byteLength(data, 'utf8') > 900_000) return jsonResp(413, { error: 'image too large' });
        safeImage = { data, mime, name };
      }
      const text = rawText.slice(0, safeImage ? 500 : 2000);
      if (!groupId && !to) return jsonResp(400, { error: 'missing fields' });
      if (!text && !safeImage) return jsonResp(400, { error: 'missing fields' });
      const replyTo = body.replyTo && typeof body.replyTo === 'object' ? {
        id: String(body.replyTo.id || '').slice(0, 100),
        from: String(body.replyTo.from || '').slice(0, 100),
        text: String(body.replyTo.text || '').slice(0, 200),
        ts: Number(body.replyTo.ts) || 0,
      } : null;
      const dms = loadJson(DMS_FILE, []);
      const subs = VAPID_PUBLIC ? loadJson(PUSH_SUBS_FILE, {}) : {};
      let msg;
      const expiry = Number(body.expiry) || 0;
      if (groupId) {
        const groups = loadJson(GROUPS_FILE, []);
        const group = groups.find(g => g.id === groupId);
        if (!group) return jsonResp(404, { error: 'group not found' });
        if (!group.members.some(m => normalizeEmail(m) === normalizeEmail(senderEmail)))
          return jsonResp(403, { error: 'not a member' });
        msg = { kind: 'group', groupId, groupName: group.name, from: senderEmail, text, image: safeImage, replyTo, ts: Date.now(), readBy: [senderEmail] };
        if (expiry > 0) {
          msg.expiresAt = Date.now() + expiry;
        }
        dms.push(msg);
        saveJson(DMS_FILE, pruneDms(dms));
        const getNotificationBody = (t, img) => {
          try {
            const parsed = JSON.parse(t);
            if (parsed && parsed.e2e) {
              return img ? '[Secure Image]' : '[Secure Message]';
            }
          } catch (e) {}
          return img ? (t ? t.slice(0, 90) + ' [image]' : 'Sent an image') : t.slice(0, 120);
        };

        if (VAPID_PUBLIC) {
          const notifyBody = getNotificationBody(text, safeImage);
          for (const member of group.members) {
            if (normalizeEmail(member) === normalizeEmail(senderEmail)) continue;
            const recActive = (member in e2eUsers) && (Date.now() - e2eUsers[member].last_seen < 30000);
            if (!recActive && subs[member]) {
              webpush.sendNotification(subs[member], JSON.stringify({
                title: `${maskEmail(senderEmail)} in ${group.name}`, body: notifyBody, url: notificationUrl('/encrypt.html'),
              })).catch(e => { if (e.statusCode === 410 || e.statusCode === 404) { delete subs[member]; saveJson(PUSH_SUBS_FILE, subs); } });
            }
          }
        }
        } else {
        msg = { kind: 'dm', from: senderEmail, to, text, image: safeImage, replyTo, ts: Date.now(), read: false };
        if (expiry > 0) {
          msg.expiresAt = Date.now() + expiry;
        }
        dms.push(msg);
        saveJson(DMS_FILE, pruneDms(dms));
        const recActive = (to in e2eUsers) && (Date.now() - e2eUsers[to].last_seen < 30000);
        if (!recActive && VAPID_PUBLIC && subs[to]) {
          webpush.sendNotification(subs[to], JSON.stringify({
            title: `Message from ${maskEmail(senderEmail)}`,
            body:  getNotificationBody(text, safeImage),
            url:   notificationUrl('/encrypt.html'),
          })).catch(e => { if (e.statusCode === 410 || e.statusCode === 404) { delete subs[to]; saveJson(PUSH_SUBS_FILE, subs); } });
        }
        }
        addCoins(senderEmail, 2.0);
        const maskedMsg = {
        ...msg,
        from: maskEmail(msg.from),
        to: maskEmail(msg.to),
        readBy: (msg.readBy || []).map(maskEmail)
        };
        return jsonResp(200, { success: true, message: maskedMsg });

    }

    // /api/dm/groups — list groups the current user belongs to
    if (path === '/api/dm/groups' && method === 'GET') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      const allGroups = loadJson(GROUPS_FILE, []);
      const myGroups = allGroups.filter(g => g.members.some(m => normalizeEmail(m) === normalizeEmail(myEmail)));
      const dms = loadJson(DMS_FILE, []);
      const cleared = loadJson(DM_CLEARED_FILE, {});
      const myCleared = cleared[normalizeEmail(myEmail)] || {};
      const result = myGroups.map(g => {
        const clearedAt = myCleared['group:' + g.id] || 0;
        const msgs = dms.filter(m => m.kind === 'group' && m.groupId === g.id && (m.ts || 0) > clearedAt)
                        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const last = msgs[0];
        const unread = msgs.filter(m => !(m.readBy || []).some(e => normalizeEmail(e) === normalizeEmail(myEmail))).length;
        let lastMessage = null;
        if (last) {
          lastMessage = {
            ...last,
            from: maskEmail(last.from),
            to: last.to ? maskEmail(last.to) : undefined,
            readBy: (last.readBy || []).map(maskEmail)
          };
        }
        return { 
          ...g, 
          members: (g.members || []).map(maskEmail),
          createdBy: maskEmail(g.createdBy),
          lastText: last ? (last.text || (last.image ? 'Sent an image' : '')) : '', 
          lastTs: last ? last.ts : g.createdAt, 
          lastMessage,
          unread 
        };
      });

      result.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      return jsonResp(200, { groups: result });
    }

    // /api/dm/inbox — fetch DMs for current user
    if (path === '/api/dm/inbox') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      const withUser = (qs.get('with') || '').toLowerCase();
      const groupId  = qs.get('group') || '';
      const since = parseInt(qs.get('since') || '0') || 0;
      const before = parseInt(qs.get('before') || '0') || 0;
      const limit = parseInt(qs.get('limit') || '0') || 0;

      const dms = loadJson(DMS_FILE, []);
      const cleared = loadJson(DM_CLEARED_FILE, {});
      const myCleared = cleared[normalizeEmail(myEmail)] || {};
      const myGroups = (loadJson(GROUPS_FILE, [])).filter(g => g.members.some(m => normalizeEmail(m) === normalizeEmail(myEmail)));
      const myGroupIds = new Set(myGroups.map(g => g.id));
      const msgs = dms.filter(m => {
        if (m.expiresAt && Date.now() > m.expiresAt) return false;
        if (since && (m.ts || 0) <= since) return false;
        if (groupId) {
          if (m.kind !== 'group' || String(m.groupId) !== groupId) return false;
          if (!myGroupIds.has(groupId)) return false;
          const clearedAt = myCleared['group:' + groupId] || 0;
          return (m.ts || 0) > clearedAt;
        }
        if (withUser) {
          if (m.kind === 'group') return false;
          const clearedAt = myCleared['dm:' + normalizeEmail(withUser)] || 0;
          return ((normalizeEmail(m.from) === normalizeEmail(myEmail) && normalizeEmail(m.to) === normalizeEmail(withUser)) ||
                  (normalizeEmail(m.from) === normalizeEmail(withUser) && normalizeEmail(m.to) === normalizeEmail(myEmail))) &&
                 (m.ts || 0) > clearedAt;
        }
        // general inbox: my DMs + group messages for my groups
        if (m.kind === 'group') {
          if (!myGroupIds.has(m.groupId)) return false;
          const clearedAt = myCleared['group:' + m.groupId] || 0;
          return (m.ts || 0) > clearedAt;
        }
        const peer = normalizeEmail(m.from) === normalizeEmail(myEmail) ? normalizeEmail(m.to || '') : normalizeEmail(m.from || '');
        const clearedAt = myCleared['dm:' + peer] || 0;
        return (normalizeEmail(m.from) === normalizeEmail(myEmail) || normalizeEmail(m.to) === normalizeEmail(myEmail)) &&
               (m.ts || 0) > clearedAt;
      });

      // Sort chronologically
      msgs.sort((a, b) => (a.ts || 0) - (b.ts || 0));

      let filtered = msgs;
      if (before) {
        filtered = filtered.filter(m => (m.ts || 0) < before);
      }
      if (limit > 0) {
        filtered = filtered.slice(-limit);
      }

      const resultMsgs = filtered.map(m => ({
        ...m,
        from: maskEmail(m.from),
        to: maskEmail(m.to),
        readBy: (m.readBy || []).map(maskEmail)
      }));
      return jsonResp(200, { messages: resultMsgs, myEmail: maskEmail(myEmail) });

    }

    // /api/dm/mark-read
    if (path === '/api/dm/mark-read') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!await tryParseJson()) return jsonResp(400, {});
      const from = (body.from || '').toLowerCase();
      const groupId = body.groupId ? String(body.groupId) : '';
      const dms = loadJson(DMS_FILE, []);
      let changed = false;
      for (const m of dms) {
        if (groupId) {
          if (m.kind === 'group' && m.groupId === groupId && !(m.readBy || []).some(e => normalizeEmail(e) === normalizeEmail(myEmail))) {
            m.readBy = [...(m.readBy || []), myEmail];
            changed = true;
          }
        } else {
          if ((!m.kind || m.kind === 'dm') && normalizeEmail(m.to) === normalizeEmail(myEmail) && (!from || normalizeEmail(m.from) === normalizeEmail(from)) && !m.read) {
            m.read = true; changed = true;
          }
        }
      }
      if (changed) saveJson(DMS_FILE, dms);
      if (from) addCoins(from, 2.0);
      return jsonResp(200, { success: true });
    }

    // /api/dm/groups — create a group
    if (path === '/api/dm/groups' && method === 'POST') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const name = String(body.name || '').trim().slice(0, 60) || 'Group chat';
      const rawMembers = Array.isArray(body.members) ? body.members : [];
      const members = [...new Set([myEmail, ...rawMembers.map(m => String(m).toLowerCase().trim()).filter(Boolean)])];
      if (members.length < 2) return jsonResp(400, { error: 'need at least one other member' });
      const group = { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8), name, members, createdBy: myEmail, createdAt: Date.now() };
      const groups = loadJson(GROUPS_FILE, []);
      groups.push(group);
      saveJson(GROUPS_FILE, groups);
      return jsonResp(200, { ok: true, group });
    }

    // /api/dm/group/leave
    if (path === '/api/dm/group/leave') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const groupId = String(body.groupId || '');
      if (!groupId) return jsonResp(400, { error: 'missing groupId' });
      const groups = loadJson(GROUPS_FILE, []);
      const idx = groups.findIndex(g => g.id === groupId);
      if (idx === -1) return jsonResp(404, { error: 'group not found' });
      groups[idx].members = groups[idx].members.filter(m => normalizeEmail(m) !== normalizeEmail(myEmail));
      if (groups[idx].members.length === 0) groups.splice(idx, 1);
      saveJson(GROUPS_FILE, groups);
      return jsonResp(200, { ok: true });
    }

    // /api/dm/clear — clear a conversation from this user's view
    if (path === '/api/dm/clear') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const cleared = loadJson(DM_CLEARED_FILE, {});
      const norm = normalizeEmail(myEmail);
      if (!cleared[norm]) cleared[norm] = {};
      const now = Date.now();
      if (body.all) {
        const groups = loadJson(GROUPS_FILE, []).filter(g => g.members.some(m => normalizeEmail(m) === norm));
        for (const g of groups) cleared[norm]['group:' + g.id] = now;
        const dms = loadJson(DMS_FILE, []);
        const peers = new Set();
        for (const m of dms) {
          if ((!m.kind || m.kind === 'dm') && normalizeEmail(m.from) === norm) peers.add(normalizeEmail(m.to));
          if ((!m.kind || m.kind === 'dm') && normalizeEmail(m.to) === norm) peers.add(normalizeEmail(m.from));
        }
        for (const peer of peers) cleared[norm]['dm:' + peer] = now;
      } else if (body.groupId) {
        cleared[norm]['group:' + String(body.groupId)] = now;
      } else if (body.with) {
        cleared[norm]['dm:' + normalizeEmail(String(body.with))] = now;
      } else {
        return jsonResp(400, { error: 'missing target' });
      }
      saveJson(DM_CLEARED_FILE, cleared);
      return jsonResp(200, { success: true });
    }

    // /api/dm/report — report a message for admin review
    if (path === '/api/dm/report') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
      const reports = loadJson(CHAT_REPORTS_FILE, []);
      
      const newReport = {
        id: String(body.id || ''),
        reason: String(body.reason || '').slice(0, 500),
        reportedBy: myEmail,
        ts: Date.now(),
        context: Array.isArray(body.context) ? body.context.map(m => ({
          from: String(m.from || ''),
          to: String(m.to || ''),
          text: String(m.text || '').slice(0, 2000),
          ts: Number(m.ts) || 0,
          reported: !!m.reported
        })) : []
      };
      
      reports.push(newReport);
      if (reports.length > 5000) reports.splice(0, reports.length - 5000);
      saveJson(CHAT_REPORTS_FILE, reports);
      return jsonResp(200, { success: true });
    }

    // /api/push/subscribe
    if (path === '/api/push/subscribe') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      if (!myEmail) return jsonResp(403, { error: 'email not found' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const subs = loadJson(PUSH_SUBS_FILE, {});
      subs[myEmail] = body;
      saveJson(PUSH_SUBS_FILE, subs);
      return jsonResp(200, { success: true });
    }

    // /api/push/unsubscribe
    if (path === '/api/push/unsubscribe') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!sid || !validId(sid)) return jsonResp(401, { error: 'auth required' });
      const names = loadJson(NAMES_FILE, {});
      const myEmail = (names[sid] || '').toLowerCase();
      const subs = loadJson(PUSH_SUBS_FILE, {});
      delete subs[myEmail];
      saveJson(PUSH_SUBS_FILE, subs);
      return jsonResp(200, { success: true });
    }

    // /api/push/vapid-key
    if (path === '/api/push/vapid-key') {
      return jsonResp(200, { publicKey: VAPID_PUBLIC });
    }

    if (path === '/api/e2e/users') {
      const now   = Date.now();
      const users = Object.entries(e2eUsers)
        .filter(([, u]) => now - u.last_seen < 60000)
        .map(([n, u]) => ({ nickname: n, pubKey: u.pub_key }));
      return jsonResp(200, { users });
    }

    if (path === '/api/e2e/messages') {
      const me       = qs.get('me') || '';
      const withUser = qs.get('with') || '';
      const since    = parseInt(qs.get('since') || '0') || 0;
      if (!me || !withUser) return jsonResp(400, { error: 'Missing params' });
      const k    = e2eKey(me, withUser);
      const msgs = (e2eMessages[k] || []).filter(m => m.timestamp > since)
        .map(m => ({ from: m.from, to: m.to, data: m.data, iv: m.iv, timestamp: m.timestamp }));
      return jsonResp(200, { messages: msgs });
    }

  // ── Chess-VS routes ──────────────────────────────────────────────────────
  if (path.startsWith('/api/chess-vs/')) {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
    const names = loadJson(NAMES_FILE, {});
    const myEmail = (names[sid] || '').toLowerCase();
    if (!myEmail) return jsonResp(403, { error: 'email not found' });

    if (path === '/api/chess-vs/heartbeat') {
      cvOnline[myEmail] = Date.now();
      const challenges = Object.values(cvChallenges).filter(c => c.to === myEmail || c.from === myEmail);
      const myGames = Object.values(cvGames)
        .filter(g => g.white === myEmail || g.black === myEmail)
        .map(g => { cvCheckTimeout(g); return { id: g.id, white: g.white, black: g.black, status: g.status, type: g.type, result: g.result }; });
      return jsonResp(200, { ok: true, challenges, games: myGames });
    }

    if (path === '/api/chess-vs/online') {
      const now = Date.now();
      const online = Object.entries(cvOnline).filter(([, t]) => now - t < 60000).map(([e]) => e);
      return jsonResp(200, { online });
    }

    if (path === '/api/chess-vs/challenges') {
      const mine = Object.values(cvChallenges).filter(c => c.to === myEmail || c.from === myEmail);
      return jsonResp(200, { challenges: mine });
    }

    if (path === '/api/chess-vs/challenge') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const to = (body.to || '').toLowerCase().trim();
      if (!to || to === myEmail) return jsonResp(400, { error: 'invalid target' });
      const type = body.type === 'corr' ? 'corr' : 'live';
      const tc = type === 'live'
        ? { initial: Math.min(600000, Math.max(30000, parseInt(body.initial) || 300000)), increment: Math.min(30000, Math.max(0, parseInt(body.increment) || 0)) }
        : { perMove: Math.min(7 * 86400000, Math.max(3600000, parseInt(body.perMove) || 86400000)) };

      const bet = Math.max(0, parseInt(body.bet) || 0);
      if (bet > 0 && getCoins(myEmail) < bet) {
        return jsonResp(400, { error: 'You do not have enough coins for this bet' });
      }

      let alreadyChallenged = false;
      for (const [id, c] of Object.entries(cvChallenges)) {
        if (c.from === myEmail && c.to === to) {
          if (c.type === type) alreadyChallenged = true;
          delete cvChallenges[id];
        }
      }
      const id = randomBytes(8).toString('hex');
      cvChallenges[id] = { id, from: myEmail, to, type, tc, bet, createdAt: Date.now() };
      if (type === 'corr' && !alreadyChallenged) {
        const fromName = myEmail.split('@')[0];
        const days = tc.perMove / 86400000;
        const _s = site();
        sendEmailBg(to, `Chess challenge from ${fromName}`,
          `${fromName} has challenged you to a correspondence chess game (${days} day${days !== 1 ? 's' : ''}/move) with a bet of ${bet} coins.\n\nLog in to accept: ${siteUrl(to)}/games/chess-bot/`);
      }
      addAdminNotification(to, 'New Chess Challenge', `${myEmail.split('@')[0]} has challenged you to a Chess game${bet > 0 ? ` (Bet: ${bet} coins)` : ''}.`, 'admin', '', '/games/chess-bot/');
      triggerNotificationRefresh();
      return jsonResp(200, { ok: true, id });
    }

    if (path === '/api/chess-vs/respond') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const challengeId = body.challengeId || '';
      const accept = !!body.accept;
      const c = cvChallenges[challengeId];
      if (!c) return jsonResp(404, { error: 'challenge not found' });
      if (c.to !== myEmail) return jsonResp(403, { error: 'not your challenge' });
      
      if (accept && c.bet > 0) {
        if (getCoins(myEmail) < c.bet) {
          return jsonResp(400, { error: 'You do not have enough coins to accept this bet' });
        }
        if (getCoins(c.from) < c.bet) {
          delete cvChallenges[challengeId];
          return jsonResp(400, { error: 'The challenger no longer has enough coins for this bet. Challenge cancelled.' });
        }
        addCoins(myEmail, -c.bet, 'chess-vs: bet deduction on start');
        addCoins(c.from, -c.bet, 'chess-vs: bet deduction on start');
      }

      delete cvChallenges[challengeId];
      if (!accept) {
        addAdminNotification(c.from, 'Chess Challenge Declined', `${myEmail.split('@')[0]} declined your Chess challenge.`, 'admin', '', '/games/chess-bot/');
        triggerNotificationRefresh();
        return jsonResp(200, { ok: true, declined: true });
      }
      addAdminNotification(c.from, 'Chess Challenge Accepted', `${myEmail.split('@')[0]} accepted your Chess challenge!`, 'admin', '', '/games/chess-bot/');
      triggerNotificationRefresh();
      const white = Math.random() < 0.5 ? c.from : myEmail;
      const black = white === c.from ? myEmail : c.from;
      const gameId = randomBytes(8).toString('hex');
      const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const now = Date.now();
      cvGames[gameId] = {
        id: gameId, white, black, type: "c".type, tc: c.tc, bet: c.bet || 0,
        fen: STARTING_FEN, moves: [], status: 'active',
        result: null, reason: null, turn: 'w',
        clocks: { w: c.type === 'live' ? c.tc.initial : c.tc.perMove, b: c.type === 'live' ? c.tc.initial : c.tc.perMove },
        lastMoveAt: now, createdAt: now,
        clockStartedAt: c.type === 'corr' ? null : undefined,
      };
      cvChats[gameId] = [];
      if (c.type === 'corr') cvSave();
      return jsonResp(200, { ok: true, gameId });
    }

    if (path === '/api/chess-vs/game') {
      const gameId = qs.get('id') || '';
      const g = cvGames[gameId];
      if (!g) return jsonResp(404, { error: 'game not found' });
      if (g.white !== myEmail && g.black !== myEmail) return jsonResp(403, { error: 'not your game' });
      if (g.status === 'active') {
        if (g.type === 'corr' && g.clockStartedAt === null) {
          const myColor = g.white === myEmail ? 'w' : 'b';
          if (g.turn === myColor) { g.clockStartedAt = Date.now(); cvSave(); }
        }
        cvCheckTimeout(g);
      }
      return jsonResp(200, { game: g, chat: cvChats[gameId] || [] });
    }

    if (path === '/api/chess-vs/move') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = body.gameId || '';
      const g = cvGames[gameId];
      if (!g) return jsonResp(404, { error: 'game not found' });
      if (g.white !== myEmail && g.black !== myEmail) return jsonResp(403, { error: 'not your game' });
      if (g.status !== 'active') return jsonResp(400, { error: 'game over' });
      cvCheckTimeout(g);
      if (g.status !== 'active') return jsonResp(200, { ok: false, game: g });
      const myColor = g.white === myEmail ? 'w' : 'b';
      if (g.turn !== myColor) return jsonResp(400, { error: 'not your turn' });
      
      const boost = !!body.boostClock;
      if (boost) {
        const balance = getCoins(myEmail);
        if (balance < 500) return jsonResp(400, { error: 'Insufficient coins for clock boost' });
        addCoins(myEmail, -500); // Sink #7: Clock boost
        g.clocks[myColor] += 30000; // Add 30 seconds
      }

      const move = (body.move || '').slice(0, 10);
      const newFen = (body.fen || '').slice(0, 200);
      if (!move || !newFen) return jsonResp(400, { error: 'missing move/fen' });
      const now = Date.now();
      if (g.type === 'live') {
        const elapsed = now - g.lastMoveAt;
        g.clocks[myColor] = Math.max(0, g.clocks[myColor] - elapsed) + (g.tc.increment || 0);
        if (g.clocks[myColor] <= 0) { g.status = 'over'; g.result = myColor === 'w' ? '0-1' : '1-0'; g.reason = 'timeout'; }
      } else {
        const startedAt = g.clockStartedAt ?? g.lastMoveAt;
        const elapsed = now - startedAt;
        g.clocks[myColor] = Math.max(0, g.clocks[myColor] - elapsed);
        if (g.clocks[myColor] <= 0) { g.status = 'over'; g.result = myColor === 'w' ? '0-1' : '1-0'; g.reason = 'timeout'; }
        else g.clocks[myColor === 'w' ? 'b' : 'w'] = g.tc.perMove;
        g.clockStartedAt = null;
      }
      if (g.status === 'active') {
        g.moves.push(move);
        g.fen = newFen;
        g.turn = g.turn === 'w' ? 'b' : 'w';
        delete g.drawOffer;
        if (body.result) { g.status = 'over'; g.result = body.result; g.reason = body.reason || 'checkmate'; }
      }
      g.lastMoveAt = now;
      if (g.status === 'over') {
        const winner = g.result === '1-0' ? g.white : (g.result === '0-1' ? g.black : null);
        const bet = g.bet || 0;
        let winBonus = 50 + (bet * 2);
        let drawBonus = 10 + bet;
        if (areFriends(g.white, g.black)) {
          winBonus = Math.floor(winBonus * 1.5);
          drawBonus = Math.floor(drawBonus * 1.5);
        }
        if (winner) {
          addCoins(winner, winBonus, `chess-vs: win payout (bet=${bet})`);
          updateStat(winner, 'chess_wins', 1);
        } else if (g.result === '1/2-1/2') {
          addCoins(g.white, drawBonus, `chess-vs: draw payout (bet=${bet})`);
          addCoins(g.black, drawBonus, `chess-vs: draw payout (bet=${bet})`);
        }
      }
      if (g.type === 'corr') {
        cvSave();
        const oppEmail = myColor === 'w' ? g.black : g.white;
        const fromName = myEmail.split('@')[0];
        const subject = g.status === 'over'
          ? `Chess game over — ${fromName} played the final move`
          : `${fromName} played a move in your correspondence game`;
        const _s = site();
        const body2 = g.status === 'over'
          ? `Result: ${g.result}. View the game: ${siteUrl(oppEmail)}/games/chess-bot/`
          : `It's your turn! View the game: ${siteUrl(oppEmail)}/games/chess-bot/`;
        sendEmailBg(oppEmail, subject, body2);
      }
      return jsonResp(200, { ok: true, game: g });
    }

    if (path === '/api/chess-vs/resign') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = body.gameId || '';
      const g = cvGames[gameId];
      if (!g || (g.white !== myEmail && g.black !== myEmail)) return jsonResp(403, {});
      if (g.status !== 'active') return jsonResp(400, { error: 'game already over' });
      const myColor = g.white === myEmail ? 'w' : 'b';
      g.status = 'over'; g.result = myColor === 'w' ? '0-1' : '1-0'; g.reason = 'resign';
      const winner = g.result === '1-0' ? g.white : g.black;
      const bet = g.bet || 0;
      let winBonus = 50 + (bet * 2);
      if (areFriends(g.white, g.black)) {
        winBonus = Math.floor(winBonus * 1.5);
      }
      addCoins(winner, winBonus);
      updateStat(winner, 'chess_wins', 1);
      if (g.type === 'corr') cvSave();
      return jsonResp(200, { ok: true, game: g });
    }

    if (path === '/api/chess-vs/draw') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = body.gameId || '';
      const g = cvGames[gameId];
      if (!g || (g.white !== myEmail && g.black !== myEmail)) return jsonResp(403, {});
      if (g.status !== 'active') return jsonResp(400, {});
      if (body.offer) { g.drawOffer = myEmail; return jsonResp(200, { ok: true }); }
      if (body.accept && g.drawOffer && g.drawOffer !== myEmail) {
        g.status = 'over'; g.result = '1/2-1/2'; g.reason = 'draw'; delete g.drawOffer;
        const bet = g.bet || 0;
        let drawBonus = 10 + bet;
        if (areFriends(g.white, g.black)) {
          drawBonus = Math.floor(drawBonus * 1.5);
        }
        addCoins(g.white, drawBonus);
        addCoins(g.black, drawBonus);
        if (g.type === 'corr') cvSave();
      } else { delete g.drawOffer; }
      return jsonResp(200, { ok: true, game: g });
    }

    if (path === '/api/chess-vs/chat') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = body.gameId || '';
      const g = cvGames[gameId];
      if (!g || (g.white !== myEmail && g.black !== myEmail)) return jsonResp(403, {});
      const text = (body.text || '').trim().slice(0, 500);
      if (!text) return jsonResp(400, {});
      if (!cvChats[gameId]) cvChats[gameId] = [];
      cvChats[gameId].push({ from: myEmail, text, ts: Date.now() });
      if (cvChats[gameId].length > 200) cvChats[gameId].splice(0, cvChats[gameId].length - 200);
      return jsonResp(200, { ok: true });
    }
  }


  // ── Battleship Routes ────────────────────────────────────────────────────────
  if (path.startsWith('/api/battleship/')) {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
    const names = loadJson(NAMES_FILE, {});
    const myEmail = (names[sid] || '').toLowerCase();
    if (!myEmail) return jsonResp(403, { error: 'not found' });
    const myNorm = normalizeEmail(myEmail);

    if (path === '/api/battleship/heartbeat') {
      bsOnline[myNorm] = Date.now();
      const now = Date.now();
      for (const [id, c] of Object.entries(bsChallenges)) {
        if (now - c.createdAt > 300000) delete bsChallenges[id];
      }
      const challenges = Object.values(bsChallenges)
        .filter(c => normalizeEmail(c.to) === myNorm || normalizeEmail(c.from) === myNorm)
        .map(c => ({ ...c, from: maskEmail(c.from), to: maskEmail(c.to) }));
      const myGames = Object.values(bsGames).filter(g =>
        (normalizeEmail(g.player1) === myNorm || normalizeEmail(g.player2) === myNorm) && g.status !== 'over'
      );
      return jsonResp(200, { challenges, activeGames: myGames.map(g => g.id) });
    }

    if (path === '/api/battleship/online') {
      const now = Date.now();
      const online = Object.entries(bsOnline)
        .filter(([, t]) => now - t < 60000)
        .map(([e]) => maskEmail(e));
      return jsonResp(200, { online });
    }

    if (path === '/api/battleship/challenge') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const to = normalizeEmail(body.to || '');
      if (!to || to === myNorm) return jsonResp(400, { error: 'invalid target' });
      const bet = Math.max(0, Math.floor(Number(body.bet) || 0));
      if (bet > 0 && getCoins(myNorm) < bet) return jsonResp(400, { error: 'Insufficient coins for bet' });
      const now = Date.now();
      for (const [id, c] of Object.entries(bsChallenges)) {
        if (now - c.createdAt > 300000) delete bsChallenges[id];
      }
      const id = randomBytes(8).toString('hex');
      bsChallenges[id] = { id, from: myNorm, to, bet, createdAt: now };
      addAdminNotification(to, 'New Battleship Challenge', `${myNorm.split('@')[0]} has challenged you to a Battleship game${bet > 0 ? ` (Bet: ${bet} coins)` : ''}.`, 'admin', '', '/games/battleship/');
      triggerNotificationRefresh();
      return jsonResp(200, { ok: true, challengeId: id });
    }

    if (path === '/api/battleship/respond') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const challengeId = String(body.challengeId || '');
      const accept = !!body.accept;
      const c = bsChallenges[challengeId];
      if (!c) return jsonResp(404, { error: 'challenge not found or expired' });
      if (normalizeEmail(c.to) !== myNorm) return jsonResp(403, { error: 'not your challenge' });
      if (c.bet > 0) {
        if (getCoins(myNorm) < c.bet) { delete bsChallenges[challengeId]; return jsonResp(400, { error: 'Insufficient coins' }); }
        if (getCoins(c.from) < c.bet) { delete bsChallenges[challengeId]; return jsonResp(400, { error: 'Challenger no longer has enough coins. Challenge cancelled.' }); }
        if (accept) {
          addCoins(myNorm, -c.bet, 'battleship: bet deduction on start');
          addCoins(c.from, -c.bet, 'battleship: bet deduction on start');
        }
      }
      delete bsChallenges[challengeId];
      if (!accept) {
        addAdminNotification(c.from, 'Battleship Challenge Declined', `${myNorm.split('@')[0]} declined your Battleship challenge.`, 'admin', '', '/games/battleship/');
        triggerNotificationRefresh();
        return jsonResp(200, { ok: true, declined: true });
      }
      addAdminNotification(c.from, 'Battleship Challenge Accepted', `${myNorm.split('@')[0]} accepted your Battleship challenge!`, 'admin', '', '/games/battleship/');
      triggerNotificationRefresh();
      const gameId = randomBytes(8).toString('hex');
      const now = Date.now();
      bsGames[gameId] = {
        id: gameId,
        player1: c.from,
        player2: myNorm,
        bet: c.bet || 0,
        status: 'placing',
        boards: {
          [c.from]: { ships: null, hits: [], misses: [] },
          [myNorm]: { ships: null, hits: [], misses: [] },
        },
        placedBy: [],
        turn: null,
        winner: null,
        result: null,
        createdAt: now,
        lastActionAt: now,
        hitLog: [],
        collusionFlag: false,
      };
      return jsonResp(200, { ok: true, gameId });
    }

    if (path === '/api/battleship/place') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const g = bsGames[gameId];
      if (!g) return jsonResp(404, { error: 'game not found' });
      if (normalizeEmail(g.player1) !== myNorm && normalizeEmail(g.player2) !== myNorm) return jsonResp(403, { error: 'not your game' });
      if (g.status !== 'placing') return jsonResp(400, { error: 'placement phase over' });
      if (g.placedBy.includes(myEmail)) return jsonResp(400, { error: 'already placed' });
      const ships = body.ships;
      if (!Array.isArray(ships) || ships.length !== 5) return jsonResp(400, { error: 'must place exactly 5 ships' });
      const SHIP_SIZES = [5, 4, 3, 3, 2];
      const occupied = new Set();
      for (let i = 0; i < ships.length; i++) {
        const s = ships[i];
        const row = Number(s.row), col = Number(s.col);
        const dir = s.dir === 'v' ? 'v' : 'h';
        const size = SHIP_SIZES[i];
        if (row < 0 || row > 9 || col < 0 || col > 9) return jsonResp(400, { error: 'ship out of bounds' });
        const cells = [];
        for (let j = 0; j < size; j++) {
          const r = dir === 'v' ? row + j : row;
          const c2 = dir === 'h' ? col + j : col;
          if (r > 9 || c2 > 9) return jsonResp(400, { error: 'ship out of bounds' });
          const key = `${r},${c2}`;
          if (occupied.has(key)) return jsonResp(400, { error: 'ships overlap' });
          cells.push(key);
        }
        cells.forEach(k => occupied.add(k));
        ships[i] = { row, col, dir, size, cells, hits: 0 };
      }
      g.boards[myNorm].ships = ships;
      g.placedBy.push(myNorm);
      if (g.placedBy.length === 2) {
        g.turn = Math.random() < 0.5 ? g.player1 : g.player2;
        g.status = 'active';
      }
      return jsonResp(200, { ok: true, waiting: g.placedBy.length < 2 });
    }

    if (path === '/api/battleship/fire') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const g = bsGames[gameId];
      if (!g) return jsonResp(404, { error: 'game not found' });
      if (normalizeEmail(g.player1) !== myNorm && normalizeEmail(g.player2) !== myNorm) return jsonResp(403, { error: 'not your game' });
      if (g.status !== 'active') return jsonResp(400, { error: 'game not active' });
      if (normalizeEmail(g.turn) !== myNorm) return jsonResp(400, { error: 'not your turn' });
      const row = Number(body.row), col = Number(body.col);
      if (isNaN(row) || isNaN(col) || row < 0 || row > 9 || col < 0 || col > 9) return jsonResp(400, { error: 'invalid coordinate' });
      const oppEmail = normalizeEmail(g.player1) === myNorm ? normalizeEmail(g.player2) : normalizeEmail(g.player1);
      const oppBoard = g.boards[oppEmail];
      const coordKey = `${row},${col}`;
      if (oppBoard.hits.includes(coordKey) || oppBoard.misses.includes(coordKey)) {
        return jsonResp(400, { error: 'already fired there' });
      }
      let hitShip = null;
      for (const ship of oppBoard.ships) {
        if (ship.cells.includes(coordKey)) { hitShip = ship; break; }
      }
      const now = Date.now();
      g.lastActionAt = now;
      let result = 'miss';
      let sunk = false;
      let sunkShip = null;
      if (hitShip) {
        oppBoard.hits.push(coordKey);
        hitShip.hits++;
        result = 'hit';
        g.hitLog.push({ by: myNorm, at: now });
        if (hitShip.hits >= hitShip.size) { sunk = true; sunkShip = hitShip; result = 'sunk'; }
        // Anti-cheat: check collusion
        if (g.hitLog.length >= 6) {
          const recent = g.hitLog.slice(-6);
          const span = recent[recent.length - 1].at - recent[0].at;
          const totalFired = oppBoard.hits.length + oppBoard.misses.length;
          const hitRate = oppBoard.hits.length / Math.max(totalFired, 1);
          if (span < 12000 && hitRate > 0.85 && totalFired <= 15) g.collusionFlag = true;
        }
      } else {
        oppBoard.misses.push(coordKey);
      }
      const allSunk = oppBoard.ships.every(s => s.hits >= s.size);
      if (allSunk) {
        g.status = 'over';
        g.winner = myNorm;
        g.result = `${myNorm} wins`;
        if (!g.collusionFlag) {
          const bet = g.bet || 0;
          let winCoins = 40 + (bet * 2);
          if (areFriends(g.player1, g.player2)) winCoins = Math.floor(winCoins * 1.5);
          if (isPremiumEmail(myNorm)) winCoins = Math.floor(winCoins * 2);
          addCoins(myNorm, winCoins, `battleship: win payout (bet=${g.bet}, friend=${areFriends(g.player1,g.player2)}, premium=${isPremiumEmail(myNorm)})`);
          updateStat(myNorm, 'battleship_wins', 1);
        } else {
          g.result = `${myNorm} wins (collusion detected — no payout)`;
        }
      } else {
        if (result === 'miss') g.turn = oppEmail;
      }
      return jsonResp(200, {
        ok: true, result, sunk,
        sunkShip: sunk ? { size: sunkShip.size, cells: sunkShip.cells } : null,
        gameOver: allSunk, collusionFlag: g.collusionFlag
      });
    }

    if (path === '/api/battleship/state') {
      const gameId = qs.get('id') || '';
      const g = bsGames[gameId];
      if (!g) return jsonResp(404, { error: 'game not found' });
      if (normalizeEmail(g.player1) !== myNorm && normalizeEmail(g.player2) !== myNorm) return jsonResp(403, { error: 'not your game' });
      const oppEmail = myNorm === normalizeEmail(g.player1) ? normalizeEmail(g.player2) : normalizeEmail(g.player1);
      const myBoard = g.boards[myNorm];
      const oppBoard = g.boards[oppEmail];
      return jsonResp(200, {
        myEmail: maskEmail(myEmail),
        game: {
          id: g.id, status: g.status, turn: g.turn ? maskEmail(g.turn) : null,
          winner: g.winner ? maskEmail(g.winner) : null, result: g.result ? g.result.replace(new RegExp(g.player1, 'g'), maskEmail(g.player1)).replace(new RegExp(g.player2, 'g'), maskEmail(g.player2)) : null,
          collusionFlag: g.collusionFlag, placedBy: (g.placedBy || []).map(maskEmail),
          myShips: myBoard.ships,
          myHits: myBoard.hits, myMisses: myBoard.misses,
          oppHits: oppBoard.hits, oppMisses: oppBoard.misses,
          oppShips: g.status === 'over' ? oppBoard.ships : null,
          bet: g.bet, player1: maskEmail(g.player1), player2: maskEmail(g.player2),
          myBoardPlaced: !!myBoard.ships, oppBoardPlaced: !!oppBoard.ships,
        }
      });
    }

    if (path === '/api/battleship/resign') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const g = bsGames[gameId];
      if (!g || (normalizeEmail(g.player1) !== myNorm && normalizeEmail(g.player2) !== myNorm)) return jsonResp(403, {});
      if (g.status !== 'active' && g.status !== 'placing') return jsonResp(400, { error: 'game already over' });
      const oppEmail = myNorm === normalizeEmail(g.player1) ? normalizeEmail(g.player2) : normalizeEmail(g.player1);
      g.status = 'over'; g.winner = oppEmail; g.result = `${myNorm} resigned`;
      if (!g.collusionFlag) {
        let winCoins = 40 + ((g.bet || 0) * 2);
        if (areFriends(g.player1, g.player2)) winCoins = Math.floor(winCoins * 1.5);
        if (isPremiumEmail(oppEmail)) winCoins = Math.floor(winCoins * 2);
        addCoins(oppEmail, winCoins, `battleship: win on resign (opponent=${myNorm})`);
        updateStat(oppEmail, 'battleship_wins', 1);
      }
      return jsonResp(200, { ok: true });
    }
  }

  // ── Jeopardy Routes ───────────────────────────────────────────────────────────
  if (path.startsWith('/api/jeopardy/')) {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!sid || !validId(sid) || isRevoked(sid)) return jsonResp(401, { error: 'auth required' });
    const names = loadJson(NAMES_FILE, {});
    const myEmail = (names[sid] || '').toLowerCase();
    if (!myEmail) return jsonResp(403, { error: 'not found' });
    const myNorm = normalizeEmail(myEmail);

    async function evaluateFinalJeopardy(lobby) {
      const fj = lobby.finalJeopardy;
      if (!fj) return;
      fj.phase = 'reveal';
      fj.revealCloseAt = Date.now() + 10000;
      fj.revealedAnswers = {};
      for (const p of lobby.players) {
        const given = fj.answers[p] || '';
        const wager = fj.wagers[p] || 0;
        const correct = given ? await jeopardyAnswerMatches(given, fj.answer) : false;
        const scoreChange = correct ? wager : -wager;
        lobby.scores[p] = (lobby.scores[p] || 0) + scoreChange;
        fj.revealedAnswers[p] = {
          answer: given,
          correct,
          scoreChange,
          wager
        };
      }
    }

    function endJeopardyGame(lobby) {
      lobby.status = 'over';
      const topScore = Math.max(...Object.values(lobby.scores));
      const winners = Object.entries(lobby.scores).filter(([, s]) => s === topScore).map(([e]) => e);
      const playerCount = lobby.players.length;
      const baseCoins = 120;
      for (const w of winners) {
        let coins = baseCoins;
        if (lobby.players.some(p => p !== w && areFriends(w, p))) coins = Math.floor(coins * 1.5);
        if (isPremiumEmail(w)) coins = Math.floor(coins * 2);
        addCoins(w, coins, `jeopardy: win payout (players=${playerCount}, score=$${topScore}, friend bonus=${lobby.players.some(p => p !== w && areFriends(w, p))}, premium=${isPremiumEmail(w)})`);
        updateStat(w, 'jeopardy_wins', 1);
      }
      lobby.finalScore = { ...lobby.scores };
    }

    async function jeopardyCheckTimeouts(lobby) {
      if (lobby.status === 'final_jeopardy' && lobby.finalJeopardy) {
        const now = Date.now();
        if (lobby.finalJeopardy.phase === 'wagering') {
          if (lobby.finalJeopardy.wagerDeadline && now > lobby.finalJeopardy.wagerDeadline) {
            for (const p of lobby.players) {
              if (lobby.finalJeopardy.wagers[p] === undefined) {
                lobby.finalJeopardy.wagers[p] = 0;
              }
            }
            lobby.finalJeopardy.phase = 'answering';
            lobby.finalJeopardy.answerDeadline = now + 30000;
          }
        }
        if (lobby.finalJeopardy.phase === 'answering') {
          if (lobby.finalJeopardy.answerDeadline && now > lobby.finalJeopardy.answerDeadline) {
            await evaluateFinalJeopardy(lobby);
          }
        }
        if (lobby.finalJeopardy.phase === 'reveal') {
          if (lobby.finalJeopardy.revealCloseAt && now > lobby.finalJeopardy.revealCloseAt) {
            endJeopardyGame(lobby);
          }
        }
        return;
      }

      if (!lobby.activeClue) return;
      const now = Date.now();
      const phase = lobby.activeClue.phase;

      // 1. Buzzing Timeout
      if (phase === 'buzzing') {
        if (lobby.activeClue.buzzOpenAt) {
          const buzzDeadline = lobby.activeClue.buzzOpenAt + 15000; // 15 seconds to buzz
          if (now > buzzDeadline) {
            const cat = lobby.activeClue.cat;
            const val = lobby.activeClue.val;
            const clue = lobby.board[cat].find(c => c.value === val);
            if (clue) { clue.answered = true; clue.answeredBy = null; }
            lobby.activeClue.phase = 'reveal';
            lobby.activeClue.revealedCorrect = false;
            lobby.activeClue.revealCloseAt = now + 5000;
          }
        }
      }

      // 2. Answering Timeout
      if (phase === 'answering') {
        if (lobby.activeClue.answerDeadline && now > lobby.activeClue.answerDeadline) {
          const cat = lobby.activeClue.cat;
          const val = lobby.activeClue.val;
          const isDailyDouble = lobby.activeClue.isDailyDouble;
          const expected = isDailyDouble ? lobby.turn : lobby.activeClue.buzzedBy;
          if (expected) {
            const wager = lobby.activeClue.wager || val;
            const penalty = isDailyDouble ? -wager : -val;
            lobby.scores[expected] = (lobby.scores[expected] || 0) + penalty;
            if (!lobby.activeClue.wrongPlayers) lobby.activeClue.wrongPlayers = [];
            if (!lobby.activeClue.wrongPlayers.includes(expected)) {
              lobby.activeClue.wrongPlayers.push(expected);
            }
          }
          const remainingPlayers = lobby.players.filter(p => !lobby.activeClue.wrongPlayers.includes(p));
          if (isDailyDouble || remainingPlayers.length === 0) {
            const clue = lobby.board[cat].find(c => c.value === val);
            if (clue) { clue.answered = true; clue.answeredBy = null; }
            lobby.activeClue.phase = 'reveal';
            lobby.activeClue.revealedCorrect = false;
            lobby.activeClue.revealCloseAt = now + 5000;
          } else {
            lobby.activeClue.phase = 'buzzing';
            lobby.activeClue.buzzedBy = null;
            lobby.activeClue.buzzer = null;
            lobby.activeClue.buzzOpenAt = now + 1000;
            lobby.activeClue.answerDeadline = null;
          }
        }
      }

      // 3. Wagering Timeout
      if (phase === 'wagering') {
        if (lobby.activeClue.wagerOpenAt && now > lobby.activeClue.wagerOpenAt + 25000) {
          const turnEmail = lobby.turn;
          const wager = 5; // Min wager
          lobby.activeClue.wager = wager;
          lobby.activeClue.wagerBy = turnEmail;
          lobby.activeClue.phase = 'answering';
          lobby.activeClue.answerDeadline = now + 20000;
        }
      }

      // 4. Reveal Timeout
      if (phase === 'reveal') {
        if (lobby.activeClue.revealCloseAt && now > lobby.activeClue.revealCloseAt) {
          const allDone = lobby.categories && lobby.categories.every(cat2 =>
            lobby.board[cat2] && lobby.board[cat2].every(cl => cl.answered)
          );
          if (allDone) {
            const finalClue = getFinalJeopardyClue(lobby.categories);
            if (finalClue) {
              lobby.status = 'final_jeopardy';
              lobby.finalJeopardy = {
                cat: finalClue.category,
                clue: finalClue.clue,
                answer: finalClue.answer,
                wagers: {},
                answers: {},
                phase: 'wagering',
                wagerDeadline: now + 30000,
                answerDeadline: null,
                revealCloseAt: null,
                revealedAnswers: {},
              };
            } else {
              endJeopardyGame(lobby);
            }
          }
          lobby.activeClue = null;
        }
      }
    }

    if (path === '/api/jeopardy/state') {
      const gameId = qs.get('id') || '';
      const lobby = jeopardyLobbies[gameId];
      if (!lobby) return jsonResp(404, { error: 'game not found' });
      if (!lobby.players.includes(myNorm)) return jsonResp(403, { error: 'not in this game' });
      
      await jeopardyCheckTimeouts(lobby);
      const safeBoard = {};
      if (lobby.board) {
        for (const [cat, clues] of Object.entries(lobby.board)) {
          safeBoard[cat] = clues.map(cl => ({
            value: cl.value, answered: cl.answered, answeredBy: cl.answeredBy ? maskEmail(cl.answeredBy) : null,
            dailyDouble: cl.dailyDouble,
            clue: (lobby.activeClue && lobby.activeClue.cat === cat && lobby.activeClue.val === cl.value) ? cl.clue : null,
          }));
        }
      }
      const maskedScores = {};
      for (const [e, s] of Object.entries(lobby.scores || {})) {
        maskedScores[maskEmail(e)] = s;
      }
      return jsonResp(200, {
        myEmail: maskEmail(myEmail),
        id: lobby.id, status: lobby.status, host: maskEmail(lobby.host),
        players: (lobby.players || []).map(maskEmail), scores: maskedScores,
        categories: lobby.categories, board: safeBoard,
        activeClue: lobby.activeClue ? {
          cat: lobby.activeClue.cat, val: lobby.activeClue.val,
          clue: lobby.activeClue.clue, phase: lobby.activeClue.phase,
          buzzer: lobby.activeClue.buzzer, buzzedBy: lobby.activeClue.buzzedBy ? maskEmail(lobby.activeClue.buzzedBy) : null,
          isDailyDouble: lobby.activeClue.isDailyDouble,
          wager: lobby.activeClue.wager, wagerBy: lobby.activeClue.wagerBy ? maskEmail(lobby.activeClue.wagerBy) : null,
          revealAnswer: lobby.activeClue.phase === 'reveal' ? lobby.activeClue.answer : null,
          revealedCorrect: lobby.activeClue.revealedCorrect,
          buzzOpenAt: lobby.activeClue.buzzOpenAt,
          answerDeadline: lobby.activeClue.answerDeadline,
          tabPenaltyApplied: lobby.activeClue.tabPenaltyFor && lobby.activeClue.tabPenaltyFor.includes(myNorm),
          wrongPlayers: lobby.activeClue.wrongPlayers ? lobby.activeClue.wrongPlayers.map(maskEmail) : [],
        } : null,
        finalJeopardy: lobby.finalJeopardy ? {
          cat: lobby.finalJeopardy.cat,
          clue: lobby.finalJeopardy.phase !== 'wagering' ? lobby.finalJeopardy.clue : null,
          phase: lobby.finalJeopardy.phase,
          wagerDeadline: lobby.finalJeopardy.wagerDeadline,
          answerDeadline: lobby.finalJeopardy.answerDeadline,
          revealCloseAt: lobby.finalJeopardy.revealCloseAt,
          wagerSubmitted: lobby.finalJeopardy.wagers[myNorm] !== undefined,
          answerSubmitted: lobby.finalJeopardy.answers[myNorm] !== undefined,
          revealAnswer: lobby.finalJeopardy.phase === 'reveal' ? lobby.finalJeopardy.answer : null,
          revealedAnswers: lobby.finalJeopardy.phase === 'reveal' ? Object.fromEntries(
            Object.entries(lobby.finalJeopardy.revealedAnswers || {}).map(([e, obj]) => [
              maskEmail(e),
              {
                answer: obj.answer,
                correct: obj.correct,
                scoreChange: obj.scoreChange,
                wager: obj.wager
              }
            ])
          ) : null,
        } : null,
        turn: lobby.turn ? maskEmail(lobby.turn) : null, roundOver: lobby.roundOver, finalScore: lobby.finalScore ? Object.fromEntries(Object.entries(lobby.finalScore).map(([e, s]) => [maskEmail(e), s])) : null,
        joinCode: lobby.host === myNorm ? lobby.joinCode : undefined,
        clueDbReady: jeopardyClueCache.length >= 100,
      });
    }

    if (path === '/api/jeopardy/create') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const maxPlayers = Math.min(10, Math.max(2, parseInt(body.maxPlayers) || 10));
      const gameId = randomBytes(8).toString('hex');
      const joinCode = randomBytes(3).toString('hex').toUpperCase();
      jeopardyLobbies[gameId] = {
        id: gameId, joinCode, host: myNorm,
        players: [myNorm], maxPlayers, status: 'lobby',
        scores: { [myNorm]: 0 }, categories: null,
        board: null, activeClue: null, turn: myNorm,
        createdAt: Date.now(), tabHidden: {},
        roundOver: false, finalScore: null,
      };
      return jsonResp(200, { ok: true, gameId, joinCode });
    }

    if (path === '/api/jeopardy/join') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const joinCode = String(body.joinCode || '').toUpperCase().trim();
      const lobby = Object.values(jeopardyLobbies).find(l => l.joinCode === joinCode && l.status === 'lobby');
      if (!lobby) return jsonResp(404, { error: 'Game not found or already started' });
      if (lobby.players.length >= lobby.maxPlayers) return jsonResp(400, { error: 'Game is full' });
      if (lobby.players.includes(myNorm)) return jsonResp(400, { error: 'Already in game' });
      lobby.players.push(myNorm);
      lobby.scores[myNorm] = 0;
      return jsonResp(200, { ok: true, gameId: lobby.id });
    }

    if (path === '/api/jeopardy/start') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby) return jsonResp(404, { error: 'game not found' });
      if (lobby.host !== myNorm) return jsonResp(403, { error: 'only host can start' });
      if (lobby.status !== 'lobby') return jsonResp(400, { error: 'game already started' });
      if (lobby.players.length < 2) return jsonResp(400, { error: 'need at least 2 players' });
      if (jeopardyClueCache.length < 100) return jsonResp(503, { error: 'Jeopardy clue database not yet loaded, please try again in a moment' });
      const boardData = buildJeopardyBoard();
      if (!boardData) return jsonResp(503, { error: 'Could not build board, try again' });
      lobby.board = boardData.board;
      lobby.categories = boardData.categories;
      lobby.status = 'active';
      lobby.turn = lobby.players[Math.floor(Math.random() * lobby.players.length)];
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/jeopardy/select') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby) return jsonResp(404, { error: 'game not found' });
      if (!lobby.players.includes(myNorm)) return jsonResp(403, { error: 'not in game' });
      if (lobby.status !== 'active') return jsonResp(400, { error: 'game not active' });
      if (lobby.turn !== myNorm) return jsonResp(400, { error: 'not your turn to select' });
      if (lobby.activeClue) return jsonResp(400, { error: 'a clue is already active' });
      const cat = String(body.category || '');
      const val = Number(body.value);
      if (!lobby.categories || !lobby.categories.includes(cat)) return jsonResp(400, { error: 'invalid category' });
      const clueArr = lobby.board[cat];
      const clue = clueArr ? clueArr.find(c => c.value === val) : null;
      if (!clue) return jsonResp(400, { error: 'invalid clue' });
      if (clue.answered) return jsonResp(400, { error: 'already answered' });
      const now = Date.now();
      lobby.activeClue = {
        cat, val, clue: clue.clue, answer: clue.answer,
        isDailyDouble: clue.dailyDouble,
        phase: clue.dailyDouble ? 'wagering' : 'buzzing',
        buzzOpenAt: clue.dailyDouble ? null : now + 2000,
        wagerOpenAt: clue.dailyDouble ? now : null,
        answerDeadline: null,
        buzzedBy: null, buzzer: null,
        wager: null, wagerBy: null, tabPenaltyFor: [],
        wrongPlayers: [],
      };
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/jeopardy/wager') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby || !lobby.players.includes(myNorm)) return jsonResp(403, {});
      if (!lobby.activeClue || lobby.activeClue.phase !== 'wagering') return jsonResp(400, { error: 'not wagering phase' });
      if (lobby.turn !== myNorm) return jsonResp(403, { error: 'only active player wagers' });
      const myScore = lobby.scores[myNorm] || 0;
      const maxWager = Math.max(1000, myScore);
      const wager = Math.min(maxWager, Math.max(0, Math.floor(Number(body.wager) || 0)));
      lobby.activeClue.wager = wager;
      lobby.activeClue.wagerBy = myNorm;
      lobby.activeClue.phase = 'answering';
      lobby.activeClue.answerDeadline = Date.now() + 30000;
      return jsonResp(200, { ok: true, wager });
    }

    if (path === '/api/jeopardy/buzz') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby || !lobby.players.includes(myNorm)) return jsonResp(403, {});
      if (!lobby.activeClue || lobby.activeClue.phase !== 'buzzing') return jsonResp(400, { error: 'not buzzing phase' });
      if (lobby.activeClue.wrongPlayers && lobby.activeClue.wrongPlayers.includes(myNorm)) return jsonResp(400, { error: 'already guessed incorrectly' });
      const now = Date.now();
      if (lobby.activeClue.buzzOpenAt && now < lobby.activeClue.buzzOpenAt) return jsonResp(400, { error: 'buzzer not open yet' });
      if (lobby.activeClue.buzzedBy) return jsonResp(400, { error: 'someone already buzzed' });
      lobby.activeClue.buzzedBy = myNorm;
      lobby.activeClue.buzzer = now;
      lobby.activeClue.phase = 'answering';
      lobby.activeClue.answerDeadline = now + 20000;
      return jsonResp(200, { ok: true, buzzedAt: now });
    }

    if (path === '/api/jeopardy/answer') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby || !lobby.players.includes(myNorm)) return jsonResp(403, {});
      if (!lobby.activeClue || lobby.activeClue.phase !== 'answering') return jsonResp(400, { error: 'not answering phase' });
      const expected = lobby.activeClue.isDailyDouble ? lobby.turn : lobby.activeClue.buzzedBy;
      if (expected !== myNorm) return jsonResp(403, { error: 'not your turn to answer' });
      const givenAnswer = String(body.answer || '').trim().slice(0, 300);
      const correctAnswer = lobby.activeClue.answer;
      const now = Date.now();
      const past_deadline = lobby.activeClue.answerDeadline && now > lobby.activeClue.answerDeadline;
      const tabPenalty = lobby.activeClue.tabPenaltyFor && lobby.activeClue.tabPenaltyFor.includes(myNorm);
      let correct = false;
      if (!past_deadline && !tabPenalty && givenAnswer) {
        correct = await jeopardyAnswerMatches(givenAnswer, correctAnswer);
      }
      const cat = lobby.activeClue.cat;
      const val = lobby.activeClue.val;
      const isDailyDouble = lobby.activeClue.isDailyDouble;
      const wager = lobby.activeClue.wager || val;
      let scoreChange = 0;
      if (correct) {
        scoreChange = isDailyDouble ? wager : val;
        lobby.scores[myNorm] = (lobby.scores[myNorm] || 0) + scoreChange;
        const clue = lobby.board[cat].find(c => c.value === val);
        if (clue) { clue.answered = true; clue.answeredBy = myNorm; }
        lobby.activeClue.phase = 'reveal';
        lobby.activeClue.revealedCorrect = true;
        lobby.turn = myNorm;
      } else {
        const penalty = tabPenalty ? -500 : (isDailyDouble ? -wager : -val);
        scoreChange = penalty;
        lobby.scores[myNorm] = (lobby.scores[myNorm] || 0) + penalty;
        
        if (!lobby.activeClue.wrongPlayers) lobby.activeClue.wrongPlayers = [];
        if (!lobby.activeClue.wrongPlayers.includes(myNorm)) {
          lobby.activeClue.wrongPlayers.push(myNorm);
        }
        
        const remainingPlayers = lobby.players.filter(p => !lobby.activeClue.wrongPlayers.includes(p));
        if (isDailyDouble || remainingPlayers.length === 0) {
          lobby.activeClue.phase = 'reveal';
          lobby.activeClue.revealedCorrect = false;
          const clue = lobby.board[cat].find(c => c.value === val);
          if (clue) { clue.answered = true; clue.answeredBy = null; }
        } else {
          lobby.activeClue.phase = 'buzzing';
          lobby.activeClue.buzzedBy = null;
          lobby.activeClue.buzzer = null;
          lobby.activeClue.buzzOpenAt = Date.now() + 1000;
          lobby.activeClue.answerDeadline = null;
        }
      }
      lobby.activeClue.revealCloseAt = Date.now() + 5000;
      
      const hideCorrectAnswer = lobby.activeClue.phase === 'buzzing';
      return jsonResp(200, {
        ok: true, correct,
        correctAnswer: hideCorrectAnswer ? null : correctAnswer,
        scoreChange,
        gameOver: false,
        finalScore: null,
      });
    }

    if (path === '/api/jeopardy/visibility') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby || !lobby.players.includes(myNorm)) return jsonResp(403, {});
      const hidden = !!body.hidden;
      const now = Date.now();
      if (hidden && lobby.activeClue) {
        const phase = lobby.activeClue.phase;
        if (['buzzing', 'answering', 'wagering'].includes(phase)) {
          lobby.activeClue.tabPenaltyFor = lobby.activeClue.tabPenaltyFor || [];
          if (!lobby.activeClue.tabPenaltyFor.includes(myNorm)) {
            lobby.activeClue.tabPenaltyFor.push(myNorm);
            
            // Deduct penalty immediately!
            const penalty = -500;
            lobby.scores[myNorm] = (lobby.scores[myNorm] || 0) + penalty;
            
            // Auto-fail the clue immediately if they were currently expected to wager/answer
            const expected = lobby.activeClue.isDailyDouble ? lobby.turn : lobby.activeClue.buzzedBy;
            if (expected === myNorm && (phase === 'answering' || phase === 'wagering')) {
              const cat = lobby.activeClue.cat;
              const val = lobby.activeClue.val;
              if (!lobby.activeClue.wrongPlayers) lobby.activeClue.wrongPlayers = [];
              if (!lobby.activeClue.wrongPlayers.includes(myNorm)) {
                lobby.activeClue.wrongPlayers.push(myNorm);
              }
              const remainingPlayers = lobby.players.filter(p => !lobby.activeClue.wrongPlayers.includes(p));
              if (lobby.activeClue.isDailyDouble || remainingPlayers.length === 0) {
                lobby.activeClue.phase = 'reveal';
                lobby.activeClue.revealedCorrect = false;
                lobby.activeClue.revealCloseAt = now + 5000;
                const clue = lobby.board[cat].find(c => c.value === val);
                if (clue) { clue.answered = true; clue.answeredBy = null; }
              } else {
                lobby.activeClue.phase = 'buzzing';
                lobby.activeClue.buzzedBy = null;
                lobby.activeClue.buzzer = null;
                lobby.activeClue.buzzOpenAt = now + 1000;
                lobby.activeClue.answerDeadline = null;
              }
            }
          }
        }
      }
      if (!lobby.tabHidden) lobby.tabHidden = {};
      lobby.tabHidden[myNorm] = hidden;
      return jsonResp(200, { ok: true });
    }

    if (path === '/api/jeopardy/final/wager') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby || !lobby.players.includes(myNorm)) return jsonResp(403, {});
      if (lobby.status !== 'final_jeopardy' || !lobby.finalJeopardy || lobby.finalJeopardy.phase !== 'wagering') {
        return jsonResp(400, { error: 'not final jeopardy wagering phase' });
      }
      if (lobby.finalJeopardy.wagers[myNorm] !== undefined) {
        return jsonResp(400, { error: 'already wagered' });
      }
      const myScore = lobby.scores[myNorm] || 0;
      const maxWager = Math.max(1000, myScore);
      const wager = Math.min(maxWager, Math.max(0, Math.floor(Number(body.wager) || 0)));
      lobby.finalJeopardy.wagers[myNorm] = wager;

      const allWagered = lobby.players.every(p => lobby.finalJeopardy.wagers[p] !== undefined);
      if (allWagered) {
        lobby.finalJeopardy.phase = 'answering';
        lobby.finalJeopardy.answerDeadline = Date.now() + 30000;
      }
      return jsonResp(200, { ok: true, wager });
    }

    if (path === '/api/jeopardy/final/answer') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const gameId = String(body.gameId || '');
      const lobby = jeopardyLobbies[gameId];
      if (!lobby || !lobby.players.includes(myNorm)) return jsonResp(403, {});
      if (lobby.status !== 'final_jeopardy' || !lobby.finalJeopardy || lobby.finalJeopardy.phase !== 'answering') {
        return jsonResp(400, { error: 'not final jeopardy answering phase' });
      }
      if (lobby.finalJeopardy.answers[myNorm] !== undefined) {
        return jsonResp(400, { error: 'already answered' });
      }
      const answer = String(body.answer || '').trim().slice(0, 300);
      lobby.finalJeopardy.answers[myNorm] = answer;

      const allAnswered = lobby.players.every(p => lobby.finalJeopardy.answers[p] !== undefined);
      if (allAnswered) {
        await evaluateFinalJeopardy(lobby);
      }
      return jsonResp(200, { ok: true });
    }
  }

  // ── Team POST routes (no enrollment auth) ────────────────────────────────────
  function checkTeamTokenPost(req) {
    const auth = req.headers.get('Authorization') || '';
    const tok  = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!tok) return null;
    const tokens = loadJson(TEAM_TOKENS_FILE, {});
    return tokens[tok] ? { token: tok, ...tokens[tok] } : null;
  }

  if (path === '/api/team/reply') {
    const member = checkTeamTokenPost(req);
    if (!member) return jsonResp(401, { error: 'Invalid team token' });
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const { to, subject, body: replyBody, inReplyTo } = body;
    if (!to || !subject || !replyBody) return jsonResp(400, { error: 'missing fields' });
    const args = ['node', SUPPORT_SEND_SCRIPT, '--raw'];
    if (inReplyTo) { args.push('--in-reply-to'); args.push(inReplyTo); }
    args.push(to, subject, replyBody);
    const r = spawnSync(args[0], args.slice(1), { encoding: 'utf8', timeout: 30_000 });
    if (r.status !== 0) return jsonResp(500, { error: r.stderr?.trim() || 'send failed' });
    console.log(`[team] reply to ${to} by ${member.name}`);

    // Append sent message to cache so it shows up immediately on next inbox fetch
    try {
      const cache = loadJson(TEAM_INBOX_CACHE, []);
      cache.push({
        uid: Date.now(),
        mailbox: 'Sent',
        dir: 'out',
        from: 'support@mitch.pro',
        fromName: 'mitch.pro Support',
        to,
        subject,
        threadKey: threadKey(subject),
        date: new Date().toISOString(),
        messageId: '',
        seen: true,
        body: replyBody,
      });
      cache.sort((a, b) => new Date(b.date) - new Date(a.date));
      saveJson(TEAM_INBOX_CACHE, cache);
    } catch {}

    return jsonResp(200, { ok: true });
  }

  if (path === '/api/team/handled') {
    if (!checkTeamTokenPost(req)) return jsonResp(401, { error: 'Invalid team token' });
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const uid = String(body.uid || '');
    const val = !!body.handled;
    if (!uid) return jsonResp(400, { error: 'uid required' });
    const handled = loadJson(TEAM_HANDLED_FILE, {});
    if (val) handled[uid] = Date.now(); else delete handled[uid];
    saveJson(TEAM_HANDLED_FILE, handled);
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/team/unsubscribe') {
    const member = checkTeamTokenPost(req);
    if (!member) return jsonResp(401, { error: 'Invalid team token' });
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return jsonResp(400, { error: 'email required' });
    const unsub = loadJson(NEWSLETTER_UNSUB_FILE, []);
    if (!unsub.includes(email)) {
      unsub.push(email);
      writeFileSync(NEWSLETTER_UNSUB_FILE, JSON.stringify([...new Set(unsub)].sort(), null, 2));
    }
    console.log(`[team] unsubscribed ${email} by ${member.name}`);
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/team/gmail-toggle') {
    const member = checkTeamTokenPost(req);
    if (!member) return jsonResp(401, { error: 'Invalid team token' });
    if (existsSync(GMAIL_PAUSE_FILE)) {
      rmSync(GMAIL_PAUSE_FILE);
      console.log(`[team] gmail scraping resumed by ${member.name}`);
      return jsonResp(200, { paused: false });
    } else {
      writeFileSync(GMAIL_PAUSE_FILE, '');
      console.log(`[team] gmail scraping paused by ${member.name}`);
      return jsonResp(200, { paused: true });
    }
  }

  if (path === '/api/team/gmail-reply') {
    const member = checkTeamTokenPost(req);
    if (!member) return jsonResp(401, { error: 'Invalid team token' });
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const { to, subject, body: replyBody, messageId, threadKey } = body;
    if (!to || !subject || !replyBody) return jsonResp(400, { error: 'missing fields' });
    const sendScript = join(BASE, 'mail', 'send_email.js');
    const args = ['--raw', ...(messageId ? ['--in-reply-to', `<${messageId}>`] : []), to, subject, replyBody];
    const r = spawnSync('node', [sendScript, ...args],
      { encoding: 'utf8', timeout: 40_000, cwd: BASE });
    if (r.status !== 0) return jsonResp(500, { error: r.stderr?.trim() || 'send failed' });
    const key = threadKey || messageId || (to + '|' + subject);
    const sent = loadJson(GMAIL_SENT_FILE, {});
    if (!sent[key]) sent[key] = [];
    sent[key].push({ body: replyBody, date: new Date().toISOString() });
    saveJson(GMAIL_SENT_FILE, sent);
    console.log(`[team] gmail reply to ${to} by ${member.name}`);
    return jsonResp(200, { ok: true });
  }

  // ── Canvas API ─────────────────────────────────────────────────────────────
  if (path === '/api/canvas/pixels') {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid) || '';
    
    let chunksParam = '';
    let zoneId = null;
    
    if (method === 'POST') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      chunksParam = body.chunks;
      zoneId = body.zoneId;
    } else {
      chunksParam = qs.get('chunks');
      zoneId = qs.get('zoneId');
    }
    
    if (zoneId) {
      if (!checkZoneAccess(zoneId, email, sid)) {
        return jsonResp(403, { error: 'forbidden', reason: 'No access to this zone' });
      }
      const zonePixels = getZonePixels(zoneId);
      const zoneChunks = zoneChunksMap.get(zoneId);
      
      if (!chunksParam) return jsonResp(200, zonePixels);
      
      const requested = Array.isArray(chunksParam) ? chunksParam : String(chunksParam || '').split(';');
      const result = {};
      for (const ck of requested) {
        const chunk = zoneChunks.get(ck);
        if (chunk) Object.assign(result, chunk);
      }
      return jsonResp(200, result);
    }
    
    if (!chunksParam) return jsonResp(200, canvasPixels);
    const requested = Array.isArray(chunksParam) ? chunksParam : String(chunksParam || '').split(';');
    const result = {};
    for (const ck of requested) {
      const chunk = canvasChunks.get(ck);
      if (chunk) Object.assign(result, chunk);
    }
    return jsonResp(200, result);
  }

  if (path === '/api/canvas/history') {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid) || '';
    const zoneId = qs.get('zoneId');
    
    if (zoneId) {
      if (!checkZoneAccess(zoneId, email, sid)) {
        return jsonResp(403, { error: 'forbidden', reason: 'No access to this zone' });
      }
    }
    
    const historyFile = zoneId ? getZoneHistoryFile(zoneId) : CANVAS_HISTORY_FILE;
    let history = [];
    try {
      if (existsSync(historyFile)) {
        const content = readFileSync(historyFile, 'utf8');
        const lines = content.trim().split('\n');
        const recentLines = lines.slice(-5000);
        for (const line of recentLines) {
          if (line.trim()) history.push(JSON.parse(line));
        }
      }
    } catch (err) {
      console.error('Failed to load canvas history:', err);
    }
    return jsonResp(200, { history });
  }

  if (path === '/api/canvas/whoami') {
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const isAdmin = sid ? isAdminId(sid) : false;
    const isModerator = sid ? isModeratorId(sid) : false;
    const email = emailFromSid(sid) || null;
    const isPremium = email ? isPremiumEmail(email) : false;
    return jsonResp(200, { isAdmin, isModerator, email, isPremium });
  }

  if (path === '/api/canvas/admin-erase' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
    const adminEmail = emailFromSid(sid) || 'admin';
    const { x, y } = body;
    if (!canvasPixels[`${x},${y}`]) return jsonResp(404, { error: 'no pixel' });
    deleteCanvasPixel(x, y, 'admin', adminEmail);
    logAdminAction(adminEmail, 'canvas_erase', { x, y });
    return jsonResp(200, { ok: true });  }

  if (path === '/api/canvas/admin-ban' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
    const { painter, reason } = body;
    if (!painter) return jsonResp(400, { error: 'painter required' });
    const pEmail = Object.values(canvasPixels).find(p => p.painter === painter)?.email || null;    if (pEmail && normalizeEmail(pEmail) === normalizeEmail('admin@mitch.pro'))
      return jsonResp(403, { error: 'cannot ban admin' });
    const bannedData = loadJson(CANVAS_BANNED_FILE, {});
    bannedData[painter] = { reason: reason || 'banned by admin', ts: Date.now(), byAdmin: true };
    saveCanvasBans(bannedData);
    console.log(`[canvas] admin banned painter ${painter.slice(0, 12)}: ${reason || 'no reason'}`);
    logAdminAction(emailFromSid(sid) || 'admin', 'canvas_ban', { painter: painter.slice(0, 12), reason: reason || 'no reason' });
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/canvas/admin-unban' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
    const { painter } = body;
    if (!painter) return jsonResp(400, { error: 'painter required' });
    const bannedData = loadJson(CANVAS_BANNED_FILE, {});
    if (!bannedData[painter]) return jsonResp(404, { error: 'not banned' });
    delete bannedData[painter];
    saveCanvasBans(bannedData);
    console.log(`[canvas] admin unbanned painter ${painter.slice(0, 12)}`);
    logAdminAction(emailFromSid(sid) || 'admin', 'canvas_unban', { painter: painter.slice(0, 12) });
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/canvas/pixels/bulk' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid) || '';
    const premium = email ? isPremiumEmail(email) : false;
    const adminOk = isAnyAdminId(sid);
    
    const zoneId = body.zoneId;
    if (zoneId) {
      if (!checkZoneAccess(zoneId, email, sid)) {
        return jsonResp(403, { error: 'forbidden', reason: 'No access to this zone' });
      }
    } else {
      if (!adminOk && !premium) return jsonResp(403, { error: 'forbidden' });
    }

    const points = Array.isArray(body.pixels) ? body.pixels.slice(0, 2500) : [];
    if (!points.length) return jsonResp(400, { error: 'pixels required' });
    let count = 0;
    for (const p of points) {
      const x = Number(p?.x);
      const y = Number(p?.y);
      const color = String(p?.color || '');
      const painter = String(p?.painter || email || 'admin').slice(0, 120);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !/^#[0-9a-fA-F]{6}$/.test(color)) continue;
      if (Math.abs(x) > 500000 || Math.abs(y) > 500000) continue;
      const key = `${x},${y}`;
      const pixelData = {
        color,
        painter,
        ts: Date.now(),
        ...(adminOk ? { admin: true } : {}),
        ...(premium ? { premium: true } : {}),
        ...(email ? { email } : {})
      };
      setCanvasPixel(x, y, pixelData, zoneId);
      if (!zoneId) canvasHeatmap.set(key, Date.now());
      count++;
    }
    if (zoneId) {
      saveZonePixels(zoneId);
    } else {
      if (email && count) addPaintingCoin(email);
    }
    return jsonResp(200, { ok: true, count });
  }

  if (path === '/api/canvas/pixel' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const { x, y, color, painter, bypass, zoneId } = body;
    const brushSz = Math.min(50, Math.max(1, Number(body.brushSz) || 1));

    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    const adminOk = isAnyAdminId(sid);
    const premium = email ? isPremiumEmail(email) : false;

    if (zoneId) {
      if (!checkZoneAccess(zoneId, email, sid)) {
        return jsonResp(403, { error: 'forbidden', reason: 'No access to this zone' });
      }
    }

    // Zone members get full brush size but still respect rate limits
    const maxAllowedBrush = (adminOk || zoneId) ? 50 : (premium ? 16 : 8);
    if (brushSz > maxAllowedBrush) {
      return jsonResp(403, { error: 'forbidden', reason: 'brush size too large' });
    }

    const rl = checkRateLimit(req, path);
    if (rl && !bypass && !adminOk) return rl;

    if (rl && bypass && !adminOk) {
      if (!email) return jsonResp(401, { error: 'Login required to bypass cooldown' });
      const balance = getCoins(email);
      if (balance < 5) return jsonResp(429, { error: 'Insufficient coins to bypass cooldown (Need 5)' });
      addCoins(email, -5);
    }

    if (typeof x !== 'number' || typeof y !== 'number' || !color || !painter)
      return jsonResp(400, { error: 'missing fields' });
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return jsonResp(400, { error: 'invalid color' });
    if (Math.abs(x) > 500000 || Math.abs(y) > 500000) return jsonResp(400, { error: 'out of bounds' });
    if (canvasBanned[painter]) return jsonResp(403, { error: 'banned', reason: canvasBanned[painter].reason });
    if (!adminOk && !premium && PREMIUM_COLORS.has(color.toLowerCase())) return jsonResp(403, { error: 'premium_color' });

    const half = Math.floor(brushSz / 2);
    const pixelsToPaint = [];

    for (let bx = 0; bx < brushSz; bx++) {
      for (let by = 0; by < brushSz; by++) {
        const px = x - half + bx;
        const py = y - half + by;
        const pkey = `${px},${py}`;

        if (Math.abs(px) > 500000 || Math.abs(py) > 500000) continue;

        if (zoneId) {
          pixelsToPaint.push({ px, py, pkey });
          continue;
        }

        if (!adminOk && canvasLocks[pkey]) {
          const lock = canvasLocks[pkey];
          const isLockOwner = (email && normalizeEmail(lock.email) === normalizeEmail(email)) || lock.painter === painter;
          const expired = Date.now() > lock.expiresAt;
          if (!expired && !isLockOwner) continue;
          if (expired) delete canvasLocks[pkey];
        }

        if (!adminOk && canvasPixels[pkey]) {
          const isOwn = canvasPixels[pkey].painter === painter || (email && canvasPixels[pkey].email === email);
          if (!premium || !isOwn) continue;
        }

        pixelsToPaint.push({ px, py, pkey });
      }
    }

    if (email && shadowBans.has(normalizeEmail(email))) {
      return jsonResp(200, { ok: true }); // shadow success
    }

    const pixelData = {
      color,
      painter,
      ts: Date.now(),
      ...(email ? { email } : {}),
      ...(premium ? { premium: true } : {}),
      ...(adminOk ? { admin: true } : {})
    };

    for (const { px, py, pkey } of pixelsToPaint) {
      setCanvasPixel(px, py, pixelData, zoneId);
      if (!zoneId) {
        canvasHeatmap.set(pkey, Date.now());

        if (body.lock && pkey === `${x},${y}` && premium && email) {
          const norm = normalizeEmail(email);
          const stats = loadUserStats();
          if (!stats[norm]) stats[norm] = {};
          const now = Date.now();
          if (now - (stats[norm].last_lock_reset || 0) > 7 * 86400000) {
            stats[norm].last_lock_reset = now;
            stats[norm].week_locks = 0;
          }
          if ((stats[norm].week_locks || 0) < 16) {
            stats[norm].week_locks = (stats[norm].week_locks || 0) + 1;
            saveUserStats(stats);
            canvasLocks[pkey] = { email, painter, expiresAt: Date.now() + 86400000 };
            saveJson(CANVAS_LOCKS_FILE, canvasLocks);
          }
        }
      }
    }

    if (zoneId) {
      saveZonePixels(zoneId);
    } else {
      if (email) addPaintingCoin(email);
    }
    return jsonResp(200, { ok: true });  }

  if (path === '/api/canvas/erase' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const { x, y, painter, zoneId } = body;
    if (typeof x !== 'number' || typeof y !== 'number' || !painter)
      return jsonResp(400, { error: 'missing fields' });
    const brushSz = Math.min(50, Math.max(1, Number(body.brushSz) || 1));
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid) || '';
    const adminOk = isAnyAdminId(sid);
    const premium = email ? isPremiumEmail(email) : false;
    
    if (zoneId) {
      if (!checkZoneAccess(zoneId, email, sid)) {
        return jsonResp(403, { error: 'forbidden', reason: 'No access to this zone' });
      }
    }
    
    const maxAllowedBrush = adminOk ? 50 : (premium ? 16 : 8);
    if (brushSz > maxAllowedBrush) {
      return jsonResp(403, { error: 'forbidden', reason: 'brush size too large' });
    }
    
    const half = Math.floor(brushSz / 2);
    const sourcePixels = zoneId ? getZonePixels(zoneId) : canvasPixels;
    const zoneInfo = zoneId ? loadJson(CANVAS_ZONES_FILE, {})[zoneId] : null;
    const isOwner = zoneInfo && normalizeEmail(zoneInfo.owner) === normalizeEmail(email);

    for (let bx = 0; bx < brushSz; bx++) {
      for (let by = 0; by < brushSz; by++) {
        const px = x - half + bx;
        const py = y - half + by;
        const pkey = `${px},${py}`;
        if (!sourcePixels[pkey]) continue;
        if (!adminOk && !isOwner) {
          const isCreator = sourcePixels[pkey].painter === painter || (email && sourcePixels[pkey].email === email);
          if (!isCreator) continue;
        }
        deleteCanvasPixel(px, py, painter, email, zoneId);
      }
    }
    if (zoneId) {
      saveZonePixels(zoneId);
    }
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/canvas/moderate' && method === 'POST') {
    return jsonResp(200, { ok: true, flagged: false, disabled: true });
  }

  if (path === '/api/canvas/report' && method === 'POST') {
    return jsonResp(410, { error: 'Canvas review queue is disabled.' });
  }

  if (path === '/api/admin/canvas-report-status' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
    const id = String(body.id || '');
    const status = String(body.status || '').slice(0, 40);
    if (!id || !['Needs review', 'Reviewing', 'Resolved', 'Dismissed'].includes(status)) {
      return jsonResp(400, { error: 'invalid status' });
    }
    const reports = loadJson(CANVAS_REPORTS_FILE, []);
    const report = reports.find(r => r.id === id);
    if (!report) return jsonResp(404, { error: 'report found' });
    report.status = status;
    report.reviewedAt = Date.now();
    report.reviewedBy = emailFromSid(sid) || 'admin';
    saveJson(CANVAS_REPORTS_FILE, reports);
    logAdminAction(report.reviewedBy, 'canvas_report_status', { id, status });
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/canvas/bookmarks' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const { x, y, name, isPublic } = body;
    if (typeof x !== 'number' || typeof y !== 'number' || !name) {
      return jsonResp(400, { error: 'missing fields' });
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const bookmarks = loadJson(CANVAS_BOOKMARKS_FILE, []);
    const userToday = bookmarks.filter(b => b.creator === email && b.date === todayStr);
    if (isPublic) {
      const publicToday = userToday.filter(b => b.isPublic);
      if (publicToday.length >= 1) {
        return jsonResp(429, { error: 'You can only create 1 public bookmark per day.' });
      }
    } else {
      const privateToday = userToday.filter(b => !b.isPublic);
      if (privateToday.length >= 10) {
        return jsonResp(429, { error: 'You can only create 10 private bookmarks per day.' });
      }
    }
    const id = 'bm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const bm = {
      id,
      x: Number(x),
      y: Number(y),
      name: String(name || '').slice(0, 60),
      creator: email,
      isPublic: !!isPublic,
      approved: !isPublic,
      date: todayStr
    };
    bookmarks.push(bm);
    saveJson(CANVAS_BOOKMARKS_FILE, bookmarks);
    return jsonResp(200, { ok: true, bookmark: bm });
  }

  if (path === '/api/canvas/bookmarks' && method === 'GET') {
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const adminOk = isAnyAdminId(sid);
    const bookmarks = loadJson(CANVAS_BOOKMARKS_FILE, []);
    const visible = bookmarks.filter(b => {
      if (adminOk) return true;
      if (b.creator === email) return true;
      return b.isPublic && b.approved;
    });
    return jsonResp(200, { ok: true, bookmarks: visible });
  }

  if (path === '/api/canvas/bookmarks/approve' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    if (!isAnyAdminId(sid)) return jsonResp(403, { error: 'forbidden' });
    const { id } = body;
    if (!id) return jsonResp(400, { error: 'missing id' });
    const bookmarks = loadJson(CANVAS_BOOKMARKS_FILE, []);
    const bm = bookmarks.find(b => b.id === id);
    if (!bm) return jsonResp(404, { error: 'bookmark not found' });
    bm.approved = true;
    saveJson(CANVAS_BOOKMARKS_FILE, bookmarks);
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/canvas/zones' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
      return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
    const { name, description, friendsOnly } = body;
    if (!name) return jsonResp(400, { error: 'missing fields' });

    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const normEmail = normalizeEmail(email);
    const userZonesCount = Object.values(zones).filter(z => normalizeEmail(z.owner) === normEmail).length;
    if (userZonesCount >= 10) {
      return jsonResp(400, { error: 'You can only create up to 10 zones.' });
    }

    const zoneId = 'zone_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    zones[zoneId] = {
      id: zoneId,
      name: String(name || '').slice(0, 60),
      description: String(description || '').slice(0, 120),
      owner: email,
      friendsOnly: !!friendsOnly,
      allowedUsers: [],
      createdAt: Date.now()
    };
    saveJson(CANVAS_ZONES_FILE, zones);
    return jsonResp(200, { ok: true, zone: zones[zoneId] });
  }

  if (path === '/api/canvas/zones' && method === 'GET') {
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const adminOk = isAnyAdminId(sid);
    
    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const list = [];
    const normEmail = normalizeEmail(email);

    for (const z of Object.values(zones)) {
      if (adminOk) {
        list.push(z);
        continue;
      }
      const normOwner = normalizeEmail(z.owner);
      if (normOwner === normEmail) {
        list.push(z);
        continue;
      }
      if (z.friendsOnly) {
        const friends = loadJson(join(BASE, 'data', 'friends.json'), {});
        const ownerFriends = friends[normOwner] || [];
        const userFriends = friends[normEmail] || [];
        const isFriendOfOwner = ownerFriends.includes(normEmail) || userFriends.includes(normOwner);
        if (isFriendOfOwner) {
          list.push(z);
          continue;
        }
      }
      const allowed = (z.allowedUsers || []).map(e => normalizeEmail(e));
      if (allowed.includes(normEmail)) {
        list.push(z);
      }
    }
    return jsonResp(200, { ok: true, zones: list });
  }

  if (path === '/api/canvas/zones/add-user' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const { zoneId, user } = body;
    if (!zoneId || !user) return jsonResp(400, { error: 'missing fields' });

    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const zone = zones[zoneId];
    if (!zone) return jsonResp(404, { error: 'zone not found' });
    if (normalizeEmail(zone.owner) !== normalizeEmail(email) && !isAnyAdminId(sid)) {
      return jsonResp(403, { error: 'forbidden' });
    }

    try {
      const targetEmail = await resolveTargetEmail(user);
      if (!targetEmail) return jsonResp(404, { error: 'User not found' });
      if (zone.allowedUsers.map(e => normalizeEmail(e)).includes(normalizeEmail(targetEmail))) {
        return jsonResp(400, { error: 'User already added' });
      }
      zone.allowedUsers.push(targetEmail);
      saveJson(CANVAS_ZONES_FILE, zones);
      return jsonResp(200, { ok: true, allowedUsers: zone.allowedUsers });
    } catch (err) {
      return jsonResp(404, { error: 'User not found' });
    }
  }

  if (path === '/api/canvas/zones/remove-user' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const { zoneId, user } = body;
    if (!zoneId || !user) return jsonResp(400, { error: 'missing fields' });

    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const zone = zones[zoneId];
    if (!zone) return jsonResp(404, { error: 'zone not found' });
    if (normalizeEmail(zone.owner) !== normalizeEmail(email) && !isAnyAdminId(sid)) {
      return jsonResp(403, { error: 'forbidden' });
    }

    const normTarget = normalizeEmail(user);
    const idx = zone.allowedUsers.findIndex(e => normalizeEmail(e) === normTarget);
    if (idx === -1) return jsonResp(404, { error: 'User not allowed' });
    zone.allowedUsers.splice(idx, 1);
    saveJson(CANVAS_ZONES_FILE, zones);
    return jsonResp(200, { ok: true, allowedUsers: zone.allowedUsers });
  }

  if (path === '/api/canvas/zones/delete' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const { zoneId } = body;
    if (!zoneId) return jsonResp(400, { error: 'missing zoneId' });

    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const zone = zones[zoneId];
    if (!zone) return jsonResp(404, { error: 'zone not found' });
    if (normalizeEmail(zone.owner) !== normalizeEmail(email) && !isAnyAdminId(sid)) {
      return jsonResp(403, { error: 'forbidden' });
    }

    delete zones[zoneId];
    saveJson(CANVAS_ZONES_FILE, zones);
    
    try {
      const pFile = join(BASE, 'data', `zone_pixels_${zoneId}.json`);
      if (existsSync(pFile)) rmSync(pFile);
      const hFile = join(BASE, 'data', `zone_history_${zoneId}.jsonl`);
      if (existsSync(hFile)) rmSync(hFile);
    } catch {}

    return jsonResp(200, { ok: true });
  }

  if (path === '/api/canvas/zones/update' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const { zoneId, name, description, friendsOnly } = body;
    if (!zoneId) return jsonResp(400, { error: 'missing zoneId' });

    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const zone = zones[zoneId];
    if (!zone) return jsonResp(404, { error: 'zone not found' });
    if (normalizeEmail(zone.owner) !== normalizeEmail(email) && !isAnyAdminId(sid)) {
      return jsonResp(403, { error: 'forbidden' });
    }

    if (name !== undefined) zone.name = String(name || '').slice(0, 60);
    if (description !== undefined) zone.description = String(description || '').slice(0, 120);
    if (friendsOnly !== undefined) zone.friendsOnly = !!friendsOnly;
    saveJson(CANVAS_ZONES_FILE, zones);
    return jsonResp(200, { ok: true, zone });
  }

  if (path === '/api/canvas/zones/clear' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    const cookies = getCookies(req);
    const sid = authSidFromCookies(cookies);
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'Unauthorized' });
    const { zoneId } = body;
    if (!zoneId) return jsonResp(400, { error: 'missing zoneId' });

    const zones = loadJson(CANVAS_ZONES_FILE, {});
    const zone = zones[zoneId];
    if (!zone) return jsonResp(404, { error: 'zone not found' });
    if (normalizeEmail(zone.owner) !== normalizeEmail(email) && !isAnyAdminId(sid)) {
      return jsonResp(403, { error: 'forbidden' });
    }

    // Clear caches
    zonePixelsMap.delete(zoneId);
    zoneChunksMap.delete(zoneId);

    // Save empty data
    const file = join(BASE, 'data', `zone_pixels_${zoneId}.json`);
    saveJson(file, {});

    // Clear history file
    try {
      const historyFile = getZoneHistoryFile(zoneId);
      if (existsSync(historyFile)) {
        writeFileSync(historyFile, '', 'utf8');
      }
    } catch {}

    return jsonResp(200, { ok: true });
  }

  if (path === '/api/team/ai' && method === 'POST') {
    const member = checkTeamTokenPost(req);
    if (!member) return jsonResp(401, { error: 'Invalid team token' });
    if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
    if (!GROQ_KEY) return jsonResp(503, { error: 'AI not configured' });
    const { mode, subject, emailBody, sender, thread } = body;
    if (!mode || !emailBody) return jsonResp(400, { error: 'missing fields' });

    const threadText = Array.isArray(thread) && thread.length > 1
      ? '\n\nConversation thread:\n' + thread.map(m => `${m.dir === 'in' ? 'Customer' : 'Support'}: ${m.body}`).join('\n\n')
      : '';

    let sysPrompt, userPrompt;
    if (mode === 'review') {
      sysPrompt = 'You are a support email analyst for mitch.pro, a student-run tech/gaming service. Be concise and practical.';
      userPrompt = `Analyze this support email and return JSON only.\n\nFrom: ${sender || 'unknown'}\nSubject: ${subject || ''}\n\n${emailBody}${threadText}\n\nReturn: {"summary":"1-2 sentence summary of what they need","tone":"positive|neutral|negative|frustrated|urgent","priority":"high|medium|low","keyPoints":["point1","point2"],"suggestedAction":"one-line action to take"}`;
    } else if (mode === 'draft') {
      sysPrompt = 'You are a support email writer for mitch.pro. Write concise, friendly, professional replies. Do NOT include a greeting (no "Hi" or "Dear"), no sign-off, and no subject line — just the reply body text.';
      userPrompt = `Write a reply to this support email.\n\nFrom: ${sender || 'unknown'}\nSubject: ${subject || ''}\n\n${emailBody}${threadText}`;
    } else {
      return jsonResp(400, { error: 'invalid mode' });
    }

    const msgs = [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }];
    for (const [model] of GROQ_MODELS) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}`, 'User-Agent': 'python-requests/2.31.0' },
          body: JSON.stringify({ model, messages: msgs, max_tokens: mode === 'draft' ? 600 : 400 }),
          signal: AbortSignal.timeout(25000),
        });
        if (resp.status === 429 || resp.status === 503) continue;
        if (!resp.ok) return jsonResp(502, { error: 'AI request failed' });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '';
        console.log(`[team ai] ${mode} by ${member.name} via ${model}`);
        if (mode === 'review') {
          const match = text.match(/\{[\s\S]*?\}/);
          return jsonResp(200, match ? JSON.parse(match[0]) : { summary: text });
        } else {
          return jsonResp(200, { draft: text.trim() });
        }
      } catch (e) { console.error('[team ai]', e.message); }
    }
    return jsonResp(500, { error: 'AI failed' });
  }

  if (path === '/api/admin/canvas-unban') {
    if (!await tryParseJson()) return jsonResp(400, {});
    if (!checkAdminPw(body.pw)) return jsonResp(403, { error: 'forbidden' });
    const { painter } = body;
    if (!painter) return jsonResp(400, { error: 'painter required' });
    const bannedData = loadJson(CANVAS_BANNED_FILE, {});
    if (!bannedData[painter]) return jsonResp(404, { error: 'painter not banned' });
    delete bannedData[painter];
    saveCanvasBans(bannedData);
    console.log(`[canvas] unbanned painter ${painter.slice(0, 12)}`);
    return jsonResp(200, { ok: true });
  }

  if (path === '/api/admin/revoke-premium') {
    if (!await tryParseJson()) return jsonResp(400, {});
    if (!checkAdminPw(body.pw)) return jsonResp(403, { error: 'forbidden' });
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return jsonResp(400, { error: 'email required' });
    const apps = loadJson(APPLICATIONS_FILE, []);
    const newApps = apps.filter(a => !(normalizeEmail(a.email || '') === normalizeEmail(email) && (a.type === 'premium' || a.grantPremium)));
    saveApplications(newApps);
    console.log(`[admin] revoked premium for ${email}`);
    return jsonResp(200, { ok: true });
  }

  // ── Kody's Keyboard routes ────────────────────────────────────────────────
  if (path === '/api/games/kodys-keyboard/payout' && method === 'POST') {
    try {
      if (!await tryParseJson()) return jsonResp(400, { success: false });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false });
      const norm = normalizeEmail(email);
      
      const wpm = Number(body.wpm) || 0;
      const timeTaken = Number(body.ms) || 0;
      
      // Basic anti-cheat
      if (wpm > 250 || timeTaken < 2000) return jsonResp(400, { error: 'Impossible speed' });
      
      let s = typingSessions.get(norm) || { dailyCount: 0, lastTs: 0 };
      const today = new Date().toDateString();
      if (new Date(s.lastTs).toDateString() !== today) s.dailyCount = 0;
      
      let coins = 0;
      if (wpm >= 120) coins = 3;
      else if (wpm >= 80) coins = 2;
      else if (wpm >= 40) coins = 1;
      
      if (coins > 0) {
        if (isPremiumEmail(email)) coins *= 2;
        // 1.5x friend play bonus: if any friend is online right now
        let friendBonusActive = false;
        const friends = loadJson(FRIENDS_FILE, {});
        const myFriends = friends[norm] || [];
        const now2 = Date.now();
        if (myFriends.some(f => {
          const fNorm = normalizeEmail(f);
          return cvOnline[fNorm] && (now2 - cvOnline[fNorm]) < 120000;
        })) {
          coins = Math.floor(coins * 1.5);
          friendBonusActive = true;
        }
        addCoins(email, coins);
        updateStat(email, 'typing_coins', coins);
        updateStat(email, 'typing_races', 1);
        s.dailyCount++;
        s.lastTs = Date.now();
        typingSessions.set(norm, s);
        saveTypingSessions();
        console.log(`[typing] ${email} earned ${coins} coins at ${wpm} WPM${friendBonusActive ? ' (friend bonus)' : ''}`);
      }
      return jsonResp(200, { success: true, coinsEarned: coins, dailyRemaining: 999, friendBonusActive });
    } catch (e) { return jsonResp(400, { success: false }); }
  }

  // ── Penny's Piano Keys routes ─────────────────────────────────────────────
  if (path === '/api/games/pennys-piano-keys/payout' && method === 'POST') {
    try {
      if (!await tryParseJson()) return jsonResp(400, { success: false, error: 'Invalid JSON body' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false, error: 'Authentication required' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false, error: 'Invalid identity' });
      const norm = normalizeEmail(email);

      const score = Math.max(0, parseInt(body.score) || 0);
      const ms = Math.max(0, parseInt(body.ms) || 0);

      // Hard backend safety cap to prevent cheat engines sending massive scores
      if (score > 500) {
        logCheat(email, "Penny's Piano Keys", `Suspiciously high score: ${score} tiles in ${ms}ms`);
        return jsonResp(400, { success: false, error: 'Legendary performance detected, but score exceeds safety threshold (500 tiles).' });
      }

      // Secure reaction speed verification:
      // Minimum average human tap speed across 4 columns is at least 135ms per tile.
      // Flag if score is significant (> 5) and average is less than 135ms/tile.
      if (score > 5) {
        const timePerTile = ms / score;
        if (timePerTile < 135) {
          logCheat(email, "Penny's Piano Keys", `Impossible speed: ${score} tiles in ${ms}ms (${Math.round(timePerTile)}ms/tile)`);
          return jsonResp(400, { success: false, error: 'Suspiciously fast tiles! Play like a human.' });
        }
      }

      let s = pianoSessions.get(norm) || { dailyCount: 0, lastTs: 0 };
      const today = new Date().toDateString();
      if (new Date(s.lastTs).toDateString() !== today) {
        s.dailyCount = 0;
      }

      // Time-travel loop exploit prevention:
      // If a client claims the game lasted 100 seconds (e.g. ms: 100000), but the actual server time elapsed
      // since their last game submission is only 500ms, it is physically impossible.
      const actualElapsed = Date.now() - s.lastTs;
      if (s.lastTs > 0 && ms > 5000) { // Verify if they have submitted at least one session previously and game duration is significant
        if (actualElapsed < ms * 0.8) { // Allow 20% margin of error for network latency/server load
          logCheat(email, "Penny's Piano Keys", `Time-travel exploit: Claimed game duration ${ms}ms, but only ${actualElapsed}ms elapsed since last submission`);
          return jsonResp(400, { success: false, error: 'Exploit detected: Play in real-time!' });
        }
      }

      const DAILY_CAP = 1000;

      // Calculate MitchCoin payouts:
      // 1. First 200 tiles are normal coins, which are capped by the daily limit
      // 2. Tiles past 200 are "bypass coins" which completely ignore the daily limit!
      const normalCoins = Math.min(200, score);
      const bypassCoins = Math.max(0, score - 200);

      let allowedNormal = normalCoins;
      if (s.dailyCount >= DAILY_CAP) {
        allowedNormal = 0;
      } else if (s.dailyCount + allowedNormal > DAILY_CAP) {
        allowedNormal = DAILY_CAP - s.dailyCount;
      }

      let coinsAwarded = Math.floor((allowedNormal + bypassCoins) * 0.02);

      if (coinsAwarded > 0) {
        let finalCoins = coinsAwarded;
        if (isPremiumEmail(email)) {
          finalCoins = coinsAwarded * 2; // Premium members earn 2x coins!
        }
        addCoins(email, finalCoins);
        updateStat(email, 'piano_coins', finalCoins);
        updateStat(email, 'piano_games', 1);

        s.dailyCount += allowedNormal; // Only normal coins count toward the daily cap!
        s.lastTs = Date.now();
        pianoSessions.set(norm, s);
        savePianoSessions();

        console.log(`[piano] ${email} earned ${finalCoins} coins for score ${score} (Normal: ${allowedNormal}, Bypassed: ${bypassCoins})`);
        return jsonResp(200, { 
          success: true, 
          coinsEarned: finalCoins, 
          normalEarned: allowedNormal * (isPremiumEmail(email) ? 2 : 1),
          bypassEarned: bypassCoins * (isPremiumEmail(email) ? 2 : 1),
          dailyRemaining: DAILY_CAP - s.dailyCount 
        });
      }

      // Daily cap hit — still update lastTs so the next-day reset check works
      s.lastTs = Date.now();
      pianoSessions.set(norm, s);
      savePianoSessions();
      updateStat(email, 'piano_games', 1);
      return jsonResp(200, { success: true, coinsEarned: 0, dailyRemaining: 0, message: "Daily coin limit reached (1,000). Come back tomorrow!" });
    } catch (e) {
      console.error('[piano] error:', e);
      return jsonResp(400, { success: false, error: String(e) });
    }
  }

  // ── Lillian's Logic routes ────────────────────────────────────────────────
  if (path === '/api/games/lillians-logic/state') {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!validId(sid)) return jsonResp(401, { error: 'auth required' });
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'identity missing' });
    const norm = normalizeEmail(email);
    
    let s = logicSessions.get(norm) || { puzzlesDone: 0, lastSolvedTs: 0 };
    const today = new Date().toDateString();
    const solvedToday = new Date(s.lastSolvedTs).toDateString() === today;
    
    return jsonResp(200, { success: true, solvedToday, puzzlesDone: s.puzzlesDone });
  }

  if (path === '/api/games/lillians-logic/validate' && method === 'POST') {
    if (!await tryParseJson()) return jsonResp(400, { success: false });
    const word = String(body.word || '').toUpperCase();
    return jsonResp(200, { success: true, valid: logicDictionary.has(word.toLowerCase()) });
  }

  if (path === '/api/games/lillians-logic/next-wordle' && method === 'POST') {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    try {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false, error: 'Authentication required' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false, error: 'Invalid identity' });
      const norm = normalizeEmail(email);

      let s = logicSessions.get(norm) || { puzzlesDone: 0, lastSolvedTs: 0 };
      const WORDS = ["APPLE","BREAD","CLOUD","DANCE","EARTH","FIELD","GREEN","HEART","IMAGE","JUICE","LIGHT","MUSIC","NIGHT","OCEAN","PAPER","QUEEN","RIVER","STONE","TABLE","VOICE","WATER","WORLD","SPACE","STARS","PIXEL","GAMES","DREAM","LEVEL","BUILD","ROBOT","POWER","LUCKY","CHESS","BOARD","CLICK","WEAVE","FINAL","TRUTH","GALAXY","SUPER","SMART","FASTY"];
      const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      s.currentWordle = randomWord;

      logicSessions.set(norm, s);
      saveLogicSessions();

      return jsonResp(200, { success: true, word: randomWord });
    } catch (e) {
      return jsonResp(400, { success: false, error: String(e) });
    }
  }

  if (path === '/api/games/lillians-logic/solve' && method === 'POST') {
    const rl = checkRateLimit(req, path); if (rl) return rl;
    try {
      if (!await tryParseJson()) return jsonResp(400, { success: false, error: 'Invalid JSON body' });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false, error: 'Authentication required' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false, error: 'Invalid identity' });
      const norm = normalizeEmail(email);

      // Structure of s: { puzzlesDone, lastSolvedTs, lastMinesSolvedTs, minesSolvedTodayCount, lastMinesSolvedDate }
      let s = logicSessions.get(norm) || { puzzlesDone: 0, lastSolvedTs: 0 };
      const today = new Date().toDateString();
      const firstToday = new Date(s.lastSolvedTs).toDateString() !== today;

      const type = body.type || 'wordle';
      let coins = 0;

      if (type === 'wordle') {
        // Validate Wordle word
        const guess = String(body.word || '').toUpperCase();
        const WORDS = ["APPLE","BREAD","CLOUD","DANCE","EARTH","FIELD","GREEN","HEART","IMAGE","JUICE","LIGHT","MUSIC","NIGHT","OCEAN","PAPER","QUEEN","RIVER","STONE","TABLE","VOICE","WATER","WORLD","SPACE","STARS","PIXEL","GAMES","DREAM","LEVEL","BUILD","ROBOT","POWER","LUCKY","CHESS","BOARD","CLICK","WEAVE","FINAL","TRUTH","GALAXY","SUPER","SMART","FASTY"];
        
        const getWordForDate = (d) => {
          const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
          return WORDS[Math.floor(seed % WORDS.length)];
        };

        const now = new Date();
        const targetToday = getWordForDate(now);
        const targetYesterday = getWordForDate(new Date(now.getTime() - 24 * 3600 * 1000));
        const targetTomorrow = getWordForDate(new Date(now.getTime() + 24 * 3600 * 1000));

        let isValid = false;
        if (s.currentWordle && guess === s.currentWordle) {
          isValid = true;
          delete s.currentWordle; // Clear it so they can't re-solve the same word
        } else if (guess === targetToday || guess === targetYesterday || guess === targetTomorrow) {
          isValid = true;
        }

        if (!isValid) {
          return jsonResp(400, { success: false, error: 'Incorrect Wordle solution' });
        }

        coins = 20;
        s.lastSolvedTs = Date.now();
      } else if (type === 'mines') {
        // Enforce cooldown
        const lastMinesTs = s.lastMinesSolvedTs || 0;
        if (Date.now() - lastMinesTs < 10000) { // 10 seconds cooldown
          return jsonResp(429, { success: false, error: 'Solving Minesweeper too fast! Cooldown is active.' });
        }

        // Enforce daily cap
        if (s.lastMinesSolvedDate !== today) {
          s.minesSolvedTodayCount = 0;
          s.lastMinesSolvedDate = today;
        }
        if ((s.minesSolvedTodayCount || 0) >= 50) {
          return jsonResp(400, { success: false, error: 'Daily Minesweeper limit reached (50/day)' });
        }

        // Parse and validate board
        const board = body.board;
        const timer = Number(body.timer) || 0;
        if (!board || !Array.isArray(board) || board.length !== 100) {
          return jsonResp(400, { success: false, error: 'Invalid board data uploaded' });
        }

        if (timer < 5) {
          return jsonResp(400, { success: false, error: 'Impossible solve speed!' });
        }

        // Mathematical board validation
        let mineCount = 0;
        let revCount = 0;
        for (let i = 0; i < 100; i++) {
          const cell = board[i];
          if (!cell || typeof cell.mine !== 'boolean' || typeof cell.revealed !== 'boolean') {
            return jsonResp(400, { success: false, error: 'Malformed cell at index ' + i });
          }
          if (cell.mine) {
            mineCount++;
            if (cell.revealed) {
              return jsonResp(400, { success: false, error: 'Invalid board: a mine was revealed!' });
            }
          } else if (cell.revealed) {
            revCount++;
          }
        }

        if (mineCount !== 15) {
          return jsonResp(400, { success: false, error: 'Invalid board: must contain exactly 15 mines' });
        }
        if (revCount !== 85) {
          return jsonResp(400, { success: false, error: 'Invalid board: must reveal all 85 safe cells' });
        }

        // Validate neighbor counts for all 100 cells
        const getNeighbors = (idx) => {
          const n = [];
          const r = Math.floor(idx / 10);
          const c = idx % 10;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && !(dr === 0 && dc === 0)) {
                n.push(nr * 10 + nc);
              }
            }
          }
          return n;
        };

        for (let i = 0; i < 100; i++) {
          const cell = board[i];
          if (cell.revealed) {
            const computedMines = getNeighbors(i).filter(n => board[n].mine).length;
            if (Number(cell.count || 0) !== computedMines) {
              return jsonResp(400, { success: false, error: `Invalid neighbor count at cell ${i}. Expected ${computedMines}, got ${cell.count}` });
            }
          }
        }

        // All checks passed! Update session tracking
        coins = 2;
        s.lastMinesSolvedTs = Date.now();
        s.minesSolvedTodayCount = (s.minesSolvedTodayCount || 0) + 1;
        s.lastMinesSolvedDate = today;
      } else {
        return jsonResp(400, { success: false, error: 'Unknown game type' });
      }

      if (isPremiumEmail(email)) coins *= 2;
      addCoins(email, coins);
      updateStat(email, 'logic_coins', coins);
      updateStat(email, 'logic_puzzles', 1);
      
      s.puzzlesDone++;
      logicSessions.set(norm, s);
      saveLogicSessions();
      
      console.log(`[logic] ${email} solved ${type}, earned ${coins} coins (First today: ${firstToday})`);
      return jsonResp(200, { success: true, coinsEarned: coins, firstToday: (type === 'wordle' && firstToday) });
    } catch (e) {
      console.error('[logic] solve error:', e);
      return jsonResp(400, { success: false, error: String(e) });
    }
  }
  if (path === '/api/games/adrian-clicker/state') {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!validId(sid)) return jsonResp(401, { error: 'auth required' });
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'identity missing' });
    const norm = normalizeEmail(email);
    
    let s = clickerSessions.get(norm);
    if (!s) {
      s = { points: 0, coins: 0, lastTs: Date.now(), startTime: Date.now(), playtimeCoins: 0, upgrades: {} };
      clickerSessions.set(norm, s);
      saveClickerSessions();
    } else {
      const offlineGain = applyAdrianOffline(s, email);
      if (offlineGain > 0) {
        clickerSessions.set(norm, s);
        saveClickerSessions();
      }
    }
    return jsonResp(200, { success: true, state: s, upgrades: ADRIAN_UPGRADES, tech: ADRIAN_TECH });
  }

  if (path === '/api/games/adrian-clicker/buy' && method === 'POST') {
    try {
      if (!await tryParseJson()) return jsonResp(400, { success: false });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false });
      const norm = normalizeEmail(email);
      let s = clickerSessions.get(norm);
      if (!s) return jsonResp(400, { success: false });

      const clientPoints = Number(body.points);
      if (Number.isFinite(clientPoints)) s = processAdrianSync(s, clientPoints, email);

      const upId = body.id;
      const buyAmount = Math.max(1, parseInt(body.amount) || 1);
      
      const isTech = !!ADRIAN_TECH[upId];
      const def = isTech ? ADRIAN_TECH[upId] : ADRIAN_UPGRADES[upId];
      
      if (!def) return jsonResp(400, { success: false, message: 'Invalid upgrade' });

      let count = s.upgrades[upId] || 0;
      if ((isTech || def.oneTime) && count >= 1) return jsonResp(400, { success: false, message: 'Already owned' });

      let totalCost = 0;
      let actualBuyCount = 0;

      if (isTech || def.oneTime) {
          totalCost = Math.floor(def.cost || def.baseCost);
          actualBuyCount = 1;
      } else {
          for (let i = 0; i < buyAmount; i++) {
              const nextCost = Math.floor(def.baseCost * Math.pow(1.15, count + i));
              if (totalCost + nextCost <= s.points) {
                  totalCost += nextCost;
                  actualBuyCount++;
              } else {
                  if (i === 0) return jsonResp(400, { success: false, message: 'Insufficient points', serverPoints: s.points });
                  break;
              }
          }
      }

      if (s.points < totalCost) return jsonResp(400, { success: false, message: 'Insufficient points' });

      s.points -= totalCost;
      s.upgrades[upId] = count + actualBuyCount;
      s.lastTs = Date.now();
      clickerSessions.set(norm, s);
      saveClickerSessions();
      return jsonResp(200, { success: true, serverPoints: s.points, serverCoins: s.coins, count: s.upgrades[upId] });
    } catch (e) { return jsonResp(400, { success: false }); }
  }
  if (path === '/api/games/adrian-clicker/sync' && method === 'POST') {
    try {
      if (!await tryParseJson()) return jsonResp(400, { success: false });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false });
      const norm = normalizeEmail(email);
      let s = clickerSessions.get(norm);
      if (!s) s = { points: 0, coins: 0, lastTs: Date.now(), startTime: Date.now(), playtimeCoins: 0, upgrades: {} };

      const claim = body.claim === true || body.claim === 'true';
      s = processAdrianSync(s, Number(body.points) || 0, email, claim);
      clickerSessions.set(norm, s);
      saveClickerSessions();
      return jsonResp(200, { success: true, serverPoints: s.points, serverCoins: s.coins });
    } catch (e) { return jsonResp(400, { success: false }); }
  }

  if (path === '/api/games/richard-riches/state') {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!validId(sid)) return jsonResp(401, { error: 'auth required' });
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'identity missing' });
    const norm = normalizeEmail(email);
    
    let s = richardSessions.get(norm);
    let offlineGain = 0;
    if (!s) {
      s = { cash: 0, coins: 0, lastTs: Date.now(), startTime: Date.now(), playtimeCoins: 0, levels: { lemon: 1 }, managers: {}, upgrades: [] };
      richardSessions.set(norm, s);
      saveRichardSessions();
    } else {
      offlineGain = applyRichardOffline(s, email);
      if (offlineGain > 0) {
        richardSessions.set(norm, s);
        saveRichardSessions();
      }
    }
    return jsonResp(200, { success: true, state: s, offlineGain: offlineGain });
  }

  if (path === '/api/games/richard-riches/sync' && method === 'POST') {
    try {
      if (!await tryParseJson()) return jsonResp(400, { success: false });
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { success: false });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { success: false });
      const norm = normalizeEmail(email);
      let s = richardSessions.get(norm);
      if (!s) s = { cash: 0, coins: 0, lastTs: Date.now(), startTime: Date.now(), playtimeCoins: 0, levels: { lemon: 1 }, managers: {}, upgrades: [] };

      const clientCash = Math.min(1e290, Number(body.state?.cash) || 0);
      const now = Date.now();
      const elapsed = (now - s.lastTs) / 1000;
      
      if (elapsed > 0) {
        const isPremium = isPremiumEmail(email);
        const premMult = isPremium ? 2.0 : 1.0;
        const cashPerSec = getRichardPower(s);
        
        const ownedUpgrades = new Set(s.upgrades || []);
        let lemonMult = 1;
        if (ownedUpgrades.has('lemon_1')) lemonMult *= 3;
        let globalMult = 1;
        if (ownedUpgrades.has('all_1')) globalMult *= 2;
        if (ownedUpgrades.has('all_2')) globalMult *= 3;
        if (ownedUpgrades.has('all_3')) globalMult *= 5;
        
        const lemonLvl = s.levels?.lemon || 1;
        const lemonRevenue = lemonLvl * 1.0 * lemonMult * globalMult * premMult;
        
        const maxClicksPerSec = 5.0;
        const maxPossibleGain = ((cashPerSec * elapsed) + (maxClicksPerSec * lemonRevenue * elapsed)) * premMult;
        const actualGain = clientCash - s.cash;
        
        if (actualGain > maxPossibleGain * 3.0 && actualGain > 100) {
          logCheat(email, "Richard's Riches", `Attempted impossible gain of ${actualGain.toExponential(2)} cash (max possible: ${maxPossibleGain.toExponential(2)})`);
          s.cash = Math.min(1e290, s.cash + maxPossibleGain);
        } else {
          s.cash = Math.min(1e290, Math.max(s.cash, clientCash));
        }
      }

      if (body.state) {
        s.levels = body.state.levels || s.levels;
        s.managers = body.state.managers || s.managers;
        s.upgrades = body.state.upgrades || s.upgrades;
      }

      const claim = body.claim === true || body.claim === 'true';
      let coinsToGrant = 0;

      if (claim) {
        while (true) {
          const costOfNext = Math.floor(100 * Math.pow(3, s.coins));
          if (s.cash >= costOfNext) {
            s.cash -= costOfNext;
            s.coins++;
            coinsToGrant++;
          } else {
            break;
          }
        }
      }

      const sessionElapsed = now - (s.startTime || now);
      const totalPlaytimeCoins = Math.floor(sessionElapsed / 600000);
      const pendingPlaytimeBonus = totalPlaytimeCoins - (s.playtimeCoins || 0);
      if (pendingPlaytimeBonus > 0) {
        coinsToGrant += pendingPlaytimeBonus;
        s.playtimeCoins = (s.playtimeCoins || 0) + pendingPlaytimeBonus;
      }

      if (coinsToGrant > 0) {
        const isPremium = isPremiumEmail(email);
        const bonusCount = (isPremium ? coinsToGrant * 2 : coinsToGrant) * 100;
        addCoins(email, bonusCount);
        updateStat(email, 'richard_coins', bonusCount);
        console.log(`[richard-riches] ${email} earned ${bonusCount} MitchCoins (Claim: ${claim}, Playtime: ${pendingPlaytimeBonus > 0})`);
      }

      s.lastTs = now;
      richardSessions.set(norm, s);
      saveRichardSessions();
      return jsonResp(200, { success: true, serverCash: s.cash, serverCoins: s.coins, globalCoins: getCoins(email) });
    } catch (e) { return jsonResp(400, { success: false }); }
  }

  // ── Casino routes ────────────────────────────────────────────────────────
  if (path.startsWith('/api/casino/')) {
    const cookies = getCookies(req);
    const sid = cookies['studentId'] || cookies['id'] || '';
    if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
    const email = emailFromSid(sid);
    if (!email) return jsonResp(401, { error: 'email not found' });
    const norm = normalizeEmail(email);

    if (method === 'POST' && path !== '/api/casino/blackjack/hit' && path !== '/api/casino/blackjack/stand') {
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      if (!await verifyRecaptcha(body.recaptcha_token || '', ip))
        return jsonResp(400, { error: 'reCAPTCHA failed. Please try again.' });
    }

    function addHistory(email, game, amount, outcome) {
      const h = casinoHistory.get(norm) || [];
      h.unshift({ game, amount, outcome, ts: Date.now() });
      if (h.length > 25) h.pop();
      casinoHistory.set(norm, h);
    }

    function readCasinoBet(min = 1) {
      const bet = Number(body.amount);
      const bal = getCoins(email);
      if (!Number.isFinite(bet) || bet < min) return { error: `Minimum bet is ${min} coins.` };
      if (bet > bal) return { error: 'You do not have enough coins for that bet.' };

      const stats = loadUserStats();
      const isVip = stats[norm] && stats[norm].vip_casino_until > Date.now();
      if (!isVip && bet > 500) return { error: 'Maximum bet is 500 coins. Buy a VIP Casino Pass in the shop for unlimited betting!' };

      return { bet: Number(bet.toFixed(2)), bal };
    }

    function isRigged() {
      return false;
    }

    function settleCasinoRound(gameName, bet, payout, outcome, freeSpin = false) {
      const stats = loadUserStats();
      const isDouble = stats[norm] && (stats[norm].double_down_until || 0) > Date.now();
      const isInsured = stats[norm] && (stats[norm].bad_beat_insurance_until || 0) > Date.now();

      let finalPayout = payout;
      let finalOutcome = outcome;

      if (payout > bet && isDouble) {
        finalPayout = payout * 2;
        finalOutcome = outcome + ' (2X DOUBLE)';
      } else if (payout <= 0 && isInsured && !freeSpin) {
        finalPayout = bet;
        finalOutcome = 'REFUNDED (INSURED)';
      }

      const safePayout = Number(Math.max(0, finalPayout || 0).toFixed(4));
      const effectiveBet = freeSpin ? 0 : bet;
      const net = Number((safePayout - effectiveBet).toFixed(4));

      casinoIntake += effectiveBet;
      casinoPayout += safePayout;
      saveCasinoStats();
      addCoins(email, net);
      addHistory(email, gameName, net, finalOutcome);
      logBet(email, gameName, effectiveBet, finalOutcome);

      updateStat(email, 'casino_bets', 1);
      if (net > 0) {
        updateStat(email, 'casino_wins', 1);
      }

      return { payout: safePayout, net, newBalance: getCoins(email) };
    }

    function weightedPick(items) {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * total;
      for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item;
      }
      return items[items.length - 1];
    }

    function drawUniqueNumbers(max, count) {
      const nums = Array.from({ length: max }, (_, i) => i + 1);
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      return nums.slice(0, count).sort((a, b) => a - b);
    }

    if (path === '/api/casino/history') {
      return jsonResp(200, { history: casinoHistory.get(norm) || [] });
    }

    if (path === '/api/casino/global-feed') {
      const sanitized = bettingFeed.slice(0, 50).map(b => ({
        ...b,
        user: b.user ? b.user.split('@')[0] : 'anonymous'
      }));
      return jsonResp(200, { feed: sanitized });
    }

    if (path === '/api/casino/roulette') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const bet = betCheck.bet;
      const type = body.type; // 'red', 'black', 'green', or number 0-36

      const colors = {
        0: 'green', 1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black',
        7: 'red', 8: 'black', 9: 'red', 10: 'black', 11: 'black', 12: 'red',
        13: 'black', 14: 'red', 15: 'black', 16: 'red', 17: 'black', 18: 'red',
        19: 'red', 20: 'black', 21: 'red', 22: 'black', 23: 'red', 24: 'black',
        25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'black', 30: 'red',
        31: 'black', 32: 'red', 33: 'black', 34: 'red', 35: 'black', 36: 'red'
      };
      
      let num = Math.floor(Math.random() * 37);
      let resultColor = colors[num];
      const rigged = isRigged();

      let won = false;
      let mult = 0;

      if (type === 'red' || type === 'black') {
        won = (type === resultColor);
        mult = 2;
        if (won && rigged) {
          num = Object.keys(colors).find(n => colors[n] !== type && n !== '0');
          resultColor = colors[num];
          won = false;
        }
      } else if (type === 'green') {
        won = (num === 0);
        mult = 35;
        if (won && rigged) { num = 1; resultColor = 'red'; won = false; }
      } else if (Number.isInteger(Number(type)) && Number(type) >= 0 && Number(type) <= 36) {
        won = (num === Number(type));
        mult = 35;
        if (won && rigged) { num = (num + 1) % 37; resultColor = colors[num]; won = false; }
      } else {
        return jsonResp(400, { error: 'Invalid bet type.' });
      }

      const payout = won ? bet * mult : 0;
      const settled = settleCasinoRound('Roulette', bet, payout, won ? 'WIN' : 'LOSE');
      
      return jsonResp(200, { ok: true, number: num, color: resultColor, won, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/blackjack/start') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const bet = Number(body.amount);
      const bal = getCoins(email);
      if (!Number.isFinite(bet) || bet < 1 || bet > bal) return jsonResp(400, { error: 'invalid bet' });

      const stats = loadUserStats();
      const isVip = stats[norm] && stats[norm].vip_casino_until > Date.now();
      if (!isVip && bet > 500) return jsonResp(400, { error: 'Maximum bet is 500 coins. Buy a VIP Casino Pass in the shop for unlimited betting!' });

      casinoIntake += bet; saveCasinoStats();
      addCoins(email, -bet);
      const deck = [];
      const suits = ['♠','♥','♦','♣'];
      const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      for (const s of suits) for (const v of vals) deck.push({s, v});
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      let playerHand = [deck.pop(), deck.pop()];
      let dealerHand = [deck.pop(), deck.pop()];
      const rigged = false;

      if (rigged) {
        const getValLocal = (h) => {
          let v = 0, aces = 0;
          for (const c of h) { if (c.v === 'A') aces++; else if (['J','Q','K'].includes(c.v)) v += 10; else v += parseInt(c.v); }
          for (let i = 0; i < aces; i++) v += (v + 11 <= 21) ? 11 : 1;
          return v;
        };
        // If player has 21, swap a card to break it
        if (getValLocal(playerHand) === 21) {
          const brokenIdx = deck.findIndex(c => getValLocal([playerHand[0], c]) < 21);
          if (brokenIdx !== -1) {
            const card = deck.splice(brokenIdx, 1)[0];
            deck.push(playerHand[1]);
            playerHand[1] = card;
          }
        }
        // If dealer doesn't have 21 and player has a good hand, try to give dealer 21
        if (getValLocal(dealerHand) < 21 && getValLocal(playerHand) > 17) {
          const winIdx = deck.findIndex(c => getValLocal([dealerHand[0], c]) === 21);
          if (winIdx !== -1) {
            const card = deck.splice(winIdx, 1)[0];
            deck.push(dealerHand[1]);
            dealerHand[1] = card;
          }
        }
      }

      bjGames.set(norm, { deck, playerHand, dealerHand, bet, email, rigged });
      return jsonResp(200, { ok: true, playerHand, dealerUpCard: dealerHand[0] });
    }

    const game = bjGames.get(norm);
    const getVal = (h) => {
      let v = 0, aces = 0;
      for (const c of h) { if (c.v === 'A') aces++; else if (['J','Q','K'].includes(c.v)) v += 10; else v += parseInt(c.v); }
      for (let i = 0; i < aces; i++) v += (v + 11 <= 21) ? 11 : 1;
      return v;
    };

    if (path === '/api/casino/blackjack/hit') {
      if (!game) return jsonResp(400, { error: 'no active game' });
      
      let card = game.deck.pop();
      if (game.rigged) {
        const currentP = getVal(game.playerHand);
        // If player is at 12+, try to find a card that busts them
        if (currentP >= 12 && getVal([...game.playerHand, card]) <= 21) {
          const bustIdx = game.deck.findIndex(c => getVal([...game.playerHand, c]) > 21);
          if (bustIdx !== -1) {
            const bustCard = game.deck.splice(bustIdx, 1)[0];
            game.deck.push(card);
            card = bustCard;
          }
        }
      }
      
      game.playerHand.push(card);
      const pval = getVal(game.playerHand);
      if (pval > 21) {
        bjGames.delete(norm);
        const settled = settleCasinoRound('Blackjack', game.bet, 0, 'BUST');
        return jsonResp(200, { ok: true, gameOver: true, playerHand: game.playerHand, status: 'bust', dealerHand: game.dealerHand, winAmt: 0 });
      }
      return jsonResp(200, { ok: true, gameOver: false, playerHand: game.playerHand, status: 'active' });
    }

    if (path === '/api/casino/blackjack/stand') {
      if (!game) return jsonResp(200, { ok: true, gameOver: true });
      let dval = getVal(game.dealerHand);
      const pval = getVal(game.playerHand);
      
      if (game.rigged) {
        // Dealer draws until they beat player or hit 21
        while (dval <= pval && dval < 21) {
          const winIdx = game.deck.findIndex(c => {
            const v = getVal([...game.dealerHand, c]);
            return v >= pval && v <= 21;
          });
          if (winIdx !== -1) {
            game.dealerHand.push(game.deck.splice(winIdx, 1)[0]);
          } else {
            game.dealerHand.push(game.deck.pop());
          }
          dval = getVal(game.dealerHand);
        }
      } else {
        while (dval < 17) { game.dealerHand.push(game.deck.pop()); dval = getVal(game.dealerHand); }
      }

      let res = '';
      let winAmt = 0;
      if (dval > 21 || pval > dval) { 
        winAmt = game.bet * 2; res = 'win'; 
      }
      else if (dval === pval) { 
        winAmt = game.bet; res = 'push'; 
      }
      else { 
        res = 'lose'; 
      }
      
      // Note: we don't call settleCasinoRound rigging here because we handled it above via card drawing
      const safePayout = Number(Math.max(0, winAmt || 0).toFixed(4));
      const net = Number((safePayout - game.bet).toFixed(4));
      casinoIntake += game.bet;
      casinoPayout += safePayout;
      saveCasinoStats();
      addCoins(game.email, net);
      addHistory(game.email, 'Blackjack', net, res.toUpperCase());
      logBet(game.email, 'Blackjack', game.bet, res.toUpperCase());

      const playerHand = game.playerHand;
      const dealerHand = game.dealerHand;
      bjGames.delete(norm);
      return jsonResp(200, { ok: true, gameOver: true, playerHand, dealerHand, status: res, winAmt: safePayout });
    }

    if (path === '/api/casino/poker/start') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const bet = betCheck.bet;
      
      const deck = [];
      const suits = ['♠','♥','♦','♣'];
      const vals = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
      for (const s of suits) for (const v of vals) deck.push({s, v});
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      
      let hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
      
      const checkHand = (h) => {
        const counts = {};
        const suitCounts = {};
        const vMap = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
        const nums = h.map(c => vMap[c.v]).sort((a,b)=>a-b);
        h.forEach(c => { counts[c.v] = (counts[c.v]||0)+1; suitCounts[c.s] = (suitCounts[c.s]||0)+1; });
        const vals = Object.values(counts).sort((a,b)=>b-a);
        const isFlush = Object.values(suitCounts).includes(5);
        const isStraight = nums.every((n,i)=>i===0 || n === nums[i-1]+1);
        
        if (isFlush && isStraight && nums[0] === 10) return ['Royal Flush', 500];
        if (isFlush && isStraight) return ['Straight Flush', 100];
        if (vals[0] === 4) return ['Four of a Kind', 50];
        if (vals[0] === 3 && vals[1] === 2) return ['Full House', 15];
        if (isFlush) return ['Flush', 10];
        if (isStraight) return ['Straight', 7];
        if (vals[0] === 3) return ['Three of a Kind', 5];
        if (vals[0] === 2 && vals[1] === 2) return ['Two Pair', 3];
        if (vals[0] === 2) {
          const v = Object.keys(counts).find(k => counts[k] === 2);
          if (vMap[v] >= 11) return ['Jacks or Better', 2];
        }
        return ['Lose', 0];
      };
      
      const rigged = isRigged();
      if (rigged && checkHand(hand)[1] > 0) {
        let attempts = 0;
        while (checkHand(hand)[1] > 0 && attempts < 20) {
          hand = Array.from({length:5}, () => deck[Math.floor(Math.random()*deck.length)]); // simple re-draw for rigging
          attempts++;
        }
      }

      const [rank, mult] = checkHand(hand);
      const winAmt = bet * mult;
      const settled = settleCasinoRound('Poker (' + rank + ')', bet, winAmt, mult > 0 ? 'WIN' : 'LOSE');
      
      return jsonResp(200, { ok: true, hand, rank, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/coinflip') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const side = String(body.side || '').toLowerCase();
      if (!['heads', 'tails'].includes(side)) return jsonResp(400, { error: 'Choose heads or tails.' });
      const rigged = isRigged();
      let result = Math.random() < 0.5 ? 'heads' : 'tails';
      if (rigged && result === side) result = side === 'heads' ? 'tails' : 'heads';
      const won = side === result;
      const mult = won ? 1.9 : 0;
      const settled = settleCasinoRound('Coin Flip', betCheck.bet, won ? betCheck.bet * mult : 0, won ? 'WIN' : 'LOSE');
      return jsonResp(200, { ok: true, result, won, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/dice') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const side = String(body.side || '').toLowerCase();
      if (!['under', 'over'].includes(side)) return jsonResp(400, { error: 'Choose under or over.' });
      const rigged = isRigged();
      let roll = Math.floor(Math.random() * 100) + 1;
      if (rigged) {
        if (side === 'under' && roll < 50) roll = Math.floor(Math.random() * 51) + 50;
        else if (side === 'over' && roll > 51) roll = Math.floor(Math.random() * 51) + 1;
      }
      const won = side === 'under' ? roll < 50 : roll > 51;
      const mult = won ? 1.94 : 0;
      const settled = settleCasinoRound('Dice Duel', betCheck.bet, won ? betCheck.bet * mult : 0, won ? 'WIN' : 'LOSE');
      return jsonResp(200, { ok: true, roll, won, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/crash') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const target = Number(body.target);
      if (!Number.isFinite(target) || target < 1.2 || target > 6) return jsonResp(400, { error: 'Cashout must be between 1.20x and 6.00x.' });
      const rigged = isRigged();
      let crashAt = Number(Math.max(1, Math.min(10, 0.95 / Math.max(Math.random(), 0.000001))).toFixed(2));
      const cashout = Number(target.toFixed(2));
      if (rigged && cashout <= crashAt) crashAt = Number(Math.max(1, cashout - 0.01).toFixed(2));
      const won = cashout <= crashAt;
      const settled = settleCasinoRound('Crash', betCheck.bet, won ? betCheck.bet * cashout : 0, won ? 'WIN' : 'CRASH');
      return jsonResp(200, { ok: true, crashAt, target: cashout, won, mult: won ? cashout : 0, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/wheel') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const segments = [
        { label: 'Bust', mult: 0, weight: 85 },
        { label: 'Half Back', mult: 0.5, weight: 40 },
        { label: 'Small Win', mult: 1.25, weight: 32 },
        { label: 'Double', mult: 2, weight: 31 },
        { label: 'Triple', mult: 3, weight: 8 },
        { label: 'Meteor', mult: 8, weight: 3 },
        { label: 'Galaxy Jackpot', mult: 20, weight: 1 },
      ];
      const rigged = isRigged();
      let segment = weightedPick(segments);
      if (rigged && segment.mult >= 1) segment = segments[0]; // Force Bust
      const settled = settleCasinoRound('Prize Wheel', betCheck.bet, betCheck.bet * segment.mult, segment.mult >= 1 ? 'WIN' : 'LOSE');
      return jsonResp(200, { ok: true, segment: segment.label, mult: segment.mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/scratch') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const rigged = isRigged();
      let roll = Math.random();
      if (rigged && roll < 0.180) roll = 0.300 + Math.random() * 0.7; // Force No Match (roll >= 0.300)
      let mult = 0, rank = 'No Match';
      if (roll < 0.002) { mult = 90; rank = 'Triple Diamonds'; }
      else if (roll < 0.010) { mult = 25; rank = 'Triple Sevens'; }
      else if (roll < 0.040) { mult = 6; rank = 'Triple Bells'; }
      else if (roll < 0.100) { mult = 2.5; rank = 'Triple Fruit'; }
      else if (roll < 0.180) { mult = 1.5; rank = 'Small Match'; }
      else if (roll < 0.300) { mult = 1.0; rank = 'Half Back'; }
      const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
      const tiles = Array.from({ length: 9 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
      if (mult >= 25) { tiles[0] = tiles[4] = tiles[8] = mult >= 90 ? '💎' : '7️⃣'; }
      else if (mult >= 2.5) { tiles[1] = tiles[4] = tiles[7] = mult >= 6 ? '🔔' : '🍒'; }
      else if (mult > 0) { tiles[3] = tiles[4] = '🍋'; }
      const settled = settleCasinoRound('Scratch Card', betCheck.bet, betCheck.bet * mult, mult >= 1 ? 'WIN' : 'LOSE');
      return jsonResp(200, { ok: true, tiles, rank, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/keno') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const betCheck = readCasinoBet();
      if (betCheck.error) return jsonResp(400, { error: betCheck.error });
      const picks = Array.isArray(body.picks) ? [...new Set(body.picks.map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= 40).sort((a, b) => a - b) : [];
      if (picks.length < 3 || picks.length > 10) return jsonResp(400, { error: 'Pick 3 to 10 numbers.' });
      const payoutTable = {
        3: { 2: 2.1, 3: 14 },
        4: { 2: 0.9, 3: 5, 4: 38 },
        5: { 3: 2.8, 4: 14, 5: 90 },
        6: { 3: 1.3, 4: 5.5, 5: 38, 6: 210 },
        7: { 4: 3.6, 5: 17, 6: 90, 7: 480 },
        8: { 4: 2.4, 5: 8.5, 6: 45, 7: 190, 8: 950 },
        9: { 5: 5.5, 6: 25, 7: 120, 8: 450, 9: 1700 },
        10: { 5: 3.8, 6: 14, 7: 65, 8: 250, 9: 1000, 10: 2800 },
      };
      const rigged = isRigged();
      let drawn = drawUniqueNumbers(40, 12);
      let hitSet = new Set(drawn);
      let hits = picks.filter(n => hitSet.has(n));
      
      if (rigged && payoutTable[picks.length][hits.length]) {
        // If rigged and user was going to win, keep re-drawing until they lose
        let attempts = 0;
        while (payoutTable[picks.length][hits.length] && attempts < 20) {
          drawn = drawUniqueNumbers(40, 12);
          hitSet = new Set(drawn);
          hits = picks.filter(n => hitSet.has(n));
          attempts++;
        }
      }

      let mult = payoutTable[picks.length][hits.length] || 0;
      if (mult > 0) mult = Number((mult * 1.12).toFixed(2));
      const settled = settleCasinoRound('Keno Rush', betCheck.bet, betCheck.bet * mult, mult > 0 ? 'WIN' : 'LOSE');
      return jsonResp(200, { ok: true, picks, drawn, hits, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance });
    }

    if (path === '/api/casino/slots' || path === '/api/casino/vip/slots') {
      if (!casinoEnabled) return jsonResp(403, { error: 'Casino is currently closed.' });
      if (!await tryParseJson()) return jsonResp(400, { error: 'bad json' });
      const isVipRoom = path.includes('/vip/');
      
      const stats = loadUserStats();
      const norm = normalizeEmail(email);
      const isVip = stats[norm] && stats[norm].vip_casino_until > Date.now();
      
      if (isVipRoom && !isVip) return jsonResp(403, { error: 'VIP pass required' });

      const freeSpins = stats[norm]?.slots_free_spins || 0;
      const isFreeSpin = freeSpins > 0 && !isVipRoom;

      const bet = Number(body.amount);
      if (isVipRoom && bet < 100) return jsonResp(400, { error: 'VIP minimum bet is 100 coins' });
      
      if (isFreeSpin) {
        if (!Number.isFinite(bet) || bet < 1 || bet > 500) return jsonResp(400, { error: 'invalid bet (free spins limit max 500 coins)' });
        stats[norm].slots_free_spins = freeSpins - 1;
        saveUserStats(stats);
      } else {
        if (!Number.isFinite(bet) || bet < 1 || bet > getCoins(email)) return jsonResp(400, { error: 'invalid bet' });
        if (!isVip && bet > 500) return jsonResp(400, { error: 'Maximum bet is 500 coins. Buy a VIP Casino Pass in the shop for unlimited betting!' });
      }

      const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
      const rigged = isRigged();
      
      let results = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ];

      const getMult = (res) => {
        if (res[0] === res[1] && res[1] === res[2]) {
          const s = res[0];
          if (s === '💎') return 100;
          if (s === '7️⃣') return 50;
          if (s === '🔔') return 20;
          if (s === '🍒') return 10;
          return 6;
        } else if (res[0] === res[1]) return 3;
        return 0;
      };

      if (rigged && getMult(results) > 0) {
        let attempts = 0;
        while (getMult(results) > 0 && attempts < 20) {
          results = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
          ];
          attempts++;
        }
      }

      let mult = getMult(results);
      let rank = mult === 100 ? 'JACKPOT (Diamonds)' : mult === 50 ? 'Triple Sevens' : mult === 20 ? 'Triple Bells' : mult === 10 ? 'Triple Cherries' : mult === 6 ? 'Triple Fruit' : mult === 3 ? 'Double' : 'Lose';

      if (isVipRoom && mult > 0) mult = Number((mult * 1.1).toFixed(2)); // 10% VIP bonus

      const winAmt = bet * mult;
      const settled = settleCasinoRound((isVipRoom ? 'VIP ' : '') + 'Slots', bet, winAmt, mult > 0 ? 'WIN' : 'LOSE', isFreeSpin);
      
      return jsonResp(200, { ok: true, results, rank, mult, win: settled.payout, net: settled.net, newBalance: settled.newBalance, freeSpinsRemaining: stats[norm].slots_free_spins || 0 });
    }
  }

  if (path === '/api/canvas/admin-bans') {
    const cookies = getCookies(req);
    if (!isAnyAdminId(authSidFromCookies(cookies))) return jsonResp(403, { error: 'forbidden' });
    return jsonResp(200, loadJson(CANVAS_BANNED_FILE, {}));
  }

  if (path === '/api/admin/team-token') {
    if (!await tryParseJson()) return jsonResp(400, {});
    if (!checkAdminPw(body.pw)) return jsonResp(403, { error: 'forbidden' });
    const name = (body.name || '').trim();
    if (!name) return jsonResp(400, { error: 'name required' });
    const token  = randomBytes(24).toString('hex');
    const tokens = loadJson(TEAM_TOKENS_FILE, {});
    tokens[token] = { name, created: Date.now() };
    saveJson(TEAM_TOKENS_FILE, tokens);
    console.log(`[team] token created for ${name}`);
    return jsonResp(200, { token });
  }

  // ── GET routes ──────────────────────────────────────────────────────────────
  if (method === 'GET') {
    if (path === '/api/health') {
      const mem = process.memoryUsage();
      return jsonResp(200, {
        uptime: process.uptime(),
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
        },
        load: os.loadavg(),
        status: 'ok'
      });
    }

    if (path === '/api/me/coins') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      return jsonResp(200, {
        coins: getCoins(email),
        achievements: getAchievements(email),
        stats: loadUserStats()[normalizeEmail(email)] || {}
      });
    }

    if (path === '/api/leaderboard') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const coinsMap = loadCoins();
      const statsMap = loadUserStats();
      const profiles = loadJson(PROFILES_FILE, {});
      const cosmetics = loadJson(COSMETICS_FILE, {});
      
      const leaderboard = Object.entries(coinsMap).map(([email, coins]) => {
        const norm = normalizeEmail(email);
        const profile = profiles[norm] || {};
        const cosm = cosmetics[norm] || {};
        return {
          name: profile.displayName || email.split('@')[0],
          coins,
          wins: statsMap[norm]?.chess_wins || 0,
          puzzles: statsMap[norm]?.puzzles_solved || 0,
          pixels: statsMap[norm]?.pixels || 0,
          clicker_pts: statsMap[norm]?.clicker_points || 0,
          clicker_coins: statsMap[norm]?.clicker_coins || 0,
          typing_races: statsMap[norm]?.typing_races || 0,
          typing_coins: statsMap[norm]?.typing_coins || 0,
          logic_puzzles: statsMap[norm]?.logic_puzzles || 0,
          logic_coins: statsMap[norm]?.logic_coins || 0,
          email: maskEmail(email),
          color: publicActiveColor(email, cosm.activeColor),
          badge: cosm.activeBadge || null
        };

      });
      
      leaderboard.sort((a, b) => b.coins - a.coins);
      return jsonResp(200, { top: leaderboard.slice(0, 50) });
    }

    if (path === '/api/canvas/heatmap') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      return jsonResp(200, { points: Object.fromEntries(canvasHeatmap) });
    }

    if (path === '/api/friends/list') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const norm = normalizeEmail(email);
      const friends = loadJson(FRIENDS_FILE, {});
      const myList = friends[norm] || [];
      const now = Date.now();
      const online = Object.entries(cvOnline).filter(([, t]) => now - t < 120000).map(([e]) => e);
      const onlineSet = new Set(online.map(normalizeEmail));
      const res = myList.map(f => {
        const fNorm = normalizeEmail(f);
        const isOnline = onlineSet.has(fNorm);
        const presence = userPresence[fNorm];
        return {
          email: f,
          maskedEmail: maskEmail(f),
          online: isOnline,
          playing: isOnline && presence ? presence.playing : ''
        };
      });
      return jsonResp(200, { friends: res });
    }

    if (path === '/api/friends/requests/pending') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const norm = normalizeEmail(email);

      const requests = loadJson(FRIEND_REQUESTS_FILE, []);
      const incoming = requests.filter(r => normalizeEmail(r.to) === norm).map(r => ({
        from: r.from,
        maskedFrom: maskEmail(r.from),
        timestamp: r.timestamp
      }));
      const outgoing = requests.filter(r => normalizeEmail(r.from) === norm).map(r => ({
        to: r.to,
        maskedTo: maskEmail(r.to),
        timestamp: r.timestamp
      }));

      return jsonResp(200, { incoming, outgoing });
    }

    if (path === '/api/premium-chat/history') {
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email || !isPremiumEmail(email)) return jsonResp(403, { error: 'Premium required' });
      const history = loadJson(PREMIUM_CHAT_FILE, []);
      const viewerEmail = emailFromSid(sid);
      const messages = history.slice(-100).map(msg => {
        const processed = processMemberFields(msg.email, null, viewerEmail);
        return { 
          ...msg, 
          email: processed.email,
          color: publicActiveColor(msg.email || msg.name || '', msg.color) 
        };
      });
      return jsonResp(200, { messages });
    }

    if (path === '/api/public-chat/history') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const cookies = getCookies(req);
      const sid = cookies['studentId'] || cookies['id'] || '';
      if (!validId(sid)) return jsonResp(401, { error: 'unauthorized' });
      const email = emailFromSid(sid);
      if (!email) return jsonResp(401, { error: 'email not found' });
      const history = loadJson(PUBLIC_CHAT_FILE, []);
      const viewerEmail = emailFromSid(sid);
      const messages = history.slice(-100).map(msg => {
        const processed = processMemberFields(msg.email, null, viewerEmail);
        return { 
          ...msg, 
          email: processed.email,
          color: publicActiveColor(msg.email || msg.name || '', msg.color) 
        };
      });
      return jsonResp(200, { messages });
    }

    if (path === '/api/bell/override') {
      const rl = checkRateLimit(req, path); if (rl) return rl;
      const override = loadJson(join(DATA_DIR, 'bell_overrides.json'), null);
      return jsonResp(200, { override });
    }

    if (path.startsWith('/u/')) {
      const name = decodeURIComponent(path.slice(3)).trim();
      const profiles = loadJson(PROFILES_FILE, {});
      const norm = Object.keys(profiles).find(n => (profiles[n].displayName || '').toLowerCase() === name.toLowerCase());
      if (!norm) return errResp(404, 'Profile Not Found', 'No user found with that display name.');
      const p = profiles[norm];
      const stats = loadUserStats()[norm] || {};
      const achs = getAchievements(norm);
      try {
        const filePath = join(WEBROOT, 'profile.html');
        let html = readFileSync(filePath, 'utf8');
        const cosm = loadJson(COSMETICS_FILE, {}); 
        const userCosm = cosm[norm] || {}; 
        const dataInject = `<script>window.PUBLIC_PROFILE = ${JSON.stringify({ 
          displayName: p.displayName, 
          bio: p.bio, 
          website: p.website, 
          pfp: p.pfp, 
          background: p.background, 
          stats, 
          achievements: achs, 
          isPremium: isPremiumEmail(norm), 
          isAdmin: isAdminEmail(norm), 
          activeColor: publicActiveColor(norm, userCosm.activeColor), 
          activeBadge: userCosm.activeBadge || null 
        })};</script>`;
        html = injectReadability(html.replace('</head>', dataInject + '</head>'), '/profile/');
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } catch { return errResp(404, 'Profile UI Not Found'); }
    }

    // Serve team page without normal auth
    if (path === '/team' || path === '/team/' || path === '/team/index.html') {
      const filePath = join(WEBROOT, 'team', 'index.html');
      try {
        const html = injectReadability(readFileSync(filePath, 'utf8'), '/team/');
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      } catch { return new Response('Team page not found', { status: 404 }); }
    }

    // HTML pages with auth stub
    let htmlBase = path;
    if (htmlBase.endsWith('.html')) htmlBase = htmlBase.slice(0, -5);
    if (htmlBase.endsWith('/') && htmlBase.length > 1) htmlBase = htmlBase.slice(0, -1);
    const HTML_OPEN = new Set(['/roblox', '/enroll', '/claim', '/password',
                                '/appeal', '/unsubscribe', '/admin',
                                '/faq', '/use-agreement', '/privacy', '/bell', '/bell/index',
                                '/swift', '/swift/index', '/larp', '/larp/index', '/larp/rezero', '/larp/rezero/index']);
    const isHtmlRequest = path.endsWith('.html') || path.endsWith('/');
    const isOpenHtmlPage = isHtmlRequest && HTML_OPEN.has(htmlBase);
	    if (isHtmlRequest && !isOpenHtmlPage && !path.startsWith('/unsubscribe/')) {
	      const cookies = getCookies(req);
	      const sid = cookies['studentId'] || cookies['id'] || '';
	      const ban = bannedInfoForSid(sid);
	      if (ban) return bannedResponse(ban);
	      if (!checkPasswordCookie(req)) {
	        if (path !== '/') return Response.redirect('/enroll/', 302);
	      }
	    }
	    if (path.endsWith('.html') && !existsSync(join(WEBROOT, path.replace(/^\//, '')))) {
	      const dirName = path.slice(1, -5);
	      if (dirName && existsSync(join(WEBROOT, dirName, 'index.html'))) {
	        return Response.redirect('/' + dirName + '/' + url.search, 302);
	      }
	    }
	
	    // Inject tracking into HTML pages
	    if ((path.endsWith('.html') || path === '/' || (path.endsWith('/') && path.length > 1)) && path !== '/admin.html' && path !== '/roblox.html') {
	      let filePath;
	      if (path === '/') {
	        filePath = checkPasswordCookie(req) ? join(WEBROOT, 'index.html') : join(WEBROOT, 'index-sales.html');
	      }
	      else if (path.endsWith('/')) filePath = join(WEBROOT, path, 'index.html');

	      else filePath = join(WEBROOT, path.replace(/^\//, ''));

	      if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
	        try {
	          const cookies = getCookies(req);
	          const sid = cookies['studentId'] || cookies['id'] || '';
	          const email = sid ? emailFromSid(sid) : '';
	          const logUser = email || (sid ? sid.slice(0, 8) : 'anonymous');
	          logTraffic(logUser, path);
	        } catch (e) {
	          console.error('[traffic] Failed to log page traffic:', e);
	        }
	        try {
	          let raw    = readFileSync(filePath);

          let injectStr = '';
          const gaId = (process.env.GOOGLE_ANALYTICS_ID || '').trim();
          const rcKey = (process.env.RECAPTCHA_SITE_KEY || '').trim();
          const hasV2Script = raw.includes(Buffer.from('recaptcha/api.js'));

          if (gaId || (rcKey && !hasV2Script)) {
            injectStr += `\n<!-- mitch.pro PageSpeed Optimizations: Lazy Loaded GTM & reCAPTCHA -->\n<script>\n`;
            if (rcKey && !hasV2Script) {
              injectStr += `  window.getCaptchaToken = function(action) {\n` +
                           `    return new Promise(function(resolve) {\n` +
                           `      function executeToken() {\n` +
                           `        if (window.grecaptcha) {\n` +
                           `          grecaptcha.ready(function() {\n` +
                           `            grecaptcha.execute('${rcKey}', {action: action || 'page_view'}).then(function(token) {\n` +
                           `              resolve(token);\n` +
                           `            }).catch(function() {\n` +
                           `              resolve(null);\n` +
                           `            });\n` +
                           `          });\n` +
                           `        } else {\n` +
                           `          resolve(null);\n` +
                           `        }\n` +
                           `      }\n` +
                           `      if (window.grecaptcha) {\n` +
                           `        executeToken();\n` +
                           `      } else {\n` +
                           `        window.addEventListener('recaptcha-loaded', executeToken, { once: true });\n` +
                           `        triggerLoad();\n` +
                           `      }\n` +
                           `    });\n` +
                           `  };\n`;
            }
            injectStr += `  let _lazyLoaded = false;\n` +
                         `  function triggerLoad() {\n` +
                         `    if (_lazyLoaded) return;\n` +
                         `    _lazyLoaded = true;\n` +
                         `    window.removeEventListener('mousemove', triggerLoad);\n` +
                         `    window.removeEventListener('mousedown', triggerLoad);\n` +
                         `    window.removeEventListener('keydown', triggerLoad);\n` +
                         `    window.removeEventListener('touchstart', triggerLoad);\n` +
                         `    window.removeEventListener('scroll', triggerLoad);\n`;
            if (gaId) {
              injectStr += `    var ga = document.createElement('script');\n` +
                           `    ga.async = true;\n` +
                           `    ga.src = 'https://www.googletagmanager.com/gtag/js?id=${gaId}';\n` +
                           `    document.head.appendChild(ga);\n` +
                           `    window.dataLayer = window.dataLayer || [];\n` +
                           `    window.gtag = function(){dataLayer.push(arguments);};\n` +
                           `    gtag('js', new Date());\n` +
                           `    gtag('config', '${gaId}');\n`;
            }
            if (rcKey && !hasV2Script) {
              injectStr += `    var rc = document.createElement('script');\n` +
                           `    rc.src = 'https://www.google.com/recaptcha/api.js?render=${rcKey}';\n` +
                           `    rc.async = true;\n` +
                           `    rc.defer = true;\n` +
                           `    rc.onload = function() {\n` +
                           `      window.dispatchEvent(new Event('recaptcha-loaded'));\n` +
                           `    };\n` +
                           `    document.head.appendChild(rc);\n`;
            }
            injectStr += `  }\n` +
                         `  window.addEventListener('mousemove', triggerLoad, { passive: true });\n` +
                         `  window.addEventListener('mousedown', triggerLoad, { passive: true });\n` +
                         `  window.addEventListener('keydown', triggerLoad, { passive: true });\n` +
                         `  window.addEventListener('touchstart', triggerLoad, { passive: true });\n` +
                         `  window.addEventListener('scroll', triggerLoad, { passive: true });\n` +
                         `</script>\n`;
            if (rcKey && !hasV2Script) {
              injectStr += `<style>.grecaptcha-badge { visibility: hidden !important; }</style>\n`;
            }
          }
          if (injectStr) {
            const injectBuf = Buffer.from(injectStr);
            if (raw.includes(Buffer.from('</head>'))) {
              raw = Buffer.concat([
                raw.slice(0, raw.indexOf(Buffer.from('</head>'))),
                injectBuf,
                raw.slice(raw.indexOf(Buffer.from('</head>')))
              ]);
            } else if (raw.includes(Buffer.from('<body'))) {
              const idx = raw.indexOf(Buffer.from('<body'));
              const end = raw.indexOf(Buffer.from('>'), idx);
              raw = Buffer.concat([raw.slice(0, end + 1), injectBuf, raw.slice(end + 1)]);
            } else {
              raw = Buffer.concat([injectBuf, raw]);
            }
          }

        const cookies = getCookies(req);
        const sid = cookies['studentId'] || cookies['id'] || '';

        const agreeB = Buffer.from('<div id="_agree_footer" style="position:fixed;bottom:5px;left:0;right:0;text-align:center;pointer-events:none;z-index:2147483647;font-size:.65rem;color:rgba(255,255,255,.15);font-family:system-ui,sans-serif;letter-spacing:.01em;">By using mitch.pro you agree to the <a href="/use-agreement.html" style="color:rgba(255,255,255,.15);pointer-events:all;" target="_blank">use agreement<\/a> and <a href="/privacy.html" style="color:rgba(255,255,255,.15);pointer-events:all;" target="_blank">privacy policy<\/a>.<\/div>');

        if (!raw.includes(Buffer.from('_agree_footer'))) {
          const bi = raw.lastIndexOf(Buffer.from('<\/body>'));
          raw = bi >= 0
            ? Buffer.concat([raw.slice(0, bi), agreeB, raw.slice(bi)])
            : Buffer.concat([raw, agreeB]);
        }
        return new Response(raw, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        } catch {} // fall through to static serving
        }
        }
    // Protected theme files
    if (PROTECTED_FILES.has(basename(path))) {
      const cookies = getCookies(req);
      const ban = bannedInfoForSid(cookies['studentId'] || cookies['id'] || '');
      if (ban) return new Response(null, { status: 403 });
      if (!checkPasswordCookie(req)) return new Response(null, { status: 403 });
    }

    // Public assets whitelist
    const PUBLIC_ASSETS = new Set([
      '/auth.js', '/sync.js', '/auth-non-enrolled.js',
      '/assistant.js', '/broadcast.js', '/cookie-consent.js',
      '/jsmpeg.min.js',
      '/open.css', '/readability.css', '/theme.js',      '/sw.js',
      '/games/chess-bot/chessboard.min.js', '/games/chess-bot/chessboard.min.css',
      '/favicon.ico', '/icon-192.png', '/icon-512.png',
      '/robots.txt'
    ]);
    const isPieceSvg = path.startsWith('/games/chess-bot/pieces-svg/') && path.endsWith('.svg');
    if (!isOpenHtmlPage && !PUBLIC_ASSETS.has(path) && !isPieceSvg && !path.startsWith('/unsubscribe/') && !path.startsWith('/images/') && path !== '/larp' && !path.startsWith('/larp/') && !checkPasswordCookie(req)) {
      const cookies = getCookies(req);
      const ban = bannedInfoForSid(cookies['studentId'] || cookies['id'] || '');
      if (ban) return bannedResponse(ban);
      console.log(`[auth] redirecting ${path} from ${ip} (checkPasswordCookie failed)`);
      return Response.redirect('/enroll/', 302);
    }

    return serveStatic(path);
  }

  return errResp(405, null, null);
}

function isPrivateIP(ip, ipType) {
  const clean = ip.trim().toLowerCase();
  if (ipType === 4) {
    if (clean.startsWith('127.')) return true;
    if (clean.startsWith('10.')) return true;
    if (clean.startsWith('169.254.')) return true;
    if (clean.startsWith('192.168.')) return true;
    if (clean.startsWith('172.')) {
      const parts = clean.split('.');
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
    }
    if (clean === '0.0.0.0' || clean === '255.255.255.255') return true;
    if (clean.startsWith('224.') || clean.startsWith('240.')) return true;
  } else if (ipType === 6) {
    if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;
    if (clean.startsWith('fe80:')) return true;
    if (clean.startsWith('fc00:') || clean.startsWith('fd00:')) return true;
    if (clean === '::' || clean === '0:0:0:0:0:0:0:0') return true;
    if (clean.startsWith('ff')) return true;
  }
  return false;
}

// ── Start server ──────────────────────────────────────────────────────────────

console.log(`Starting server on http://${HOST}:${PORT}...`);

Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: handleRequest,
  websocket: {
    async open(ws) {
      allSockets.add(ws);
      if (ws.data && ws.data.proxyTo) {
        const emailParam = encodeURIComponent(ws.data.email || 'unknown');
        const upstreamUrl = `ws://127.0.0.1:${ws.data.proxyTo}${ws.data.proxyPath}?email=${emailParam}`;
        console.log(`[proxy] Opening upstream WebSocket to ${upstreamUrl}`);
        const upstream = new WebSocket(upstreamUrl);
        ws.data.upstream = upstream;
        upstream.binaryType = "arraybuffer";
        upstream.onmessage = (e) => {
          if (ws.readyState === 1) ws.send(e.data);
        };
        upstream.onclose = () => ws.close();
        upstream.onerror = (err) => {
          console.error(`[proxy] Upstream WebSocket error:`, err);
          ws.close();
        };
      }
    },
    async message(ws, msg) {
      if (ws.data && ws.data.proxyTo) {
        if (ws.data.upstream && ws.data.upstream.readyState === 1) {
          ws.data.upstream.send(msg);
        }
      }
      if (ws.data && ws.data.isSSH) {
        try {
          const payload = JSON.parse(msg);
          if (payload.type === 'init') {
            const hostVal = (payload.host || '').trim();
            const ipType = isIP(hostVal);
            if (ipType === 0) {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'error', message: 'Restricted access: Host must be a valid IP address' }));
              }
              ws.close();
              return;
            }
            if (isPrivateIP(hostVal, ipType)) {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'error', message: 'Restricted access: Target IP address is disallowed' }));
              }
              ws.close();
              return;
            }

            const conn = new SSHClient();
            ws.data.sshConn = conn;

            conn.on('ready', () => {
              conn.shell({ term: 'xterm-256color', cols: payload.cols || 80, rows: payload.rows || 24 }, (err, stream) => {
                if (err) {
                  if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to open shell: ' + err.message }));
                  }
                  ws.close();
                  return;
                }
                ws.data.sshStream = stream;
                if (ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'connected' }));
                }

                stream.on('data', (data) => {
                  if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'data', data: data.toString('utf-8') }));
                  }
                });

                stream.on('close', () => {
                  ws.close();
                });
              });
            });

            conn.on('error', (err) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
              }
              ws.close();
            });

            conn.on('close', () => {
              ws.close();
            });

            const connectOpts = {
              host: payload.host,
              port: payload.port || 22,
              username: payload.username,
            };
            if (payload.privateKey) {
              connectOpts.privateKey = payload.privateKey;
              if (payload.passphrase) {
                connectOpts.passphrase = payload.passphrase;
              }
            } else {
              connectOpts.password = payload.password;
            }
            conn.connect(connectOpts);

            // Immediately overwrite sensitive values in memory for maximum opsec
            payload.password = null;
            payload.privateKey = null;
            payload.passphrase = null;
            connectOpts.password = null;
            connectOpts.privateKey = null;
            connectOpts.passphrase = null;
          } else if (payload.type === 'data') {
            if (ws.data.sshStream) {
              ws.data.sshStream.write(payload.data);
            }
          } else if (payload.type === 'resize') {
            if (ws.data.sshStream) {
              ws.data.sshStream.setWindow(payload.rows, payload.cols, 0, 0);
            }
          }
        } catch (e) {
          // Silent catch to preserve absolute opsec and prevent logging any sensitive payload elements
        }
      }
    },
    async close(ws) {
      allSockets.delete(ws);
      if (ws.data && ws.data.upstream) {
        ws.data.upstream.close();
      }
      if (ws.data && ws.data.isSSH) {
        if (ws.data.sshStream) {
          try { ws.data.sshStream.end(); } catch (e) {}
        }
        if (ws.data.sshConn) {
          try { ws.data.sshConn.end(); } catch (e) {}
        }
      }
    }
  }
});

console.log(`Webserver active. Loading background systems...`);

setTimeout(() => {
  // ── Start workers ──────────────────────────────────────────────────────────── 
  scheduleDailySummary();
  setInterval(backupWorker, 12 * 3600 * 1000); 
  backupWorker(); 
  setInterval(premiumMaintenanceWorker, 6 * 3600 * 1000); 
  premiumMaintenanceWorker(); 
  setInterval(nudgeWorker, 600_000); 

  setInterval(happyHourWorker, 60000);
  computedHappyHour = getLeastUsedSchoolHour();
  happyHourWorker();
  loadGlobalGameStats();
  loadClickerSessions();
  loadTypingSessions();
  loadLogicSessions();
  loadRichardSessions();
  loadPianoSessions();
  console.log(`[startup] All systems active.`);
}, 100);

function isSchoolHoursPDT() {
  try {
    const laTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const laDate = new Date(laTimeStr);
    const day = laDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = laDate.getHours();
    // School days: Monday - Friday (1 - 5)
    // School hours: 8:00 AM to 3:00 PM PDT (8 to 15, i.e., 8:00 to 14:59)
    return (day >= 1 && day <= 5) && (hour >= 8 && hour < 15);
  } catch (e) {
    // Fallback if timezone formatting fails
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return (day >= 1 && day <= 5) && (hour >= 8 && hour < 15);
  }
}

function getLeastUsedSchoolHourSevenDays(logs) {
  try {
    const counts = { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 };
    const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    for (const log of logs) {
      if (!log.timestamp) continue;
      const ts = new Date(log.timestamp).getTime();
      if (ts < oneWeekAgo) continue;
      
      const laTimeStr = new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      const laDate = new Date(laTimeStr);
      const day = laDate.getDay();
      if (day >= 1 && day <= 5) {
        const hour = laDate.getHours();
        if (hour in counts) {
          counts[hour]++;
        }
      }
    }
    let leastHour = 12;
    let minCount = Infinity;
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalCount > 0) {
      for (let h = 8; h <= 14; h++) {
        if (counts[h] < minCount) {
          minCount = counts[h];
          leastHour = h;
        }
      }
    }
    return leastHour;
  } catch {
    return 12;
  }
}

function getLeastUsedSchoolHour() {
  try {
    const logs = loadJson(SESSION_LOG_FILE, []);
    const counts = { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 };
    
    // Find yesterday's calendar date in America/Los_Angeles timezone
    const laTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const laToday = new Date(laTimeStr);
    
    const laYesterday = new Date(laToday);
    laYesterday.setDate(laToday.getDate() - 1);
    
    const yYear = laYesterday.getFullYear();
    const yMonth = laYesterday.getMonth();
    const yDate = laYesterday.getDate();
    
    for (const log of logs) {
      if (!log.timestamp) continue;
      const ts = new Date(log.timestamp).getTime();
      
      const logLaStr = new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      const logLaDate = new Date(logLaStr);
      
      if (logLaDate.getFullYear() === yYear &&
          logLaDate.getMonth() === yMonth &&
          logLaDate.getDate() === yDate) {
        
        const hour = logLaDate.getHours();
        if (hour in counts) {
          counts[hour]++;
        }
      }
    }
    
    let leastHour = 12;
    let minCount = Infinity;
    
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalCount > 0) {
      for (let h = 8; h <= 14; h++) {
        if (counts[h] < minCount) {
          minCount = counts[h];
          leastHour = h;
        }
      }
      return leastHour;
    } else {
      // Fallback if yesterday was a weekend or school holiday
      return getLeastUsedSchoolHourSevenDays(logs);
    }
  } catch (e) {
    console.error("[happy-hour] failed to compute least used hour:", e);
    return 12;
  }
}

  function formatSchoolHour(hour) {
    const startHour = hour % 12 || 12;
    const startAmpm = hour < 12 ? "AM" : "PM";
    const endHour = (hour + 1) % 12 || 12;
    const endAmpm = (hour + 1) < 12 ? "AM" : "PM";
    return `${startHour}:00 ${startAmpm} - ${endHour}:00 ${endAmpm} PDT`;
  }

  function happyHourWorker() { 
    try { 
      const now = new Date();
      if (now.getMinutes() === 0 || typeof computedHappyHour === 'undefined') {
        computedHappyHour = getLeastUsedSchoolHour();
      }

      const laTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      const laDate = new Date(laTimeStr);
      const day = laDate.getDay();
      const hour = laDate.getHours();

      const isHHDayAndHour = (day >= 1 && day <= 5) && (hour === computedHappyHour);

      if (isHHDayAndHour) {
        if (!happyHourActive) {
          happyHourActive = true;
          globalCoinMultiplier = 2.0;
          console.log(`[happy-hour] Activated for designated hour: ${computedHappyHour}`);
          const payload = JSON.stringify({ type: "admin_broadcast", message: `HAPPY HOUR ACTIVATED! 2X Coins for everyone! (Runs ${formatSchoolHour(computedHappyHour)}) 🎰` });
          for (const ws of allSockets) {
            if (ws.data && ws.data.isBroadcast) {
              try { ws.send(payload); } catch {}
            }
          }
        }
      } else {
        if (happyHourActive) {
          happyHourActive = false;
          globalCoinMultiplier = 1.0;
          console.log(`[happy-hour] Deactivated.`);
          const payload = JSON.stringify({ type: "admin_broadcast", message: "Happy Hour has ended. 🍻" });
          for (const ws of allSockets) {
            if (ws.data && ws.data.isBroadcast) {
              try { ws.send(payload); } catch {}
            }
          }
        }
      }
    } catch (e) { console.error("[happy-hour] error:", e); }
  }

  console.log(`[startup] Webserver initialization complete.`);

  // Periodically prune expired messages from database on disk
  setInterval(() => {
    try {
      const dms = loadJson(DMS_FILE, []);
      const pruned = pruneDms(dms);
      if (pruned.length !== dms.length) {
        saveJson(DMS_FILE, pruned);
      }
    } catch {}
  }, 5 * 60 * 1000);
