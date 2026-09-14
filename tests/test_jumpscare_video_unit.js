import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const videoPath = join(root, 'webserver', 'media', 'admin-jumpscare-krupp-1935.mp4');
const broadcast = readFileSync(join(root, 'webserver', 'broadcast.js'), 'utf8');
const admin = readFileSync(join(root, 'webserver', 'admin', 'index.html'), 'utf8');
const server = readFileSync(join(root, 'server.js'), 'utf8');
const home = readFileSync(join(root, 'webserver', 'index.html'), 'utf8');

assert.ok(existsSync(videoPath), 'The local jumpscare video must be deployed');
assert.ok(statSync(videoPath).size > 1_000_000, 'The jumpscare MP4 must not be an empty placeholder');
assert.match(broadcast, /video\.src = '\/media\/admin-jumpscare-krupp-1935\.mp4'/);
assert.match(broadcast, /overlay\.append\(video, close, caption, sound\)/);
assert.match(broadcast, /video\.muted = true/, 'Muted fallback is required when autoplay audio is blocked');
assert.match(broadcast, /video\.addEventListener\('ended', remove/, 'Overlay must clean itself up');
assert.doesNotMatch(broadcast, /myinstants\.com/, 'The old third-party screamer must be removed');
assert.match(admin, /value="jumpscare">Video Jumpscare/);
assert.match(admin, /Play video for everyone/);
assert.match(server, /type === 'normal' && !msg/, 'Normal alerts still require a message');
assert.match(server, /return jsonResp\(200, \{ ok: true, recipients \}\)/);
assert.match(home, /broadcast\.js\?v=6/);
assert.match(server, /broadcast\.js\?v=6/);

console.log('Video jumpscare asset, UI, broadcast payload, cleanup, and cache-version checks passed.');
