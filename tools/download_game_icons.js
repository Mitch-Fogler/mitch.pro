#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ICONS_DIR = join(process.cwd(), 'data', 'game_icons');
const CATALOG_PATH = join(process.cwd(), 'webserver', 'game-portal', 'games.json');

async function downloadFile(url, destPath) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  writeFileSync(destPath, Buffer.from(buf));
  return buf.byteLength;
}

async function run() {
  if (!existsSync(ICONS_DIR)) mkdirSync(ICONS_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '20', 10);
  const maxDownload = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);

  console.log('Reading game catalog...');
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const urlsToDownload = [];

  catalog.links.forEach(section => {
    (section.games || []).forEach(game => {
      const thumb = String(game[1] || '');
      if (thumb.startsWith('https://img.gamemonetize.com/')) {
        const subPath = thumb.slice('https://img.gamemonetize.com/'.length);
        const fileName = subPath.replace('/', '_');
        const dest = join(ICONS_DIR, fileName);
        if (!existsSync(dest)) {
          urlsToDownload.push({ url: thumb, dest, title: game[0] });
        }
      }
    });
  });

  const targets = maxDownload > 0 ? urlsToDownload.slice(0, maxDownload) : urlsToDownload;
  const total = targets.length;
  console.log(`Found ${total} icons to download (concurrency: ${concurrency})...`);
  if (total === 0) {
    console.log('All icons already downloaded to disk!');
    return;
  }

  let completed = 0;
  let failed = 0;
  let totalBytes = 0;
  let index = 0;

  async function worker() {
    while (index < targets.length) {
      const current = targets[index++];
      try {
        const bytes = await downloadFile(current.url, current.dest);
        totalBytes += bytes;
        completed++;
      } catch (err) {
        failed++;
      }
      if ((completed + failed) % 25 === 0 || (completed + failed) === total) {
        const pct = (((completed + failed) / total) * 100).toFixed(1);
        const mb = (totalBytes / (1024 * 1024)).toFixed(1);
        process.stdout.write(`\r[download] ${completed + failed}/${total} (${pct}%) - ${mb} MB saved - ${failed} failed`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  console.log(`\nFinished: ${completed} downloaded, ${failed} failed. Total size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB.`);
}

run().catch(err => {
  console.error('Download error:', err.message);
  process.exit(1);
});
