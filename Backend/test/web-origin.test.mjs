import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedWebOrigin } from '../dist/webOrigin.js';

test('development accepts loopback origins on Vite ports but rejects external and malformed origins', () => {
  for (const origin of ['http://localhost:3210', 'http://127.0.0.1:3210', 'http://localhost:3212', 'http://[::1]:3210']) {
    assert.equal(isAllowedWebOrigin(origin, 'http://localhost:3210', true), true, origin);
  }
  for (const origin of ['https://other.example', 'http://localhost.evil.example:3210', 'http://127.0.0.2:3210', 'null',
    'http://user@localhost:3210', 'http://localhost:3210/path', 'http://localhost:3210?x=1']) {
    assert.equal(isAllowedWebOrigin(origin, 'http://localhost:3210', true), false, origin);
  }
});

test('production only accepts the configured origin', () => {
  assert.equal(isAllowedWebOrigin('https://qlean.example', 'https://qlean.example', false), true);
  for (const origin of ['http://localhost:3210', 'http://127.0.0.1:3210', 'https://other.example']) {
    assert.equal(isAllowedWebOrigin(origin, 'https://qlean.example', false), false, origin);
  }
});
