import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const baseUrl = process.env.TEST_API_BASE_URL ?? 'http://localhost:3211';

test('accounts, session cookies, private link ownership and guest access', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [];
  const links = [];
  t.after(async () => {
    try {
      if (links.length) await pool.query('DELETE FROM short_urls WHERE id = ANY($1::uuid[])', [links]);
      if (users.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });

  async function request(path, { cookie, body, method, origin } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    return { response, body: response.status === 204 ? null : await response.json() };
  }

  const password = 'Qlean-test-password-123';
  const email = `auth-test-${randomUUID()}@example.com`;
  const first = await request('/api/auth/register', { body: { name: 'Auth Test', email: email.toUpperCase(), password } });
  assert.equal(first.response.status, 201);
  users.push(first.body.data.id);
  assert.equal(first.body.data.email, email);
  assert.equal(first.body.data.password_hash, undefined);
  const setCookie = first.response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const firstCookie = setCookie.split(';')[0];
  const stored = await pool.query('SELECT password_hash FROM users WHERE id = $1', [users[0]]);
  assert.notEqual(stored.rows[0].password_hash, password);
  assert(await bcrypt.compare(password, stored.rows[0].password_hash));

  assert.equal((await request('/api/auth/register', { body: { name: 'Other', email, password } })).response.status, 409);
  assert.equal((await request('/api/auth/register', { body: { name: 'Other', email: 'long@example.com', password: 'ก'.repeat(25) } })).response.status, 400);
  assert.equal((await request('/api/auth/login', { body: { email, password: 'wrong-password' } })).response.status, 401);
  assert.equal((await request('/api/auth/me', { cookie: firstCookie })).body.data.id, users[0]);
  assert.equal((await request('/api/my-links')).response.status, 401);
  assert.equal((await request('/api/my-links', { cookie: 'qlean_session=invalid' })).response.status, 401);
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie: firstCookie, origin: 'https://other.example' })).response.status, 403);

  const memberLink = await request('/api/short-urls', { cookie: firstCookie, body: { originalUrl: 'https://example.com/member-test' } });
  assert.equal(memberLink.response.status, 201);
  links.push(memberLink.body.data.id);
  const publicBaseUrl = (process.env.SHORT_URL_BASE || process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3211}`).replace(/\/+$/, '');
  assert.equal(memberLink.body.data.shortUrl, `${publicBaseUrl}/${memberLink.body.data.code}`);
  const guestLink = await request('/api/short-urls', { body: { originalUrl: 'https://example.com/guest-test' } });
  assert.equal(guestLink.response.status, 201);
  links.push(guestLink.body.data.id);
  const second = await request('/api/auth/register', { body: { name: 'Second User', email: `auth-test-${randomUUID()}@example.com`, password } });
  assert.equal(second.response.status, 201);
  users.push(second.body.data.id);
  const secondCookie = second.response.headers.get('set-cookie').split(';')[0];
  const secondLinks = await request(`/api/my-links?userId=${users[0]}`, { cookie: secondCookie });
  assert.equal(secondLinks.body.data.length, 0);
  const own = await request('/api/my-links', { cookie: firstCookie });
  assert.deepEqual(own.body.data.map(link => link.id), [memberLink.body.data.id]);
  const publicLinks = await request('/api/short-urls');
  assert(!publicLinks.body.data.some(link => link.id === memberLink.body.data.id));

  const redirect = await fetch(`${baseUrl}/${memberLink.body.data.code}`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'https://example.com/member-test');
  assert.equal((await request('/api/my-links', { cookie: firstCookie })).body.data[0].clickCount, 1);
  const logout = await request('/api/auth/logout', { method: 'POST', cookie: firstCookie });
  assert.equal(logout.response.status, 204);
  assert.match(logout.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  const login = await request('/api/auth/login', { body: { email, password } });
  assert.equal(login.response.status, 200);
  assert.equal(login.body.data.id, users[0]);
});
