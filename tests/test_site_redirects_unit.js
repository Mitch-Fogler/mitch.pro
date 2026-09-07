import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { bellScheduleRedirect, RJUHSD_ORIGIN } from '../lib/site_redirects.js';

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

// Installed Mitch PWAs require a same-origin shortcut; the server redirects it.
const shortcut = JSON.parse(readFileSync('webserver/manifest.json', 'utf8')).shortcuts.find(item => item.name === 'Bell Schedule');
assert.equal(bellScheduleRedirect(new URL(shortcut.url, 'https://mitch.pro')), RJUHSD_ORIGIN + '/?utm_source=pwa-shortcut');
console.log('Bell links, legacy redirects, query preservation, assets, PWA shortcuts, and direct navigation passed.');
