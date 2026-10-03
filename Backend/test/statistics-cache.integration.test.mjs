import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { createClient } from 'redis';
import { statisticsCacheKey } from '../dist/statisticsCache.js';

test('Redis statistics: real TTL, cached daily visits, ownership and mutation invalidation', async t => {
  const redis = createClient({ url: process.env.TEST_REDIS_URL || 'redis://localhost:6379', socket: { reconnectStrategy: false, connectTimeout: 1000 } });
  redis.on('error', () => {});
  try { await redis.connect(); } catch { t.skip('Redis is unavailable'); return; }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';
  const users = [], keys = [];
  t.after(async () => {
    try {
      if (keys.length) await redis.del(keys);
      await pool.query('DELETE FROM short_urls WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); await redis.close(); }
  });
  async function call(path, cookie, body, method = body ? 'POST' : 'GET') {
    const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const owner = await call('/api/auth/register', null, { name: `Cache QA ${randomUUID()}`, email: `cache-${randomUUID()}@example.com`, password: 'Cache-test-123' });
  assert.equal(owner.status, 201); users.push(owner.data.data.id);
  const other = await call('/api/auth/register', null, { name: `Other cache QA ${randomUUID()}`, email: `cache-${randomUUID()}@example.com`, password: 'Cache-test-123' });
  users.push(other.data.data.id);
  const created = await call('/api/short-urls', owner.cookie, { originalUrl: 'https://example.com/cache-test' });
  const item = created.data.data;
  const path = `/api/library/links/${item.id}`;
  const key = statisticsCacheKey(owner.data.data.id, item.id, 30); keys.push(key);
  const first = await call(path + '/statistics', owner.cookie);
  assert.equal(first.status, 200);
  assert(Number.isFinite(Date.parse(first.data.data.cacheExpiresAt)));
  const ttl = await redis.ttl(key); assert(ttl > 295 && ttl <= 300);
  await fetch(`${base}/${item.code}`, { redirect: 'manual' });
  const second = await call(path + '/statistics', owner.cookie);
  assert.equal(second.data.data.item.clickCount, 1);
  assert.equal(second.data.data.daily.reduce((sum, day) => sum + day.clicks, 0), 0);
  assert.equal(first.data.data.cacheExpiresAt, second.data.data.cacheExpiresAt);
  assert.equal((await call(path + '/statistics', other.cookie)).status, 404);
  assert.equal((await call(path + '/statistics')).status, 401);
  await redis.expire(key, 1);
  await new Promise(resolve => setTimeout(resolve, 1100));
  const refreshed = await call(path + '/statistics', owner.cookie);
  assert.equal(refreshed.data.data.daily.reduce((sum, day) => sum + day.clicks, 0), 1);
  assert.equal((await call(path, owner.cookie, { title: 'Changed title' }, 'PATCH')).status, 200);
  assert.equal(await redis.exists(key), 0);
  assert.equal((await call(path + '/statistics', owner.cookie)).data.data.item.title, 'Changed title');
  assert.equal((await call(path + '/pin', owner.cookie, { isPinned: true }, 'PATCH')).status, 200);
  assert.equal(await redis.exists(key), 0);
  await call(path + '/statistics', owner.cookie);
  assert.equal((await call(path, owner.cookie, null, 'DELETE')).status, 204);
  assert.equal(await redis.exists(key), 0);
  assert.equal((await call(path + '/statistics', owner.cookie)).status, 404);
});
