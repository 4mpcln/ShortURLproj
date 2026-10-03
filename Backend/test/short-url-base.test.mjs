import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function buildUrl(settings = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const key of ['SHORT_URL_BASE', 'APP_BASE_URL', 'PORT', 'DOTENV_CONFIG_PATH']) delete env[key];
  Object.assign(env, settings, { DOTENV_CONFIG_PATH: '/dev/null' });
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { toShortUrl } from './dist/shortUrlService.js';
    process.stdout.write(JSON.stringify([toShortUrl('v29sJdB'), toShortUrl('my-custom_alias')]));
  `], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
}

test('one URL builder supports defaults, public environment base, legacy fallback and aliases', () => {
  for (const [env, base] of [
    [{}, 'http://localhost:3211'],
    [{ PORT: '4321' }, 'http://localhost:4321'],
    [{ SHORT_URL_BASE: 'https://mydomain.com///' }, 'https://mydomain.com'],
    [{ APP_BASE_URL: 'https://legacy.example/' }, 'https://legacy.example'],
    [{ SHORT_URL_BASE: 'https://mydomain.com', APP_BASE_URL: 'https://legacy.example' }, 'https://mydomain.com'],
    [{ SHORT_URL_BASE: 'https://mydomain.com/links/' }, 'https://mydomain.com/links'],
  ]) {
    const result = buildUrl(env);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [`${base}/v29sJdB`, `${base}/my-custom_alias`]);
  }
});

test('invalid public bases fail at startup instead of producing misleading links', () => {
  for (const SHORT_URL_BASE of ['not-a-url', 'ftp://mydomain.com', 'https://user:secret@mydomain.com', 'https://mydomain.com?x=1', 'https://mydomain.com#section']) {
    assert.notEqual(buildUrl({ SHORT_URL_BASE }).status, 0);
  }
});
