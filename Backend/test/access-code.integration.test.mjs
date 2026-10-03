import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';

test('protected URL and QR access, private code disclosure, encryption and owner edits', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [], links = [];
  t.after(async () => {
    try {
      if (links.length) await pool.query('DELETE FROM short_urls WHERE id=ANY($1::uuid[])', [links]);
      if (users.length) await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  async function request(path, { cookie, body, method } = {}) {
    const response = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'), redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { response, data: await response.json() };
  }
  async function account() {
    const result = await request('/api/auth/register', { body: { name: `Access code test ${randomUUID()}`, email: `pin-${randomUUID()}@example.com`, password: 'Access-test-password-123' } });
    assert.equal(result.response.status, 201);
    users.push(result.data.data.id);
    return result.response.headers.get('set-cookie').split(';')[0];
  }
  const owner = await account(), other = await account();
  assert.equal((await request('/api/short-urls', { body: { originalUrl: 'https://example.com/private', accessCode: '012345' } })).response.status, 400);
  assert.equal((await request('/api/library/qr', { body: { originalUrl: 'secret', accessCode: '012345', qrOptions: { style: 'dots', color: '#161616', size: 300 } } })).response.status, 401);
  for (const invalid of ['12345', '1234567', 'abcdef']) {
    assert.equal((await request('/api/short-urls', { cookie: owner, body: { originalUrl: 'https://example.com', accessCode: invalid } })).response.status, 400);
  }
  const created = await request('/api/short-urls', { cookie: owner, body: { originalUrl: 'https://example.com/private', accessCode: '012345' } });
  assert.equal(created.response.status, 201);
  const link = created.data.data;
  links.push(link.id);
  assert.equal(link.hasAccessCode, true);
  assert.equal(link.accessCode, undefined);
  assert.equal(link.access_code_ciphertext, undefined);
  const stored = (await pool.query('SELECT access_code_ciphertext FROM short_urls WHERE id=$1', [link.id])).rows[0].access_code_ciphertext;
  assert(stored && stored !== '012345' && !stored.includes('012345'));
  const listing = await request('/api/my-links', { cookie: owner });
  assert.equal(listing.data.data.find(row => row.id === link.id).hasAccessCode, true);
  assert(!JSON.stringify(listing.data).includes('012345'));
  const access = await request(`/api/short-urls/${link.code}/access`);
  assert.equal(access.data.data.hasAccessCode, true);
  assert.equal(access.data.data.originalUrl, undefined);
  assert.equal((await request(`/api/short-urls/${link.code}`)).response.status, 403);
  const redirect = await fetch(base + '/' + link.code, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert(redirect.headers.get('location').endsWith('/link-access/' + link.code));
  assert.equal((await request(`/api/library/links/${link.id}/statistics`)).response.status, 401);
  assert.equal((await request(`/api/library/links/${link.id}/statistics`, { cookie: other })).response.status, 404);
  const statistics = () => request(`/api/library/links/${link.id}/statistics`, { cookie: owner });
  assert.equal((await statistics()).data.data.accessCode, '012345');
  assert.equal((await statistics()).data.data.item.clickCount, 0);
  assert.equal((await request(`/api/short-urls/${link.code}/unlock`, { body: { accessCode: '999999' } })).response.status, 403);
  assert.equal((await statistics()).data.data.item.clickCount, 0);
  const unlocked = await request(`/api/short-urls/${link.code}/unlock`, { body: { accessCode: '012345' } });
  assert.equal(unlocked.response.status, 200);
  assert.equal(unlocked.data.data.originalUrl, 'https://example.com/private');
  assert.equal((await statistics()).data.data.item.clickCount, 1);
  assert.equal((await request(`/api/library/links/${link.id}`, { cookie: other, method: 'PATCH', body: { accessCode: null } })).response.status, 404);
  assert.equal((await request(`/api/library/links/${link.id}`, { cookie: owner, method: 'PATCH', body: { accessCode: '654321' } })).response.status, 200);
  assert.equal((await statistics()).data.data.accessCode, '654321');
  assert.equal((await request(`/api/short-urls/${link.code}/unlock`, { body: { accessCode: '012345' } })).response.status, 403);
  await request(`/api/library/links/${link.id}`, { cookie: owner, method: 'PATCH', body: { isEnabled: false } });
  assert.equal((await request(`/api/short-urls/${link.code}/unlock`, { body: { accessCode: '654321' } })).response.status, 403);
  await request(`/api/library/links/${link.id}`, { cookie: owner, method: 'PATCH', body: { isEnabled: true, startsAt: new Date(Date.now() + 86400000).toISOString() } });
  assert.equal((await request(`/api/short-urls/${link.code}/unlock`, { body: { accessCode: '654321' } })).response.status, 403);
  await request(`/api/library/links/${link.id}`, { cookie: owner, method: 'PATCH', body: { startsAt: null, expiresAt: new Date(Date.now() - 86400000).toISOString() } });
  assert.equal((await request(`/api/short-urls/${link.code}/unlock`, { body: { accessCode: '654321' } })).response.status, 403);
  await request(`/api/library/links/${link.id}`, { cookie: owner, method: 'PATCH', body: { expiresAt: null, accessCode: null } });
  assert.equal((await statistics()).data.data.accessCode, null);
  const publicRedirect = await fetch(base + '/' + link.code, { redirect: 'manual' });
  assert.equal(publicRedirect.headers.get('location'), 'https://example.com/private');
  const qr = await request('/api/library/qr', { cookie: owner, body: { originalUrl: 'Private QR content', accessCode: '000007', qrOptions: { style: 'dots', color: '#161616', size: 300 } } });
  assert.equal(qr.response.status, 201);
  links.push(qr.data.data.id);
  assert.equal(qr.data.data.hasAccessCode, true);
  assert.equal((await request(`/api/short-urls/${qr.data.data.code}/unlock`, { body: { accessCode: '000007' } })).data.data.originalUrl, 'Private QR content');
  const limited = await request('/api/short-urls', { cookie: owner, body: { originalUrl: 'https://example.com/limited', accessCode: '777777' } });
  links.push(limited.data.data.id);
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal((await request(`/api/short-urls/${limited.data.data.code}/unlock`, { body: { accessCode: '111111' } })).response.status, 403);
  }
  assert.equal((await request(`/api/short-urls/${limited.data.data.code}/unlock`, { body: { accessCode: '777777' } })).response.status, 429);
});
