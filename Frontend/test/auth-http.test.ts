import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { apiClient, onUnauthorized } from '../src/api/http';

function rejected(config: InternalAxiosRequestConfig, status?: number) {
  return new AxiosError('Request failed', status ? AxiosError.ERR_BAD_REQUEST : AxiosError.ERR_NETWORK, config, undefined,
    status ? { data: { message: 'Rejected' }, status, statusText: 'Rejected', headers: {}, config } : undefined);
}

test('authenticated API failures signal expiry only for 401, not login failures or outages', async () => {
  let expired = 0;
  const unsubscribe = onUnauthorized(() => expired++);
  try {
    for (const [url, status, expected] of [
      ['/api/my-links', 401, 1],
      ['/api/library/organization', 401, 2],
      ['/api/auth/me', 401, 3],
      ['/api/auth/login', 401, 3],
      ['/api/auth/register?source=modal', 401, 3],
      ['https://api.example.com/api/auth/login', 401, 3],
      ['/api/my-links', 403, 3],
      ['/api/my-links', 500, 3],
      ['/api/my-links', undefined, 3],
    ] as const) {
      let failure: AxiosError;
      await assert.rejects(apiClient({ url, adapter: async config => { failure = rejected(config, status); throw failure; } }),
        error => error === failure);
      assert.equal(expired, expected, url);
    }
    assert.deepEqual(await apiClient({ url: '/api/my-links', adapter: async config => ({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config }) }), { data: [] });
    assert.equal(expired, 3);
  } finally { unsubscribe(); }
});

test('late unauthorized responses cannot expire a replacement session', async () => {
  let oldExpired = 0, newExpired = 0;
  const old = onUnauthorized(() => oldExpired++);
  let release: () => void;
  let started: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const pending = apiClient({ url: '/api/my-links', adapter: config => new Promise((_resolve, reject) => {
    release = () => reject(rejected(config, 401));
    started();
  }) });
  await ready;
  old();
  const current = onUnauthorized(() => newExpired++);
  try {
    const rejectedRequest = assert.rejects(pending, error => error instanceof AxiosError && error.response?.status === 401);
    release!();
    await rejectedRequest;
    assert.equal(oldExpired, 0);
    assert.equal(newExpired, 0);
    await assert.rejects(apiClient({ url: '/api/my-links', adapter: async config => { throw rejected(config, 401); } }));
    assert.equal(newExpired, 1);
  } finally { current(); }
  await assert.rejects(apiClient({ url: '/api/my-links', adapter: async config => { throw rejected(config, 401); } }));
  assert.equal(newExpired, 1);
});
