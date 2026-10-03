import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';
test('owners can pause URL and QR access without recording visits or changing schedules', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [];
  t.after(async () => {
    try {
      await pool.query('DELETE FROM short_urls WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    }
    finally { await pool.end(); }
  });
  async function call(path, cookie, body, method = body ? 'POST' : 'GET') {
    const response = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, json: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function member() {
    const result = await call('/api/auth/register', null, { name: 'Enable test', email: `enable-${randomUUID()}@example.com`, password: 'Enabled-test-123' });
    assert.equal(result.status, 201); users.push(result.json.data.id); return result;
  }
  const owner = await member(), other = await member();
  for (const kind of ['url', 'qr']) {
    const created = await call(kind === 'url' ? '/api/short-urls' : '/api/library/qr', owner.cookie, {
      originalUrl: kind === 'url' ? 'https://example.com/enabled' : 'Paused QR content',
      ...(kind === 'qr' ? { qrOptions: { style: 'square', color: '#161616', size: 300 } } : {}),
    });
    assert.equal(created.status, 201);
    const item = created.json.data, path = `/api/library/links/${item.id}`;
    assert.equal(item.isEnabled, true);
    assert.equal((await call(path, null, { isEnabled: false }, 'PATCH')).status, 401);
    assert.equal((await call(path, other.cookie, { isEnabled: false }, 'PATCH')).status, 404);
    assert.equal((await call(path, owner.cookie, { isEnabled: 'false' }, 'PATCH')).status, 400);
    const disabled = await call(path, owner.cookie, { isEnabled: false }, 'PATCH');
    assert.equal(disabled.status, 200);
    assert.equal(disabled.json.data.isEnabled, false); assert.equal(disabled.json.data.status, 'disabled');
    assert.equal(disabled.json.data.code, item.code); assert.equal(disabled.json.data.shortUrl, item.shortUrl);
    const access = await call(`/api/short-urls/${item.code}/access`);
    assert.equal(access.json.data.status, 'disabled');
    const visit = await fetch(`${base}/${item.code}`, { redirect: 'manual' });
    assert.equal(visit.status, 302);
    assert.equal(new URL(visit.headers.get('location')).pathname, `/link-unavailable/${item.code}`);
    assert.equal(visit.headers.get('cache-control'), 'no-store');
    const stats = (await call(path + '/statistics', owner.cookie)).json.data;
    assert.equal(stats.item.clickCount, 0); assert.equal(stats.daily.reduce((sum, day) => sum + day.clicks, 0), 0);
    assert.equal((await call('/api/my-links', owner.cookie)).json.data.find(row => row.id === item.id).isEnabled, false);
    assert.equal((await call(path, owner.cookie, { title: 'Still disabled' }, 'PATCH')).json.data.isEnabled, false);
    const enabled = await call(path, owner.cookie, { isEnabled: true }, 'PATCH');
    assert.equal(enabled.json.data.status, 'active');
    const resumed = await fetch(`${base}/${item.code}`, { redirect: 'manual' });
    assert.equal(resumed.status, kind === 'url' ? 302 : 200);
    if (kind === 'url') assert.equal(resumed.headers.get('location'), item.originalUrl);
    else assert.equal(await resumed.text(), item.originalUrl);
    assert.equal((await call(path + '/statistics', owner.cookie)).json.data.item.clickCount, 1);
    for (const [schedule, status] of [
      [{ startsAt: new Date(Date.now() + 3600000).toISOString(), expiresAt: null }, 'scheduled'],
      [{ startsAt: null, expiresAt: new Date(Date.now() - 3600000).toISOString() }, 'expired'],
    ]) {
      assert.equal((await call(path, owner.cookie, { ...schedule, isEnabled: false }, 'PATCH')).json.data.status, 'disabled');
      const restored = (await call(path, owner.cookie, { isEnabled: true }, 'PATCH')).json.data;
      assert.equal(restored.status, status);
      assert.equal(restored.startsAt, schedule.startsAt); assert.equal(restored.expiresAt, schedule.expiresAt);
      assert.equal((await call(`/api/short-urls/${item.code}/access`)).json.data.status, status);
      assert.equal((await fetch(`${base}/${item.code}`, { redirect: 'manual' })).status, status === 'expired' ? 410 : 302);
    }
  }
});
