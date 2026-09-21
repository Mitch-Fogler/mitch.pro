import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  VM_MAX_UPGRADE_DISK_GB,
  VM_DEFAULT_DISK_GB,
  VM_DAILY_MAX_SECONDS,
  VM_UPGRADE_CATALOG,
} from '../lib/vm_security.js';

console.log('--- 1. Testing VM Storage & Upgrade Tiers ---');
assert.equal(VM_DEFAULT_DISK_GB, 64, 'Default disk must be 64 GB');
assert.equal(VM_MAX_UPGRADE_DISK_GB, 128, 'Max disk must be 128 GB');

const diskValues = VM_UPGRADE_CATALOG.disk.map(t => t.value);
assert.deepEqual(diskValues, [64, 80, 96, 112, 128], 'Disk tiers must be 64, 80, 96, 112, 128 GB');
const diskCosts = VM_UPGRADE_CATALOG.disk.map(t => t.cost);
assert.deepEqual(diskCosts, [0, 150, 300, 600, 1200], 'Disk costs must match pricing scale with 128GB at 1200 coins');

// Differential pricing
function calcDiff(cat, fromVal, toVal) {
  const f = VM_UPGRADE_CATALOG[cat].find(t => t.value === fromVal);
  const t = VM_UPGRADE_CATALOG[cat].find(t => t.value === toVal);
  return Math.max(0, t.cost - f.cost);
}
assert.equal(calcDiff('disk', 64, 96), 300, '64GB -> 96GB must cost 300 coins');
assert.equal(calcDiff('disk', 64, 128), 1200, '64GB -> 128GB must cost 1200 coins');
assert.equal(calcDiff('disk', 96, 128), 900, '96GB -> 128GB must cost 900 coins');
console.log('✓ VM storage capped at 128 GB with adjusted differential pricing verified');

console.log('--- 2. Testing Session Upgrade Durations & Expiration ---');
const sessTiers = VM_UPGRADE_CATALOG.session;
assert(sessTiers.length >= 5, 'Session catalog must have at least 5 tiers');
assert.equal(sessTiers[0].value, 21600, 'Default session tier must be 6 hours (21600s)');
assert.equal(sessTiers[1].durationDays, 30, '8h session upgrade must specify 30 days duration');
assert.equal(sessTiers[sessTiers.length - 1].value, 86400, 'Top session tier must be 24 hours (86400s)');
console.log('✓ VM session upgrade tiers have pass durations');

console.log('--- 3. Testing Shop Catalog Casino Exploits ---');
const serverSource = readFileSync('server.js', 'utf8');

assert(serverSource.includes("id: 'loaded_dice'"), 'Shop catalog must include loaded_dice');
assert(serverSource.includes("id: 'casino_glitch_chip'"), 'Shop catalog must include casino_glitch_chip');
assert(serverSource.includes("id: 'infinite_luck_charm'"), 'Shop catalog must include infinite_luck_charm');

assert(serverSource.includes('hasLoadedDice()'), 'Server must implement hasLoadedDice()');
assert(serverSource.includes('hasCasinoGlitch()'), 'Server must implement hasCasinoGlitch()');
assert(serverSource.includes('GLITCH EXPLOIT'), 'Server must multiply payout on glitch exploit in settleCasinoRound');
assert(serverSource.includes('loaded_dice_until'), 'Server must track loaded_dice_until');
assert(serverSource.includes('casino_glitch_until'), 'Server must track casino_glitch_until');
assert(serverSource.includes('infinite_luck_until'), 'Server must track infinite_luck_until');
console.log('✓ Casino exploit items & settlement logic verified in server.js');

console.log('--- 4. Testing Matrix Default Channels ---');
const matrixConfig = JSON.parse(readFileSync('webserver/matrix/config.json', 'utf8'));
const featuredRooms = matrixConfig.featuredCommunities.rooms;
assert(featuredRooms.includes('#general:mitch.pro'), 'Matrix config must have general');
assert(featuredRooms.includes('#tech:mitch.pro'), 'Matrix config must have tech');
assert(featuredRooms.includes('#biking:mitch.pro'), 'Matrix config must have biking');
assert(featuredRooms.includes('#gaming:mitch.pro'), 'Matrix config must have gaming');
assert(featuredRooms.includes('#computers:mitch.pro'), 'Matrix config must have computers');
assert(featuredRooms.includes('#random:mitch.pro'), 'Matrix config must have random');
console.log('✓ All 6 Matrix rooms featured in webserver/matrix/config.json');

console.log('--- 5. Testing Tester Role Functions ---');
assert(serverSource.includes('function isTesterEmail('), 'server.js must define isTesterEmail');
assert(serverSource.includes('function isTesterId('), 'server.js must define isTesterId');
assert(serverSource.includes('function testerEmails('), 'server.js must define testerEmails');
assert(serverSource.includes("path === '/api/tester-members'"), 'server.js must define /api/tester-members endpoint');
assert(serverSource.includes("path === '/api/admin/testers'"), 'server.js must define /api/admin/testers endpoint');
console.log('✓ Tester role exports & endpoints verified');

console.log('--- 6. Testing Contact Page & Endpoint ---');
const contactHtml = readFileSync('webserver/contact/index.html', 'utf8');
assert(contactHtml.includes('Contact the Team') || contactHtml.includes('Contact Us'), 'Contact HTML must have title');
assert(contactHtml.includes('Send a Message'), 'Contact HTML must have message submission form');
assert(serverSource.includes("path === '/api/contact'"), 'server.js must handle POST /api/contact');
console.log('✓ Contact page & API endpoint verified');

console.log('--- 7. Testing rjuhsd.school mitch.pro Portal Button ---');
const rjuhsdHtml = readFileSync('webserver/rjuhsd/index.html', 'utf8');
assert(rjuhsdHtml.includes('mitch.pro'), 'rjuhsd.school must link to mitch.pro');
assert(rjuhsdHtml.includes('header-portal-btn'), 'rjuhsd.school must have header portal button');
console.log('✓ rjuhsd.school portal button to mitch.pro verified');

console.log('--- 8. Testing Join the Team (Apply) Page Enhancements ---');
const applyHtml = readFileSync('webserver/apply/index.html', 'utf8');
assert(applyHtml.includes('Beta Tester'), 'Apply page must include Beta Tester role');
assert(applyHtml.includes('Moderator'), 'Apply page must include Moderator role');
assert(applyHtml.includes('Developer'), 'Apply page must include Developer role');
assert(applyHtml.includes('/contact/'), 'Apply page must link to contact page');
console.log('✓ Apply page roles and links verified');

console.log('=== ALL NEW FEATURE TESTS PASSED ===');
