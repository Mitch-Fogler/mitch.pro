import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const admin = readFileSync('webserver/admin/index.html', 'utf8');
const moderator = readFileSync('webserver/moderator/index.html', 'utf8');
const home = readFileSync('webserver/index.html', 'utf8');
const homeCss = readFileSync('webserver/home-redesign.css', 'utf8');
const staffCss = readFileSync('webserver/staff-command-v2.css', 'utf8');

assert(admin.includes('/staff-command-v2.css?v=1'), 'Admin must load the redesigned staff system');
assert(moderator.includes('/staff-command-v2.css?v=1'), 'Moderator must load the redesigned staff system');
assert(moderator.includes('class="moderator-hero"'), 'Moderator must have its dedicated workspace hero');
assert(home.match(/class="staff-access-copy"/g)?.length === 3, 'All homepage staff buttons need labels and descriptions');
assert(homeCss.includes('body.home:is(.is-staff,.is-admin) .staff-access-rail'), 'Staff rail must only appear for staff');
assert(homeCss.includes('.staff-access-rail:focus-within'), 'Staff rail must expand for keyboard users');
assert(staffCss.includes('#command-center #owner-tools'), 'Owner tools need their own visual treatment');
assert(staffCss.includes('@media (max-width: 700px)'), 'Staff panels need a dedicated mobile layout');
assert(staffCss.includes('@media (prefers-reduced-motion: reduce)'), 'Staff motion must honor reduced-motion preferences');

let depth = 0;
for (const char of staffCss.replace(/\/\*[\s\S]*?\*\//g, '')) {
  if (char === '{') depth++;
  if (char === '}') depth--;
  assert(depth >= 0, 'Staff stylesheet closes a block too early');
}
assert.equal(depth, 0, 'Staff stylesheet must have balanced blocks');

console.log('Owner, admin, moderator, homepage staff controls, and responsive design checks passed.');
