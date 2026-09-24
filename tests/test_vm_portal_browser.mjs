import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.env.VM_PORTAL_TEST_URL || 'http://127.0.0.1:8765/vms/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const vm = {
  id: 'test-vm', name: 'My Computer', operatingSystem: 'Ubuntu Desktop 24.04 LTS',
  status: 'stopped', cpuCores: 8, cpuUsage: 0, memoryUsed: 0,
  memoryTotal: 16 * 1073741824, diskUsed: 34 * 1073741824,
  diskTotal: 128 * 1073741824, ipAddress: '', uptime: 0,
  desktopAvailable: true, adminAccessAllowed: false, adminAccessRequested: false,
  cooldownRemainingSeconds: 0, upgrades: { dailyMaxSeconds: 21600 },
  lease: { isExempt: false, remainingSeconds: 21600, canExtend: true, extended: false, dailyExtensionUsed: false }
};

try {
  for (const width of [1920, 1440, 1280, 820, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: 1 });
    const errors = [], actions = [];
    let current = { ...vm }, delayRefresh = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/vm/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/vm/computers' && delayRefresh) await new Promise(resolve => setTimeout(resolve, 250));
      if (route.request().method() === 'POST') actions.push({ path: url.pathname, body: route.request().postDataJSON() });
      const data = url.pathname === '/api/vm/computers' ? { computers: [current], isEligible: true }
        : url.pathname === '/api/vm/upgrades' ? { catalog: { cpu: [] }, current: {}, coins: 100 }
        : { success: true, message: 'Done' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.computer-card').waitFor();
    assert.equal(await page.locator('.main-action').innerText(), 'Start Computer');
    assert.equal(await page.locator('.status-pill').last().innerText(), 'Offline');
    assert.equal(await page.locator('.preview-overlay').count(), 1);
    assert.equal(await page.locator('[data-action="restart"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow at ${width}px`);
    if (width === 1440 || width === 390) {
      delayRefresh = true;
      await page.locator('#refresh-button').click();
      await page.locator('#refresh-button.is-loading').waitFor();
      assert.equal(await page.locator('#refresh-button').getAttribute('aria-label'), 'Refreshing computer status');
      await page.locator('#refresh-button:not(.is-loading)').waitFor();
      delayRefresh = false;
      if (process.env.VM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.VM_SCREENSHOT_DIR}/vm-offline-${width}.png`, fullPage: true });
      await page.locator('.main-action').click();
      assert.equal(actions.at(-1)?.body.action, 'start');
      assert.match(await page.locator('.main-action').innerText(), /Starting/);
      await page.locator('#refresh-button').click();
      current = { ...vm, status: 'running', ipAddress: '10.1.2.3', uptime: 3600, cpuUsage: .25, memoryUsed: 4 * 1073741824, adminAccessRequested: true };
      await page.locator('#refresh-button').click();
      await page.locator('.main-action').filter({ hasText: 'Open Desktop' }).waitFor();
      assert.equal(await page.locator('.preview-overlay').count(), 0);
      assert.equal(await page.locator('.resource-meter').count(), 3);
      assert.equal(await page.locator('.admin-request-banner').count(), 1);
      await page.locator('.more-menu summary').click();
      assert.equal(await page.locator('[data-action="restart"]').isVisible(), true);
      await page.locator('[data-action="restart"]').click();
      assert.equal(await page.locator('#confirm-dialog[open]').count(), 1);
      await page.locator('#confirm-dialog [value="cancel"]').click();
      await page.locator('[data-action="grant-admin-access"]').click();
      assert.equal(actions.at(-1)?.body.allow, true);
      await page.locator('[data-action="open-upgrade"]').click();
      assert.equal(await page.locator('#upgrade-dialog[open]').count(), 1);
      await page.locator('#upgrade-close-btn').click();
      await page.locator('.more-menu summary').click();
      await page.locator('[data-action="recreate"]').click();
      assert.equal(await page.locator('#provision-dialog[open]').count(), 1);
      await page.locator('#provision-cancel').click();
      await page.locator('.more-menu summary').click();
      await page.locator('[data-action="shutdown"]').click();
      const shutdownRequest = page.waitForRequest(request => request.url().endsWith('/power') && request.postDataJSON()?.action === 'shutdown');
      await page.locator('#confirm-action').click();
      assert.equal((await shutdownRequest).postDataJSON().action, 'shutdown');
      assert.match(await page.locator('.main-action').innerText(), /Shutting down/);
      if (process.env.VM_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.VM_SCREENSHOT_DIR}/vm-online-${width}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('VM portal layout and controls passed at five viewport widths.');
} finally {
  await browser.close();
}
