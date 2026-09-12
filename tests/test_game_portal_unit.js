import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  GAME_PORTAL_DAILY_CAP,
  GAME_PORTAL_REWARD_PER_MINUTE,
  normalizeGamePortalTitle,
  settleGamePortalHeartbeat,
} from '../lib/game_portal_rewards.js';

assert.equal(GAME_PORTAL_REWARD_PER_MINUTE, 2, 'Portal reward should match the marketplace economy');
assert.equal(GAME_PORTAL_DAILY_CAP, 240, 'Portal rewards need a daily anti-idle cap');
assert.equal(normalizeGamePortalTitle('<b>Game</b>\nName'), 'bGame/bName');
assert.equal(normalizeGamePortalTitle('x'.repeat(100)).length, 60);

let state;
let result = settleGamePortalHeartbeat(state, 0, { active: true, game: 'Slope', dailyEarned: 0 });
assert.equal(result.earned, 0, 'Opening a game must not grant coins immediately');
state = result.next;
for (const now of [20_000, 40_000, 60_000]) {
  result = settleGamePortalHeartbeat(state, now, { active: true, game: 'Slope', dailyEarned: 0 });
  state = result.next;
}
assert.equal(result.earned, 2, 'One active minute should grant two MitchCoins');
assert.equal(result.minutes, 1);

result = settleGamePortalHeartbeat(state, 60_100, { active: true, game: 'Slope', dailyEarned: 2 });
assert.equal(result.earned, 0, 'Heartbeat spam must not grant coins');
result = settleGamePortalHeartbeat(state, 120_000, { active: true, game: 'Slope', dailyEarned: 2 });
assert.equal(result.earned, 0, 'Idle gaps must reset earning time');
result = settleGamePortalHeartbeat(state, 80_000, { active: true, game: 'Run 3', dailyEarned: 2 });
assert.equal(result.earned, 0, 'Switching games must not carry an old session reward');

state = { active: true, game: 'Slope', lastSeen: 0, accruedMs: 60_000 };
result = settleGamePortalHeartbeat(state, 20_000, { active: true, game: 'Slope', dailyEarned: GAME_PORTAL_DAILY_CAP });
assert.equal(result.earned, 0, 'The daily cap must be enforced server-side');

const html = readFileSync('webserver/game-portal/index.html', 'utf8');
const client = readFileSync('webserver/game-portal/portal.js', 'utf8');
const server = readFileSync('server.js', 'utf8');
const catalog = JSON.parse(readFileSync('webserver/game-portal/games.json', 'utf8'));
const catalogEntries = catalog.links.flatMap((section) => section.games || []);

assert(catalogEntries.length >= 300, 'The redesigned portal must include the full open-source game catalog');
assert(html.includes('id="game-grid"') && html.includes('id="game-player"'), 'Portal needs one catalog and one integrated player');
assert(!html.includes('/msn-games/'), 'The obsolete two-option chooser must be removed');
assert(client.includes("'/api/game-portal/heartbeat'"), 'Portal must report active gameplay to the authenticated backend');
assert(client.includes("'X-Mitch-Requested-With': '1'"), 'Reward heartbeat must include the application CSRF header');
assert(client.includes("'/proxy/luma'") && client.includes("'/proxy/calculated2'"), 'Integrated games must use the fixed same-origin game proxy');
assert(server.includes("touchUserPresence(email, active ? `Playing ${game}` : 'Browsing games')"), 'Game activity must feed live presence');
assert(server.includes("'/proxy/luma/': 'https://lumassets.pages.dev'") && server.includes("'/proxy/calculated2/': 'https://calculated2.github.io'"), 'The game proxy must only use fixed upstream origins');
assert(server.includes("!path.startsWith('/game-portal/')"), 'Portal assets must load before sign-in so SSO can complete cleanly');

for (const entry of catalogEntries) {
  if (String(entry[1] || '').startsWith('/img/games/')) {
    const filename = String(entry[1]).slice('/img/games/'.length);
    assert(existsSync(`webserver/game-portal/icons/${filename}`), `Missing game icon: ${filename}`);
  }
}

console.log('Game catalog, live presence, secure play rewards, and portal UI checks passed.');
