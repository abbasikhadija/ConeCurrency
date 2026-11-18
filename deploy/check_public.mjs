// Safe read-only check by default; explicit opt-in is needed to replace demo rounds.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const [target, flag] = process.argv.slice(2);
if (!target || (flag && flag !== '--verify-workflows')) {
  throw new Error('Usage: node deploy/check_public.mjs https://HOST [--verify-workflows]');
}
const base = new URL(target).origin;
assert.equal(new URL(base).protocol, 'https:', 'Use the public HTTPS URL');
async function request(route, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + route, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Origin: base, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}
function sessionCookie(response) {
  const value = response.headers.get('set-cookie');
  assert.ok(value && /;\s*Secure/i.test(value), 'HTTPS session must use a Secure cookie');
  assert.match(value, /;\s*HttpOnly/i);
  assert.match(value, /;\s*SameSite=Strict/i);
  return value.split(';')[0];
}
const home = await request('/');
assert.equal(home.response.status, 200);
assert.match(home.data, /<html/i);
const status = await request('/api/session');
assert.equal(status.response.status, 200);
assert.equal(status.data.configured, true, 'Admin sign-in must be configured');
assert.equal((await request('/api/round')).response.status, 401);
assert.equal((await request('/api/round', { method: 'POST', body: {} })).response.status, 401);
console.log('PASS: public HTTPS page, configured admin login and unauthenticated admin rejection');
if (!flag) process.exit(0);
assert.ok(process.env.ADMIN_PASSWORD, 'Set ADMIN_PASSWORD privately before verifying workflows');
const login = await request('/api/login', { method: 'POST', body: { password: process.env.ADMIN_PASSWORD } });
assert.equal(login.response.status, 200);
const admin = sessionCookie(login.response);
let webSocket;
const students = [];
try {
  const WebSocket = require('ws');
  await new Promise((resolve, reject) => {
    webSocket = new WebSocket(base.replace('https:', 'wss:') + '/ws', { headers: { Cookie: admin, Origin: base } });
    const timer = setTimeout(() => reject(new Error('Admin WebSocket timed out')), 10000);
    webSocket.once('error', error => { clearTimeout(timer); reject(error); });
    webSocket.once('message', payload => {
      clearTimeout(timer);
      try { assert.equal(JSON.parse(payload.toString()).type, 'INIT_STATE'); resolve(); } catch (error) { reject(error); }
    });
  });
  console.log('PASS: secure admin cookie and live WSS connection through the proxy');
  for (let i = 0; i < 3; i++) {
    const joined = await request('/api/join', { method: 'POST', body: { name: `Deployment check ${i + 1}` } });
    assert.equal(joined.response.status, 200);
    students.push(sessionCookie(joined.response));
  }
  const denied = await request('/api/round', { method: 'POST', cookie: students[0], body: { mode: 'concurrent', tickets: 99, workers: 4, queue: 32, delayMs: 20 } });
  assert.equal(denied.response.status, 401, 'Students must not change the mode');
  for (const mode of ['sequential', 'concurrent']) {
    const round = await request('/api/round', { method: 'POST', cookie: admin, body: { mode, tickets: 2, workers: 4, queue: 32, delayMs: 100 } });
    assert.equal(round.response.status, 200, `Could not start real C ${mode} round`);
    await Promise.all(students.map(async cookie => {
      const order = await request('/api/order', { method: 'POST', cookie, body: {} });
      assert.equal(order.response.status, 202);
    }));
    const results = await Promise.all(students.map(async cookie => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const student = await request('/api/student', { cookie });
        assert.equal(student.response.status, 200);
        assert.equal(student.data.mode, mode);
        if (student.data.order?.state === 'complete') {
          assert.ok(student.data.history.length > 0);
          return student.data.order.result.rawResponse;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`${mode}: student order never completed`);
    }));
    assert.deepEqual(results.sort(), ['ERR SOLD_OUT', 'OK BOOKED', 'OK BOOKED']);
    const shop = await request('/api/shop', { cookie: students[0] });
    assert.equal(shop.response.status, 200);
    console.log(`PASS: ${mode}, three students / two cones, exactly two booked and one sold out, history available`);
  }
  const reset = await request('/api/reset', { method: 'POST', cookie: admin, body: {} });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.data.success, true);
  const book = await request('/api/book', { method: 'POST', cookie: admin, body: {} });
  assert.equal(book.data.rawResponse, 'OK BOOKED', 'Reset must replenish real stock');
  console.log('PASS: managed reset replenishes real C inventory');
} finally {
  webSocket?.terminate();
  await Promise.all(students.map(cookie => request('/api/leave', { method: 'POST', cookie, body: {} })));
  await request('/api/logout', { method: 'POST', cookie: admin, body: {} });
}
console.log('PASS: public deployment workflows verified. Admin should open a fresh classroom round.');
