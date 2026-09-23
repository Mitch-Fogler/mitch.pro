import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = join(import.meta.dir, '..');
const html = readFileSync(join(root, 'webserver/enroll/index.html'), 'utf8');
const server = readFileSync(join(root, 'server.js'), 'utf8');
const script = html.slice(html.indexOf('function postLoginDestination()'), html.indexOf('function updateBtn()'));
const mainScript = html.match(/<script>\s*var _attempts[^]*?<\/script>/)?.[0];
assert.ok(mainScript, 'enrollment script should be present');
new vm.Script(mainScript.slice('<script>'.length, -'</script>'.length));

function page(search = '', fetchImpl = async () => ({ ok: true, json: async () => ({ rawEmail: 'user@example.com' }) })) {
  const location = { origin: 'https://mitchdog.com', hostname: 'mitchdog.com', search };
  const context = { window: { location }, location, URL, URLSearchParams, fetch: fetchImpl, setTimeout };
  vm.runInNewContext(script, context);
  return context;
}

assert.equal(page().postLoginDestination(), '/');
assert.equal(page('?next=%2Fcasino%2F').postLoginDestination(), '/casino/');
assert.equal(page('?next=https%3A%2F%2Fmitch.pro%2Fgames%2F%3Fx%3D1').postLoginDestination(), '/games/?x=1');
assert.equal(page('?next=https%3A%2F%2Fmitchdog.com%2Fcasino%2F').postLoginDestination(), 'https://mitchdog.com/casino/');
assert.equal(page('?next=https%3A%2F%2Frjuhsd.school%2Fmatrix%2F').postLoginDestination(),
  '/api/sso/bridge?back=https%3A%2F%2Frjuhsd.school%2Fmatrix%2F');
assert.equal(page('?next=https%3A%2F%2Fevil.example%2F').postLoginDestination(), '/');

let calls = 0;
await page('', async () => {
  calls++;
  return { ok: calls > 1, json: async () => ({ rawEmail: 'user@example.com' }) };
}).confirmAuthSession('user@example.com');
assert.equal(calls, 2, 'a transient follow-up request should be retried');
await assert.rejects(page('', async () => ({ ok: false })).confirmAuthSession(), /could not be confirmed/);
await assert.rejects(page().confirmAuthSession('someone-else@example.com'), /could not be confirmed/);

assert.match(server, /function saveAuthSessions\(sessions\)\s*\{[^}]*writeDocument\(AUTH_SESSIONS_FILE, sessions\)/);
assert.match(server, /'Cache-Control': 'private, no-store'/);
assert.match(html, /fetch\('\/api\/verify-signup',\s*\{\s*method: 'POST',\s*credentials: 'include'/);
assert.doesNotMatch(html, /document\.cookie = "studentId="/);

console.log('Auth handoff: local redirect, cross-domain bridge, session confirmation, and durable response checks passed.');
