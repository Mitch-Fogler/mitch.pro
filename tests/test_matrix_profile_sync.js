import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server.js', 'utf8');
const matrixIndex = readFileSync('webserver/matrix/index.html', 'utf8');

// 1. Verify syncProfileToMatrix definition and capabilities
assert(server.includes('async function syncProfileToMatrix('), 'syncProfileToMatrix helper must be defined');
assert(server.includes('syncProfileToMatrix(uid, {'), 'syncProfileToMatrix must accept profile fields');
assert(server.includes('/_matrix/client/v3/profile/${encodedUserId}/displayname'), 'Matrix profile sync must push displayname');
assert(server.includes('/_matrix/client/v3/profile/${encodedUserId}/avatar_url'), 'Matrix profile sync must push avatar_url');
assert(server.includes('/_matrix/media/v3/upload'), 'Matrix profile sync must upload avatar media');
assert(server.includes('/_matrix/client/v3/presence/${encodedUserId}/status'), 'Matrix profile sync must push status_msg presence for bio');

// 2. Verify POST /api/profile triggers Matrix sync
const profilePostRoute = server.match(/if \(path === '\/api\/profile' && method === 'POST'\) \{[^]*?profile: \{[^]*?\}/)?.[0] || '';
assert(profilePostRoute.includes('syncProfileToMatrix(uid, {'), 'POST /api/profile must invoke syncProfileToMatrix');
assert(profilePostRoute.includes('displayName: savedProfile.displayName'), 'POST /api/profile must sync displayName');
assert(profilePostRoute.includes('pfp: savedProfile.pfp'), 'POST /api/profile must sync pfp');
assert(profilePostRoute.includes('bio: savedProfile.bio'), 'POST /api/profile must sync bio');

// 3. Verify Matrix SSO login syncs profile fields
const ssoLoginRoute = server.match(/if \(path === '\/api\/matrix\/sso-login' && method === 'POST'\) \{[^]*?officialRooms: OFFICIAL_MATRIX_ROOMS/)?.[0] || '';
assert(ssoLoginRoute.includes('syncProfileToMatrix(uid, {'), 'Matrix SSO login must invoke syncProfileToMatrix');
assert(ssoLoginRoute.includes('displayName'), 'SSO login must sync displayName');
assert(ssoLoginRoute.includes('prof.pfp'), 'SSO login must sync pfp');
assert(ssoLoginRoute.includes('prof.bio'), 'SSO login must sync bio');

// 4. Verify GET /api/matrix/sso-status returns pfp and bio
const ssoStatusRoute = server.match(/if \(path === '\/api\/matrix\/sso-status' && method === 'GET'\) \{[^]*?user_id: `@\$\{assignedUsername\}:mitch\.pro`[^]*?\}/)?.[0] || '';
assert(ssoStatusRoute.includes('pfp: prof.pfp || \'\''), 'sso-status must return pfp');
assert(ssoStatusRoute.includes('bio: prof.bio || \'\''), 'sso-status must return bio');

// 5. Verify Matrix client shell renders pfp and bio
assert(matrixIndex.includes('status.pfp'), 'matrix/index.html must check status.pfp');
assert(matrixIndex.includes('status.bio'), 'matrix/index.html must check status.bio');
assert(matrixIndex.includes('avatar.style.backgroundImage'), 'matrix/index.html must set avatar background-image');

// 6. Verify Matrix -> mitch.pro reverse proxy sync
assert(server.includes('profileDisplayMatch'), 'Matrix proxy must detect displayname updates');
assert(server.includes('profileAvatarMatch'), 'Matrix proxy must detect avatar_url updates');
assert(server.includes('presenceStatusMatch'), 'Matrix proxy must detect presence status_msg updates');
assert(server.includes('bioPutMatch'), 'Matrix proxy must handle direct bio updates');
assert(server.includes('profileGetMatch'), 'Matrix proxy must augment profile GET responses with bio');

console.log('Matrix <-> mitch.pro profile synchronization checks passed.');
