import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = process.env.SHOP_TEST_URL || 'http://127.0.0.1:8765/shop/';
const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const catalog = vm.runInNewContext(`${source.slice(source.indexOf('const DEFAULT_SHOP_CATALOG = ['), source.indexOf('let SHOP_CATALOG ='))}\nACTIVE_DEFAULT_SHOP_CATALOG`);

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const errors = [];
      const purchases = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { window.getCaptchaToken = async () => 'test-token'; });
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/shop/buy' && route.request().method() === 'POST') purchases.push(route.request().postDataJSON().itemId);
        const payload = url.pathname === '/api/me' ? { isPremium: false, isAdmin: false, vipUntil: 0 }
          : url.pathname === '/api/me/coins' ? { coins: 80 }
          : url.pathname === '/api/me/inventory' ? { cosmetics: { colors: [], badges: [], chatEffects: [], profileEffects: [], themes: [], tools: [] }, status: {} }
          : url.pathname === '/api/shop/items' ? { items: catalog }
          : { ok: true };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('.feature-item').first().waitFor();
      assert.equal(await page.locator('.feature-item').count(), 3);
      assert.equal(await page.locator('.card').count(), catalog.length);
      await page.locator('#shop-search').fill('artist');
      assert.equal(await page.locator('.card').count(), 1);
      await page.locator('#shop-search').fill('');
      await page.locator('.card[data-id="happy_hour_sprint"] .btn-buy').click();
      assert.deepEqual(purchases, ['happy_hour_sprint']);
      await page.locator('.feature-item').first().click();
      assert.equal(await page.locator('#info-modal.show').count(), 1);
      await page.locator('.modal-close-btn').click();
      await page.locator('#info-modal').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow at ${width}px`);
      assert.deepEqual(errors, []);
      if (process.env.SHOP_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SHOP_SCREENSHOT_DIR}/shop-${width}.png`, fullPage: true });
      await page.close();
    }
    console.log('Shop UI passed at desktop and mobile widths.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
