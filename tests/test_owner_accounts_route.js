import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac, createCipheriv, randomBytes } from 'node:crypto';
import { planOwnerAction } from '../lib/owner_account_tools.js';

const source = readFileSync(new URL('../server.js', import.meta.url),'utf8');
const start = source.indexOf('  // Enforce admin passphrase for all administrative API actions');
const end = source.indexOf('  // ── Open general proxy removed',start);
const documents = {};
const files = ['PASSWORDS','PASSKEYS','SIGNUP_CODES','TOKENS','NAMES','AUTH_SESSIONS','GENERATIONS','COINS'];
files.forEach(file => documents[file] = {});
Object.assign(documents, {
  PASSWORDS: { 'a@test':'hash-a','b@test':'hash-b','owner@test':'hash-owner' },
  PASSKEYS: { 'a@test':['key-a'],'b@test':['key-b'] },
  SIGNUP_CODES: { 'a@test':{code:'123456'} },
  TOKENS: { a:{email:'a@test'},b:{email:'b@test'} },
  NAMES: { a:'a@test',b:'b@test' },
  AUTH_SESSIONS: { a:{normEmail:'a@test'},b:{normEmail:'b@test'} },
  GENERATIONS: { 'a@test':{gen:2} },
  COINS: { 'a@test':30,'b@test':50 }
});
let identity = 'owner@test';
const context = {
  Response, Headers, URL, Buffer, Date, Set, Map, structuredClone, createHmac,createCipheriv,randomBytes,planOwnerAction,
  getCookies: () => ({studentId:identity}), validId: sid=>!!sid,
  isAnyAdminId: sid=>['owner@test','admin@test','mod@test'].includes(sid),
  isAdminId: sid=>['owner@test','admin@test'].includes(sid),
  devTestRequestAllowed:()=>false, emailFromSid:sid=>sid, normalizeEmail:e=>e,
  loadAdminPassphrase:()=>({'owner@test':{hash:'test'},'admin@test':{hash:'test'}}),
  verifyAdminPassphrase:async(req,pass)=>pass==='test-passphrase',
  checkPasswordCookie:()=>!!identity, isOwnerEmail:email=>email==='owner@test',
  requestHost:req=>req.headers.get('host'),checkRateLimit:()=>null,
  jsonResp:(status,data)=>Response.json(data,{status}),
  loadPasswords:()=>context.passwordsCache, loadCoins:()=>context.coinsCache,
  loadPasskeys:()=>documents.PASSKEYS, loadTokens:()=>context.tokensCache,
  loadAuthSessions:()=>documents.AUTH_SESSIONS, loadGenerations:()=>documents.GENERATIONS,
  currentSessionGeneration:email=>documents.GENERATIONS[email]?.gen||0,
  loadJson:file=>documents[file], writeDocument:(file,data)=>{documents[file]=data;},
  getDataStore:()=>({transaction:fn=>fn}), join:(...parts)=>parts.join('/'),
  mkdirSync:()=>{}, writeFileSync:()=>{}, DATA_DIR:'test-only', ID_SECRET:'test-secret',
  logAdminAction:()=>{}, console,
  passwordsCache:documents.PASSWORDS, tokensCache:documents.TOKENS,coinsCache:documents.COINS,
  ownerAccountActionTimes:new Map(), pendingTwoFactor:new Map([['a',{normEmail:'a@test'}]])
};
files.forEach(file=>context[file+'_FILE']=file);
vm.createContext(context);
vm.runInContext(`async function route(req) { const path = '/api/admin/owner-accounts', method = req.method; ${source.slice(start,end)} }`,context);
async function call(body,headers={}) {
  return context.route(new Request('https://example.test/api/admin/owner-accounts',{method:'POST',headers:{host:'example.test',origin:'https://example.test','X-Admin-Passphrase':'test-passphrase',...headers},body:JSON.stringify(body)}));
}
for (const [role,expected] of [['',401],['member@test',403],['admin@test',403],['mod@test',403]]) { identity=role; assert.equal((await call({action:'list'})).status,expected,role); }
identity='owner@test';
assert.equal((await call({action:'list'},{'X-Admin-Passphrase':'wrong'})).status,403);
assert.equal((await call({action:'list'},{origin:'https://evil.test'})).status,403);
const list = await (await call({action:'list'})).json();
assert.equal(list.accounts.find(a=>a.email==='owner@test').protected,true);
assert.equal((await call({action:'remove-registrations',emails:['owner@test'],confirmation:'REMOVE 1 REGISTRATIONS'})).status,403);
assert.equal((await call({action:'remove-registrations',emails:['a@test'],confirmation:'REMOVE 1 REGISTRATIONS'})).status,200);
assert.equal(context.passwordsCache['a@test'],undefined);
assert.equal(documents.PASSKEYS['a@test'],undefined);
assert.equal(documents.SIGNUP_CODES['a@test'],undefined);
assert.equal(documents.AUTH_SESSIONS.a,undefined);
assert.equal(context.tokensCache.a,undefined);
assert.equal(documents.NAMES.a,undefined);
assert.equal(documents.GENERATIONS['a@test'].gen,3);
assert.equal(context.pendingTwoFactor.size,0);
assert.equal(context.passwordsCache['b@test'],'hash-b');
assert.equal((await call({action:'reset-coins',confirmation:'RESET ALL COINS'})).status,429);
context.ownerAccountActionTimes.clear();
assert.equal((await call({action:'reset-coins',confirmation:'RESET ALL COINS'})).status,200);
assert.equal(context.coinsCache['a@test'],0);
assert.equal(context.coinsCache['b@test'],0);
console.log('Owner route permissions, confirmations, revocation, exclusions, cooldown, and coin-cache tests passed.');
