import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { bellScheduleRedirect, blooketBotRedirect, RJUHSD_ORIGIN, BLOOKET_BOT_ORIGIN } from '../lib/site_redirects.js';

for (const host of ['mitch.pro', 'rjuhsd.school', 'woodcreek.rjuhsd.school']) {
  for (const path of ['/bell', '/bell/', '/bell.html', '/bell/index', '/bell/index/', '/bell/index.html', '/bell/index.htm', '/rjuhsd/bell/']) {
    for (const method of ['GET', 'HEAD']) {
      const target = bellScheduleRedirect(new URL(`https://${host}${path}?school=oakmont&utm_source=shortcut`), method);
      assert.equal(target, RJUHSD_ORIGIN + '/?school=oakmont&utm_source=shortcut');
      assert.equal(bellScheduleRedirect(new URL(target), method), null, 'Redirect must not loop');
    }
  }
}
for (const path of ['/', '/bell/schedule.js?v=5', '/api/bell/override', '/rjuhsd-assets/app.js', '/bellringer/', '/encrypt/']) {
  assert.equal(bellScheduleRedirect(new URL('https://mitch.pro' + path)), null, `${path} must remain available`);
}
assert.equal(bellScheduleRedirect(new URL('https://mitch.pro/bell/'), 'POST'), null);

for (const path of ['/blooket-bot', '/blooket-bot/', '/blooket-bot.html', '/blooket-bot/index', '/blooket-bot/index/', '/blooket-bot/index.html']) {
  for (const method of ['GET', 'HEAD']) {
    assert.equal(blooketBotRedirect(new URL('https://mitch.pro' + path + '?pin=123456'), method), BLOOKET_BOT_ORIGIN + '/?pin=123456');
  }
}
for (const path of ['/', '/api/blooket-bot/status', '/previousblooket/', '/blooket-bot.css']) {
  assert.equal(blooketBotRedirect(new URL('https://mitch.pro' + path)), null, `${path} must not redirect`);
}
assert.equal(blooketBotRedirect(new URL('https://mitch.pro/blooket-bot/'), 'POST'), null);

for (const file of ['webserver/index.html', 'webserver/index-sales.html', 'webserver/app-shell.js']) {
  const source = readFileSync(file, 'utf8');
  assert(source.includes('https://rjuhsd.school/'), `${file} must link to the school hub`);
  assert(!/href\s*[:=]\s*['"]\/bell(?:\/|['"])/.test(source), `${file} still links to the old page`);
}

const home = readFileSync('webserver/index.html', 'utf8');
const location = { href: 'https://mitch.pro/' };
const context = vm.createContext({ URL, location, window: { location }, localStorage: { getItem() { throw new Error('School links must bypass game launch preferences'); } } });
vm.runInContext(home.slice(home.indexOf('function launchSite('), home.indexOf('function openInNewTab(')), context);
context.launchSite('iframe', 'https://rjuhsd.school/?school=oakmont');
assert.equal(location.href, 'https://rjuhsd.school/?school=oakmont');
context.launchSite('iframe', 'https://woodcreek.site/?pin=123456');
assert.equal(location.href, 'https://woodcreek.site/?pin=123456', 'Blooket Bot must bypass iframe/game launch preferences');

// Installed Mitch PWAs require a same-origin shortcut; the server redirects it.
const shortcut = JSON.parse(readFileSync('webserver/manifest.json', 'utf8')).shortcuts.find(item => item.name === 'Bell Schedule');
assert.equal(bellScheduleRedirect(new URL(shortcut.url, 'https://mitch.pro')), RJUHSD_ORIGIN + '/?utm_source=pwa-shortcut');
for (const file of ['webserver/app-shell.js', 'webserver/index.html', 'webserver/index-sales.html', 'data/sites']) {
  assert(readFileSync(file, 'utf8').includes('https://woodcreek.site/'), `${file} must point Blooket Bot to woodcreek.site`);
}
assert(readFileSync('webserver/app-shell.js', 'utf8').includes("label: 'Blooket Bot'"), 'Blooket Bot must be in the shared top navigation');

// Top-left brand logo on rjuhsd.school must use mitch.pro logo (/icon-192.png)
const rjuhsdHtml = readFileSync('webserver/rjuhsd/index.html', 'utf8');
assert(rjuhsdHtml.includes('<a class="brand" href="/" aria-label="rjuhsd.school home"><span class="brand-logo"><img class="site-logo" src="/icon-192.png"'), 'rjuhsd top left brand must use mitch.pro logo');
assert(!/<a class="brand"[^>]*><span class="brand-logo"><img[^>]*src="\/rjuhsd-assets\//.test(rjuhsdHtml), 'rjuhsd brand must not use school-based logo');

// Favicon on rjuhsd.school must use mitch.pro favicon (/favicon.ico)
assert(rjuhsdHtml.includes('<link rel="icon" href="/favicon.ico">'), 'rjuhsd favicon must use mitch.pro /favicon.ico');
assert(!/<link\s+rel="icon"[^>]*href="\/rjuhsd-assets\//.test(rjuhsdHtml), 'rjuhsd must not use rjuhsd-assets favicon');

const appJs = readFileSync('webserver/rjuhsd-assets/app.js', 'utf8');
assert(!appJs.includes("href=brand.logo"), 'app.js must not overwrite favicon with school logo');

// SEO & All-Schools bell schedules verification
const schools = ['woodcreek', 'roseville', 'granitebay', 'antelope', 'westpark', 'oakmont'];
const schoolDisplayNames = [
  'Woodcreek High School Bell Schedule',
  'Roseville High School Bell Schedule',
  'Granite Bay High School Bell Schedule',
  'Antelope High School Bell Schedule',
  'West Park High School Bell Schedule',
  'Oakmont High School Bell Schedule'
];

for (const name of schoolDisplayNames) {
  assert(rjuhsdHtml.includes(`<h3>${name}</h3>`), `rjuhsd/index.html must include heading for ${name}`);
}

for (const s of schools) {
  assert(rjuhsdHtml.includes(`data-school-card="${s}"`), `rjuhsd/index.html must have school card for ${s}`);
  assert(rjuhsdHtml.includes(`data-switch-school="${s}"`), `rjuhsd/index.html must have school switcher for ${s}`);
}

assert(rjuhsdHtml.includes('"@type": "ItemList"'), 'rjuhsd/index.html must have Schema.org ItemList');
assert(rjuhsdHtml.includes('"@type": "FAQPage"'), 'rjuhsd/index.html must have Schema.org FAQPage');
assert(rjuhsdHtml.includes('id="schools"'), 'rjuhsd/index.html must have #schools section');
assert(rjuhsdHtml.includes('id="faq"'), 'rjuhsd/index.html must have #faq section');

const sitemap = readFileSync('webserver/sitemap.xml', 'utf8');
assert(sitemap.includes('https://rjuhsd.school/'), 'sitemap.xml must include rjuhsd.school');
for (const s of schools) {
  assert(sitemap.includes(`https://rjuhsd.school/?school=${s}`), `sitemap.xml must include ${s}`);
}

const robots = readFileSync('webserver/robots.txt', 'utf8');
assert(robots.includes('Allow: /?school=*'), 'robots.txt must allow school queries');
assert(robots.includes('Sitemap: https://rjuhsd.school/sitemap.xml'), 'robots.txt must reference sitemap.xml');

console.log('Bell and Blooket links, legacy redirects, query preservation, assets, PWA shortcuts, all-school SEO, sitemaps, and direct navigation passed.');
