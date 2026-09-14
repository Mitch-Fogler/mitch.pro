import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PORT = 6858;
process.env.PORT = String(PORT);

console.log('--- 1. Testing Preferences HTML & Redesign CSS static structures ---');
const prefsHtml = readFileSync(join(import.meta.dir, '..', 'webserver', 'preferences', 'index.html'), 'utf8');
assert(prefsHtml.includes('.bg-chip-alt'), 'preferences/index.html must define .bg-chip-alt');
assert(prefsHtml.includes('.bg-chip-media'), 'preferences/index.html must define .bg-chip-media');
assert(prefsHtml.includes('applyChipPreview(chip, url, name, thumbUrl)'), 'applyChipPreview must accept name and thumbUrl');
assert(prefsHtml.includes('applyChipPreview(chip, b.url, b.name, b.thumbUrl)'), 'renderPresetBgChips must pass thumbUrl');

const redesignCss = readFileSync(join(import.meta.dir, '..', 'webserver', 'rjuhsd-assets', 'redesign.css'), 'utf8');
assert(redesignCss.includes('.school-hub .hero'), 'redesign.css must style .school-hub .hero');
assert(redesignCss.includes('body.dark .school-hub .hero'), 'redesign.css must style body.dark .school-hub .hero');

console.log('Static structure checks passed!');

console.log('\n--- 2. Starting server on port ' + PORT + ' ---');
const serverProc = Bun.spawn(['bun', join(import.meta.dir, '..', 'server.js')], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
  stdio: ['ignore', 'inherit', 'inherit']
});

const BASE_URL = `http://localhost:${PORT}`;

try {
  // Wait for server to start
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/site-info`);
      if (res.ok) break;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n--- 3. Testing GET /api/backgrounds/list ---');
  const listRes = await fetch(`${BASE_URL}/api/backgrounds/list`);
  assert.equal(listRes.status, 200, 'GET /api/backgrounds/list must return 200');
  const listData = await listRes.json();
  assert(listData.ok === true, 'ok must be true');
  assert(Array.isArray(listData.items) && listData.items.length > 0, 'items must be non-empty array');

  for (const item of listData.items) {
    assert(item.id, 'item must have id');
    assert(item.name, 'item must have name');
    assert(item.url, 'item must have url');
    assert(item.thumbUrl, 'item must have thumbUrl');
    assert(item.thumbUrl.startsWith('/backgrounds/thumbs/'), 'thumbUrl must point to thumbs directory');
  }
  console.log(`Verified ${listData.items.length} background items with valid thumbUrls.`);

  console.log('\n--- 4. Testing Thumbnail serving and compression ratio ---');
  // Check a representative image wallpaper and video wallpaper
  const ghostItem = listData.items.find(i => i.id.includes('ghost-of-tsushima'));
  assert(ghostItem, 'Ghost of Tsushima wallpaper must exist');

  const thumbRes = await fetch(`${BASE_URL}${ghostItem.thumbUrl}`);
  assert.equal(thumbRes.status, 200, 'Thumbnail must return 200 OK');
  assert.equal(thumbRes.headers.get('content-type'), 'image/webp', 'Thumbnail must be image/webp');
  const thumbBuf = await thumbRes.arrayBuffer();
  assert(thumbBuf.byteLength < 25000, `Thumbnail size (${thumbBuf.byteLength} bytes) must be compressed under 25KB`);
  console.log(`Ghost of Tsushima thumbnail size: ${(thumbBuf.byteLength / 1024).toFixed(1)} KB (compressed from ~1MB)`);

  const videoItem = listData.items.find(i => i.type === 'video');
  if (videoItem) {
    const vidThumbRes = await fetch(`${BASE_URL}${videoItem.thumbUrl}`);
    assert.equal(vidThumbRes.status, 200, 'Video thumbnail must return 200 OK');
    assert.equal(vidThumbRes.headers.get('content-type'), 'image/webp', 'Video thumbnail must be image/webp');
    const vidThumbBuf = await vidThumbRes.arrayBuffer();
    assert(vidThumbBuf.byteLength < 25000, `Video thumbnail size (${vidThumbBuf.byteLength} bytes) must be compressed under 25KB`);
    console.log(`Video wallpaper thumbnail size: ${(vidThumbBuf.byteLength / 1024).toFixed(1)} KB (compressed from 13MB-20MB video)`);
  }

  console.log('\n=== ALL BACKGROUND PREVIEW UNIT TESTS PASSED ===');
} finally {
  serverProc.kill();
}
