import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { authenticate } from '../dist/auth.js';
import { config } from '../dist/config.js';
import { pool } from '../dist/db.js';

test('sessions expire after one hour, including previously issued seven-day tokens', async t => {
  const now = 1_780_000_000;
  t.mock.timers.enable({ apis: ['Date'], now: now * 1000 });
  const user = { id: randomUUID(), name: 'Session Test', email: 'session@example.com' };
  const lookup = t.mock.method(pool, 'query', async () => ({ rows: [user] }));

  async function check(token) {
    let continued = 0;
    const cleared = [];
    const response = {
      locals: {},
      clearCookie: (...args) => cleared.push(args),
    };
    await authenticate({ cookies: { qlean_session: token } }, response, error => {
      assert.equal(error, undefined);
      continued++;
    });
    assert.equal(continued, 1);
    return { user: response.locals.user, cleared };
  }

  const issue = (age, expiresIn = '7d') => jwt.sign({ iat: now - age }, config.jwtSecret, {
    subject: user.id, algorithm: 'HS256', expiresIn,
  });

  const valid = await check(issue(3599));
  assert.deepEqual(valid.user, user);
  assert.deepEqual(valid.cleared, []);
  assert.equal(lookup.mock.callCount(), 1);

  for (const token of [issue(3600), issue(3601), issue(7 * 24 * 3600), issue(3600, '1h'),
    jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: '7d', noTimestamp: true }), 'invalid']) {
    const expired = await check(token);
    assert.equal(expired.user, null);
    assert.equal(expired.cleared.length, 1);
    assert.equal(expired.cleared[0][0], 'qlean_session');
    assert.deepEqual(expired.cleared[0][1], {
      httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/',
    });
  }
  assert.equal(lookup.mock.callCount(), 1, 'Expired sessions must not query user data.');
  assert.equal((await check(undefined)).user, null);
  assert.deepEqual((await check(undefined)).cleared, []);
});
