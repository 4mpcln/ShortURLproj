import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';

// Import the Vercel handler without starting its normal listener or external services.
Object.assign(process.env, {
  NODE_ENV: 'test', VERCEL: '1', REDIS_URL: '',
  DATABASE_URL: 'postgres://test:test@localhost/qlean_test',
  JWT_SECRET: randomBytes(32).toString('hex'),
  ACCESS_CODE_KEY: randomBytes(32).toString('hex'),
});
const { default: app } = await import('../dist/server.js');
const { pool } = await import('../dist/db.js');

test('static file paths bypass the alias resolver while short links keep redirecting', async t => {
  const query = t.mock.method(pool, 'query', async (_sql, values) => ({
    rows: values[0] === 'Summer_2026-sale' ? [{
      id: 'test-link', code: values[0], original_url: 'https://example.com/destination',
      click_count: 1, created_at: new Date(), updated_at: new Date(),
      kind: 'url', is_enabled: true,
    }] : [],
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const path of ['/favicon.ico', '/favicon-96x96.png', '/favicon.svg', '/qlean-logo.png',
    '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/manifest.json', '/assets/missing.js']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(base + path, { method });
      assert.equal(response.status, 404, 'Static files are served by Vercel/Vite, not the API.');
      assert.equal((await response.text()).includes('Short URL not found.'), false, path);
    }
  }
  assert.equal(query.mock.callCount(), 0, 'Asset requests must never query or record short-link clicks.');

  for (const path of ['/Summer_2026-sale', '/s/Summer_2026-sale']) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://example.com/destination');
    await response.text();
  }
  assert.equal(query.mock.callCount(), 2);
  for (const call of query.mock.calls) {
    assert.match(call.arguments[0], /UPDATE short_urls SET click_count = click_count \+ 1/);
    assert.equal(call.arguments[1][0], 'Summer_2026-sale');
  }

  const missing = await fetch(base + '/unknown-alias', { redirect: 'manual' });
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'Short URL not found.');
});
