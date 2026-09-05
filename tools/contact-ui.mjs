import { chromium } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
const dir = 'artifacts/ui-review';
const files = (await readdir(dir)).filter(name => name.endsWith('-desktop.png'));
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
for (let start = 0; start < files.length; start += 9) {
  const cards = await Promise.all(files.slice(start, start + 9).map(async name => `<figure><figcaption>${name.replace('-desktop.png', '')}</figcaption><img src="data:image/png;base64,${(await readFile(`${dir}/${name}`)).toString('base64')}"></figure>`));
  await page.setContent(`<style>body{margin:0;background:#eee;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font:16px sans-serif}figure{margin:0}figcaption{padding:8px;background:#fff;color:#111}img{width:100%;display:block}</style>${cards.join('')}`);
  await page.screenshot({ path: `${dir}/contact-${start / 9 + 1}.png`, fullPage: true });
}
await browser.close();
