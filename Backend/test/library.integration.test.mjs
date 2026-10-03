import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';
test('member library: persistent organization, ownership, pinning, scheduling and URL/QR statistics', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [];
  t.after(async () => {
    try {
      await pool.query('DELETE FROM short_urls WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  async function call(path, cookie, body, method) {
    const response = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    return { status: response.status, json: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const email = `library-${randomUUID()}@example.com`, password = 'Library-test-123';
  const a = await call('/api/auth/register', null, { name: 'Library A', email, password });
  assert.equal(a.status, 201); users.push(a.json.data.id);
  const b = await call('/api/auth/register', null, { name: 'Library B', email: `library-${randomUUID()}@example.com`, password });
  assert.equal(b.status, 201); users.push(b.json.data.id);
  const organization = await call('/api/library/organization', a.cookie);
  assert.deepEqual(organization.json.tags.map(tag => tag.name), ['Campaign','Examination','Social']);
  assert.equal((await call('/api/library/organization')).status, 401);
  const tag = await call('/api/library/tags', a.cookie, { name: 'Custom test', color: '#DB2777' });
  assert.equal(tag.status, 201); assert.equal(tag.json.data.color, '#db2777');
  assert.equal((await call('/api/library/tags', a.cookie, { name: 'Other tag', color: '#db2777' })).status, 409);
  assert.equal((await call('/api/library/tags', a.cookie, { name: 'custom TEST', color: '#0891b2' })).status, 409);
  const folder = await call('/api/library/folders', a.cookie, { name: 'Semester 1' });
  assert.equal(folder.status, 201);
  const metadata = { tagIds: [tag.json.data.id], folderId: folder.json.data.id };
  assert.equal((await call('/api/short-urls', b.cookie, { originalUrl: 'https://example.com', ...metadata })).status, 400);
  assert.equal((await call('/api/short-urls', null, { originalUrl: 'https://example.com', ...metadata })).status, 400);
  assert.equal((await call('/api/short-urls', a.cookie, { originalUrl: 'broken' })).status, 400);
  assert.equal((await call('/api/short-urls', a.cookie, { originalUrl: 'javascript:alert(1)' })).status, 400);
  const url = await call('/api/short-urls', a.cookie, { originalUrl: 'https://example.com/library', ...metadata });
  assert.equal(url.status, 201); assert.equal(url.json.data.kind, 'url'); assert.equal(url.json.data.folderName, 'Semester 1'); assert.equal(url.json.data.tags[0].id, tag.json.data.id);
  const qr = await call('/api/library/qr', a.cookie, { originalUrl: 'Plain text <script>safe</script>', ...metadata, qrOptions: { style: 'dots', color: '#185bb5', size: 600 } });
  assert.equal(qr.status, 201); assert.equal(qr.json.data.kind, 'qr');
  const qrAccess = await fetch(base + '/' + qr.json.data.code);
  assert.equal(qrAccess.status, 200); assert.match(qrAccess.headers.get('content-type'), /text\/plain/); assert.equal(await qrAccess.text(), 'Plain text <script>safe</script>');
  const urlAccess = await fetch(base + '/' + url.json.data.code, { redirect: 'manual' }); assert.equal(urlAccess.status, 302);
  assert.equal(urlAccess.headers.get('cache-control'), 'no-store');
  const stats = await call(`/api/library/links/${url.json.data.id}/statistics?days=7`, a.cookie);
  assert.equal(stats.status, 200); assert.equal(stats.json.data.item.clickCount, 1); assert.equal(stats.json.data.daily.length, 7); assert.equal(stats.json.data.daily.reduce((total, day) => total + day.clicks, 0), 1);
  assert.equal((await call(`/api/library/links/${url.json.data.id}/statistics`, b.cookie)).status, 404);
  assert.equal((await call(`/api/library/links/${url.json.data.id}/pin`, b.cookie, { isPinned: true }, 'PATCH')).status, 404);
  assert.equal((await call(`/api/library/links/${url.json.data.id}/pin`, a.cookie, { isPinned: true }, 'PATCH')).status, 200);
  assert.equal((await call('/api/my-links', a.cookie)).json.data[0].id, url.json.data.id);
  const publicItem = await call('/api/short-urls/' + url.json.data.code); assert.deepEqual(publicItem.json.data.tags, []); assert.equal(publicItem.json.data.folderName, null);
  const later = new Date(Date.now() + 3600000).toISOString(), past = new Date(Date.now() - 3600000).toISOString();
  assert.equal((await call('/api/short-urls', a.cookie, { originalUrl: 'https://example.com', startsAt: later, expiresAt: past })).status, 400);
  for (const [schedule, status] of [[{ startsAt: later }, 302], [{ expiresAt: past }, 410]]) {
    const created = await call('/api/short-urls', a.cookie, { originalUrl: 'https://example.com', ...schedule }); assert.equal(created.status, 201);
    const visit = await fetch(base + '/' + created.json.data.code, { redirect: 'manual' });
    assert.equal(visit.status, status);
    assert.equal(visit.headers.get('cache-control'), 'no-store');
    if (schedule.startsAt) assert.equal(new URL(visit.headers.get('location')).pathname, `/link-unavailable/${created.json.data.code}`);
    const access = await call(`/api/short-urls/${created.json.data.code}/access`);
    assert.equal(access.status, 200);
    assert.deepEqual(Object.keys(access.json.data).sort(), ['shortUrl', 'startsAt', 'status']);
    assert.equal(access.json.data.status, schedule.startsAt ? 'scheduled' : 'expired');
    assert.equal(access.json.data.startsAt, schedule.startsAt || null);
    assert.equal(access.json.data.shortUrl, created.json.data.shortUrl);
    const result = await call(`/api/library/links/${created.json.data.id}/statistics`, a.cookie); assert.equal(result.json.data.item.clickCount, 0);
    if (schedule.startsAt) {
      await pool.query('UPDATE short_urls SET starts_at=$1 WHERE id=$2 AND user_id=$3', [past, created.json.data.id, a.json.data.id]);
      assert.equal((await call(`/api/short-urls/${created.json.data.code}/access`)).json.data.status, 'active');
      assert.equal((await call(`/api/library/links/${created.json.data.id}/statistics`, a.cookie)).json.data.item.clickCount, 0);
      const opened = await fetch(base + '/' + created.json.data.code, { redirect: 'manual' });
      assert.equal(opened.status, 302); assert.equal(opened.headers.get('location'), 'https://example.com');
      assert.equal((await call(`/api/library/links/${created.json.data.id}/statistics`, a.cookie)).json.data.item.clickCount, 1);
    }
  }
  const missingAccess = await fetch(`${base}/api/short-urls/missing-${randomUUID()}/access`);
  assert.equal(missingAccess.status, 404); assert.equal(missingAccess.headers.get('cache-control'), 'no-store');
  const qrScheduled = await call('/api/library/qr', a.cookie, { originalUrl: 'Scheduled QR content', startsAt: later, qrOptions: { style: 'square', color: '#161616', size: 300 } });
  assert.equal(qrScheduled.status, 201);
  const qrWaiting = await fetch(base + '/' + qrScheduled.json.data.code, { redirect: 'manual' });
  assert.equal(qrWaiting.status, 302); assert.equal(new URL(qrWaiting.headers.get('location')).pathname, `/link-unavailable/${qrScheduled.json.data.code}`);
  assert.equal((await call(`/api/library/links/${qrScheduled.json.data.id}/statistics`, a.cookie)).json.data.item.clickCount, 0);
  const qrClosed = await call('/api/library/qr', a.cookie, { originalUrl: 'https://example.com', expiresAt: past, qrOptions: { style: 'square', color: '#161616', size: 300 } });
  assert.equal((await fetch(base + '/' + qrClosed.json.data.code, { redirect: 'manual' })).status, 410);
  const login = await call('/api/auth/login', null, { email, password });
  const persisted = await call('/api/library/organization', login.cookie);
  assert(persisted.json.tags.some(entry => entry.id === tag.json.data.id)); assert(persisted.json.folders.some(entry => entry.id === folder.json.data.id));
  assert.equal((await call('/api/my-links', b.cookie)).json.data.length, 0);
});
