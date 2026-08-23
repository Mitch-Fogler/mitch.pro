import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:6800';
const REPO_ROOT = import.meta.dir + '/..';
const DATA_DIR = join(REPO_ROOT, 'data');

// Helper to wait
const sleep = ms => new Promise(r => r(setTimeout(r, ms)));

async function fetchWithBypass(url, options = {}) {
  options.headers = options.headers || {};
  options.headers['CF-Connecting-IP'] = '66.60.183.124';
  return fetch(url, options);
}

async function runTest() {
  console.log('--- STARTING STREAK FREEZE API INTEGRATION TESTS ---');
  
  console.log('Generating temporary test credentials and invite codes...');
  execSync(`bun ${join(REPO_ROOT, 'tests', 'setup_session.js')}`);
  
  const email = `freezetest_${Date.now()}@student.rjuhsd.us`;
  const password = 'testpassword123';
  
  console.log(`Signing up test user: ${email} with referral code for coins...`);
  const signupResp = await fetchWithBypass(`${BASE_URL}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, refCode: 'TESTINVITE123', recaptcha_token: 'dummy' })
  });
  
  if (!signupResp.ok) {
    throw new Error(`Signup failed: ${await signupResp.text()}`);
  }
  
  // Get verification code from signup_codes.json
  const signupCodes = JSON.parse(readFileSync(join(DATA_DIR, 'signup_codes.json'), 'utf8'));
  const normEmail = email.toLowerCase();
  const codeEntry = signupCodes[normEmail];
  if (!codeEntry) {
    throw new Error(`Verification code not found for ${email}`);
  }
  const code = codeEntry.code;
  
  console.log(`Verifying user with code ${code}...`);
  const verifyResp = await fetchWithBypass(`${BASE_URL}/api/verify-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  
  if (!verifyResp.ok) {
    throw new Error(`Verification failed: ${await verifyResp.text()}`);
  }
  
  const verifyData = await verifyResp.json();
  const sid = verifyData.id;
  const cookieHeader = `studentId=${sid}; id=${sid}`;
  
  console.log(`Authenticated. Session ID: ${sid}`);
  
  console.log('Waiting 3 seconds for server name/session cache to reload names.json...');
  await sleep(3000);
  
  // 1. Verify user starts with 2000 referral coins
  console.log('Checking user profile for coins...');
  let coinsResp = await fetchWithBypass(`${BASE_URL}/api/me/coins`, {
    headers: { 'Cookie': cookieHeader }
  });
  let coinsData = await coinsResp.json();
  console.log(`User coins balance: ${coinsData.coins}`);
  if (coinsData.coins < 2000) throw new Error('Referral coins bonus not credited');

  // 2. Buy a streak freeze from the shop
  console.log('Buying Streak Freeze from shop...');
  let buyResp = await fetchWithBypass(`${BASE_URL}/api/shop/buy`, {
    method: 'POST',
    headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: 'streak_freeze' })
  });
  if (!buyResp.ok) throw new Error(`Shop purchase failed: ${await buyResp.text()}`);
  let buyResult = await buyResp.json();
  console.log('Shop buy result:', buyResult);
  
  // 3. Fetch login state and verify streakFreezes = 1
  console.log('Fetching daily login state...');
  let stateResp = await fetchWithBypass(`${BASE_URL}/api/daily-login/state`, {
    headers: { 'Cookie': cookieHeader }
  });
  let state = await stateResp.json();
  console.log('State:', state);
  if (state.streakFreezes !== 1) throw new Error(`Expected 1 streak freeze, got ${state.streakFreezes}`);
  
  // 4. Claim Day 1 reward
  console.log('Claiming Day 1 reward...');
  let claimResp = await fetchWithBypass(`${BASE_URL}/api/daily-login/claim`, {
    method: 'POST',
    headers: { 'Cookie': cookieHeader }
  });
  let claimResult = await claimResp.json();
  console.log('Claim result:', claimResult);
  if (claimResult.streak !== 1) throw new Error('Streak should be 1');
  if (claimResult.streakFreezes !== 1) throw new Error(`Expected 1 streak freeze to remain after normal claim, got ${claimResult.streakFreezes}`);
  
  console.log('--- ALL STREAK FREEZE API TESTS PASSED SUCCESSFULLY! ---');
}

runTest().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
