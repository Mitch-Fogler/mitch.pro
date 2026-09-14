import assert from 'node:assert/strict';
import { join } from 'node:path';

const PORT = 6851;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'production'; // test with production CSRF checks active!
process.env.DEV_TEST_ACCESS = '0';

console.log('--- Starting server on port ' + PORT + ' ---');
const serverProc = Bun.spawn(['bun', join(import.meta.dir, '..', 'server.js')], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
  stdio: ['ignore', 'inherit', 'inherit']
});

const BASE_URL = `http://localhost:${PORT}`;
for (let i = 0; i < 30; i++) {
  try {
    await fetch(`${BASE_URL}/api/site-info`);
    break;
  } catch {
    await new Promise(r => setTimeout(r, 500));
  }
}

try {
  console.log('\n--- 1. Testing /verify-open.json & /api/verify-open ---');
  // GET /verify-open.json
  const vRes = await fetch(`${BASE_URL}/verify-open.json`);
  assert.equal(vRes.status, 200, '/verify-open.json status must be 200');
  assert.equal(vRes.headers.get('access-control-allow-origin'), '*', 'CORS allow-origin must be *');
  const vData = await vRes.json();
  assert.equal(vData.status, 'open');
  assert.equal(vData.verified, true);
  assert.equal(vData.token, 'mitch-open-verified-2026');
  console.log('GET /verify-open.json passed:', vData);

  // OPTIONS /verify-open.json
  const vOpt = await fetch(`${BASE_URL}/verify-open.json`, { method: 'OPTIONS' });
  assert.equal(vOpt.status, 204, 'OPTIONS /verify-open.json status must be 204');
  assert.equal(vOpt.headers.get('access-control-allow-origin'), '*', 'OPTIONS CORS allow-origin must be *');
  console.log('OPTIONS /verify-open.json passed');

  // GET /api/verify-open
  const vApi = await fetch(`${BASE_URL}/api/verify-open`);
  assert.equal(vApi.status, 200);
  const vApiData = await vApi.json();
  assert.equal(vApiData.token, 'mitch-open-verified-2026');
  console.log('GET /api/verify-open passed');

  console.log('\n--- 2. Testing /api/games & /games/ ---');
  // GET /api/games
  const gRes = await fetch(`${BASE_URL}/api/games`);
  assert.equal(gRes.status, 200, 'GET /api/games status must be 200');
  const gData = await gRes.json();
  assert.equal(gData.success, true, 'GET /api/games success must be true');
  assert(gData.total > 0, 'GET /api/games total must be > 0');
  assert(typeof gData.content === 'string' && gData.content.length > 0, 'gData.content must not be empty');
  console.log(`GET /api/games passed: total games = ${gData.total}, chunk length = ${gData.content.split('\n').length}`);

  // POST /api/games without token
  const gpRes = await fetch(`${BASE_URL}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset: 0, limit: 10, q: '', cat: 'all' })
  });
  assert.equal(gpRes.status, 200, 'POST /api/games status must be 200');
  const gpData = await gpRes.json();
  assert.equal(gpData.success, true, 'POST /api/games success must be true');
  assert(gpData.total > 0, 'POST /api/games total must be > 0');
  console.log(`POST /api/games passed: total games = ${gpData.total}`);

  // GET /games/ HTML page (must not redirect to /enroll/)
  const gHtmlRes = await fetch(`${BASE_URL}/games/`, { redirect: 'manual' });
  assert.equal(gHtmlRes.status, 200, 'GET /games/ must return 200 (not redirect to /enroll/)');
  console.log('GET /games/ passed with status 200');

  console.log('\n--- 3. Testing CSRF on mitchdog.com for /api/premium/email/register ---');
  // POST with Origin: https://mitchdog.com and Host: mitch.pro
  const peRes = await fetch(`${BASE_URL}/api/premium/email/register`, {
    method: 'POST',
    headers: {
      'Host': 'mitch.pro',
      'Content-Type': 'application/json',
      'Origin': 'https://mitchdog.com',
      'X-Mitch-Requested-With': '1'
    },
    body: JSON.stringify({ subdomain: 'testsub', fullName: 'Test User', reasons: 'I like mitch.pro' })
  });
  const peData = await peRes.json();
  assert.notEqual(peData.error, 'csrf_blocked', 'Request from mitchdog.com must not be csrf_blocked!');
  console.log('POST /api/premium/email/register passed: returned error =', peData.error, '(not csrf_blocked)');

  console.log('\n--- 4. Testing rjuhsd.school alternate domain injection & probe ---');
  // GET / on rjuhsd.school host
  const rjRes = await fetch(`${BASE_URL}/`, {
    headers: { 'Host': 'rjuhsd.school' }
  });
  assert.equal(rjRes.status, 200);
  const rjHtml = await rjRes.text();
  assert(rjHtml.includes('Sign in with mitchdog.com'), 'Must inject alternate domain "Sign in with mitchdog.com" into sign-in text');
  assert(rjHtml.includes('https://mitchdog.com/api/sso/bridge'), 'Must inject alternate domain bridge href');
  assert(rjHtml.includes('/verify-open.json'), 'Must inject client verification probe script');
  assert(rjHtml.includes('mitch-open-verified-2026'), 'Must check verification token');
  console.log('rjuhsd.school HTML injection passed');

  // GET /rjuhsd/ preview on mitch.pro
  const rjPrevRes = await fetch(`${BASE_URL}/rjuhsd/`, {
    headers: { 'Host': 'mitch.pro' }
  });
  assert.equal(rjPrevRes.status, 200);
  const rjPrevHtml = await rjPrevRes.text();
  assert(rjPrevHtml.includes('Sign in with mitchdog.com'), 'Preview must inject alternate domain "Sign in with mitchdog.com"');
  assert(rjPrevHtml.includes('https://mitchdog.com/api/sso/bridge'), 'Preview must inject alternate bridge url');
  console.log('/rjuhsd/ preview injection passed');

  console.log('\n--- 5. Testing /sitemap.xml and RJUHSD school-specific SSR personalization ---');
  // GET /sitemap.xml on rjuhsd.school
  const smRes = await fetch(`${BASE_URL}/sitemap.xml`, {
    headers: { 'Host': 'rjuhsd.school' }
  });
  assert.equal(smRes.status, 200, 'GET /sitemap.xml must return 200');
  assert(smRes.headers.get('content-type')?.includes('xml'), 'sitemap content-type must be xml');
  const smText = await smRes.text();
  assert(smText.includes('https://rjuhsd.school/'), 'sitemap must include rjuhsd.school');
  assert(smText.includes('https://rjuhsd.school/?school=roseville'), 'sitemap must include roseville');
  console.log('GET /sitemap.xml on rjuhsd.school passed');

  // GET /sitemap.xml on mitch.pro
  const smMitchRes = await fetch(`${BASE_URL}/sitemap.xml`, {
    headers: { 'Host': 'mitch.pro' }
  });
  assert.equal(smMitchRes.status, 200);
  const smMitchText = await smMitchRes.text();
  assert(smMitchText.includes('https://mitch.pro/'), 'mitch.pro sitemap must include mitch.pro');
  assert(smMitchText.includes('https://mitch.pro/rjuhsd/'), 'mitch.pro sitemap must include rjuhsd');
  console.log('GET /sitemap.xml on mitch.pro passed');

  // GET /?school=roseville on rjuhsd.school
  const roseRes = await fetch(`${BASE_URL}/?school=roseville`, {
    headers: { 'Host': 'rjuhsd.school' }
  });
  assert.equal(roseRes.status, 200);
  const roseHtml = await roseRes.text();
  assert(roseHtml.includes('Roseville High School Bell Schedule'), 'Must personalize title for Roseville');
  assert(roseHtml.includes('https://rjuhsd.school/?school=roseville'), 'Must personalize canonical URL for Roseville');
  console.log('GET /?school=roseville personalized SSR passed');

  // GET /?school=granitebay on rjuhsd.school
  const gbRes = await fetch(`${BASE_URL}/?school=granitebay`, {
    headers: { 'Host': 'rjuhsd.school' }
  });
  assert.equal(gbRes.status, 200);
  const gbHtml = await gbRes.text();
  assert(gbHtml.includes('Granite Bay High School Bell Schedule'), 'Must personalize title for Granite Bay');
  console.log('GET /?school=granitebay personalized SSR passed');

  console.log('\n=== ALL FIXES VERIFIED SUCCESSFULLY! ===\n');
} finally {
  serverProc.kill();
}
