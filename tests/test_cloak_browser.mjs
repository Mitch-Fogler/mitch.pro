import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('https://cloak.test/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/tab-cloak.js') return route.fulfill({ contentType: 'application/javascript', body: readFileSync('webserver/tab-cloak.js', 'utf8') });
    if (path === '/tab-cloak.css') return route.fulfill({ contentType: 'text/css', body: readFileSync('webserver/tab-cloak.css', 'utf8') });
    if (path.endsWith('.svg') || path.endsWith('.ico')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    return route.fulfill({ contentType: 'text/html', body: '<title>Original page</title><link rel="icon" href="/original.ico"><header id="app-topbar"></header><script src="/tab-cloak.js"></script>' });
  });
  await page.goto('https://cloak.test/');
  await page.locator('#cloak-launcher').click();
  await page.locator('[data-cloak-mode="drive"]').click();
  assert.equal(await page.title(), 'My Drive - Google Drive');
  await page.evaluate(() => { document.title = 'Chat notification'; });
  await page.waitForFunction(() => document.title === 'My Drive - Google Drive');
  await page.reload();
  await page.waitForFunction(() => document.title === 'My Drive - Google Drive');
  await page.locator('#cloak-launcher').click();
  await page.locator('[data-reset]').click();
  assert.equal(await page.title(), 'Original page');
  assert.equal(await page.locator('link[rel=icon]').getAttribute('href'), '/original.ico');
  await page.locator('[data-shield]').click();
  assert(await page.locator('#cloak-shield').evaluate(el => el.open));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#cloak-shield').evaluate(el => el.open), false);
  await page.locator('#cloak-launcher').click();
  const bounds = await page.locator('#cloak-dialog').boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  for (const [width, height] of [[1366, 650], [1280, 600]]) {
    await page.setViewportSize({ width, height });
    const fits = await page.locator('#cloak-dialog').evaluate(el => {
      const box = el.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight && el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight;
    });
    assert(fits, `Cloak controls must fit a ${width}×${height} Chromebook viewport without scrolling`);
  }
  await page.addScriptTag({ url: 'https://cloak.test/tab-cloak.js' });
  assert.equal(await page.locator('#cloak-launcher').count(), 1);
  console.log('Cloak: apply, title guard, refresh persistence, reset, favicon restoration, shield, mobile bounds, duplicate initialization passed.');
} finally { await browser.close(); }
