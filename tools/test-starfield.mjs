import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const origin = 'http://127.0.0.1:4320';
const server = spawn('bun', ['tools/preview-ui.js'], { env: { ...process.env, UI_PORT: '4320' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/starfield', { recursive: true });
try {
  async function setup(options = {}, restored = false) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', ...options });
    await context.addInitScript(() => {
      localStorage.setItem('_mitch_cookie_consent', 'accepted');
      const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
      window.starfieldFrames = new Set();
      window.starfieldListeners = [];
      const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (type, callback, options) {
        if (new Error().stack.includes('/backgrounds/starfield.js')) starfieldListeners.push({ target: this, type, callback });
        return add.call(this, type, callback, options);
      };
      EventTarget.prototype.removeEventListener = function (type, callback, options) {
        window.starfieldListeners = starfieldListeners.filter(item => item.target !== this || item.type !== type || item.callback !== callback);
        return remove.call(this, type, callback, options);
      };
      window.requestAnimationFrame = function (callback) {
        const tracked = callback.name === 'tickStarfield';
        const id = request.call(window, time => { window.starfieldFrames.delete(id); callback(time); });
        if (tracked) window.starfieldFrames.add(id);
        return id;
      };
      window.cancelAnimationFrame = function (id) { window.starfieldFrames.delete(id); cancel.call(window, id); };
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let data = { ok: true, success: true, items: [], members: [], messages: [], friends: [], notifications: [], groups: [], requests: [], profile: {} };
      if (url.pathname === '/api/me') data = { email: 'starfield@example.test', nickname: 'Player', coins: 100, isAdmin: false };
      if (url.pathname === '/api/backgrounds/list') data.items = [{ name: 'Mountain', url: '/backgrounds/wallhaven-black-mountain.webp' }];
      if (url.pathname === '/api/userdata' && restored && route.request().method() === 'GET') data = { _snapshot: { theme_bgimg: 'effect:starfield' }, _snapshot_ts: Date.now() + 60000 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    return context;
  }
  const context = await setup();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const canvas = page.locator('#mitch-bg-starfield');
  async function selected() { await canvas.waitFor(); assert.equal(await canvas.count(), 1); }
  async function frames(expected) { assert.equal(await page.evaluate(() => starfieldFrames.size), expected); }
  await page.goto(origin + '/preferences/#appearance');
  const chip = page.getByRole('button', { name: 'Use Starfield background', exact: true });
  await chip.click();
  await selected();
  assert.equal(await page.evaluate(() => localStorage.getItem('theme_bgimg')), 'effect:starfield');
  await page.waitForTimeout(100);
  await frames(1);
  const moving = await canvas.evaluate(el => el.toDataURL());
  await page.waitForTimeout(150);
  assert.notEqual(await canvas.evaluate(el => el.toDataURL()), moving);
  assert.equal(await canvas.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  await page.evaluate(() => { window.firstStarfield = document.querySelector('#mitch-bg-starfield'); for (let i = 0; i < 10; i++) __theme.apply('dark'); });
  assert.ok(await page.evaluate(() => firstStarfield === document.querySelector('#mitch-bg-starfield')));
  await frames(1);
  await page.screenshot({ path: 'artifacts/starfield/preferences-desktop.png' });
  await page.reload(); await selected(); await frames(1);
  await page.goto(origin + '/'); await selected();
  await page.screenshot({ path: 'artifacts/starfield/home-desktop.png' });
  await page.goto(origin + '/preferences/#appearance'); await selected();
  await page.getByRole('button', { name: 'Use Mountain background', exact: true }).click();
  assert.equal(await canvas.count(), 0); await frames(0);
  assert.equal(await page.evaluate(() => starfieldListeners.length), 0);
  assert.ok(await page.evaluate(() => document.documentElement.style.getPropertyValue('--t-bg-img-layer').includes('wallhaven')));
  await page.evaluate(() => { __theme.setBg('effect:starfield'); __theme.setBg('/backgrounds/wallhaven-black-mountain.webp'); });
  await page.waitForTimeout(100); assert.equal(await canvas.count(), 0); await frames(0);
  await chip.click(); await selected();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100); await frames(0);
  const still = await canvas.evaluate(el => el.toDataURL());
  await page.waitForTimeout(300); assert.equal(await canvas.evaluate(el => el.toDataURL()), still);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(100); await frames(1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await frames(0);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await frames(1);
  await page.evaluate(() => { localStorage.setItem('theme_motion', 'off'); __theme.apply('dark'); });
  await frames(0);
  await page.evaluate(() => { localStorage.setItem('theme_motion', 'on'); __theme.apply('dark'); });
  await frames(1);
  await page.evaluate(() => __theme.setBg('/backgrounds/test.webm'));
  assert.equal(await canvas.count(), 0); await frames(0);
  assert.equal(await page.locator('#mitch-bg-video').count(), 1);
  await page.evaluate(() => __theme.setBg('effect:starfield')); await selected();
  assert.equal(await page.locator('#mitch-bg-video').count(), 0);
  await page.evaluate(() => __theme.apply('light')); await selected();
  await page.waitForTimeout(500);
  await page.locator('#appearance').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/starfield/preferences-light.png' });
  await page.evaluate(() => __theme.apply('dark'));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide'))); await frames(0);
  assert.equal(await canvas.count(), 0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await selected(); await frames(1);
  const mobile = await setup({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await mobile.newPage();
  await phone.goto(origin + '/preferences/#appearance');
  await phone.getByRole('button', { name: 'Use Starfield background', exact: true }).click();
  await phone.locator('#mitch-bg-starfield').waitFor();
  assert.equal(await phone.evaluate(() => starfieldFrames.size), 0);
  const size = await phone.locator('canvas#mitch-bg-starfield').evaluate(el => ({ width: el.width, height: el.height, viewport: innerWidth }));
  assert.ok(size.width <= size.viewport * 1.5 + 1);
  await phone.screenshot({ path: 'artifacts/starfield/preferences-mobile.png' });
  await phone.emulateMedia({ reducedMotion: 'no-preference' });
  const cdp = await mobile.newCDPSession(phone);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const throughput = await phone.evaluate(() => new Promise(resolve => {
    const canvas = document.querySelector('#mitch-bg-starfield');
    const ctx = canvas.getContext('2d'), fill = ctx.fillRect;
    let count = 0;
    ctx.fillRect = function (...args) { count++; return fill.apply(this, args); };
    setTimeout(() => { ctx.fillRect = fill; resolve(count); }, 1100);
  }));
  assert.ok(throughput >= 15, 'Throttled mobile should sustain at least 15 draws/second');
  console.log('Mobile draws in 1.1s at 6x CPU throttle:', throughput);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.waitForTimeout(100);
  assert.equal(await phone.locator('#mitch-bg-starfield').evaluate(el => el.width), Math.round(await phone.evaluate(() => innerWidth) * 1.5));
  const restore = await setup({}, true);
  const restoredPage = await restore.newPage();
  await restoredPage.goto(origin + '/preferences/');
  await Promise.all([restoredPage.waitForEvent('load'), restoredPage.locator('#_sync_yes').click()]);
  await restoredPage.locator('#mitch-bg-starfield').waitFor();
  assert.ok((await restore.cookies()).some(cookie => cookie.name === 'bgimg' && decodeURIComponent(cookie.value) === 'effect:starfield'));
  const fallback = await setup();
  await fallback.route('**/api/backgrounds/list', route => route.fulfill({ status: 503, body: '' }));
  const offline = await fallback.newPage();
  await offline.goto(origin + '/preferences/#appearance');
  await offline.getByRole('button', { name: 'Use Starfield background', exact: true }).click();
  await offline.locator('#mitch-bg-starfield').waitFor();
  assert.equal(await offline.locator('[data-url="effect:starfield"]').count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: picker, immediate apply, refresh, account restore, cleanup, navigation, click-through, mobile/DPR, visibility, reduced motion, static/video backgrounds.');
} finally {
  await browser.close(); server.kill();
}
