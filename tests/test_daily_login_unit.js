// Unit test for daily login reward math and streak freezes

function getDailyReward(streak) {
  if (streak === 60) {
    return { coins: 5000, grantPremium: true };
  }
  if (streak > 60) {
    return { coins: 1000 + (streak - 60) * 100, grantPremium: false };
  }
  if (streak >= 31) {
    return { coins: 400 + (streak - 1) * 50, grantPremium: false };
  }
  if (streak >= 15) {
    return { coins: 200 + (streak - 1) * 30, grantPremium: false };
  }
  if (streak >= 8) {
    return { coins: 100 + (streak - 1) * 20, grantPremium: false };
  }
  return { coins: 50 + (streak - 1) * 15, grantPremium: false };
}

function getDailyLoginState(data, todayStr, yesterdayStr) {
  let canClaim = false;
  let streak = data.streak;
  let streakFrozen = false;
  const freezes = data.streakFreezes || 0;

  if (data.lastClaimDate !== todayStr) {
    canClaim = true;
    if (data.lastClaimDate !== yesterdayStr && data.lastClaimDate !== '') {
      if (freezes > 0) {
        streakFrozen = true;
      } else {
        streak = 0;
      }
    }
  }

  const nextStreak = canClaim ? streak + 1 : streak;
  return { canClaim, streak: data.streak, nextStreak, streakFreezes: freezes, streakFrozen };
}

function claimDailyLogin(data, todayStr, yesterdayStr) {
  if (data.lastClaimDate === todayStr) {
    throw new Error('Already claimed today');
  }

  let freezeConsumed = false;
  if (data.lastClaimDate === yesterdayStr) {
    data.streak++;
  } else if (data.lastClaimDate === '') {
    data.streak = 1;
  } else {
    if ((data.streakFreezes || 0) > 0) {
      data.streakFreezes--;
      data.streak++;
      freezeConsumed = true;
    } else {
      data.streak = 1;
    }
  }
  data.lastClaimDate = todayStr;
  return { streak: data.streak, streakFreezes: data.streakFreezes || 0, freezeConsumed };
}

function runUnitTests() {
  console.log('--- STARTING DAILY LOGIN REWARD MATH UNIT TESTS ---');

  // Day 1
  const r1 = getDailyReward(1);
  if (r1.coins !== 50 || r1.grantPremium) throw new Error('Day 1 reward mismatch');

  // Day 60 (Should grant Premium Status and 5000 coins)
  const r60 = getDailyReward(60);
  if (r60.coins !== 5000 || !r60.grantPremium) throw new Error('Day 60 must grant premium and 5000 coins');

  console.log('--- STARTING STREAK FREEZE UNIT TESTS ---');

  const todayStr = '2026-06-25';
  const yesterdayStr = '2026-06-24';
  const twoDaysAgoStr = '2026-06-23';

  // Test Case A: User has streak freeze, missed yesterday
  const userA = { lastClaimDate: twoDaysAgoStr, streak: 5, streakFreezes: 1 };
  const stateA = getDailyLoginState(userA, todayStr, yesterdayStr);
  console.log('Test Case A State:', stateA);
  if (!stateA.streakFrozen) throw new Error('Expected streak to be frozen');
  if (stateA.nextStreak !== 6) throw new Error(`Expected next streak to be 6, got ${stateA.nextStreak}`);

  const claimA = claimDailyLogin(userA, todayStr, yesterdayStr);
  console.log('Test Case A Claim:', claimA);
  if (!claimA.freezeConsumed) throw new Error('Expected freeze to be consumed');
  if (claimA.streak !== 6) throw new Error(`Expected streak to be 6, got ${claimA.streak}`);
  if (claimA.streakFreezes !== 0) throw new Error(`Expected 0 freezes left, got ${claimA.streakFreezes}`);

  // Test Case B: User has NO streak freeze, missed yesterday
  const userB = { lastClaimDate: twoDaysAgoStr, streak: 5, streakFreezes: 0 };
  const stateB = getDailyLoginState(userB, todayStr, yesterdayStr);
  console.log('Test Case B State:', stateB);
  if (stateB.streakFrozen) throw new Error('Streak should not be frozen');
  if (stateB.nextStreak !== 1) throw new Error(`Expected streak to reset to 1, got ${stateB.nextStreak}`);

  const claimB = claimDailyLogin(userB, todayStr, yesterdayStr);
  console.log('Test Case B Claim:', claimB);
  if (claimB.freezeConsumed) throw new Error('No freeze should have been consumed');
  if (claimB.streak !== 1) throw new Error(`Expected streak to reset to 1, got ${claimB.streak}`);

  console.log('--- ALL REWARD MATH & STREAK FREEZE UNIT TESTS PASSED SUCCESSFULLY! ---');
}

runUnitTests();
