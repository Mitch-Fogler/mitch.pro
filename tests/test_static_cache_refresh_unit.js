import assert from 'node:assert/strict';
import { join } from 'node:path';

const PORT = 6857;
const TEST_SECRET = 'test-deploy-secret-key-2026';
process.env.PORT = String(PORT);
process.env.SECRET_KEY = TEST_SECRET;

console.log('--- Starting server on port ' + PORT + ' ---');
const serverProc = Bun.spawn(['bun', join(import.meta.dir, '..', 'server.js')], {
  env: { ...process.env, PORT: String(PORT), SECRET_KEY: TEST_SECRET, NODE_ENV: 'production' },
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

  console.log('\n--- 1. Testing GET /api/cache/refresh stats ---');
  const getRes = await fetch(`${BASE_URL}/api/cache/refresh`);
  assert.equal(getRes.status, 200, 'GET /api/cache/refresh must return 200');
  const getData = await getRes.json();
  assert(typeof getData.cacheSize === 'number', 'cacheSize must be a number');
  assert(typeof getData.cacheBytes === 'number', 'cacheBytes must be a number');
  assert(typeof getData.maxBytes === 'number', 'maxBytes must be a number');
  console.log('GET /api/cache/refresh passed:', getData);

  console.log('\n--- 2. Testing unauthorized POST /api/cache/refresh ---');
  // With simulated external proxy IP so it is not treated as loopback
  const unauthRes = await fetch(`${BASE_URL}/api/cache/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mitch-Client-IP': '203.0.113.195',
      'X-Forwarded-For': '203.0.113.195',
    },
    body: JSON.stringify({ files: [] })
  });
  assert.equal(unauthRes.status, 401, 'Unauthorized request must return 401');
  console.log('Unauthorized POST /api/cache/refresh rejected with 401 as expected');

  console.log('\n--- 3. Testing authorized POST /api/cache/refresh with Bearer token ---');
  // First load a static asset so cache is populated
  await fetch(`${BASE_URL}/game-portal/ui/app.js`);

  const authRes = await fetch(`${BASE_URL}/api/cache/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_SECRET}`,
      'Host': 'mitch.pro'
    },
    body: JSON.stringify({ files: [] })
  });
  assert.equal(authRes.status, 200, 'Authorized request must return 200');
  const authData = await authRes.json();
  assert.equal(authData.success, true);
  assert.equal(authData.full, true);
  assert(typeof authData.evicted === 'number');
  console.log('Authorized full cache refresh passed:', authData);

  console.log('\n--- 4. Testing selective cache refresh ---');
  const selectiveRes = await fetch(`${BASE_URL}/api/cache/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deploy-Token': TEST_SECRET,
      'Host': 'mitch.pro'
    },
    body: JSON.stringify({ files: ['game-portal/ui/app.js'] })
  });
  assert.equal(selectiveRes.status, 200, 'Selective refresh must return 200');
  const selectiveData = await selectiveRes.json();
  assert.equal(selectiveData.success, true);
  assert.equal(selectiveData.selective, true);
  console.log('Selective cache refresh passed:', selectiveData);

  console.log('\n--- 5. Testing internal loopback header refresh ---');
  const loopbackRes = await fetch(`${BASE_URL}/api/cache/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Refresh': '1',
      'Host': 'mitch.pro'
    }
  });
  assert.equal(loopbackRes.status, 200, 'Internal loopback refresh must return 200');
  const loopbackData = await loopbackRes.json();
  assert.equal(loopbackData.success, true);
  console.log('Internal loopback refresh passed:', loopbackData);

  console.log('\n=== ALL STATIC CACHE REFRESH UNIT TESTS PASSED ===');
} finally {
  serverProc.kill();
}
