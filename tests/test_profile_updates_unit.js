import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server.js', 'utf8');
const preferences = readFileSync('webserver/preferences/index.html', 'utf8');
const shell = readFileSync('webserver/app-shell.js', 'utf8');
const profile = readFileSync('webserver/profile/index.html', 'utf8');

assert(server.includes("'Cache-Control': 'private, no-cache, no-store, must-revalidate'"), 'JSON responses must not be cached');
assert(server.includes('writeDocument(PROFILES_FILE, profiles)'), 'Profile saves must expose persistence errors');
assert(server.includes("type: 'profile_updated'"), 'Successful profile saves must notify connected pages');
assert(server.includes('profile: {'), 'Profile saves must return persisted fields');
assert(preferences.includes("cache: 'no-store'"), 'Profile editor must bypass browser caches');
assert(preferences.includes('applyAccountProfile(d.profile)'), 'Profile editor must apply confirmed server state');
assert(preferences.includes("CustomEvent('mitch-profile-updated'"), 'Profile editor must update the current browser immediately');
assert(shell.includes("event.detail.type === 'profile_updated'"), 'Shared shell must handle server profile updates');
assert(shell.includes("typeof window.loadMembers === 'function'"), 'Member surfaces must refresh after profile changes');
assert(profile.includes('load(true)'), 'Open profile pages must refresh after profile changes');

console.log('Immediate, persisted profile update checks passed.');
