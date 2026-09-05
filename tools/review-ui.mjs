import { chromium } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('artifacts/ui-review');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('hex');
const email = 'alex@example.test';
const members = [
  { email: 'jamie@example.test', nickname: 'Jamie Chen', displayName: 'Jamie Chen', handle: 'jamie', online: true, unread: 2, bio: 'Usually up for a game of chess.', lastSeen: Date.now(), pubKey: pub },
  { email: 'sam@example.test', nickname: 'Sam Rivera', displayName: 'Sam Rivera', handle: 'sam', online: true, lastSeen: Date.now(), pubKey: pub },
  { email: 'riley@example.test', nickname: 'Riley Morgan', displayName: 'Riley Morgan', handle: 'riley', online: false, lastSeen: Date.now() - 3600000, pubKey: pub },
  { email: 'avery@example.test', nickname: 'Avery Park', displayName: 'Avery Park', handle: 'avery', online: false, lastSeen: Date.now() - 7200000, pubKey: pub }
];
const destinations = [['encrypt', 'Encrypted Chat'], ['public-chat', 'Public Chat'], ['friends', 'Friends'], ['members', 'Members'], ['leaderboard', 'Leaderboard'], ['games', 'Games'], ['canvas', 'Canvas'], ['shop', 'Shop'], ['marketplace', 'Marketplace'], ['profile', 'Profile'], ['preferences', 'Preferences'], ['inventory', 'Inventory'], ['bell', 'Bell Schedule'], ['vms', 'Virtual Machines'], ['feedback', 'Feedback'], ['invite', 'Invite Friends']];
await context.addInitScript(({ jwk, email }) => {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) return;
  localStorage.setItem('_e2e_private_jwk_v3:' + encodeURIComponent(email), JSON.stringify(jwk));
  localStorage.setItem('_prefHomepage', JSON.stringify({ greetingName: 'Alex' }));
  localStorage.setItem('_mitch_cookie_consent', 'accepted');
}, { jwk, email });
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  let data = { success: true, ok: true, items: [], notifications: [], requests: [], members: [], messages: [], groups: [], listings: [], friends: [], games: [], entries: [], events: [], profile: {} };
  if (url.pathname === '/api/me') data = { email, nickname: 'Alex', pubKeyHex: pub, isAdmin: false, isPremium: false, coins: 1250, balance: 1250 };
  if (url.pathname === '/api/members') data = { members };
  if (url.pathname === '/api/pass') data = { success: true, content: destinations.map(([href, name]) => `url /${href}/ ${name}`).join('\n') };
  if (url.pathname === '/api/profile') data = { email, nickname: 'Alex', name: 'Alex', bio: 'A little bit of everything.', coins: 1250, balance: 1250, handle: 'alex', profile: { nickname: 'Alex', bio: 'A little bit of everything.' } };
  if (url.pathname === '/api/friends/list') data = { friends: members.slice(0, 2) };
  if (url.pathname === '/api/dm/groups') data = { groups: [{ id: 'study', name: 'After school', members: [email, members[0].email, members[1].email] }] };
  if (url.pathname === '/api/dm/inbox') data = { messages: url.searchParams.has('with') ? [
    { id: 'sample1', from: members[0].email, to: email, text: 'Are you around after school?', ts: Date.now() - 600000 },
    { id: 'sample2', from: email, to: members[0].email, text: 'Yeah! Thinking of checking out the new games.', ts: Date.now() - 480000 },
    { id: 'sample3', from: members[0].email, to: email, text: 'Chess rematch? I have been practicing.', ts: Date.now() - 120000 }
  ] : [] };
  if (url.pathname === '/api/vm/status') data = { hasVm: false };
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const routes = process.argv.includes('--all')
  ? ['/', '/index-sales.html', '/maintenance.html', ...(await readdir('webserver', { withFileTypes: true })).filter(x => x.isDirectory()).map(x => '/' + x.name + '/')]
  : ['/', '/encrypt/', '/game-portal/', '/preferences/', '/members/', '/shop/', '/profile/', '/enroll/', '/bell/', '/feedback/', '/faq/', '/admin/', '/index-sales.html'];
const results = [];
for (const route of routes) {
  errors.length = 0;
  try {
    const response = await page.goto('http://127.0.0.1:4317' + route, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (response.status() === 404) continue;
    await page.locator('body').waitFor();
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => ({ title: document.title, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, designed: document.body.classList.contains('mitch-design'), text: document.body.innerText.slice(0, 130) }));
    const slug = route.replaceAll('/', '_').replaceAll('.html', '') || 'home';
    await page.screenshot({ path: `${out}/${slug}-desktop.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${out}/${slug}-mobile.png`, fullPage: false });
    const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    results.push({ route, ...state, mobile, errors: [...errors] });
    await page.setViewportSize({ width: 1440, height: 1000 });
  } catch (error) { results.push({ route, error: error.message }); }
}
await page.goto('http://127.0.0.1:4317/encrypt/');
await page.locator('#app.ready').waitFor();
await page.locator('.user-entry').first().click();
await page.screenshot({ path: `${out}/chat-conversation-desktop.png` });
await page.getByRole('button', { name: 'Details', exact: true }).click();
if (!(await page.locator('#member-profile-panel').isVisible())) throw new Error('Details panel did not open');
await page.keyboard.press('Escape');
if (await page.locator('#member-profile-panel').isVisible()) throw new Error('Details panel did not close');
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/chat-conversation-mobile.png` });
await page.locator('#chat-back-btn').click();
if (!(await page.locator('#sidebar').isVisible())) throw new Error('Mobile back button did not restore conversations');
await page.locator('#new-group-btn').click();
if (!(await page.locator('#group-modal').isVisible())) throw new Error('New group modal did not open');
await page.locator('#close-group-modal').click();
await page.goto('http://127.0.0.1:4317/');
await page.keyboard.press('/');
if (!(await page.locator('#home-search').evaluate(el => el === document.activeElement))) throw new Error('Search shortcut did not focus search');
await page.locator('#home-search').fill('encrypted');
await page.keyboard.press('Escape');
if (await page.locator('#home-search').inputValue()) throw new Error('Escape did not reset search');
await context.addCookies([{ name: 'theme', value: 'light', url: 'http://127.0.0.1:4317' }]);
for (const route of ['/', '/encrypt/', '/preferences/', '/index-sales.html']) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4317' + route);
  if (!(await page.locator('html').evaluate(el => el.classList.contains('theme-light')))) throw new Error('Light theme not applied');
  await page.screenshot({ path: `${out}/${route.replaceAll('/', '_').replace('.html', '')}-light.png` });
}
await writeFile(`${out}/review.json`, JSON.stringify(results, null, 2));
if (!process.argv.includes('--all')) {
  const failures = results.filter(result => result.error || result.errors?.length || !result.designed || result.scrollWidth > result.width || result.mobile?.scrollWidth > result.mobile?.width);
  if (failures.length) throw new Error('UI audit failed: ' + failures.map(result => result.route).join(', '));
}
console.log(JSON.stringify(results.map(({ route, designed, scrollWidth, width, mobile, errors, error }) => ({ route, designed, overflow: scrollWidth > width, mobileOverflow: mobile?.scrollWidth > mobile?.width, errors, error })), null, 2));
await browser.close();
