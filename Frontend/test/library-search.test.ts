import assert from 'node:assert/strict';
import test from 'node:test';
import type { ShortUrl } from '../src/api/generated/shortUrl';
import { matchesLibraryQuery } from '../src/lib/librarySearch';

const item = {
  originalUrl: 'https://example.com', shortUrl: 'http://localhost:3211/demo', code: 'demo', title: 'Summer campaign',
  tags: [{ id: 'campaign', name: 'Campaign', color: '#ea580c' }, { id: 'social', name: 'Social', color: '#2563eb' }],
} as ShortUrl;

test('tag search includes single and multiple tags, regardless of order, case or surrounding whitespace', () => {
  for (const tags of [[item.tags[1]], item.tags, [...item.tags].reverse()]) {
    for (const query of ['social', 'SOCIAL', ' social ', 'soc']) {
      assert.equal(matchesLibraryQuery({ ...item, tags }, query), true);
    }
  }
  assert.equal(matchesLibraryQuery({ ...item, tags: [item.tags[0]] }, 'social'), false);
});

test('search handles multiple terms across fields and still matches URLs, titles and aliases', () => {
  for (const query of ['', '  ', 'summer   social', 'Social campaign', 'example.com', 'http://localhost:3211/demo', 'demo']) {
    assert.equal(matchesLibraryQuery(item, query), true, query);
  }
  assert.equal(matchesLibraryQuery(item, 'social missing'), false);
});
