import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';

const base = process.env.TEST_API_BASE_URL || 'http://localhost:3211';
test('library edits and deletion: owner-only, atomic metadata, stable aliases and cascading deletion', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://shorturl:shorturl@localhost:5432/shorturl' });
  const users = [];
  t.after(async () => {
    try {
      await pool.query('DELETE FROM short_urls WHERE user_id=ANY($1::uuid[])', [users]);
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    } finally { await pool.end(); }
  });
  async function call(path, cookie, body, method, origin) {
    const response = await fetch(base + path, {
      method: method || (body ? 'POST' : 'GET'), redirect: 'manual',
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function member(name) {
    const result = await call('/api/auth/register', null, { name, email: `mutations-${randomUUID()}@example.com`, password: 'Mutations-test-123' });
    assert.equal(result.status, 201); users.push(result.json.data.id); return result;
  }
  const a = await member('Mutation A'), b = await member('Mutation B');
  const org = (await call('/api/library/organization', a.cookie)).json;
  const foreignOrg = (await call('/api/library/organization', b.cookie)).json;
  const folder = (await call('/api/library/folders', a.cookie, { name: 'Edited folder' })).json.data;
  const foreignFolder = (await call('/api/library/folders', b.cookie, { name: 'Private folder' })).json.data;
  const created = await call('/api/short-urls', a.cookie, { originalUrl: 'https://example.com/before', title: 'Before', tagIds: [org.tags[0].id], folderId: folder.id });
  assert.equal(created.status, 201);
  const item = created.json.data, path = `/api/library/links/${item.id}`;
  assert.equal((await fetch(base + '/' + item.code, { redirect: 'manual' })).status, 302);
  assert.equal((await call(path + '/pin', a.cookie, { isPinned: true }, 'PATCH')).status, 200);
  for (const method of ['PATCH', 'DELETE']) {
    const body = method === 'PATCH' ? { title: 'Not yours' } : undefined;
    assert.equal((await call(path, null, body, method)).status, 401);
    assert.equal((await call(path, b.cookie, body, method)).status, 404);
    assert.equal((await call('/api/library/links/not-a-uuid', a.cookie, body, method)).status, 400);
    assert.equal((await call('/api/library/links/' + randomUUID(), a.cookie, body, method)).status, 404);
    assert.equal((await call(path, a.cookie, body, method, 'https://untrusted.example')).status, 403);
  }
  const before = (await call(path + '/statistics', a.cookie)).json.data.item;
  for (const invalid of [
    {}, { code: 'replacement' }, { userId: b.json.data.id }, { kind: 'qr' }, { isPinned: false },
    { originalUrl: 'javascript:alert(1)' }, { originalUrl: 'broken' }, { originalUrl: 'ftp://example.com' },
    { title: 'x'.repeat(161) }, { startsAt: '2026-10-03T11:30' },
    { tagIds: [foreignOrg.tags[0].id], title: 'Must roll back' }, { folderId: foreignFolder.id },
    { startsAt: '2026-10-04T11:30:00Z', expiresAt: '2026-10-04T10:30:00Z' },
  ]) assert.equal((await call(path, a.cookie, invalid, 'PATCH')).status, 400, JSON.stringify(invalid));
  assert.deepEqual((await call(path + '/statistics', a.cookie)).json.data.item, before);
  const startsAt = new Date(Date.now() - 3600000).toISOString(), expiresAt = new Date(Date.now() + 86400000).toISOString();
  const edited = await call(path, a.cookie, { title: 'After', originalUrl: 'https://example.com/after?x=1', tagIds: [org.tags[1].id, org.tags[1].id], folderId: null, startsAt, expiresAt }, 'PATCH');
  assert.equal(edited.status, 200);
  assert.equal(edited.json.data.code, item.code); assert.equal(edited.json.data.shortUrl, item.shortUrl);
  assert.equal(edited.json.data.createdAt, item.createdAt); assert.equal(edited.json.data.kind, 'url');
  assert.equal(edited.json.data.isPinned, true); assert.equal(edited.json.data.clickCount, 1);
  assert.equal(edited.json.data.title, 'After'); assert.equal(edited.json.data.originalUrl, 'https://example.com/after?x=1');
  assert.equal(edited.json.data.folderId, null); assert.equal(edited.json.data.folderName, null);
  assert.equal(edited.json.data.startsAt, startsAt); assert.equal(edited.json.data.expiresAt, expiresAt);
  assert.deepEqual(edited.json.data.tags.map(tag => tag.id), [org.tags[1].id]);
  const redirected = await fetch(base + '/' + item.code, { redirect: 'manual' });
  assert.equal(redirected.status, 302); assert.equal(redirected.headers.get('location'), 'https://example.com/after?x=1');
  const stats = (await call(path + '/statistics', a.cookie)).json.data;
  assert.equal(stats.item.clickCount, 2); assert.equal(stats.daily.reduce((sum, day) => sum + day.clicks, 0), 2);
  const cleared = await call(path, a.cookie, { title: '', tagIds: [], startsAt: null, expiresAt: null }, 'PATCH');
  assert.equal(cleared.status, 200); assert.equal(cleared.json.data.title, null); assert.deepEqual(cleared.json.data.tags, []);
  assert.equal(cleared.json.data.startsAt, null); assert.equal(cleared.json.data.expiresAt, null);
  assert.equal(cleared.json.data.originalUrl, 'https://example.com/after?x=1');

  const hour = 3600000, at = hours => new Date(Date.now() + hours * hour).toISOString();
  const schedule = { startsAt: at(1), expiresAt: at(4) };
  assert.equal((await call(path, a.cookie, schedule, 'PATCH')).status, 200);
  const scheduled = (await call(path + '/statistics', a.cookie)).json.data.item;
  assert.equal((await call(path, a.cookie, { expiresAt: at(0.5), title: 'Rollback' }, 'PATCH')).status, 400);
  assert.equal((await call(path, a.cookie, { startsAt: at(5) }, 'PATCH')).status, 400);
  assert.deepEqual((await call(path + '/statistics', a.cookie)).json.data.item, scheduled);
  const concurrent = await Promise.all([
    call(path, a.cookie, { startsAt: at(3) }, 'PATCH'),
    call(path, a.cookie, { expiresAt: at(2) }, 'PATCH'),
  ]);
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 400]);
  const merged = (await call(path + '/statistics', a.cookie)).json.data.item;
  assert(new Date(merged.startsAt) < new Date(merged.expiresAt));

  const qrOptions = { style: 'dots', color: '#185bb5', size: 600 };
  const qr = (await call('/api/library/qr', a.cookie, { originalUrl: 'Old text', qrOptions, tagIds: [org.tags[0].id], folderId: folder.id })).json.data;
  const qrPath = `/api/library/links/${qr.id}`;
  assert.equal((await call(qrPath, a.cookie, { originalUrl: 'x'.repeat(1001) }, 'PATCH')).status, 400);
  const qrEdit = await call(qrPath, a.cookie, { originalUrl: '<script>new text</script>', title: 'Edited QR' }, 'PATCH');
  assert.equal(qrEdit.status, 200); assert.equal(qrEdit.json.data.code, qr.code);
  assert.equal(qrEdit.json.data.shortUrl, qr.shortUrl); assert.deepEqual(qrEdit.json.data.qrOptions, qrOptions);
  assert.equal(qrEdit.json.data.folderId, folder.id); assert.equal(qrEdit.json.data.tags[0].id, org.tags[0].id);
  const qrVisit = await fetch(base + '/' + qr.code);
  assert.equal(qrVisit.status, 200); assert.match(qrVisit.headers.get('content-type'), /text\/plain/);
  assert.equal(await qrVisit.text(), '<script>new text</script>');
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM click_logs WHERE short_url_id=$1', [qr.id])).rows[0].count, 1);
  assert.equal((await call(qrPath, a.cookie, undefined, 'DELETE')).status, 204);
  assert.equal((await call(qrPath, a.cookie, undefined, 'DELETE')).status, 404);
  for (const table of ['click_logs', 'short_url_tags']) {
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE short_url_id=$1`, [qr.id])).rows[0].count, 0);
  }
  assert.equal((await fetch(base + '/' + qr.code, { redirect: 'manual' })).status, 404);
  assert.equal((await call(`/api/short-urls/${qr.code}/access`)).status, 404);
  assert.equal((await call(qrPath + '/statistics', a.cookie)).status, 404);
  const retainedOrg = (await call('/api/library/organization', a.cookie)).json;
  assert(retainedOrg.tags.some(tag => tag.id === org.tags[0].id)); assert(retainedOrg.folders.some(entry => entry.id === folder.id));
  assert.equal((await call('/api/my-links', a.cookie)).json.data.length, 1);
  assert.equal((await call(path, a.cookie, undefined, 'DELETE')).status, 204);
  assert.equal((await call('/api/my-links', a.cookie)).json.data.length, 0);
});
