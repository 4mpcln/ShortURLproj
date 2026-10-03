import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';

test('account names and emails are unique across normalized and concurrent registrations', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [];
  t.after(async () => {
    try { if (users.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]); }
    finally { await pool.end(); }
  });
  const token = randomUUID();
  const name = `Unique-${token}`;
  const email = `unique-${token}@example.com`;
  const password = 'Unique-account-test-123';
  async function request(path, body) {
    const response = await fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await response.json();
    if (path === '/api/auth/register' && response.status === 201) users.push(json.data.id);
    return { response, json };
  }
  const register = (name, email) => request('/api/auth/register', { name, email, password });
  const conflict = (result, field) => {
    assert.equal(result.response.status, 409);
    assert.match(result.json.message, field === 'name' ? /username.*taken/i : /email.*already exists/i);
    assert.equal(result.response.headers.get('set-cookie'), null);
    assert.equal(result.json.data, undefined);
  };

  const owner = await register(`  ${name}  `, `  ${email.toUpperCase()}  `);
  assert.equal(owner.response.status, 201);
  assert.equal(owner.json.data.name, name);
  assert.equal(owner.json.data.email, email);
  for (const duplicateName of [name, `  ${name.toUpperCase()}  `]) {
    const unusedEmail = `unused-${randomUUID()}@example.com`;
    conflict(await register(duplicateName, unusedEmail), 'name');
    assert.equal((await pool.query('SELECT id FROM users WHERE email = $1', [unusedEmail])).rowCount, 0);
  }
  for (const duplicateEmail of [email, `  ${email.toUpperCase()}  `]) {
    const unusedName = `Unused-${randomUUID()}`;
    conflict(await register(unusedName, duplicateEmail), 'email');
    assert.equal((await pool.query('SELECT id FROM users WHERE name = $1', [unusedName])).rowCount, 0);
  }

  for (const field of ['name', 'email']) {
    const shared = field === 'name' ? `Race-${randomUUID()}` : `race-${randomUUID()}@example.com`;
    const results = await Promise.all([0, 1].map(index => register(
      field === 'name' ? (index ? `  ${shared.toUpperCase()}  ` : shared) : `Race-${randomUUID()}`,
      field === 'email' ? (index ? `  ${shared.toUpperCase()}  ` : shared) : `race-${randomUUID()}@example.com`,
    )));
    assert.deepEqual(results.map(result => result.response.status).sort(), [201, 409]);
    conflict(results.find(result => result.response.status === 409), field);
    const query = field === 'name'
      ? 'SELECT id FROM users WHERE LOWER(BTRIM(name)) = LOWER($1)'
      : 'SELECT id FROM users WHERE LOWER(BTRIM(email)) = LOWER($1)';
    assert.equal((await pool.query(query, [shared])).rowCount, 1);
  }

  // Direct writes must obey the same constraints, not only the registration route.
  for (const field of ['name', 'email']) {
    const id = randomUUID();
    users.push(id);
    const constraint = field === 'name' ? 'users_name_normalized_key' : 'users_email_normalized_key';
    await assert.rejects(pool.query(
      'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
      [id, field === 'name' ? `  ${name.toUpperCase()}  ` : `Direct-${id}`,
        field === 'email' ? `  ${email.toUpperCase()}  ` : `direct-${id}@example.com`, 'not-used'],
    ), error => error.code === '23505' && error.constraint === constraint);
    const query = field === 'name' ? 'UPDATE users SET name = $1 WHERE id = $2' : 'UPDATE users SET email = $1 WHERE id = $2';
    await assert.rejects(pool.query(query, [field === 'name' ? `  ${name.toUpperCase()}  ` : `  ${email.toUpperCase()}  `, users[1]]),
      error => error.code === '23505' && error.constraint === constraint);
  }

  // Legacy mixed-case emails still identify the same account under the new index.
  await pool.query('UPDATE users SET email = $1 WHERE id = $2', [`  ${email.toUpperCase()}  `, owner.json.data.id]);
  for (const identifier of [name.toUpperCase(), email]) {
    const login = await request('/api/auth/login', { identifier, password });
    assert.equal(login.response.status, 200);
    assert.equal(login.json.data.id, owner.json.data.id);
  }
});
