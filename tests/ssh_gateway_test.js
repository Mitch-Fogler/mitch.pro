#!/usr/bin/env bun
// ssh_gateway_test.js — protocol test for the ssh-gateway (works against the
// Rust gateway and the original JS gateway; run both to prove parity).
//
// Usage: bun tests/ssh_gateway_test.js [wsUrl]
//   wsUrl defaults to ws://127.0.0.1:6820 (override via WS_URL env).
//
// Full end-to-end echo test runs when SSH_TEST_* env vars are provided:
//   SSH_TEST_HOST=127.0.0.1 SSH_TEST_PORT=2222 SSH_TEST_USER=root \
//   SSH_TEST_PASS=mitch-e2e-pass bun tests/ssh_gateway_test.js
// (see the disposable sshd container documented in the Step 3 scorecard)

const WS_URL = process.argv[2] || process.env.WS_URL || 'ws://127.0.0.1:6820';

let failures = 0;
function ok(label, cond, detail = '') {
  if (cond) console.log(`  ok  ${label}`);
  else {
    failures++;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Opens a fresh ws, collects frames until done(), returns {frames, send, close}. */
async function openWs() {
  const ws = new WebSocket(WS_URL);
  const frames = [];
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = e => rej(new Error(`ws error: ${e.message}`));
  });
  ws.onmessage = ev => frames.push(JSON.parse(ev.data));
  return {
    ws,
    frames,
    send(obj) {
      ws.send(JSON.stringify(obj));
    },
    close() {
      ws.close();
    },
    closed: () =>
      new Promise(res => {
        if (ws.readyState === 3) res();
        else ws.onclose = () => res();
      }),
  };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function testInvalidJson() {
  console.log('- invalid JSON frame');
  const c = await openWs();
  // Send raw non-JSON text (bypassing the JSON.stringify helper).
  c.ws.send('this is not json');
  await wait(400);
  ok('error frame sent', c.frames.length === 1, JSON.stringify(c.frames));
  ok('message is "Invalid JSON"', c.frames[0]?.type === 'error' && c.frames[0]?.message === 'Invalid JSON');
  await c.close();
}

async function testMissingType() {
  console.log('- missing message type');
  const c = await openWs();
  c.send({ foo: 1 });
  await wait(400);
  ok('error frame sent', c.frames.length === 1, JSON.stringify(c.frames));
  ok('message is "Missing message type"', c.frames[0]?.type === 'error' && c.frames[0]?.message === 'Missing message type');
  await c.close();
}

async function testMissingHostUsername() {
  console.log('- connect without host/username');
  const c = await openWs();
  c.send({ type: 'connect', host: '', username: '' });
  await wait(400);
  ok(
    'message is "host and username are required"',
    c.frames[0]?.type === 'error' && c.frames[0]?.message === 'host and username are required',
    JSON.stringify(c.frames),
  );
  await c.close();
}

async function testAlreadyConnected() {
  const { SSH_TEST_HOST, SSH_TEST_PORT, SSH_TEST_USER, SSH_TEST_PASS } = process.env;
  if (!SSH_TEST_HOST || !SSH_TEST_USER) {
    console.log('- double connect SKIPPED (needs SSH_TEST_* to hold a live session)');
    return;
  }
  console.log('- double connect rejected while session is live');
  // JS parity: a FAILED connect clears the session (retry allowed); a LIVE
  // session rejects a second connect with "Already connected".
  const c = await openWs();
  c.send({
    type: 'connect',
    host: SSH_TEST_HOST,
    port: Number(SSH_TEST_PORT) || 22,
    username: SSH_TEST_USER,
    password: SSH_TEST_PASS,
  });
  const t = Date.now();
  while (!c.frames.some(f => f.type === 'connected') && Date.now() - t < 10_000) await wait(100);
  ok('first connect succeeded', c.frames.some(f => f.type === 'connected'), JSON.stringify(c.frames));
  c.send({ type: 'connect', host: SSH_TEST_HOST, port: 22, username: SSH_TEST_USER, password: SSH_TEST_PASS });
  await wait(400);
  ok(
    'second connect says "Already connected"',
    c.frames[c.frames.length - 1]?.message === 'Already connected',
    JSON.stringify(c.frames),
  );
  await c.close();
}

async function testUnreachableHost() {
  console.log('- unreachable host errors and closes');
  const c = await openWs();
  c.send({ type: 'connect', host: '127.0.0.1', port: 1, username: 'x', password: 'x' });
  await wait(2000);
  ok('error frame received', c.frames.some(f => f.type === 'error'), JSON.stringify(c.frames));
  await c.close();
}

async function testFullEcho() {
  const { SSH_TEST_HOST, SSH_TEST_PORT, SSH_TEST_USER, SSH_TEST_PASS } = process.env;
  if (!SSH_TEST_HOST || !SSH_TEST_USER) {
    console.log('- full echo test SKIPPED (set SSH_TEST_HOST/PORT/USER/PASS to enable)');
    return;
  }
  console.log('- full shell echo via real sshd');
  const c = await openWs();
  c.send({
    type: 'connect',
    host: SSH_TEST_HOST,
    port: Number(SSH_TEST_PORT) || 22,
    username: SSH_TEST_USER,
    password: SSH_TEST_PASS,
    cols: 100,
    rows: 30,
  });
  const connectedAt = Date.now();
  while (!c.frames.some(f => f.type === 'connected') && !c.frames.some(f => f.type === 'error') && Date.now() - connectedAt < 10_000) {
    await wait(100);
  }
  ok('connected frame', c.frames.some(f => f.type === 'connected'), JSON.stringify(c.frames));

  const MARK = `MITCH_RS_OK_${Date.now()}`;
  c.send({ type: 'data', data: `echo ${MARK}\r\n` });
  const deadline = Date.now() + 10_000;
  let sawOutput = false;
  let sawResizeOk = true;
  while (Date.now() < deadline) {
    await wait(100);
    if (c.frames.some(f => f.type === 'data' && f.data?.includes(MARK))) {
      sawOutput = true;
      break;
    }
  }
  ok('shell echoed our command', sawOutput, JSON.stringify(c.frames.slice(-3)));

  c.send({ type: 'resize', rows: 40, cols: 120 });
  await wait(500);
  ok('resize did not kill the session', c.frames.every(f => f.type !== 'error'));

  // Exit the shell → stream close → ws close (JS parity).
  c.send({ type: 'data', data: 'exit\r\n' });
  const closed = await Promise.race([c.closed().then(() => true), wait(8000).then(() => false)]);
  ok('ws closes after shell exit', closed);
  if (!closed) await c.close();
}

console.log(`ssh_gateway_test against ${WS_URL}`);
await testInvalidJson();
await testMissingType();
await testMissingHostUsername();
await testAlreadyConnected();
await testUnreachableHost();
await testFullEcho();
console.log(failures === 0 ? '\nALL SSH GATEWAY TESTS PASSED' : `\n${failures} SSH GATEWAY TEST FAILURES`);
process.exit(failures === 0 ? 0 : 1);