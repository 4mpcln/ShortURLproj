import assert from 'node:assert/strict';
import test from 'node:test';
import { createStatisticsCache, statisticsCacheKey } from '../dist/statisticsCache.js';

test('statistics cache: fixed 300-second expiry, owner/period separation, invalidation and safe fallback', async () => {
  let now = Date.parse('2026-10-03T10:00:00Z');
  const values = new Map();
  const writes = [];
  const store = {
    isReady: true,
    async get(key) { return values.get(key) ?? null; },
    async setEx(key, seconds, value) { writes.push(seconds); values.set(key, value); },
    async del(keys) { keys.forEach(key => values.delete(key)); },
  };
  const cache = createStatisticsCache(store, () => now);
  let queries = 0;
  const load = async () => { queries++; return [{ date: '2026-10-03', clicks: queries }]; };
  const first = await cache.read('owner', 'link', 30, load);
  assert.equal(first.expiresAt, now + 300000);
  now += 100000;
  assert.deepEqual(await cache.read('owner', 'link', 30, load), first);
  assert.equal(queries, 1); assert.deepEqual(writes, [300]);
  await cache.read('other-owner', 'link', 30, load);
  await cache.read('owner', 'link', 7, load);
  assert.equal(queries, 3);
  now += 200001;
  await cache.read('owner', 'link', 30, load);
  assert.equal(queries, 4);
  await cache.invalidate('owner', 'link');
  assert.equal(values.has(statisticsCacheKey('owner', 'link', 30, now)), false);
  assert.equal(values.has(statisticsCacheKey('other-owner', 'link', 30, now)), true);
  values.set(statisticsCacheKey('owner', 'link', 30, now), 'invalid JSON');
  await cache.read('owner', 'link', 30, load);
  assert.equal(queries, 5);
  store.isReady = false;
  await cache.read('owner', 'link', 30, load);
  assert.equal(queries, 6);
  store.isReady = true;
  store.get = async () => { throw new Error('offline'); };
  store.setEx = async () => { throw new Error('offline'); };
  assert.equal((await cache.read('owner', 'link', 30, load)).daily[0].clicks, 7);
});

test('statistics cache changes keys at midnight in Asia/Bangkok', () => {
  const before = Date.parse('2026-10-03T16:59:59Z');
  assert.notEqual(statisticsCacheKey('owner', 'link', 30, before), statisticsCacheKey('owner', 'link', 30, before + 1000));
});

test('slow Redis is bounded and a database failure is not cached', async () => {
  const store = { isReady: true, get: () => new Promise(() => {}), setEx: async () => {}, del: async () => {} };
  const cache = createStatisticsCache(store);
  assert.deepEqual((await cache.read('owner', 'link', 30, async () => [])).daily, []);
  store.isReady = false;
  await assert.rejects(cache.read('owner', 'link', 30, async () => { throw new Error('database failure'); }), /database failure/);
});
