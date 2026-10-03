import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';

test('login accepts unique names and emails without ambiguous account selection', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [];
  t.after(async () => {
    try { if (users.length) await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]); }
    finally { await pool.end(); }
  });
  async function request(path, body, cookie) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { response, json: await response.json() };
  }
  const token = randomUUID();
  const name = `Login-${token}`;
  const email = `identifier-${token}@example.com`;
  const password = 'Identifier-test-password-123';
  async function register(name, email) {
    const result = await request('/api/auth/register', { name, email, password });
    assert.equal(result.response.status, 201);
    users.push(result.json.data.id);
    return result.json.data;
  }
  async function login(payload, expectedId) {
    const result = await request('/api/auth/login', payload);
    assert.equal(result.response.status, 200);
    assert.equal(result.json.data.id, expectedId);
    assert.equal(result.json.data.password_hash, undefined);
    const cookie = result.response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const session = await request('/api/auth/me', undefined, cookie.split(';')[0]);
    assert.equal(session.json.data.id, expectedId);
    return result;
  }
  const owner = await register(name, email);
  await login({ identifier: `  ${name.toUpperCase()}  `, password }, owner.id);
  await login({ identifier: `  ${email.toUpperCase()}  `, password }, owner.id);
  await login({ email: email.toUpperCase(), password }, owner.id);

  const wrong = await request('/api/auth/login', { identifier: name, password: 'incorrect-password' });
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.response.headers.get('set-cookie'), null);
  for (const identifier of [`unknown-${token}`, "' OR 1=1 --"]) {
    const rejected = await request('/api/auth/login', { identifier, password });
    assert.equal(rejected.response.status, 401);
    assert.equal(rejected.json.message, wrong.json.message);
    assert.equal(rejected.response.headers.get('set-cookie'), null);
  }
  for (const payload of [
    { identifier: '  ', password },
    { identifier: 'a'.repeat(255), password },
    { identifier: name, email, password },
    { password },
  ]) assert.equal((await request('/api/auth/login', payload)).response.status, 400);

  const duplicate = await request('/api/auth/register', { name: name.toLowerCase(), email: `duplicate-${token}@example.com`, password });
  assert.equal(duplicate.response.status, 409);
  assert.match(duplicate.json.message, /username.*taken/i);
  assert.equal(duplicate.response.headers.get('set-cookie'), null);
  await login({ identifier: name, password }, owner.id);

  await register(email, `email-name-${token}@example.com`);
  await login({ identifier: email, password }, owner.id);
});
