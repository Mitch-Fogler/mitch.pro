import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const script = readFileSync(join(import.meta.dirname, '..', 'webserver', 'broadcast.js'), 'utf8');
const broadcastId = 'multi-pc-browser-test';
const browser = await chromium.launch({ headless: true });

try {
  const pages = await Promise.all([0, 1].map(async () => {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body><main>PC</main></body></html>');
    await page.evaluate(({ id }) => {
      class BlockedWebSocket {
        static OPEN = 1;
        static CONNECTING = 0;
        constructor() { this.readyState = BlockedWebSocket.CONNECTING; }
        send() {}
      }
      window.WebSocket = BlockedWebSocket;
      window.fetch = async (url) => {
        if (String(url).includes('/api/broadcast/latest')) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              active: true,
              event: {
                broadcastId: id,
                type: 'admin_jumpscare',
                message: 'Two-PC fallback test',
                createdAt: Date.now(),
                expiresAt: Date.now() + 60_000,
              },
            }),
          };
        }
        return { ok: false, json: async () => ({}) };
      };
      HTMLMediaElement.prototype.play = async function play() {};
      HTMLMediaElement.prototype.pause = function pause() {};
    }, { id: broadcastId });
    await page.addScriptTag({ content: script });
    return page;
  }));

  await Promise.all(pages.map(page => page.waitForSelector('#admin-video-jumpscare')));
  await new Promise(resolve => setTimeout(resolve, 3_250));

  for (const page of pages) {
    assert.equal(await page.locator('#admin-video-jumpscare').count(), 1, 'Each PC should show exactly one video overlay');
    assert.equal(await page.locator('#admin-video-jumpscare video').getAttribute('src'), '/media/admin-jumpscare-krupp-1935.mp4');
  }

  console.log('Two independent PCs receive one deduplicated video through the WebSocket-blocked polling fallback.');
} finally {
  await browser.close();
}
