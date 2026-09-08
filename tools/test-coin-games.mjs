import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
let balance = 1250.25;
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname !== '127.0.0.1') return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  let data = { ok: true, success: true, items: [], messages: [], members: [], groups: [], games: [], entries: [], listings: [], achievements: [], stats: {}, state: {} };
  if (url.pathname === '/api/me/coins') data = { coins: balance };
  if (url.pathname === '/api/me') data = { email: 'player@example.test', coins: balance };
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});
const page = await context.newPage();
for (const game of ['adrian-clicker', 'richards-riches', 'pennys-piano-keys', 'sebastians-piccolo', 'kodys-keyboard', 'lillians-logic', 'chess-bot', 'battleship', 'jeopardy-battle']) {
  await page.goto('http://127.0.0.1:4317/games/' + game + '/');
  await page.waitForFunction(() => document.querySelector('.mitch-wallet')?.dataset.state === 'ready');
  assert.equal(await page.locator('.mitch-wallet').count(), 1, game + ': duplicate balance');
  assert(await page.locator('.mitch-coin-gamebar').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), game + ': wallet toolbar out of bounds');
}
await page.goto('http://127.0.0.1:4317/preferences/');
await page.waitForFunction(() => document.querySelector('.mitch-wallet')?.dataset.state === 'ready');
await page.evaluate(() => {
  const frame = document.createElement('iframe'); frame.id = 'coin-game-frame'; frame.src = '/games/adrian-clicker/'; document.body.appendChild(frame);
});
await page.frameLocator('#coin-game-frame').locator('#auto-claim-toggle').waitFor();
const frame = page.frames().find(frame => frame.url().includes('/games/adrian-clicker/'));
await frame.waitForFunction(() => !!window.MitchCoins);
assert.equal(await frame.locator('.mitch-wallet').count(), 0, 'Embedded game must not duplicate the site toolbar');
balance = 1450.25;
await frame.evaluate(() => fetch('/api/games/adrian-clicker/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
await page.waitForFunction(() => document.querySelector('.mitch-wallet-value').textContent === '1,450.25');
await browser.close();
console.log('Nine game toolbars and embedded-game reward refresh passed.');
