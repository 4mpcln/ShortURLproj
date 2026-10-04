import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

const configModule = new URL('../dist/config.js', import.meta.url).href;
const key = randomBytes(32).toString('hex');
function load(overrides = {}) {
  const env = { ...process.env };
  for (const name of ['WEB_ORIGIN', 'SHORT_URL_BASE', 'APP_BASE_URL', 'REDIS_URL']) delete env[name];
  return spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { config } from ${JSON.stringify(configModule)}; console.log(JSON.stringify({ webOrigin: config.webOrigin, shortUrlBase: config.shortUrlBase, redisUrl: config.redisUrl, secureCookies: config.secureCookies }));`], {
    encoding: 'utf8', env: {
      ...env, NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'qlean.vercel.app', VERCEL_URL: 'qlean-preview.vercel.app',
      DATABASE_URL: 'postgres://test:test@database.example/qlean', JWT_SECRET: key, ACCESS_CODE_KEY: key,
      ...overrides,
    },
  });
}

test('Vercel uses same-origin secure cookies, root-level links and optional Redis', () => {
  const production = load();
  assert.equal(production.status, 0, production.stderr);
  assert.deepEqual(JSON.parse(production.stdout), {
    webOrigin: 'https://qlean.vercel.app', shortUrlBase: 'https://qlean.vercel.app', redisUrl: '', secureCookies: true,
  });
  const preview = load({ VERCEL_ENV: 'preview' });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).webOrigin, 'https://qlean-preview.vercel.app');
  assert.equal(JSON.parse(preview.stdout).shortUrlBase, 'https://qlean-preview.vercel.app');
  const custom = load({ WEB_ORIGIN: 'https://qlean.example', SHORT_URL_BASE: 'https://qlean.example/s', REDIS_URL: 'rediss://cache.example:6379' });
  assert.equal(custom.status, 0, custom.stderr);
  assert.equal(JSON.parse(custom.stdout).webOrigin, 'https://qlean.example');
  assert.equal(JSON.parse(custom.stdout).shortUrlBase, 'https://qlean.example/s');
  assert.equal(JSON.parse(custom.stdout).redisUrl, 'rediss://cache.example:6379');
});

test('Vercel requires hosted database credentials and stable encryption secrets', () => {
  for (const [env, message] of [
    [{ DATABASE_URL: '' }, /DATABASE_URL is required/],
    [{ JWT_SECRET: '' }, /JWT_SECRET must contain at least 32 characters/],
    [{ ACCESS_CODE_KEY: '' }, /ACCESS_CODE_KEY must contain 64 hexadecimal characters/],
    [{ ACCESS_CODE_KEY: 'z'.repeat(64) }, /ACCESS_CODE_KEY must contain 64 hexadecimal characters/],
  ]) {
    const result = load(env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
  }
});
