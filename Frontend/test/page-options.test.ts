import assert from 'node:assert/strict';
import test from 'node:test';
import { readOrganizationOptions, readStatisticsPeriod, updatePageOptions, writeOrganizationOptions } from '../src/lib/pageOptions';

test('updates preserve other options, encode colors and remove cleared values without mutating the original', () => {
  const original = new URLSearchParams('style=dots&advanced=true&size=600');
  const changed = updatePageOptions(original, { color: '#185bb5', advanced: null });
  assert.equal(original.get('advanced'), 'true');
  assert.equal(changed.get('style'), 'dots');
  assert.equal(changed.get('size'), '600');
  assert.equal(changed.has('advanced'), false);
  assert.equal(new URLSearchParams(changed.toString()).get('color'), '#185bb5');
});

test('statistics restores presets and inclusive custom ranges, falling back for invalid queries', () => {
  for (const days of [7, 15, 30, 45, 60]) {
    assert.deepEqual(readStatisticsPeriod(new URLSearchParams(`days=${days}`)), { days });
  }
  assert.deepEqual(readStatisticsPeriod(new URLSearchParams('startDate=2026-10-01&endDate=2026-10-03')),
    { startDate: '2026-10-01', endDate: '2026-10-03' });
  assert.deepEqual(readStatisticsPeriod(new URLSearchParams('startDate=2026-10-03&endDate=2026-10-03')),
    { startDate: '2026-10-03', endDate: '2026-10-03' });
  for (const query of ['', 'days=999', 'days=nope', 'startDate=2026-02-30&endDate=2026-03-05',
    'startDate=2026-10-03', 'startDate=2026-10-03&endDate=2026-10-01',
    'startDate=2025-01-01&endDate=2026-10-03']) {
    assert.deepEqual(readStatisticsPeriod(new URLSearchParams(query)), { days: 30 }, query);
  }
});

test('organization choices round trip while preserving QR choices and clearing old tags', () => {
  const metadata = { tagIds: ['campaign', 'social'], folderId: 'folder-1', startsAt: '2026-10-03T09:30', expiresAt: '' };
  const result = writeOrganizationOptions(new URLSearchParams('style=dots&tag=old&expiresAt=2026-10-04T09:30'), metadata);
  assert.deepEqual(readOrganizationOptions(new URLSearchParams(result.toString())), metadata);
  assert.equal(result.get('style'), 'dots');
  assert.equal(result.has('expiresAt'), false);
  assert.deepEqual(readOrganizationOptions(new URLSearchParams('tag=social&tag=social&startsAt=invalid')),
    { tagIds: ['social'], folderId: '', startsAt: '', expiresAt: '' });
});
