const { readFileSync } = require('fs');
const vm = require('vm');
const source = readFileSync('server.js', 'utf8');
const normalizeStart = source.indexOf('function normalizeEmail(');
const normalizeEnd = source.indexOf('function loadPushSubscriptions', normalizeStart);
const rolesStart = source.indexOf('function loadAdminConfig()');
const rolesEnd = source.indexOf('function blogContributorEmails()', rolesStart);
const context = {
  loadJson: () => ({ owners: ['admin@mitch.pro'], admins: ['regular.admin@student.rjuhsd.us'] }),
  ADMINS_FILE: 'admins.json',
  devTestAccessEnabled: () => false,
  DEV_TEST_EMAIL: 'admin@mitch.pro',
};
vm.createContext(context);
vm.runInContext(source.slice(normalizeStart, normalizeEnd) + source.slice(rolesStart, rolesEnd), context);
const tyler = 'tyler.thompson1@student.rjuhsd.us';
if (!context.isCoOwnerEmail(tyler)) throw new Error('Tyler must be a co-owner');
if (!context.isOwnerEmail(tyler)) throw new Error('Co-owner must receive owner access');
if (!context.isAdminEmail(tyler)) throw new Error('Co-owner must receive full admin access');
if (!context.siteAdminEmails().includes(context.normalizeEmail(tyler))) throw new Error('Co-owner must be in the privileged identity set');
if (context.isOwnerEmail('regular.admin@student.rjuhsd.us')) throw new Error('Admin must not be promoted to owner');
console.log('Role tests passed.');
